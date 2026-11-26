### 5.2.3. UC-PRJ-003-03 – Gán Backlog Item vào Sprint (Sinh viên)

> Mã use case: **UFR-PRJ-003-03** — Assign Backlog Items to Sprint
> Phân hệ: Quản lý Mock Project, sprint và sản phẩm bàn giao (Hub PRJ-03)

#### 5.2.3.1. Mục tiêu

Cung cấp bảng **Sprint Planning** để sinh viên (Team Leader / Team Member) lập phạm vi công việc cho một Sprint: chọn các Backlog item từ Product Backlog (hoặc từ một Sprint đang mở khác) đưa vào Sprint, sắp xếp lại thứ tự hiển thị trong Sprint Backlog, bỏ các item không còn thuộc phạm vi về lại Product Backlog và xác nhận toàn bộ phạm vi bằng **một lần gọi API nguyên tử**. Thao tác chỉ được phép khi Sprint đang ở trạng thái `PLANNED` hoặc `ACTIVE`; Sprint đã hoàn thành/huỷ sẽ khoá phạm vi và từ chối thay đổi.

#### 5.2.3.2. Tác nhân

- **Tác nhân chính:** Sinh viên (Team Leader / Team Member) — người lập kế hoạch phạm vi Sprint; cần `SPRINT_READ` để xem board và `SPRINT_UPDATE` để xác nhận thay đổi. Giao diện chỉ bật chế độ chỉnh sửa khi người dùng có đồng thời `SPRINT_UPDATE` và `SPRINT_BACKLOG_UPDATE`.
- **Tác nhân liên quan:**
  - **Quản trị viên (ADMIN):** mặc định có toàn bộ quyền `SPRINT_*` và `SPRINT_BACKLOG_*` nên thực hiện được use case.
  - **Hệ thống:** lớp bảo mật JWT + RBAC, `AssignedProjectAccess` (kiểm tra project/team và data scope), `SprintServiceImpl` (nghiệp vụ gán phạm vi), module `SprintBacklog` (nguồn dữ liệu item), module Milestone (thông tin milestone của item).

#### 5.2.3.3. Điều kiện trước

- Người dùng đã đăng nhập, JWT còn hiệu lực; tenant đang hoạt động.
- Tài khoản có `SPRINT_READ` để mở Sprint Workspace; để chỉnh sửa và xác nhận cần `SPRINT_UPDATE` và `SPRINT_BACKLOG_UPDATE`.
- Sprint được chọn tồn tại, thuộc project/team mà người dùng được truy cập; project chưa bị đóng (`COMPLETED` / `CANCELLED`).
- Sprint đang ở trạng thái `PLANNED` hoặc `ACTIVE` (`canPlan = true`).
- Các Backlog item cần gán tồn tại; item đến từ Product Backlog (chưa thuộc Sprint nào) hoặc từ một Sprint đang `PLANNED` / `ACTIVE`; item đến từ Product Backlog phải ở trạng thái `TODO`.

#### 5.2.3.4. Điều kiện sau

- `sprint_id` của các item trong danh sách gửi lên được gán bằng Sprint hiện tại; các item trước đó thuộc Sprint nhưng không còn trong danh sách được trả về Product Backlog (`sprint_id = null`).
- Phạm vi Sprint được xác định bằng đúng tập item trong mảng `taskIds`; response trả `sprintOrder` 1..n theo thứ tự danh sách do backend dựng lại (sắp theo `id` tăng dần).
- Toàn bộ thay đổi được commit trong **một transaction**; giao diện nhận snapshot mới (`SprintPlanningDTO`) và hiển thị toast **“Đã cập nhật Sprint Backlog và thứ tự ưu tiên.”**.
- Nếu người dùng gán nhanh item ngay sau khi tạo, giao diện hiển thị **“Đã thêm công việc vào Sprint.”** (một item) hoặc **“Đã thêm N công việc vào Sprint.”** (nhiều item).
- Không có item nào bị xoá; trạng thái, người thực hiện, milestone và nội dung của item không thay đổi bởi thao tác gán.
- Nếu Sprint đã bị đóng ở thời điểm xác nhận: không có dữ liệu nào bị thay đổi, board quay về snapshot máy chủ và tải lại dữ liệu.

