# Hướng dẫn sử dụng và kiểm thử Schedule Conflict Detection

## 1. Phạm vi chức năng

Chức năng kiểm tra một `CalendarVersion` có trạng thái `DRAFT` theo hai phạm vi:

1. So sánh các session trong cùng DRAFT.
2. So sánh các session của DRAFT với session thuộc version `ACTIVE` của các lớp khác.

Hai session chỉ xung đột khi thời gian overlap và có ít nhất một tài nguyên dùng chung:

- Cùng `trainerId`: `TRAINER_CONFLICT`.
- Cùng room không rỗng: `ROOM_CONFLICT`.
- Cùng trainer và room: một conflict chứa cả hai loại.

Session `CANCELLED`, session có `isActive=false`, version không active và calendar không active sẽ không tham gia kiểm tra.

`meetingLink` không nằm trong phạm vi của chức năng này.

## 2. Quy tắc overlap

Khoảng thời gian được xử lý theo dạng nửa mở `[startTime, endTime)`:

```text
startA < endB && endA > startB
```

| Session A | Session B | Overlap |
|---|---|---|
| 09:00–11:00 | 10:00–12:00 | Có |
| 09:00–11:00 | 11:00–12:00 | Không |
| 09:00–12:00 | 10:00–11:00 | Có |
| 09:00–11:00 | 09:00–11:00 | Có |

Phép so sánh sử dụng toàn bộ `LocalDateTime`. Hai session có cùng giờ nhưng khác ngày không overlap.

## 3. API kiểm tra toàn bộ DRAFT

### Request

```http
GET /api/calendar-versions/{calendarVersionId}/conflicts
Authorization: Bearer <access-token>
```

Permission yêu cầu:

```text
CALENDARVERSION_READ
```

Ví dụ:

```bash
curl --request GET \
  'http://localhost:8080/api/calendar-versions/92001/conflicts' \
  --header 'Authorization: Bearer <ACCESS_TOKEN>'
```

### Response thành công

Ví dụ rút gọn:

```json
{
  "calendarVersionId": 92001,
  "hasConflict": true,
  "conflicts": [
    {
      "session": {
        "id": 93001,
        "trainerId": 101,
        "room": "R01",
        "startTime": "2026-10-21T09:00:00",
        "endTime": "2026-10-21T11:00:00"
      },
      "conflictingSession": {
        "id": 93002,
        "trainerId": 101,
        "room": "R02",
        "startTime": "2026-10-21T10:00:00",
        "endTime": "2026-10-21T12:00:00"
      },
      "conflictTypes": [
        "TRAINER_CONFLICT"
      ]
    }
  ],
  "validationErrors": {}
}
```

Ý nghĩa các field:

| Field | Ý nghĩa |
|---|---|
| `calendarVersionId` | DRAFT được kiểm tra |
| `hasConflict` | `true` khi có ít nhất một cặp conflict |
| `conflicts` | Danh sách cặp session xung đột |
| `conflictTypes` | Conflict giảng viên, phòng hoặc cả hai |
| `validationErrors` | Session có thời gian thiếu hoặc `endTime <= startTime` |

Ví dụ lỗi dữ liệu session:

```json
{
  "calendarVersionId": 92001,
  "hasConflict": false,
  "conflicts": [],
  "validationErrors": {
    "sessions.93001.time": [
      "Session start time and end time are required, and end time must be after start time."
    ]
  }
}
```

Client phải kiểm tra cả `hasConflict` và `validationErrors`.

### HTTP status

| Status | Trường hợp |
|---|---|
| `200 OK` | Kiểm tra thành công, có hoặc không có conflict |
| `400 Bad Request` | ID không dương hoặc calendar không có `classId` hợp lệ |
| `401 Unauthorized` | Chưa đăng nhập/token không hợp lệ |
| `403 Forbidden` | Không có `CALENDARVERSION_READ` |
| `404 Not Found` | Version, calendar hoặc dữ liệu tương ứng không còn active |
| `409 Conflict` | Version được yêu cầu không phải DRAFT |

### Activate DRAFT

