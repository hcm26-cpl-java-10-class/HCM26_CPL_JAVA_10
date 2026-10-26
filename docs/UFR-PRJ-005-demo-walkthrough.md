# Hướng dẫn demo từng bước — UFR-PRJ-005

Tài liệu này hướng dẫn demo trực tiếp ba luồng **Board (US01)**, **List (US02)** và **lịch sử đổi trạng thái (US03)**. Mỗi bước nêu rõ vị trí thao tác và dấu hiệu thành công để người demo có thể đối chiếu ngay.

**Thời lượng dự kiến:** 10–15 phút  
**Môi trường:** chạy local, backend Spring Boot, frontend React/Vite và dữ liệu demo H2.

## 1. Khởi động ứng dụng và lấy ID demo

### 1.1. Khởi động backend

**Ở đâu:** mở một cửa sổ PowerShell tại thư mục dự án.

```powershell
Set-Location D:\Download\starterProject202603\StarterProject202603\backend
$env:APP_SEED_BOARD_ENABLED = "true"
# Chỉ cần dòng này nếu frontend đang chạy ở cổng 5175:
$env:APP_FRONTEND_DOMAIN = "http://localhost:5175"
.\mvnw.cmd spring-boot:run
```

Với cấu hình H2 local mặc định, seed Board demo được bật ngay cả khi bỏ dòng `APP_SEED_BOARD_ENABLED`; biến này có thể dùng để bật/tắt tường minh. Đặt `APP_SEED_BOARD_ENABLED=false` ở môi trường dùng chung/production.

Nếu giao diện chạy tại `http://localhost:5173`, bỏ dòng `APP_FRONTEND_DOMAIN` để dùng cấu hình mặc định. Nếu dùng cổng frontend khác, thay `5175` bằng đúng cổng đó. Nếu backend đã chạy ở cổng `8080`, không khởi động thêm một bản thứ hai; dùng backend hiện tại nếu log cho biết seed đã bật, nếu không thì khởi động lại với cấu hình seed ở trên.

**Dấu hiệu thành công:**

- Backend khởi động không có lỗi và nhận request ở `http://localhost:8080`.
- Terminal in dòng `Board demo data enabled`.
- Các ID trong dòng log hữu ích để kiểm tra API hoặc mở URL trực tiếp. Khi demo qua UI, không cần chép/nhập ID thủ công: trang Board sẽ tải các Project và Sprint người dùng được phép truy cập.

> H2 là database in-memory. ID có thể thay đổi mỗi lần khởi động backend; luôn dùng ID từ log của lần chạy hiện tại.

### 1.2. Khởi động frontend

**Ở đâu:** mở cửa sổ PowerShell thứ hai.

```powershell
Set-Location D:\Download\starterProject202603\StarterProject202603\frontend
npm run dev
```

Mở URL Vite được in trong terminal. Trong phiên demo hiện tại có thể dùng `http://localhost:5175`; nếu Vite in ra cổng khác, dùng đúng URL đó. Nếu backend từ chối request CORS, đặt `APP_FRONTEND_DOMAIN` đúng origin frontend rồi khởi động lại backend.

**Dấu hiệu thành công:** trang đăng nhập của ứng dụng hiển thị và không có lỗi kết nối frontend.

### 1.3. Đăng nhập và mở Board

**Ở đâu:** trong trình duyệt, mở trang frontend và đăng nhập:

```text
Email:    student@example.com
Password: password123
```

Mở trang:

```text
<URL-frontend>/project-board
```

Ví dụ nếu frontend chạy cổng 5175:

```text
http://localhost:5175/project-board
```

Trên trang **Bảng công việc**, mở danh sách **Project**, chọn Project demo phù hợp; sau đó mở danh sách **Sprint**, chọn Sprint muốn xem và bấm **Mở Board**. Danh sách chọn chỉ hiển thị Project thuộc tenant/phạm vi membership của tài khoản; danh sách Sprint được tải theo Project đã chọn.

**Dấu hiệu thành công:** nút **Mở Board** bật sau khi đã chọn Project và Sprint; hiện tên Project/Sprint và thông tin sprint; Board có sáu cột; không có thông báo lỗi tải.

## 2. Demo US01 — Board và tạo Task

