# Trainer Management verification — 2026-11-16

## Current result

The original running H2 contains all 10 requested Trainer profiles. No migration, duplicate import, status update, User linkage, or class assignment is needed to make these records persistent. This verification did not write business data or schema to the original database.

UI implementation and automated component/integration tests are complete. Full HTTP verification against the restored database and a backend restart verification remain blocked by an unrelated existing Hibernate schema mismatch. They must not be reported as passed.

## Scope and Git baseline

Repository: `training-management`, branch `feature/training-management`.

Before this task, Git already showed changes to the H2 binary, ClassModal, its Master Trainer tests, Trainer API tests and TrainerManagementIntegrationTest, plus the two earlier audit/plan documents. These changes were preserved. Baseline: `../verification/trainer-management-20261116/git-before.txt`.

Files changed in this task:

- `frontend/src/pages/management/training/trainer/TrainerManagementPage.tsx`.
- `frontend/src/pages/management/training/trainer/TrainerManagementPage.test.tsx`.
- This verification document.

No backend production code, API contract, database schema, `.env`, production configuration, permission rule or ACTIVE validation was changed. No Git commit, push, pull or reset was performed.

## UI changes

- A responsive heading, clearly labelled search/status controls, directory count, calmer table spacing and pagination footer.
- All six columns retained: Trainer ID (business code), Full Name, Work Email, Specialization, Status, Actions.
- Fixed table proportions and wrapping for long names/emails; emails remain fully available with a native title tooltip. Table scrolling remains local on narrow screens.
- One labelled three-dot trigger per row replaces the wide button group. The existing Radix menu component renders through a portal, supports keyboard focus, arrows and Escape, and positions the menu against viewport boundaries.
- View remains available to readers. Edit and Activate/Deactivate require TRAINER_UPDATE. Archive requires TRAINER_DELETE. Add/Import retain TRAINER_CREATE. Backend authorization remains authoritative.
- Existing detail/edit forms, Excel preview/import, server search/filter/pagination, archive confirmation, busy/error handling and query invalidations were retained.

## Datasource and actual data

Read-only live H2 queries, JVM working-directory inspection and startup logs identify:

- Backend profile: `local`.
- Backend working directory: the repository's `backend` directory.
- Runtime datasource URL: `jdbc:h2:file:C:/Users/pc/Downloads/OJT2026/HCM26_CPL_JAVA_10-feature-training-management/HCM26_CPL_JAVA_10-feature-training-management/training-management/data/fams_lms_after_merge`.
- Physical file: `training-management/data/fams_lms_after_merge.mv.db`.
- From that working directory, `jdbc:h2:file:../data/fams_lms_after_merge;IFEXISTS=TRUE` resolves to the same database. The current launcher uses an absolute DB_URL override without IFEXISTS; this task did not change it.
- The application.properties fallback is `./data/fams_lms_after_merge`; without the existing override, that relative fallback would point inside `backend/data`. Preserve an explicit, verified datasource when restarting.

`SELECT DATABASE_PATH()` confirmed the actual path. `TRAINERS` contains 10 rows, all STATUS=ACTIVE and IS_ACTIVE=TRUE:

- id 1: SWP302 — Phan Van Hoang — hoangpv@gmail.com.
- id 2: NGATTT45 — Trần Thị Thúy Nga — trantttt45@gmail.com.
- id 3: ANHNM01 — Nguyễn Minh Anh — nguyenminhanh.gv26@gmail.com.
- id 4: BAOTQ02 — Trần Quốc Bảo — tranquocbao.gv26@gmail.com.
- id 5: NHUNGLTH03 — Lê Thị Hồng Nhung — lethihongnhung.gv26@gmail.com.
- id 6: LONGPD04 — Phạm Đức Long — phamduclong.gv26@gmail.com.
- id 7: MAIVTN05 — Võ Thị Ngọc Mai — vothingocmai.gv26@gmail.com.
- id 8: PHUCDH06 — Đặng Hoàng Phúc — danghoangphuc.gv26@gmail.com.
- id 9: TRUCBT07 — Bùi Thanh Trúc — buithanhtruc.gv26@gmail.com.
- id 10: KHANGDM08 — Đỗ Minh Khang — dominhkhang.gv26@gmail.com.

Case-normalized/trimmed duplicate code groups: 0. Duplicate email groups: 0. Numeric IDs above are local TRAINERS primary keys, not cross-system identity evidence. No new profiles were created. No sample records from port 9090 were used.

The old six HCM26 classes still store `NgaTTT45` and NULL master_trainer_id. They were not automatically linked to TRAINERS.id=2. A stored label and a similar business code do not independently establish the identity of the historical assignment. Existing USERS TEACHER accounts likewise were not linked by numeric ID or name.

This confirms database persistence of the profiles; it does not independently verify ownership or deliverability of their email addresses.

## Backup, restoration and data checks

Artifacts are outside Git in `../verification/trainer-management-20261116/`.

- A live H2 `BACKUP TO` produced `source-snapshot.zip`, without business INSERT/UPDATE or schema changes.
- Backup SHA-256: `A9B9558379F66706F933842E618BA2CE7477351F632B06FAF9D4FEB8B877415F`.
- Independently extracted `clone` and `restore-check` H2 files initially both had SHA-256 `3E8F56259D5A7A5C48BA99592F65C7480A97B35C4F3EB65A9070958A443BD446`.
- Both copies were opened with IFEXISTS=TRUE and ACCESS_MODE_DATA=r for diagnostic reads. Both contain the 10 Trainer records. Sorted row fingerprints matched across 14 business tables after the failed clone startup, including Trainer profiles/topics, Users/roles, class assignments, classes, sessions, enrollments and calendar tables.
- Snapshot export, schema preflight and fingerprint logs are retained in that directory. A fresh extraction of the immutable backup is the rollback source for rehearsal. No original database restore was performed.

