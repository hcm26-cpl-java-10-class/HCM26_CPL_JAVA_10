# Trainer permission and menu approval

Status: **PENDING APPROVAL**. Internal Trainer ownership was approved earlier; no role grants or menu database writes have been approved or applied. This document does not authorize cutover.

## Exact endpoint contract

- `TRAINER_READ`: GET `/api/trainers`, `/api/trainers/{id}`, `/api/trainers/teaching-topics`.
- `TRAINER_CREATE`: POST `/api/trainers`, GET `/api/trainers/import/template`, POST `/api/trainers/import/preview`, POST `/api/trainers/import`.
- `TRAINER_UPDATE`: PUT `/api/trainers/{id}`, PATCH `/api/trainers/{id}/status`.
- `TRAINER_DELETE`: DELETE `/api/trainers/{id}`. This archives an unreferenced identity; references from Class or INTERNAL Teaching Assignment cause conflict.
- Existing `CLASS_READ` **or** `TRAINER_READ`: GET `/api/trainers/data-source` and `/api/trainers/options`. Options use the INTERNAL directory, ACTIVE status and non-archived records. No management permission is needed merely to select a Trainer where the account already has CLASS_READ.

The UI needs TRAINER_READ together with CREATE or UPDATE because it reads the list/details and teaching-topic options. Dynamic sidebar retrieval also requires the existing MENU_READ permission. No additional permission is to be granted just to hide a 403.

## Minimal approval proposal

Propose the existing ADMIN role receives **TRAINER_READ, TRAINER_CREATE, TRAINER_UPDATE**. Propose **TRAINER_DELETE separately as optional**, since Activate/Deactivate already uses UPDATE. This is a proposal, not an approved grant.

Keep STUDENT, TEACHER, PROGRAM_MANAGER, MENTOR and CLASS_ADMIN unchanged unless the owner explicitly identifies a directory management responsibility and approves a separate exact permission set. Existing Class permissions remain unchanged. In particular TRAINING_CLASS_READ is a different authority from CLASS_READ; do not convert it or add CLASS_READ as part of this deployment.

The [role proposal SQL](trainer-role-grants-proposal.sql) executes only SELECTs. Its additive/idempotent grant statements are inside a comment and require approval before being extracted. It does not create roles, modify users, replace permission sets, or grant all permissions.

Existing frontend convention treats the ADMIN view as authorized for display. Backend endpoint checks still require exact authorities. Therefore visible buttons are not evidence of effective permission; without an approved grant the backend correctly returns 403. No global RBAC behavior is changed here.

## Menu contract and targeted proposal

Source metadata in `Trainer.java` and the frontend registry agree on:

- Parent: active **Training Management** group.
- Title: **Trainers**; path: **/trainers**; icon: **users**; order: **7**.
- Required permission: **TRAINER_READ**; module active: **true**.
- Frontend component: `TrainerManagementPage`; static route also requires TRAINER_READ.

The sidebar reads module/group rows from the API and filters by permission. Trainer is not a hidden or relocated menu for any role. Registering the row adds one entry and does not edit the five existing Training Management entries.

`safe-deployment` intentionally disables AutoMenuInitializer. Do not re-enable it to register this row: it synchronizes unrelated menus. The [targeted proposed menu SQL](menu-trainers-proposed.sql) inserts only the missing /trainers row into one existing active Training Management group. It neither creates a group nor overwrites an existing menu. It must be approved before execution; conflicting metadata must be reviewed separately.

## Fresh baseline inspection

Revalidated on 2026-11-12 against the new cold backup restored into `.run/td/final-precutover/2026-11-12/baseline`: all 177 original table fingerprints match the earlier baseline. The roles, catalog and menu observations below remain valid. Neither a menu INSERT nor a role grant was executed. See [FINAL_PRE_CUTOVER.md](FINAL_PRE_CUTOVER.md).

Rechecked the fresh engine-consistent backup taken on **2026-11-11 at 16:55 Asia/Saigon**, restored to workspace-root `.run/td/final-precutover/baseline`. Every connection used IFEXISTS=TRUE and ACCESS_MODE_DATA=r. The following observations match the earlier restored r2 role/menu baseline.

Active role IDs are 1 ADMIN, 2 STUDENT, 3 TEACHER, 4 PROGRAM_MANAGER, 5 MENTOR, 6 CLASS_ADMIN. Training Management is active group 13. It contains five existing menu rows and no /trainers row. IDs are observational only; scripts resolve exact names and do not hard-code IDs.

The existing five entries are Training Calendar `/calendar/adjust` (id 37, order 1), Weekly Timetable `/calendar/preview` (id 39, order 2), Class List `/classes` (id 38, order 3), Topics & Syllabus `/subjects` (id 40, order 3), and Training Programs `/programs` (id 41, order 4). The proposed script leaves all five unchanged.

Only ADMIN has CLASS_READ. ADMIN, STUDENT, TEACHER and PROGRAM_MANAGER have MENU_READ. CLASS_ADMIN, MENTOR and PROGRAM_MANAGER have legacy TRAINING_CLASS_READ. No role has any TRAINER_* grant. The fresh baseline has **zero TRAINER_* catalog entries**; the approved catalog migration must register the four names before separately approved grants. The four catalog entries on migrated r2 were an expected migration result, not a live change or role grant.

The fresh database metadata confirms MODULES.ID is generated identity; created_at/updated_at/is_active/title/display_order/module_group_id are non-null; created_by/updated_by are nullable. ROLE_PERMISSIONS contains role_id/permission_id. The proposed statements match these existing columns. A read-only projection of the menu INSERT selects exactly one proposed row, resolving group 13 and the approved source metadata.

Fresh-restore verification is also reported in the final pre-cutover evidence. Neither the proposed menu INSERT nor any role grant has been applied, including on the restored rehearsal database.

## Required approval record

Before cutover, approve the exact target role names and permission names, whether ADMIN archive authority is allowed, and the single Trainers menu entry. Trainer source approval remains distinct from maintenance/cutover and RBAC approval. If grants are approved, require sign-in again after the change so the JWT contains the new authorities; retain before/after role_permissions evidence.
