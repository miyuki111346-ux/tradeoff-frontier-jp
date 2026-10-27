exports.handler = async function (event) {
  const targetUrl = event.queryStringParameters && event.queryStringParameters.url;

  if (!targetUrl) {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Missing url parameter' })
    };
  }

  // Only fetch pages hosted on netlify.app (prevents use as a general-purpose fetcher).
  let parsed;
  try {
    parsed = new URL(targetUrl);
  } catch (e) {
    parsed = null;
  }
  if (!parsed || parsed.protocol !== 'https:' || !/^[a-z0-9-]+\.netlify\.app$/.test(parsed.hostname)) {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Only https://*.netlify.app URLs are allowed' })
    };
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    const response = await fetch(targetUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; NetlifyDashboardBot/1.0)'
      }
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: null })
      };
    }

    const html = await response.text();
    const match = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    const title = match ? match[1].trim() : null;

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title })
    };
  } catch (error) {
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: null, error: error.message })
    };
  }
};
