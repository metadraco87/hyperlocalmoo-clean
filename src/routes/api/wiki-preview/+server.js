import { json } from '@sveltejs/kit';

export async function GET({ url }) {
  const title = url.searchParams.get('title');
  
  if (!title) {
    return json({ error: 'Title parameter is required' }, { status: 400 });
  }

  try {
    const wikiApiUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`;
    
    const response = await fetch(wikiApiUrl, {
      headers: {
        'User-Agent': 'HyperLocalMoo/1.0 (contact@hyperlocalmoo.com)'
      }
    });

    if (!response.ok) {
      return json({ error: 'Failed to fetch from Wikipedia' }, { status: response.status });
    }

    const data = await response.json();
    
    // Transform the response to match the expected format
    const result = {
      query: {
        pages: {
          [data.pageid || '1']: {
            title: data.title,
            extract: data.extract,
            thumbnail: data.thumbnail?.source,
            pageid: data.pageid
          }
        }
      }
    };

    return json(result);
    
  } catch (error) {
    console.error('Wikipedia API error:', error);
    return json({ error: 'Internal server error' }, { status: 500 });
  }
}
