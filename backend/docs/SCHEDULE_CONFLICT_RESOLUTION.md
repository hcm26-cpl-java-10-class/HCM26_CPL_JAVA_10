# Hướng dẫn Audit Override cho Schedule Conflict

## 1. Chức năng này giải quyết việc gì?

Calendar vẫn phát hiện conflict theo dữ liệu thật. Override không xóa conflict; nó tạo một hồ sơ ngoại lệ có người yêu cầu, người duyệt, lý do, bằng chứng và lịch sử thao tác.

Khi kiểm tra hoặc activate một `CalendarVersion` DRAFT, hệ thống phân conflict thành:

- `blockingConflictTypes`: các loại conflict vẫn chặn activate.
- `waivedConflictTypes`: các loại conflict được một override hợp lệ cho phép.
- `blocking`: cặp conflict này còn chặn hay không.

`canActivate=true` chỉ khi không còn validation error và không còn conflict blocking. API activate luôn tự chạy lại detection và kiểm tra override trong cùng transaction; kết quả GET trước đó không được dùng như một vé activate.

## 2. Ba trường hợp đã hỗ trợ

| `reasonCode` | Ý nghĩa | Có bỏ chặn activate? | Điều kiện chính |
|---|---|---:|---|
| `SHARED_CLASS_SESSION` | Hai lớp cố ý học chung một buổi | Có, sau khi được duyệt | Khác lớp, thời gian bắt đầu/kết thúc giống hệt nhau, có `referenceCode` |
| `ROOM_PARTITIONED` | Một phòng lớn được chia thành hai khu độc lập | Có, sau khi được duyệt | Khác lớp, chỉ conflict phòng, trainer khác nhau, cùng room, hai mô tả khu vực khác nhau, có `referenceCode` |
| `ACKNOWLEDGED_PENDING_RESOLUTION` | Đã biết conflict nhưng chưa xử lý xong | Không | Cặp session đang thực sự conflict; nên truyền `expectedResolutionAt` |

Hai trường hợp đầu tạo trạng thái `PENDING` và cần người khác duyệt. Trường hợp acknowledge tạo ngay trạng thái `ACKNOWLEDGED` nhưng conflict vẫn blocking.

Lưu ý: `Session.isOverridden`/`forceOverride` là cơ chế cũ ở API session và không có giá trị bypass activation. Chỉ hồ sơ conflict resolution `APPROVED`, còn hiệu lực và đúng policy mới được waive conflict.

## 3. Trạng thái và nguyên tắc audit

```text
SHARED_CLASS_SESSION / ROOM_PARTITIONED
PENDING ──approve──> APPROVED ──activate──> APPLIED
   │                     │
   └──reject──> REJECTED └──revoke──> REVOKED

ACKNOWLEDGED_PENDING_RESOLUTION
ACKNOWLEDGED (luôn blocking)

PENDING / ACKNOWLEDGED / APPROVED
        └──session thay đổi──> STALE (trạng thái hiệu lực được suy ra tự động)
```

Các action audit được lưu trong `auditTrail`:

- `REQUESTED`
- `ACKNOWLEDGED`
- `APPROVED`
- `REJECTED`
- `REVOKED`
- `APPLIED_ON_ACTIVATION`

Mỗi hồ sơ lưu snapshot của cặp session lúc tạo và optimistic `version` của cả hai session. Nếu session bị sửa, hủy hoặc soft-delete sau đó, hồ sơ cũ được trả về với `status=STALE`, không waive bất kỳ conflict nào và không thể dùng để activate.

Hệ thống áp dụng four-eyes control: `requestedBy` không được bằng `approvedBy`.

## 4. Permission

