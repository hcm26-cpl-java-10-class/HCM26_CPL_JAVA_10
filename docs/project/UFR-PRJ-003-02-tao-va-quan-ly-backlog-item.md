### 5.2.2. UC-PRJ-003-02 – Tạo và quản lý Backlog Item (Sinh viên)

> Mã use case: **UFR-PRJ-003-02** — Create and Manage Backlog Items
> Phân hệ: Quản lý Mock Project, sprint và sản phẩm bàn giao (Hub PRJ-03)

#### 5.2.2.1. Mục tiêu

Cho phép sinh viên (Team Leader / Team Member) tạo và quản lý các Backlog item (Story / Bug / Task) trong **Product Backlog** hoặc **Sprint Backlog**, liên kết item với **Milestone** của project, gán người thực hiện, ước lượng giờ, đặt độ ưu tiên và hạn hoàn thành. Use case cũng bao gồm việc cập nhật nội dung, chuyển trạng thái theo workflow `To do → In progress → Review → Done`, bỏ liên kết milestone và xoá item. Mỗi thao tác ghi nhận audit (actor, thời gian, before/after, correlation ID) và phát outbox event để thông báo cho các thành viên trong nhóm.

#### 5.2.2.2. Tác nhân

- **Tác nhân chính:** Sinh viên (Team Leader / Team Member) — người tạo, sửa, chuyển trạng thái và xoá Backlog item; cần các quyền `SPRINT_BACKLOG_CREATE`, `SPRINT_BACKLOG_READ`, `SPRINT_BACKLOG_UPDATE`, `SPRINT_BACKLOG_DELETE` tuỳ thao tác.
- **Tác nhân liên quan:**
  - **Quản trị viên (ADMIN):** mặc định có toàn bộ quyền `SPRINT_BACKLOG_*` nên cũng thực hiện được use case.
  - **Hệ thống:** lớp bảo mật JWT + RBAC, `AssignedProjectAccess` (kiểm tra project/team và data scope), `SprintBacklogServiceImpl` (nghiệp vụ), `SprintBacklogAuditService` (audit log), `SprintBacklogOutboxService` / `SprintOutboxRelay` (phát sự kiện thông báo nhóm), module Milestone (nguồn dữ liệu milestone).

#### 5.2.2.3. Điều kiện trước

- Người dùng đã đăng nhập, JWT còn hiệu lực; tenant đang hoạt động.
- Tài khoản có quyền tương ứng: `SPRINT_BACKLOG_CREATE` (tạo), `SPRINT_BACKLOG_READ` (xem), `SPRINT_BACKLOG_UPDATE` (sửa/chuyển trạng thái), `SPRINT_BACKLOG_DELETE` (xoá). Role `STUDENT` được cấp đủ bốn quyền bởi `SprintBacklogAccessInitializer`; `ADMIN` có toàn bộ quyền.
- Sprint được chọn (nếu có) đã tồn tại; project/team của item thuộc phạm vi người dùng được truy cập và workspace chưa bị đóng (`COMPLETED` / `CANCELLED`).
- Milestone được chọn (nếu có) đang tồn tại, còn hiệu lực (`isActive = true`) và thuộc cùng project/team với Sprint.
- Người dùng đang ở trang Backlog (`/backlogs`) hoặc tab **Backlog** của Sprint Workspace.

#### 5.2.2.4. Điều kiện sau

- Backlog item được lưu vào bảng `sprint_backlog` với `status = TODO`, `priority = MEDIUM`, `workType = TASK` (nếu client không gửi), `isActive = true`, `version = 0`; `projectId` được suy ra từ milestone hoặc sprint.
- Item xuất hiện ngay trong box tương ứng (Product Backlog hoặc Sprint) kèm chip milestone nếu có liên kết; giao diện hiển thị toast **“Đã tạo công việc trong Backlog.”** (product backlog) hoặc **“Đã tạo công việc trong Sprint.”**.
- Một bản ghi audit `CREATE` được ghi trong `sprint_backlog_audit_log` với `actorId`, `actorEmail`, thời gian, `correlationId`, `afterState` (snapshot JSON) và `beforeState = null`.
- Một outbox event `SPRINT_BACKLOG_ITEM_CREATED` được enqueue trong cùng transaction (trạng thái `PENDING` → `PUBLISHED` sau khi relay chạy) để thông báo cho `TEAM_MEMBERS`.
- Khi cập nhật: audit `UPDATE` (before/after) và outbox event `SPRINT_BACKLOG_ITEM_UPDATED` được ghi nhận. Khi xoá: audit `DELETE` được ghi nhận và item bị xoá khỏi hệ thống.