Sau khi xử lý hết conflict, gọi:

```http
POST /api/calendars/{calendarId}/versions/{versionId}/activate
Authorization: Bearer <access-token>
```

Permission yêu cầu:

```text
CALENDARVERSION_UPDATE
```

Ví dụ:

```bash
curl --request POST \
  'http://localhost:8080/api/calendars/91001/versions/92001/activate' \
  --header 'Authorization: Bearer <ACCESS_TOKEN>'
```

Luồng activate tự động kiểm tra conflict lại trong cùng transaction. Nếu thành công, ACTIVE cũ của calendar được chuyển thành `INACTIVE`, target DRAFT chuyển thành `ACTIVE`, đồng thời hệ thống ghi `activatedAt` và `activatedBy`.

Các trường hợp bị chặn:

| Status | Code/trường hợp |
|---|---|
| `409 Conflict` | `CALENDAR_ACTIVATION_CONFLICT`, response chứa toàn bộ `conflictCheck` |
| `409 Conflict` | Target không còn là DRAFT |
| `422 Unprocessable Entity` | `CALENDAR_VERSION_EMPTY` |
| `422 Unprocessable Entity` | `CALENDAR_ACTIVATION_VALIDATION_FAILED` |

Policy activate vẫn bỏ qua cờ legacy `Session.isOverridden`, nhưng hỗ trợ hồ sơ audit override mới. Chỉ conflict type được một resolution `APPROVED`, còn hiệu lực và đúng policy mới được waive. `ACKNOWLEDGED` vẫn chặn activate. Xem hướng dẫn đầy đủ tại [SCHEDULE_CONFLICT_RESOLUTION.md](SCHEDULE_CONFLICT_RESOLUTION.md).

## 4. Lấy access token để test

Chạy ứng dụng:

```bash
bash mvnw spring-boot:run
```

Đăng nhập bằng tài khoản admin seed. Giá trị mặc định là `admin@example.com/password123`, trừ khi đã override bằng cấu hình môi trường:

```bash
curl --request POST \
  'http://localhost:8080/api/auth/login' \
  --header 'Content-Type: application/json' \
  --data '{
    "email": "admin@example.com",
    "password": "password123"
  }'
```

Lấy `accessToken` trong response và gắn vào header `Authorization: Bearer ...`.

Cũng có thể gọi API qua Swagger UI:

```text
http://localhost:8080/swagger-ui/index.html
```

Admin được dùng trong ví dụ vì role `ADMIN` có toàn bộ permission. Role `TEACHER` cũng được seed `CALENDARVERSION_READ` để có thể chạy detection trước khi gửi conflict resolution request.

## 5. Tạo dữ liệu test thủ công trên H2

### 5.1. Mở H2 Console

Sau khi ứng dụng chạy, mở:

```text
http://localhost:8080/h2-console
```

Thông tin kết nối mặc định:

```text
JDBC URL: jdbc:h2:mem:base_crud
User Name: sa
Password: <để trống>
```

### 5.2. Insert fixture

Đoạn SQL dưới đây chỉ dùng trong môi trường local/test. Nó tạo:

- Java 01, version DRAFT chứa S01/S02/S03.
- Java 02, version ACTIVE chứa S10.
- Một DRAFT khác của Java 02 để xác nhận query không đọc nhầm.

