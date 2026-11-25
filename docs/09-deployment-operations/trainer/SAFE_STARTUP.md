# H2 compatibility and preservation-first startup

Current pre-cutover status and runtime observations are recorded in [FINAL_PRE_CUTOVER.md](FINAL_PRE_CUTOVER.md). The results below describe the earlier 2026-11-11 preparation.

Verified on 2026-11-11 (Asia/Saigon). Both reported technical blockers are resolved on a restored H2 database. The real production JAR starts with `ddl-auto=validate` and the supported `safe-deployment` profile. **The live backend PID 14176 / port 8080 has not been restarted; no migration was applied to the live database.**

## Mapping diagnosis and minimal fix

`ClassOperationEntity.milestonesJson` combined `@Lob` with `@Column(columnDefinition = "TEXT")`. Hibernate 6.5.2 consequently expected JDBC CLOB, while H2 2.2.224 stores TEXT as CHARACTER VARYING. The restored column is VARCHAR with capacity 1,000,000,000 characters. Its two non-null values are valid JSON arrays, 1,767–2,057 characters long.

Removed `@Lob`, retained TEXT, the String field, JSON serialization and all business logic. No VARCHAR-to-CLOB migration or rewrite is necessary. Strict validation then exposed the same conflict in three additional columns, so the identical annotation-only correction was necessary in:

- `ClassTopicAssessmentEntity.assessmentsJson`: 26 non-null valid JSON arrays, 403–406 characters.
- `TrainingCalendar.schedule` and `TrainingCalendar.topicsJson`: both existing H2 columns are VARCHAR; no saved calendar rows are present in the snapshot. LONGTEXT definitions are retained.

No Study Session logic, Class Readiness logic, relationships, or Class Diagram was changed during this fix. Existing calendar audit callbacks remain covered by roundtrip tests.

Full schema validation also discovered the reverse mismatch in `milestone_artifact_drafts.release_notes` and `milestone_artifact_submissions.release_notes`. The legacy `ArtifactReleaseNotesColumnInitializer` converted them to CLOB, although the entities explicitly define TEXT/VARCHAR. Both tables contain zero rows in the restored snapshot. The manually applied [h2-text-compatibility.sql](h2-text-compatibility.sql) aligns these two columns with their existing JPA contract. No Milestone service/entity behavior was changed. The script was tested on the restore and against large Unicode/null values in memory; it does not request truncation. This extra compatibility step is required for whole-application validation, not Trainer data creation.

Evidence: workspace-root `.run/td/text-columns-data-audit.json`, `release-notes-preflight.txt`, `migration-content-check.log`, and `schema-audit-after.log` (zero remaining table validation failures). Raw JSON values were not printed in the audit.