#### 5.2.2.5. Kích hoạt

- Người dùng bấm nút **“+ Create”** dưới một box Backlog (Product Backlog hoặc Sprint) để mở thanh tạo item inline.
- Hoặc người dùng mở một Backlog item hiện có (panel chi tiết bên phải) để sửa nội dung, đổi trạng thái, liên kết/bỏ liên kết milestone, đổi người thực hiện hoặc xoá item.

#### 5.2.2.6. Luồng sự kiện chính

| Bước | Tác nhân | Hành động / Phản hồi |
| --- | --- | --- |
| 1 | Người dùng | Mở trang Backlog (`/backlogs`) hoặc tab Backlog của Sprint Workspace. |
| 2 | Hệ thống | Kiểm tra quyền `SPRINT_BACKLOG_READ`, tải board (các Sprint, item của Sprint và Product Backlog) theo data scope; tải danh sách milestone (`milestone-options`) và thành viên có thể giao việc (`assignee-options`). |
| 3 | Người dùng | Bấm “+ Create” dưới box muốn thêm item. |
| 4 | Hệ thống | Mở thanh tạo inline gồm: **work type** (mặc định Task), **Title**, **Description** (kèm bộ đếm ký tự), **Milestone**, **Due date** (mặc định hôm nay), **Assignee** và nút **“Lưu Backlog Item”**. |
| 5 | Người dùng | Nhập Title, Description; chọn work type, milestone, due date và assignee (các trường phụ có thể để trống). |
| 6 | Hệ thống | Kiểm tra nhanh dữ liệu bắt buộc và giới hạn ký tự; nếu sai, tô đỏ đúng trường, hiển thị thông điệp và **không** gửi request. |
| 7 | Hệ thống | Gửi `POST /api/sprint-backlogs` với `sprintId` (`null` nếu là Product Backlog), `projectId`, `milestoneId`, `title`, `description`, `workType`, `status = "TODO"`, `priority = "MEDIUM"`, `assigneeProjectMemberId`, `startDate`/`endDate` quy đổi từ Due date (`00:00:00` – `23:59:00`) và `isActive = true`. |
| 8 | Hệ thống | Xác thực JWT, kiểm tra quyền `SPRINT_BACKLOG_CREATE`; chuẩn hoá Title/Description (trim); resolve Sprint, Milestone và project; kiểm tra dữ liệu và phạm vi project/team. |
| 9 | Hệ thống | Lưu item trong một transaction; ghi audit `CREATE` và enqueue outbox event `SPRINT_BACKLOG_ITEM_CREATED`. |
| 10 | Hệ thống | Trả `200 OK` kèm `SprintBacklogDTO` của item vừa tạo (`id`, `status = TODO`, `workType`, `priority`, `projectId`, `milestoneName`, `version = 0`, …). |
| 11 | Hệ thống | Tải lại board, hiển thị item mới trong box kèm chip milestone (nếu có) và toast thành công. |
| 12 | Người dùng | Mở item để quản lý: sửa nội dung, đổi work type/priority/ước lượng, gán hoặc bỏ người thực hiện, liên kết hoặc bỏ liên kết milestone. |
| 13 | Hệ thống | Gửi `PUT /api/sprint-backlogs/{id}`; backend kiểm tra `SPRINT_BACKLOG_UPDATE`, validate trạng thái sau khi gộp dữ liệu (partial update), kiểm tra chuyển trạng thái hợp lệ, lưu item. |
| 14 | Hệ thống | Ghi audit `UPDATE` (before/after), enqueue outbox event `SPRINT_BACKLOG_ITEM_UPDATED`, trả `200 OK` với DTO đã cập nhật; giao diện cập nhật row/panel. |
| 15 | Người dùng | Có thể xoá item bằng nút Delete trong panel chi tiết. |
| 16 | Hệ thống | Kiểm tra `SPRINT_BACKLOG_DELETE`; nếu item đã có Subtask thì từ chối (**422**); ngược lại ghi audit `DELETE` (before, after = `null`) và xoá item; giao diện tải lại board. |

