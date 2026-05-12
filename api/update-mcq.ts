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

async function getDatabaseSchema(databaseId: string) {
  const data = await notionRequest(`/databases/${databaseId}`, { method: 'GET' });
  return data.properties || {};
}

function propertyValueForSchema(schemaEntry: any, value: string | null | undefined) {
  if (!schemaEntry) return undefined;
  const type = schemaEntry.type;

  if (type === 'date') return value ? { date: { start: value } } : { date: null };
  if (value === null || value === undefined) return undefined;

  const textValue = String(value);
  if (type === 'select') return { select: { name: textValue } };
  if (type === 'status') return { status: { name: textValue } };
  if (type === 'rich_text') return { rich_text: [{ text: { content: textValue.slice(0, 1900) } }] };
  if (type === 'title') return { title: [{ text: { content: textValue.slice(0, 1900) } }] };
  if (type === 'checkbox') return { checkbox: textValue === 'true' || textValue === '1' || textValue.toLowerCase() === 'yes' };
  if (type === 'number') {
    const numberValue = Number(textValue);
    return Number.isFinite(numberValue) ? { number: numberValue } : undefined;
  }
  if (type === 'url') return { url: textValue };
  if (type === 'email') return { email: textValue };
  if (type === 'phone_number') return { phone_number: textValue };
  return undefined;
}

function parseBody(req: any) {
  if (!req.body) return {};
  if (typeof req.body === 'string') {
    try { return JSON.parse(req.body); } catch { return {}; }
  }
  return req.body;
}

export default async function handler(req: any, res: any) {
  try {
    if (req.method !== 'PATCH' && req.method !== 'POST') return sendJson(res, { ok: false, error: 'Method not allowed' }, 405);

    const { pageId, status, myAnswer, mistakeType, nextReview, confidence } = parseBody(req);
    if (!pageId) return sendJson(res, { ok: false, error: 'Missing pageId' }, 400);

    const databaseId = getEnv('NOTION_MCQ_DATABASE_ID');
    const schema = await getDatabaseSchema(databaseId);
    const rawValues: Record<string, string | null | undefined> = {
      Status: status,
      'My Answer': myAnswer,
      'Mistake Type': mistakeType,
      'Next Review': nextReview,
      Confidence: confidence,
    };

    const properties: Record<string, any> = {};
    for (const [propertyName, value] of Object.entries(rawValues)) {
      const propertyValue = propertyValueForSchema(schema[propertyName], value);
      if (propertyValue !== undefined) properties[propertyName] = propertyValue;
    }

    if (Object.keys(properties).length > 0) {
      await notionRequest(`/pages/${pageId}`, {
        method: 'PATCH',
        body: JSON.stringify({ properties }),
      });
    }

    return sendJson(res, { ok: true, updatedProperties: Object.keys(properties) });
  } catch (error: any) {
    return sendJson(res, { ok: false, error: error?.message || 'Failed to update MCQ' });
  }
}
