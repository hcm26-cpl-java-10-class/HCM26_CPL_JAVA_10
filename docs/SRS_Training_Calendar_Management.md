# TÀI LIỆU ĐẶC TẢ YÊU CẦU PHẦN MỀM (SRS)
## PHÂN HỆ: QUẢN LÝ LỊCH ĐÀO TẠO & THỜI KHÓA BIỂU (TRAINING CALENDAR & WEEKLY TIMETABLE MANAGEMENT)
**Sinh viên thực hiện: NGUYỄN NGỌC TÂN | Nhóm: HCM26_CPL_JAVA_10 | Giảng viên: Cô Nga**

| Thuộc tính | Giá trị chi tiết |
| :--- | :--- |
| **Mã tài liệu** | SRS-FAMS-CALENDAR-NT-2026-v2.0 |
| **Tác giả phụ trách** | Nguyễn Ngọc Tân (Phân hệ Lịch đào tạo & Thời khóa biểu / Training Calendar) |
| **Nhóm sinh viên** | HCM26_CPL_JAVA_10 |
| **Giảng viên hướng dẫn** | Cô Nga |
| **Hạn nộp (Deadline)** | 12:00 trưa, ngày 04/11/2026 |
| **Quy định trạng thái** | Chỉ gồm ACTIVE và INACTIVE (với Version) · SCHEDULED, COMPLETED, CANCELLED (với Session) |
| **Dữ liệu thực nghiệm** | Lớp đào tạo chuyên sâu thực tế LOCAL_JAVA_01, 6 môn học (Java Core, Spring Boot, React, SQL...), 26 ngày học, 51 buổi học... |

---

## 1. TỔNG QUAN PHÂN HỆ QUẢN LÝ LỊCH ĐÀO TẠO (Nguyễn Ngọc Tân)

Phân hệ Quản lý Lịch đào tạo & Thời khóa biểu (Training Calendar & Weekly Timetable Management) là cấu phần cốt lõi của hệ thống đào tạo FAMS do sinh viên **Nguyễn Ngọc Tân** phụ trách. Phân hệ chịu trách nhiệm chuyển hóa toàn bộ lộ trình môn học lý thuyết thành kế hoạch đào tạo thực tế chi tiết từng ngày cho từng lớp học, giải quyết toàn diện bài toán vận hành phức tạp của học viện công nghệ:

1. **Lập kế hoạch & Điều chỉnh lịch (Calendar Adjust)**: Đồng bộ danh mục môn học (`Subject`), tự động tính toán số buổi học dựa trên tổng thời lượng (`Duration`) và thời lượng ca học (`Session Hours`), tự động dàn lịch bỏ qua Thứ Bảy và Chủ Nhật.
2. **Quản lý phiên bản không phá hủy (Non-destructive Schedule Versioning)**: Lưu trữ lịch sử điều chỉnh thành các phiên bản độc lập (`v1.0`, `v1.1`,...), bắt buộc nhập ghi chú lý do thay đổi (*Change Note*) và quản lý trạng thái chuẩn hóa `ACTIVE` / `INACTIVE`.
3. **Phát hiện & Kiểm soát xung đột (Conflict Detection Engine)**: Tự động kiểm tra chéo ngày học không được trước ngày bắt đầu học thực tế (`Actual Learning Start Date`), ngăn chặn triệt để tình trạng trùng phòng Lab và trùng lịch giảng viên (Trainer).
4. **Thời khóa biểu tuần trực quan (Weekly Timetable Preview)**: Trực quan hóa toàn diện lịch học dạng lưới ma trận đa tầng theo tuần, phân ca sáng/chiều rõ ràng, hỗ trợ tìm kiếm từ khóa thời gian thực, bộ lọc theo lớp/trạng thái và xuất báo cáo dữ liệu.

---

## 3. CÁC CHỨC NĂNG CHI TIẾT (Nguyễn Ngọc Tân)

### 3.1. Chức năng Xem danh sách & Điều chỉnh Lịch đào tạo (Nguyễn Ngọc Tân)