#### 5.2.2.7. Luồng thay thế và ngoại lệ

**5.2.2.7.1. Thiếu hoặc sai dữ liệu bắt buộc**

- Bỏ trống Title; Title vượt quá 200 ký tự; Description vượt quá 1000 ký tự; chỉ nhập một trong hai mốc Start/End date; End date không sau Start date; `estimatedHours < 0`; item thuộc Product Backlog nhưng gửi trạng thái khác `TODO`; `projectId` không khớp với Sprint/Milestone; milestone khác team hoặc khác project của Sprint.
- Hệ thống ném `SprintBacklogValidationException` và trả **422 Unprocessable Entity** với bản đồ lỗi theo từng trường:
  `{"message":"Dữ liệu không hợp lệ","errors":{"title":["Vui lòng nhập tên Backlog item"]}}`.
- Giao diện giữ nguyên toàn bộ giá trị đã nhập (title, milestone, due date, assignee), tô đỏ đúng trường lỗi để người dùng sửa.

**5.2.2.7.2. Milestone không tồn tại hoặc đã bị huỷ**

- Milestone được chọn không còn tồn tại hoặc đã bị vô hiệu hoá (`isActive = false`) giữa lúc mở form và lúc lưu.
- Hệ thống trả **404 Not Found** với thông điệp “Milestone không tồn tại hoặc đã bị thay đổi”.
- Giao diện hiển thị toast lỗi, **giữ nguyên dữ liệu đã nhập** và cho phép chọn milestone khác; item không được tạo.

**5.2.2.7.3. Sprint không tồn tại**

- `sprintId` được gửi lên nhưng không trỏ tới Sprint còn tồn tại.
- Hệ thống trả **422 Unprocessable Entity** với lỗi `sprintId`: “Sprint #<id> không tồn tại hoặc đã bị xoá”.

**5.2.2.7.4. Phiên không hợp lệ hoặc thiếu quyền**

- Token thiếu/hết hạn/không hợp lệ: **401 Unauthorized**.
- Thiếu quyền tương ứng với thao tác (`SPRINT_BACKLOG_CREATE` / `_READ` / `_UPDATE` / `_DELETE`): **403 Forbidden**.
- Giao diện hiển thị toast lỗi và không làm mất dữ liệu đang nhập.

**5.2.2.7.5. Project/team ngoài phạm vi hoặc workspace đã đóng**

- Project thuộc tenant khác, không nằm trong assigned workspace, team không sở hữu project, hoặc project đã `COMPLETED` / `CANCELLED`: `AccessDeniedException` → **403 Forbidden**.
- Thông điệp tương ứng: “Project is outside the assigned workspace scope”, “This project is closed and its workspace is read-only”, “The selected team does not own this project”, …

**5.2.2.7.6. Dữ liệu đã bị thay đổi bởi người khác**

- Hai người cùng sửa một item: request đến sau vi phạm khoá lạc quan (`@Version`) → `OptimisticLockingFailureException` → **409 Conflict** với thông điệp “Dữ liệu Sprint Backlog đã bị thay đổi, vui lòng tải lại trang”.
- Giao diện yêu cầu tải lại board/panel và giữ nguyên thao tác chưa gửi để người dùng thực hiện lại.

**5.2.2.7.7. Chuyển trạng thái không hợp lệ**

- Workflow chỉ cho phép: `TODO → IN_PROGRESS`; `IN_PROGRESS → TODO | REVIEW`; `REVIEW → IN_PROGRESS | DONE`; `DONE → REVIEW`.
- Chuyển trạng thái khác (ví dụ `TODO → DONE`) trả **422** với thông điệp “Cannot transition from TODO to DONE. Allowed next: [IN_PROGRESS]”.
- Item thuộc Product Backlog (chưa có Sprint) chỉ được ở trạng thái `TODO`; khi được kéo vào Sprint, item bắt đầu lại từ `TODO`.

**5.2.2.7.8. Xoá item đã có Subtask hoặc di chuyển item có Subtask sang project khác**

