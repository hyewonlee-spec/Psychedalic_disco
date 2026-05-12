export type Confidence = 'New' | 'Low' | 'Medium' | 'High' | 'Mastered' | string;
export type McqStatus = 'Unattempted' | 'Correct' | 'Incorrect' | 'Retry' | 'Mastered' | string;

export interface TermCard {
  pageId: string;
  chapter: string;
  chapterTitle: string;
  term: string;
  definition: string;
  trap: string;
  confidence: Confidence;
  nextReview?: string;
  status?: string;
}

export interface McqQuestion {
  pageId: string;
  chapter: string;
  chapterTitle: string;
  question: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  correctAnswer: string;
  explanation: string;
  concept: string;
  difficulty: string;
  status: McqStatus;
  myAnswer?: string;
  mistakeType?: string;
  nextReview?: string;
  confidence?: string;
}
