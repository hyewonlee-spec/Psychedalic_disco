import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getEnv, updateSimplePageProperties } from './_notion';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method !== 'PATCH' && req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed' });

    const { pageId, status, myAnswer, mistakeType, nextReview, confidence } = req.body || {};
    if (!pageId) return res.status(400).json({ ok: false, error: 'Missing pageId' });

    const databaseId = getEnv('NOTION_MCQ_DATABASE_ID');
    await updateSimplePageProperties(pageId, databaseId, {
      Status: status,
      'My Answer': myAnswer,
      'Mistake Type': mistakeType,
      'Next Review': nextReview,
      Confidence: confidence,
    });

    return res.status(200).json({ ok: true });
  } catch (error: any) {
    return res.status(500).json({ ok: false, error: error.message || 'Failed to update MCQ' });
  }
}
