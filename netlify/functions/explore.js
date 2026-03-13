exports.handler = async function (event) {
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
      body: '',
    };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const { name, country } = JSON.parse(event.body || '{}');

    if (!name || !country) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Missing name or country' }),
      };
    }

    const prompt = `You are a historical sites expert. For the country/region "${country}", select ONE famous historical site.
Respond ONLY with a raw JSON object — no markdown fences, no explanation. Use this exact shape:

{
  "userName": "${name}",
  "siteName": "Full name of the site",
  "location": "City / Region, Country",
  "description": "2-3 engaging sentences about the site and its historical significance.",
  "builtYear": "circa XXXX or Nth century BCE/CE",
  "civilization": "Civilization or empire that built it",
  "visitorsPerYear": "e.g. 14 million",
  "isUnesco": true,
  "unescoYear": "1979",
  "unescoCriteria": "One clear sentence on its outstanding universal value.",
  "imageUrl": "https://upload.wikimedia.org/wikipedia/commons/thumb/... (a real direct Wikimedia Commons .jpg URL)"
}`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 900,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      return {
        statusCode: response.status,
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ error: err?.error?.message || 'Anthropic API error' }),
      };
    }

    const data = await response.json();
    let raw = data.content?.[0]?.text?.trim() || '';
    raw = raw.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/, '').trim();

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: raw,
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: err.message || 'Internal error' }),
    };
  }
};