## Class Management integration

Existing production path remains unchanged:

1. `/api/trainers/options` reads the persisted internal catalog with isActive=true and STATUS=ACTIVE; pagination is supported.
2. `/api/trainers/data-source` supplies internal provenance; frontend verifies INTERNAL, approved=true and sampleData=false.
3. ClassModal selects numeric TRAINERS.id and displays the Trainer name/email. It submits the selected masterTrainerId and canonical masterTrainer name.
4. Backend class update checks CLASS_UPDATE, resolves the internal Trainer, enforces ACTIVE and validates the submitted name. Class DTO retains its existing ID/name contract; trainerCode is read from the Trainer resource, not added as a new class DTO field.
5. Successful saves invalidate class list/detail and relevant directory queries. Trainer status/import/create/update invalidations remain present.

Automated tests verify selection, loading/error/retry, stale-cache revalidation, unchanged legacy assignments, class update persistence after clearing the persistence context, and rejection of inactive/archived/missing Trainers or unauthorized writes. No original class was edited for verification.

Live authenticated list/options comparison, selection using these exact 10 records through the restored backend, and backend restart/read-back have not yet passed; see the blocker below. No original login was issued for this verification, because it would mutate refresh-token records.

## Executed checks

- Frontend targeted tests: 45/45 passed (TrainerManagementPage, ClassModal Master Trainer, Trainer API).
- Frontend class regression tests: 34/34 passed (ClassListPage, ClassDetailView). Total: 79/79.
- Added menu tests exercise independent permissions, keyboard arrows/Escape/focus return, portal placement outside the table, activation/invalidation, archive confirmation, pagination and full emails.
- TypeScript `tsc -b`: passed.
- Production frontend build: passed, with the existing large-chunk warning.
- ESLint for the two UI files changed in this task: passed.
- Full frontend lint: failed with 625 findings (575 errors, 50 warnings), outside those two files. No broad lint refactor was attempted.
- Maven compile: passed in the isolated backend verification copy.
- TrainerManagementIntegrationTest: 11/11 passed on isolated H2 test databases. Covers CRUD/search/filter/stable ID, duplicate validation, authorization, Excel template/preview/atomic import/formula rejection, status/archive rules and Class Management integration.
- The first offline Maven test attempt lacked Byte Buddy artifacts; the online retry downloaded the dependencies and passed.
- `git diff --check`: passed.

Raw logs: `frontend-targeted.log`, `frontend-class-regression.log`, `typescript.log`, `frontend-build.log`, `frontend-changed-lint.log`, `frontend-lint.log`, `maven-compile.log`, `backend-tests-online.log`.

Browser layout verification passed at 1440×1000, 1024×900 and 390×844. All 10 rows rendered. Desktop table width and scroll width both measured 1062px: no horizontal scrolling. At tablet/mobile sizes, scrolling was confined to the table, with no document overflow. Four action items were reachable, menus stayed within the viewport, Escape restored trigger focus, search/filter worked, there were zero page errors and zero attempted API writes. Screenshots were inspected, including desktop, tablet, mobile and the mobile menu.

Evidence: `browser-ui-result.json`, `browser-ui-pass.log`, `trainer-desktop-top.png`, `trainer-tablet-top.png`, `trainer-mobile-top.png`, `trainer-mobile-menu.png`. Earlier failed attempts concerned the isolated transport fixture (matching Vite source imports and notification response shape); those were fixed in the verification script, not production code.

This uses a new headless browser context with a read-only snapshot transport; it is not a live backend/API or authentication test. Native Computer Use was unavailable (native pipe/browser host unavailable). Client test identity and response interception are confined to the new test context; no application authorization was changed and no real API write was forwarded.

## Remaining blocker and required approval

The restored backend was launched on port 8082 with Hibernate `validate`, startup mutations/schedulers disabled and SMTP overridden to 127.0.0.1:1 to prevent external email. It failed before serving HTTP:

`milestone_artifact_drafts.release_notes`: existing H2 column CLOB, entity mapping expects TEXT/VARCHAR.

Read-only preflight finds this table contains 0 rows in the snapshot. This mismatch is outside Trainer Management. No type conversion was executed.

An automatic approval review rejected a proposed clone launch using ddl-auto=none, stating that it would bypass schema validation. The proposal was not executed. The subsequent safer launch retained validate and reproduced the mismatch. Original configuration and database were left unchanged.

Approval was requested to adjust this column's type only in the disposable test copy, preserve the backup, check data before/after and retain Hibernate validation. The user selected: “Giữ nguyên cả bản sao; báo cáo phần kiểm thử bị chặn”. Therefore no column conversion or schema repair is authorized or performed, including on the copy. Hibernate validation remains enabled. The dependent HTTP, exact-record Master Trainer save and backend restart checks are BLOCKED, not passed; no approval request remains pending.

If the test-copy startup blocker is resolved in a separately authorized future task, the remaining checks are: authenticate normally against the copy, compare all 10 list/options records by code/email/id/status, exercise the real UI against that API, change Master Trainer only on a disposable test class, restart that backend and verify the same catalog/selection is read back. Keep external email disabled throughout. These dependent checks are not being continued under the user's current instruction to preserve the copy.

No original-data migration is currently proposed: all 10 profiles already exist in the correct file. Any historical class linking, User/Trainer identity linkage, original schema repair or original datasource/data migration would require a separate concrete review and approval. Other existing functions were not modified; the checks above do not claim exhaustive manual coverage of every module.
