export type NotionProperty = Record<string, any>;

const NOTION_API_BASE = 'https://api.notion.com/v1';

export function getEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing environment variable: ${name}`);
  }
  return value;
}

export function notionHeaders() {
  return {
    Authorization: `Bearer ${getEnv('NOTION_API_KEY')}`,
    'Content-Type': 'application/json',
    Accept: 'application/json',
    'Notion-Version': process.env.NOTION_VERSION || '2022-06-28',
  };
}

function parseNotionResponse(text: string) {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`Notion returned a non-JSON response: ${text.slice(0, 500)}`);
  }
}

export async function notionRequest(path: string, options: RequestInit = {}) {
  const response = await fetch(`${NOTION_API_BASE}${path}`, {
    ...options,
    headers: {
      ...notionHeaders(),
      ...(options.headers || {}),
    },
  });

  const text = await response.text();
  const data = parseNotionResponse(text);

  if (!response.ok) {
    const message = data?.message || response.statusText || 'Notion API request failed';
    throw new Error(`${response.status}: ${message}`);
  }

  return data;
}

export async function queryDatabase(databaseId: string) {
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

export async function getDatabaseSchema(databaseId: string) {
  const data = await notionRequest(`/databases/${databaseId}`, { method: 'GET' });
  return data.properties || {};
}

export function plainText(prop: NotionProperty | undefined): string {
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

export function propertyValueForSchema(schemaEntry: any, value: string | null | undefined) {
  if (!schemaEntry) return undefined;
  const type = schemaEntry.type;

  if (type === 'date') {
    return value ? { date: { start: value } } : { date: null };
  }

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

export async function updateSimplePageProperties(pageId: string, databaseId: string, rawValues: Record<string, string | null | undefined>) {
  const schema = await getDatabaseSchema(databaseId);
  const safeProperties: Record<string, any> = {};

  for (const [propertyName, value] of Object.entries(rawValues)) {
    if (!schema[propertyName]) continue;
    const propertyValue = propertyValueForSchema(schema[propertyName], value);
    if (propertyValue !== undefined) safeProperties[propertyName] = propertyValue;
  }

  if (Object.keys(safeProperties).length === 0) {
    return { ok: true, skipped: true, reason: 'No matching Notion properties found to update.' };
  }

  return notionRequest(`/pages/${pageId}`, {
    method: 'PATCH',
    body: JSON.stringify({ properties: safeProperties }),
  });
}
