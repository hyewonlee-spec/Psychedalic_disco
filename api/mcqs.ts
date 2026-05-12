const NOTION_API_BASE = 'https://api.notion.com/v1';

type JsonRecord = Record<string, any>;

function sendJson(res: any, data: JsonRecord, status = 200) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  return res.status(status).json(data);
}

function getEnv(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing environment variable: ${name}`);
  return value;
}

function notionHeaders() {
  return {
    Authorization: `Bearer ${getEnv('NOTION_API_KEY')}`,
    'Content-Type': 'application/json',
    Accept: 'application/json',
    'Notion-Version': process.env.NOTION_VERSION || '2022-06-28',
  };
}

async function notionRequest(path: string, options: RequestInit = {}) {
  const response = await fetch(`${NOTION_API_BASE}${path}`, {
    ...options,
    headers: {
      ...notionHeaders(),
      ...(options.headers || {}),
    },
  });

  const text = await response.text();
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    throw new Error(`Notion returned non-JSON text: ${text.slice(0, 300)}`);
  }

  if (!response.ok) {
    throw new Error(`${response.status}: ${data?.message || response.statusText || 'Notion API request failed'}`);
  }

  return data;
}

async function queryDatabase(databaseId: string) {
  const results: any[] = [];
  let hasMore = true;
  let startCursor: string | undefined;

  while (hasMore) {
    const body: Record<string, any> = { page_size: 100 };
    if (startCursor) body.start_cursor = startCursor;

    const data = await notionRequest(`/databases/${databaseId}/query`, {
      method: 'POST',
      body: JSON.stringify(body),
    });

    results.push(...(data.results || []));
    hasMore = Boolean(data.has_more);
    startCursor = data.next_cursor || undefined;
  }

  return results;
}

function plainText(prop: any): string {
  if (!prop) return '';
  if (prop.type === 'title') return (prop.title || []).map((r: any) => r.plain_text || '').join('');
  if (prop.type === 'rich_text') return (prop.rich_text || []).map((r: any) => r.plain_text || '').join('');
  if (prop.type === 'select') return prop.select?.name || '';
  if (prop.type === 'status') return prop.status?.name || '';
  if (prop.type === 'multi_select') return (prop.multi_select || []).map((o: any) => o.name).join(', ');
  if (prop.type === 'number') return String(prop.number ?? '');
  if (prop.type === 'date') return prop.date?.start || '';
  if (prop.type === 'checkbox') return prop.checkbox ? 'true' : 'false';
  if (prop.type === 'url') return prop.url || '';
  if (prop.type === 'email') return prop.email || '';
  if (prop.type === 'phone_number') return prop.phone_number || '';
  return '';
}

export default async function handler(req: any, res: any) {
  try {
    if (req.method !== 'GET') return sendJson(res, { ok: false, error: 'Method not allowed' }, 405);

    const databaseId = getEnv('NOTION_MCQ_DATABASE_ID');
    const pages = await queryDatabase(databaseId);

    const questions = pages.map((page: any) => {
      const p = page.properties || {};
      return {
        pageId: page.id,
        chapter: plainText(p.Chapter),
        chapterTitle: plainText(p.Title),
        question: plainText(p.Question) || plainText(p.Name),
        optionA: plainText(p['Option A']),
        optionB: plainText(p['Option B']),
        optionC: plainText(p['Option C']),
        optionD: plainText(p['Option D']),
        correctAnswer: plainText(p['Correct Answer']),
        explanation: plainText(p.Explanation),
        concept: plainText(p.Concept),
        difficulty: plainText(p.Difficulty),
        status: plainText(p.Status) || 'Unattempted',
        myAnswer: plainText(p['My Answer']),
        mistakeType: plainText(p['Mistake Type']),
        nextReview: plainText(p['Next Review']),
        confidence: plainText(p.Confidence),
      };
    });

    return sendJson(res, { ok: true, count: questions.length, questions });
  } catch (error: any) {
    return sendJson(res, { ok: false, error: error?.message || 'Failed to load MCQs' });
  }
}