#### 5.2.3.5. Kích hoạt

Người dùng mở Sprint Workspace (`/sprints`), chuyển sang tab **“Sprints & Backlog”**, chọn một Sprint trong ribbon và thực hiện gán/bỏ gán item (chọn + nút **Assign** / **Unassign**, hoặc kéo–thả giữa hai panel), sau đó bấm **“Confirm assignment”**.

#### 5.2.3.6. Luồng sự kiện chính

| Bước | Tác nhân | Hành động / Phản hồi |
| --- | --- | --- |
| 1 | Người dùng | Mở Sprint Workspace (`/sprints`) và chọn tab “Sprints & Backlog”. |
| 2 | Hệ thống | Kiểm tra `SPRINT_READ`, tải danh sách Sprint theo data scope và chọn mặc định Sprint `ACTIVE`, nếu không có thì Sprint `PLANNED`. |
| 3 | Hệ thống | Gọi `GET /api/sprints/{id}/backlog-items` và nhận `SprintPlanningDTO`: thông tin header Sprint, `sprintItems` (item thuộc Sprint, có `sprintOrder` 1..n), `productBacklogItems` (item chưa thuộc Sprint nào), `canPlan` và `statusMessage`. |
| 4 | Hệ thống | Hiển thị hai panel: **Sprint Backlog** (bên trái, thứ tự hiển thị, tổng giờ ước tính) và **Product & Curricular Backlog** (bên phải, nhóm theo milestone, sắp theo priority / giờ / hạn milestone). Nếu `canPlan = false`, hiển thị banner “Sprint scope is locked” kèm `statusMessage`. |
| 5 | Người dùng | Chọn một hoặc nhiều item ở Product Backlog và bấm **Assign**, hoặc kéo item sang panel Sprint. |
| 6 | Hệ thống | Di chuyển item cục bộ sang Sprint Backlog (chưa gọi API), đánh dấu board có thay đổi chưa lưu. |
| 7 | Người dùng | Sắp xếp lại thứ tự hiển thị trong Sprint Backlog bằng kéo–thả hoặc nút lên/xuống; có thể bấm **Unassign** để đưa item về Product Backlog. |
| 8 | Hệ thống | Hiển thị banner **“Unsaved scope changes”**, badge **Draft** và nút **“Confirm assignment”**. |
| 9 | Người dùng | Bấm **“Confirm assignment”**. |
| 10 | Hệ thống | Gửi `PUT /api/sprints/{id}/backlog-items` với body `{"taskIds": [...]}` là **toàn bộ** danh sách item của Sprint theo đúng thứ tự hiển thị. |
| 11 | Hệ thống | Xác thực JWT, kiểm tra quyền `SPRINT_UPDATE`; tìm Sprint (**404** nếu không tồn tại); kiểm tra data scope và workspace (**403** nếu ngoài phạm vi hoặc project đã đóng). |
| 12 | Hệ thống | Kiểm tra Sprint còn `PLANNED` / `ACTIVE` (**422** nếu đã hoàn thành/huỷ); kiểm tra `taskIds` không trùng và không chứa id `null`; kiểm tra từng item còn tồn tại; item không thuộc Sprint đã đóng; item từ Product Backlog phải `TODO`; item bị bỏ khỏi Sprint phải `TODO`. |
| 13 | Hệ thống | Trong một transaction: gán Sprint cho các item mới, trả các item bị bỏ khỏi danh sách về Product Backlog (`sprint_id = null`) và flush thay đổi; thứ tự hiển thị không được lưu thành cột riêng. |
| 14 | Hệ thống | Trả `200 OK` kèm `SprintPlanningDTO` mới (`canPlan`, `sprintItems` được dựng lại theo `id` tăng dần với `sprintOrder` 1..n, `productBacklogItems` đã cập nhật). |
| 15 | Hệ thống | Thay snapshot máy chủ, xoá lựa chọn, ẩn banner Draft và hiển thị toast “Đã cập nhật Sprint Backlog và thứ tự ưu tiên.”. |

