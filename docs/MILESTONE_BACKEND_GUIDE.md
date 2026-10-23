# Milestone Backend Guide

## Phạm vi

Module này triển khai luồng tạo milestone theo US-PRJ-002-03, xem danh sách theo US-PRJ-002-01 và xem chi tiết theo US-PRJ-002-02:

- Milestone và checklist lưu trong database.
- Deadline được kiểm tra theo đồng hồ server.
- Rubric dùng trọng số `BigDecimal` và phải có tổng đúng `100.00`.
- Hỗ trợ `NO_LATE` và `ALLOW_LATE`.
- Project, tenant, rubric và reviewer hiện được cung cấp qua mock integration adapter.
- Có idempotency, audit, outbox event và correlation ID.
- Danh sách được phân trang và luôn sắp xếp theo `deadline ASC`, sau đó `id ASC`.
- Chi tiết trả checklist đúng thứ tự, rubric snapshot/version, reviewer, late policy và múi giờ tenant.
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
Second in-scope project: 55555555-5555-5555-5555-555555555555
Tenant:   aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa
Rubric:   22222222-2222-2222-2222-222222222222
Reviewer: 33333333-3333-3333-3333-333333333333
Out of scope project: 44444444-4444-4444-4444-444444444444
```

Mock adapter được bật khi profile `milestone-real-integrations` không active.

Các trạng thái mock Project có thể cấu hình:

```properties
milestone.mock.project-status=ACTIVE
milestone.mock.tenant-active=true
milestone.mock.mentor-assigned=true
milestone.mock.tenant-time-zone=Asia/Ho_Chi_Minh
```

Đặt project thành `COMPLETED` hoặc `CANCELLED` để kiểm tra response `409`. Đặt tenant/assignment thành `false` để kiểm tra `403`.

Project `COMPLETED` hoặc `CANCELLED` vẫn xem được danh sách và chi tiết; giới hạn trạng thái chỉ áp dụng cho thao tác tạo.

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

Response chi tiết không phụ thuộc navigation state phía frontend. Backend đọc lại Project scope trước, sau đó mới tìm milestone bằng đồng thời `milestoneId`, `projectId` và `tenantId`:

```json
{
  "id": "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
  "project": {
    "id": "11111111-1111-1111-1111-111111111111",
    "name": "OJT Management System",
    "status": "ACTIVE"
  },
  "title": "Sprint 1 Delivery",
  "description": "First milestone",
  "deadline": "2026-11-01T10:00:00Z",
  "tenantTimeZone": "Asia/Ho_Chi_Minh",
  "mandatory": true,
  "status": "PLANNED",
  "checklist": [
    {
      "id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
      "content": "Source code pushed",
      "mandatory": true,
      "completed": false,
      "orderIndex": 0
    }
  ],
  "rubric": {
    "snapshotId": "22222222-2222-2222-2222-222222222222",
    "name": "Milestone Delivery Rubric",
    "version": "1.0",
    "criteria": [
      { "code": "FUNCTIONALITY", "name": "Functionality", "weight": 50.00, "maxScore": 5.00 }
    ]
  },
  "reviewer": {
    "id": "33333333-3333-3333-3333-333333333333",
    "displayName": "Mentor Reviewer"
  },
  "latePolicy": {
    "type": "ALLOW_LATE",
    "lateUntil": "2026-11-03T10:00:00Z",
    "penaltyPercent": 10.00
  },
  "version": 0,
  "createdAt": "2026-10-23T08:00:00Z",
  "createdBy": "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"
}
```

`deadline` và `createdAt` vẫn là UTC instant. `tenantTimeZone` là IANA Zone ID để client chuyển đổi chính xác và hiển thị kèm offset. Checklist được sắp xếp theo `orderIndex` trước khi trả về.

Quy tắc chống lộ dữ liệu:

- Project ngoài scope trả `403` trước khi tra milestone.
- Project trong scope nhưng milestone không tồn tại hoặc thuộc project khác trả `404`.
- Rubric/reviewer của milestone đã lưu được đọc qua contract riêng dành cho detail; adapter thật phải trả đúng snapshot lịch sử, kể cả khi resource không còn được chọn cho milestone mới.
- Lỗi đọc dependency nội bộ trả `500 MILESTONE_DEPENDENCY_ERROR` với correlation ID, không trả nội dung resource liên quan.

## API xem danh sách

```http
GET /api/projects/{projectId}/milestones?page=0&size=20
Authorization: Bearer <accessToken>
```

Ví dụ:

```bash
curl 'http://localhost:8080/api/projects/11111111-1111-1111-1111-111111111111/milestones?page=0&size=20' \
  -H 'Authorization: Bearer <accessToken>'
