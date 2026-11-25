# Trainer Management

The user explicitly approved the internal directory as the authoritative source for Class and Teaching Assignment in this implementation session (2026-11-11). Previous documentation describes the external-only implementation; this feature supersedes that restriction only for explicit new internal selections. No Trainer records are seeded.

## Identity and ownership

- `trainers.id` is a stable internal identity. `trainerCode` (Excel column `Trainer ID*`) is a unique business code, not the database ID. Emails and codes are normalized and protected by database unique constraints, including archived records.
- `training_operation_classes.master_trainer_id` is nullable. Null retains legacy text/external identity; existing rows are not backfilled or rewritten by name.
- `teaching_assignments.trainer_source` is nullable on legacy rows (interpreted as EXTERNAL). New internal assignments explicitly send `trainerSource=INTERNAL` and retain the internal ID. Equal numbers across sources do not establish identity.
- Class keeps the existing `masterTrainer` string for compatibility and also saves `masterTrainerId` after explicit selection. The server verifies ACTIVE status and the matching name when a new internal selection is saved. Unchanged saved inactive identities can be retained on edits; new assignments still require ACTIVE status and eligible topics.
- Legacy text-only Class API/import payloads remain compatible; they do not constitute verified internal identities or internal readiness evidence. Switching requires an explicit selection in Class Info, then an explicit assignment save.
- Study Session and `/api/external/**` keep their existing source and sample checks. No provenance flag or header is changed to legitimize mock data.

## API and permissions

All routes start with `/api/trainers`. GET list/detail and `/teaching-topics` require TRAINER_READ. POST requires TRAINER_CREATE; PUT and PATCH `/{id}/status` require TRAINER_UPDATE; DELETE requires TRAINER_DELETE. DELETE archives and rejects references from internal Class/Teaching Assignment; no hard deletion is offered. Status uses ACTIVE/INACTIVE.

List supports `search`, `status=active|inactive|all`, `page` (zero-based), `size` (1–100), returning a Spring Page. Search covers code, name, email and specialization. DTO fields: id, trainerCode, fullName, email, specialization, status, teachingTopics (existing Subject ID/code/name/version/active), source=INTERNAL. Create/update bodies use teachingTopicIds. Versioned existing Subject records are reused; no topic is created by Trainer Management.

`GET /options` returns paginated ACTIVE options and `GET /data-source` returns `{source:"INTERNAL",approved:true,sampleData:false}` for this persisted, approved internal catalog only. These endpoints require TRAINER_READ or CLASS_READ. Class and Class Setup verify this source; they never fall back to the external sample catalog.

`GET /import/template`, `POST /import/preview`, `POST /import` require TRAINER_CREATE. Uploads use multipart field `file`; .xlsx/.xls, <=5 MB, <=500 rows, one sheet. The template contains headers only:

`Trainer ID*`, `Full Name*`, `Work Email*`, `Specialization`, `Teaching Topics`, `Status`.

Teaching Topics use `CODE@version;OTHER_CODE@version` and must uniquely resolve to existing ACTIVE topics. Blank Status defaults to ACTIVE. Formula cells, incorrect headers, duplicate codes/emails (including case variants), invalid statuses/emails, unknown/inactive topics and empty files are rejected. Preview identifies row numbers and all row errors. Commit re-reads and revalidates the uploaded file against the current database in one transaction. Any invalid row or database uniqueness conflict rolls back the entire batch. This is independent of Trainee Import.

## UI and rollout

For an existing database, follow the reviewed [safe cutover plan](deployment/trainer/FINAL_PRE_CUTOVER.md) and [rollback plan](deployment/trainer/ROLLBACK_PLAN.md). Use `safe-deployment`, `ddl-auto=validate`, startup mutations disabled and scheduling paused. Apply only the three reviewed schema/catalog scripts and the separately approved targeted menu/grants after a verified restore rehearsal; do not run broad permission, role or menu initializers. The approved management grants are ADMIN-only TRAINER_READ, TRAINER_CREATE and TRAINER_UPDATE. TRAINER_DELETE and grants to all other roles remain unapproved. Fresh sign-in is required after an approved authority change.

Trainer deployment currently remains BLOCKED after rollback because no valid SMTP App Password is available. Publishing this source does not authorize a backend restart or database cutover. The active recovery database is the source of truth; see the [deployment result](deployment/trainer/DEPLOYMENT_RESULT_2026-11-12.md) and [SMTP report](deployment/smtp/SMTP_HEALTH_REPORT_2026-11-12.md). Once deployment is safely accepted, open `/trainers`, Add Trainer, select existing Teaching Topics, then Save. Archive still requires separate DELETE authority.

For Excel, choose Import Trainers, download the blank template, fill real records, upload and review the server preview. Import All Trainers is enabled only when every row is valid. Server validation still runs at commit time.

