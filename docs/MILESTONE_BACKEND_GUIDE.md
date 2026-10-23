# Milestone Backend Guide

## Phạm vi

Module này triển khai luồng tạo milestone theo US-PRJ-002-03:

- Milestone và checklist lưu trong database.
- Deadline được kiểm tra theo đồng hồ server.
- Rubric dùng trọng số `BigDecimal` và phải có tổng đúng `100.00`.
- Hỗ trợ `NO_LATE` và `ALLOW_LATE`.
- Project, tenant, rubric và reviewer hiện được cung cấp qua mock integration adapter.
- Có idempotency, audit, outbox event và correlation ID.
- Không tạo database index. Unique constraint của checklist/idempotency vẫn được giữ để bảo vệ tính toàn vẹn và chống dữ liệu trùng.

`Submission`, `SubmissionVersion` và `MilestoneReview` không được tạo trong request tạo milestone.

## Chạy backend

Từ thư mục `backend`:

```bash
bash mvnw spring-boot:run
```

Database mặc định là H2 in-memory và schema được Hibernate tạo lại mỗi lần khởi động.

Tài khoản Mentor tạm thời dùng role `TEACHER`:

```text
email: teacher@example.com
password: password123
```

Role `TEACHER` được cấp `MILESTONE_CREATE` và `MILESTONE_READ` trong môi trường hiện tại.

## Mock resource IDs

```text
Project:  11111111-1111-1111-1111-111111111111
Tenant:   aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa
Rubric:   22222222-2222-2222-2222-222222222222
Reviewer: 33333333-3333-3333-3333-333333333333
```

Mock adapter được bật khi profile `milestone-real-integrations` không active.

Các trạng thái mock Project có thể cấu hình:

```properties
milestone.mock.project-status=ACTIVE
milestone.mock.tenant-active=true
milestone.mock.mentor-assigned=true
```

Đặt project thành `COMPLETED` hoặc `CANCELLED` để kiểm tra response `409`. Đặt tenant/assignment thành `false` để kiểm tra `403`.

## Lấy access token

```bash
curl -X POST http://localhost:8080/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"teacher@example.com","password":"password123"}'
```

Lấy `accessToken` từ response và sử dụng trong các request dưới đây.

## API mở form

```http
GET /api/projects/{projectId}/milestones/create-options
Authorization: Bearer <accessToken>
```

Ví dụ:

```bash
curl http://localhost:8080/api/projects/11111111-1111-1111-1111-111111111111/milestones/create-options \
  -H 'Authorization: Bearer <accessToken>'
```

Response chứa project read-only, rubric được phép dùng và reviewer hợp lệ.

## API tạo milestone

```http
POST /api/projects/{projectId}/milestones
Authorization: Bearer <accessToken>
Idempotency-Key: <unique-client-key>
Content-Type: application/json
```

Ví dụ:

```bash
curl -X POST \
  http://localhost:8080/api/projects/11111111-1111-1111-1111-111111111111/milestones \
  -H 'Authorization: Bearer <accessToken>' \
  -H 'Idempotency-Key: milestone-create-001' \
  -H 'Content-Type: application/json' \
  -d '{
    "title": "Sprint 1 Delivery",
    "description": "Bàn giao source code và demo",
    "deadline": "2026-11-01T10:00:00Z",
    "mandatory": true,
    "checklist": [
      {
        "content": "Source code đã push",
        "mandatory": true,
        "orderIndex": 0
      },
      {
        "content": "Demo đã sẵn sàng",
        "mandatory": true,
        "orderIndex": 1
      }
    ],
    "rubricSnapshotId": "22222222-2222-2222-2222-222222222222",
    "reviewerId": "33333333-3333-3333-3333-333333333333",
    "latePolicy": {
      "type": "ALLOW_LATE",
      "lateUntil": "2026-11-03T10:00:00Z",
      "penaltyPercent": 10.00
    }
  }'
```

Thành công trả `201 Created`, `Location` header và milestone vừa tạo. Mọi response có `X-Correlation-ID`.

