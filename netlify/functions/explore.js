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
  "imageQuery": "short specific search query for this site e.g. Borobudur temple Indonesia or Pyramids Giza Egypt"
}`;

    // Step 1: Get site data from Groq
    const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        max_tokens: 900,
        temperature: 0.7,
        messages: [
          {
            role: 'system',
            content: 'You are a historical sites expert. Always respond with valid raw JSON only, no markdown, no explanation.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
      }),
    });

    if (!groqResponse.ok) {
      const err = await groqResponse.json().catch(() => ({}));
      return {
        statusCode: groqResponse.status,
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ error: err?.error?.message || 'Groq API error' }),
      };
    }

    const groqData = await groqResponse.json();
    let raw = groqData.choices?.[0]?.message?.content?.trim() || '';
    raw = raw.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/, '').trim();
    const siteData = JSON.parse(raw);

    // Step 2: Fetch image from Unsplash
    let imageUrl = '';
    try {
      const query = encodeURIComponent(siteData.imageQuery || siteData.siteName);
      const unsplashRes = await fetch(
        `https://api.unsplash.com/search/photos?query=${query}&per_page=1&orientation=landscape`,
        {
          headers: {
            'Authorization': `Client-ID ${process.env.UNSPLASH_ACCESS_KEY}`,
          },
        }
      );
      if (unsplashRes.ok) {
        const unsplashData = await unsplashRes.json();
        imageUrl = unsplashData.results?.[0]?.urls?.regular || '';
      }
    } catch (_) {
      imageUrl = '';
    }

    delete siteData.imageQuery;
    siteData.imageUrl = imageUrl;

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify(siteData),
    };

  } catch (err) {
    return {
      statusCode: 500,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: err.message || 'Internal error' }),
    };
  }
};
