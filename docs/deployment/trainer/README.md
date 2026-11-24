# Trainer Management: deployment preparation and stop conditions

Latest pre-cutover result (2026-11-12): see [FINAL_PRE_CUTOVER.md](FINAL_PRE_CUTOVER.md) and [ROLLBACK_PLAN.md](ROLLBACK_PLAN.md). The production JAR and guarded recovery package have been rehearsed on restored databases. Status: READY for explicit approval only; no live deployment has been performed or approved.

The remaining sections preserve the **earlier preparation findings** from 2026-11-11, before those fixes, including the original diagnostic trial and backup provenance. Use SAFE_STARTUP.md for the current migration order and startup settings.

## Verified live backend

- Workspace: `training-management/backend` in the currently open workspace. This is different from the sibling root-level `backend` copy.
- Actual JVM PID: `14176`, started at 13:41:26 on 2026-11-11; Maven parent PID `3480`, launcher PID `11268`. The JVM was not stopped or restarted.
- Java: `D:/jdk21/bin/java.exe`, Java 21.0.12; Spring Boot 3.3.3; H2 2.2.224.
- Active Spring profile: none explicitly selected; the startup log confirms profile `default`.
- Actual JDBC URL, independently confirmed by JVM arguments, Hikari log, and a read-only H2 console query: `jdbc:h2:file:../data/fams_lms_after_merge`.
- `DATABASE_PATH()` confirms the file at `<workspace>/training-management/data/fams_lms_after_merge.mv.db`.
- The raw `DB_URL` system property loaded from the parent `.env` points at MySQL `learnmangement`. It is **not** the active database: the explicit `--spring.datasource.url=jdbc:h2:file:../data/fams_lms_after_merge` argument overrides it. An unqualified `mvn spring-boot:run` could therefore select a different database or fail because of a driver mismatch.
- The live classpath resource (not merely current source) configures `spring.jpa.hibernate.ddl-auto=${DB_DDL_AUTO:update}`. The observed JVM command line and system properties have no ddl-auto override, and the loaded `.env` has none. This is evidence of the configured `update` default, not an independent dump of every OS environment variable in the running process. A deployment must explicitly pin the new value instead of relying on that default.
- Live read-only inspection: 8 operational classes, 3 training programs, 0 teaching assignments; no `trainers` table and no `TRAINER_*` permissions. Existing Master Trainer strings are part of the protected class records.

Runtime evidence is in workspace-root `.run/td/live-vm-commandline.txt`, `runtime-jvm-safe.json`, and `live-inspection.html`. No passwords or tokens are included in the report. The live watched `backend/target/classes` directory was only read, never rebuilt.

## Consistent backup and tested recovery

The live embedded H2 engine executed `BACKUP TO` through a separate console connection, after verifying the exact database path and H2 version. No raw `.mv.db` copy was made while the database was open. The official H2 documentation states that `BACKUP TO` provides a transactionally consistent online backup and that the offline Backup tool / ordinary hot file copy are not substitutes: https://h2database.com/html/tutorial.html

- Archive: workspace-root `.run/td/backups/live-2026-11-11T09-11-24-181Z.zip`.
- Size: 288713 bytes.
- SHA-256: `a64709ed504b22e711b7442f069f0d203352a25c2eba2402f524e647536c24c2`.
- Restored using the same H2 2.2.224 Restore tool into two new directories, `.run/td/r0` and `.run/td/r1`; no existing file was overwritten.
- The restored database was opened with `IFEXISTS=TRUE;ACCESS_MODE_DATA=r` and all 177 public tables were fingerprinted. Protected business data and relationships are preserved.
- After the Trainer-only schema/catalog migration on r1, 176 existing tables were byte-value-equivalent by row count and canonical SHA-256 fingerprint. Only the permissions catalog changed, by exactly four entries. Role grants were unchanged. Both new Trainer tables remained empty.
- After API testing and graceful shutdown of the isolated server, all class/program/topic/assignment/user/role/grant fingerprints remained unchanged. Only the copied permissions catalog and copied refresh-token table differed, as expected from the migration and authentication on the clone.
- Old application classes/resources were separately archived for rollback: `.run/td/backups/old-target-classes.zip`, 2226 files; SHA-256 `bd565f37bfbca35efd067b9ff7ffac94d17ffd6e2365383011f52083e2f3201d`.

