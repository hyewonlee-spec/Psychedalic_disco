import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getEnv, plainText, queryDatabase } from './_notion';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method !== 'GET') return res.status(405).json({ ok: false, error: 'Method not allowed' });

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

    return res.status(200).json({ ok: true, count: questions.length, questions });
  } catch (error: any) {
    return res.status(500).json({ ok: false, error: error.message || 'Failed to load MCQs' });
  }
}