#### 5.2.3.7. Luồng thay thế và ngoại lệ

**5.2.3.7.1. Sprint không tồn tại**

- `sprintId` không trỏ tới Sprint còn tồn tại (bị xoá giữa lúc mở board và lúc xác nhận).
- Hệ thống trả **404 Not Found** (`ResourceNotFoundException`); giao diện hiển thị lỗi và tải lại danh sách Sprint.

**5.2.3.7.2. Sprint đã hoàn thành hoặc đã huỷ**

- Người dùng xác nhận thay đổi nhưng Sprint đã chuyển sang `COMPLETED` / `CANCELLED` (do người khác cập nhật).
- Hệ thống trả **422 Unprocessable Entity** với lỗi `status`: “Không thể thay đổi phạm vi công việc do Sprint đã hoàn thành/đã đóng” hoặc “Không thể thay đổi phạm vi công việc do Sprint đã bị hủy”.
- Giao diện hiển thị toast lỗi, **phục hồi toàn bộ item đã di chuyển về vị trí cũ** theo snapshot máy chủ và tải lại board; không có thay đổi nào được lưu.

**5.2.3.7.3. Danh sách item không hợp lệ**

- Body thiếu `taskIds` hoặc `taskIds = null`: **422** với lỗi `taskIds`: “Danh sách Backlog item của Sprint Backlog không hợp lệ”.
- Danh sách chứa id `null`: **422** “Backlog item không hợp lệ”.
- Danh sách chứa item trùng: **422** “Danh sách Sprint Backlog chứa Backlog item bị trùng”.
- Giao diện giữ nguyên trạng thái board để người dùng sửa và gửi lại.

**5.2.3.7.4. Backlog item không còn tồn tại**

- Một item trong danh sách đã bị xoá: **422** với lỗi `taskIds`: “Backlog item #<id> không tồn tại hoặc đã bị xoá”.
- Toàn bộ thao tác bị từ chối (không gán một phần); board tải lại dữ liệu mới nhất.

**5.2.3.7.5. Item thuộc Sprint đã đóng**

- Item đang thuộc một Sprint `COMPLETED` / `CANCELLED` không thể chuyển sang Sprint hiện tại: **422** với lỗi `taskIds`: “Backlog item #<id> thuộc Sprint đã hoàn thành/đã đóng nên không thể chuyển sang Sprint này”.

**5.2.3.7.6. Sai trạng thái khi gán hoặc bỏ gán**

- Item từ Product Backlog được đưa vào Sprint nhưng không ở trạng thái `TODO`: **422** “A product backlog item can only enter a sprint as TODO”.
- Item bị bỏ khỏi Sprint nhưng không ở trạng thái `TODO`: **422** “Only TODO work items can move back to the product Backlog”.
- Người dùng cần đưa item về `TODO` (trong panel chi tiết) trước khi thay đổi phạm vi.

**5.2.3.7.7. Phiên không hợp lệ hoặc thiếu quyền**

- Token thiếu/hết hạn/không hợp lệ: **401 Unauthorized**.
- Thiếu `SPRINT_UPDATE` khi xác nhận: **403 Forbidden**; thiếu `SPRINT_BACKLOG_UPDATE` thì giao diện không bật chế độ chỉnh sửa (nút Assign/Unassign và Confirm bị vô hiệu hoá).
- Thiếu `SPRINT_READ` khi mở board: **403 Forbidden**.

**5.2.3.7.8. Project/team ngoài phạm vi hoặc workspace đã đóng**

