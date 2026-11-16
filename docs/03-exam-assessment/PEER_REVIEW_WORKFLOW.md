# UFR-EXM-012 — Tự đánh giá / Đánh giá chéo (Peer & Self Review)

> Nguồn: SRS `SRS_FAMS_LMS_MockProject_Hub_ThucTe_v2.0_With_UI.md`, UFR-EXM-012 (Must, Hub ASM-06, SCR-54..65, UI-STD-05 `/student/assessments/{id}`, UI-STD-06 `/student/feedback`).
> Phạm vi triển khai: **chỉ module Exam**.

## 1. Mục tiêu & quyết định thiết kế

| Quyết định | Nội dung | Lý do |
|---|---|---|
| Nguồn reviewer | Chọn từ **cùng kỳ thi** (`ExamAttempt` đã nộp của cùng `Exam`) | Không phụ thuộc `CourseEnrollment` → không đụng module Course |
| Ảnh hưởng điểm | Lưu **riêng** trong `exam_review_submission` / `exam_review_item` | `ExamAttempt.finalScore` **không** bị ghi đè → điểm Course tổng kết không thay đổi |
| Rubric | Lấy từ `ExamAttemptQuestion.gradingCriteria` (snapshot lúc làm bài) | Không phụ thuộc module rubric bên ngoài |
| Quyền xem feedback | Chỉ sau khi giáo viên **Publish Results** (release policy) | Đúng rule "kết quả chỉ hiện theo release policy" của SRS |

## 2. Kiến trúc & phạm vi

```
backend/src/main/java/com/example/starter_project_2025/system/exam/review/
├── domain/       ExamReviewAssignment, ExamReviewSubmission, ExamReviewItem,
│                 ExamReviewType, ExamReviewStatus + 3 repository
├── dto/          Assignment / Target / Submit / Feedback / Overview / Progress
├── audit/        ExamReviewAuditLog, ExamReviewAuditAction, repository, service (correlation ID)
├── service/      ExamPeerReviewService + 3 exception (409 / 403 / 422)
└── controller/   ExamPeerReviewController + ExamPeerReviewExceptionHandler

frontend/src/
├── types/features/peer-review.ts
├── api/features/peer-review.api.ts
├── pages/student/PeerReviewListPage.tsx        → /student/reviews
├── pages/student/PeerReviewFormPage.tsx        → /student/reviews/:assignmentId
├── pages/student/PeerReviewFeedbackPage.tsx    → /student/feedback
└── pages/management/exam/reviews/PeerReviewOverviewPage.tsx → /exams/:examId/reviews
```

**Ngoài phạm vi (không sửa):** `system/demo/course/**`, `CourseAssessmentService`, `CourseMyScoresService`, `ExamAttemptService.gradeAndSubmit`.

## 3. Mô hình dữ liệu

### 3.1 `exam_review_assignment`

| Cột | Ý nghĩa |
|---|---|
| `attempt_id` | Bài làm được chấm |
| `exam_id` | Đề thi |
| `reviewer_id` | Người thực hiện chấm |
| `review_type` | `SELF` \| `PEER` |
| `status` | `ASSIGNED` \| `SUBMITTED` \| `SKIPPED` |
| `anonymous` | Snapshot cấu hình ẩn danh lúc phân công |
| `assigned_at` / `due_at` / `submitted_at` | Mốc thời gian |
| `assigned_by` | Giáo viên phân công |

Unique constraint: `(attempt_id, reviewer_id, review_type)` → chống trùng.

### 3.2 `exam_review_submission` (1-1 với assignment)

`overall_score`, `max_overall_score`, `overall_comment` (TEXT), `submitted_at`.

### 3.3 `exam_review_item`

`question_id`, `source_question_id`, `criterion_name`, `weight_percentage`, `max_points`, `awarded_points`, `comment`.

### 3.4 Cấu hình trên `Exam` (5 cột mới, backward-compatible)

| Trường | Mặc định | Ý nghĩa |
|---|---|---|
| `selfReviewEnabled` | false | Bật tự đánh giá |
| `peerReviewEnabled` | false | Bật đánh giá chéo |
| `peerReviewCount` | 2 (1–5) | Số reviewer cho mỗi bài |
| `peerReviewAnonymous` | true | Ẩn danh reviewer/tác giả |
| `peerReviewShowReference` | false | Cho reviewer xem đáp án mẫu / rubric |

Các trường này **chỉ sửa được khi chưa có attempt nào** (dùng chung cờ `antiCheatEditable` trong `ExamMapper`), tránh phá dữ liệu đã giao.