Class Add/Edit selects ACTIVE internal trainers by ID and preserves the existing saved option, including legacy or inactive selections. For a legacy class, explicitly select the approved internal trainer and save Class Info before creating an INTERNAL MAIN assignment. No ID mapping or historical Class data migration runs automatically.

Trainer schema changes are additive (trainers, trainer_teaching_topics, nullable master_trainer_id and trainer_source). Review database-specific DDL and the documented H2 text compatibility script on a fresh restore of the active database. Do not use automatic Hibernate schema update for this existing-data deployment. The development backend is deliberately not restarted or rebuilt in its watched target directory. Backend verification runs from a separate source copy with in-memory test databases. Until deployment, the running backend still has the old API and `/api/trainers` returns 404.

## Changed files

New backend package `backend/src/main/java/com/example/starter_project_2025/system/trainer/`:

- Trainer.java, TrainerStatus.java, TrainerRepository.java, TrainerDTO.java
- CreateTrainerRequest.java, UpdateTrainerRequest.java, TrainerMapper.java
- TrainerService.java, TrainerServiceImpl.java, TrainerController.java, TrainerImportService.java

New backend test: `backend/src/test/java/com/example/starter_project_2025/system/trainer/TrainerManagementIntegrationTest.java`.

New frontend files:

- `frontend/src/api/features/trainer.api.ts`
- `frontend/src/api/trainer.api.test.ts`
- `frontend/src/pages/management/training/trainer/TrainerManagementPage.tsx`
- `frontend/src/pages/management/training/trainer/TrainerForm.tsx`
- `frontend/src/pages/management/training/trainer/TrainerImportModal.tsx`
- `frontend/src/pages/management/training/trainer/TrainerManagementPage.test.tsx`

Modified backend integration files (relative to `backend/src/main/java/com/example/starter_project_2025/system/`):

- `training/entity/TrainingClass.java`, `training/TrainingClassDTO.java`, `training/TrainingClassService.java`
- `training/ClassSetupService.java`, `training/ClassReadinessService.java` (internal trainer verification branch only)
- `trainingprogram/TeachingAssignment.java`, `trainingprogram/TeachingAssignmentRequest.java`, `trainingprogram/TeachingAssignmentResponse.java` (explicit trainer source only)

Modified frontend integration files (relative to `frontend/src/`):

- `api/features/class-setup.api.ts`, `api/features/cls.api.ts`, `types/features/external.ts`
- `pages/management/training/class/components/ClassModal.tsx`, `ClassSetupForm.tsx`
- The corresponding `ClassModal.test.tsx`, `ClassSetupForm.test.tsx` and existing `ClassModal.master-trainer.test.tsx`
- `router/component-registry.ts`, `router/AppMenuRouting.test.tsx`

This document is new. The pre-existing `ExternalTrainerDirectoryContractTest` remains unchanged. The development database already appeared modified at the beginning of this task and has not been reset, restored, migrated or edited by the implementation workflow. No existing Class records were changed by tests or API writes.

## Verification

- Production build (`npm run build`, including `tsc -b`): PASS. Vite reports its existing large-chunk warning.
- Targeted frontend tests (Trainer page/import/API, Class form/Setup/list and application routing): 89/89 PASS.
- Full frontend run: 267/278 PASS. The 11 failures are the same previously observed failures in `ClassReadinessNavigation.test.tsx` (6) and `trainee-import.utils.test.ts` (5); those files and their feature implementations were not modified.
- Backend verification: 136/139 PASS; zero errors. All 8 Trainer integration tests, 17 Class Setup tests, 34 Class import/CRUD tests and 7 external source contract tests pass. New tests cover RBAC 401/403, duplicate identity, filtering, template/preview/atomic import, explicit internal selection, topic eligibility, source collisions, stable identity after rename and archive protection.
- Remaining backend failures: `SessionLifecycleIntegrationTest.importExport_AsStudent_Return403` and `ExternalApiControllerTest.calendars_RequireSessionReadAndReturnClassHistory` expect 403 but receive 200; `ClassReadinessIntegrationTest.missingEnrollmentAndSessionsAreNotReadyWithoutInventingData` expects zero sessions but sees 27. Calendar/Readiness failures were reproduced before this implementation. No Session implementation or RBAC configuration was changed.

The original-source Session comparison in `.run/sb` reproduced exactly the same result: 44/45 pass, `importExport_AsStudent_Return403` expects 403 but receives 200. This confirms that Session failure exists without the Trainer implementation.

Logs are under the workspace-root `.run/`: `trainer-build-final.log`, `trainer-frontend-verified.log`, `trainer-frontend-final-tests.log`, `trainer-backend-final-tests.log`, `trainer-setup-final.log`, and `trainer-session-baseline.log`. Backend test reports are in `.run/tm/target/surefire-reports`.