| Permission | API được phép |
|---|---|
| `CALENDARVERSION_READ` | Chạy conflict detection |
| `SCHEDULE_CONFLICT_RESOLUTION_READ` | Xem danh sách/chi tiết/audit trail |
| `SCHEDULE_CONFLICT_RESOLUTION_REQUEST` | Tạo request hoặc acknowledge |
| `SCHEDULE_CONFLICT_RESOLUTION_APPROVE` | Approve hoặc reject |
| `SCHEDULE_CONFLICT_RESOLUTION_REVOKE` | Revoke override đã approve |
| `CALENDARVERSION_UPDATE` | Activate DRAFT |

Initializer hiện cấp:

- `ADMIN`: toàn bộ permission, bao gồm approve/revoke.
- `TEACHER`: `CALENDARVERSION_READ`, `SCHEDULE_CONFLICT_RESOLUTION_READ` và `SCHEDULE_CONFLICT_RESOLUTION_REQUEST`.

Cần hai user khác nhau cho request và approve. Nếu user A tạo request thì chính user A không thể approve, kể cả khi user A có quyền ADMIN.

## 5. Danh sách API

Base path:

```text
/api/calendar-versions/{calendarVersionId}/conflict-resolutions
```

| Method | Path | Mục đích |
|---|---|---|
| `GET` | `/api/calendar-versions/{id}/conflicts` | Detection và áp dụng policy override vào kết quả |
| `POST` | `/api/calendar-versions/{id}/conflict-resolutions` | Request override hoặc acknowledge |
| `GET` | `/api/calendar-versions/{id}/conflict-resolutions` | Danh sách hồ sơ |
| `GET` | `/api/calendar-versions/{id}/conflict-resolutions/{resolutionId}` | Chi tiết và audit trail |
| `POST` | `/api/calendar-versions/{id}/conflict-resolutions/{resolutionId}/approve` | Duyệt request |
| `POST` | `/api/calendar-versions/{id}/conflict-resolutions/{resolutionId}/reject` | Từ chối request |
| `POST` | `/api/calendar-versions/{id}/conflict-resolutions/{resolutionId}/revoke` | Thu hồi override đã duyệt |
| `POST` | `/api/calendars/{calendarId}/versions/{versionId}/activate` | Kiểm tra lại và activate |

Session trong response được chuẩn hóa theo cặp: ID nhỏ hơn nằm ở `sessionId`, ID lớn hơn nằm ở `conflictingSessionId`. Vì vậy thứ tự có thể khác request nhưng `conflictKey`, ví dụ `101:205`, luôn ổn định.

## 6. Test bằng Swagger UI

### 6.1. Chạy ứng dụng và đăng nhập

```bash
bash mvnw spring-boot:run
```

Mở:

```text
http://localhost:8080/swagger-ui/index.html
```

Trong tag Authentication, gọi `POST /api/auth/login`:

```json
{
  "email": "admin@example.com",
  "password": "password123"
}
```

Sao chép `accessToken`. Nhấn **Authorize** ở đầu trang, nhập token theo hướng dẫn của hộp thoại. Nếu Swagger yêu cầu full value thì nhập `Bearer <accessToken>`; nếu scheme tự thêm prefix thì chỉ nhập token.

Để test four-eyes control cần đăng nhập lần lượt bằng hai user khác nhau và thay token trước bước approve.

### 6.2. Luồng test chuẩn

1. Dùng `GET /api/calendar-versions/{calendarVersionId}/conflicts`.
2. Chọn một phần tử trong `conflicts`; lấy `session.id`, `session.version`, `conflictingSession.id` và `conflictingSession.version`.
3. Gọi POST tạo resolution với token của requester.
4. Lưu `id` của response làm `resolutionId`.
5. Đăng nhập user approver khác requester và thay Bearer token.
6. Gọi POST `/approve`.
7. Chạy GET conflict lần nữa. Kiểm tra `blocking`, `blockingConflictTypes`, `waivedConflictTypes` và `canActivate`.
8. Khi mọi conflict đều hết blocking, gọi API activate.
9. GET chi tiết resolution. Trạng thái phải là `APPLIED`, audit trail có `APPLIED_ON_ACTIVATION`.

