# Final pre-cutover verification — 2026-11-12

> Historical pre-approval snapshot. The user subsequently approved cutover with ADMIN READ/CREATE/UPDATE only. The 2026-11-12 attempt passed schema/data/API checks but was rolled back after SMTP caused health 503/DOWN. Current status and active recovery DB: [deployment result](DEPLOYMENT_RESULT_2026-11-12.md). Do not reuse the historical forward DB path without checking the active source of truth.

**READY for explicit approval of the cutover plan. No deployment or role/menu change is approved or executed.** All rehearsal processes have been shut down. The approved INTERNAL directory remains empty; no Trainer sample data was created.

## Current runtime and database

At resume on 2026-11-12, port 8080 did not accept a connection and the previous backend PID 14176 was no longer running. No StarterProject/JarLauncher application JVM was found. This verification did not stop or restart it. There is no currently active backend profile to report.

The previous live JVM was independently identified in `training-management/backend`, Java 21, default profile, using `jdbc:h2:file:../data/fams_lms_after_merge`. Its command-line H2 URL overrode the MySQL DB_URL loaded from the parent `backend/.env`. Those are historical runtime observations; the current source database file is:

`<workspace>/training-management/data/fams_lms_after_merge.mv.db`

The source file was opened only as a read-only filesystem channel for the cold backup. It was not opened by a new H2 engine, migrated, reset or seeded.

## New consistent backup and recovery

Created at **10:06:21 Asia/Saigon on 2026-11-12**:

- Archive: workspace-root `.run/td/final-precutover/2026-11-12/backups/fams_lms_after_merge-cold.zip`.
- ZIP SHA-256: `37b56e041308c37783779362bb6cfdf68c398b91b3592b11c070877abac3c605`.
- Source-file SHA-256: `d3690ab5a395ac0fdf3098e8af2257a3ee0bac19e6d760bfa4c0ad2cbc5a1e24`.
- Method: cold ZIP while holding a shared read-only OS file lock, excluding H2's exclusive writer lock. The source length, modification time and SHA were checked unchanged while locked. This was not a hot raw file copy.
- Restored with H2 2.2.224 into two new locations, `baseline` and `rehearsal`; their 177-table fingerprints are identical.
- The main source-file SHA was checked again after the tests and remains identical.