## 4. Luồng nghiệp vụ

```mermaid
flowchart TD
    teacher[Giáo viên] -->|POST /api/exams/{id}/reviews/assign| assign[ExamPeerReviewService]
    assign -->|tạo SELF + PEER| db[(exam_review_assignment)]
    db --> notify[NotificationService.createOnce]
    notify --> reviewer[Sinh viên reviewer]
    reviewer -->|GET /api/exams/reviews/my| list[Danh sách việc]
    reviewer -->|GET /api/exams/reviews/my/{id}| target[Xem bài, tác giả ẩn danh]
    reviewer -->|POST /api/exams/reviews/{id}/submit| submit[Chấm theo rubric]
    submit --> sub[(exam_review_submission + exam_review_item)]
    submit --> audit[Audit log + correlationId]
    sub -->|author xem feedback| feedback[GET /api/exams/reviews/my-feedback]
    feedback --> gate{Kết quả đã publish?}
    gate -->|chưa| deny[403]
    gate -->|rồi| show[Hiển thị feedback + ẩn danh theo config]
```

### 4.1 Phân công reviewer

- Lấy các attempt `SUBMITTED` / `PENDING_REVIEW` / `EXPIRED` của đề thi.
- Với mỗi attempt:
  - Nếu `selfReviewEnabled` → tạo 1 assignment `SELF` (reviewer = chính tác giả).
  - Nếu `peerReviewEnabled` → chọn tối đa `peerReviewCount` reviewer từ các sinh viên **khác** đã nộp bài; tuyệt đối loại tác giả.
- **Idempotent**: unique constraint `(attempt_id, reviewer_id, review_type)` + kiểm tra trước khi tạo → gọi lại không sinh bản ghi trùng.

### 4.2 Chấm (reviewer view)

- Chỉ câu `ESSAY` mới được chấm; câu không có câu trả lời tự luận thì bỏ qua.
- Rubric = `ExamAttemptQuestion.gradingCriteria`; điểm tối đa mỗi tiêu chí = `questionPoints × weight%`.
- Không có rubric → một tiêu chí mặc định `Overall answer` (100%).
- Đáp án mẫu / rubric gốc chỉ hiện khi `peerReviewShowReference = true`.
- Tác giả hiển thị `Anonymous student` khi bật ẩn danh, ngược lại hiện tên thật.

### 4.3 Nộp phiếu

- Validate `awarded_points ∈ [0, max_points]` → **422** nếu vượt.
- `overall_score ∈ [0, tổng điểm rubric của bài]` → **422** nếu vượt.
- Tiêu chí lặp trong cùng câu → **422**.
- Nộp 2 lần → **409**.
- Sau khi nộp: `status = SUBMITTED`, ghi audit (`ASSIGN`/`SUBMIT`), gửi notification cho tác giả (idempotent qua `createOnce`).

### 4.4 Xem feedback (author view)

- Chỉ tác giả của attempt được xem → nếu không → **404**.
- Chỉ trả về khi `ExamResultPublication.published = true` và `releasePolicy != HIDDEN` → nếu không → **403**.
- Reviewer hiển thị `Anonymous reviewer` khi bật ẩn danh.

## 5. API contract

| Method | Path | Permission | Mô tả |
|---|---|---|---|
| GET | `/api/exams/reviews/my` | `EXAM_REVIEW_READ` | Danh sách việc chấm của tôi |
| GET | `/api/exams/reviews/my/{assignmentId}` | `EXAM_REVIEW_READ` | Chi tiết bài được chấm (chỉ chủ assignment) |
| POST | `/api/exams/reviews/{assignmentId}/submit` | `EXAM_REVIEW_CREATE` | Nộp phiếu chấm (1 lần) |
| GET | `/api/exams/attempts/{attemptId}/reviews` | `EXAM_REVIEW_READ` | Feedback của một attempt (chủ attempt, đã publish) |
| GET | `/api/exams/reviews/my-feedback` | `EXAM_REVIEW_READ` | Feedback của tất cả attempt của tôi (đã publish) |
| POST | `/api/exams/{examId}/reviews/assign` | `EXAM_REVIEW_ASSIGN` | Phân công reviewer (giáo viên) |
| GET | `/api/exams/{examId}/reviews/overview` | `EXAM_REVIEW_VIEW_ALL` | Tổng quan tiến độ |
| GET | `/api/exams/{examId}/reviews/progress` | `EXAM_REVIEW_VIEW_ALL` | Bảng tiến độ từng phân công |