## 7. Test bằng Postman

### 7.1. Environment variables

Tạo environment và các biến:

| Variable | Ví dụ |
|---|---|
| `baseUrl` | `http://localhost:8080` |
| `requesterToken` | token của người tạo request |
| `approverToken` | token của người duyệt khác requester |
| `calendarId` | `91001` |
| `calendarVersionId` | `92001` |
| `sessionId` | `93002` |
| `conflictingSessionId` | `93010` |
| `sessionVersion` | `0` |
| `conflictingSessionVersion` | `0` |
| `resolutionId` | được lưu sau request |

Với request cần đăng nhập, chọn Authorization → Bearer Token và dùng `{{requesterToken}}` hoặc `{{approverToken}}`.

### 7.2. Tự lưu token sau login

Trong tab Tests của request login requester:

```javascript
const body = pm.response.json();
pm.environment.set("requesterToken", body.accessToken);
```

Ở request login approver, đổi tên biến thành `approverToken`.

### 7.3. Detection

```http
GET {{baseUrl}}/api/calendar-versions/{{calendarVersionId}}/conflicts
Authorization: Bearer {{requesterToken}}
```

Response rút gọn trước khi có override:

```json
{
  "calendarVersionId": 92001,
  "hasConflict": true,
  "hasBlockingConflict": true,
  "canActivate": false,
  "conflictCount": 1,
  "blockingConflictCount": 1,
  "approvedOverrideCount": 0,
  "acknowledgedCount": 0,
  "conflicts": [
    {
      "conflictKey": "93002:93010",
      "conflictTypes": ["TRAINER_CONFLICT"],
      "blockingConflictTypes": ["TRAINER_CONFLICT"],
      "waivedConflictTypes": [],
      "blocking": true,
      "resolutionId": null,
      "resolutionStatus": null,
      "resolutionReason": null
    }
  ],
  "validationErrors": {}
}
```

Có thể lưu tự động cặp đầu tiên trong Tests:

```javascript
const body = pm.response.json();
const conflict = body.conflicts[0];
pm.environment.set("sessionId", conflict.session.id);
pm.environment.set("conflictingSessionId", conflict.conflictingSession.id);
pm.environment.set("sessionVersion", conflict.session.version);
pm.environment.set("conflictingSessionVersion", conflict.conflictingSession.version);
```

### 7.4. Request trường hợp 1 — học chung buổi

```http
POST {{baseUrl}}/api/calendar-versions/{{calendarVersionId}}/conflict-resolutions
Authorization: Bearer {{requesterToken}}
Content-Type: application/json
```

```json
{
  "sessionId": {{sessionId}},
  "conflictingSessionId": {{conflictingSessionId}},
  "reasonCode": "SHARED_CLASS_SESSION",
  "justification": "Hai lớp tham dự chung workshop Spring Security",
  "referenceCode": "WS-SPRING-2026-01",
  "sessionVersion": {{sessionVersion}},
  "conflictingSessionVersion": {{conflictingSessionVersion}}
}
```

Hai session phải khác lớp và có `startTime`, `endTime` giống hệt nhau. Khi approve, policy này waive những loại conflict thực sự tồn tại trên cặp đó: trainer, room hoặc cả hai.

Trong Tests, lưu ID:

```javascript
pm.environment.set("resolutionId", pm.response.json().id);
```

### 7.5. Request trường hợp 2 — chia khu vực phòng

```json
{
  "sessionId": {{sessionId}},
  "conflictingSessionId": {{conflictingSessionId}},
  "reasonCode": "ROOM_PARTITIONED",
  "justification": "Hội trường được chia bằng vách cách âm cho hai lớp",
  "referenceCode": "FACILITY-APPROVAL-2026-018",
  "sessionArea": "Hall A - Zone 1",
  "conflictingSessionArea": "Hall A - Zone 2",
  "sessionVersion": {{sessionVersion}},
  "conflictingSessionVersion": {{conflictingSessionVersion}}
}
```