| Trường | Mô tả đặc tả |
| :--- | :--- |
| **Mã User Story** | US-CAL-01 |
| **Tên chức năng** | Xem danh sách & Điều chỉnh Lịch đào tạo (Nguyễn Ngọc Tân) |
| **As a** | Class Admin / Training Operator |
| **I want** | Xem toàn bộ lộ trình môn học của lớp (LOCAL_JAVA_01), ngày khai giảng, ngày học thực tế, thanh thống kê thời lượng và các chủ đề đào tạo |
| **So that** | Nắm bắt tổng quan tiến độ đào tạo, điều phối phòng học, giảng viên và chuẩn bị phân bổ lịch chi tiết |
| **Tiêu chí AC** | **AC1.** Hiển thị thông tin lớp học `LOCAL_JAVA_01 - Lớp Chuyên sâu Java Backend (K26)`, ngày bắt đầu lớp `01/10/2026` và ngày học thực tế `01/10/2026`.<br>**AC2.** Thanh trạng thái Active Workspace với badge tổng hợp `6 môn học từ DB`, thanh thống kê tổng hợp `6 topics · 26 days · 51 activities · 204h 0m total`.<br>**AC3.** Các nút thao tác nghiệp vụ nổi bật: `Xem thời khóa biểu (Timetable)`, `Load All Topics`, `+ Add Topic`, `Check Conflicts`, `Save Schedule`.<br>**AC4.** Thẻ môn học hiển thị đầy đủ Slot time (Phòng Lab 201), Start Section, Trainers (Nguyễn Mạnh Hoàng / Nguyễn Ngọc Tân), Mentors và khoảng thời gian thực thi (01-Oct - 07-Oct). |

![Hình 1: Màn hình chính Điều chỉnh Lịch đào tạo - Nguyễn Ngọc Tân](D:/Desktop/Mock%20Project/Báo%20cáo/Screenshot%202026-11-03%20184806.png)
*Hình 1: Màn hình chính Điều chỉnh Lịch đào tạo - Nguyễn Ngọc Tân*

---

### 3.2. Chức năng Thêm mới Chủ đề đào tạo & Tự động chia buổi (Nguyễn Ngọc Tân)

| Trường | Mô tả đặc tả |
| :--- | :--- |
| **Mã User Story** | US-CAL-02 |
| **Tên chức năng** | Thêm mới Chủ đề & Cơ chế tự động chia buổi (Nguyễn Ngọc Tân) |
| **As a** | Class Admin / Academic Coordinator |
| **I want** | Thêm môn học mới vào lịch đào tạo với bộ đếm ký tự chuẩn hóa và cấu hình chia buổi tự động dựa trên thời lượng |
| **So that** | Nhanh chóng thiết lập lịch học cho môn mới mà không cần phải nhập thủ công từng ngày học và ca học |
| **Tiêu chí AC** | **AC1.** Modal nhập thông tin chuyên đề có bộ đếm ký tự thời gian thực: Mã chủ đề tối đa 30 ký tự (0/30), Tên chủ đề tối đa 100 ký tự (0/100).<br>**AC2.** Tùy chọn cấu hình chia ca học: Tổng thời lượng (Duration: 20h), Thời lượng 1 buổi học (2.5h / 150 phút), Giờ bắt đầu ca học (08:00 SA).<br>**AC3.** Checkbox quy tắc ngày làm việc: "Chỉ học Thứ 2 - Thứ 6 (Bỏ qua Thứ 7, Chủ nhật)".<br>**AC4.** Hệ thống tự động tính toán và hiển thị Card xem trước: "Tổng 20h chia 2.5h/buổi → Sinh ra 8 buổi học (08:00 - 10:30)". |

![Hình 2: Hộp thoại Thêm chủ đề đào tạo & Cơ chế tự động chia buổi - Nguyễn Ngọc Tân](D:/Desktop/Mock%20Project/Báo%20cáo/Screenshot%202026-11-03%20184850.png)
*Hình 2: Hộp thoại Thêm chủ đề đào tạo & Cơ chế tự động chia buổi - Nguyễn Ngọc Tân*

---

