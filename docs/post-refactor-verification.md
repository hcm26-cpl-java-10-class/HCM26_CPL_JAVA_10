# Post-refactor verification and stabilization

Verified on 28 October 2026. Scope: stabilize the existing role/profile/learning implementation; no new learning records or accounts were inserted and no role assignments were changed for live tests.

## Verified role matrix

| Account | Views and navigation | Profile / personal learning | Evidence |
| --- | --- | --- | --- |
| ADMIN only | Admin View; user-management navigation; no learner switch | Own Profile; no Learning Overview; personal learning API denied | Live browser and local API; automated tests |
| STUDENT only | Learner View; no administrative navigation; direct User Detail denied | Own Profile; Learning Overview; proper zero-enrollment state | Live browser, local API, mobile and automated tests |
| ADMIN + STUDENT | Both views from combined permissions; learner view narrows management navigation | Shared Profile and personal access in either view | Automated combined-authority and frontend permission fixtures; no live dual-role seed account |
| TEACHER | Admin View with existing course/book/exam management subset; lands at /teacher; no users/dashboard/learner rights | Own Profile; no Learning Overview; /my-learning denied; error-page home returns to /teacher | Live browser and API; automated tests |
| Custom roles | View options derive from ADMIN_ACCESS/LEARNER_ACCESS, not role names; minimal management roles get an authorized landing; no access flags falls back to Profile | Learning sections require both learner/self-read grants; inspection requires all three admin grants | Automated permission, migration and authorization fixtures; no live custom-role seed account |

## Bugs found and fixed

1. Teacher/custom administrative accounts were directed to a system dashboard outside their user-management scope. Home destinations now respect resource grants, error-page links use the same policy, and dashboard statistics require existing USER_READ plus ADMIN_ACCESS.
2. An inactive assigned role still supplied backend authorities. JWT request principals, login responses and refreshed JWT claims now exclude inactive roles.
3. Sidebar/mobile/logout routes could clear storage without clearing Redux, leaving an authenticated client state. All logout paths now clear Redux even when the server request fails.
4. Administrative user-detail caches were shared across accounts, and old permission scopes could retain cached records. Session/permission changes clear React Query caches; User Detail keys include the signed-in account and optional lookup requests respect their resource permissions.
5. Parallel 401 responses each attempted rotation of the same refresh token. They now share one refresh request; late responses cannot reauthenticate a different or signed-out account.
6. Profile API mapping and the backend supplied sample employee/department/skill values. Those substitutions are removed. Missing data stays missing; Skills has an empty state. Profile load failures have a retry notice, editing is disabled until data is loaded, and forms/modals reset across account changes. Late or mismatched responses cannot overwrite the current identity.
7. My Learning had lost its original tabs, course cards, and sidebar hierarchy. Existing CourseCard, activity, statistics and certificate components are reused. Enrolled is the factual default; unsupported tabs/metrics explain that records are unavailable. No fabricated zero-percent progress or inferred completion is shown.
8. Sample curriculum/activity/certificate data remained in an unused source file and legacy profile component. The unused sample-data module was removed; the retained legacy component now accepts caller-supplied records.
9. At 390px, the Student header overflowed to 439px, and wrapped tabs extended beyond a fixed 36px bar into the card. The wordmark/duplicate logout adapt at small widths; tabs expand to their content. After correction: header scroll/client width both 390px; tab height 79px contains its 70px child extent. Profile also has no horizontal overflow at this width.
10. Switcher dark-mode selection mixed light backgrounds with light text. Selected-row and badge colors now have matching dark variants. Account role labels remain distinct from selected view labels.
11. User Detail reversed the selected user's name; it now uses the returned full name. Detail failures have Retry, tabs wrap, and row action icons have accessible labels.

## Files changed for stabilization

Backend paths below are relative to backend/src/main/java/com/example/starter_project_2025/:

- security/UserPrincipal.java
- system/auth/authentication/AuthServiceImpl.java
- system/auth/token/refresh/RefreshTokenServiceImpl.java
- system/dashboard/DashboardController.java
- system/profile/ProfileServiceImpl.java

Frontend paths below are relative to frontend/src/:

- utils/rbac.utils.ts; App.tsx; main.tsx; lib/query-session.ts (new)
- api/axios.ts; api/features/profile.api.ts
- pages/auth/Login.tsx; components/auth/OAuth2RedirectHandler.tsx; components/auth/Logout.tsx
- pages/error/Unauthorized.tsx; pages/error/NotFoundPage.tsx; router/component-registry.ts
- components/layout/HeaderRight.tsx; components/layout/Sidebar.tsx; components/layout/StudentNavbar.tsx
- components/datatable/common/ActionButton.tsx
- pages/management/rbac/user/pages/UserDetailPage.tsx
- pages/management/profile/index.tsx; components/PersonalInfoCard.tsx, ProfileHeader.tsx, SkillsCard.tsx, LearningProgressCard.tsx within that profile folder
- pages/management/learning/learning.types.ts; learning-records.utils.ts (new)
- pages/management/learning/components/LearningRecordsPanel.tsx, CourseCard.tsx, LearningActivityCalendar.tsx, LearningStatisticsCard.tsx, RecentCertificatesSidebar.tsx
- pages/management/learning/learning.data.ts (unused sample data removed)

Tests updated: frontend/tests/access.test.mjs and learning-ui.test.mjs; backend LearningAccessTest and RoleAccessMigrationTest. Added backend JwtAuthorityRefreshTest. Existing profile/auth regressions were rerun.

## Verification results

- 39 focused backend tests pass on Java 21: method authorization, target validation, empty data, Teacher/custom role restrictions, combined authorities, inactive roles, current database authorities with an existing JWT, migration idempotency, profile and login regressions.
- 15 frontend tests pass: access/view rules, exact profile aliases, trailing-slash guards, component rendering, personal/target cache isolation, preserved learning hierarchy, profile mapping, session cache cleanup, and concurrent rotating refresh.
- TypeScript and Vite production build pass. Existing large JavaScript chunk warning remains.
- Live API: ADMIN profile/users/target learning/dashboard return 200; personal learning returns 403. STUDENT profile/personal learning return 200; users/target inspection/dashboard return 403. TEACHER profile returns 200; personal learning/users/target inspection/dashboard return 403.
- Each Profile response belongs to the signed-in test identity and returns no fabricated skills.
- Administrative learning targets 0, -1 and a nonexistent ID return 404. Unauthenticated personal/admin learning requests return 401. Adding userId to the personal endpoint does not alter the authenticated user's result.
- Live browser: Admin User Management > Student User Detail > Learning uses target #2 and its correct empty state; personal Profile remains separate. Student mobile Profile includes its own learning empty state and direct administrative navigation is denied. Teacher Profile excludes Learning Overview and personal learning is denied.
- Light and Dark Mode inspected visually on desktop administrative learning; Student learning inspected in both themes at mobile width. Light cards are white; borders, readable tab states and responsive column stacking are preserved. Initial light preference and default viewport were restored, and the test browser session was signed out.

## Remaining limitations and future work

- CourseEnrollment stores user/course/timestamp only. There is no persisted course completion percentage, completion status, certificate ledger, saved-course store, learning statistics or activity ledger. These require future backend/data-model implementation, followed by UI wiring. No data was invented to fill those gaps.
- User management currently has a global USER_READ scope. There is no existing tenant/department/manager-specific target policy. Such a policy must be designed and enforced before restricted administrative inspection is supported.
- Skills have no persisted source; the UI now shows an honest empty state. Manage Sessions currently displays current-session information; revoking/listing remote sessions is not implemented.
- Server permissions use current database state on each JWT request. Client navigation changes on login/token refresh; there is no pushed role-change notification. A revoked permission may leave a stale navigation item visible until refresh, but server access remains denied.
- Migration uses a transactional permission marker. Automated tests verify repeat runs preserve customized mappings and role metadata. A database restart/rollback rehearsal against a production-like backup was not performed. Custom read-only administrative roles without the explicit new access flags still need an administrator-reviewed mapping, as documented in account-learning-access.md.

## Browser/database checks not performed

- Actual browser switching with a persisted ADMIN + STUDENT account and custom-role accounts: only ADMIN/STUDENT/TEACHER seed accounts exist. Those combinations were verified through automated fixtures; no live accounts or assignments were created or altered.
- Real non-empty enrollment/progress/certificate/activity displays: the seeded learner has no enrollments and unsupported ledgers do not exist. Non-empty enrolled-card ownership was verified with isolated automated fixtures.
- Production-like schema/mapping upgrade, concurrent application-instance migration, database rollback, Google OAuth provider login, real token-expiry waits, and destructive profile/password changes were not exercised. Token rotation and identity behavior have automated coverage instead.
- Full browser/device matrix and production deployment were not performed. Live responsive measurements were at 390x844 plus the existing desktop viewport.
