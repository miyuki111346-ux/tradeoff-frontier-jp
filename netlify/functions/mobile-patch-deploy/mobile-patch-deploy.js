// Maintenance function: adds the shared mobile-display patch to one of this account's own sites,
// or restores a previous deploy. Requires MAINT_SECRET. Remove this function when the work is finished.
const crypto = require('crypto');
const PATCH = require('./patch.js');
const SITE_FIXES = require('./site-fixes.js');
const FIX_START = '<!-- site-fix:start -->';
const FIX_END = '<!-- site-fix:end -->';

const API = 'https://api.netlify.com/api/v1';
const DASHBOARD_SITE_NAME = 'netlify-project-list-dashboard';
const START = '<!-- mobile-patch:start';
const END = '<!-- mobile-patch:end -->';

function json(statusCode, obj) {
  return { statusCode, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }, body: JSON.stringify(obj) };
}

function safeEqual(a, b) {
  const x = Buffer.from(String(a || ''));
  const y = Buffer.from(String(b || ''));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

async function api(token, path, opts = {}) {
  const res = await fetch(API + path, { ...opts, headers: { Authorization: `Bearer ${token}`, ...(opts.headers || {}) } });
  if (!res.ok) throw new Error(`Netlify API ${opts.method || 'GET'} ${path.split('?')[0]}: ${res.status}`);
  return res;
}

async function findSite(token, name) {
  let page = 1;
  for (;;) {
    const batch = await (await api(token, `/sites?per_page=100&page=${page}`)).json();
    const hit = batch.find((s) => s.name === name);
    if (hit) return hit;
    if (batch.length < 100) return null;
    page++;
  }
}

// What is added for a site: the shared patch (unless the site's fix says otherwise) and its own fix, if any.
function additionFor(name) {
  const fix = SITE_FIXES[name];
  const parts = [];
  if (!fix || fix.generic) parts.push(PATCH.trim());
  if (fix && fix.html) parts.push(FIX_START + '\n' + fix.html + '\n' + FIX_END);
  return parts.join('\n');
}

function removeBlock(html, start, end) {
  const s = html.indexOf(start);
  const e = html.indexOf(end);
  if (s === -1 || e === -1 || e < s) return html;
  let tail = html.slice(e + end.length);
  if (tail.startsWith('\n')) tail = tail.slice(1);
  return html.slice(0, s) + tail;
}

function applyPatch(html, name) {
  const base = removeBlock(removeBlock(html, START, END), FIX_START, FIX_END);
  const add = additionFor(name);
  const i = base.toLowerCase().lastIndexOf('</body>');
  return i === -1 ? base + '\n' + add + '\n' : base.slice(0, i) + add + '\n' + base.slice(i);
}

// Netlify adds its real-user-monitoring script when serving some sites. It is not part of the deployed file.
const RUM_RE = /<script async id="netlify-rum-container"[^>]*><\/script>\s*$/;

exports.handler = async function (event) {
  if (event.httpMethod === 'GET') {
    const q = event.queryStringParameters || {};
    if (q.action === 'patch-text') return json(200, { patch: q.site ? additionFor(q.site) : PATCH });
    return json(405, { error: 'POST only' });
  }
  const token = process.env.NETLIFY_API_TOKEN;
  if (!token || !process.env.MAINT_SECRET) return json(500, { error: 'not configured' });

  let body;
  try { body = JSON.parse(event.body || '{}'); } catch (e) { return json(400, { error: 'bad json' }); }
  if (!safeEqual(body.secret, process.env.MAINT_SECRET)) return json(403, { error: 'forbidden' });
  const name = body.site;
  if (!name || !/^[a-z0-9-]{1,63}$/.test(name) || name === DASHBOARD_SITE_NAME) return json(400, { error: 'invalid site' });

  try {
    const site = await findSite(token, name);
    if (!site) return json(404, { error: 'unknown site' });

    if (body.action === 'status') {
      const d = await (await api(token, `/deploys/${encodeURIComponent(body.deployId)}`)).json();
      if (d.site_id !== site.id) return json(400, { error: 'deploy does not belong to site' });
      return json(200, { site: name, deployId: d.id, state: d.state, published: site.published_deploy && site.published_deploy.id === d.id });
    }

    if (body.action === 'restore') {
      const d = await (await api(token, `/deploys/${encodeURIComponent(body.deployId)}`)).json();
      if (d.site_id !== site.id) return json(400, { error: 'deploy does not belong to site' });
      await api(token, `/sites/${site.id}/deploys/${d.id}/restore`, { method: 'POST' });
      return json(200, { site: name, restored: d.id });
    }

    if (body.action !== 'apply') return json(400, { error: 'unknown action' });

    const previousDeployId = site.published_deploy ? site.published_deploy.id : null;
    if (!previousDeployId) return json(409, { error: 'no published deploy; nothing changed' });
    const files = await (await api(token, `/sites/${site.id}/files`)).json();
    const target = files.find((f) => f.path === '/index.html');
    if (!target) return json(409, { error: 'no /index.html', paths: files.slice(0, 10).map((f) => f.path) });

    // Read the exact published file from this deploy's own URL, and confirm it is byte-identical
    // to the file recorded in the deploy (SHA1). Stop without changing anything if it is not.
    const permalink = `https://${previousDeployId}--${site.name}.netlify.app/index.html`;
    const res = await fetch(permalink, { redirect: 'follow' });
    if (!res.ok) return json(502, { error: `could not read published file: ${res.status}` });
    let buf = Buffer.from(await res.arrayBuffer());
    let gotSha = crypto.createHash('sha1').update(buf).digest('hex');
    if (gotSha !== target.sha) {
      const stripped = Buffer.from(buf.toString('utf8').replace(RUM_RE, ''), 'utf8');
      const strippedSha = crypto.createHash('sha1').update(stripped).digest('hex');
      if (strippedSha === target.sha) { buf = stripped; gotSha = strippedSha; }
    }
    if (gotSha !== target.sha) return json(409, { error: 'published file does not match the deployed file (sha mismatch); nothing changed', expected: target.sha, got: gotSha, bytes: buf.length });
    const raw = buf.toString('utf8');
    if (raw.length < 500 || !/<html[\s>]/i.test(raw)) return json(409, { error: 'file does not look like an HTML document; nothing changed', bytes: raw.length });
    const patched = applyPatch(raw, name);
    if (patched === raw) return json(200, { site: name, changed: false, previousDeployId });
    if (body.dryRun) return json(200, { site: name, dryRun: true, previousDeployId, beforeBytes: raw.length, afterBytes: patched.length, sha: target.sha });

    const sha = crypto.createHash('sha1').update(patched, 'utf8').digest('hex');
    const map = {};
    files.forEach((f) => { map[f.path] = f.sha; });
    map['/index.html'] = sha;

    const deploy = await (await api(token, `/sites/${site.id}/deploys`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ files: map, title: 'mobile-patch v1' })
    })).json();

    if ((deploy.required || []).includes(sha)) {
      await api(token, `/deploys/${deploy.id}/files/index.html`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/octet-stream' },
        body: Buffer.from(patched, 'utf8')
      });
    }
    return json(200, { site: name, changed: true, previousDeployId, newDeployId: deploy.id, beforeBytes: raw.length, afterBytes: patched.length });
  } catch (error) {
    return json(500, { error: error.message });
  }
};
