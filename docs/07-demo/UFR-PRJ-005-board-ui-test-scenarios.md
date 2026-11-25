# Kịch bản kiểm thử UI — UFR-PRJ-005 Sprint Board

## 1. Mục tiêu

Kiểm thử trang Board trên giao diện React với API backend thật và bộ dữ liệu mock cục bộ. Các kịch bản bao phủ tải thành công, sáu cột, card, Activity Trail, trạng thái rỗng, lỗi tải, xác thực, phạm vi tenant/membership và khả năng tải lại không làm thay đổi dữ liệu. Board/Task yêu cầu đăng nhập và membership đúng Project; không yêu cầu permission riêng `BOARD_READ`, `TASK_CREATE` hoặc `TASK_UPDATE`.

> Board là giao diện đọc, ngoại trừ nút **Add task** mở form tạo Task tối thiểu theo UFR-PRJ-004. Form hiện hỗ trợ title, description, estimate, priority và assignee; tag/dependency chưa có domain/API nên chưa được hỗ trợ.

## 2. Điều kiện trước khi test

1. Chạy backend từ thư mục `backend`. Với cấu hình H2 local, dữ liệu Board demo được bật mặc định; có thể bật tường minh:

   ```powershell
   $env:APP_SEED_BOARD_ENABLED = "true"
   .\mvnw.cmd spring-boot:run
   ```

   Chỉ dùng dữ liệu seed này ở local demo; đặt `APP_SEED_BOARD_ENABLED=false` ở môi trường dùng chung/production.

2. Đợi log `Board demo data enabled`. Ghi lại các ID ở dòng đó:

   ```text
   projectId=..., sprintId=..., emptyProjectId=..., emptySprintId=...,
   nonMemberProjectId=..., nonMemberSprintId=...,
   otherTenantProjectId=..., otherTenantSprintId=...
   ```

   Database H2 là in-memory nên ID có thể đổi sau mỗi lần khởi động.

3. Trong terminal khác, vào thư mục `frontend` và chạy:

   ```powershell
   npm run dev
   ```

4. Mở URL Vite được in ra, đăng nhập tài khoản Student để kiểm tra quyền xem:

   ```text
   Email: student@example.com
   Password: password123
   ```

5. Vào trang Board bằng tài khoản Student hoặc Teacher thuộc Project demo:
   - Trang Student: chọn **Mở bảng công việc**.
   - Mở trực tiếp `http://localhost:5173/project-board`.

6. Trên trang Board, chọn Project trong danh sách **Project**, chọn Sprint trong danh sách **Sprint**, rồi bấm **Mở Board**. Các lựa chọn chỉ chứa Project thuộc phạm vi người dùng và Sprint của Project đã chọn. ID từ log chỉ cần khi gọi API/đối chiếu hoặc mở URL trực tiếp:

   ```text
   http://localhost:5173/project-board?projectId=<projectId>&sprintId=<sprintId>
   ```

## 3. Kịch bản test

