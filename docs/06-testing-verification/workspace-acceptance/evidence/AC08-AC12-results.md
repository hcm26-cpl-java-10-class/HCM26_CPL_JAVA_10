# AC08-AC12 integration-test evidence

Result: **23/23 passed**.

Report timestamp: 2026-10-23T19:17:40.9910839+07:00.

Spring Boot + MockMvc integration tests; these are not Postman network captures.

Unique in-memory H2 test database. Fresh tenant/project/team/member per case; workspace records cleaned after each case.

| AC | Result | Test case | Seconds |
| --- | --- | --- | --- |
| AC09 | PASS | ac09ReplayIsDurableAndDifferentPayloadConflicts | 0.973 |
| AC11 | PASS | ac11MissingTargetIs404(String)[1] | 0.118 |
| AC11 | PASS | ac11MissingTargetIs404(String)[2] | 0.078 |
| AC12 | PASS | ac12MandatorySaveFailureRollsEverythingBackAndSameKeyCanRetry(String)[1] | 0.153 |
| AC12 | PASS | ac12MandatorySaveFailureRollsEverythingBackAndSameKeyCanRetry(String)[2] | 0.127 |
| AC12 | PASS | ac12MandatorySaveFailureRollsEverythingBackAndSameKeyCanRetry(String)[3] | 0.114 |
| AC12 | PASS | ac12MandatorySaveFailureRollsEverythingBackAndSameKeyCanRetry(String)[4] | 0.109 |
| AC12 | PASS | ac12MandatorySaveFailureRollsEverythingBackAndSameKeyCanRetry(String)[5] | 0.099 |
| AC12 | PASS | ac12MandatorySaveFailureRollsEverythingBackAndSameKeyCanRetry(String)[6] | 0.124 |
| AC08 | PASS | ac08DifferentKeyReturnsExistingWorkspaceAndDatabaseAlsoEnforcesUniqueness | 0.081 |
| AC12 | PASS | ac12AuditHasFullContextAndOutboxRedeliveryNeverDuplicatesActivity | 0.141 |
| AC11 | PASS | ac11InvalidSelection422AndForeignTenant403 | 0.076 |
| AC11 | PASS | ac11ExpiredSessionIs401AndWritesNothing | 0.042 |
| AC11 | PASS | ac11RejectsProjectStatusChangedSinceConfirmation(String)[1] | 0.052 |
| AC11 | PASS | ac11RejectsProjectStatusChangedSinceConfirmation(String)[2] | 0.054 |
| AC11 | PASS | ac11RejectsProjectStatusChangedSinceConfirmation(String)[3] | 0.051 |
| AC10 | PASS | ac10ConcurrentRequestsProduceOnlyOneLogicalCreation(boolean)[1] | 0.06 |
| AC10 | PASS | ac10ConcurrentRequestsProduceOnlyOneLogicalCreation(boolean)[2] | 0.055 |
| AC11 | PASS | ac11RechecksRevocationSinceConfirmation(String)[1] | 0.048 |
| AC11 | PASS | ac11RechecksRevocationSinceConfirmation(String)[2] | 0.047 |
| AC11 | PASS | ac11RechecksRevocationSinceConfirmation(String)[3] | 0.046 |
| AC11 | PASS | ac11RechecksRevocationSinceConfirmation(String)[4] | 0.039 |
| AC11 | PASS | ac11RechecksRevocationSinceConfirmation(String)[5] | 0.039 |

## Assertions exercised

- AC08: different key on an existing pair returns 409 with the readable workspace ID; record counts stay unchanged; the database also rejects a duplicate row.
- AC09: same key/body returns the identical saved 201 response; changed body returns 409; workspace/audit/outbox/activity/request counts do not increase.
- AC10: a ready latch and shared start latch release two requests. Different keys yield exactly 201/409; the additional same-key case yields 201/201 with identical responses. The database has one workspace, one request, one audit, one event and one activity.
- AC11: a signed expired token yields 401; revocation after confirmation yields 403; missing targets yield 404; invalid relationship yields 422; terminal/ineligible project states yield 409. Failed attempts leave workspace records unchanged.
- AC12: failures at WORKSPACE, SECTIONS, AUDIT, OUTBOX, ACTIVITY and IDEMPOTENCY saves return 500 and restore all six table counts, with project still PLANNING. Removing the fault allows same-key retry. Audit fields are checked and repeated delivery retains one activity.

The executed cases in the table define the scope of this report. AC10-only or AC12-only runs do not execute the other AC assertions.

Source: backend/src/test/java/com/example/starter_project_2025/system/project/WorkspaceAcceptanceIntegrationTest.java

This summary exports test names and outcomes only; application logs, credentials and JWTs are not copied.
