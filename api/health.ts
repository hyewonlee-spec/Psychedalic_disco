import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getDatabaseSchema } from './_notion';

async function checkDatabase(databaseId: string | undefined, label: string) {
  if (!databaseId) {
    return {
      ok: false,
      label,
      error: `Missing ${label} database ID environment variable.`,
    };
  }

  try {
    const schema = await getDatabaseSchema(databaseId);
    return {
      ok: true,
      label,
      databaseIdPreview: `${databaseId.slice(0, 6)}...${databaseId.slice(-6)}`,
      properties: Object.keys(schema),
    };
  } catch (error: any) {
    return {
      ok: false,
      label,
      databaseIdPreview: `${databaseId.slice(0, 6)}...${databaseId.slice(-6)}`,
      error: error.message || 'Could not access database.',
    };
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  try {
    const hasApiKey = Boolean(process.env.NOTION_API_KEY);
    const notionVersion = process.env.NOTION_VERSION || '2022-06-28';

    const [terms, mcqs] = await Promise.all([
      checkDatabase(process.env.NOTION_KEY_TERMS_DATABASE_ID, 'NOTION_KEY_TERMS_DATABASE_ID'),
      checkDatabase(process.env.NOTION_MCQ_DATABASE_ID, 'NOTION_MCQ_DATABASE_ID'),
    ]);

    const ok = hasApiKey && terms.ok && mcqs.ok;

    return res.status(ok ? 200 : 500).json({
      ok,
      message: ok ? 'Notion connection looks healthy.' : 'Notion connection needs attention.',
      environment: {
        hasNotionApiKey: hasApiKey,
        notionVersion,
        hasKeyTermsDatabaseId: Boolean(process.env.NOTION_KEY_TERMS_DATABASE_ID),
        hasMcqDatabaseId: Boolean(process.env.NOTION_MCQ_DATABASE_ID),
      },
      databases: {
        terms,
        mcqs,
      },
    });
  } catch (error: any) {
    return res.status(500).json({
      ok: false,
      error: error.message || 'Health check failed.',
    });
  }
}