### NO_LATE

Khi không cho nộp trễ, phải bỏ hoàn toàn `lateUntil` và `penaltyPercent`:

```json
{
  "latePolicy": {
    "type": "NO_LATE"
  }
}
```

Nếu vẫn truyền hai field trên, API trả `422`.

## API xem chi tiết

```http
GET /api/projects/{projectId}/milestones/{milestoneId}
Authorization: Bearer <accessToken>
```

## Idempotency

- `Idempotency-Key` là bắt buộc và tối đa 100 ký tự.
- Gửi lại cùng key và cùng payload trả milestone đã tạo, không tạo thêm checklist, audit hoặc outbox event.
- Cùng key nhưng payload khác trả `409`.
- Key được scope theo tenant, actor và operation.
- Khóa concurrent hiện dùng striped lock trong một application process kết hợp unique constraint database.
- Khi triển khai nhiều backend instance, thay striped lock bằng distributed lock hoặc cơ chế database claim/wait nhưng giữ nguyên contract API.

## Validation và status code

| Status | Ý nghĩa |
|---|---|
| `201` | Tạo thành công hoặc replay idempotent thành công |
| `403` | Tenant inactive hoặc Mentor không còn assignment/quyền |
| `404` | Project/milestone không tồn tại trong scope |
| `409` | Project không cho tạo hoặc idempotency key có payload khác |
| `422` | Request, checklist, rubric hoặc late policy không hợp lệ |

Ví dụ lỗi:

```json
{
  "status": 422,
  "code": "VALIDATION_FAILED",
  "message": "Milestone data is invalid",
  "errors": {
    "deadline": [
      "Deadline must be in the future according to server time"
    ]
  },
  "correlationId": "...",
  "timestamp": "..."
}
```

## Audit và outbox

Một lần tạo thành công sinh:

- Một row `milestone_audit_logs` với action `MILESTONE_CREATED`.
- Một row `outbox_events` với type `MILESTONE_CREATED` và status `PENDING`.

Audit và outbox được lưu cùng transaction với Milestone. Nếu ghi một trong hai thất bại, toàn bộ milestone/checklist/idempotency record rollback.

Publisher gửi outbox tới message broker chưa nằm trong phạm vi hiện tại. Khi bổ sung publisher, retry phải cập nhật cùng row và giữ nguyên `event_id`; không tạo event mới cho mỗi lần retry.

## Thay mock adapter bằng module thật

Các contract cần implement nằm trong:

```text
system/project/milestone/integration/port
```

Bao gồm:

- `ProjectMilestonePort`
- `RubricCatalogPort`
- `ReviewerDirectoryPort`
- `CurrentTenantProvider`
- `CurrentActorProvider`

Quy trình tích hợp:

1. Tạo adapter thật implement các interface trên.
2. Adapter Project phải kiểm tra tenant, Mentor assignment, project status và áp dụng locking thống nhất với thao tác đổi trạng thái Project.
3. Adapter Rubric phải chỉ trả version/snapshot active và trong scope; không trả dữ liệu resource ngoài scope trong lỗi.
4. Adapter Reviewer phải kiểm tra active, tenant và project assignment.
5. Cung cấp actor/tenant UUID thật từ security context.
6. Bật profile `milestone-real-integrations` để tắt mock adapter.
7. Thêm foreign key cho `project_id`, `rubric_snapshot_id`, `reviewer_id` khi schema owner tương ứng đã ổn định.

Không cần sửa `MilestoneCommandService`, request hoặc response khi thay adapter.

## Chạy test

Chạy test của module:

```bash
bash mvnw -q -Dtest=MilestoneValidatorTest,MilestoneIntegrationTest test
```

Chạy toàn bộ backend:

```bash
bash mvnw test
```

Tại thời điểm module được thêm, test suite cũ của repository còn lỗi độc lập ở `ModuleGroupControllerTest` do thiếu mock security bean và một assertion có sẵn trong `QuestionIntegrationTest`. Test Milestone có thể chạy độc lập bằng command phía trên.