### 3.3. Chức năng Khởi tạo ban đầu khi chuyển đổi lớp (Empty State) (Nguyễn Ngọc Tân)

| Trường | Mô tả đặc tả |
| :--- | :--- |
| **Mã User Story** | US-CAL-03 |
| **Tên chức năng** | Khởi tạo ban đầu khi chuyển đổi lớp (Empty State) (Nguyễn Ngọc Tân) |
| **As a** | Training Operator / Class Admin |
| **I want** | Hệ thống tự động cập nhật ngày bắt đầu theo từng lớp khi chuyển đổi và hiển thị trạng thái hướng dẫn khởi tạo nếu lớp chưa có lịch |
| **So that** | Tránh nhầm lẫn dữ liệu giữa các lớp và dễ dàng bắt đầu lập lịch cho lớp học mới |
| **Tiêu chí AC** | **AC1.** Dropdown chọn lớp học hỗ trợ chuyển đổi nhanh (ví dụ sang `LOCAL_JAVA_02 - Lớp Lập trình Fullstack Java Web K26`).<br>**AC2.** Ngày bắt đầu học tự động đồng bộ theo ngày khai giảng của lớp học được chọn (15/11/2026).<br>**AC3.** Hiển thị Empty State thông minh khi lớp chưa có lịch: Icon lịch kèm thông báo "No topics scheduled yet".<br>**AC4.** Hướng dẫn trực quan: "Select Load All Topics to populate standard curriculum, or click Add Topic to create one." |

![Hình 3: Trạng thái khởi tạo ban đầu khi chuyển đổi lớp (Empty State) - Nguyễn Ngọc Tân](D:/Desktop/Mock%20Project/Báo%20cáo/Screenshot%202026-11-03%20184903.png)
*Hình 3: Trạng thái khởi tạo ban đầu khi chuyển đổi lớp (Empty State) - Nguyễn Ngọc Tân*

---

### 3.4. Chức năng Quản lý Ngày học & Hoạt động chi tiết (Day & Activities) (Nguyễn Ngọc Tân)

| Trường | Mô tả đặc tả |
| :--- | :--- |
| **Mã User Story** | US-CAL-04 |
| **Tên chức năng** | Quản lý Ngày học & Hoạt động chi tiết (Day & Activities) (Nguyễn Ngọc Tân) |
| **As a** | Class Admin / Giảng viên đào tạo |
| **I want** | Mở rộng chi tiết từng ngày học để phân bổ ca học, phòng Lab, giảng viên đứng lớp và nội dung đào tạo |
| **So that** | Kiểm soát lịch trình học tập ở mức độ chi tiết nhất (đến từng giờ học và hoạt động cụ thể) |
| **Tiêu chí AC** | **AC1.** Cấu trúc phân cấp 3 tầng: Môn học (Level 1) -> Ngày học (Level 2: Day) -> Buổi/Hoạt động (Level 3: Activities).<br>**AC2.** Hiển thị thông tin ngày: Day No (Day 3), Ngày cụ thể (05-Nov-2026), Thứ trong tuần (Thursday).<br>**AC3.** Bảng phân bổ hoạt động chi tiết gồm: Tên hoạt động/bài giảng, Ca học (Start/End time), Hình thức (Offline / Lab / Theory), Giảng viên phụ trách (Trainer PIC), Phòng học (Room).<br>**AC4.** Cho phép chỉnh sửa trực tiếp, thêm hoạt động mới (+) hoặc xóa hoạt động (Trash icon) với tính toán lại tổng thời lượng tức thì. |

![Hình 4: Chi tiết cấu trúc Ngày học & Hoạt động đào tạo (Day & Activities) - Nguyễn Ngọc Tân](D:/Desktop/Mock%20Project/Báo%20cáo/Screenshot%202026-11-03%20184935.png)
*Hình 4: Chi tiết cấu trúc Ngày học & Hoạt động đào tạo (Day & Activities) - Nguyễn Ngọc Tân*

---

### 3.5. Chức năng Lưu & Xác nhận Phiên bản Lịch đào tạo (Nguyễn Ngọc Tân)

