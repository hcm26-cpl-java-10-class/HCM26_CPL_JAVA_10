# Test Calendar / Calendar Version bằng Postman

Phạm vi: toàn bộ **19 endpoint** của `calendar`, `calendar_version` và `session` liên quan, cộng API đăng nhập để lấy JWT. Tên package khác URL: dùng `/api/calendars` và `/api/calendar-versions`, không dùng `/calendar/` hoặc `/calendar_version`.

## 1. Kết quả đã chạy ngày 14/10/2026

| Bộ kiểm thử | Tổng | Đạt | Thất bại | Lỗi khởi tạo |
| --- | ---: | ---: | ---: | ---: |
| `CalendarFeatureTest` có sẵn | 15 | 14 | 1 | 0 |
| `CalendarApiIntegrationTest` bổ sung | 12 | 9 | 3 | 0 |
| Toàn bộ `mvn -o test` | 44 | 33 | 4 | 7 |
| Request trong collection gọi HTTP thật | 73 | 70 | 3 | 0 |

- Test tích hợp chạy với ứng dụng Spring Boot đầy đủ, JWT thật và database H2 riêng; không mock service, repository hay đăng nhập. Bộ feature test có kiểm tra transaction, ràng buộc DB và kích hoạt đồng thời.
- Collection được kiểm chứng trên `localhost:18080` với H2 riêng bằng runner Node chạy các request và script `pm.test` của collection qua adapter tối thiểu. Đây không phải kết quả chạy giao diện Postman/Newman. Có **101 assertion: 98 đạt, 3 thất bại**.
- Xem chi tiết HTTP tại [calendar-http-results.json](postman/calendar-http-results.json). Báo cáo không chứa token/password hoặc response đăng nhập.
- Chỉ bổ sung test, collection và tài liệu; chưa sửa mã nghiệp vụ hay exception handler.

**Lỗi tìm thấy:** `POST /api/calendars/import`, `POST /api/calendar-versions/import`, `POST /api/sessions/import` trả **500**, đúng ra **405 Method Not Allowed**. Ba controller không cung cấp chức năng import. `GlobalExceptionHandler.handleGlobalException(Exception)` bắt `HttpRequestMethodNotSupportedException` và đổi nó thành 500. Bốn failure Maven cùng tái hiện lỗi này: một ở test có sẵn và ba ở test tích hợp mới. Folder `07` cố ý giữ assertion 405 để phát hiện lỗi, không coi 500 là thành công.

**Ngoài phạm vi calendar:** 7 ca `ModuleGroupControllerTest` không khởi tạo được `@WebMvcTest` context vì `JwtAuthenticationFilter` thiếu bean `RefreshTokenService`. Đây là lỗi cấu hình test; không chứng minh API module group bị hỏng. `ModuleGroupServiceTest` đạt 9/9 và test khởi động ứng dụng đạt 1/1.

## 2. Khởi động backend và import collection

Tại thư mục `backend`, dùng Java 21 và chạy:

```bash
mvn spring-boot:run
```

Cấu hình hiện tại dùng cổng **8080**, H2 in-memory, `ddl-auto=create-drop`. Restart backend sẽ mất dữ liệu test. Đăng nhập và chạy collection lại sau mỗi lần restart.

1. Trong Postman, chọn **Import** và mở [calendar.postman_collection.json](postman/calendar.postman_collection.json).
2. Mở **Variables** của collection. Đặt các biến sau nếu bạn dùng cấu hình khác:

   | Biến | Mặc định | Ý nghĩa |
   | --- | --- | --- |
   | `baseUrl` | `http://localhost:8080` | Không có `/api`, không có dấu `/` cuối |
   | `adminEmail` | `admin@example.com` | Tài khoản seed ADMIN |
   | `adminPassword` | `password123` | Mật khẩu seed mặc định |
   | `studentEmail` | `student@example.com` | Dùng kiểm tra thiếu quyền |
   | `studentPassword` | `password123` | Mật khẩu seed mặc định |
   | `missingId` | `9223372036854775807` | ID không tồn tại trong DB test |

3. Chọn **No environment** nếu environment đang có các biến cùng tên. Collection dùng `pm.collectionVariables`; biến environment cùng tên có thể ghi đè giá trị đã lưu.
4. Chọn **Run collection**, chạy **1 iteration** theo thứ tự folder `01` → `07`. Hoặc mở từng request và nhấn **Send** theo đúng thứ tự.
5. Kiểm tra **Test Results**, status code và response body. Hiện tại kỳ vọng 70 request đạt; 3 request folder `07` đỏ do lỗi đã nêu.

