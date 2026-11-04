# TÀI LIỆU ĐẶC TẢ YÊU CẦU PHẦN MỀM (SRS)
### PHÂN HỆ: QUẢN LÝ THÔNG TIN VẬN HÀNH, ĐÁNH GIÁ CHUYÊN ĐỀ & NHẬT KÝ HOẠT ĐỘNG LỚP HỌC
**(BUDGET & OPERATION INFO & ACTIVITIES MANAGEMENT)**

**Dự án**: FAMS (Fresher Academy Management System) | **Nhóm thực hiện**: HCM26_CPL_JAVA_10 | **Giảng viên hướng dẫn**: Cô Nga

---

### BẢNG THÔNG TIN TÀI LIỆU

| Thuộc tính | Giá trị chi tiết |
| :--- | :--- |
| **Mã tài liệu** | `SRS-FAMS-OPERATION-ACTIVITIES-2026-v2.0` |
| **Tác giả phụ trách** | Nhóm sinh viên thực hiện (Phân hệ Budget & Operation Info / Activities) |
| **Nhóm sinh viên** | HCM26_CPL_JAVA_10 |
| **Giảng viên hướng dẫn** | Cô Nga |
| **Nhánh Git lưu trữ** | `origin/feature/training-management` |
| **Quy chuẩn giao diện** | Đồng bộ 100% chuẩn giao diện FAMS FPT Software (5 ảnh tham chiếu) |

---

## 1. TỔNG QUAN PHÂN HỆ (OVERVIEW)

Phân hệ **Quản lý Thông tin Vận hành & Nhật ký Hoạt động Lớp học** là cấu phần trung tâm của hệ thống đào tạo FAMS do nhóm **HCM26_CPL_JAVA_10** phụ trách. Phân hệ chịu trách nhiệm số hóa toàn bộ quá trình giám sát thực thi lớp đào tạo, cấu hình trọng số và đầu điểm đánh giá cho 14 chuyên đề học tập, tính toán tổng trọng số tích lũy (`Total Weighted Number: 35702`), phân kỳ đào tạo theo 5 mốc Milestone (tháng 2 đến tháng 6/2026), và ghi nhận tự động nhật ký hoạt động (Audit Timeline) cho mọi tác vụ điều chỉnh của người dùng theo đúng 100% chuẩn giao diện thực tế của FAMS FPT Software.

---

## 2. ĐẶC TẢ CHI TIẾT TAB BUDGET & OPERATION INFO (MỤC 2)

### 2.1. Xem và cập nhật thông tin vận hành (Operating Info)

| Trường | Mô tả đặc tả |
| :--- | :--- |
| **Mã User Story** | `US-BO-01` |
| **Tên chức năng** | Xem và cập nhật thông tin vận hành (Operating Info) |
| **As a** | Class Admin / Delivery Manager |
| **I want** | Xem ngày bắt đầu thực tế, ngày tốt nghiệp sớm, cập nhật ngày kết thúc thực tế và tra cứu công thức tính điểm GPA |
| **So that** | Theo dõi chính xác tiến độ vận hành lớp học và công khai tiêu chuẩn đánh giá xếp loại tốt nghiệp |
| **Tiêu chí AC** | **AC1.** Hiển thị trường `Actual Start Date` (23-Jan-2026) và `Early Graduated Date` (22-Jul-2026) ở chế độ chỉ đọc (Read-only).<br>**AC2.** Cho phép người dùng chỉnh sửa và cập nhật `Actual End Date` bằng bộ chọn ngày (Date Picker).<br>**AC3.** Mục `GPA Calculation` tích hợp biểu tượng icon `(i)`. Khi rê chuột (hover) hiển thị tooltip công thức tính GPA của FAMS.<br>**AC4.** Hiển thị minh bạch 4 tham số GPA chuẩn: `Topic Mark: 70`, `Discipline Point: 30`, `Bonus Point: 10`, `Penalty Point: 20`.<br>**AC5.** Khối Operating Info có nút thu gọn/mở rộng (Accordion collapsible) linh hoạt. |

> 📷 **[ CHÈN ẢNH CHỤP MÀN HÌNH TẠI ĐÂY: Hình 2.1 - Khối thông tin Operating Info và Tooltip GPA Calculation ]**

