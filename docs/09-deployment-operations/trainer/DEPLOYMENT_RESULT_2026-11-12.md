# Trainer deployment result — 2026-11-12

> Follow-up: direct runtime inspection identified the precise missing setting: MAIL_APP_PASSWORD is defined but empty on both old and new code. SMTP/readiness policy was tested separately without restarting 8080. See [SMTP health investigation](../smtp/SMTP_HEALTH_REPORT_2026-11-12.md) for the current diagnosis and active recovery-DB verification.

**BLOCKED — cutover attempted, then rolled back under the user's explicit failure condition.** The new Trainer backend passed schema/data/API checks, but the final health endpoint returned HTTP 503/DOWN because Gmail rejected the configured SMTP credentials with `535-5.7.8 Username and Password not accepted`. The same SMTP failure is present in the recovered old backend. Mail configuration and health indicators were not changed or bypassed.

All times below are Asia/Saigon. Evidence paths beginning `.run` are relative to the outer workspace, not the nested repository.

## Current runtime

- Backend 8080 is running the **guarded old recovery runtime**, PID **24224**, started at 10:47:08; Tomcat ready at 10:47:37.
- Working directory: `training-management/backend`.
- Profile: `preserved-old-rollback`.
- DDL mode: **none**, exactly as approved in the rehearsed rollback plan. This is not a claim that the old binary passes validation.
- Actual database: `jdbc:h2:file:<workspace>/training-management/data/recovery/2026-11-12-1046/fams_lms_after_merge;IFEXISTS=TRUE`.
- Local JVM attach verified ownership UUID, PID, working directory, recovery launcher, datasource base path and recovery DDL setting without printing secrets.
- Application APIs for existing Classes, Programs, Users and Roles work. `/actuator/health` remains **503/DOWN** due to SMTP authentication.
- The recovery guard confirms zero startup runners, no scheduled processor, required services and Spring Security present. It suppresses 64 registered definitions from the reviewed 66-class startup inventory. Automatic jobs remain paused.
- Frontend is running at `http://localhost:5173`, PID 22676, from `training-management/frontend`. HTTP serves the SPA. Visual browser verification could not run because both UI tool kernels failed to initialize (`failed to write kernel assets`, OS error 3).

**Trainer Management is not live after rollback.** The active recovered database has the original five Training Management menu rows, no Trainers menu row and no TRAINER_* role grants. The recovered old binary returns 404 for `/api/trainers`.

## Backup and rollback integrity

Used exactly the approved, restore-verified cold archive created at 10:06:21:

`.run/td/final-precutover/2026-11-12/backups/fams_lms_after_merge-cold.zip`

- ZIP SHA-256: `37b56e041308c37783779362bb6cfdf68c398b91b3592b11c070877abac3c605`.
- Original cold-file SHA-256: `d3690ab5a395ac0fdf3098e8af2257a3ee0bac19e6d760bfa4c0ad2cbc5a1e24`.
- The main database still matched that source hash immediately before migration.
- Before rollback, the new JVM was stopped through its verified ownership UUID and normal JVM/Spring shutdown hooks. Hikari shutdown completed. No hard kill or open H2 file copy was used.
- Full-table audit of the stopped migrated database detected **no new business writes**. Only the approved catalog/menu/grant additions and authentication refresh-token changes existed. No genuine Trainer or Class edits needed reconciliation.
- Restored into a new `.run/td/recovery-check/2026-11-12-1046` directory. All **177** original table fingerprints matched the pre-cutover baseline.
- Copied the closed, verified restore into a new `training-management/data/recovery/2026-11-12-1046` directory. Its file checksum matched the original cold source exactly before startup.
- Verified all 142 preserved dependency JARs, recovery launcher/allowlist hashes and old class archive. Started only the approved guarded recovery launcher.
- Preserved the failed migrated database **in place** at `training-management/data/fams_lms_after_merge.mv.db`, with its checksum recorded. It was not overwritten, reset or deleted. Its logs and migration evidence are retained.

## What passed before rollback

The approved JAR SHA remained `29fd382e8b6f83c1f6995027dc3560f57980d7d264040b411c9079508b944f97`. All 1,607 backend source/resource/test files plus pom matched the packaged build copy; relevant frontend hashes also matched the tested version.

Applied only the approved schema/catalog scripts, in order:

1. `h2-additive.sql`.
2. `permissions-catalog.sql`.
3. `h2-text-compatibility.sql`.

Separately applied the explicitly approved targeted menu INSERT and ADMIN-only grant INSERT. No broad initializer ran. The four catalog entries included TRAINER_DELETE as specified by the catalog script, but **no role received DELETE**.

These exact operations were first exercised on a fresh restore. All existing rows were preserved. On the main database, the only original-table changes before authentication were four permission catalog rows, one Trainers menu row and three role_permissions rows for ADMIN. Two empty Trainer tables and nullable identity/source columns were added. No legacy IDs were backfilled.

