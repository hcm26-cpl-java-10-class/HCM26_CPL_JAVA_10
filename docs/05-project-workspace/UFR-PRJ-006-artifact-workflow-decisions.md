# UFR-PRJ-006 — Artifact workflow decisions and implementation notes

Updated: 2026-10-27

## Scope and source of decisions

This note records the implementation decisions for Hoà's artifact preparation/submission work and the related milestone handoff. Decisions follow the UFR-PRJ-006 story and acceptance criteria shared in the conversation, the milestone requirements already present in the repository, and the existing code. The complete SRS PDF was not available in the repository during this work, so questions not answered by those sources are explicitly identified as recommendations rather than confirmed requirements.

## Decisions

### Submission eligibility and milestone lifecycle

- A project must be `ACTIVE` and its milestone must be `OPEN` for an artifact submission. A `PLANNED`, `CLOSED`, or `CANCELLED` milestone cannot accept a new submission. The server enforces this even if a client bypasses the UI.
- Newly created milestones remain `PLANNED`. A user with `MILESTONE_WRITE` opens a planned milestone using `POST /api/projects/{projectId}/milestones/{milestoneId}/open` or `POST /api/teams/{teamId}/milestones/{milestoneId}/open`. Opening is idempotent for an already `OPEN` milestone; other source states are rejected. The transition records audit and outbox entries.
- Students may still prepare and save a draft while a milestone is planned. The student page explains why submit is unavailable and disables Review & submit until the milestone is open.
- Team workspace submit additionally requires an active team and active project. The pre-existing demo team fixture is retained for the demo path.

### Artifact fields, checklist, URLs, and uploads

- A valid submission contains at least one accepted URL or a clean uploaded attachment. Repository and deployment URLs are optional individually; when supplied, each must be an absolute HTTP or HTTPS URL with a host. This accepts GitHub repository/docs URLs and deployment links without binding the feature to one provider's URL format. HTTPS is recommended for real deployments; HTTP remains syntactically accepted by the existing API contract.
- Checklist IDs must belong to that milestone. Mandatory checklist items are not a submit-time gate: UFR-PRJ-006 describes them as acceptance conditions and does not explicitly require every item to be self-checked before submission. The student checklist values are stored with the version as declarations; the reviewer decides acceptance against the configured checklist and rubric. This avoids blocking a legitimate hand-in while retaining evidence for review.
- File upload remains fail-closed unless MIME, size, and malware-scanner policy are configured. A selected file is not treated as uploaded until the server has accepted and scanned it.
- Late submission uses the server clock (`Instant`) as the authoritative time. The tenant timezone is for display only. `ALLOW_LATE` accepts through the configured `lateUntil`; after that, or under a policy that disallows late work, the API rejects the request. The configured penalty percentage is recorded on the submitted version; this feature does not silently alter a grade because no grade-calculation rule is defined in the supplied acceptance criteria.
- A reviewer processing a submission after its deadline does not change whether the student submitted late: lateness is fixed from the recorded `submittedAt` and the milestone policy. The supplied story does not define a separate review-lateness penalty or SLA.

### Versions, retry, review, and project completion

- Every successful intentional submission creates a new immutable `SUBMITTED` version. Retrying the same request with the same idempotency key returns the original result and does not duplicate the version, audit, or outbox event. A new key creates a new version.
- `SUBMITTED` means received, not reviewed. Acceptance/rejection belongs to a separate reviewer workflow. The UFR story material supplied here defines the distinction but does not give the review transition's authorization, feedback, or SLA rules; those should not be invented inside submit.
- Submitting the final artifact does not automatically mark the project complete. Recommended completion rule for group agreement: all mandatory milestones have an accepted submission, the final artifact is accepted, and all required tasks/backlog items are complete. Completion should then be an explicit project workflow transition by an authorized reviewer/project owner, not a side effect of student submit. This recommendation is not implemented because no source in the supplied requirements defines the project's completion transition or required-task mapping.

## Code changes in this work