---

### 2.2. Bật/tắt nhu cầu phân bổ học viên (Has no allocation needs)

| Trường | Mô tả đặc tả |
| :--- | :--- |
| **Mã User Story** | `US-BO-02` |
| **Tên chức năng** | Bật/tắt nhu cầu phân bổ học viên (Has no allocation needs) |
| **As a** | Class Admin / Resource Allocation Coordinator |
| **I want** | Bật hoặc tắt công tắc Has no allocation needs cho lớp học |
| **So that** | Bộ phận điều phối nhân sự xác định lớp học này có yêu cầu phân bổ học viên vào dự án sản xuất hay không |
| **Tiêu chí AC** | **AC1.** Hiển thị nhãn `Has no allocation needs` kèm công tắc Switch dạng gạt bật/tắt trực quan.<br>**AC2.** Người dùng nhấp vào Switch hoặc nhãn chữ để chuyển đổi giữa hai trạng thái BẬT (True) và TẮT (False).<br>**AC3.** Trạng thái Switch được đồng bộ với thuộc tính `hasNoAllocationNeeds` và lưu xuống cơ sở dữ liệu khi bấm Save changes. |

> 📷 **[ CHÈN ẢNH CHỤP MÀN HÌNH TẠI ĐÂY: Hình 2.2 - Công tắc gạt trạng thái Has no allocation needs ]**

---

### 2.3. Xem và cấu hình đánh giá chuyên đề (Config Topic Assessment)

| Trường | Mô tả đặc tả |
| :--- | :--- |
| **Mã User Story** | `US-BO-03` |
| **Tên chức năng** | Xem và cấu hình đánh giá chuyên đề (Config Topic Assessment) |
| **As a** | Giảng viên đào tạo / Quản lý chuyên môn |
| **I want** | Mở bảng Modal cấu hình chuyên sâu các đầu điểm đánh giá cho 14 chuyên đề đào tạo |
| **So that** | Thiết lập chính xác tỷ trọng điểm, số lượng bài kiểm tra và ghi chú đánh giá cho từng môn học |
| **Tiêu chí AC** | **AC1.** Bấm nút `Config Topic Assessment` mở Modal kích thước lớn chuẩn FAMS (`max-w-6xl w-[94vw]`) với thanh tiêu đề màu tím.<br>**AC2.** Header modal có 2 chú thích màu sắc chuẩn: `Waiting for confirm` (Hồng nhạt) và `Changes confirmed` (Xanh lá nhạt).<br>**AC3.** Danh sách 14 chuyên đề tổ chức dạng Accordion, mặc định tự động mở chuyên đề số 6: `L1_AL_DF Database Fundamentals`.<br>**AC4.** Bảng đánh giá chi tiết từng môn gồm các cột: `Assessment Name`, `Weighted Number (%)`, `Quantity`, `Note`, `Action` dropdown (Keep, Update, Delete) và nút xóa.<br>**AC5.** Nút `(+) Thêm đầu điểm (Assessment)` cho phép bổ sung thêm đầu điểm mới cho chuyên đề.<br>**AC6.** Khi chỉnh sửa bất kỳ ô dữ liệu nào, dòng tương ứng tự động đổi sang màu hồng (Waiting for confirm). |

> 📷 **[ CHÈN ẢNH CHỤP MÀN HÌNH TẠI ĐÂY: Hình 2.3 - Modal Topic Assessment Configuration mở rộng với danh sách chuyên đề ]**

---

### 2.4. Xác nhận, từ chối và hủy thay đổi cấu hình đánh giá

