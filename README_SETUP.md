# Psychology Notion Study App

This is a Vercel-ready React + Notion app for psychology exam study.

It pulls data from two Notion databases:

1. `Psychology - Key Terms`
2. `Psychology - MCQ Bank`

It supports:

- Dashboard summary
- Flashcards
- MCQ practice
- Chapter filtering
- Weak concept list
- Incorrect / retry MCQ list
- Progress updates written back to Notion

---

## 1. Notion database setup

Import these CSV files into Notion first:

- `Psychology_Key_Terms_Notion_Excel.csv`
- `Psychology_MCQ_Bank_Notion_Excel.csv`

Rename the imported databases:

- `Psychology - Key Terms`
- `Psychology - MCQ Bank`

---

## 2. Required Notion properties

### Key Terms database

The app reads these properties:

| Property name | Recommended type |
|---|---|
| Term | Title |
| Chapter | Select or Rich text |
| Title | Rich text |
| Definition / Exam Meaning | Rich text |
| Common Trap | Rich text |
| Confidence | Select |
| Next Review | Date |
| Status | Status or Select |

For `Confidence`, create these options:

- New
- Low
- Medium
- High
- Mastered

For `Status`, create these options:

- Learning
- Weak
- Reviewed
- Mastered

### MCQ Bank database

The app reads these properties:

| Property name | Recommended type |
|---|---|
| Question | Title |
| Chapter | Select or Rich text |
| Title | Rich text |
| Option A | Rich text |
| Option B | Rich text |
| Option C | Rich text |
| Option D | Rich text |
| Correct Answer | Select |
| Explanation | Rich text |
| Concept | Select or Rich text |
| Difficulty | Select |
| Status | Status or Select |
| My Answer | Select |
| Mistake Type | Select |
| Next Review | Date |
| Confidence | Select |

For `Correct Answer` and `My Answer`, create these options:

- A
- B
- C
- D

For `Status`, create these options:

- Unattempted
- Correct
- Incorrect
- Retry
- Mastered

For `Mistake Type`, create these options:

- Confused concept
- Forgot definition
- Fell for trap answer
- Careless reading
- Did not understand example
- Guessed

For `Confidence`, create these options:

- Low
- Medium
- High
- Mastered

The update API is defensive: if an optional property is missing, the app skips that property instead of breaking the whole app.

---

## 3. Create a Notion integration

1. Go to Notion integrations.
2. Create a new internal integration.
3. Give it read and update access.
4. Copy the integration secret.
5. Open each Notion database.
6. Use `...` menu → `Connections` → add your integration.

The app will not work until both databases are shared with the integration.

---

## 4. Get your database IDs

Open each database in Notion and copy the database ID from the URL.

The ID is the long string after the workspace/page path and before the question mark.

Example URL shape:

```text
https://www.notion.so/workspace/2f26ee68df304251aad48ddc420cba3d?v=...
```

Database ID:

```text
2f26ee68df304251aad48ddc420cba3d
```

You can keep the hyphens if Notion shows them. The API accepts UUID-style IDs.

---

## 5. Local setup

Create a `.env` file by copying `.env.example`:

```bash
cp .env.example .env
```

Fill it in:

```bash
NOTION_API_KEY=secret_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
NOTION_KEY_TERMS_DATABASE_ID=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
NOTION_MCQ_DATABASE_ID=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
NOTION_VERSION=2022-06-28
```

Then run:

```bash
npm install
npm run dev
```

Open the local URL shown in the terminal.

---

## 6. Vercel deployment

1. Upload this project to GitHub.
2. Import the GitHub repo into Vercel.
3. Add environment variables in Vercel:
   - `NOTION_API_KEY`
   - `NOTION_KEY_TERMS_DATABASE_ID`
   - `NOTION_MCQ_DATABASE_ID`
   - `NOTION_VERSION`
4. Deploy.

Do not expose the Notion secret in frontend code. This project keeps it inside serverless API routes only.

---

## 7. How to use the app

### Dashboard

Use it to see:

- Terms due today
- MCQs due today
- Weak terms
- Incorrect / retry MCQs

### Flashcards

1. Select chapter or `All`.
2. Read the term.
3. Try to define it aloud.
4. Reveal answer.
5. Mark:
   - Still weak → review tomorrow
   - Getting there → review in 3 days
   - Mastered → removes from daily review

### MCQs

1. Select an answer.
2. Check answer.
3. If wrong, select the mistake type.
4. Save result.
5. Incorrect questions are pushed into retry review.

---

## 8. File locations

```text
api/_notion.ts          Notion helper functions
api/terms.ts           Loads flashcards from Notion
api/mcqs.ts            Loads MCQs from Notion
api/update-term.ts     Writes flashcard progress to Notion
api/update-mcq.ts      Writes MCQ progress to Notion
src/App.tsx            Main app interface
src/styles.css         App styling
src/types.ts           TypeScript data types
src/lib/date.ts        Review-date helpers
```
