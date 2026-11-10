### 5.2.1. UC-PRJ-003-01 – Tạo Sprint và thiết lập Sprint Goal (Sinh viên)

> Mã use case: **UFR-PRJ-003-01** — Create Sprint and Set Sprint Goal
> Phân hệ: Quản lý Mock Project, sprint và sản phẩm bàn giao (Hub PRJ-03)

#### 5.2.1.1. Mục tiêu

Cho phép sinh viên (Team Leader / Team Member) tạo một Sprint mới trong workspace của project/team, khai báo **Sprint Goal** và khung thời gian thực hiện (Start Time – End Time). Sprint sau khi tạo luôn ở trạng thái **Planned** để team tiếp tục đưa các Backlog item vào Sprint Backlog, kiểm tra phạm vi rồi mới chuyển sang **Active**. Use case đồng thời bảo đảm mỗi lần tạo Sprint được lưu bền vững, ghi audit (actor, thời gian, before/after, correlation ID) và phát outbox event cho các module liên quan.

#### 5.2.1.2. Tác nhân

- **Tác nhân chính:** Sinh viên (Team Leader / Team Member) — người trực tiếp tạo Sprint, cần quyền `SPRINT_CREATE`.
- **Tác nhân liên quan:**
  - **Quản trị viên (ADMIN):** mặc định có toàn bộ quyền `SPRINT_*` nên cũng có thể tạo Sprint qua màn hình CRUD.
  - **Hệ thống:** lớp bảo mật JWT + RBAC, `AssignedProjectAccess` (kiểm tra project/team và data scope), `SprintServiceImpl` (nghiệp vụ), `SprintAuditService` (audit log), `SprintOutboxService` / `SprintOutboxRelay` (phát sự kiện).

#### 5.2.1.3. Điều kiện trước

- Người dùng đã đăng nhập, JWT còn hiệu lực; tenant đang hoạt động.
- Tài khoản có quyền `SPRINT_CREATE` (role `STUDENT` được cấp `SPRINT_CREATE`, `SPRINT_READ`, `SPRINT_UPDATE`, `SPRINT_DELETE` bởi `SprintAccessInitializer`; `ADMIN` có toàn bộ quyền).
- Project/team đã tồn tại và người dùng là thành viên hoặc người được phân công trong workspace đó.
- Project (nếu có) không ở trạng thái `COMPLETED` / `CANCELLED` — workspace đã đóng chỉ được đọc.
- Người dùng đang ở Sprint Workspace (`/sprints`) hoặc trang Backlog (`/backlogs`) và đã chọn đúng team/workspace.

#### 5.2.1.4. Điều kiện sau

- Một bản ghi mới được lưu vào bảng `sprint` với `status = PLANNED`, `isActive = true`, `version = 0`, gắn với `projectId`/`teamId` của workspace hiện tại.
- Modal tạo Sprint đóng lại; danh sách Sprint và board được tải lại. Tại Sprint Workspace, Sprint vừa tạo được chọn làm Sprint hiện hành và mở ở tab Backlog.
- Một bản ghi audit `CREATE` được ghi trong `sprint_audit_log` với `actorId`, `actorEmail`, thời gian, `correlationId`, `afterState` (snapshot JSON) và `beforeState = null`.
- Một outbox event `SPRINT_CREATED` được enqueue trong cùng transaction và được relay phát đi (idempotent theo aggregate + action + correlation ID).
- Giao diện hiển thị thông báo thành công: **“Đã tạo Sprint mới.”**

#### 5.2.1.5. Kích hoạt

Người dùng bấm nút **“Create Sprint”** trên header của Sprint Workspace (`/sprints`) hoặc chọn mục **“Create sprint”** trong toolbar của trang Backlog (`/backlogs`). Hệ thống mở modal **“Create Sprint”**.

#### 5.2.1.6. Luồng sự kiện chính