Reference: [H2 data types](https://h2database.com/html/datatypes.html).

## Startup controls

Added explicit `@StartupMutation` conditions to all **66** audited startup-only mutators. The complete changed-file inventory is [startup-mutators.txt](startup-mutators.txt), with paths relative to `training-management/`.

The inventory includes seeds/demo data, schema initialization/migrations, backfills, menu synchronization and RBAC writers. Material examples are:

- `RoleDataInitializer`: assigns all permissions to ADMIN and replaces standard role permission sets.
- `PermissionInitializer`: changes unrelated permission catalog/mappings.
- `AutoMenuInitializer` and `WorkspaceModuleCleanup`: synchronize or hide menu entries.
- `LegacyH2ProjectSchemaMigration` and `LegacyProjectMigrationConfiguration`: pre-Hibernate transformations and the entity-manager dependency on that migration.
- `ExistingClassRosterContextRepair`: changes class/user tenant context.
- `ClassOperationDataInitializer`: creates missing operation/assessment/activity records.
- Project/workspace/milestone schema compatibility, backfill and demo components listed in the inventory.

The condition is evaluated before bean construction, including PostConstruct methods and the pre-Hibernate migration configuration. Existing component-specific opt-in flags still apply. No regex-based bean removal or diagnostic bootstrap is used by the supported profile.

The profile configures:

```properties
app.startup.mutations-enabled=false
app.scheduling.enabled=false
spring.jpa.hibernate.ddl-auto=validate
spring.jpa.generate-ddl=false
spring.sql.init.mode=never
```

`@EnableScheduling` moved from the main application to conditional `SchedulingConfiguration`. Automatic execution of 13 scheduled writer classes is paused, while their service/job beans remain available. Controllers, repositories, Spring Security/JWT, async infrastructure and normal request processing remain active. Default behavior outside this profile is preserved (`matchIfMissing=true`).

There is deliberately no `jakarta.persistence.schema-generation.database.action=none` override: that setting takes precedence over Hibernate hbm2ddl and could suppress validation. Earlier strict negative trials reproduced real failures, and the final positive trial used actual validation. See [Hibernate schema tooling settings](https://docs.hibernate.org/orm/6.6/javadocs/org/hibernate/cfg/SchemaToolingSettings.html).

The real trial context confirms zero active startup-mutator beans, no scheduled annotation processor, and available Trainer controller/service, Class service, Class Operation service and security filter chain. Configuration values can be overridden by higher-priority environment/CLI settings; pin the reviewed flags explicitly at cutover and check for competing JPA schema-action settings.

## Build and tests

All builds ran in workspace-root `.run/td/b3`; the live watched `training-management/backend/target/classes` directory was not rebuilt.

- Maven package/compile: **PASS**.
- Final selected suite: **45 tests, 0 failures, 0 errors**.
- Existing Trainer integration: 8; external Trainer provenance contract: 7. All original 15 Trainer tests pass.
- Class Setup integration: 17.
- Text mapping integration: 5, including a negative old-LOB control and large Unicode/null roundtrips.
- Startup configuration: 7; full application safe-context integration: 1.

Integration tests use isolated H2 memory databases. Trainer/Class Setup tests now create explicit per-test user/permission/topic fixtures inside rollback transactions instead of relying on application demo initializers. The fixture helper refuses non-memory databases. No real account was granted permissions and no application demo seed was executed.

Log: `.run/td/safe-final-build-tests-fixed.log`. The source and resource hashes match the packaged build copy.

Artifact: `.run/td/b3/target/starter_project_2025-0.0.1-SNAPSHOT.jar`.

SHA-256: `29fd382e8b6f83c1f6995027dc3560f57980d7d264040b411c9079508b944f97`.

## Real JAR and API verification

Started the normal JAR entry point on `127.0.0.1:18080`, using `safe-deployment`, explicit safe flags, `ddl-auto=validate`, and the absolute restored `.run/td/r2/fams_lms_after_merge` URL with `IFEXISTS=TRUE`. There was no schema-update fallback. The final trial was shut down gracefully, with EntityManagerFactory and Hikari closed.

Verified responses:

- INTERNAL source metadata and ACTIVE Trainer options: 200; catalog remains empty.
- Unauthenticated Trainer request: 401.
- Existing copied admin lacks TRAINER_READ/CREATE; management list and import template: 403. No automatic grants.
- All eight saved Class details, Class list, Readiness read and three Programs: 200.
- Class Admin options: 200, 100 options returned.
- Existing operation/assessment JSON for classes 1 and 2, and internal calendar read: 200.
- Missing Class: 404; no unexpected 500 observed.
- External Trainer provenance still reports sampleData=true. The legacy external calendar route returns expected 503 because the isolated external base URL intentionally points to unavailable localhost:1. The internal calendar route works; this does not certify live external dependencies.

Evidence: `.run/td/safe-api-proof.json`, `safe-jar-final.log`, `safe-jar-final-process.json`.

## Data integrity

The previously verified engine-consistent backup was restored into a new r2 directory; its checksum remains unchanged. No hot raw copy of the live H2 file was used. The backup/restore provenance is in [the earlier preparation report](README.md).

Before authentication on the clone, fingerprints show **176 of 177 original tables unchanged**. The only exception is four deliberate TRAINER_* permission catalog entries. The text compatibility migration changes no row values. The two new Trainer tables are empty.

After authentication/API checks, 175 original tables remain identical; the two expected exceptions are the permission catalog and refresh tokens rotated by sign-in on the clone. Classes, Programs, assignments, subjects, users, roles, role memberships and role permissions remain identical. Counts: **8 operational Classes, 3 Programs, 0 Teaching Assignments, 0 Trainers**. All eight legacy `masterTrainerId` values remain null; saved Master Trainer strings are preserved. No ID conversion/backfill or Trainer sample data was introduced.

All 179 resulting tables were audited after graceful shutdown. Aggregate proof: `.run/td/safe-deployment-evidence.json`; detailed snapshots: `safe-before-schema.json`, `safe-before-boot.json`, `safe-after-compatibility.json`, `safe-after-trial.json`.

Existing Class-operation GET methods can lazily create missing records; their runtime behavior was preserved. Smoke tests only read already populated operation/assessment rows. The startup writer responsible for default creation is gated.

## Changed files

- Mapping only: `ClassOperationEntity.java`, `ClassTopicAssessmentEntity.java`, `TrainingCalendar.java`.
- Startup: `StarterProject2025Application.java`, new `config/startup/StartupMutation.java`, new `config/startup/SchedulingConfiguration.java`, and the 66 annotation/import changes in the inventory.
- Profile: new `application-safe-deployment.properties`.
- Tests: new `StartupSafetyConfigurationTest`, `SafeDeploymentContextIntegrationTest`, `ClassOperationTextMappingIntegrationTest`, `TrainingTestFixtures`; fixture setup updated in `TrainerManagementIntegrationTest` and `ClassSetupIntegrationTest`.
- Deployment documents: this file, README update, `startup-mutators.txt`, and new `h2-text-compatibility.sql`. The prior additive Trainer/catalog scripts are reused unchanged.
- Isolated evidence, build, backup and harness files remain under ignored workspace-root `.run/td`.

## Conditions for an approved port 8080 cutover

The two original technical blockers are resolved on the tested snapshot. This does not authorize live deployment or certify future edits to the live DB.

1. Agree the maintenance window and exact minimal Trainer role grants/menu registration separately. Safe startup intentionally does not grant TRAINER_* or add menus automatically. Existing RBAC and the five FAMS tabs must be preserved.
2. Pause writes/integrations, re-confirm live PID/datasource, make a fresh H2 engine-consistent backup, restore-test it, and back up attachments plus the old artifact/config. The preparation snapshot cannot replace a new cutover backup.
3. Repeat the rehearsal on that fresh restore, including the text compatibility preflight. Review table values and capacity if any release notes have since been added.
4. Only after approval, gracefully stop the verified old backend and apply the reviewed scripts to the exact closed/current H2 DB: `h2-additive.sql`, `permissions-catalog.sql`, then `h2-text-compatibility.sql`. These scripts are H2-only and are not automatically applied by startup. H2 DDL recovery uses the verified backup, not SQL ROLLBACK.
5. Start the reviewed JAR with the explicit absolute datasource URL plus IFEXISTS, safe-deployment, mutations=false, scheduling=false, ddl-auto=validate and sql.init.mode=never. Check for conflicting JPA schema-action overrides. Use the reviewed production dependency configuration; localhost:1 and the trial actuator beans/shutdown exposure are isolated-test settings.
6. Keep writes paused while checking fingerprints/counts, JSON, RBAC, approved menu entries, Trainer/Class Admin options and legacy identities. Sign in again after any separately approved role changes. Review pending jobs/outbox/deadlines before deliberately re-enabling scheduling; the safe profile pauses these automatic functions.
7. On failure, stop the new instance and restore the fresh verified DB plus the old artifact/config before reopening writes. Never replace an open H2 file.

No live deployment, database reset, sample Trainer import, Git write or Class Diagram modification was performed.