- Sprint thuộc project của tenant khác, không nằm trong assigned workspace, hoặc project đã `COMPLETED` / `CANCELLED`: `AccessDeniedException` → **403 Forbidden** (“Project is outside the assigned workspace scope”, “This project is closed and its workspace is read-only”).
- Với Sprint không gắn project, hệ thống kiểm tra quyền ghi trên team (`requireTeamOnlyWrite`).

**5.2.3.7.9. Dữ liệu bị thay đổi đồng thời**

- Hai người cùng xác nhận phạm vi của một Sprint: request đến sau có thể vi phạm khoá lạc quan (`@Version` của item) → **409 Conflict**; giao diện tải lại board để lấy dữ liệu mới nhất.

**5.2.3.7.10. Người dùng bấm xác nhận nhiều lần**

- Trong lúc đang lưu (`saving = true`), toàn bộ thao tác trên board bị vô hiệu hoá (panel bị mờ, nút Confirm bị disable) nên không phát sinh request lặp.
- Nếu vẫn có request đồng thời, khoá lạc quan/transaction bảo đảm dữ liệu không bị ghi đè âm thầm.

**5.2.3.7.11. Không tải được board**

- Lỗi mạng hoặc API trả lỗi khi gọi `GET /api/sprints/{id}/backlog-items`: giao diện hiển thị Alert “Unable to load the sprint backlog” kèm thông điệp lỗi và nút **Try again**.

**5.2.3.7.12. Lỗi máy chủ**

- Hệ thống trả **500 Internal Server Error**; giao diện hiển thị toast “Không thể cập nhật Sprint Backlog.” và giữ nguyên board để người dùng thử lại.

#### 5.2.3.8. Quy tắc nghiệp vụ và ghi chú

1. Chỉ Sprint ở trạng thái `PLANNED` hoặc `ACTIVE` mới được thay đổi phạm vi (`canPlan = true`). Sprint `COMPLETED` / `CANCELLED` giữ nguyên phạm vi và trả `statusMessage` tương ứng để giao diện hiển thị banner khoá.
2. `taskIds` là **danh sách đầy đủ** các item thuộc phạm vi Sprint; item thuộc Sprint nhưng vắng mặt sẽ bị trả về Product Backlog. Gửi danh sách rỗng sẽ bỏ toàn bộ item khỏi Sprint (mỗi item phải đang `TODO`). Mảng được gửi theo thứ tự đang hiển thị trên board, nhưng backend chỉ lưu quan hệ phạm vi và dựng lại danh sách theo `id` tăng dần; do đó thứ tự kéo–thả chỉ có hiệu lực trong phiên hiển thị hiện tại, chưa được lưu bền vững.
3. Item chưa thuộc Sprint nào được xem là item của Product Backlog; chỉ các item này (và item thuộc Sprint đang `PLANNED` / `ACTIVE` khác) mới được đưa vào Sprint hiện tại.
4. Item đang thuộc Sprint đã `COMPLETED` / `CANCELLED` không thể chuyển sang Sprint khác.
5. Item từ Product Backlog chỉ được vào Sprint khi đang `TODO`; chỉ item `TODO` mới được bỏ khỏi Sprint về Product Backlog.
6. Thao tác gán chỉ thay đổi quan hệ Sprint của item; không thay đổi tiêu đề, mô tả, milestone, người thực hiện, ước lượng, priority hay trạng thái của item.
7. Không xoá dữ liệu: item bị bỏ khỏi phạm vi vẫn tồn tại với `sprint_id = null` và xuất hiện lại ở panel Product Backlog.
8. Toàn bộ thay đổi được commit trong một transaction; lỗi ở bất kỳ item nào sẽ huỷ toàn bộ thao tác (all-or-nothing).
9. Panel Product Backlog sắp xếp mặc định theo priority giảm dần, có thể đổi sang sắp theo giờ ước tính hoặc hạn milestone; nhóm mặc định theo milestone và hiển thị cảnh báo khi có item mở có hạn milestone trước ngày kết thúc Sprint.
10. Panel Sprint Backlog hiển thị tổng giờ ước tính của phạm vi hiện tại (“Target capacity”) và hỗ trợ lọc theo từ khoá, priority, trạng thái (chỉ ảnh hưởng hiển thị, không ảnh hưởng dữ liệu gửi lên).
11. Quyền: xem board cần `SPRINT_READ`; xác nhận cần `SPRINT_UPDATE`; giao diện bật chỉnh sửa khi có đồng thời `SPRINT_UPDATE` và `SPRINT_BACKLOG_UPDATE`.
12. Thao tác xác nhận phạm vi chỉ cập nhật quan hệ Sprint của các Backlog item; audit `CREATE` / `UPDATE` / `DELETE` và outbox event của item thuộc luồng tạo/sửa Backlog item (UFR-PRJ-003-02), không sinh thêm bản ghi audit/outbox riêng cho thao tác gán.
13. Danh sách Product Backlog trên board là các item có `sprint_id = null`; item đã thuộc một Sprint khác không xuất hiện ở panel này.

