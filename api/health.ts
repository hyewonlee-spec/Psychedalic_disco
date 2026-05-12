const NOTION_API_BASE = 'https://api.notion.com/v1';

type JsonRecord = Record<string, any>;

type DatabaseCheck = {
  ok: boolean;
  label: string;
  databaseIdPreview?: string;
  properties?: string[];
  error?: string;
  hint?: string;
};

function sendJson(res: any, data: JsonRecord, status = 200) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  return res.status(status).json(data);
}

function previewId(id?: string) {
  if (!id) return '';
  return `${id.slice(0, 6)}...${id.slice(-6)}`;
}

function notionHeaders() {
  const token = process.env.NOTION_API_KEY || '';
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
    Accept: 'application/json',
    'Notion-Version': process.env.NOTION_VERSION || '2022-06-28',
  };
}

async function safeNotionRequest(path: string, options: RequestInit = {}) {
  const token = process.env.NOTION_API_KEY;
  if (!token) {
    return { ok: false, status: 0, data: null, error: 'Missing NOTION_API_KEY.' };
  }

  try {
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
      return {
        ok: false,
        status: response.status,
        data: null,
        error: `Notion returned non-JSON text: ${text.slice(0, 300)}`,
      };
    }

    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        data,
        error: data?.message || response.statusText || 'Notion API request failed.',
      };
    }

    return { ok: true, status: response.status, data };
  } catch (error: any) {
    return {
      ok: false,
      status: 0,
      data: null,
      error: error?.message || 'Fetch to Notion failed.',
    };
  }
}

async function checkDatabase(databaseId: string | undefined, label: string): Promise<DatabaseCheck> {
  if (!databaseId) {
    return {
      ok: false,
      label,
      error: `Missing ${label}.`,
      hint: 'Add this environment variable in Vercel, then redeploy.',
    };
  }

  const result = await safeNotionRequest(`/databases/${databaseId}`, { method: 'GET' });
  if (!result.ok) {
    const status = result.status;
    let hint = 'Check the database ID and confirm the database is shared with your Notion integration.';
    if (status === 401) hint = 'The Notion API key is missing, invalid, or from the wrong integration.';
    if (status === 404) hint = 'The database ID may be wrong, or the database has not been shared with the integration.';

    return {
      ok: false,
      label,
      databaseIdPreview: previewId(databaseId),
      error: `${status || 'Network'}: ${result.error}`,
      hint,
    };
  }

  return {
    ok: true,
    label,
    databaseIdPreview: previewId(databaseId),
    properties: Object.keys(result.data?.properties || {}),
  };
}

export default async function handler(req: any, res: any) {
  try {
    const hasApiKey = Boolean(process.env.NOTION_API_KEY);
    const hasKeyTermsDatabaseId = Boolean(process.env.NOTION_KEY_TERMS_DATABASE_ID);
    const hasMcqDatabaseId = Boolean(process.env.NOTION_MCQ_DATABASE_ID);

    const [terms, mcqs] = await Promise.all([
      checkDatabase(process.env.NOTION_KEY_TERMS_DATABASE_ID, 'NOTION_KEY_TERMS_DATABASE_ID'),
      checkDatabase(process.env.NOTION_MCQ_DATABASE_ID, 'NOTION_MCQ_DATABASE_ID'),
    ]);

    const ok = hasApiKey && hasKeyTermsDatabaseId && hasMcqDatabaseId && terms.ok && mcqs.ok;

    return sendJson(res, {
      ok,
      message: ok ? 'Notion connection looks healthy.' : 'Notion connection needs attention. This endpoint is responding, so the serverless function itself is no longer crashing.',
      environment: {
        hasNotionApiKey: hasApiKey,
        notionVersion: process.env.NOTION_VERSION || '2022-06-28',
        hasKeyTermsDatabaseId,
        hasMcqDatabaseId,
      },
      databases: { terms, mcqs },
    });
  } catch (error: any) {
    return sendJson(res, {
      ok: false,
      message: 'Health endpoint caught an unexpected error instead of crashing.',
      error: error?.message || String(error),
    });
  }
}