| Trường | Mô tả đặc tả |
| :--- | :--- |
| **Mã User Story** | US-CAL-05 |
| **Tên chức năng** | Lưu & Xác nhận Phiên bản Lịch đào tạo (Nguyễn Ngọc Tân) |
| **As a** | Class Admin / Training Manager |
| **I want** | Bắt buộc nhập lý do / ghi chú thay đổi (Change note / reason) khi lưu lịch đào tạo |
| **So that** | Đảm bảo nguyên tắc quản lý phiên bản không phá hủy (Non-destructive Versioning) và lưu vết lịch sử kiểm toán (Audit Trail) |
| **Tiêu chí AC** | **AC1.** Khi nhấn nút "Save Schedule", hệ thống hiển thị Modal xác nhận "Save Training Calendar : LOCAL_JAVA_01".<br>**AC2.** Hộp thoại có trường bắt buộc hoặc gợi ý: "Change note / reason" (ví dụ: "Training calendar schedule").<br>**AC3.** Nút Cancel hủy bỏ thao tác an toàn và nút "Confirm & Save" để kích hoạt lưu phiên bản.<br>**AC4.** Chống thao tác đúp (Double-click protection) khi đang gửi dữ liệu lưu lên máy chủ. |

![Hình 5: Hộp thoại Lưu & Xác nhận phiên bản lịch đào tạo - Nguyễn Ngọc Tân](D:/Desktop/Mock%20Project/Báo%20cáo/Screenshot%202026-11-03%20184945.png)
*Hình 5: Hộp thoại Lưu & Xác nhận phiên bản lịch đào tạo - Nguyễn Ngọc Tân*

---

### 3.6. Chức năng Đồng bộ Dữ liệu Backend & Kiểm soát Xung đột (Nguyễn Ngọc Tân)

| Trường | Mô tả đặc tả |
| :--- | :--- |
| **Mã User Story** | US-CAL-06 |
| **Tên chức năng** | Đồng bộ Dữ liệu Backend & Kiểm soát Xung đột (Nguyễn Ngọc Tân) |
| **As a** | System Administrator / Class Admin |
| **I want** | Toàn bộ dữ liệu buổi học được kiểm tra không xung đột và lưu trữ thành công vào Database với thông báo xác nhận trực quan |
| **So that** | Dữ liệu lịch đào tạo đồng bộ tức thì, toàn vẹn và sẵn sàng hiển thị trên Thời khóa biểu |
| **Tiêu chí AC** | **AC1.** Tự động kích hoạt kiểm tra xung đột: Banner xanh thông báo "Validation Passed: Schedule Conflict-Free. Client schedule structure verified successfully."<br>**AC2.** Đồng bộ hàng loạt toàn bộ 51 buổi học xuống backend qua REST API (`POST /api/sessions/batch`).<br>**AC3.** Hiển thị Toast thông báo thành công màu xanh lá nổi bật: "Đã lưu thành công lịch đào tạo cho lớp LOCAL_JAVA_01 (51 buổi học)!".<br>**AC4.** Tự động cập nhật trạng thái phiên bản thành ACTIVE và sẵn sàng phục vụ tra cứu. |

![Hình 6: Đồng bộ dữ liệu xuống Backend & Thông báo Lưu thành công - Nguyễn Ngọc Tân](D:/Desktop/Mock%20Project/Báo%20cáo/Screenshot%202026-11-03%20184949.png)
*Hình 6: Đồng bộ dữ liệu xuống Backend & Thông báo Lưu thành công - Nguyễn Ngọc Tân*

---

### 3.7. Chức năng Xem Thời khóa biểu tuần trực quan (Weekly Timetable Preview) (Nguyễn Ngọc Tân)