Request đăng nhập đầu tiên tự tạo `classId` và `cleanupClassId` mới bằng thời gian hiện tại, lấy JWT vào `accessToken`. Các request tạo dữ liệu tự lưu `calendarId`, `versionId`, `sessionId`, `cloneVersionId` và `cloneSessionId`. Bạn không cần nhập những ID này.

Folder `06` xóa bộ dữ liệu nháp riêng để kiểm tra xóa thành công. Lịch đã publish ở các folder trước vẫn còn vì API không cho xóa phiên bản đã publish; với cấu hình H2 hiện tại, restart backend sẽ làm sạch toàn bộ DB. Mỗi lần chạy lại collection tạo một `classId` mới để tránh trùng lịch.

## 3. Đăng nhập và quyền

```http
POST {{baseUrl}}/api/auth/login
Content-Type: application/json
```

```json
{
  "email": "{{adminEmail}}",
  "password": "{{adminPassword}}"
}
```

Kỳ vọng **200**, body có `accessToken`, `permissions`, thông tin tài khoản. Script Post-response / Tests:

```javascript
pm.test("Login OK", () => pm.response.to.have.status(200));
pm.collectionVariables.set("accessToken", pm.response.json().accessToken);
```

Ở Authorization của collection: **Bearer Token** = `{{accessToken}}`. Các request nghiệp vụ kế thừa cấu hình này. Request login dùng **No Auth**. Request test student dùng `{{studentToken}}` riêng, không ghi đè token admin.

- CRUD calendar cần `CALENDAR_CREATE`, `CALENDAR_READ`, `CALENDAR_UPDATE`, `CALENDAR_DELETE` tương ứng.
- CRUD version cần `CALENDAR_VERSION_CREATE`, `CALENDAR_VERSION_READ`, `CALENDAR_VERSION_UPDATE`, `CALENDAR_VERSION_DELETE` tương ứng.
- Activate chỉ kiểm tra `CALENDAR_VERSION_ACTIVATE`.
- Clone cần đồng thời `CALENDAR_VERSION_CREATE`, `CALENDAR_VERSION_READ`, `SESSION_READ`, `SESSION_CREATE`.
- Events cần đồng thời `CALENDAR_READ`, `SESSION_READ`.
- CRUD session cần các quyền `SESSION_*` tương ứng; cancel cần `SESSION_UPDATE`.
- Không có JWT hoặc JWT không hợp lệ: **401**. Có JWT nhưng thiếu quyền: **403**. Tài khoản student mặc định thiếu quyền cả ba nhóm.

## 4. Danh sách toàn bộ endpoint trong phạm vi

Các URL dưới đây nối sau `{{baseUrl}}`. Request POST/PUT/PATCH có body dùng **Body → raw → JSON**. GET, DELETE, activate, clone không cần body.

| Method | URL | Body / query chính | Thành công |
| --- | --- | --- | --- |
| POST | `/api/calendars` | classId, name, classStartDate, classEndDate | 200 |
| GET | `/api/calendars` | classId, search, page, size, sort | 200, Page |
| GET | `/api/calendars/{{calendarId}}` | — | 200, object |
| PUT | `/api/calendars/{{calendarId}}` | name, description, classStartDate, classEndDate | 200 |
| DELETE | `/api/calendars/{{calendarId}}` | Chỉ khi không còn version | 204 |
| GET | `/api/calendars/{{calendarId}}/events` | from, to, đều tùy chọn | 200, array |
| POST | `/api/calendar-versions` | calendarId, name, description tùy chọn | 200 |
| GET | `/api/calendar-versions` | calendarId, search, page, size, sort | 200, Page |
| GET | `/api/calendar-versions/{{versionId}}` | — | 200 |
| PUT | `/api/calendar-versions/{{versionId}}` | name, description; version nháp | 200 |
| DELETE | `/api/calendar-versions/{{versionId}}` | Version nháp; xóa kèm sessions | 204 |
| POST | `/api/calendar-versions/{{versionId}}/activate` | Không body | 200 |
| POST | `/api/calendar-versions/{{versionId}}/clone` | Không body | **201** |
| POST | `/api/sessions` | calendarVersionId, topicId, trainerId, title, startTime, endTime | 200 |
| GET | `/api/sessions` | calendarVersionId và các filter bên dưới | 200, Page |
| GET | `/api/sessions/{{sessionId}}` | — | 200 |
| PUT | `/api/sessions/{{sessionId}}` | title, topicId, trainerId, startTime, endTime, location, note | 200 |
| DELETE | `/api/sessions/{{sessionId}}` | Session SCHEDULED của bản nháp | 204 |
| PATCH | `/api/sessions/{{sessionId}}/cancel` | cancelReason | 200 |

