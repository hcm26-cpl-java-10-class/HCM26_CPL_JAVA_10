---
applyTo: "docs/**,*.md"
---

# Documentation Rules (`docs/`)

Before creating, editing, or moving any `.md` file in this repository:

1. Read `docs/README.md` and inspect the target `docs/01-`..`09-` subfolder to avoid creating duplicate docs.
2. Follow `.agents/skills/docs-authoring/SKILL.md`:
   - Do not add `.md` files at the repository root or directly inside `docs/` (only `docs/README.md`).
   - Place every doc in the matching numbered topic folder (`docs/01-`..`09-`).
   - Use filenames without spaces, relative internal links only, and no local paths (`C:/...`, `D:/...`, `file:///...`).
   - Update `docs/README.md` when adding a main document or a new `NN-kebab-case/` topic folder.
3. Validate with `node scripts/check-docs-rule.mjs --ci`.