| Trường | Mô tả đặc tả |
| :--- | :--- |
| **Mã User Story** | US-CAL-07 |
| **Tên chức năng** | Xem Thời khóa biểu tuần trực quan (Nguyễn Ngọc Tân) |
| **As a** | Học viên / Giảng viên / Class Admin |
| **I want** | Xem toàn bộ lịch học của lớp theo dạng ma trận lưới các ngày trong tuần với bộ lọc đa tiêu chí |
| **So that** | Dễ dàng theo dõi kế hoạch học tập, thời gian, phòng học và trạng thái từng buổi |
| **Tiêu chí AC** | **AC1.** Lưới thời khóa biểu 7 cột từ Thứ Hai đến Chủ Nhật với hiển thị ngày tháng cụ thể (Tuần 1: 28/09 - 04/10/2026).<br>**AC2.** Header ngày hiển thị tổng số buổi học trong ngày (Thứ Hai - Thứ Tư: 0 buổi; Thứ Năm: 2 buổi; Thứ Sáu: 2 buổi).<br>**AC3.** Thanh công cụ linh hoạt: Nút chuyển "Tuần trước", "Hôm nay", "Tuần sau"; Bộ chọn ngày; Chế độ xem "Xem Tuần", "Xem Tháng", "Danh sách buổi".<br>**AC4.** Bộ lọc đa tiêu chí: Ô tìm kiếm từ khóa (theo tiêu đề, phòng, giảng viên), Dropdown lọc theo Lớp học, Dropdown lọc theo Trạng thái (Tất cả trạng thái, Scheduled, Completed...). |

![Hình 7: Màn hình Thời khóa biểu tuần trực quan (Tuần 1) - Nguyễn Ngọc Tân](D:/Desktop/Mock%20Project/Báo%20cáo/Screenshot%202026-11-03%20184956.png)
*Hình 7: Màn hình Thời khóa biểu tuần trực quan (Tuần 1) - Nguyễn Ngọc Tân*

---

### 3.8. Chức năng Chi tiết các Thẻ Buổi học theo Ca sáng & Chiều (Nguyễn Ngọc Tân)

| Trường | Mô tả đặc tả |
| :--- | :--- |
| **Mã User Story** | US-CAL-08 |
| **Tên chức năng** | Chi tiết các Thẻ Buổi học theo Ca sáng & Chiều (Nguyễn Ngọc Tân) |
| **As a** | Học viên / Giảng viên |
| **I want** | Mỗi buổi học được biểu diễn trực quan bằng một thẻ (Card) riêng biệt với đầy đủ mã môn, thời gian, phòng Lab và trạng thái |
| **So that** | Học viên và giảng viên nắm bắt chính xác ca học, địa điểm và không bao giờ bị nhầm lẫn thời gian |
| **Tiêu chí AC** | **AC1.** Phân chia rõ rệt ca sáng và ca chiều trên từng cột ngày: Thứ Năm (01/10/2026) gồm Ca 1 (08:00 - 12:00, 4h) và Ca 2 (13:00 - 17:00, 4h).<br>**AC2.** Thẻ buổi học hiển thị: Mã môn và tên bài `[JAVA_CORE] Java Core & OOP Fundamentals`, Địa điểm `Phòng Lab 201`, Trạng thái `SCHEDULED` (Badge xanh dương).<br>**AC3.** Thứ Sáu (02/10/2026): Thể hiện buổi học tiếp theo với Ca 1 học lý thuyết và Ca 2 làm bài thực hành Assignment tại Phòng Lab 201.<br>**AC4.** Hỗ trợ nhấp vào thẻ buổi học để xem popup chi tiết (Detail Modal) với giảng viên, mentor và tài liệu đính kèm. |

![Hình 8: Chi tiết các thẻ Buổi học theo Ca sáng & Chiều - Nguyễn Ngọc Tân](D:/Desktop/Mock%20Project/Báo%20cáo/Screenshot%202026-11-03%20184958.png)
*Hình 8: Chi tiết các thẻ Buổi học theo Ca sáng & Chiều - Nguyễn Ngọc Tân*

---

### 3.9. Chức năng Lộ trình Chuyển tiếp Môn học & Quy tắc Ngày nghỉ (Nguyễn Ngọc Tân)

