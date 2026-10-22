// Reads NETLIFY_API_TOKEN from the site's environment variables (never hardcoded).
const DASHBOARD_SITE_NAME = 'netlify-project-list-dashboard';

exports.handler = async function () {
  const token = process.env.NETLIFY_API_TOKEN;

  if (!token) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'NETLIFY_API_TOKEN is not configured' })
    };
  }

  try {
    let allSites = [];
    let page = 1;
    let lastPageSize = 0;

    do {
      const response = await fetch(`https://api.netlify.com/api/v1/sites?per_page=100&page=${page}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!response.ok) {
        return {
          statusCode: response.status,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ error: `Netlify API error: ${response.status}` })
        };
      }

      const batch = await response.json();
      allSites = allSites.concat(batch);
      lastPageSize = batch.length;
      page++;
    } while (lastPageSize === 100);

    const sites = allSites
      .filter((site) => site.name !== DASHBOARD_SITE_NAME)
      .map((site) => ({
        name: site.name,
        url: site.url,
        ssl_url: site.ssl_url,
        created_at: site.created_at,
        updated_at: site.updated_at,
        published_at: site.published_at
      }));

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sites })
    };
  } catch (error) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: error.message })
    };
  }
};
