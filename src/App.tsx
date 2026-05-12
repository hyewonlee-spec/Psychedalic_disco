import { useEffect, useMemo, useState } from 'react';
import type { McqQuestion, TermCard } from './types';
import { addDays, isDue } from './lib/date';

type Mode = 'dashboard' | 'flashcards' | 'mcq' | 'weak';

const mistakeTypes = [
  'Confused concept',
  'Forgot definition',
  'Fell for trap answer',
  'Careless reading',
  'Did not understand example',
  'Guessed',
];

function normaliseChapter(chapter: string) {
  const match = chapter.match(/\d+/);
  return match ? Number(match[0]) : 999;
}

function createReadableApiError(url: string, status: number, body: string) {
  const cleanBody = body.trim();

  if (!cleanBody) {
    return `${url} returned HTTP ${status} with no response body.`;
  }

  if (cleanBody.startsWith('<!DOCTYPE') || cleanBody.startsWith('<html')) {
    return `${url} returned an HTML error page instead of JSON. This usually means the Vercel API function crashed before it could respond. Check the Vercel Function Logs and open /api/health.`;
  }

  if (cleanBody.startsWith('A server error')) {
    return `${url} returned a Vercel server error instead of JSON. This usually means the API function failed before the app could receive a proper error. Open /api/health and check Vercel Function Logs.`;
  }

  return `${url} returned HTTP ${status}: ${cleanBody.slice(0, 500)}`;
}

async function jsonFetch<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(options?.headers || {}),
    },
  });

  const text = await response.text();
  let data: any = null;

  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    throw new Error(createReadableApiError(url, response.status, text));
  }

  if (!response.ok || data?.ok === false) {
    throw new Error(data?.error || createReadableApiError(url, response.status, text));
  }

  return data as T;
}