Policy từ chối nếu cặp còn conflict trainer, room rỗng/khác nhau hoặc hai mô tả area giống nhau.

### 7.6. Trường hợp 4 — acknowledge nhưng chưa giải quyết

```json
{
  "sessionId": {{sessionId}},
  "conflictingSessionId": {{conflictingSessionId}},
  "reasonCode": "ACKNOWLEDGED_PENDING_RESOLUTION",
  "justification": "Đã liên hệ trainer, đang chờ điều phối sang ca chiều",
  "expectedResolutionAt": "2026-10-25T17:00:00",
  "sessionVersion": {{sessionVersion}},
  "conflictingSessionVersion": {{conflictingSessionVersion}}
}
```

Response có `status=ACKNOWLEDGED`. Chạy detection lại sẽ thấy `acknowledgedCount` tăng nhưng `blocking=true` và `canActivate=false`.

### 7.7. Approve

Không có request body:

```http
POST {{baseUrl}}/api/calendar-versions/{{calendarVersionId}}/conflict-resolutions/{{resolutionId}}/approve
Authorization: Bearer {{approverToken}}
```

Response mong đợi:

```json
{
  "id": 55,
  "reasonCode": "SHARED_CLASS_SESSION",
  "status": "APPROVED",
  "waivedConflictTypes": ["TRAINER_CONFLICT"],
  "requestedBy": 11,
  "approvedBy": 22,
  "stale": false,
  "auditTrail": [
    {"action": "REQUESTED", "actorId": 11},
    {"action": "APPROVED", "actorId": 22}
  ]
}
```

Nếu dùng cùng token requester, API trả `409 CONFLICT_RESOLUTION_SELF_APPROVAL`.

### 7.8. Reject hoặc revoke

Reject chỉ áp dụng cho `PENDING`:

```http
POST {{baseUrl}}/api/calendar-versions/{{calendarVersionId}}/conflict-resolutions/{{resolutionId}}/reject
Authorization: Bearer {{approverToken}}
Content-Type: application/json

{"reason":"Không có xác nhận workshop từ Training Manager"}
```

Revoke chỉ áp dụng cho `APPROVED` và chỉ khi version còn DRAFT:

```http
POST {{baseUrl}}/api/calendar-versions/{{calendarVersionId}}/conflict-resolutions/{{resolutionId}}/revoke
Authorization: Bearer {{approverToken}}
Content-Type: application/json

{"reason":"Phương án chia phòng đã bị Facility hủy"}
```

Sau revoke, detection lại phải trả conflict là blocking.

### 7.9. Xem hồ sơ và audit trail

```http
GET {{baseUrl}}/api/calendar-versions/{{calendarVersionId}}/conflict-resolutions
Authorization: Bearer {{requesterToken}}
```

List trả `auditTrail=[]` để response nhẹ hơn. Muốn xem đầy đủ lịch sử:

```http
GET {{baseUrl}}/api/calendar-versions/{{calendarVersionId}}/conflict-resolutions/{{resolutionId}}
Authorization: Bearer {{requesterToken}}
```

### 7.10. Activate

```http
POST {{baseUrl}}/api/calendars/{{calendarId}}/versions/{{calendarVersionId}}/activate
Authorization: Bearer {{approverToken}}
```

Điều kiện thành công:

- Version vẫn là DRAFT và có ít nhất một session active, không CANCELLED.
- `validationErrors` rỗng.
- `hasBlockingConflict=false`.
- Tất cả override dùng để waive vẫn `APPROVED`, session version không đổi và policy vẫn đúng.

Khi thành công, override được dùng chuyển sang `APPLIED` và ghi actor activate trong audit trail.

## 8. HTTP status và error code thường gặp