Create CRUD trả **200**, riêng clone trả **201**. DELETE thành công trả **204**, không có JSON body. PUT hiện cho cập nhật một phần: field bỏ qua/null được giữ nguyên; không dùng null để xóa giá trị.

GET list trả object Page có `content`, `totalElements`, `totalPages`, `number`, `size`; `page` bắt đầu từ **0**, mặc định size **10**. Events trả array trực tiếp, không bọc trong `content`.

Ví dụ query:

```text
/api/calendars?classId={{classId}}&search=Java&page=0&size=10&sort=id,desc
/api/calendar-versions?calendarId={{calendarId}}&search=Version&page=0&size=10&sort=versionNumber,desc
/api/sessions?calendarVersionId={{versionId}}&status=SCHEDULED&page=0&size=10&sort=startTime,asc
```

Calendar chỉ có filter riêng `classId`; version chỉ có `calendarId`. Version `status` là giá trị suy ra, không có filter `status` trong `CalendarVersionFilter` và không phải field DB để sort. Dùng `id`, `versionNumber`, `name` cho sort phù hợp.

Session còn có `classId`, `trainerId`, `topicId`, `status`, `title`, `location`, `fromDate`, `toDate`. `fromDate`/`toDate` lọc session nằm trọn trong khoảng (`startTime >= fromDate`, `endTime <= toDate`); khác với events lấy session giao với khoảng. Các filter nền dùng chung: `ids`, `isActive`, `createdRange`, `updatedRange`, `createdBy`, `updatedBy`.

## 5. Luồng test thủ công với body mẫu

**Bước 1 — Tạo calendar.** `POST /api/calendars`:

```json
{
  "classId": {{classId}},
  "name": "Postman Java",
  "description": "Calendar test",
  "classStartDate": "2026-10-01",
  "classEndDate": "2026-10-31"
}
```

Kỳ vọng 200, lưu `id` vào `calendarId`; `activeVersionId` ban đầu null. Mỗi class chỉ có một calendar. Code hiện lưu `classId` dạng số, chưa tra cứu bảng lớp để xác minh tồn tại; collection tạo ID số riêng cho từng lượt.

**Bước 2 — Tạo version.** `POST /api/calendar-versions`:

```json
{
  "calendarId": {{calendarId}},
  "name": "Version 1",
  "description": "Initial schedule"
}
```

Kỳ vọng 200, `status = DRAFT`, `versionNumber = 1`; lưu `id` vào `versionId`. Gọi activate ngay lúc này phải 400 vì chưa có session.

**Bước 3 — Thêm session.** `POST /api/sessions`:

```json
{
  "calendarVersionId": {{versionId}},
  "topicId": 3,
  "trainerId": 5,
  "title": "Spring Boot",
  "startTime": "2026-10-20T08:00:00",
  "endTime": "2026-10-20T11:00:00",
  "location": "Room A",
  "note": "Postman session"
}
```

Kỳ vọng 200, `status = SCHEDULED`, `classId` tự lấy từ calendar; lưu `id` vào `sessionId`. `topicId`/`trainerId` hiện là số lưu trực tiếp, không có kiểm tra tham chiếu entity tương ứng trong luồng này.

Có thể cập nhật bản nháp bằng:

```http
PUT /api/calendars/{{calendarId}}
{"name":"Updated calendar"}

PUT /api/calendar-versions/{{versionId}}
{"name":"Updated draft"}

PUT /api/sessions/{{sessionId}}
{"location":"Room B"}
```

Mỗi ví dụ là một request riêng, body JSON đặt trong raw. Field do server quản lý như `activeVersionId`, `versionNumber`, `publishedAt`, version/session `status`, session `classId` không được thay đổi bằng body.

**Bước 4 — Activate.** Gọi `POST /api/calendar-versions/{{versionId}}/activate`, không body. Kỳ vọng 200, status ACTIVE, publishedAt có giá trị. Đọc lại calendar phải thấy activeVersionId bằng versionId.

Gọi `GET /api/calendars/{{calendarId}}/events?from=2026-10-20T09:00:00&to=2026-10-20T10:00:00` phải trả session 08:00–11:00 vì hai khoảng giao nhau. Nếu `from=2026-10-20T11:00:00` thì trả `[]`.

Thời gian dùng `LocalDateTime` theo quy ước Asia/Ho_Chi_Minh; gửi dạng `2026-10-20T08:00:00`, không thêm `Z`. Session phải nằm trong ngày bắt đầu/kết thúc lớp; có thể kết thúc đúng `2026-11-01T00:00:00` khi ngày cuối lớp là `2026-10-31`. `endTime` phải lớn hơn `startTime`.