| ID | Tình huống | Bước thực hiện | Kết quả mong đợi |
|---|---|---|---|
| UI-01 | Mở trang chưa chọn Project/Sprint | Mở `/project-board` | Hiện hướng dẫn chọn Project/Sprint; danh sách Project tải theo scope; chưa báo Board rỗng. |
| UI-02 | Chọn Project và Sprint | Chọn Project được phép, sau đó chọn Sprint và bấm **Mở Board** | Sprint options được tải theo Project; không cần nhập ID; khi tải xong hiện thông tin Sprint, sáu cột và Activity Trail. |
| UI-03 | Tải Board thành công | Chọn Project/Sprint demo rồi bấm **Mở Board** | Trong lúc tải có skeleton/nhãn; sau đó hiện Sprint, ngày, mục tiêu, sáu cột và Activity Trail. |
| UI-04 | Kiểm tra số cột và thứ tự | Quan sát Board thành công | Đúng thứ tự Backlog, To do, In progress, Review, Done, Blocked; mỗi header có bộ đếm. |
| UI-05 | Kiểm tra card | Xem từng card ở Board thành công | Mỗi card có mã, tiêu đề, trạng thái; có người phụ trách/priority khi dữ liệu có. Trạng thái card khớp cột; Backlog vẫn giữ trạng thái thật. |
| UI-06 | Board hoàn toàn rỗng | Chọn Project demo rỗng và Sprint của nó | Sprint vẫn hiện; thông báo “Chưa có công việc”; sáu cột rỗng và tất cả bộ đếm bằng `0`; không hiện lỗi. |
| UI-07 | Tải lại Board | Bấm nút tải lại trên khu vực Sprint; lặp lại vài lần | Có trạng thái tải; Board và Activity vẫn cùng dữ liệu; không có task/activity mới do GET. |
| UI-08 | Không có Project/Sprint trong lựa chọn | Dùng tài khoản chưa thuộc Project nào hoặc Project chưa có Sprint | Danh sách rỗng có thông báo phù hợp; không tự tải Board khác. |
| UI-09 | Không có membership | Dùng token student gọi trực tiếp `board-sprints`/Board với `nonMemberProjectId` từ log | API trả `403`; không lộ tên, task, member hoặc số lượng của Project đó trong UI. |
| UI-10 | Khác tenant | Dùng token student gọi trực tiếp API với `otherTenantProjectId` từ log | API trả `403`; Project khác tenant không xuất hiện trong dropdown. |
| UI-11 | Phiên không còn hợp lệ | Đăng xuất hoặc xóa `token` khỏi localStorage rồi tải Board | Nếu API trả 401, interceptor xử lý phiên theo thiết kế auth; người dùng được chuyển đăng nhập hoặc thấy hướng dẫn xác thực lại; không thấy Board rỗng. |
| UI-12 | Đăng nhập nhưng không có permission riêng | Dùng tài khoản authenticated không có `BOARD_READ`/`TASK_CREATE`/`TASK_UPDATE`, nhưng là member của Project | Board/List/đổi trạng thái vẫn hoạt động trong Project thuộc scope. |
| UI-13 | Membership bắt buộc khi tạo/cập nhật | Dùng authenticated user không thuộc Project, gọi API tạo hoặc đổi trạng thái | API trả `403`; không tạo/sửa Task hoặc audit. |
| UI-14 | Mở form tạo Task | Bấm **New Task** trên Board của Project mình là member | Form hiện đúng Project/Sprint; danh sách assignee chỉ gồm thành viên active thuộc Project hiện tại. |
| UI-15 | Backend dừng hoặc sai API URL | Dừng backend, tải lại Board | Hiện trạng thái không kết nối/tải lỗi và nút thử lại; không hiển thị “chưa có công việc”. |
| UI-16 | Responsive | Mở trang ở viewport desktop, tablet, mobile | Form tự xếp lại; sáu cột có thể cuộn ngang; card/Activity không tràn khỏi viewport. |
| UI-17 | Lọc theo thành viên | Chọn một người trong bộ lọc **Tất cả thành viên** | Chỉ card đã được API trả về và gán cho người đó còn hiển thị; bộ đếm cột cập nhật theo số card đang hiển thị; xóa lọc trả lại danh sách đầy đủ. |
| UI-18 | List View | Chuyển từ **Board View** sang **List View**, rồi lọc thành viên | UI tải List API; cùng ngữ cảnh có cùng tập task với Board (đối chiếu `task_id`); lọc không làm thay đổi dữ liệu. |
| UI-19 | Sprint summary và tiến độ | Tải Board có task | Hiện Project/Sprint ID, ngày bắt đầu/kết thúc, mục tiêu, tổng task thuộc Sprint, số Done, tỷ lệ Done theo task count và số Blocked. Backlog không tính là task trong Sprint. |
| UI-20 | Không có kết quả sau khi lọc | Chọn thành viên không có task hoặc “Chưa phân công” khi không có task phù hợp | Hiện thông báo không có kết quả của bộ lọc và nút xóa lọc; không nhầm với Project/Sprint rỗng. |
| UI-21 | Tạo Task thành công | Mở form, nhập title; thêm description, estimate > 0, priority và một assignee hợp lệ; bấm **Tạo Task** | Nút bị khóa trong khi gửi; thông báo thành công có mã Task dạng `<PROJECT_CODE>-<taskId>`; form đóng; Board tải lại và hiển thị Task ở cột TODO; Activity Trail có sự kiện `TASK_CREATED`. |
| UI-22 | Tạo Task không phân công | Để assignee là “Chưa phân công”, nhập title hợp lệ và gửi | Task được tạo thành công; thẻ hiển thị “Chưa phân công”; không tự gán người hoặc priority không được chọn. |
| UI-23 | Validation form | Để title trống hoặc nhập estimate `0`/âm, rồi thử gửi | Trình duyệt hoặc API chặn dữ liệu; lỗi hiển thị rõ; không tạo Task, Activity hay outbox event. |
| UI-24 | API trả validation 422 | Gửi title chỉ có khoảng trắng, estimate không hợp lệ hoặc assignee không thuộc Project; có thể thử bằng DevTools/API client | Hiện thông báo lỗi; các giá trị đã nhập vẫn còn trong form; không báo thành công và không tạo dữ liệu một phần. |
| UI-25 | Thử gửi lặp nhanh | Bấm **Tạo Task** nhiều lần khi request còn đang chạy | Nút disabled và chỉ có một request được gửi từ lần thao tác đó; sau thành công chỉ có một Task mới trên Board. |
| UI-26 | Danh sách assignee lỗi | Tạm chặn endpoint `GET /api/projects/{projectId}/task-assignees` | Form báo không tải được thành viên; vẫn cho phép tạo Task không phân công; không tự tạo hoặc gán assignee giả. |
| UI-27 | Project/Sprint hết hiệu lực | Gửi request tạo với Project hoặc Sprint không tồn tại/không thuộc Project | UI hiển thị lỗi không tìm thấy; không đóng form như thể thành công và không hiển thị Task từ scope khác. |
| UI-28 | List API và dữ liệu Board | Mở List View trong cùng Project/Sprint; so sánh `task_id` với tổng card Board | List phản ánh cùng tập backlog + sprint task; tên, trạng thái, người phụ trách, ưu tiên thống nhất; backlog vẫn hiển thị trạng thái thật. |
| UI-29 | Lọc, tìm kiếm, sắp xếp, phân trang | Tìm theo mã/tên, lọc trạng thái hoặc người phụ trách, đổi sort, bấm trang kế | Kết quả đáp ứng điều kiện; hiển thị loading trong khi tải; không có request làm đổi Task hay tạo Activity. |
| UI-30 | List rỗng và tải lỗi | Chọn filter không có kết quả; sau đó thử sai ID hoặc tắt backend | Có thông báo rỗng khi tải thành công nhưng không có kết quả; lỗi 403/404/5xx hiển thị riêng, không giả thành List rỗng. |
| UI-31 | Đổi trạng thái hợp lệ | Với Task TODO chọn IN_PROGRESS và bấm **Lưu** | Nút bị khóa trong lúc gửi; UI báo thành công; Board/List tải lại, version tăng 1; Activity Trail ghi actor, thời điểm, trạng thái trước/sau, correlation ID. |
| UI-32 | Workflow không hợp lệ | Chọn DONE trực tiếp từ IN_PROGRESS (hoặc REVIEW trực tiếp từ TODO) | API trả `409`; UI giữ lựa chọn để điều chỉnh; Task không đổi và không xuất hiện thêm lịch sử thành công. |
| UI-33 | Task cập nhật đồng thời | Gửi PATCH với version cũ qua API hoặc hai cửa sổ đã mở cùng Task | API trả `409` kèm `currentVersion`; UI giữ lựa chọn chưa lưu và cung cấp tải lại để đối chiếu; không ghi đè thay đổi mới. |
| UI-34 | Trạng thái không hợp lệ | Gửi `status: "PENDING"` trong request API | API trả `422` với lỗi trường status; Task, audit và outbox không đổi. |
| UI-35 | Retry cùng yêu cầu trạng thái | Gửi lại nguyên PATCH với cùng `X-Correlation-ID`, status và expectedVersion | Request được xác nhận idempotent; trạng thái/version không tăng lần hai; chỉ có một bản ghi history và outbox event. |
| UI-36 | Xem lịch sử Task | Trong List View, bấm **Lịch sử** của Task vừa cập nhật | Dialog hiển thị đúng Task, trạng thái trước/sau, version, actor, thời gian và correlation ID; Task chưa đổi trạng thái có empty state riêng. |
| UI-37 | Scope và xác thực List/Update | Gọi List/history/update với token hết hạn, Project ngoài scope hoặc Task không tồn tại | API lần lượt trả `401`, `403` hoặc `404`; UI không biến thành kết quả rỗng và không lộ dữ liệu ngoài scope. |

