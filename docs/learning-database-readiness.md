# Learning database and migration readiness audit

Date: 28 October 2026. Status: readiness not established; changes require approval. The learning-progress architecture remains proposed. This report does not approve or implement its entities, tables or APIs.

Scope: read repository configuration, deployment templates, test declarations, initializers and entity assumptions; inspect configuration file metadata and relevant variable names in the agent process; consult official framework/database guidance. No database connection, application/container startup, Maven build/test, migration, seed, deletion or configuration change was performed. Credential values are deliberately omitted.

## 1. Current database configuration matrix

| Configuration/context | Observed database configuration | Schema/data lifecycle | Evidence and limits |
| --- | --- | --- | --- |
| Packaged-source default | application.properties: jdbc:h2:mem:base_crud; H2 driver and explicit H2 dialect; username sa; blank DB password | Explicit spring.jpa.hibernate.ddl-auto=create-drop; H2 console enabled | Confirmed source values. Applies only when not overridden; not proof of production configuration. |
| Local compiled resources | backend/target/classes/application.properties exists and is byte-identical to source; no additional application profile file found | Same declared defaults | Disk artifact only; not proof that a running process uses it. No built backend JAR was found in target during this audit. |
| Backend environment example | backend/backend.env.example declares DB_URL pointing to a host-local MySQL server on port 3306 and schema learnmangement; DB_PASSWORD also declared | No driver, dialect or DDL lifecycle mapped by the application from those names | Template, not a loaded profile. No DB_URL/DB_PASSWORD placeholder, dotenv loader, custom DataSource or Spring config import was found. Setting these custom names alone does not select Spring's DataSource. |
| Development Compose | docker/dev-env.yml actively declares mysql:8.0, schema learnmangement, host 3307 -> container 3306, mysql_data -> /var/lib/mysql; separate Redis service | Volume declared persistent across ordinary container recreation; no application migration configuration | No backend service exists in this Compose file. Volume existence, contents and running service are unverified. MySQL is an available declared service, not evidence the backend uses it. |
| Docker environment example | docker/docker.env.example declares DB_PASSWORD | Active dev Compose uses a literal root-password setting rather than this variable | The older commented Compose fragment interpolates DB_PASSWORD, but is inactive. Loading an env file does not wire it into an absent backend service. |
| Full-context tests | StarterProject2025ApplicationTests, QuestionIntegrationTest and InvitationIntegrationTest use SpringBootTest | No explicit test profile, DataSource override or test resource application configuration found; can inherit defaults/external overrides and run initializers | Source inspection only; tests not executed. InvitationIntegrationTest explicitly deletes all invitation and audit rows in setup and creates records. |
| Unit/MVC-slice tests | Mockito/service tests and WebMvcTest slices | Generally mocked/narrow contexts; do not establish durable DB behavior | No claim that passing unit tests demonstrates production persistence. Current test resources contain only Mockito configuration. |
| Production/deployment | GUIDE describes docker-compose.yml as production, but docker/docker-compose.yml and docker/Dockerfile are both zero bytes | No usable repository production service, storage or migration lifecycle declaration | No application-prod, production manifest, repository CI workflow, backup configuration or deployment launch evidence was found. External deployment may exist; actual production engine/URL/profile/DDL settings are UNKNOWN. |
| Agent shell environment | No relevant SPRING_DATASOURCE_*, SPRING_JPA_*, SPRING_PROFILES_*, SPRING_CONFIG_*, SPRING_FLYWAY_*, SPRING_LIQUIBASE_*, DB_* or application-JSON/JVM-option variable names were present | Not applicable | This is the audit tool's environment, not the running application, CI or production environment. Absence here proves nothing about those processes. |

No application-dev/application-test/application-prod or bootstrap configuration was found in source/test resources. No Maven profile supplying database settings, test-specific property annotation or custom DataSource factory was found. The Compose filename dev-env.yml does not activate a Spring dev profile. Relevant ignored .env files and local IDE launch directories were not present in the inspected workspace; external files outside it and deployment secret stores remain unverified.

### Configuration wiring and precedence

