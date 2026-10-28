# Account roles and learning access

## Audit and implementation plan

The application uses Spring Security, JWT authentication (including refresh and Google login),
`UserPrincipal`, and existing Role/Permission join tables. JWT requests reload user authorities
from the database. CRUD services already check resource permissions. No second RBAC model is needed.

Affected areas: `RoleDataInitializer`, authentication/refresh role-permission serialization,
`SecurityConfig`, enrollment/note/exam personal endpoints, `RoleSwitchContext`, route/menu guards,
Profile, My Learning, course catalog query cache, and User Detail.

Implementation sequence: extend existing permissions and migrate mappings; protect personal and
administrative endpoint boundaries; share Profile across views; constrain the existing switcher;
replace sample learning displays with one server-backed panel; verify authorization and UI behavior.

## Permission mapping

- `ADMIN_ACCESS`: administrative view; resource permissions still govern each operation.
- `LEARNER_ACCESS`: learner view, enrollment and exam participation.
- `LEARNING_SELF_READ`: personal learning records, together with learner access.
- `USER_READ`: existing global user-management read scope.
- `USER_LEARNING_READ`: inspect another user's learning, together with ADMIN_ACCESS and USER_READ.

ADMIN receives administrative access and inspection permission, without personal enrollment/exam
rights. STUDENT receives personal learning access. TEACHER retains its management permissions and
receives administrative view access. ADMIN + STUDENT supports both views. Role names and user-role
assignments remain unchanged. Custom roles with management mutations/user-read get administrative
view access; custom roles with existing enrollment-read get personal access. Inspection is not
automatically added to custom roles.

## Migration and rollout

The existing transactional startup initializer applies the access mapping once, using the new
LEARNING_SELF_READ permission as its marker. Back up role_permissions before rollout. Review custom
roles, particularly ones using read-only administrative permissions other than USER_READ; assign
ADMIN_ACCESS explicitly where appropriate. No enrollment or user data is changed. Subsequent starts
preserve customized mappings and role metadata rather than replacing every built-in role's permissions.

Admins who also learn need STUDENT or an explicit learning permission mapping. Existing browser
sessions should sign in again or refresh their authentication response to update cached navigation
permissions. Server authorization uses current database permissions immediately. Switching views
only changes presentation/local storage and never issues or replaces tokens.

## Endpoints and scope

- GET /api/learning/me: identity comes solely from UserPrincipal; no user ID parameter.
- Existing /api/enrollments/my-courses remains compatible and principal-scoped.
- Enrollment creation/cancellation retain existing ownership validation and additionally require learner access.
- GET /api/users/{userId}/learning: ADMIN_ACCESS + USER_READ + USER_LEARNING_READ,
  positive/existing target validation, and target-scoped enrollment query.

USER_READ is currently global; there is no existing department-specific user inspection policy.
A future restricted user-management scope must be applied to this endpoint too.

## Data and UI

CourseEnrollment persists only course, user and enrollment timestamp. No persisted course completion,
percentage, certificate, or learning-activity ledger was found. The API returns null for unsupported
metrics and the UI labels them unavailable. It never infers completion from enrollment or displays
sample courses, certificates, statistics or activity. Profile's overview is authorized and always
personal; User Detail is the only UI caller using a target user ID. Query caches include account identity
and administrative targets. Existing theme-aware cards, layout, headers and breadcrumbs are reused.

## Verification

Frontend: npm test (permission/navigation cases and server-rendered panel scope/empty-state tests),
npm run build. Backend: Java 21, Maven tests LearningAccessTest, LearningRecordsServiceTest,
RoleAccessMigrationTest plus existing profile regressions. LearningAccessTest uses real Spring method
security proxies. A running database/browser integration and manual light/dark responsive inspection
remain deployment checks; static rendering does not verify visual layout.

Verified in this workspace: 35 focused backend tests and 8 frontend tests passed; frontend production
build and TypeScript checks passed. The production build reports an existing large-chunk warning.
On this Windows setup, use JAVA_HOME pointing at Java 21. Maven's forked test JVM required
`-DargLine="-Djdk.net.URLClassPath.disableClassPathURLCheck=true -javaagent:<local byte-buddy-agent-1.14.19.jar>"`
to avoid the local classpath/agent-attachment problem. The agent is already in Maven's dependency cache;
no application dependency was added.