## 4. Kiểm tra API trực tiếp khi cần phân biệt lỗi UI/backend

Trang sử dụng endpoint:

```http
GET /api/projects/{projectId}/sprints/{sprintId}/board
Authorization: Bearer <accessToken>
```

Đăng nhập qua `POST /api/auth/login`; lấy `accessToken`. Board và Task yêu cầu phiên hợp lệ, tenant active và membership Project; không kiểm tra các permission riêng `BOARD_READ`, `TASK_CREATE`, `TASK_UPDATE`. Nếu UI báo lỗi, gọi endpoint bằng Swagger/Postman với cùng token và ID để phân biệt lỗi API với lỗi hiển thị.

List hỗ trợ `sprintId`, `status`, `assigneeProjectMemberId`, `unassigned`, `search`, `page`, `size`, `sortBy` và `direction`. Với `sprintId`, API trả các task Backlog (sprintId null) cùng task thuộc sprint, đúng tập được Board hiển thị.

```http
GET /api/projects/{projectId}/tasks?sprintId={sprintId}&page=0&size=10&sortBy=code&direction=ASC
```

Để kiểm tra tạo Task, dùng token đã đăng nhập của thành viên Project:

```http
GET /api/projects/{projectId}/task-assignees
POST /api/projects/{projectId}/sprints/{sprintId}/tasks
X-Correlation-ID: <UUID>
Content-Type: application/json
```