- Item đã có lịch sử Subtask không được xoá: **422** với lỗi `subtasks`: “A backlog item with subtask history cannot be deleted”.
- Item đã có Subtask không được đổi sang project khác: **422** với lỗi `projectId`: “A backlog item with subtasks cannot be moved to another project”.

**5.2.2.7.9. Người dùng bấm lưu nhiều lần**

- Thanh tạo item chỉ cho phép một item đang được lưu tại một thời điểm (`creatingKey`), các lần bấm lặp bị bỏ qua.
- Với thao tác cập nhật, request đồng thời được xử lý bằng khoá lạc quan và trả **409** như mục 5.2.2.7.6, dữ liệu không bị ghi đè âm thầm.

**5.2.2.7.10. Tạo hàng loạt bằng tệp import**

- Người dùng có `SPRINT_BACKLOG_CREATE` có thể dùng `POST /api/sprint-backlogs/import` (multipart) với tệp Excel/CSV theo template.
- Import là nguyên tử: toàn bộ dòng hợp lệ mới được lưu; mỗi dòng áp dụng cùng quy tắc (trim Title/Description, giới hạn ký tự, Start/End date phải nhập cùng nhau và đúng thứ tự, `estimatedHours ≥ 0`).
- Item import luôn ở trạng thái `TODO`, chưa gán assignee và nhận `projectId` từ Sprint đã chọn.

**5.2.2.7.11. Lỗi máy chủ hoặc mất kết nối**

- Hệ thống trả **500 Internal Server Error**; giao diện hiển thị toast lỗi và giữ nguyên dữ liệu để người dùng thử lại.

#### 5.2.2.8. Quy tắc nghiệp vụ và ghi chú

1. **Title** bắt buộc, tối đa 200 ký tự; **Description** không bắt buộc, tối đa 1000 ký tự; cả hai được trim trước khi kiểm tra và lưu.
2. **Start date** và **End date** không bắt buộc, nhưng phải xuất hiện theo cặp; khi có cả hai thì Start phải trước End. Giao diện ánh xạ **Due date** thành cặp `00:00:00` – `23:59:00` của cùng một ngày.
3. **Sprint** là quan hệ tuỳ chọn: không có Sprint nghĩa là item đang ở Product Backlog; khi có Sprint thì Sprint phải tồn tại.
4. **Status** mặc định `TODO`; Product Backlog item chỉ được ở `TODO`; chuyển trạng thái tuân theo ma trận `TODO → IN_PROGRESS → REVIEW → DONE` (lùi một bước được phép theo ma trận ở mục 5.2.2.7.7).
5. **Work type** là tập cố định `STORY` / `BUG` / `TASK`, mặc định `TASK`; không có endpoint tạo work type mới. **Priority** là `LOW` / `MEDIUM` / `HIGH` / `URGENT`, mặc định `MEDIUM`.
6. **estimatedHours** không bắt buộc, nhưng nếu có phải `≥ 0`.
7. **projectId** được suy ra theo thứ tự: project của Milestone → project của Sprint → giá trị client gửi. Nếu các nguồn mâu thuẫn, hệ thống trả **422**.
8. **Milestone** phải tồn tại và còn hiệu lực (`isActive = true`) và phải thuộc cùng team, cùng project với Sprint; milestone không hợp lệ trả **404** (theo AC03) để giao diện giữ dữ liệu và yêu cầu chọn lại.
9. **Assignee** phải là thành viên đang hoạt động, không bị khoá của team/project sở hữu item; **reporter** chỉ cần là project member hợp lệ (`> 0`). Trường `clearAssignee` / `clearReporter` / `clearMilestone = true` dùng để bỏ gán khi cập nhật (gửi `null` nghĩa là giữ nguyên giá trị hiện tại).
10. Item đã có Subtask: không được xoá và không được chuyển sang project khác.
11. **Audit** được ghi trong cùng transaction với nghiệp vụ (`Propagation.MANDATORY`) cho `CREATE` / `UPDATE` / `DELETE`, gồm actor, thời gian, before/after và correlation ID (`X-Correlation-ID` hoặc UUID sinh tự động).
12. **Outbox event** `SPRINT_BACKLOG_ITEM_CREATED` / `SPRINT_BACKLOG_ITEM_UPDATED` dùng chung bảng `sprint_outbox_event` với aggregate type `SPRINT_BACKLOG`; khoá chống trùng `SPRINT_BACKLOG:{id}:{eventType}:{correlationId}` bảo đảm mỗi sự kiện chỉ được phát một lần; payload hướng tới `TEAM_MEMBERS`. Thao tác xoá chỉ ghi audit, không phát outbox event.
13. Danh sách item được lọc theo data scope của project; người dùng chỉ thấy item thuộc project mình được truy cập và các item không gắn project.
14. Quyền theo thao tác: tạo `SPRINT_BACKLOG_CREATE`, xem `SPRINT_BACKLOG_READ`, sửa/chuyển trạng thái `SPRINT_BACKLOG_UPDATE`, xoá `SPRINT_BACKLOG_DELETE`; import yêu cầu `SPRINT_BACKLOG_CREATE`.