```sql
INSERT INTO calendars
    (id, is_active, created_at, updated_at, class_id, last_issued_version_number, name)
VALUES
    (91001, TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 90001, 2, 'Java 01'),
    (91002, TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 90002, 2, 'Java 02');

INSERT INTO calendar_versions
    (id, is_active, created_at, updated_at, calendar_id, version_number, status, name)
VALUES
    (92001, TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 91001, 2, 'DRAFT', 'Java 01 - Draft v2'),
    (92002, TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 91002, 1, 'ACTIVE', 'Java 02 - Active v1'),
    (92003, TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 91002, 2, 'DRAFT', 'Java 02 - Draft v2');

INSERT INTO sessions
    (id, is_active, created_at, updated_at, calendar_version_id,
     class_code, trainer_id, trainer_name, title,
     start_time, end_time, room, status, is_overridden, version)
VALUES
    (93001, TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 92001,
     'JAVA-01', 101, 'Trainer T01', 'S01',
     TIMESTAMP '2026-10-21 09:00:00', TIMESTAMP '2026-10-21 11:00:00',
     'R01', 'SCHEDULED', FALSE, 0),

    (93002, TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 92001,
     'JAVA-01', 101, 'Trainer T01', 'S02',
     TIMESTAMP '2026-10-21 10:00:00', TIMESTAMP '2026-10-21 12:00:00',
     'R02', 'SCHEDULED', FALSE, 0),

    (93003, TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 92001,
     'JAVA-01', 102, 'Trainer T02', 'S03',
     TIMESTAMP '2026-10-21 10:00:00', TIMESTAMP '2026-10-21 12:00:00',
     'R01', 'SCHEDULED', FALSE, 0),

    (93010, TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 92002,
     'JAVA-02', 101, 'Trainer T01', 'S10',
     TIMESTAMP '2026-10-21 10:00:00', TIMESTAMP '2026-10-21 12:00:00',
     'R03', 'SCHEDULED', FALSE, 0),

    (93011, TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 92003,
     'JAVA-02', 102, 'Trainer T02', 'S11 - must be ignored',
     TIMESTAMP '2026-10-21 10:00:00', TIMESTAMP '2026-10-21 12:00:00',
     'R01', 'SCHEDULED', FALSE, 0);
```

Gọi:

```http
GET /api/calendar-versions/92001/conflicts
```

Kết quả mong đợi có bốn cặp:

| Cặp | Loại |
|---|---|
| S01 – S02 | `TRAINER_CONFLICT` |
| S01 – S03 | `ROOM_CONFLICT` |
| S01 – S10 | `TRAINER_CONFLICT` |
| S02 – S10 | `TRAINER_CONFLICT` |

S11 không xuất hiện vì thuộc DRAFT của lớp khác.

Không dùng SQL fixture này trên database production. Với cấu hình H2 `create-drop`, dữ liệu local sẽ mất khi dừng ứng dụng.

## 6. Checklist test API thủ công

### Case 1 — Overlap một phần

```text
A: 09:00–11:00, trainer 101
B: 10:00–12:00, trainer 101
```

Mong đợi: `TRAINER_CONFLICT`.

### Case 2 — Hai khoảng chạm biên

```text
A: 09:00–11:00, trainer 101
B: 11:00–12:00, trainer 101
```

Mong đợi: không conflict.

### Case 3 — Cùng room

```text
A: room R01, 09:00–11:00
B: room " r01 ", 10:00–12:00
```

Mong đợi: `ROOM_CONFLICT`. Room được trim và so sánh không phân biệt hoa thường.

### Case 4 — Room rỗng

Hai session overlap, khác trainer và cùng có room rỗng.

Mong đợi: không conflict.

### Case 5 — Cùng trainer và room

Mong đợi một conflict có:

```json
["TRAINER_CONFLICT", "ROOM_CONFLICT"]
```

### Case 6 — Khác ngày

Hai session cùng giờ và cùng trainer nhưng khác ngày.

Mong đợi: không conflict.

### Case 7 — Session bị hủy hoặc soft-delete

Đổi `status` thành `CANCELLED` hoặc `is_active` thành `FALSE`.

Mong đợi: session không xuất hiện trong conflict.

### Case 8 — Version không phải DRAFT

Gọi endpoint với ID của version ACTIVE `92002`.

Mong đợi: `409 Conflict`.

### Case 9 — DRAFT của lớp khác

S11 trong fixture overlap cả room và thời gian với S03.

Mong đợi: S11 không xuất hiện vì chỉ ACTIVE của lớp khác được so sánh.

## 7. Chạy automated tests

### Compile

```bash
bash mvnw -q -DskipTests compile
```

### Chỉ chạy test conflict detection

```bash
bash mvnw -q \
  -Dtest=ConflictDetectionServiceImplTest,ConflictDetectionRepositoryTest \
  test
```