These archives are local preparation artifacts outside Git. They contain application/database material and should be retained with controlled access. The DB backup does not include uploaded filesystem attachments, external systems, or the live `.env`; those require a separate approved, quiesced backup at cutover. This backup is a verified point-in-time snapshot, not a promise to include future edits. A fresh backup and restore check are required at the actual maintenance window.

## Trainer migration and authorization review

Prepared and tested on the restored copy only:

1. `h2-additive.sql`: create `trainers` and `trainer_teaching_topics`; add nullable `training_operation_classes.master_trainer_id` and `teaching_assignments.trainer_source`.
2. `permissions-catalog.sql`: insert only TRAINER_READ, TRAINER_CREATE, TRAINER_UPDATE, TRAINER_DELETE if absent.

No code/email identity is inferred, no existing Master Trainer string is replaced, and no external Trainer ID is converted to an internal ID. All eight copied legacy classes retained NULL `master_trainer_id`. There are no Trainer sample rows or topic sample rows.

Trainer Entity/Repository/Controller are present once in the active workspace. Trainer source metadata applies to the approved persisted INTERNAL catalog only. The external source remains `sampleData=true`. Trainer endpoints enforce their declared authorities; archive protection checks internal identity/source and existing class references.

The catalog script does not write `role_permissions`. Registration is separate from authorization: the copied existing admin still has no TRAINER_* grants. GET `/api/trainers` and the import template return 403 for that account, correctly. A designated administrator must explicitly approve any subsequent minimal role grants. Do not run `RoleDataInitializer` merely to obtain these permissions. The new Trainers menu also needs a targeted, reviewed registration if the broad AutoMenuInitializer is suppressed; do not resynchronize unrelated menus as a side effect.

The SQL has been tested for H2 2.2.224 only. It is not a MySQL migration and must not be presented as verified for MySQL. DDL can commit independently in H2; a SQL transaction rollback is not a database rollback plan.

## Startup/migration hazards

There is no Flyway/Liquibase-managed Trainer migration in the current build. In addition to Hibernate's configured `update`, the application has Java startup runners and PostConstruct migrations:

- `RoleDataInitializer`: assigns all permissions to ADMIN and replaces permission sets of standard roles. This exceeds the narrow Trainer catalog operation.
- `PermissionInitializer`: removes unrelated BOARD_READ/TASK_CREATE/TASK_UPDATE permission mappings/catalog rows before registering resources.
- `LegacyH2ProjectSchemaMigration` runs before EntityManagerFactory through `LegacyProjectMigrationConfiguration`. It can transform project/team/workspace references and snapshots. Setting Hibernate ddl-auto to validate does not suppress this independent migration.
- Numerous DataInitializer / DemoInitializer / Backfill / schema components and scheduled jobs are enabled by default; many have no single complete disabling property. Disabling only `app.workspace.demo.enabled` or the documented seed flags is insufficient.
- The live database contains data beyond Class/Trainer/Program; a standard startup can touch it even though the Trainer schema itself is additive.

For verification only, `.run/td/SafeTrialBoot.java` suppresses 64 startup-mutator/scheduler bean definitions in the isolated trial, including the legacy pre-Hibernate migration. It does not bypass HTTP security or method authorization. This external diagnostic bootstrap is **not** a tested production startup profile and must not be used as a silent production replacement. Production startup gating needs explicit implementation/review for seed, migration, role/menu and scheduling behavior, followed by another restore rehearsal.

## Compile, tests and isolated HTTP trial