| Trường | Mô tả đặc tả |
| :--- | :--- |
| **Mã User Story** | `US-BO-04` |
| **Tên chức năng** | Xác nhận, từ chối và hủy thay đổi cấu hình đánh giá (Assessment Workflow & Validation) |
| **As a** | Class Admin / Trưởng ban đào tạo |
| **I want** | Hệ thống kiểm soát tổng trọng số không quá 100%, cho phép Confirm, Reject hoặc Discard thay đổi |
| **So that** | Đảm bảo cấu hình tỷ trọng điểm không vượt quá 100% và kiểm soát chặt chẽ lịch sử duyệt thay đổi |
| **Tiêu chí AC** | **AC1 (Ràng buộc tổng 100%):** Tự động tính tổng trọng số từng môn `Total: {topicTotal}/100%`. Nếu vượt quá 100%, hiển thị badge đỏ và Alert cảnh báo chi tiết.<br>**AC2 (Chặn Confirm khi vi phạm):** Khi bấm `Confirm Assessments`, nếu có môn vượt quá 100%, hệ thống lập tức chặn lại, báo lỗi Toast và mở chuyên đề vi phạm.<br>**AC3 (Confirm thành công):** Nếu hợp lệ (tổng $\le$ 100%), bấm `Confirm Assessments` (nút tím) sẽ đổi các dòng sang màu xanh lá, lưu cấu hình và tự động ghi log vào tab Activities.<br>**AC4 (Reject):** Nút `Reject Assessments` (nút đỏ) từ chối toàn bộ thay đổi và ghi nhận log từ chối.<br>**AC5 (Discard):** Nút `Discard Changes` hoàn tác toàn bộ dữ liệu đang sửa về trạng thái ban đầu trước khi mở modal. |

> 📷 **[ CHÈN ẢNH CHỤP MÀN HÌNH TẠI ĐÂY: Hình 2.4 - Kiểm soát tổng trọng số tối đa 100% và các nút Discard, Reject, Confirm ]**

---

### 2.5. Xem và cập nhật Milestone Configuration

| Trường | Mô tả đặc tả |
| :--- | :--- |
| **Mã User Story** | `US-BO-05` |
| **Tên chức năng** | Xem và cập nhật Milestone Configuration & Tổng trọng số (Total Weighted Number) |
| **As a** | Class Admin / Delivery Manager |
| **I want** | Theo dõi tiến độ đào tạo theo 5 mốc tháng với tổng trọng số tích lũy động Total Weighted Number: 35702 |
| **So that** | Đánh giá khối lượng học tập và chuẩn bị quy trình chi trả lương/học bổng hàng tháng cho học viên |
| **Tiêu chí AC** | **AC1.** Hiển thị tổng trọng số toàn khóa: `Total Weighted Number: 35702`, tính tự động từ 14 chuyên đề thuộc 5 mốc tháng.<br>**AC2.** Hiển thị 5 mốc Milestone từ `Feb - 2026` đến `Jun - 2026` với badge `Baselined` (xanh lá), Checkpoint `STANDARD`, Salary Paid: `Yes`, `Start Date` và `End Date`.<br>**AC3.** Bảng con chi tiết từng môn trong mỗi mốc: `No.`, `Topic`, `Max Score` (10), `Passing Score` (6) và `Weighted Number` (DF: 868, Mock Project: 9840, ORM: 2400...).<br>**AC4.** Bố cục bảng tự nhiên (natural flow), cuộn mượt mà đồng bộ với thanh cuộn dọc `.fams-scrollbar` của thẻ chính mà không bị giật hay che khuất. |

> 📷 **[ CHÈN ẢNH CHỤP MÀN HÌNH TẠI ĐÂY: Hình 2.5 - Bảng cấu hình Milestone từ Feb-2026 đến Jun-2026 và Total Weighted Number ]**

---

### 2.6. Lưu thay đổi và quay lại danh sách lớp học

| Trường | Mô tả đặc tả |
| :--- | :--- |
| **Mã User Story** | `US-BO-06` |
| **Tên chức năng** | Lưu thay đổi và quay lại danh sách lớp học (Sticky Action Bar) |
| **As a** | Class Admin |
| **I want** | Thanh nút điều hướng đáy luôn ghim cố định để lưu thay đổi hoặc quay lại danh sách lớp |
| **So that** | Thuận tiện thao tác bất kỳ lúc nào dù đang cuộn ở đầu trang, giữa trang hay cuối bảng Milestone |
| **Tiêu chí AC** | **AC1.** Thanh tác vụ đáy ghim cố định ở đáy thẻ (`sticky bottom-0 z-20`) trên nền mờ sang trọng, luôn hiển thị trong tầm mắt.<br>**AC2.** Nút `Back to Class List` (bên trái) điều hướng an toàn người dùng trở về danh mục lớp `/classes`.<br>**AC3.** Nút `Save changes` (màu tím `#5944d3` bên phải) gửi API `PUT /api/external/classes/{id}/operation` để lưu toàn bộ thông tin vận hành.<br>**AC4.** Khi lưu thành công, hiển thị Toast xanh thông báo và tự động ghi log vào tab Activities: *"has updated class operating info and milestone configuration."* |