Activate lại cùng version giữ nguyên publishedAt đã lưu. H2 lưu timestamp tới microsecond; response activate đầu tiên có thể chứa nanosecond, nên collection đọc lại version trước khi so sánh thời điểm publish.

**Bước 5 — Clone và thay phiên bản.** Gọi `POST /api/calendar-versions/{{versionId}}/clone`, không body. Kỳ vọng **201**, version mới DRAFT, versionNumber 2, publishedAt null. Lưu ID mới vào cloneVersionId; gọi `GET /api/sessions?calendarVersionId={{cloneVersionId}}` để lấy cloneSessionId. Session clone có ID mới; chỉnh title của nó không đổi session gốc.

Gọi `POST /api/calendar-versions/{{cloneVersionId}}/activate`. Bản mới ACTIVE, bản cũ INACTIVE; events chỉ lấy session của bản mới. Bản từng publish vẫn không được sửa/xóa dù đã INACTIVE. Có thể activate lại bản INACTIVE hợp lệ để chuyển lịch về phiên bản cũ.

**Bước 6 — Hủy session.** `PATCH /api/sessions/{{cloneSessionId}}/cancel`:

```json
{
  "cancelReason": "Trainer unavailable"
}
```

Kỳ vọng 200, `status = CANCELLED`. Lý do bắt buộc, tối đa 255 ký tự. Hủy được session SCHEDULED trong bản nháp hoặc bản ACTIVE; không hủy được session của bản INACTIVE đã publish. Events vẫn chứa session CANCELLED; giao diện tự xử lý cách hiển thị.

**Bước 7 — Test xóa thành công.** Dùng dữ liệu nháp riêng như folder `06`: tạo calendar → version → session, sau đó xóa session (**204**), xóa version (**204**), xóa calendar (**204**). Xóa bản nháp còn session sẽ xóa kèm các session. GET lại ID đã xóa phải **404**. Số version đã cấp không được tái sử dụng.

## 6. Checklist ca lỗi và dữ liệu không hợp lệ

| Tình huống | Kỳ vọng |
| --- | --- |
| Không có token / token sai | 401 |
| Token student gọi API calendar/version/session | 403 |
| POST `{}` vào ba API create | 400, `errors` theo field |
| Tạo calendar trùng classId | 409 |
| classEndDate trước classStartDate | 400 |
| Sửa classId của calendar / chuyển version sang calendar khác / chuyển session sang version khác | 400 |
| Session thiếu calendarVersionId, start >= end, hoặc nằm ngoài ngày lớp | 400 |
| Thu hẹp ngày lớp khiến session của bất kỳ version nào nằm ngoài khoảng | 400, dữ liệu cũ giữ nguyên |
| Activate version chưa có session | 400 |
| Events có to <= from | 400 |
| GET một ID không tồn tại | 404 |
| Tạo version trỏ calendar không tồn tại | 404 |
| Sửa/xóa version đã publish | 409 |
| Thêm/sửa/xóa session thuộc version đã publish | 409 |
| Xóa calendar còn version | 409 |
| Cancel thiếu lý do | 400 |
| Cancel session của phiên bản cũ INACTIVE hoặc cancel lần hai | 409 |
| POST `/import` của ba nhóm | Mong đợi 405; hiện **500 — lỗi đã xác nhận** |

Ví dụ lỗi validation có dạng `{"message":"Validation failed","errors":{"name":["..."]}}`. Các lỗi 404/409 thường có `status`, `message`, `timestamp`. Kiểm tra mã HTTP trước; không giả định mọi response lỗi có cùng cấu trúc.

## 7. Chạy lại test tự động và khám phá API toàn backend

```bash
# Chỉ các test calendar / calendar version / session liên quan
mvn -Dtest=CalendarFeatureTest,CalendarApiIntegrationTest test

# Toàn bộ test của backend
mvn test
```

Maven hiện báo BUILD FAILURE với các lỗi đã mô tả ở phần 1. Kết quả chi tiết sau khi chạy nằm trong `target/surefire-reports/`.

Nếu cần khám phá cả API ngoài hai chức năng này, mở `http://localhost:8080/swagger-ui/index.html` hoặc import URL `http://localhost:8080/v3/api-docs` vào Postman khi backend đang chạy. OpenAPI cung cấp danh sách/schema các API của toàn backend; collection trong tài liệu này chỉ có luồng kiểm thử đầy đủ của calendar/version/session. Với collection từ OpenAPI, vẫn đặt Bearer Token và chuẩn bị dữ liệu theo quan hệ của từng chức năng; nó không tự có bộ assertions hay thứ tự nghiệp vụ như collection kèm theo.