```json
{
  "title": "Kiểm thử tạo Task từ Board",
  "description": "Task tạo trong môi trường demo",
  "estimatedHours": 2,
  "priority": "MEDIUM",
  "assigneeProjectMemberId": 1
}
```

`assigneeProjectMemberId` phải là ID thành viên trong kết quả endpoint assignees; có thể bỏ trường này để tạo Task chưa phân công. Thành công trả `201`; lỗi dữ liệu trả `422`. Activity và outbox event được lưu cùng transaction. Outbox relay hiện chỉ đánh dấu event đã publish và ghi log trong ứng dụng; chưa tích hợp broker/event bus ngoài.

Đổi trạng thái cần token đã đăng nhập và membership thuộc Project; lấy `expectedVersion` từ List/Board và gửi correlation ID ổn định cho cùng một lần thử lại:

```http
PATCH /api/projects/{projectId}/tasks/{taskId}/status
X-Correlation-ID: <UUID>
Content-Type: application/json
```

```json
{
  "status": "IN_PROGRESS",
  "expectedVersion": 0
}
```

Workflow demo: `TODO → IN_PROGRESS → REVIEW → DONE`; từ `TODO`, `IN_PROGRESS` hoặc `REVIEW` được chuyển sang `BLOCKED`; từ `BLOCKED` được trở về `TODO` hoặc `IN_PROGRESS`; `DONE` là trạng thái kết thúc. Workflow sai hoặc version cũ trả `409`; enum không hợp lệ trả `422`. Lịch sử lấy tại:

```http
GET /api/projects/{projectId}/tasks/{taskId}/status-history
```

## 5. Tiêu chí hoàn tất

- UI-01 đến UI-37 đã được kiểm tra; ghi rõ Pass/Fail và môi trường/ID dùng.
- Không có response lỗi nào bị biến thành trạng thái Board rỗng.
- Board chỉ hiển thị dữ liệu trả về đúng phạm vi; refresh không tạo task hoặc activity.
- Build frontend thành công.
- Các lỗi không thuộc Board cần được ghi riêng, không đánh dấu Board rỗng hay thành công thay thế.

## 6. Giới hạn hiện tại

- Mock dataset tạo qua `APP_SEED_BOARD_ENABLED=true`; không bật seed này ở môi trường dùng chung/production.
- Project/Sprint được chọn từ danh sách lấy theo tenant và membership của người dùng.
- Form tạo Task chưa hỗ trợ tag/dependency do domain/API tương ứng chưa được cung cấp.
- Outbox event hiện được ghi bền vững trong database và relay đánh dấu trạng thái/ghi log; chưa có tích hợp gửi ra broker hoặc event bus bên ngoài.