### Mã lỗi

| HTTP | Ý nghĩa |
|---|---|
| 401 | Chưa đăng nhập / token hết hạn |
| 403 | Thiếu quyền, không phải chủ assignment, hoặc kết quả chưa publish |
| 404 | Không tồn tại (assignment / attempt / exam) |
| 409 | Đã nộp phiếu, hoặc trùng phân công |
| 422 | Điểm vượt rubric, tiêu chí không tồn tại, thiếu dữ liệu |

Mọi response lỗi trả về `{ status, code, message, errors, correlationId, timestamp }`.

### Permission

| Permission | STUDENT | TEACHER | ADMIN |
|---|---|---|---|
| `EXAM_REVIEW_READ` | ✔ | ✔ | ✔ (toàn bộ) |
| `EXAM_REVIEW_CREATE` | ✔ | — | ✔ |
| `EXAM_REVIEW_ASSIGN` | — | ✔ | ✔ |
| `EXAM_REVIEW_VIEW_ALL` | — | ✔ | ✔ |

Khai báo bằng `ensurePermission("EXAM_REVIEW", ...)` trong `RoleDataInitializer` (đặt **trước** `upsertRole`).

## 6. Audit

Bảng `exam_review_audit_log`: `exam_id`, `assignment_id`, `attempt_id`, `action` (`ASSIGN`/`SUBMIT`/`SKIP`), `actor_id`, `before_state`, `after_state` (JSON), `correlation_id`, `created_at`.

`ExamReviewAuditService.record(...)` dùng `Propagation.REQUIRES_NEW` để audit không bị rollback khi transaction nghiệp vụ thất bại; `correlationId` lấy từ `CorrelationIdFilter.currentId()`.

## 7. Mapping Acceptance Criteria (SRS UFR-EXM-012)

| AC | Nội dung | Cài đặt | Test |
|---|---|---|---|
| AC1 | Giáo viên cấu hình & phân công reviewer | `Exam` 5 cột + `POST /{examId}/reviews/assign` | `assignCreatesSelfAndPeerAssignments`, `assignIsIdempotent` |
| AC2 | Sinh viên chấm theo rubric (có ẩn danh) | `GET /reviews/my/{id}`, `POST /reviews/{id}/submit` | `anonymousReviewHidesAuthorIdentity`, `submitReviewRejectsPointsAboveRubricMaximum` |
| AC3 | Kết quả lưu riêng, không ảnh hưởng điểm chính thức | `exam_review_*` tách bảng, không ghi `finalScore` | `peerReviewDoesNotChangeFinalScore` |
| AC4 | Audit + notification đúng một lần | `ExamReviewAuditService`, `NotificationService.createOnce` | `auditLogIsWrittenWithCorrelationId` |

## 8. Rủi ro & biện pháp

| Rủi ro | Biện pháp |
|---|---|
| Regression điểm Course | Không sửa `ExamAttempt.finalScore` / `CourseAssessmentService`; có test `peerReviewDoesNotChangeFinalScore` |
| Rò rỉ danh tính khi ẩn danh | DTO tách riêng `authorLabel` / `reviewerLabel`, không trả entity `User`; có test `anonymousReviewHidesAuthorIdentity` |
| Bấm nút nhiều lần / gọi lại API | Unique constraint + kiểm tra trong service → 409; có test `assignIsIdempotent`, `submitReviewTwiceConflicts` |
| Ảnh hưởng flow nộp bài hiện tại | Không sửa `ExamAttemptService.gradeAndSubmit` — phân công là hành động riêng của giáo viên |
| Chưa xác minh | Quota chấm chéo theo course, tích hợp điểm chấm chéo vào điểm course — nằm ngoài phạm vi đã chốt |

## 9. Hướng dẫn dùng (UI)

1. **Giáo viên**: mở form tạo/sửa đề thi → mục *Self / Peer review* → bật *self assessment* / *peer review*, chọn số reviewer (1–5), chọn *Hide reviewer identity*, *Show reference answer*.
2. **Giáo viên**: sau khi sinh viên nộp bài → mở `/exams/{examId}/reviews` → bấm **Assign reviewers** → xem bảng tiến độ.
3. **Sinh viên**: `/student/reviews` → chọn việc chấm → chấm từng tiêu chí + nhận xét tổng → **Submit review** (1 lần).
4. **Sinh viên**: `/student/feedback` xem nhận xét nhận được (sau khi giáo viên publish kết quả).