H2 distinguishes online BACKUP TO from offline file backup: the offline Backup tool requires the database not to be in use. The cold method here was selected because the backend had stopped, and the file lock prevented a concurrent writer: [H2 backup documentation](https://h2database.com/html/tutorial.html), [MVStore file locking](https://h2database.github.io/html/mvstore.html).

The documented original `backend/.env` was also copied and hash-verified into local `companion-backup`; no secret values were printed. No uploads directory exists at the two inspected backend locations. This is a current filesystem configuration snapshot, not a dump of the stopped process environment. Preserve these local backups and their manifests for the approved maintenance window.

## Migration and actual JAR rehearsal

Applied only to the restored rehearsal database, in order:

1. [h2-additive.sql](h2-additive.sql): Trainer tables and nullable identity/source columns.
2. [permissions-catalog.sql](permissions-catalog.sql): four catalog entries, no role grants.
3. [h2-text-compatibility.sql](h2-text-compatibility.sql): the two legacy release_notes columns aligned with their existing TEXT/VARCHAR contract after preflight.

The actual packaged JAR started on loopback port 18080 with `safe-deployment`, explicit mutations=false, scheduling=false, SQL init=never, H2 IFEXISTS and **ddl-auto=validate**. There was no fallback from validation for the new JAR. Runtime inspection found zero active startup-mutator beans and no scheduled processor; Trainer/Class services, controllers and Spring Security remained available.

JAR: `.run/td/b3/target/starter_project_2025-0.0.1-SNAPSHOT.jar`.

SHA-256: `29fd382e8b6f83c1f6995027dc3560f57980d7d264040b411c9079508b944f97`.

All 1,607 backend source/resource/test files and pom still match the packaged build copy. The 45 backend tests passed in the preceding verification; frontend 67 tests, both TypeScript projects and the isolated production build also passed. The relevant frontend source hashes were rechecked unchanged. No browser end-to-end run was performed.

## API, Class and Select checks

- `/api/trainers/data-source`: 200, INTERNAL / approved=true / sampleData=false.
- `/api/trainers/options`: 200, zero ACTIVE choices because the persisted directory is empty. Positive ACTIVE selection/filter/ID behavior is covered by isolated tests; no real Trainer was inserted for this check.
- No-token Trainer request: 401; copied ADMIN without new permissions: management list/import template correctly 403.
- All eight Class details, Class list, Programs, Class Admin options, Readiness read and internal calendar: 200. Missing Class: 404. Existing operation/assessment JSON for classes 1 and 2 remains readable.
- The external source still reports sampleData=true. An isolated legacy external calendar request returns expected 503 because that test dependency points to unavailable localhost:1; the internal calendar route works. Production dependency configuration must retain its reviewed values.
- Master Trainer remains a Select. Source tests reject sample/unverified/external cached choices and only accept approved INTERNAL ACTIVE numeric IDs. Class Create/Edit tests preserve the old name string and null ID until an explicit valid replacement is selected. No existing Class was edited during the real-copy smoke test.

## Integrity and access approval

The source snapshot contains **8 operational Classes, 3 Programs, 247 Users, 6 Roles and 0 Trainers**. Before clone authentication, 176 of 177 original tables are identical; only four permission catalog entries were added. After authentication, the additional expected difference is refresh-token rotation on the copy. All business tables, users, roles, memberships and role grants remain identical. All eight legacy Master Trainer names are preserved and their new IDs remain null. No ID conversion/backfill occurred.

The Training Management group has five existing menu rows and no `/trainers` row. Both SQL inspection and the actual sidebar APIs confirm this. No menu INSERT was executed; the proposed INSERT's read-only projection selects exactly one row.

Proposed approval, not an applied grant:

- **ADMIN:** TRAINER_READ, TRAINER_CREATE, TRAINER_UPDATE.
- **TRAINER_DELETE:** separate optional approval for archive; status changes already use UPDATE.
- **STUDENT, TEACHER, PROGRAM_MANAGER, MENTOR, CLASS_ADMIN:** no new grants.
- **Menu:** one active Training Management → Trainers row, `/trainers`, icon users, order 7, required TRAINER_READ. Keep the five existing entries unchanged.

Only ADMIN currently has CLASS_READ. The legacy TRAINING_CLASS_READ on some other roles is a different authority; it is not converted or expanded here. Class Select needs existing CLASS_READ or TRAINER_READ, so directory CRUD grants are not required merely for an already authorized Class reader to select a Trainer.

See [RBAC_MENU_APPROVAL.md](RBAC_MENU_APPROVAL.md), [menu-trainers-proposed.sql](menu-trainers-proposed.sql), and [trainer-role-grants-proposal.sql](trainer-role-grants-proposal.sql). The role proposal executes only SELECTs; its grant statements remain commented. Fresh sign-in is required after any approved authority change.

## Proposed cutover steps — execute only after approval

1. Confirm the exact role grants, optional DELETE decision, single menu row, maintenance window and [rollback plan](ROLLBACK_PLAN.md). Reconfirm port/PID, source-file hash, reviewed configuration and dependency endpoints. If the source changes, take and rehearse a fresh backup before proceeding.
2. Keep user writes, imports and integrations paused. Preserve the database backup, companion configuration, old classes and recovery package. If any backend is running by then, identify and gracefully stop that exact application; never act on yesterday's PID or generic java.exe.
3. Against the exact closed H2 file, run the three reviewed migration scripts in the order above. Check catalog/count/schema preconditions. Apply only the separately approved Trainers menu and exact additive role grants; do not run broad menu/RBAC initializers.
4. Start the verified JAR at port 8080 with the reviewed dotenv file and backend working directory, absolute H2 URL plus IFEXISTS, driver/credentials/dialect, safe-deployment, mutations=false, scheduling=false, ddl-auto=validate and sql.init.mode=never. The concrete reviewed argument file is `.run/td/final-precutover/2026-11-12/forward-approved.args`, with its hash and working directory in `launch-plan.json`; it has not been executed. Check for any competing JPA schema-action override. Use production dependency configuration; trial beans/shutdown exposure and localhost:1 are not deployment settings.
5. While writes remain paused, verify the original rows, legacy identity fields, role deltas, six menu rows including the approved Trainers entry, fresh-token RBAC, Trainer INTERNAL/ACTIVE options and Class Admin. Do not create sample Trainers. Real Trainer records can subsequently be entered/imported by an approved administrator.
6. Release writes only after the acceptance checks pass. Scheduling remains deliberately paused until pending outbox/reminder/deadline work has been reviewed and its resumption is explicitly planned.

The changes still required on the main DB are exactly the three schema/catalog scripts, one approved menu row, and the approved role_permissions additions. None has been applied to the main DB.

## Recovery readiness and evidence

The old binary cannot use the new startup flags: its initializers and scheduler are unconditional. It also fails strict validation on its old milestones mapping. A separate recovery launcher was therefore prepared, preserving the old 2,226 classes/resources and **all 142 original dependency JARs in original order**, with DevTools restart disabled. It blocks the reviewed startup writers and unknown callbacks before construction. It retains required filters, services and Spring Security.

The recovery package was exercised on port 18081 with **ddl-auto=none**, not validate/update. Class/Program/User APIs, all eight Class details and existing JSON work; role/business fingerprints remain identical. Only copied refresh tokens rotate. This proves the guarded old-code/old-schema recovery path; it does not turn the old mapping into a strict-validation-compatible mapping.

The production recovery template is inert until its verified recovery path and reviewed original dotenv are supplied. It can only use a separate existing `training-management/data/recovery/.../fams_lms_after_merge` file, refuses an occupied target port and does not overwrite the failed DB. It has **not** been run at 8080. The detailed commands and point-in-time rollback limits are in [ROLLBACK_PLAN.md](ROLLBACK_PLAN.md).

Aggregate evidence: workspace-root `.run/td/final-precutover/2026-11-12/final-proof.json`. Detailed backup, migration, API, source, test, recovery and table-fingerprint manifests are linked there. Both trial servers have been shut down cleanly.

Awaiting explicit approval of deployment, the exact role/menu changes and the reviewed recovery plan. No Backend 8080 start/restart, main DB migration, sample seed, H2 reset or Git write was performed.