```

Quy tắc phân trang:

- `page` mặc định là `0` và không được âm.
- `size` mặc định là `20`, giá trị hợp lệ từ `1` đến `100`.
- Client không cần truyền sort. Backend luôn sắp xếp theo `deadline ASC`, sau đó `id ASC` để kết quả ổn định giữa các trang.
- Query luôn lọc đồng thời bằng `projectId` và `tenantId`.
- API danh sách không tải checklist để tránh payload lớn và N+1 query. Dùng API chi tiết khi cần checklist.

Response mẫu:

```json
{
  "project": {
    "id": "11111111-1111-1111-1111-111111111111",
    "name": "OJT Management System",
    "status": "ACTIVE"
  },
  "content": [
    {
      "id": "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
      "title": "Sprint 1 Delivery",
      "description": "First milestone",
      "deadline": "2026-11-01T10:00:00Z",
      "status": "PLANNED",
      "mandatory": true,
      "rubricSnapshotId": "22222222-2222-2222-2222-222222222222",
      "reviewerId": "33333333-3333-3333-3333-333333333333",
      "latePolicyType": "ALLOW_LATE",
      "lateUntil": "2026-11-03T10:00:00Z",
      "latePenaltyPercent": 10.00,
      "version": 0,
      "createdAt": "2026-10-23T08:00:00Z"
    }
  ],
  "page": 0,
  "size": 20,
  "totalElements": 1,
  "totalPages": 1,
  "hasNext": false,
  "hasPrevious": false
}
```

Project chưa có milestone trả `200` với `content: []`. Đây không phải lỗi `404`.

`size=0`, `size=101`, `page=-1` hoặc giá trị phân trang không phải số trả `422` với lỗi gắn đúng field.

API danh sách là read-only nên không tạo audit log, outbox event hoặc idempotency record.

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
| `200` | Xem danh sách/chi tiết thành công, bao gồm danh sách rỗng |
| `201` | Tạo thành công hoặc replay idempotent thành công |
| `401` | Phiên hoặc access token không hợp lệ |
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
- `TenantSettingsPort`
- `CurrentTenantProvider`
- `CurrentActorProvider`

Quy trình tích hợp:

1. Tạo adapter thật implement các interface trên.
2. Adapter Project phải implement riêng `requireProjectForCreation` và `requireProjectForRead`; kiểm tra tenant, Mentor assignment, project status và áp dụng locking thống nhất với thao tác đổi trạng thái Project.
3. Adapter Rubric phải tách quy tắc create và read: create chỉ cho snapshot active/trong scope; read detail phải resolve đúng snapshot lịch sử đã lưu và không trả dữ liệu resource ngoài scope trong lỗi.
4. Adapter Reviewer phải kiểm tra active/assignment khi create; read detail resolve reviewer đã lưu mà không biến một lần deactivate sau đó thành dữ liệu milestone bị hỏng.
5. Cung cấp actor/tenant UUID thật từ security context.
6. Adapter Tenant Settings phải trả `ZoneId` của tenant để API detail cung cấp múi giờ hiển thị.
7. Bật profile `milestone-real-integrations` để tắt mock adapter.
8. Thêm foreign key cho `project_id`, `rubric_snapshot_id`, `reviewer_id` khi schema owner tương ứng đã ổn định.

Không cần sửa `MilestoneCommandService`, request hoặc response khi thay adapter.

## Chạy test

Chạy test của module:

```bash
bash mvnw -q -Dtest=MilestoneValidatorTest,MilestoneAccessPolicyTest,MilestoneIntegrationTest test
```

Nếu JDK/container không cho Mockito tự attach Byte Buddy agent, chạy:

```bash
bash mvnw -q \
  -Dtest=MilestoneValidatorTest,MilestoneAccessPolicyTest,MilestoneIntegrationTest \
  -DargLine=-javaagent:$HOME/.m2/repository/net/bytebuddy/byte-buddy-agent/1.14.19/byte-buddy-agent-1.14.19.jar \
  test
```

Chạy toàn bộ backend:

```bash
bash mvnw test
```

Tại thời điểm module được thêm, test suite cũ của repository còn lỗi độc lập ở `ModuleGroupControllerTest` do thiếu mock security bean và một assertion có sẵn trong `QuestionIntegrationTest`. Test Milestone có thể chạy độc lập bằng command phía trên.
