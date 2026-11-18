# Kịch bản demo UFR-PRJ-005 — Board, List và lịch sử trạng thái

**Thời lượng:** 10–15 phút  
**Phạm vi:** US01 Xem Board, US02 Xem danh sách, US03 Ghi nhận lịch sử đổi trạng thái; kèm luồng tạo Task tối thiểu để tạo dữ liệu demo.

## 1. Chuẩn bị

1. Mở terminal backend:

   ```powershell
   Set-Location D:\Download\starterProject202603\StarterProject202603\backend
   $env:APP_SEED_BOARD_ENABLED = "true"
   .\mvnw.cmd spring-boot:run
   ```

   Cấu hình H2 local bật seed Board demo mặc định. Đặt `APP_SEED_BOARD_ENABLED=false` ở môi trường dùng chung/production.

2. Đợi dòng log `Board demo data enabled`. ID trong log chỉ cần để đối chiếu/gọi API; giao diện demo sẽ tải Project/Sprint được phép chọn. H2 là database in-memory nên ID có thể thay đổi sau mỗi lần khởi động.
3. Mở frontend từ terminal khác:

   ```powershell
   Set-Location D:\Download\starterProject202603\StarterProject202603\frontend
   npm run dev
   ```

   Mở URL Vite in ra. Backend mặc định cho phép `http://localhost:5173`. Nếu Vite chạy tại port khác, đặt `APP_FRONTEND_DOMAIN` bằng origin frontend đó rồi khởi động lại backend.

4. Đăng nhập tài khoản Student để xem Board/List:

   ```text
   student@example.com
   password123
   ```

5. Mở trang Board:

   ```text
   http://localhost:5173/project-board
   ```

   Chọn Project demo trong danh sách **Project**, chọn Sprint trong danh sách **Sprint**, rồi bấm **Mở Board**. Không cần lấy ID từ log để nhập vào giao diện.

## 2. Demo US01 — Xem Board và tạo Task demo

1. Chỉ vào thông tin Project/Sprint: tên sprint, ngày bắt đầu/kết thúc, mục tiêu.
2. Chỉ lần lượt sáu cột **Backlog, To do, In progress, Review, Done, Blocked** và bộ đếm. Giải thích Backlog là nhóm task chưa thuộc sprint, không phải trạng thái mới.
3. Mở một card và đối chiếu mã, tên, người phụ trách, ưu tiên, trạng thái với dữ liệu hiển thị.
4. Bấm tải lại Board. Các cột và Activity Trail được đọc lại; thao tác xem không tạo thay đổi.
5. Bấm **New Task**, nhập title, estimate dương; tùy chọn mô tả, priority, assignee; bấm tạo một lần.
6. Xác nhận toast có mã `PROJECT_CODE-taskId`, Task xuất hiện ở **To do**, và Activity Trail có `TASK_CREATED`.

## 3. Demo US02 — Danh sách công việc

1. Chọn **List View**. Giải thích đây là List API có phân trang, tìm kiếm, lọc trạng thái/thành viên và sắp xếp, không chỉ là đổi cách vẽ cùng một response Board.
2. Đối chiếu mã/ID, tên, trạng thái, assignee và priority của một Task với Board. Nếu Task nằm trong Backlog, List vẫn hiển thị trạng thái đã lưu như `TODO`.
3. Thử tìm theo mã Task vừa tạo; lọc theo `TODO`; đổi chiều sắp xếp; chuyển trang nếu có đủ dữ liệu.
4. Chọn một bộ lọc không có kết quả để xem empty state. Bấm tải lại hoặc bỏ lọc để quay về danh sách.

## 4. Demo US03 — Đổi trạng thái, workflow và audit

### Đổi trạng thái hợp lệ qua UI

1. Trong List View, chọn một Task `TODO`, đổi trạng thái sang `IN_PROGRESS`, bấm **Lưu**.
2. Xác nhận nút bị khóa trong khi gửi và UI báo thành công.
3. Xác nhận trạng thái/version mới trong List; quay về Board để thấy Task chuyển cột.
4. Mở **Lịch sử** trên đúng dòng Task. Chỉ ra trạng thái trước/sau, version, actor, thời gian và correlation ID.
5. Activity Trail của Project cũng phản ánh lần đổi trạng thái sau khi Board tải lại.

### Demo request bị từ chối mà không làm thay đổi dữ liệu

Trong Postman/Swagger, dùng access token của tài khoản demo, thay `<projectId>` và `<taskId>` bằng giá trị thật. Đọc version hiện tại từ List API trước khi gửi; Task tạo mới có thể bắt đầu ở version `1` do mã Task được gán sau lần persist đầu tiên.

**Workflow không hợp lệ:** từ `IN_PROGRESS` gửi thẳng `DONE`; phải trả `409`, current version/status không đổi, history vẫn chỉ có lần cập nhật hợp lệ.

```http
PATCH /api/projects/<projectId>/tasks/<taskId>/status
X-Correlation-ID: <UUID-mới>
Content-Type: application/json
```

```json
{
  "status": "DONE",
  "expectedVersion": <version_đọc_từ_List_API>
}
```

Thay `<version_đọc_từ_List_API>` bằng số version thật của Task. `IN_PROGRESS → DONE` không hợp lệ nên API trả `409`, trả lại version hiện hành và không ghi thêm audit.

**Version cũ:** gửi một trạng thái hợp lệ tiếp theo nhưng đặt `expectedVersion` thấp hơn version hiện hành (ví dụ `currentVersion - 1`); API trả `409` kèm `currentVersion` mới nhất, không ghi thêm audit.

**Status không hợp lệ:** gửi `PENDING`; API trả `422` nêu trường `status`, không thay đổi Task/history/outbox.

```json
{
  "status": "PENDING",
  "expectedVersion": 1
}
```

**Retry idempotent:** gửi lại đúng request thành công đầu tiên với đúng `X-Correlation-ID`, status và `expectedVersion` đã dùng ban đầu. API xác nhận cùng kết quả; version không tăng lần nữa và history chỉ có một bản ghi cho correlation ID đó.

## 5. Các endpoint để người demo đối chiếu

```http
GET   /api/projects/{projectId}/sprints/{sprintId}/board
GET   /api/projects/{projectId}/tasks?sprintId={sprintId}&page=0&size=10&sortBy=code&direction=ASC
POST  /api/projects/{projectId}/sprints/{sprintId}/tasks
PATCH /api/projects/{projectId}/tasks/{taskId}/status
GET   /api/projects/{projectId}/tasks/{taskId}/status-history
```

List theo Sprint trả các Task Backlog cùng Task thuộc Sprint để khớp tập dữ liệu Board. `TASK_STATUS_CHANGED` audit và outbox event `fams.kanban.card_moved` được ghi trong cùng transaction với trạng thái.

## 6. Kết thúc demo và giới hạn cần nói rõ

- Refresh Board/List không tạo Task hoặc audit.
- Nếu demo bị sai filter, tải lại dữ liệu; không tự sửa trạng thái bằng thao tác refresh.
- Outbox event được lưu bền vững và relay hiện ghi log/đánh dấu `PUBLISHED` trong ứng dụng. Dự án hiện chưa cấu hình broker/event bus bên ngoài, nên không trình bày đây là sự kiện đã gửi tới hệ thống messaging bên ngoài.
- Mock data chỉ dùng local demo; không bật `APP_SEED_BOARD_ENABLED` ở môi trường dùng chung hoặc production.