| Bước | Ở đâu làm gì | Dấu hiệu thành công |
|---|---|---|
| 1 | Trên Board, chỉ vào tên Project/Sprint, thời gian và mục tiêu sprint. | Ngữ cảnh đang xem khớp Project/Sprint ID vừa nhập. |
| 2 | Chỉ lần lượt các cột **Backlog**, **To do**, **In progress**, **Review**, **Done**, **Blocked** và số đếm trên mỗi cột. | Có đủ sáu cột. Task mẫu xuất hiện ở các trạng thái tương ứng. Backlog là nhóm hiển thị, không phải trạng thái mới; task trong Backlog vẫn có trạng thái lưu như `TODO`. |
| 3 | Mở/đối chiếu một card: mã, tên, trạng thái, người phụ trách và độ ưu tiên. | Thông tin trên card khớp với task; assignee/priority chưa có thì không bị tự suy diễn thành dữ liệu đã lưu. |
| 4 | Bấm **Tải lại Board**. | Có trạng thái tải rồi Board hiển thị lại. Việc tải lại không tạo task hoặc lịch sử mới. |
| 5 | Bấm **New Task**. Nhập tiêu đề, estimate dương; có thể nhập mô tả, chọn priority và assignee. Bấm **Tạo Task** một lần. | Nút lưu bị khóa trong lúc gửi; sau thành công có thông báo kèm mã task; form đóng; task mới xuất hiện ở **To do** và Activity Trail có sự kiện tạo task. |

Để tránh làm rối dữ liệu demo, có thể bỏ qua bước tạo task nếu chỉ cần trình bày task mẫu đã được seed.

## 3. Demo US02 — List, lọc và đối chiếu Board

| Bước | Ở đâu làm gì | Dấu hiệu thành công |
|---|---|---|
| 1 | Trên cùng trang, chuyển từ **Board View** sang **List View**. | Danh sách công việc hiển thị dưới dạng từng dòng, có mã/ID, tên, trạng thái, người phụ trách và độ ưu tiên. |
| 2 | Đối chiếu một task bất kỳ trên List với card tương ứng trên Board. | Cùng task có cùng mã/ID, tên, trạng thái đã lưu, assignee và priority. Task thuộc Backlog vẫn hiện trạng thái lưu thực tế, ví dụ `TODO`. |
| 3 | Dùng ô tìm kiếm để tìm mã task mẫu (ví dụ `DEMO-101`) hoặc mã task vừa tạo. | Chỉ còn kết quả khớp tìm kiếm; không có dữ liệu task bị thay đổi. |
| 4 | Dùng bộ lọc trạng thái/thành viên nếu có, sau đó đổi sắp xếp. | Kết quả thay đổi theo điều kiện; bỏ điều kiện lọc thì danh sách đầy đủ trở lại. |
| 5 | Chuyển trang nếu có nhiều kết quả; bấm nút **Tải lại danh sách**. | Trang dữ liệu được tải lại; loading có nhãn; nếu không có kết quả sẽ thấy thông báo rỗng, không có dòng giả. Lọc, sắp xếp, phân trang và tải lại không tạo lịch sử đổi trạng thái. |

## 4. Demo US03 — Đổi trạng thái và xem lịch sử

### 4.1. Chuyển trạng thái hợp lệ

Workflow demo đã thống nhất:

```text
TODO → IN_PROGRESS → REVIEW → DONE
TODO / IN_PROGRESS / REVIEW → BLOCKED
BLOCKED → TODO hoặc IN_PROGRESS
DONE là trạng thái kết thúc
```

**Ở đâu làm gì:** trong **List View**, tìm một task có trạng thái `TODO`. Ở dòng task đó, chọn `IN_PROGRESS` trong điều khiển trạng thái rồi bấm nút lưu (biểu tượng lưu ở cùng dòng).

**Dấu hiệu thành công:**

1. Nút lưu không gửi lặp khi request đang xử lý.
2. UI báo cập nhật thành công và List hiển thị `IN_PROGRESS`.
3. Chuyển lại **Board View** hoặc bấm **Tải lại Board**; task nằm ở cột **In progress**.
4. Trở lại List, bấm **Lịch sử** trên đúng dòng task.
5. Hộp **Lịch sử trạng thái** có bản ghi mới gồm trạng thái trước/sau, người thực hiện, thời điểm và correlation ID. Bản ghi thể hiện đúng task vừa cập nhật.