The new JAR passed **ddl-auto=validate** on the real migrated database under `safe-deployment`, mutations=false, scheduling=false, SQL init=never, H2 IFEXISTS and disabled H2 console. Its maintenance run stayed on loopback 18080 while 8080 was closed. After 41 API checks, it was shut down cleanly and the entire database was audited again before opening 8080. All business data, existing grants, role memberships and legacy Master Trainer values remained intact.

The final new runtime started on 8080 at 10:43:28 and passed another **41 API checks**:

- Fresh ADMIN sign-in returned exactly TRAINER_READ, TRAINER_CREATE and TRAINER_UPDATE; no TRAINER_DELETE.
- Trainer list, ACTIVE options, INTERNAL provenance, teaching topics and Excel template returned 200.
- INTERNAL provenance was approved=true/sampleData=false; external sample provenance remained sampleData=true.
- Unauthenticated Trainer list returned 401. ADMIN DELETE returned 403. STUDENT READ/CREATE/import/UPDATE/DELETE requests returned 403 and no Trainer authorities were granted.
- Missing Trainer/Class returned expected 404, invalid status/create payload returned expected 400. No unexpected HTTP 500 occurred in these 41 checks.
- UPDATE/status requests for a nonexistent ID reached the authorized service and returned 404 without persisting data.
- Sidebar API returned exactly six Training Management entries, including the approved `/trainers` row requiring TRAINER_READ. The five original rows were preserved.
- All eight Class details, Programs, Users, Roles, Class Admin options, existing operation/assessment JSON, Readiness read and internal calendar were readable.

The actual directory had **0 Trainers**. Therefore the Select's source was valid INTERNAL but there were **0 ACTIVE options**. The existing UI correctly remained BLOCKED for an empty directory. No sample Trainer was inserted to force a selection. Positive persisted CRUD/import/ACTIVE selection was covered by isolated tests; it was not exercised with fabricated records on the main database.

## Preserved data and actual recovery tests

The restored database and 21 successful recovery API checks confirm:

- **8 Classes**.
- **3 Programs**.
- **247 Users**.
- **6 Roles**.
- All eight legacy Master Trainer names match the pre-rollback runtime.
- All original permissions and role assignments are restored; ADMIN currently has **0 Trainer authorities** after rollback.
- Original five Training Management menu rows restored; **0 Trainers menu rows**.
- Existing operation/topic JSON still parses. No-token access remains 401 and Spring Security remains active.

Authentication during verification changes only refresh-token records. No Trainer, Class, Program, user identity, role, membership or unrelated business data was created, edited or deleted by smoke tests.

Previously verified automated results remain applicable because their source/artifact hashes were rechecked unchanged: **45/45 backend tests**, including 8 Trainer integration and 7 external provenance tests; **67/67 frontend tests**; both TypeScript projects PASS; isolated production build PASS. These suites were not rerun during cutover. Actual restored/main database audits and runtime API tests were executed during this deployment.

## Errors and remaining blocker

- Final acceptance failed on SMTP authentication: MailHealthIndicator logged Gmail `535-5.7.8`; `/actuator/health` returned 503/DOWN. This was confirmed on both new and recovered old code with the reviewed configuration. Trainer schema validation itself passed.
- A rehearsal-only launch initially appended a duplicate port argument. Spring parsed `8080,18080` as an invalid integer. The tooling was corrected to replace the isolated port/DB tokens before the main DB was touched. The final production start used the unchanged approved argument file with no duplicate override.
- Browser Use and Computer Use could not initialize their kernels. No claim of visual browser or production persisted CRUD end-to-end success is made.

Trainer cutover remains BLOCKED. A configuration owner must provide valid reviewed SMTP settings through the local environment file; credentials must not be posted in chat or logs. Do not disable the mail health indicator merely to obtain a green status.

The next cutover must start from a fresh, verified backup of the **currently active recovery database**, including any later user edits. Rehearse the three scripts, approved menu/grants and health check with that configuration before a new deployment window. **Do not blindly rerun the old forward argument file against the preserved migrated DB:** it is no longer the active source of truth and may diverge after recovery writes.

## Evidence and changed files

Aggregate evidence: workspace-root `.run/td/deployment-2026-11-12/deployment-proof.json`.

That directory also contains the preflight proof, exact approved ADMIN grant SQL, fresh rehearsal, before/after table and per-row RBAC/menu fingerprints, migration proofs, process argument manifests, 41-check API proofs for rehearsal/maintenance/8080, graceful shutdown logs, rollback eligibility/restore checksums and 21-check recovery proof. No JWT, password or SMTP secret is included in the JSON reports.

Repository file changes in this deployment are this report and status notes in `FINAL_PRE_CUTOVER.md` / `ROLLBACK_PLAN.md`. Operational verification/launch helpers are under `.run/td/deployment-2026-11-12`; source modules were not edited. Approved DB changes remain in the preserved failed file; the active DB is the separate restored backup. No Trainer samples, H2 reset, hard delete, Git commit/push/pull or changes to other module functions were performed.
