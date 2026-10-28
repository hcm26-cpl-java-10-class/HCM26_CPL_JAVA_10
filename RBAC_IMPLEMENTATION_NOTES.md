# RBAC implementation notes

This branch includes the RBAC task implementation changes in the existing project structure.

## Backend changes
- `Role.isSystem` is backend-managed and exposed read-only through `RoleDTO`.
- Built-in `ADMIN`, `STUDENT`, and `TEACHER` roles are marked as system roles by `RoleDataInitializer`.
- Role deletion returns HTTP 409 when the role is a system role or is assigned to users.
- Role responses include `userCount`.
- Added `GET /api/roles/{id}/permissions` and `PUT /api/roles/{id}/permissions`.
- Added `GET /api/permissions/matrix`, returning flat permission records with `id`, `name`, `resource`, and `action`.
- Added `APPROVE` to generated CRUD actions. Existing `READ` is shown as “View” in the UI.

## Frontend changes
- Role list schema includes read-only system-role and user-count columns.
- Added permission matrix API methods and a Role Permission Matrix page at `/role-permissions`.
- The Permission CRUD page includes a “Permission matrix” action for users with `ROLE_UPDATE`.
- Matrix permissions are grouped by resource and display View/Create/Update/Delete/Approve.
- Unknown non-admin roles no longer fall back to all permissions in frontend menu logic.

## Run and verify
1. Run the backend with the project's usual environment/database configuration.
2. Run the frontend with `npm install` (if dependencies are not installed) and `npm run dev`.
3. Sign in with an account that has `ROLE_READ`, `ROLE_UPDATE`, and `PERMISSION_READ` to test the matrix.
4. Verify deletion of `ADMIN`, `STUDENT`, `TEACHER` returns HTTP 409, and deletion of a role assigned to a user also returns HTTP 409.
5. Verify the database schema contains `roles.is_system`. For existing databases, apply a database migration adding `is_system BOOLEAN NOT NULL DEFAULT FALSE` before starting if Hibernate schema update is not enabled; built-in roles are marked system by the initializer.

Build verification could not be completed in this environment because the Maven wrapper could not download Maven from Maven Central. Please run the project's backend compile and frontend build locally to catch environment-specific issues.

## System-role toggle (admin-only)
- Added `PATCH /api/roles/{id}/system-role?isSystem=true|false` for changing a custom role's system flag.
- The service enforces `ROLE_UPDATE` using the project's existing authority checker; requests without that authority are rejected by the backend.
- `ADMIN`, `STUDENT`, and `TEACHER` are protected: their system flag cannot be changed and their names cannot be changed. Their switches are disabled in the table/card UI as well.
- `isSystem` remains read-only in normal Role CRUD DTO mapping, so clients cannot bypass the dedicated endpoint by submitting it in a normal create/update request.
- Any role currently marked as a system role remains protected from deletion by the existing `beforeDelete` guard. Custom roles can be toggled back to `false` if an authorized user intentionally needs to make them deletable (provided they are not assigned to users).
- The Role table switch uses `roleApi.setSystemRole`; it refreshes the table after the server responds and shows an error if the backend rejects the change.

Example request:
```http
PATCH /api/roles/4/system-role?isSystem=true
```
The logged-in user must have `ROLE_UPDATE`. The built-in roles above return HTTP 409 if a status change is attempted.