### 4.2. Trình bày các lỗi được bảo vệ (tùy chọn)

Các trường hợp dưới đây cần gọi API bằng Postman hoặc Swagger UI; UI không nhất thiết cho chọn một chuyển trạng thái vốn bị workflow cấm. Dùng access token của tài khoản đã đăng nhập, thay các placeholder bằng ID thật. Đọc version hiện tại của task từ List/API trước khi gửi.

**Địa chỉ API:**

```text
PATCH http://localhost:8080/api/projects/<projectId>/tasks/<taskId>/status
```

**Headers:**

```text
Authorization: Bearer <access-token>
Content-Type: application/json
X-Correlation-ID: <UUID-mới-cho-request>
```

1. **Sai workflow:** với task đang `IN_PROGRESS`, gửi `DONE` và `expectedVersion` đúng version hiện tại. Kết quả mong đợi: HTTP `409`; response nêu version/trạng thái hiện tại; trạng thái task và lịch sử không đổi.
2. **Version cũ:** gửi một chuyển trạng thái hợp lệ nhưng đặt `expectedVersion` thấp hơn version hiện tại. Kết quả mong đợi: HTTP `409`; response có `currentVersion`; task không bị ghi đè và không có bản ghi đổi trạng thái mới.
3. **Status không hợp lệ:** gửi status `PENDING`. Kết quả mong đợi: HTTP `422`, chỉ rõ trường `status`; trạng thái task và lịch sử không đổi.
4. **Retry idempotent:** gửi lại nguyên request cập nhật thành công ban đầu, gồm cùng status, `expectedVersion` và `X-Correlation-ID`. Kết quả mong đợi: cùng kết quả đã xử lý; version không tăng thêm lần nữa và history không có bản trùng cho request đó.

Ví dụ body cho một request cập nhật:

```json
{
  "status": "IN_PROGRESS",
  "expectedVersion": 1
}
```

`expectedVersion` trong ví dụ chỉ để minh họa cấu trúc; hãy thay bằng version thực tế. Task mới có thể bắt đầu ở version `1`.

## 5. Luồng dự phòng: danh sách rỗng

**Ở đâu làm gì:** mở lại trang **Bảng công việc**, chọn Project demo rỗng (`Board Demo - Empty`) và Sprint của Project đó trong hai danh sách chọn, sau đó bấm **Mở Board**. Nếu danh sách có nhiều Project/Sprint tương tự, ID có trong log backend để đối chiếu.

**Dấu hiệu thành công:** thông tin Project/Sprint vẫn hiển thị; các cột không có card và số đếm bằng `0`; UI thông báo chưa có công việc. Không xuất hiện task của Project khác và không có thông báo lỗi tải.

## 6. Checklist kết thúc

- [ ] Board và List đối chiếu được cùng task và cùng dữ liệu chung.
- [ ] Tạo task (nếu demo bước này) chỉ tạo một task và xuất hiện trên Board/List.
- [ ] Chuyển trạng thái hợp lệ cập nhật cả List lẫn Board sau khi tải lại.
- [ ] Lịch sử hiển thị đúng trạng thái trước/sau, actor, thời điểm và correlation ID.
- [ ] Các request bị từ chối không làm thay đổi task hoặc tạo audit thành công.
- [ ] Tải lại/mở List không tạo thay đổi dữ liệu.

## 7. Lưu ý khi thuyết trình

- `APP_SEED_BOARD_ENABLED=true` chỉ bật dữ liệu demo local; không bật ở môi trường dùng chung hoặc production.
- Credential demo chỉ dùng cho local.
- Outbox event `fams.kanban.card_moved` được lưu trong ứng dụng; relay hiện ghi log và đánh dấu `PUBLISHED`. Chưa cấu hình broker/event bus bên ngoài, vì vậy không khẳng định sự kiện đã được gửi tới hệ thống messaging bên ngoài.
- Nếu API trả lỗi CORS khi frontend chạy cổng 5175 hoặc cổng khác, đặt `APP_FRONTEND_DOMAIN` bằng đúng origin frontend rồi khởi động lại backend.

Kịch bản test chi tiết hơn, gồm quyền truy cập và lỗi tải, nằm trong [UFR-PRJ-005-board-ui-test-scenarios.md](./UFR-PRJ-005-board-ui-test-scenarios.md).
