---
name: docs-authoring
description: >-
  Use whenever creating, editing, moving, or organizing Markdown documentation files
  (`*.md` in `docs/` or repository root), writing guides, plans, bug reports, specs,
  or rulebooks. Never load during normal backend/frontend feature coding unless
  documentation changes are needed.
---

# Docs Authoring & Organization Workflow (`docs/`)

Follow this exact procedure before writing or moving any `.md` file in this repository.

## Step 1 — Inspect `docs/` before choosing a path

1. Read `docs/README.md` to confirm the current topic index and existing documents.
2. List files inside the matching numbered folder (`docs/01-`..`09-`) to check whether a related doc already exists — prefer updating an existing document over creating duplicates.

## Step 2 — Place the file in the right folder

- **Never** create `.md` files directly at the repository root (only standard root files such as `README.md`, `AGENTS.md`, `CLAUDE.md` are allowed).
- **Never** place `.md` files directly inside `docs/` (only `docs/README.md` belongs at `docs/` root).
- Choose the matching numbered topic folder:

| Folder | Scope |
|---|---|
| `docs/01-getting-started/` | Environment setup, run guides, Git/Commit conventions |
| `docs/02-architecture/` | System architecture, class diagrams, ERD, entity rulebooks, i18n guides |
| `docs/03-exam-assessment/` | Exam, Question, Grading, Auth/Exam security, exam test guides |
| `docs/04-course-learning/` | Course, Syllabus, Progress, Analytics, Recommendations |
| `docs/05-project-workspace/` | Mock Project Hub (`plans/`, `use-cases/`, `fixtures/`, `images/`) |
| `docs/06-testing-verification/` | Bug fix reports, incident investigations, test plans, acceptance evidence |
| `docs/07-demo/` | Demo scripts, walkthroughs, demo quickstarts |
| `docs/08-training-operations/` | Class, Class Setup, Training Calendar, Trainer, Session |
| `docs/09-deployment-operations/` | Deployment, cutover, rollback, safe startup, infrastructure (SMTP, DB scripts) |

- **New top-level folder:** Only if no existing folder fits. Name it `NN-kebab-case` (e.g. `10-new-topic/`) and register it in `docs/README.md`.

## Step 3 — Naming, links & assets

- **Filename:** No spaces. Use `kebab-case.md` or `UPPER_SNAKE_CASE.md`.
- **Internal links:** Always use relative paths from the current `.md` file (e.g. `[AGENTS.md](../../AGENTS.md)`).
- **Images:** Store inside an `images/` folder near the doc and reference with a relative path.
- **Forbidden:** Never embed local machine paths (`C:/...`, `D:/...`, `file:///...`) inside committed `.md` files.

## Step 4 — Update index & verify

1. Update `docs/README.md` if you added a key document or a new topic folder.
2. Run the unified validator before finishing:

```bash
node scripts/check-docs-rule.mjs --ci
```