### Chỉ chạy test activate CalendarVersion

```bash
bash mvnw -q \
  -Dtest=CalendarVersionActivationServiceTest,CalendarVersionActivationIntegrationTest,CalendarVersionActivationConcurrencyTest,CalendarVersionActivationControllerTest \
  test
```

Phạm vi test hiện tại:

- Bốn trường hợp overlap chính.
- Cùng giờ nhưng khác ngày.
- Conflict trainer trong DRAFT.
- Conflict room trong DRAFT.
- Một cặp có cả hai conflict type.
- Room rỗng không tạo conflict.
- DRAFT so với ACTIVE của lớp khác.
- Thời gian session không hợp lệ.
- ID version không hợp lệ và version không phải DRAFT.
- JPQL chỉ lấy đúng DRAFT và ACTIVE của lớp khác.
- Loại session CANCELLED và soft-deleted.
- Activate thành công và hạ ACTIVE cũ thành INACTIVE.
- Chặn DRAFT rỗng, DRAFT có conflict hoặc validation error.
- Ghi chính xác `activatedAt` và `activatedBy`.
- HTTP 401, 403, 409 và 200 của endpoint activate.
- Hai lớp activate đồng thời: chỉ một request thành công nếu lịch xung đột.

### Chạy toàn bộ test suite

```bash
bash mvnw -q test
```

Tại thời điểm cập nhật tài liệu, các test conflict detection, conflict resolution và activate CalendarVersion đều pass. Toàn bộ suite còn lỗi độc lập trong `ModuleGroupControllerTest`: Web MVC test context thiếu bean `RefreshTokenService` cho `JwtAuthenticationFilter`.

## 8. Các API liên quan

### API hiện đã có

| API | Mục đích |
|---|---|
| `GET /api/calendar-versions/{id}/conflicts` | Kiểm tra toàn bộ một DRAFT |
| `POST /api/calendars/{calendarId}/versions/{versionId}/activate` | Kiểm tra lại và activate DRAFT trong transaction |
| `POST /api/sessions/check-conflict` | Preview conflict cho một session trước khi lưu |
| `POST /api/sessions` | Tạo session, có kiểm tra conflict hiện tại |
| `POST /api/v1/calendar-versions/{id}/bulk-sessions` | Lưu hàng loạt session vào DRAFT |

API `POST /api/sessions/check-conflict` hiện dùng query conflict cũ: quét toàn bộ version và có thêm `meetingLink`. Nên refactor API này dùng chung conflict policy với module detection để tránh hai nơi trả kết quả khác nhau.

API activate sử dụng database pessimistic lock chung cho các calendar. Cơ chế này serialize thao tác publish, ngăn hai DRAFT của hai lớp khác nhau cùng vượt qua conflict detection khi được activate đồng thời.

### API không cần thêm ngay

- Không cần endpoint riêng cho conflict nội bộ và conflict bên ngoài; response hiện tại đã trả chung đầy đủ.
- Chưa cần API lưu conflict vào database vì conflict là dữ liệu tính toán.
- Các endpoint conflict resolution đã được bổ sung để request, approve, reject, revoke và xem audit trail. Policy activate chỉ bỏ qua đúng conflict type đã được approve.

### Nâng cấp tùy chọn khi dữ liệu lớn

Có thể mở rộng endpoint hiện tại bằng query parameter thay vì tạo nhiều API:

```http
GET /api/calendar-versions/{id}/conflicts?scope=ALL&type=TRAINER_CONFLICT
```

Các filter `scope`, `type` và pagination chỉ cần thiết khi số lượng session/conflict lớn.

## 9. Lưu ý vận hành

- Endpoint GET conflict chỉ đọc dữ liệu và không tự động sửa session.
- API activate luôn kiểm tra lại conflict trong transaction, không tin vào kết quả GET trước đó.
- `isOverridden=true` không làm conflict biến mất và không cho phép bypass activation; phải dùng audited conflict resolution.
- Room hiện là chuỗi, không phải `roomId`. Nếu hệ thống phòng có mã định danh ổn định, nên bổ sung `roomId` trong một migration riêng.