> 📷 **[ CHÈN ẢNH CHỤP MÀN HÌNH TẠI ĐÂY: Hình 2.6 - Thanh nút ghim cố định đáy Back to Class List và Save changes ]**

---

## 3. ĐẶC TẢ CHI TIẾT TAB ACTIVITIES (MỤC 3)

### 3.1. Xem nhật ký hoạt động của lớp học (Activity Timeline)

| Trường | Mô tả đặc tả |
| :--- | :--- |
| **Mã User Story** | `US-ACT-01` |
| **Tên chức năng** | Xem nhật ký hoạt động của lớp học (Activity Timeline) |
| **As a** | Class Admin / QA Auditor |
| **I want** | Xem dòng thời gian lịch sử thao tác của các thành viên trên lớp học theo thứ tự giảm dần |
| **So that** | Nắm bắt minh bạch ai đã cập nhật nội dung gì, vào thời gian nào phục vụ công tác kiểm toán chất lượng đào tạo |
| **Tiêu chí AC** | **AC1.** Tab `Activities` nằm cạnh tab `Budget & Operation Info` trên thanh tab điều hướng chính.<br>**AC2.** Dòng thời gian trực quan với trục dọc xám nối liền các sự kiện hoạt động.<br>**AC3.** Mỗi hoạt động hiển thị avatar tròn chứa chữ cái viết tắt của người thao tác (`UH`: UyenHTM, `NT`: NgaTTT45, `NN`: NhiNLY4...).<br>**AC4.** Thể hiện rõ tên tài khoản, nội dung mô tả hành động, và mốc thời gian chi tiết theo chuẩn `DD-MMM-YYYY HH:mm:ss`.<br>**AC5.** Badge phân loại rõ nét: Badge xám cho `HISTORY` (lịch sử hệ thống) và badge xanh cho `COMMENT` (trao đổi, thảo luận). |

> 📷 **[ CHÈN ẢNH CHỤP MÀN HÌNH TẠI ĐÂY: Hình 3.1 - Dòng thời gian Nhật ký hoạt động với avatar và badge phân loại ]**

---

### 3.2. Lọc nhật ký theo Comments/History & Đăng bình luận mới

| Trường | Mô tả đặc tả |
| :--- | :--- |
| **Mã User Story** | `US-ACT-02` |
| **Tên chức năng** | Lọc nhật ký theo Comments/History & Đăng bình luận mới |
| **As a** | Class Admin / Giảng viên lớp học |
| **I want** | Lọc xem riêng Comments hoặc History, đồng thời gửi bình luận trao đổi nội bộ về lớp |
| **So that** | Dễ dàng tra cứu thông tin theo nhu cầu và lưu lại các trao đổi nghiệp vụ trực tiếp trong hồ sơ lớp |
| **Tiêu chí AC** | **AC1.** Bộ lọc nhanh gồm 2 Checkbox: `Show: [x] Comments` và `[x] History`.<br>**AC2.** Khi thay đổi tùy chọn lọc, danh sách tự động lọc thời gian thực mà không cần tải lại trang.<br>**AC3.** Nếu bỏ chọn cả hai, hiển thị trạng thái rỗng: *"Không có hoạt động nào phù hợp với bộ lọc đã chọn."*<br>**AC4.** Khung `Thêm ghi chú / bình luận hoạt động` gồm Textarea nhập nội dung và nút `Gửi bình luận` (`#5944d3`).<br>**AC5.** Nhấn gửi sẽ gọi API `POST /api/external/classes/{id}/activities`, xóa trắng ô nhập và chèn bình luận mới lên đầu timeline. |

