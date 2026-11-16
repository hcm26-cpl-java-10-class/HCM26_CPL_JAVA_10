# Team Charter — acceptance traceability and verification

Working source: `User_Stories_UFR_PEO_013_Team_Charter_Theo_Mau_Nhom_v1.1.md` (6 stories / 51 AC).

All six stories have implementation paths below. **API** means executed Spring/H2 integration tests; **UI** means executed Chromium checks with mocked API, or visual inspection as noted. **Review** means code-path review, not a claim that a dedicated automated scenario was run for that exact AC. These distinctions matter when accepting a release.

## Executed checks

- `ProjectHubIntegrationTest`: 35 tests passed (canonical fixtures, charter API, scope, edits, snapshots, confirmations, role/member integration, 35 students / 5 teams, history, concurrency and rollback).
- `ProjectTeamRoleServiceTest`: 4 tests passed.
- `TeamAllocationLifecycleIntegrationTest`: 10 tests passed after updating the test fixture to supply the Mentor now required by the group's publish policy. Production publish rules were not weakened.
- `WorkspacePersistenceIntegrationTest`: 1 test passed, including restart and Charter revision persistence.
- Total: **50 backend tests**, zero failures/errors in the final completed run.
- Frontend: TypeScript build and production Vite build passed; existing large-bundle warnings remain. ESLint is checked on changed frontend files, not claimed for every unrelated file in the repository.
- Chromium: 15 groups passed — full page load; Preview/return; dirty form blocks Confirm; duplicate Save prevention; self-confirm; refreshed progress; consent-reset warning; keyboard expansion/collapse of history; local tab input retention; 409 retention; failed background GET retention; explicit reload; 1440/1366/390 responsive; archived read-only; Workspace return navigation. No uncaught browser errors.
- Screenshots reviewed in the OS temp folder `hoa-team-charter-baseline`: `charter-complete-1440.png`, `charter-complete-1366.png`, `charter-complete-390.png`. Browser fixtures are test-only data, not application demo seeds.

## UFR-PEO-013-01 — View charter (9 AC)

| AC | Implementation / evidence |
| --- | --- |
| 01 Saved charter | API `charterReadUsesCanonicalTeamAndSeparatesReadFromWritePermission`; UI page load. |
| 02 No charter yet | Revision 0/no fabricated consent; API initial read/history empty and UI empty states; Review wording. |
| 03 Roles and missing responsibilities | `TeamCharterIntegrity.roster`; API `incompleteContentResponsibilitiesOrInvalidRoleBlocksConsent`; member issue labels. |
| 04 Multiple Team contexts | Scoped team selector and keyed editor; API `classOf35StudentsShowsFiveIndependentGroupsOfSeven`; Review selector change. |
| 05 Workspace/Team mismatch and scope | API `workspaceContextAndHistoryScopeAreValidated`, foreign-tenant/member scope tests; contextual GET validates the binding. |
| 06 Loading/error/retry | UI mocked GET failure and explicit reload; initial pending/error/retry rendering. |
| 07 Read-only permissions/lifecycle | API archived/viewer tests; UI archived fields/buttons. |
| 08 Invalid session | API unauthenticated GET 401; existing auth filter plus active-account service check. |
| 09 Missing Team | Scoped lookup returns 404; API missing Workspace/outside-Team branches; Review missing Team branch. |

## UFR-PEO-013-02 — Compose/preview/save (9 AC)

| AC | Implementation / evidence |
| --- | --- |
| 01 First save | API `charterSaveCreatesOneRevisionAuditAndEventAndNormalizesContent`; explicit save initializes legacy revision 0. |
| 02 Preview/return | UI Preview modal and return with input intact; no mutation on Preview. |
| 03 Character limits | API `allFiveCharterFieldsEnforceTheirOwnCharacterLimits`, boundary/partial tests; HTML maxLength and counters; legacy component browser boundary check at checkpoint 2. Responsibility has its own 1,000-character limit. |
| 04 Legacy channel | API `unassignedTeamRemainsVisibleAndCharterUsesSupportedChannelValues`; normalization retains unchanged legacy values; Review legacy dropdown option. |
| 05 Incomplete draft | API `incompleteDraftAndCharacterBoundaryCanBeSaved`; confirmation block reason. |
| 06 Stale version | API stale/concurrent saves (one 200/one 409); UI input retention. |
| 07 Pending/recovery | UI pending blocks repeated submission; version fence prevents retry effects; explicit reload reconciles lost replies. |
| 08 Tabs/refetch | UI local tabs and failed background GET retain edits; clean-only server adoption and focus refetch disabled. |
| 09 Revoked rights/server errors | Server rechecks capability/scope; access errors hide protected editor; UI generic error/retry. Review the specific mid-request revocation path. |

## UFR-PEO-013-03 — Self-confirmation (9 AC)