#### 5.2.2.9. Minh chứng kiểm thử Backend trên Swagger

##### 5.2.2.9.1. API tạo Backlog item

- **API:** `POST /api/sprint-backlogs`
- **Header:** `Authorization: Bearer <access_token>`; tuỳ chọn `X-Correlation-ID: <uuid>`.
- **Dữ liệu gửi lên:**

```json
{
  "sprintId": 1,
  "projectId": 1,
  "milestoneId": "11111111-1111-4111-8111-111111111111",
  "title": "Viết tài liệu kiến trúc hệ thống",
  "description": "Mô tả kiến trúc 3 lớp, sơ đồ triển khai và các quyết định kỹ thuật chính.",
  "workType": "TASK",
  "status": "TODO",
  "priority": "MEDIUM",
  "assigneeProjectMemberId": 1,
  "startDate": "2026-11-12T00:00:00",
  "endDate": "2026-11-12T23:59:00",
  "isActive": true
}
```

- **Kết quả mong đợi:** `200 OK`, trả về `SprintBacklogDTO` của item vừa tạo với `id` mới, `status = "TODO"`, `workType = "TASK"`, `priority = "MEDIUM"`, `version = 0`, kèm `milestoneName` và `sprintName`; bản ghi audit `CREATE` và outbox event `SPRINT_BACKLOG_ITEM_CREATED` được ghi nhận.
- **Kết quả thực tế:** `[Điền HTTP status code và thông tin phản hồi thực tế]`

**Hình 5.2.2-1. Kết quả kiểm thử API tạo Backlog item trên Swagger**

##### 5.2.2.9.2. API cập nhật / liên kết milestone của Backlog item

- **API:** `PUT /api/sprint-backlogs/{id}`
- **Header:** `Authorization: Bearer <access_token>`; tuỳ chọn `X-Correlation-ID: <uuid>`.
- **Dữ liệu gửi lên (cập nhật một phần):**

```json
{
  "milestoneId": "22222222-2222-4222-8222-222222222222",
  "status": "IN_PROGRESS"
}
```

- **Kết quả mong đợi:** `200 OK`, trả về DTO sau cập nhật với `milestoneId`/`milestoneName` mới và `status = "IN_PROGRESS"`; bản ghi audit `UPDATE` (before/after) và outbox event `SPRINT_BACKLOG_ITEM_UPDATED` được ghi nhận. Gửi `{"clearMilestone": true}` để bỏ liên kết milestone.
- **Kết quả thực tế:** `[Điền HTTP status code và thông tin phản hồi thực tế]`

**Hình 5.2.2-2. Kết quả kiểm thử API cập nhật Backlog item trên Swagger**

#### 5.2.2.10. Màn hình Frontend

Màn hình Backlog (`/backlogs` hoặc tab Backlog của Sprint Workspace) với các box Sprint và Product Backlog; thanh tạo item inline gồm **work type**, **Title**, **Description** (kèm bộ đếm ký tự), **Milestone**, **Due date**, **Assignee** và nút **“Lưu Backlog Item”**; các row hiển thị chip milestone và trạng thái, panel chi tiết bên phải cho phép sửa, đổi trạng thái, liên kết/bỏ milestone và xoá item.

Ảnh chụp cần thể hiện: (1) thanh tạo item đã nhập đủ dữ liệu (có milestone được chọn), và (2) kết quả sau khi lưu (row mới trong box kèm chip milestone và toast “Đã tạo công việc trong Backlog.”).

**Hình 5.2.2-3. Màn hình tạo và quản lý Backlog item**