#### 5.2.3.9. Minh chứng kiểm thử Backend trên Swagger

##### 5.2.3.9.1. API xác nhận phạm vi Sprint Backlog (gán / bỏ gán item)

- **API:** `PUT /api/sprints/{id}/backlog-items`
- **Header:** `Authorization: Bearer <access_token>`; tuỳ chọn `X-Correlation-ID: <uuid>`.
- **Dữ liệu gửi lên:**

```json
{
  "taskIds": [2, 1, 3]
}
```

- **Kết quả mong đợi:** `200 OK`, trả về `SprintPlanningDTO` với `canPlan = true`, `sprintItems` gồm đúng ba item `#1`, `#2`, `#3` (backend dựng lại theo `id` tăng dần) với `sprintOrder` lần lượt `1, 2, 3`; các item không còn trong danh sách chuyển về `productBacklogItems`.
- **Kết quả thực tế:** `[Điền HTTP status code và thông tin phản hồi thực tế]`

**Hình 5.2.3-1. Kết quả kiểm thử API xác nhận phạm vi Sprint Backlog trên Swagger**

##### 5.2.3.9.2. API tải board Sprint Planning

- **API:** `GET /api/sprints/{id}/backlog-items`
- **Header:** `Authorization: Bearer <access_token>`.
- **Dữ liệu gửi lên:** không có body; `id` của Sprint truyền trên path.
- **Kết quả mong đợi:** `200 OK`, trả về `SprintPlanningDTO` gồm header Sprint (`sprintId`, `sprintName`, `sprintGoal`, `status`, `startDate`, `endDate`, `projectId`), `canPlan`, `statusMessage`, danh sách `sprintItems` (có `sprintOrder`) và `productBacklogItems`.
- **Kết quả thực tế:** `[Điền HTTP status code và thông tin phản hồi thực tế]`

**Hình 5.2.3-2. Kết quả kiểm thử API tải Sprint Planning board trên Swagger**

#### 5.2.3.10. Màn hình Frontend

Màn hình Sprint Workspace (`/sprints`) → tab **“Sprints & Backlog”**, gồm ribbon chọn Sprint, panel **Sprint Backlog** (thứ tự hiển thị, tổng giờ ước tính) và panel **Product & Curricular Backlog** (nhóm theo milestone, lọc/sắp xếp), các nút **Assign** / **Unassign**, banner **“Unsaved scope changes”** với nút **“Confirm assignment”**, và banner khoá phạm vi khi Sprint đã hoàn thành/huỷ.

Ảnh chụp cần thể hiện: (1) board sau khi kéo một item từ Product Backlog sang Sprint Backlog (banner Draft + nút Confirm assignment xuất hiện), và (2) trạng thái sau khi xác nhận thành công (item nằm trong Sprint Backlog, toast “Đã cập nhật Sprint Backlog và thứ tự ưu tiên.”).

**Hình 5.2.3-3. Màn hình gán Backlog item vào Sprint**
