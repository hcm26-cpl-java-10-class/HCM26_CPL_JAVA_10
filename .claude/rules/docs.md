---
paths:
  - "docs/**"
  - "*.md"
---

# Documentation Rules (`docs/`)

Before creating, editing, or moving any `.md` file in this repository:

1. Read `docs/README.md` and inspect the target `docs/01-`..`09-` subfolder first to avoid duplicate docs.
2. Follow the full procedure in `.agents/skills/docs-authoring/SKILL.md`:
   - Never place new `.md` files at the repository root or directly at `docs/` root (except `docs/README.md`).
   - Place every doc in the matching numbered folder (`docs/01-`..`09-`), or create `NN-kebab-case/` only if no category fits.
   - No spaces in filenames; use relative internal links only; never commit local paths (`C:/...`, `D:/...`, `file:///...`).
   - Update `docs/README.md` if adding a key document or new topic folder.
3. Verify with `node scripts/check-docs-rule.mjs --ci`.