- Separate source/build tree: `.run/td/b`. No source or build output was written into the live backend's watched target directory.
- `mvn -DskipTests package`: PASS. New artifact `.run/td/b/target/starter_project_2025-0.0.1-SNAPSHOT.jar`; SHA-256 `9f1a96aea2064438a91bce4ee9cd8184d5ac2343e042fdec764db6c4e0ab77a5`.
- Main source hashes exactly match the active workspace source copied for packaging.
- Trainer tests on H2 memory: 15/15 PASS, 0 failures, 0 errors. This includes the existing 8 Trainer integration cases and 7 external provenance contract cases. In the isolated test copy only, all demo/startup mutators were suppressed and the setup used minimal rollback-only user/permission/topic fixtures. No demo initializer or real-account grant was run against the source DB.
- Strict startup on restored r1 with `ddl-auto=validate`: FAIL. Confirmed mismatch: `class_operations.milestones_json` is VARCHAR in the snapshot, while Hibernate expects CLOB/text. No unrelated column was changed to make this pass. Other mismatches may exist after the first failure and have not been certified absent.
- Diagnostic startup on r1 with explicit `ddl-auto=none`: PASS on `127.0.0.1:18080`, profile `trainer-deployment-trial`. This proves bounded API behavior, not strict schema readiness.
- OpenAPI includes `/api/trainers` (200). No-token Trainer request returns 401. Existing cloned-account authentication succeeds; INTERNAL source and ACTIVE options return 200 (empty catalog). Unauthorized management/template requests return 403. The external source still returns `sampleData=true`. Existing class/program reads return 200 with counts 8/3.
- The diagnostic backend was shut down through its own authenticated shutdown endpoint at port 18080. PID 14176 / port 8080 was not stopped or restarted. The diagnostic shutdown endpoint was enabled only on that loopback trial.

Evidence: `.run/td/backend-package.log`, `trainer-safety-tests-final.log`, `trial-validate-failed.log`, `trial.log`, `trial-api-proof.json`, `migration-proof.json`, `after-trial-proof.json`, `backup-manifest.json`, and `deployment-evidence.json`.

## Safe cutover steps after explicit user approval

1. First resolve the CLOB/VARCHAR contract with the owner of Class Operations and repeat strict schema validation on a fresh restore; review any further validation failures. No unrelated Class field change is authorized by this preparation.
2. Implement/review a production-safe startup mode that prevents demo seeds, broad role/permission/menu resets and unintended backfills/migrations. Decide which non-mutating services and schedulers should resume. Repeat the full restore rehearsal using that exact startup mode and artifact. The diagnostic bootstrap alone is not sufficient.
3. Agree the exact minimal TRAINER_* role assignments and the single Trainers menu registration. Record approval; preserve all unrelated role memberships/menu rows.
4. Obtain approval for the maintenance window. Pause user writes, imports, relevant schedulers and integrations. Verify the real PID, datasource and absolute path again. Create a fresh engine-consistent backup and test its restore; capture old artifact/config and quiesced attachment storage. Do not use today's stale snapshot as the final cutover backup.
5. Gracefully stop only the verified old backend. Confirm process/DB closure; take an additional cold filesystem backup if desired. Do not force-kill a PID based only on an old launcher file.
6. Apply only the approved versioned H2 changes and catalog/menu operations to the exact existing database; do not grant unapproved roles or backfill old Trainer identities. Record checksums and each applied step.
7. Start the verified artifact with explicit Java 21, absolute datasource URL plus `IFEXISTS=TRUE`, explicit driver/credentials, the reviewed safe startup mode, and `ddl-auto=validate`. Avoid the parent `.env` ambiguity and unqualified `mvn spring-boot:run`.
8. Keep writes paused while validating row fingerprints/counts, roles, menus, old Master Trainer values, legacy NULL IDs/source, and approved Trainer API/RBAC. Require fresh sign-in for updated JWT authorities. Unfreeze only after all checks pass.
9. On failure, stop the new process, preserve failure diagnostics, restore the fresh verified database backup and old classes/artifact/config using the reviewed safe rollback startup path, verify the original dataset, then reopen writes. Never overwrite an open H2 file or roll back to a snapshot taken before unrecorded user writes.

## Current blockers

- Strict schema validation outside Trainer fails (VARCHAR vs CLOB); no production schema correction is approved.
- Default startup still includes unrelated mutations and role resets; no complete reviewed production guard exists.
- Exact production Trainer role grants and targeted menu registration require administrative approval.
- Final fresh backup/attachment snapshot and maintenance/cutover approval have not happened.

No live migration, data reset, Trainer demo seed, source Class change or Git write was performed during this preparation.