| Bước | Tác nhân | Hành động / Phản hồi |
| --- | --- | --- |
| 1 | Người dùng | Mở Sprint Workspace (`/sprints`) hoặc trang Backlog (`/backlogs`) của team. |
| 2 | Hệ thống | Kiểm tra quyền `SPRINT_READ`, tải danh sách Sprint theo data scope và hiển thị nút “Create Sprint” nếu người dùng có `SPRINT_CREATE`. |
| 3 | Người dùng | Chọn “Create Sprint” để mở biểu mẫu tạo Sprint. |
| 4 | Hệ thống | Hiển thị modal “Create Sprint” gồm: **Sprint Name**, **Sprint Goal**, **Start Time**, **End Time**, **Active** (mặc định bật). Trường **Sprint Status** không hiển thị vì Sprint mới luôn là `PLANNED`. |
| 5 | Người dùng | Nhập tên Sprint (≤ 255 ký tự), Sprint Goal (1 – 500 ký tự), chọn Start Time và End Time, sau đó bấm nút lưu. |
| 6 | Hệ thống | Kiểm tra nhanh dữ liệu bắt buộc và điều kiện `End Time > Start Time`. Nếu sai, hiển thị lỗi ngay dưới từng trường và **không** gửi request. |
| 7 | Hệ thống | Gửi `POST /api/sprints` với `status = "PLANNED"`, `teamId` của workspace (và `projectId` nếu có), kèm `Authorization: Bearer <token>`; có thể kèm header `X-Correlation-ID`. |
| 8 | Hệ thống | Xác thực JWT và kiểm tra quyền `SPRINT_CREATE`. |
| 9 | Hệ thống | Chuẩn hoá dữ liệu (trim Name, Sprint Goal); suy ra `projectId` từ team nếu client không gửi; kiểm tra project/team thuộc data scope và project không bị đóng; kiểm tra Name, Sprint Goal, thời gian; kiểm tra trùng tên trong workspace. |
| 10 | Hệ thống | Ghi đè `status = PLANNED` (bỏ qua giá trị status do client gửi), gán `isActive = true` nếu chưa có, lưu Sprint trong một transaction. |
| 11 | Hệ thống | Trong cùng transaction: ghi audit `CREATE` và enqueue outbox event `SPRINT_CREATED`. |
| 12 | Hệ thống | Trả `200 OK` kèm `SprintDTO` của Sprint vừa tạo (`id`, `name`, `sprintGoal`, `startDate`, `endDate`, `status = PLANNED`, `version = 0`, …). |
| 13 | Hệ thống | Đóng modal, tải lại danh sách Sprint/board, chọn Sprint mới và hiển thị toast “Đã tạo Sprint mới.”. |

#### 5.2.1.7. Luồng thay thế và ngoại lệ

**5.2.1.7.1. Thiếu hoặc sai dữ liệu bắt buộc**

- Bỏ trống Sprint Name, Sprint Goal, Start Time hoặc End Time; Name vượt quá 255 ký tự; Sprint Goal vượt quá 500 ký tự; End Time không sau Start Time.
- Hệ thống ném `SprintValidationException` và trả **422 Unprocessable Entity** với bản đồ lỗi theo từng trường:
  `{"message":"Dữ liệu không hợp lệ","errors":{"sprintGoal":["Vui lòng nhập mục tiêu Sprint"]}}`.
- Giao diện giữ nguyên toàn bộ dữ liệu đã nhập, tô đỏ đúng trường lỗi và hiển thị thông điệp tương ứng để người dùng sửa.

**5.2.1.7.2. Trùng tên Sprint**

- Tên Sprint đã tồn tại trong cùng workspace: kiểm tra theo `projectId`, nếu không có project thì theo `teamId`, cuối cùng mới kiểm tra trên toàn tenant.
- Hệ thống ném `SprintConflictException` và trả **409 Conflict** với thông điệp: “Tên Sprint đã tồn tại hoặc dữ liệu đã bị thay đổi, vui lòng tải lại trang”.
- Trường hợp hai request đồng thời cùng vượt qua kiểm tra trùng tên, ràng buộc duy nhất `uk_sprint_project_name` / `uk_sprint_team_name` của bảng `sprint` được bắt bởi `DataIntegrityViolationException` và cũng trả **409 Conflict**.

**5.2.1.7.3. Phiên không hợp lệ hoặc thiếu quyền**

- Token thiếu/hết hạn/không hợp lệ: trả **401 Unauthorized**.
- Tài khoản không có quyền `SPRINT_CREATE`: trả **403 Forbidden**.
- Giao diện hiển thị toast lỗi (“Không thể tạo Sprint.”), không làm mất dữ liệu đang nhập.

**5.2.1.7.4. Project/team ngoài phạm vi hoặc workspace đã đóng**

- `AssignedProjectAccess.requireProject` / `requireTeam` / `requireTeamOnlyWrite` ném `AccessDeniedException` khi: project thuộc tenant khác, project không nằm trong assigned workspace của người dùng, team không sở hữu project, hoặc project đã `COMPLETED` / `CANCELLED`.
- Hệ thống trả **403 Forbidden** với thông điệp tương ứng (“Project is outside the assigned workspace scope”, “This project is closed and its workspace is read-only”, …).

**5.2.1.7.5. Người dùng bấm tạo nhiều lần**

- Nút lưu bị vô hiệu hoá khi đang gửi request (`submitting = true`), ngăn việc gửi lặp.
- Nếu vẫn phát sinh hai request đồng thời, request thứ hai vi phạm ràng buộc duy nhất và nhận **409 Conflict**; dữ liệu không bị nhân đôi.

**5.2.1.7.6. Tạo hàng loạt bằng tệp import**

- Người dùng có `SPRINT_CREATE` có thể dùng `POST /api/sprints/import` (multipart) với tệp Excel/CSV theo template.
- Import là nguyên tử (toàn bộ hoặc không dòng nào); mỗi dòng được chuẩn hoá như luồng tạo qua REST: trim dữ liệu, mặc định `isActive = true`, ép `status = PLANNED` và từ chối nếu Start Date không trước End Date.