> 📷 **[ CHÈN ẢNH CHỤP MÀN HÌNH TẠI ĐÂY: Hình 3.2 - Bộ lọc Checkbox Comments/History và khung gửi bình luận mới ]**

---

### 3.3. Ghi nhận lý do khi thay đổi trạng thái lớp & Thao tác trọng yếu

| Trường | Mô tả đặc tả |
| :--- | :--- |
| **Mã User Story** | `US-ACT-03` |
| **Tên chức năng** | Ghi nhận lý do khi thay đổi trạng thái lớp & Thao tác trọng yếu (Reason Tracking) |
| **As a** | QA Auditor / Ban giám đốc đào tạo |
| **I want** | Hệ thống tự động ghi nhận lý do khi lớp học chuyển trạng thái hoặc hoàn tác tiến độ |
| **So that** | Ngăn chặn thao tác tùy tiện và có căn cứ giải trình rõ ràng trong quá trình vận hành lớp |
| **Tiêu chí AC** | **AC1.** Khi lớp chuyển trạng thái (ví dụ: Revert từ Hoàn thành về In Progress), hệ thống lưu log kèm lý do: *"UyenHTM has reverted to in progress the class with following reason: UPDATE MILESTONE."*<br>**AC2.** Khi người dùng bấm Confirm Assessments tại modal cấu hình, tự động ghi log: *"UyenHTM has confirmed topic assessment configuration."*<br>**AC3.** Khi người dùng bấm Reject Assessments, tự động ghi log: *"has rejected topic assessments changes."*<br>**AC4.** Khi người dùng bấm Save changes tại tab Budget & Operation, tự động ghi log: *"has updated class operating info and milestone configuration."*<br>**AC5.** Toàn bộ hoạt động được đồng bộ lưu trữ liên tục qua backend Spring Boot và Mock Server. |

> 📷 **[ CHÈN ẢNH CHỤP MÀN HÌNH TẠI ĐÂY: Hình 3.3 - Bản ghi nhật ký lưu lý do chuyển trạng thái lớp học (UPDATE MILESTONE) ]**

---

## 4. BẢNG TỔNG HỢP GIAO TIẾP DỮ LIỆU API (API SPECIFICATION)

| STT | Method | Endpoint API | Mô tả nghiệp vụ |
| :---: | :---: | :--- | :--- |
| **1** | `GET` | `/api/external/classes/{id}/operation` | Lấy OperatingInfo, switch allocation và 5 mốc Milestones. |
| **2** | `PUT` | `/api/external/classes/{id}/operation` | Cập nhật Actual End Date, Has no allocation needs và Milestones. |
| **3** | `GET` | `/api/external/classes/{id}/topic-assessments` | Lấy danh sách cấu hình đầu điểm của 14 chuyên đề đào tạo. |
| **4** | `PUT` | `/api/external/classes/{id}/topic-assessments` | Lưu và phê duyệt cấu hình đánh giá (`action`: confirm / reject). |
| **5** | `GET` | `/api/external/classes/{id}/activities` | Lấy danh sách nhật ký lịch sử và trao đổi bình luận của lớp. |
| **6** | `POST` | `/api/external/classes/{id}/activities` | Thêm một hoạt động mới hoặc đăng bình luận (`type`: history / comment). |

---

## 5. KẾT LUẬN & CAM KẾT CHẤT LƯỢNG MÃ NGUỒN

1. Toàn bộ các yêu cầu đặc tả cho **Phân hệ Budget & Operation Info (Mục 2: 2.1 đến 2.6)** và **Phân hệ Activities (Mục 3: 3.1 đến 3.3)** đã được nhóm **HCM26_CPL_JAVA_10** lập trình hoàn thiện, kiểm thử tự động đạt 100% (Build thành công 0 lỗi).
2. Giao diện người dùng tuân thủ tuyệt đối theo chuẩn FAMS thực tế, tích hợp cơ chế kiểm soát dữ liệu (Validation không quá 100%), thanh cuộn chuẩn FAMS (`.fams-scrollbar`) và thanh công cụ đáy cố định (`sticky bottom-0`).
3. Mã nguồn được lưu trữ tại nhánh `origin/feature/training-management`, sẵn sàng báo cáo và nghiệm thu với Giảng viên hướng dẫn.