| HTTP | Code | Nguyên nhân/cách xử lý |
|---:|---|---|
| `400` | validation mặc định | ID/body sai định dạng hoặc thiếu field bắt buộc |
| `401` | — | Thiếu token hoặc token hết hạn |
| `403` | — | User thiếu permission tương ứng |
| `404` | — | Version, session hoặc resolution không tồn tại/đã soft-delete |
| `409` | `SCHEDULE_CONFLICT_NOT_FOUND` | Pair không còn conflict; chạy detection lại |
| `409` | `CONFLICT_RESOLUTION_ALREADY_OPEN` | Đã có hồ sơ mở cùng pair và reason |
| `409` | `SESSION_VERSION_CONFLICT` | Client đang dùng session version cũ |
| `409` | `CONFLICT_RESOLUTION_SELF_APPROVAL` | Dùng user khác để approve |
| `409` | `CONFLICT_RESOLUTION_STALE` | Session đã đổi; tạo request mới |
| `409` | `CONFLICT_RESOLUTION_INVALID_TRANSITION` | Action không hợp lệ với status hiện tại |
| `409` | `CALENDAR_VERSION_NOT_DRAFT` | Chỉ thay đổi resolution khi version còn DRAFT |
| `409` | `CALENDAR_ACTIVATION_CONFLICT` | Activate bị chặn; xem `conflictCheck` trong response |
| `422` | `CONFLICT_RESOLUTION_NOT_ELIGIBLE` | Không đạt policy của reason đã chọn |
| `422` | `CONFLICT_RESOLUTION_INVALID` | Thiếu justification/area hoặc pair không hợp lệ |

Ví dụ error:

```json
{
  "status": 409,
  "code": "CONFLICT_RESOLUTION_SELF_APPROVAL",
  "message": "The requester cannot approve their own conflict resolution.",
  "fieldErrors": null,
  "timestamp": "2026-10-21T10:30:00"
}
```

## 9. Kiểm tra stale và chống race condition

### Stale

1. Tạo và approve override.
2. Update một trong hai session, dù chỉ đổi title thì optimistic version cũng tăng.
3. Chạy detection lại.
4. Mong đợi `resolutionStatus=STALE`, `waivedConflictTypes=[]`, `blocking=true`.

### Race condition

- Tạo/update/delete session và bulk save khóa CalendarVersion DRAFT bằng pessimistic write lock.
- Activate khóa toàn bộ calendar active theo cùng thứ tự trước khi detection.
- Approve kiểm tra lại conflict, policy và session versions; không tin snapshot từ client.
- Entity resolution có optimistic lock để tránh hai decision ghi đè nhau.

## 10. Automated tests

Chạy nhóm test liên quan:

```bash
bash mvnw -q \
  -Dtest=ConflictResolutionIntegrationTest,ConflictResolutionControllerTest,ConflictDetectionServiceImplTest,ConflictDetectionRepositoryTest,CalendarVersionActivationServiceTest,CalendarVersionActivationIntegrationTest,CalendarVersionActivationConcurrencyTest,CalendarVersionActivationControllerTest,BulkSessionGenerationServiceTest \
  test
```

Phạm vi gồm acknowledge vẫn blocking, approve shared session, room partition, stale sau khi session đổi, APPLIED khi activate, phân quyền controller, activation đồng thời và bulk save chỉ được ghi vào DRAFT.

## 11. Lưu ý khi deploy production

- Cấu hình local hiện dùng H2 `create-drop`; dữ liệu mất khi dừng ứng dụng.
- Trước khi dùng database production, cần đưa hai bảng `schedule_conflict_resolutions` và `schedule_conflict_resolution_audit_events` vào migration Flyway/Liquibase của môi trường triển khai.
- Không cho phép sửa/xóa audit event qua API.
- Nên alert các acknowledgement quá `expectedResolutionAt` và các request `PENDING` quá SLA.
- Luôn hiển thị rõ conflict gốc và conflict được waive trên UI; không chỉ hiển thị một badge “resolved”.