export default function App() {
  const [mode, setMode] = useState<Mode>('dashboard');
  const [terms, setTerms] = useState<TermCard[]>([]);
  const [questions, setQuestions] = useState<McqQuestion[]>([]);
  const [chapter, setChapter] = useState('All');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [termIndex, setTermIndex] = useState(0);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [showDefinition, setShowDefinition] = useState(false);
  const [selectedAnswer, setSelectedAnswer] = useState('');
  const [mistakeType, setMistakeType] = useState('Confused concept');
  const [revealed, setRevealed] = useState(false);
  const [syncing, setSyncing] = useState(false);

  async function loadData() {
    setLoading(true);
    setError('');
    try {
      const [termData, mcqData] = await Promise.all([
        jsonFetch<{ ok: boolean; terms: TermCard[] }>('/api/terms'),
        jsonFetch<{ ok: boolean; questions: McqQuestion[] }>('/api/mcqs'),
      ]);
      setTerms(termData.terms.sort((a, b) => normaliseChapter(a.chapter) - normaliseChapter(b.chapter) || a.term.localeCompare(b.term)));
      setQuestions(mcqData.questions.sort((a, b) => normaliseChapter(a.chapter) - normaliseChapter(b.chapter)));
    } catch (err: any) {
      setError(err.message || 'Could not connect to Notion. Check /api/health, environment variables, database IDs, and Notion database sharing.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  const chapters = useMemo(() => {
    const list = [...terms.map((t) => t.chapter), ...questions.map((q) => q.chapter)].filter(Boolean);
    return ['All', ...Array.from(new Set(list)).sort((a, b) => normaliseChapter(a) - normaliseChapter(b))];
  }, [terms, questions]);

  const filteredTerms = useMemo(() => (chapter === 'All' ? terms : terms.filter((t) => t.chapter === chapter)), [chapter, terms]);
  const filteredQuestions = useMemo(() => (chapter === 'All' ? questions : questions.filter((q) => q.chapter === chapter)), [chapter, questions]);
  const weakTerms = useMemo(() => terms.filter((t) => ['New', 'Low', 'Weak'].includes(t.confidence) || t.status === 'Weak'), [terms]);
  const dueTerms = useMemo(() => terms.filter((t) => isDue(t.nextReview) && t.confidence !== 'Mastered'), [terms]);
  const dueQuestions = useMemo(() => questions.filter((q) => isDue(q.nextReview) && q.status !== 'Mastered'), [questions]);
  const incorrectQuestions = useMemo(() => questions.filter((q) => ['Incorrect', 'Retry'].includes(q.status)), [questions]);
  const unattemptedQuestions = useMemo(() => filteredQuestions.filter((q) => !q.status || q.status === 'Unattempted'), [filteredQuestions]);

  const currentTerm = filteredTerms[termIndex % Math.max(filteredTerms.length, 1)];
  const currentQuestion = filteredQuestions[questionIndex % Math.max(filteredQuestions.length, 1)];

  const stats = useMemo(() => {
    const masteredTerms = terms.filter((t) => t.confidence === 'Mastered').length;
    const correct = questions.filter((q) => ['Correct', 'Mastered'].includes(q.status)).length;
    return {
      totalTerms: terms.length,
      masteredTerms,
      weakTerms: weakTerms.length,
      totalQuestions: questions.length,
      correct,
      incorrect: incorrectQuestions.length,
      dueToday: dueTerms.length + dueQuestions.length,
    };
  }, [terms, questions, weakTerms, dueTerms, dueQuestions, incorrectQuestions]);

  async function updateTerm(confidence: string, daysUntilReview: number | null) {
    if (!currentTerm) return;
    const nextReview = daysUntilReview === null ? null : addDays(daysUntilReview);
    setSyncing(true);
    setTerms((prev) => prev.map((t) => (t.pageId === currentTerm.pageId ? { ...t, confidence, nextReview: nextReview || '' } : t)));
    try {
      await jsonFetch('/api/update-term', {
        method: 'PATCH',
        body: JSON.stringify({ pageId: currentTerm.pageId, confidence, status: confidence === 'Mastered' ? 'Mastered' : 'Learning', nextReview }),
      });
      setShowDefinition(false);
      setTermIndex((i) => i + 1);
    } catch (err: any) {
      setError(err.message || 'Failed to update term in Notion.');
    } finally {
      setSyncing(false);
    }
  }

  async function updateQuestion(status: string) {
    if (!currentQuestion) return;
    const isCorrect = selectedAnswer === currentQuestion.correctAnswer;
    const finalStatus = status || (isCorrect ? 'Correct' : 'Incorrect');
    const nextReview = finalStatus === 'Mastered' ? null : finalStatus === 'Correct' ? addDays(3) : addDays(1);
    const confidence = finalStatus === 'Correct' || finalStatus === 'Mastered' ? 'Medium' : 'Low';

    setSyncing(true);
    setQuestions((prev) =>
      prev.map((q) =>
        q.pageId === currentQuestion.pageId
          ? { ...q, status: finalStatus, myAnswer: selectedAnswer, mistakeType: isCorrect ? '' : mistakeType, nextReview: nextReview || '', confidence }
          : q,
      ),
    );
    try {
      await jsonFetch('/api/update-mcq', {
        method: 'PATCH',
        body: JSON.stringify({
          pageId: currentQuestion.pageId,
          status: finalStatus,
          myAnswer: selectedAnswer,
          mistakeType: isCorrect ? '' : mistakeType,
          nextReview,
          confidence,
        }),
      });
      setSelectedAnswer('');
      setMistakeType('Confused concept');
      setRevealed(false);
      setQuestionIndex((i) => i + 1);
    } catch (err: any) {
      setError(err.message || 'Failed to update MCQ in Notion.');
    } finally {
      setSyncing(false);
    }
  }

  return (
    <main className="app-shell">
      <section className="hero-card">
        <div>
          <p className="eyebrow">Psychology Final Exam</p>
          <h1>Notion-connected Flashcards + MCQ App</h1>
          <p className="hero-copy">Pulls your study terms and questions from Notion, then writes progress back to Notion.</p>
        </div>
        <div className="hero-actions">
          <button className="button button-secondary" onClick={loadData} disabled={loading || syncing}>Refresh Notion</button>
          <select
            value={chapter}
            onChange={(event) => {
              setChapter(event.target.value);
              setTermIndex(0);
              setQuestionIndex(0);
              setShowDefinition(false);
              setSelectedAnswer('');
              setRevealed(false);
            }}
            className="select"
          >
            {chapters.map((item) => <option key={item}>{item}</option>)}
          </select>
        </div>
      </section>

      {error && (
        <div className="alert">
          <strong>Connection issue:</strong> {error}
          <p className="alert-help">After redeploying this patch, open <code>/api/health</code> on your site to see which Notion setting is failing.</p>
        </div>
      )}
      {loading ? <div className="card loading-card">Loading study data from Notion...</div> : null}

      <nav className="tab-bar" aria-label="Study modes">
        <button className={mode === 'dashboard' ? 'tab tab-active' : 'tab'} onClick={() => setMode('dashboard')}>Dashboard</button>
        <button className={mode === 'flashcards' ? 'tab tab-active' : 'tab'} onClick={() => setMode('flashcards')}>Flashcards</button>
        <button className={mode === 'mcq' ? 'tab tab-active' : 'tab'} onClick={() => setMode('mcq')}>MCQs</button>
        <button className={mode === 'weak' ? 'tab tab-active' : 'tab'} onClick={() => setMode('weak')}>Weak areas</button>
      </nav>

      {mode === 'dashboard' && (
        <section className="dashboard-grid">
          <Stat label="Terms" value={stats.totalTerms} detail={`${stats.masteredTerms} mastered`} />
          <Stat label="MCQs" value={stats.totalQuestions} detail={`${stats.correct} correct/mastered`} />
          <Stat label="Due today" value={stats.dueToday} detail="review queue" />
          <Stat label="Weak areas" value={stats.weakTerms + stats.incorrect} detail="terms + MCQs" />

          <div className="card wide-card">
            <h2>Today’s study queue</h2>
            <div className="split-list">
              <MiniList title="Terms due" items={dueTerms.slice(0, 6).map((t) => `${t.chapter}: ${t.term}`)} empty="No flashcards due today." />
              <MiniList title="MCQs due" items={dueQuestions.slice(0, 6).map((q) => `${q.chapter}: ${q.concept || q.question}`)} empty="No MCQs due today." />
            </div>
          </div>

          <div className="card wide-card">
            <h2>Recommended workflow</h2>
            <ol className="numbered-list">
              <li>Start with due items.</li>
              <li>Review weak terms.</li>
              <li>Do 5–15 MCQs without revealing the answer.</li>
              <li>Mark incorrect questions and retry tomorrow.</li>
            </ol>
          </div>
        </section>
      )}

      {mode === 'flashcards' && (
        <section className="card study-card">
          {currentTerm ? (
            <>
              <div className="study-header">
                <div>
                  <p className="eyebrow">{currentTerm.chapter}</p>
                  <h2>{currentTerm.term}</h2>
                </div>
                <span className="pill">{currentTerm.confidence || 'New'}</span>
              </div>
              <div className="answer-panel">
                {!showDefinition ? (
                  <p className="prompt">Define this term aloud before revealing the answer.</p>
                ) : (
                  <div className="stack">
                    <div>
                      <p className="label">Definition</p>
                      <p>{currentTerm.definition}</p>
                    </div>
                    <div>
                      <p className="label">MCQ trap</p>
                      <p>{currentTerm.trap || 'No trap entered.'}</p>
                    </div>
                  </div>
                )}
              </div>
              <div className="button-row">
                <button className="button" onClick={() => setShowDefinition((value) => !value)}>{showDefinition ? 'Hide answer' : 'Reveal answer'}</button>
                <button className="button button-danger" onClick={() => updateTerm('Low', 1)} disabled={syncing}>Still weak</button>
                <button className="button button-secondary" onClick={() => updateTerm('Medium', 3)} disabled={syncing}>Getting there</button>
                <button className="button button-success" onClick={() => updateTerm('Mastered', null)} disabled={syncing}>Mastered</button>
              </div>
            </>
          ) : <EmptyState title="No flashcards found" text="Check your Key Terms database or chapter filter." />}
        </section>
      )}

      {mode === 'mcq' && (
        <section className="card study-card">
          {currentQuestion ? (
            <>
              <div className="study-header">
                <div>
                  <p className="eyebrow">{currentQuestion.chapter} · {currentQuestion.concept || 'General'}</p>
                  <h2>{currentQuestion.question}</h2>
                </div>
                <span className="pill">{currentQuestion.status || 'Unattempted'}</span>
              </div>

              <div className="option-grid">
                {[
                  ['A', currentQuestion.optionA],
                  ['B', currentQuestion.optionB],
                  ['C', currentQuestion.optionC],
                  ['D', currentQuestion.optionD],
                ].map(([letter, text]) => (
                  <button
                    key={letter}
                    className={selectedAnswer === letter ? 'option option-selected' : 'option'}
                    onClick={() => setSelectedAnswer(letter)}
                  >
                    <strong>{letter}.</strong> {text}
                  </button>
                ))}
              </div>

              {revealed && (
                <div className={selectedAnswer === currentQuestion.correctAnswer ? 'feedback feedback-correct' : 'feedback feedback-incorrect'}>
                  <p><strong>Correct answer:</strong> {currentQuestion.correctAnswer}</p>
                  <p>{currentQuestion.explanation}</p>
                </div>
              )}

              {revealed && selectedAnswer !== currentQuestion.correctAnswer && (
                <label className="field-label">
                  Mistake type
                  <select value={mistakeType} onChange={(event) => setMistakeType(event.target.value)} className="select full-select">
                    {mistakeTypes.map((type) => <option key={type}>{type}</option>)}
                  </select>
                </label>
              )}

              <div className="button-row">
                <button className="button" onClick={() => setRevealed(true)} disabled={!selectedAnswer}>Check answer</button>
                <button className="button button-secondary" onClick={() => updateQuestion(selectedAnswer === currentQuestion.correctAnswer ? 'Correct' : 'Incorrect')} disabled={!revealed || syncing}>Save result</button>
                <button className="button button-success" onClick={() => updateQuestion('Mastered')} disabled={!revealed || syncing}>Mastered</button>
              </div>
            </>
          ) : <EmptyState title="No MCQs found" text="Check your MCQ database or chapter filter." />}
        </section>
      )}

      {mode === 'weak' && (
        <section className="weak-grid">
          <div className="card">
            <h2>Weak flashcards</h2>
            <ItemList items={weakTerms.map((t) => ({ title: t.term, meta: t.chapter, detail: t.trap || t.definition }))} />
          </div>
          <div className="card">
            <h2>Incorrect / retry MCQs</h2>
            <ItemList items={incorrectQuestions.map((q) => ({ title: q.question, meta: `${q.chapter} · ${q.concept}`, detail: `Answer: ${q.correctAnswer}. ${q.explanation}` }))} />
          </div>
          <div className="card">
            <h2>Fresh MCQs</h2>
            <ItemList items={unattemptedQuestions.slice(0, 8).map((q) => ({ title: q.question, meta: `${q.chapter} · ${q.concept}`, detail: 'Unattempted' }))} />
          </div>
        </section>
      )}
    </main>
  );
}

function Stat({ label, value, detail }: { label: string; value: number; detail: string }) {
  return (
    <div className="stat-card">
      <p>{label}</p>
      <strong>{value}</strong>
      <span>{detail}</span>
    </div>
  );
}

function MiniList({ title, items, empty }: { title: string; items: string[]; empty: string }) {
  return (
    <div>
      <h3>{title}</h3>
      {items.length ? (
        <ul className="compact-list">{items.map((item) => <li key={item}>{item}</li>)}</ul>
      ) : <p className="muted">{empty}</p>}
    </div>
  );
}

function ItemList({ items }: { items: { title: string; meta: string; detail: string }[] }) {
  if (!items.length) return <p className="muted">Nothing here yet.</p>;
  return (
    <div className="item-list">
      {items.map((item, index) => (
        <article key={`${item.title}-${index}`} className="list-item">
          <p className="eyebrow">{item.meta}</p>
          <h3>{item.title}</h3>
          <p>{item.detail}</p>
        </article>
      ))}
    </div>
  );
}

function EmptyState({ title, text }: { title: string; text: string }) {
  return (
    <div className="empty-state">
      <h2>{title}</h2>
      <p>{text}</p>
    </div>
  );
}