| Trường | Mô tả đặc tả |
| :--- | :--- |
| **Mã User Story** | US-CAL-09 |
| **Tên chức năng** | Lộ trình Chuyển tiếp Môn học & Quy tắc Ngày nghỉ (Nguyễn Ngọc Tân) |
| **As a** | Academic Coordinator / Giảng viên |
| **I want** | Thời khóa biểu tuần tiếp theo hiển thị chính xác sự nối tiếp giữa các môn học và tuân thủ quy tắc nghỉ cuối tuần |
| **So that** | Đảm bảo tiến độ chương trình đào tạo liên tục, hợp lý và không vi phạm chính sách ngày nghỉ của học viện |
| **Tiêu chí AC** | **AC1.** Điều hướng sang tuần tiếp theo (05/10 - 10/10/2026): Các ngày đầu tuần (05/10 - 07/10) hoàn tất các buổi học chuyên sâu của môn `[JAVA_CORE]`.<br>**AC2.** Ngày 08/10/2026: Tự động chuyển tiếp nhịp nhàng sang môn học kế tiếp `[SPRING_BOOT] Enterprise Backend Development`.<br>**AC3.** Tuân thủ nghiêm ngặt quy tắc nghỉ: Thứ Bảy (10/10/2026) và Chủ Nhật tự động không xếp lịch (hiển thị 0 buổi học).<br>**AC4.** Tính toàn vẹn của chuỗi lịch trình: Không có ngày học nào bị khuyết hoặc gián đoạn bất thường trong các ngày làm việc tiêu chuẩn. |

![Hình 9: Thời khóa biểu tuần kế tiếp và chuyển tiếp môn học - Nguyễn Ngọc Tân](D:/Desktop/Mock%20Project/Báo%20cáo/Screenshot%202026-11-03%20185005.png)
*Hình 9: Thời khóa biểu tuần kế tiếp và chuyển tiếp môn học - Nguyễn Ngọc Tân*

---

### 3.10. Chức năng Xuất dữ liệu Thời khóa biểu & Chuyển đổi Phân quyền (Nguyễn Ngọc Tân)

| Trường | Mô tả đặc tả |
| :--- | :--- |
| **Mã User Story** | US-CAL-10 |
| **Tên chức năng** | Xuất dữ liệu Lịch học & Chuyển đổi Phân quyền (Nguyễn Ngọc Tân) |
| **As a** | Admin / Trainer / Trainee |
| **I want** | Xuất file lịch học ra định dạng Excel/CSV và chuyển đổi chế độ xem cá nhân (Lịch của tôi / Tất cả lịch) |
| **So that** | Dễ dàng lưu trữ ngoại tuyến, in ấn thời khóa biểu và lọc lịch dạy riêng của từng giảng viên |
| **Tiêu chí AC** | **AC1.** Nút "Xuất Excel / CSV" tải xuống file thời khóa biểu định dạng chuẩn với đầy đủ mã môn, ngày học, ca học, phòng và giảng viên.<br>**AC2.** Bộ chuyển đổi góc nhìn: "Tất cả lịch" (xem toàn bộ lớp) và "Lịch của tôi" (chỉ xem các buổi học mà tài khoản đang đăng nhập là Trainer hoặc Trainee).<br>**AC3.** Chế độ phân quyền hiển thị (Admin View, Trainer View, Student View).<br>**AC4.** Hệ thống phản hồi nhanh dưới 1 giây, hỗ trợ đầy đủ tiếng Việt có dấu trong file xuất. |

---

## 4. KẾT LUẬN & CAM KẾT SỞ HỮU MÃ NGUỒN (Nguyễn Ngọc Tân)

Toàn bộ 10 chức năng nêu trên đã được sinh viên **Nguyễn Ngọc Tân** triển khai hoàn tất, kiểm thử toàn diện cả ở tầng giao diện người dùng (Frontend React + Tailwind CSS) lẫn tầng xử lý nghiệp vụ cơ sở dữ liệu (Backend Spring Boot REST API + JPA + MySQL). Dữ liệu được xác thực 100% trên lớp thực tế `LOCAL_JAVA_01` (6 môn học, 26 ngày học, 51 buổi học). Mã nguồn được lưu trữ tại nhánh git: `origin/feature/training-calendar` với các commit nhỏ gọn, chi tiết và không chứa bất kỳ file tài liệu thừa nào.
