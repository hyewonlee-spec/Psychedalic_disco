import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getEnv, plainText, queryDatabase } from './_notion';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method !== 'GET') return res.status(405).json({ ok: false, error: 'Method not allowed' });

    const databaseId = getEnv('NOTION_KEY_TERMS_DATABASE_ID');
    const pages = await queryDatabase(databaseId);

    const terms = pages.map((page: any) => {
      const p = page.properties || {};
      return {
        pageId: page.id,
        chapter: plainText(p.Chapter),
        chapterTitle: plainText(p.Title),
        term: plainText(p.Term) || plainText(p.Name),
        definition: plainText(p['Definition / Exam Meaning']) || plainText(p.Definition),
        trap: plainText(p['Common Trap']) || plainText(p.Trap),
        confidence: plainText(p.Confidence) || 'New',
        nextReview: plainText(p['Next Review']),
        status: plainText(p.Status),
      };
    });

    return res.status(200).json({ ok: true, count: terms.length, terms });
  } catch (error: any) {
    return res.status(500).json({ ok: false, error: error.message || 'Failed to load terms' });
  }
}