**5.2.1.7.7. Lỗi máy chủ hoặc mất kết nối**

- Hệ thống trả **500 Internal Server Error**; giao diện hiển thị toast “Không thể tạo Sprint.” và giữ nguyên biểu mẫu để người dùng thử lại.

#### 5.2.1.8. Quy tắc nghiệp vụ và ghi chú

1. **Sprint Name** bắt buộc, tối đa 255 ký tự và phải duy nhất trong workspace sở hữu Sprint (theo project nếu có, ngược lại theo team).
2. **Sprint Goal** bắt buộc, độ dài 1 – 500 ký tự (được trim trước khi kiểm tra và lưu).
3. **Start Time** và **End Time** bắt buộc; End Time phải sau Start Time (kiểu `LocalDateTime`, nhận chuỗi ISO-8601 dạng `yyyy-MM-ddTHH:mm`).
4. Sprint mới **luôn** được tạo ở trạng thái `PLANNED`; giá trị `status` do client gửi bị bỏ qua. Vòng đời Sprint chỉ được chuyển tiếp qua thao tác cập nhật:
   - `PLANNED` → `ACTIVE` hoặc `CANCELLED`;
   - `ACTIVE` → `COMPLETED` hoặc `CANCELLED`;
   - `COMPLETED` / `CANCELLED` là trạng thái cuối, không chuyển tiếp.
5. Chỉ có thể bắt đầu Sprint (`ACTIVE`) khi Sprint Backlog đã có ít nhất một Backlog item; chỉ có thể hoàn thành Sprint (`COMPLETED`) khi mọi Backlog item và Subtask của Sprint đều ở trạng thái `DONE`.
6. `isActive` mặc định là `true`; `version` khởi tạo bằng `0` và được dùng làm khoá lạc quan (optimistic locking) — ghi đè đồng thời trả **409**.
7. `projectId` là tham chiếu mềm: nếu client không gửi, hệ thống suy ra từ team (`currentProject`). Module Sprint không resolve quan hệ project và không chặn khi project không tồn tại; project chỉ được dùng để kiểm tra data scope và trạng thái đóng/mở.
8. Mọi thao tác tạo phải ghi **audit** trong cùng transaction với nghiệp vụ (`Propagation.MANDATORY`): actor, thời gian, before/after, correlation ID.
9. `correlationId` lấy từ header `X-Correlation-ID` nếu có; nếu không, hệ thống sinh một UUID dùng chung cho cả audit log và outbox event của request.
10. Outbox event `SPRINT_CREATED` được phát **đúng một lần** cho mỗi cặp (aggregate, action, correlation ID).
11. Danh sách Sprint chỉ trả các Sprint thuộc project mà người dùng được truy cập (visibility spec), cùng các Sprint không gắn project.
12. Route `/sprints` được bảo vệ bởi quyền `SPRINT_READ`; các nút Create/Edit/Delete/đổi trạng thái lần lượt yêu cầu `SPRINT_CREATE`, `SPRINT_UPDATE`, `SPRINT_DELETE`.

#### 5.2.1.9. Minh chứng kiểm thử Backend trên Swagger

- **API:** `POST /api/sprints`
- **Header:** `Authorization: Bearer <access_token>`; tuỳ chọn `X-Correlation-ID: <uuid>`.
- **Dữ liệu gửi lên:**

```json
{
  "name": "Sprint 4 - Release",
  "sprintGoal": "Hoàn thiện luồng tạo Sprint và Sprint Goal trước buổi demo",
  "startDate": "2026-11-12T08:00:00",
  "endDate": "2026-11-26T17:00:00",
  "status": "PLANNED",
  "isActive": true,
  "teamId": 1,
  "projectId": 1
}
```

- **Kết quả mong đợi:** `200 OK`, trả về `SprintDTO` của Sprint vừa tạo với `id` mới, `status = "PLANNED"`, `version = 0`; bản ghi audit `CREATE` và outbox event `SPRINT_CREATED` được ghi nhận.
- **Kết quả thực tế:** `[Điền HTTP status code và thông tin phản hồi thực tế]`

**Hình 5.2.1-1. Kết quả kiểm thử API tạo Sprint trên Swagger**

#### 5.2.1.10. Màn hình Frontend

Màn hình Sprint Workspace (`/sprints`) với nút **“Create Sprint”**, modal **“Create Sprint”** gồm các trường **Sprint Name**, **Sprint Goal**, **Start Time**, **End Time**, **Active**; sau khi lưu thành công, Sprint mới xuất hiện trong danh sách/board và có thông báo “Đã tạo Sprint mới.”.

Ảnh chụp cần thể hiện: (1) modal tạo Sprint đã nhập đủ dữ liệu, và (2) trạng thái sau khi tạo thành công (Sprint mới ở trạng thái `PLANNED` trong danh sách hoặc trên board).

**Hình 5.2.1-2. Màn hình tạo Sprint và thiết lập Sprint Goal**