| AC | Implementation / evidence |
| --- | --- |
| 01 Correct saved revision | API self-confirm happy path; UI consent and refreshed progress. |
| 02 Required preconditions | API incomplete content/roles/responsibilities; service also checks roster eligibility and all five saved fields. |
| 03 No implicit Save | Confirm DTO has version/revision/token only; UI blocks dirty form; Preview does not mutate. |
| 04 No duplicate effects | API `concurrentConfirmRetriesProduceOnlyOneConsent`, stable retry/evidence timestamp and one outbox effect. |
| 05 Stale content/assignments | API `charterRevisionChangeRequiresNewConsentAndPreservesHistory`; role change and roster token fence. |
| 06 No impersonation | API `selfConfirmationIsImmutableIdempotentAndCannotImpersonateAnotherUser`, `adminAndAssignedMentorCannotConfirmOnBehalfOfStudents`. |
| 07 Membership/account recheck | API removal/status-reactivation tests; Review account lock/inactive/tenant predicates, with invalid members retained as issues. |
| 08 Lost reply recovery | API stable repeated consent; UI Refresh/reload retrieves persisted state, never silently claims an unknown result. |
| 09 Transaction failure | API `confirmationAndItsEvidenceRollBackTogether`; consent and outbox absent after rollback. |

## UFR-PEO-013-04 — Revise and renew agreement (8 AC)

| AC | Implementation / evidence |
| --- | --- |
| 01 Revision/renewal | API revision change resets counts and preserves old history. |
| 02 Impact explanation | UI checked warning before editing an agreement with consent. |
| 03 Normalized no-op | API `charterNoOpDoesNotAdvanceRevisionVersionOrDuplicateEvidence`; later saves do not churn revisions. |
| 04 Safe Save retry | Old technical version rejected before mutation; no duplicate revision/event; API stale/concurrent checks. |
| 05 Roster changes | API official remove and status-reactivation; add/swap/transfer call the same per-team hook in `recordChange` (Review those additional branches). |
| 06 Roles/responsibilities | API `officialRoleChangeInvalidatesConsentAtomically`; responsibility edits enter the same revision transaction; role assignment remains in Allocation. |
| 07 No mixed snapshot | Allocation session/team locks, roster row locks and token/version check; API stale/concurrent writes. |
| 08 Atomic rollback | API `charterContentEvidenceAndEventsRollBackTogether`; revision, content, audit/outbox absent after forced transaction failure. |

## UFR-PEO-013-05 — Agreement progress (8 AC)

| AC | Implementation / evidence |
| --- | --- |
| 01 Pending progress | API progress before consent; UI progress/count/reason. |
| 02 Fully confirmed | API happy path only with a nonempty valid current roster; UI progress refresh. |
| 03 Multi-role/retry counts | Unique team/revision/user constraint; count per member rather than per role; API retry test and Review multi-role projection. |
| 04 Empty/invalid roster | API official removal and invalid roles; empty is Needs review, not 100%. |
| 05 Refresh after changes | UI successful mutation refreshes detail/team list/history; API renewed consent rules. |
| 06 35 / 5 / 7 isolation | API `classOf35StudentsShowsFiveIndependentGroupsOfSeven`. |
| 07 Scope protection | API unrelated-team and foreign-tenant denial; shared scope helper includes active ClassMember. |
| 08 Responsive/accessibility | UI 1440/1366/390, native labelled inputs/checkbox/select, keyboard details toggle and text status badges. |

## UFR-PEO-013-06 — Revision/consent history (8 AC)

| AC | Implementation / evidence |
| --- | --- |
| 01 Own snapshot/consent | API history of two revisions after changed mission, old consent attached only to old revision. |
| 02 Old content preserved | API stale-write/history and immutable entity; no update endpoint. |
| 03 Read-only/navigation | History has no mutation controls; UI keyboard toggle and Workspace back link verified. |
| 04 History scope | API `workspaceContextAndHistoryScopeAreValidated` plus tenant-scoped service lookup. |
| 05 Empty/legacy | API empty history; absent legacy roster/consent explicitly displayed rather than filled from latest data (Review legacy rendering). |
| 06 After membership change | API official removal preserves old consent; snapshots contain identity/roles/responsibility without cascading member FKs. |
| 07 Order/totals/errors | API newest-first and total count, size validation; server pagination and history retry/buttons; Review multiple-page traversal. |
| 08 Long/blank/mobile | Pre-wrapped read-only text, break-anywhere and scrollable Preview; responsive browser screenshots; Review full-length historical text. |

## Remaining environment checks (not missing feature buttons)

MySQL 8 manual DDL has not been applied to a real group database. Browser checks are mocked; a real-request manual acceptance session should use the isolated launch procedure in README, then the group's normal review/deployment process. Full external notification delivery is not part of this feature; the existing outbox relay logs bounded metadata. Roles missing from the group's official enum (such as UX) must be coordinated with the Allocation owner rather than invented in Charter.

No real/demo database, default launcher, original SRS output or original pending application files were changed by these checks. No commit/push was made.