Spring environment variables, Java system properties, application JSON, command-line arguments and external configuration files can override packaged defaults. External/profile-specific sources must therefore be established from the actual deployment, not inferred from this repository. See [Spring Boot 3.3 externalized configuration](https://docs.spring.io/spring-boot/3.3/reference/features/external-config.html).

For an approved future configuration, either use standard properties such as spring.datasource.url (or SPRING_DATASOURCE_URL), or deliberately map custom DB_URL-style names. Do not assume a file named backend.env.example or .env is automatically imported by Spring. URL, credentials, driver, dialect, DDL mode and initialization controls must be reviewed together. The explicit H2 driver/dialect also need attention when selecting MySQL; overriding just a URL is incomplete.

The environment example's host port 3306 differs from development Compose's published 3307. A host JVM would need the reviewed host endpoint, while a backend container on the same Compose network would use the MySQL service endpoint/container port. No backend container is currently defined. A port mismatch may target another local MySQL installation; verify identity before allowing writes.

The MySQL root credential and backend example values are not a least-privilege application-account plan. Tracked templates also contain credential-like values and application.properties contains a non-DB credential fallback. Their live use is unverified. Review and, if active, arrange authorized rotation; no values are reproduced or changed here. Connection-template flags disabling TLS, enabling public-key retrieval and opportunistic database creation need environment-specific review rather than production reuse.

## 2. Development, test and production persistence risks

### Storage and shutdown risks

- H2 in-memory content is process-lifetime data, unsuitable as a durable learning-evidence store. The explicit create-drop schema policy is an additional risk, including when moved to a persistent engine. Spring documents Hibernate's schema modes and cautions about switching database types: [database initialization](https://docs.spring.io/spring-boot/3.3/how-to/data-initialization.html).
- A persistent MySQL volume does not prevent Hibernate from recreating or dropping application tables. Changing only storage or selecting a profile name does not establish safe behavior.
- A currently running create-drop process can still perform its configured shutdown drop even after files for the next startup are edited. Any future approved stop/reconfiguration must follow appropriate backup/export and write-freeze procedures first. Nothing was stopped here.
- H2 file mode would retain a file, but does not solve destructive DDL, startup overwrites, backups or target-engine compatibility. It is not a substitute for durable-environment readiness.
- mysql_data is declared as a project-managed named volume, not a verified backup. Changing Compose project identity can select a different volume; removing it destroys stored data. GUIDE explicitly documents a volume-removing reset action. No such command was run.
- The dev Compose host port is not restricted to localhost in its declaration, and credentials are literal. Actual exposure is not established; restrict access through an approved deployment/network plan.

### Startup writers: all currently ungated

None of these CommandLineRunner components has a Profile or ConditionalOnProperty gate in the inspected source. Ordering coordinates one startup, not multiple replicas or a schema-versioned deployment.

| Initializer | Observed behavior | Persistence/readiness consequence |
| --- | --- | --- |
| PermissionInitializer, order 1 | Generates missing CRUD permission rows from entity annotations | Reference-data writes occur on startup. Existence checks are not a checksummed migration history or cross-instance migration lock. |
| RoleDataInitializer, order 2 | Creates missing built-in roles; applies access mappings transactionally once, keyed by LEARNING_SELF_READ permission presence; preserves existing built-in metadata/mappings on subsequent ordinary runs | This is an application data migration convention, not a schema migration framework. Review marker state and custom mappings; do not claim it resets all built-in roles on every restart. Multi-instance execution still needs review. |
| UserDataInitializer, order 3 | Creates seeded accounts; fills missing password/name/profile fields; always sets these accounts active; merges ADMIN for the admin seed; clears/replaces seeded STUDENT/TEACHER roles; deactivates a designated legacy account | Startup can reactivate disabled accounts, re-add an administrative assignment, discard customized/dual-role assignments on seeded learner/teacher accounts, or deactivate an account. Existing nonblank passwords are not generally reset. Must be isolated before retained-data rollout. |
| AutoMenuInitializer, order 10 | Rewrites menu group/title/URL/icon/order/permission/description and reactivates modules from annotations; creates absent groups | Administrative metadata/customization can be overwritten or reactivated after restart even if schema is stable. |
| StudentScoreDataInitializer, order 11 | Upserts sample grade rows by studentCode; overwrites name, class, scores, overall score and active flag | Manual edits to those rows are overwritten at startup. Never treat sample scores as earned learning evidence or migrate them automatically into progress. |
| QuestionDataInitializer, no explicit order | Inserts sample questions/options when question count is zero | A deliberately empty retained database can receive demo content. Count-first logic is not coordinated cross-instance initialization. |

EnableScheduling is present. TokenCleanupJob deletes expired/revoked refresh tokens and expired/used one-time tokens on its schedule. This is intended token maintenance, not learning-record cleanup, but it is another writer to account for in isolated tests/rehearsals. No scheduler or writer was executed by this audit. TopicMarkDemoService history remains in memory; backups of StudentScore values cannot recover that missing history.

### Test and deployment risks

- Full-context tests lack explicit isolation safeguards. External CI/IDE DataSource overrides could make them run against a retained database. Test setup is not universally rolled back; InvitationIntegrationTest calls deleteAll on real repositories. Do not run the full suite against an unknown/shared target.
- H2 tests cannot establish MySQL collation, identity, timestamp, index, locking or DDL behavior. A migration/persistence suite must use the approved target engine in a dedicated disposable database.
- Empty production deployment files and absent backup/restore evidence mean production readiness cannot be asserted. An external deployment may be safe or unsafe; neither is established here.

## 3. Existing migration capabilities and schema assumptions

### Capabilities found

- Hibernate-generated schema from JPA mappings, explicitly create-drop in the default configuration.
- Programmatic startup creation/updating of reference/demo data, including the role access marker above.
- MySQL Connector/J and H2 runtime dependencies, Spring Data JPA and JDBC infrastructure through Spring Boot.

### Capabilities not found in the repository

- Flyway/Liquibase dependencies or plugins, versioned migration directories/changelogs, database baselines, checksummed migration history configuration or an audited migration deployment job.
- schema.sql, data.sql, import.sql or executable migration SQL files. An init.sql mount appears only in an old commented Compose fragment; no actual script was found.
- Independent production/test database profiles, restart-durability tests, a database restore rehearsal or rollback runbook.

These absences describe repository evidence, not proof that an external database has no migration-history table. That requires later authorized read-only metadata inspection.

The parent is Spring Boot 3.3.3. Its locally cached BOM declares Hibernate 6.5.2.Final, H2 2.2.224, MySQL driver 8.3.0 and Flyway 10.10.0. These are dependency-management declarations, not a resolved/deployed dependency inventory. Flyway is not presently a direct application dependency merely because a managed version exists.

### Schema assumptions to validate before a baseline

- BaseEntity uses generated Long identity, isActive and audit fields; timestamps mix LocalDateTime in domain/audit records with Instant in authentication fields. Confirm actual DB column types, precision and timezone handling rather than guessing conversions.
- CourseEnrollment requires User/Course FKs and unique(user_id,course_id). Cancellation physically deletes enrollments today; future evidence references require retention policy first.
- Lesson requires Course, declares unique(course_id,title), and validates order uniqueness only in service code. Audit duplicate order positions before any new constraint.
- Exam/Question use join-table relationships; Question options cascade with orphan removal. Published evidence will require retained definitions/snapshots before authoring deletion is safe.
- User/Role/Permission join tables, invitation unique(exam,user), StudentScore element collections/decimal precision and navigation groups are part of the existing schema, not new learning tables to recreate independently.
- String collation/case uniqueness, reserved identifiers, signed identity/FK types, actual indexes, nullability, storage engine and database character set need target metadata verification. JPA annotations and successful H2 startup are not a production schema inventory.

## 4. Recommended persistence and migration strategy

The following are proposals requiring approval, not configuration changes performed by this audit.

### Separate environment responsibilities

| Proposed environment | Persistence/schema policy | Startup writers and isolation |
| --- | --- | --- |
| Explicit disposable demo | H2 in-memory; destructive schema recreation permitted only for clearly disposable data | Demo seeders opt-in; never an implicit production fallback. |
| Fast isolated unit/slice tests | Mocks where possible; dedicated ephemeral H2 only when needed | No external/shared DataSource; no uncontrolled full application bootstrap. |
| Database integration/CI tests | Dedicated disposable MySQL matching the approved target version; run real migrations and validate mappings | Explicit test profile/target allowlist, isolated credentials/schema, controlled fixtures and scheduled-job isolation. Never infer safety solely from a profile label. |
| Retained local development/staging | Durable MySQL instance/volume and migration-owned schema; Hibernate validate | Demo overwrite seeders off; persistent-volume identity and credentials reviewed. |
| Production | Approved durable service/storage; migration-owned schema; Hibernate validate | Dedicated least-privilege runtime account, separate migrator, no demo reset writers, backups/restore evidence and environment identity checks. Actual deployment still unknown. |

Keep durable environments from silently falling back to embedded H2. Future approved production configuration should require an explicit endpoint/credentials, a matching or correctly inferred driver/dialect, a non-destructive DDL policy and restricted diagnostic access. H2 console should not be enabled in production.

### One authoritative migration mechanism

Recommend Flyway as the single migration authority, subject to approval. It fits this existing Spring Boot/JPA application and versioned SQL workflow without adding another application architecture. Check the project's managed versions and required MySQL support module before dependency selection; Boot 3.3 documents flyway-core and database-specific flyway-mysql support: [Spring Boot 3.3 initialization guidance](https://docs.spring.io/spring-boot/3.3/how-to/data-initialization.html). Do not mix instructions for a different Boot major version into this project.

- Maintain ordered, reviewed, immutable migration versions and checksum validation. Do not edit already-applied versions to conceal drift.
- Keep automatic baseline-on-migrate and destructive clean disabled for retained environments. A baseline is a reviewed statement about a verified schema, not a way to skip unknown differences.
- Use Hibernate validate after migrations; validation detects mapping mismatches but is not a complete check of all indexes, business invariants or retained data.
- Do not use Hibernate update as a migration/rollback strategy, or combine automatic Hibernate creation, basic SQL initialization and migrations as competing schema authorities. Review script initialization mode explicitly.
- Prefer one authorized deployment migration job with DDL credentials; the runtime process uses DML-only permissions and validates the result. If startup migration is selected instead, approve credential exposure, ordering and multi-instance behavior explicitly. Initializers must not race the chosen mechanism.
- Move required reference-data evolution into reviewed, idempotent versioned data migrations. Separate it from opt-in demo bootstrap. Retain deliberate permission/menu semantics; do not simply remove bootstrap and discover missing access data after rollout.

### Adopt the existing schema safely before learning changes

For an empty approved database, create a reviewed initial migration for the existing application schema, not the proposed learning-progress tables. Build and inspect it against disposable target-engine databases.

For an existing nonempty database, obtain authorized schema metadata and compare it to the intended baseline: columns, constraints, indexes, engines, collations and row integrity. Reconcile drift with a separately approved plan; only then explicitly record an appropriate baseline. Do not mark an arbitrary unknown schema as current, regenerate it from entities over live data, or assume every environment has the same schema because the code is the same.

Use expand-and-contract for later approved changes: additive nullable/default-safe fields first; verified backfill only where facts exist; constraints after validation; removal/renaming only after backward-compatible deployment and evidence-retention review. Future learning tables remain gated on architecture approval. No migrations are written in this audit.

## 5. Backup and rollback prerequisites

Before any approved change or restart of a process that might use destructive DDL:

1. Identify the actual target: engine/version, server/service identity, schema, active profiles, sanitized effective JDBC target, configuration origins and deployed artifact revision. Confirm which database the process is already connected to using authorized read-only evidence later; do not start another instance to discover it.
2. Establish an accountable operator, write-freeze/maintenance plan, recovery-point and recovery-time targets, retention and restoration destination. Capture current code/configuration versions without placing secret values in reports.
3. Take an engine-consistent backup of existing schema/data and relevant users/grants; include triggers/routines/events where applicable and record migration-history state if present. Verify row counts/relationships and integrity manifests through authorized methods. A running-volume file copy alone is not proof of a consistent database backup.
4. For MySQL, coordinate logical/physical backup consistency with storage engines and concurrent DDL; retain binary logs/positions if the recovery plan requires point-in-time restoration. Use the approved service tooling: [MySQL 8.0 backup and recovery](https://dev.mysql.com/doc/refman/8.0/en/backup-and-recovery.html).
5. Restore into a separate isolated database and demonstrate schema/data/relationship integrity and usable access. A successful backup command without a restore test is insufficient. Protect backup encryption, access and secrets independently.
6. If the only existing data is in a live in-memory H2 instance, an authorized consistent export must precede shutdown. Changing the next startup to MySQL does not transfer that data. If the process has already exited, do not reconstruct alleged historical achievements from seeds.

Distinguish **application rollback**, **schema recovery**, and **data recovery**. An older binary may run on an additive compatible schema without reverting it. After real learning writes begin, a destructive down-migration could erase evidence; preserve data and prefer a reviewed forward fix. Restoring an old snapshot can lose newer writes, so coordinate write stopping and replay/point-in-time recovery with the approved recovery target.

Do not assume a failed migration is fully undone by a transaction. MySQL documents implicit commits for many DDL statements: [MySQL 8.0 implicit commits](https://dev.mysql.com/doc/refman/8.0/en/implicit-commit.html). Rehearse partial failure and recovery on the actual target engine. Do not use clean, drop, truncation, migration-history editing or volume deletion as rollback shortcuts.

## 6. Safe implementation order

All execution below is a future plan, not work authorized or performed during this audit.

1. **Review this report and approve scope.** Obtain actual deployment/runtime evidence and identify the authoritative database and operator. Resolve whether retained data currently exists.
2. **Protect existing data before stopping/repointing anything.** Agree on maintenance, backup/export, restore rehearsal, rollback and credential handling. Preserve a live in-memory source before a shutdown could destroy it.
3. **Approve environment separation and writer isolation.** Define disposable demo/test, retained development/staging and production configurations; gate sample writers; separate reviewed reference-data migrations; isolate destructive test setup. Missing durable configuration must fail safely instead of using H2.
4. **Approve one migration tool and credentials.** Pin compatible dependencies after review, designate the migration executor and keep runtime schema creation disabled on retained targets. No progress tables at this stage.
5. **Baseline existing schema on an isolated copy first.** Inventory/reconcile actual schema differences and data quality. Verify generated SQL and constraints against the chosen DB, then obtain approval before adoption on any retained environment.
6. **Prove persistence of existing application records.** With approved fixture use or suitable pre-existing records, verify graceful restart, repeated startup, container recreation with the same volume and restore. Ensure initializers do not modify users/roles/grades unexpectedly.
7. **Sign off persistence/migration readiness with evidence.** Record effective configuration, schema-history/checksum validation, volume/service identity, backup/restore results and application compatibility. No production-ready claim without deployment evidence.
8. **Return to learning architecture approval.** Only after both design and persistence prerequisites are approved may learning entities, new tables or APIs be implemented incrementally. Durable storage alone does not approve the proposed learning schema.

## 7. Configuration and operational changes requiring approval

No item below has been applied.

| Approval item | Proposed direction | Evidence/decision required before execution |
| --- | --- | --- |
| Target database and storage | Durable MySQL or another explicitly approved target; retained environment cannot fall back to H2 memory | Actual engine/version, environment owner, schema identity, storage lifecycle and existing-data inventory. MySQL is a repository-aligned candidate, not a proven production choice. |
| Profile/configuration contract | Explicit disposable demo/test and retained dev/staging/prod profiles; map standard DataSource properties or approved custom placeholders | Review profile activation and property origins, including CLI/system/env/external config. Do not silently load a newly discovered env file. |
| DDL behavior | Retained environments: spring.jpa.hibernate.ddl-auto=validate after controlled migration | Approved existing-schema baseline and fail-safe startup sequence; no automatic create/create-drop/update on retained data. A running legacy process's shutdown behavior also needs review. |
| DataSource details | Review URL, credentials, driver/dialect together; remove production reliance on template auto-create/TLS-relaxing flags | Correct host/service and port; application/migrator privileges; database provisioning, TLS and secret distribution. |
| Migration tooling/executor | Proposed Flyway, compatible pinned support modules, reviewed locations, separate authorized migrator | Dependency/configuration change approval; baseline strategy, checksums, migration locking, failure recovery and runner identity. |
| Startup reference/demo data | Gate demo users/grades/questions; replace uncontrolled reference rewrites with approved idempotent migrations or non-overwriting bootstrap | Preserve required RBAC/menu data and intentional existing customizations; approve treatment of seeded accounts and legacy-account deactivation. No production behavior change by inference. |
| Test safety | Explicit disposable DB/profile and target allowlist; controlled fixtures and scheduled-job isolation | CI/IDE configuration review; proof destructive repository setup cannot point to retained/shared databases. |
| Container/deployment configuration | Supply real deployment definitions if this is the intended deployment mechanism; pin image/storage/network identity | Approve persistent volume lifecycle, restricted published ports, service credentials and backup ownership. Current production files are empty. |
| Secret/diagnostic handling | Remove reliance on tracked credential defaults; authorize rotation if values are live; disable production H2 console | Secret owner/provider coordination and verification that diagnostic endpoints/logs do not leak connection credentials. No rotations or security-setting changes performed here. |
| Backup, restart and rollback rehearsal | Isolated restored database, reviewed write-freeze and recovery targets | Explicit operator authorization for any shutdown/restart, export, fixture creation, migration or restore. These are outside this audit's read-only execution scope. |
| Learning schema | Still pending architecture review | Persistence readiness approval does not authorize learning entities/tables/APIs or new evidence writes. |

Suggested profile/gating property names not already present would be implementation work, not switches that can simply be assumed to exist today. All application/configuration edits remain pending approval.

## 8. Verification steps for persistence across restarts

**Plan only: none of these database/service operations was executed.** Use an approved isolated retained database or a restored copy, never an unknown environment. No new learning tables are needed to prove persistence of existing application data.

### A. Preflight safety gates

1. Obtain sanitized runtime evidence from the deployed process/platform: active profiles, effective property origins, JDBC server/schema/driver/dialect, DDL mode, initialization/migration settings and process/artifact identity. Inspect existing metadata with authorized read-only access. Do not expose passwords through logs or diagnostic dumps.
2. Confirm the intended DB/schema is allowlisted, durable storage identity is stable, runtime lacks schema-destructive privileges where practicable, seed overwrites are disabled/gated through approved changes, and migration history/baseline is valid. Confirm a restore-tested backup and approved restart scope.
3. If old create-drop behavior or unknown target settings remain, stop the verification plan before any process stop/start. Do not use a restart as the method of discovering whether data survives.

### B. Establish a meaningful pre-restart baseline

4. Select approved existing stable records not recreated by seeders and their relationships: for example, a real enrollment with its user/course/lessons, role assignments and representative retained grade/invitation records. Record IDs, creation/audit timestamps, row counts, FK relationships and protected integrity digests without exporting personal data into this report.
5. Do not rely on default demo names or a successful login as proof: initializers can recreate similar rows after data loss. If no suitable records exist, fixture creation needs separate explicit authorization in the disposable rehearsal environment; no records were created for this audit.
6. Freeze relevant writes or define allowed changes during measurement. Account for legitimate authentication/token maintenance separately; unexpected changes to roles, grade values or stable business-record timestamps must fail the test.

### C. Restart and re-deployment checks

7. Perform only the separately approved graceful application restart against the same identified durable DB. Verify no create/drop SQL, unapproved seed write or schema reset occurs. Recheck the exact IDs/digests/relationships and role/grade values.
8. Repeat startup a second time. Verify applied migrations are not reapplied, checksums/history stay valid, custom permissions remain and no startup writer rewrites retained records. This detects semantically destructive 'upserts' that row counts alone miss.
9. In the approved rehearsal environment, restart the database service and recreate its container using the same storage identity without deleting volumes. Repeat integrity checks. This is distinct from merely restarting the JVM. Do not use the documented volume-reset action.
10. Deploy the compatible application artifact again and verify schema validation and access behavior. Rehearse an additive schema upgrade only after its separate migration approval; no learning-schema changes are authorized by this plan.

### D. Recovery and failure checks

11. Restore the captured backup into another isolated database. Verify schema, records, FK integrity, IDs, migration history and application compatibility; measure actual recovery time and explain any data gap against the agreed recovery point.
12. On separately approved disposable copies, verify rejection of missing durable configuration, wrong target/profile, schema drift and migration checksum mismatch. Rehearse partial migration failure/forward repair on the target engine; no destructive clean/history tampering. Crash/power-loss testing requires separate operational scope.
13. Later, after learning architecture and migrations are approved, extend the same proof to real lesson evidence, attempts, grade revisions and completion events. Do not create those tables or fabricate achievements for this readiness audit.

### Required evidence and sign-off

Record sanitized before/after target identity/configuration, schema-history validation, storage/volume identity, stable record digests and FK checks, startup writer behavior, restart/recreation results, backup/restore outcomes and operator approval. Pass requires continuity of the original records and absence of unapproved rewrites, not just a healthy endpoint or a newly recreated schema.

Current result: repository audit completed; runtime configuration, durable-volume existence, actual schema/privileges, backup/restore and restart durability remain unverified. Production readiness is NOT established. Only this requested report was written; execution stops for review and approval.

## Evidence index

Local source references below identify inspected files. They do not establish deployed configuration. Empty deployment files have no line references.

- [Default H2 DataSource](D:/FPT_OJT/HCM26_CPL_JAVA_10_user-profile-update/backend/src/main/resources/application.properties:6)
- [Explicit schema destruction policy](D:/FPT_OJT/HCM26_CPL_JAVA_10_user-profile-update/backend/src/main/resources/application.properties:12)
- [Backend environment template](D:/FPT_OJT/HCM26_CPL_JAVA_10_user-profile-update/backend/backend.env.example:1)
- [Development MySQL declaration](D:/FPT_OJT/HCM26_CPL_JAVA_10_user-profile-update/docker/dev-env.yml:5)
- [Development host/container ports](D:/FPT_OJT/HCM26_CPL_JAVA_10_user-profile-update/docker/dev-env.yml:41)
- [Development data volume](D:/FPT_OJT/HCM26_CPL_JAVA_10_user-profile-update/docker/dev-env.yml:15)
- [Docker guide/reset warning](D:/FPT_OJT/HCM26_CPL_JAVA_10_user-profile-update/docker/GUIDE.md:79)
- [Database drivers / build](D:/FPT_OJT/HCM26_CPL_JAVA_10_user-profile-update/backend/pom.xml:79)
- [Full-context default test](D:/FPT_OJT/HCM26_CPL_JAVA_10_user-profile-update/backend/src/test/java/com/example/starter_project_2025/StarterProject2025ApplicationTests.java:6)
- [Destructive invitation test setup](D:/FPT_OJT/HCM26_CPL_JAVA_10_user-profile-update/backend/src/test/java/com/example/starter_project_2025/system/invitation/InvitationIntegrationTest.java:88)
- [Role access marker](D:/FPT_OJT/HCM26_CPL_JAVA_10_user-profile-update/backend/src/main/java/com/example/starter_project_2025/init/RoleDataInitializer.java:42)
- [Seeded-user reactivation](D:/FPT_OJT/HCM26_CPL_JAVA_10_user-profile-update/backend/src/main/java/com/example/starter_project_2025/init/UserDataInitializer.java:110)
- [Sample grade overwrite](D:/FPT_OJT/HCM26_CPL_JAVA_10_user-profile-update/backend/src/main/java/com/example/starter_project_2025/init/StudentScoreDataInitializer.java:74)
- [Menu reactivation](D:/FPT_OJT/HCM26_CPL_JAVA_10_user-profile-update/backend/src/main/java/com/example/starter_project_2025/init/AutoMenuInitializer.java:74)
- [Question samples on empty table](D:/FPT_OJT/HCM26_CPL_JAVA_10_user-profile-update/backend/src/main/java/com/example/starter_project_2025/system/question/init/QuestionDataInitializer.java:18)
- [Scheduled token cleanup](D:/FPT_OJT/HCM26_CPL_JAVA_10_user-profile-update/backend/src/main/java/com/example/starter_project_2025/system/auth/token/TokenCleanupJob.java:25)
- [Enrollment hard deletion](D:/FPT_OJT/HCM26_CPL_JAVA_10_user-profile-update/backend/src/main/java/com/example/starter_project_2025/system/demo/enrollment/CourseEnrollmentService.java:59)
- [Base identity/audit fields](D:/FPT_OJT/HCM26_CPL_JAVA_10_user-profile-update/backend/src/main/java/com/example/starter_project_2025/base/crud/domain/BaseEntity.java:21)
- [Question-option deletion cascade](D:/FPT_OJT/HCM26_CPL_JAVA_10_user-profile-update/backend/src/main/java/com/example/starter_project_2025/system/question/domain/Question.java:46)
- [Direct repository import](D:/FPT_OJT/HCM26_CPL_JAVA_10_user-profile-update/backend/src/main/java/com/example/starter_project_2025/base/dataio/importer/service/GenericImportService.java:51)
- [Empty deployment file: docker/Dockerfile](D:/FPT_OJT/HCM26_CPL_JAVA_10_user-profile-update/docker/Dockerfile)
- [Empty deployment file: docker/docker-compose.yml](D:/FPT_OJT/HCM26_CPL_JAVA_10_user-profile-update/docker/docker-compose.yml)

External references use official Spring Boot 3.3-series and MySQL 8.0 documentation. The project itself remains on Boot 3.3.3; no upgrade or dependency installation was performed.
