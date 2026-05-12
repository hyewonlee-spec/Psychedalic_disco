# Notion Database Setup Checklist

Use this before deploying the app.

## Key Terms database

Database name: `Psychology - Key Terms`

Required properties:

- `Term` — Title
- `Chapter` — Select or Rich text
- `Title` — Rich text
- `Definition / Exam Meaning` — Rich text
- `Common Trap` — Rich text
- `Confidence` — Select
- `Next Review` — Date
- `Status` — Status or Select

Confidence options:

- New
- Low
- Medium
- High
- Mastered

Status options:

- Learning
- Weak
- Reviewed
- Mastered

## MCQ Bank database

Database name: `Psychology - MCQ Bank`

Required properties:

- `Question` — Title
- `Chapter` — Select or Rich text
- `Title` — Rich text
- `Option A` — Rich text
- `Option B` — Rich text
- `Option C` — Rich text
- `Option D` — Rich text
- `Correct Answer` — Select
- `Explanation` — Rich text
- `Concept` — Select or Rich text
- `Difficulty` — Select
- `Status` — Status or Select
- `My Answer` — Select
- `Mistake Type` — Select
- `Next Review` — Date
- `Confidence` — Select

Correct Answer / My Answer options:

- A
- B
- C
- D

Status options:

- Unattempted
- Correct
- Incorrect
- Retry
- Mastered

Mistake Type options:

- Confused concept
- Forgot definition
- Fell for trap answer
- Careless reading
- Did not understand example
- Guessed

Confidence options:

- Low
- Medium
- High
- Mastered

## Integration checklist

- [ ] Internal Notion integration created
- [ ] Integration has read content access
- [ ] Integration has update content access
- [ ] Key Terms database shared with integration
- [ ] MCQ Bank database shared with integration
- [ ] Key Terms database ID copied
- [ ] MCQ database ID copied
- [ ] Environment variables added to Vercel
- [ ] App redeployed after adding environment variables
