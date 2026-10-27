// Returns the public HTML of one of this account's own Netlify sites (read-only).
// Used for the mobile-display survey. Only site names in the account's own site list are accepted.
const DASHBOARD_SITE_NAME = 'netlify-project-list-dashboard';
let cachedNames = null;
let cachedAt = 0;

async function getOwnSiteNames(token) {
  if (cachedNames && Date.now() - cachedAt < 5 * 60 * 1000) return cachedNames;
  let names = [];
  let page = 1;
  let lastPageSize = 0;
  do {
    const res = await fetch(`https://api.netlify.com/api/v1/sites?per_page=100&page=${page}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) throw new Error(`Netlify API error: ${res.status}`);
    const batch = await res.json();
    names = names.concat(batch.map((s) => s.name));
    lastPageSize = batch.length;
    page++;
  } while (lastPageSize === 100);
  cachedNames = new Set(names.filter((n) => n !== DASHBOARD_SITE_NAME));
  cachedAt = Date.now();
  return cachedNames;
}

function json(statusCode, obj) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    body: JSON.stringify(obj)
  };
}

exports.handler = async function (event) {
  const token = process.env.NETLIFY_API_TOKEN;
  if (!token) return json(500, { error: 'NETLIFY_API_TOKEN is not configured' });

  const site = event.queryStringParameters && event.queryStringParameters.site;
  if (!site || !/^[a-z0-9-]{1,63}$/.test(site)) return json(400, { error: 'invalid site' });

  try {
    const names = await getOwnSiteNames(token);
    if (!names.has(site)) return json(404, { error: 'unknown site' });

    const res = await fetch(`https://${site}.netlify.app/`, { redirect: 'follow' });
    if (!res.ok) return json(502, { error: `fetch failed: ${res.status}` });
    const html = await res.text();
    return json(200, { site, html });
  } catch (error) {
    return json(500, { error: error.message });
  }
};