- Backend submission now checks active project and `OPEN` milestone state for both project and team artifact routes.
- Added a milestone open command and project/team API endpoints. Opening records `MILESTONE_OPENED` audit and outbox events; the team route applies the workspace's tenant/scope access check.
- Added locking milestone lookups for the open transition to avoid concurrent state transitions racing.
- Added teacher-side Open milestone actions on project and team milestone detail pages. Student submit controls reflect the milestone state; saving a draft remains available.
- Updated integration tests to open milestones before successful submissions and assert that submission while `PLANNED` is rejected.
- Existing URL, attachment, late-policy, versioning, audit/outbox, and idempotency behavior remains the basis for the submission flow.

## Test/verification record

Verification performed for this change:

- Backend compile (`.\mvnw.cmd -q -DskipTests compile`): passed.
- Frontend TypeScript check (`npx tsc -b --pretty false`): passed.
- Frontend production build (`npm run build`): passed after allowing Vite/esbuild to spawn its helper process; Vite emitted the existing large-chunk advisory (main JS about 1.47 MB).
- Focused artifact/milestone integration tests (5 cases covering project/team submit, planned-state rejection, validation/late policy, idempotency, and resubmission): passed.
- After tightening team-open authorization to the workspace tenant/scope guard and adding a repeated-open assertion, the two project/team submit integration tests were rerun: 2 passed, 0 failed.
- Full `MilestoneIntegrationTest` class: 31 of 33 passed; two failures are in unrelated rubric sorting response shape and unknown-project status expectations (`sortsRubricsByRequestedColumnAndDirection`, `returnsNotFoundForUnknownProject`). These were not changed here and should be triaged separately.
- `git diff --check`: passed; only Git line-ending conversion notices were emitted.

## Coordination messages

### Khánh

Khánh ơi, tui đã rà và chỉnh luồng theo yêu cầu hiện có: milestone tạo mới ở `PLANNED`, người có quyền mở sang `OPEN`, và sinh viên chỉ submit khi project đang `ACTIVE`, milestone `OPEN`. Checklist mandatory được lưu cùng bản nộp nhưng không chặn nút submit; tui chọn vậy vì yêu cầu mô tả checklist là điều kiện nghiệm thu, chưa nói student phải tự tick đủ mới được nộp. Reviewer vẫn đối chiếu checklist/rubric khi duyệt. Nộp muộn lấy giờ server làm chuẩn, nhận tới `lateUntil` nếu policy cho phép; penalty được ghi vào version, chưa tự trừ điểm vì chưa có rule tính điểm. Bạn xem giúp tui phần này có khớp với luồng rubric/checklist/review của bạn không nha. URL GitHub docs/repo cần là URL tuyệt đối HTTP(S) có host; gửi tui URL mẫu phía bạn đang dùng để tui đối chiếu format.

### Liêm

Liêm ơi, tui đã tách rõ `SUBMITTED` là đã tiếp nhận, chưa đồng nghĩa được duyệt hay project hoàn thành. Tui đề xuất project chỉ được hoàn tất khi artifact cuối đã `ACCEPTED`, mọi milestone mandatory đã được chấp nhận và các task/backlog bắt buộc đã hoàn thành; sau đó người có quyền thực hiện transition hoàn tất riêng. Tui chưa tự bật auto-complete khi sinh viên submit vì yêu cầu hiện có không định nghĩa mapping task bắt buộc hay quyền đóng project. Bạn đối chiếu giúp tiêu chí này với dữ liệu task/milestone và dashboard của bạn xem có khớp không nha.

## Items for group confirmation

1. Confirm the proposed project completion rule and who is allowed to perform the explicit completion transition.
2. Confirm whether checklist self-attestation should ever block submission; current implementation treats it as reviewer evidence.
3. Confirm whether late penalty affects a grade and which grading component owns that calculation.
4. Define review status transitions, reviewer permissions, and any review deadline/SLA in the appropriate user story.
5. Confirm whether deployment/repository URLs need provider-specific allowlists; current validation accepts absolute HTTP(S) URLs.
