# TÀI LIỆU ĐẶC TẢ YÊU CẦU PHẦN MỀM (SRS)
## PHÂN HỆ QUẢN LÝ LỚP HỌC (CLASS MANAGEMENT MODULE)
### HỆ THỐNG QUẢN LÝ ĐÀO TẠO FAMS (FPT ACADEMY MANAGEMENT SYSTEM)

---

**Thông tin chung về tài liệu:**
- **Tên dự án:** FPT Academy Management System (FAMS) - HCM26_CPL_JAVA_10
- **Phân hệ phụ trách:** Quản lý Lớp học (Class Management)
- **Tác giả / Sinh viên thực hiện:** **NINH HẢI DANH** (MSSV: **SE196647**)
- **Giảng viên hướng dẫn:** **Cô Trần Thị Tố Nga (Ngattt82)**
- **Phiên bản tài liệu:** Version 1.0 (Bản hoàn chỉnh tích hợp kiểm thử thực tế)
- **Ngày hoàn thành:** 23/11/2026

---

## MỤC LỤC CHI TIẾT

1. [Chương 1: Tổng quan phân hệ Quản lý Lớp học (Class Management Module)](#chương-1-tổng-quan-phân-hệ-quản-lý-lớp-học)
2. [Chương 2: Kiến trúc phân hệ & Ma trận phân quyền (RBAC)](#chương-2-kiến-trúc-phân-hệ--ma-trận-phân-quyền)
3. [Chương 3: Mô hình dữ liệu & Cấu trúc thực thể Backend (Database Schema)](#chương-3-mô-hình-dữ-liệu--cấu-trúc-thực-thể-backend)
4. [Chương 4: Danh mục Use Case tổng quan do Ninh Hải Danh phụ trách](#chương-4-danh-mục-use-case-tổng-quan)
5. [Chương 5: Đặc tả chi tiết 6 Use Cases chuẩn 10 mục theo quy định](#chương-5-đặc-tả-chi-tiết-6-use-cases-chuẩn-10-mục)
   - [5.1. UC-01: Xem và tra cứu danh sách lớp học (Class List & Filter)](#51-uc-01-xem-và-tra-cứu-danh-sách-lớp-học)
   - [5.2. UC-02: Xem chi tiết lớp học & Đánh giá mức độ sẵn sàng (Class Details & Readiness)](#52-uc-02-xem-chi-tiết-lớp-học--đánh-giá-mức-độ-sẵn-sàng)
   - [5.3. UC-03: Tạo mới và Cập nhật thông tin lớp học (Create & Edit Class Info)](#53-uc-03-tạo-mới-và-cập-nhật-thông-tin-lớp-học)
   - [5.4. UC-04: Thiết lập chương trình đào tạo & Phân công giảng viên (Class Setup & Teaching Assignment)](#54-uc-04-thiết-lập-chương-trình-đào-tạo--phân-công-giảng-viên)
   - [5.5. UC-05: Quản lý danh sách học viên trong lớp & Import Excel (Class Trainees & Excel Import)](#55-uc-05-quản-lý-danh-sách-học-viên-trong-lớp--import-excel)
   - [5.6. UC-06: Điều phối và tra cứu lịch học lớp theo tuần (Class Weekly Timetable)](#56-uc-06-điều-phối-và-tra-cứu-lịch-học-lớp-theo-tuần)
6. [Chương 6: Ma trận truy vết kiểm thử & Danh mục API Backend trên Swagger UI](#chương-6-ma-trận-truy-vết-kiểm-thử--danh-mục-api-backend)

---

# CHƯƠNG 1: TỔNG QUAN PHÂN HỆ QUẢN LÝ LỚP HỌC (CLASS MANAGEMENT)

### 1.1. Mục đích tài liệu
Tài liệu Đặc tả Yêu cầu Phần mềm (Software Requirements Specification - SRS) này được biên soạn bởi **Ninh Hải Danh (MSSV: SE196647)** nhằm định nghĩa chi tiết tất cả các yêu cầu chức năng (Functional Requirements), phi chức năng (Non-functional Requirements), kiến trúc dữ liệu và quy trình nghiệp vụ cho phân hệ **Quản lý Lớp học (Class Management)** trong hệ thống FAMS.

Tài liệu là cơ sở pháp lý và kỹ thuật phục vụ việc phát triển, kiểm thử, nghiệm thu đồ án chuyên ngành OJT (HCM26_CPL_JAVA_10) dưới sự hướng dẫn trực tiếp của **Cô Trần Thị Tố Nga**.

### 1.2. Phạm vi nghiệp vụ của Ninh Hải Danh
Phân hệ Lớp học giữ vai trò là "trái tim vận hành" kết nối mọi tài nguyên trong hệ thống đào tạo FAMS:
1. **Quản trị vòng đời lớp học:** Tạo mới lớp học, cập nhật thông tin vận hành, quản lý các trạng thái từ `Planning`, `Scheduled`, `In-Progress` đến `Completed`, `Cancelled`.
2. **Đánh giá mức độ sẵn sàng khai giảng (Class Readiness Assessment):** Tự động tính toán và kiểm tra 4 trụ cột điều kiện tiên quyết trước khi lớp có thể chính thức chuyển sang trạng thái sẵn sàng khai giảng:
   - Trụ cột 1: Chương trình đào tạo & Khung giáo trình (Program & Curriculum)
   - Trụ cột 2: Phân công giảng dạy (Teaching Assignment Coverage 100%)
   - Trụ cột 3: Sĩ số học viên (Trainee Capacity & Enrollment Target)
   - Trụ cột 4: Cơ sở vật chất & Phòng Lab (Classroom & Logistics Certification)
3. **Phân công giảng dạy (Teaching Assignment):** Ghép nối từng Topic trong chương trình đào tạo với các Giảng viên (Trainer / Master Trainer) đủ chứng chỉ và năng lực chuyên môn.
4. **Quản lý học viên & Nhập liệu Excel (Trainee Management):** Quản lý hồ sơ học viên theo lớp, xác thực dữ liệu và nhập hàng loạt từ tệp Excel chuẩn FAMS.
5. **Điều phối lịch học (Weekly Timetable & Schedule Coordination):** Tự động sinh lịch học theo slot, hỗ trợ xếp phòng, phát hiện xung đột lịch giảng viên và sinh viên.

### 1.3. Bốn cải tiến giao diện & nghiệp vụ bắt buộc đã hoàn thiện
Để đáp ứng nghiêm ngặt phản hồi đánh giá và chuẩn hóa trải nghiệm người dùng, phân hệ Class do Ninh Hải Danh phụ trách đã hiện thực hóa 4 cải tiến then chốt:
1. **Thanh điều hướng Sidebar chuẩn hóa:** Link "Class" trỏ trực tiếp đến route `/classes`, loại bỏ hoàn toàn submenu cấp con "Class List" rườm rà.
2. **Cấu trúc Tab Class Info:** Khối thông tin chung **General Information (lưới 3x6)** được ưu tiên đặt **Ở TRÊN** khối đánh giá **Class Readiness**, giúp cán bộ đào tạo nắm bắt ngay thông tin hành chính lớp học trước khi kiểm tra chỉ số readiness.
3. **Xác thực danh mục chọn lọc (Select Dropdown):** Cả hai trường `Class Admin` và `Master Trainer` trên modal thêm/sửa lớp học đều được chuyển đổi thành **Select Box** ràng buộc với danh mục tài khoản hợp lệ từ Backend API (`adminApi.getAll()`, `trainerApi`), ngăn chặn hoàn toàn lỗi nhập text tự do và bảo toàn giá trị khi sửa (Edit).
4. **Chuẩn hóa thuật ngữ nhãn:** Trường giảng viên chính được đổi nhãn thành **"Master Trainer"** đồng nhất với các tài liệu chuẩn quốc tế của hệ thống FAMS.

---

# CHƯƠNG 2: KIẾN TRÚC PHÂN HỆ & MA TRẬN PHÂN QUYỀN (RBAC)

### 2.1. Kiến trúc hệ thống 3 tầng (Three-Tier Architecture)
- **Frontend Layer:** React 18, Vite, TailwindCSS, Axios, Lucide Icons, React Router v6.
- **Backend Layer:** Java 17, Spring Boot 3.x, Spring Data JPA, Hibernate, Spring Security, Swagger / OpenAPI 3.0.
- **Database Layer:** PostgreSQL 15 quản lý toàn vẹn dữ liệu thông qua Foreign Keys, Unique Indexes, Audit Trail columns.

### 2.2. Ma trận phân quyền Role-Based Access Control (RBAC)

| Mã quyền (Permission Code) | Quyền hạn chi tiết | Super Admin | Training Admin | Class Admin | Master Trainer | Trainer |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: |
| `CLASS_READ` | Xem danh sách & tra cứu lớp học | ✓ | ✓ | ✓ | ✓ | ✓ |
| `CLASS_CREATE` | Tạo mới lớp học đào tạo | ✓ | ✓ | ✓ | ✗ | ✗ |
| `CLASS_UPDATE` | Cập nhật thông tin hành chính lớp | ✓ | ✓ | ✓ | ✗ | ✗ |
| `CLASS_DELETE` | Xóa/Hủy lớp học (ở trạng thái Planning) | ✓ | ✓ | ✗ | ✗ | ✗ |
| `CLASS_READINESS_EVAL` | Đánh giá & làm mới chỉ số Readiness | ✓ | ✓ | ✓ | ✓ | ✗ |
| `TEACHING_ASSIGN` | Phân công giảng viên cho từng Topic | ✓ | ✓ | ✓ | ✓ | ✗ |
| `TRAINEE_IMPORT` | Nhập danh sách học viên qua Excel | ✓ | ✓ | ✓ | ✗ | ✗ |
| `SCHEDULE_MANAGE` | Xếp lịch, sửa lịch, điều phối phòng học | ✓ | ✓ | ✓ | ✗ | ✗ |

---

# CHƯƠNG 3: MÔ HÌNH DỮ LIỆU & CẤU TRÚC THỰC THỂ BACKEND

### 3.1. Bảng `classes` (Thực thể Lớp học)
- `id` (BIGSERIAL, Primary Key): Khóa chính tự tăng.
- `code` (VARCHAR(50), Unique, Not Null): Mã lớp học chuẩn FAMS (ví dụ: `HCM26_CA_JAVA_01`).
- `name` (VARCHAR(255), Not Null): Tên hiển thị đầy đủ của lớp.
- `status` (VARCHAR(30), Not Null): Trạng thái lớp (`Planning`, `Scheduled`, `In-Progress`, `Completed`, `Cancelled`).
- `class_admin` (VARCHAR(150), Not Null): Email/Username của Class Admin quản lý lớp.
- `master_trainer_id` (BIGINT, Foreign Key): ID của Master Trainer phụ trách chuyên môn.
- `site` (VARCHAR(50), Not Null): Cơ sở đào tạo (`HCM`, `HN`, `DN`, `QNH`).
- `location` (VARCHAR(255)): Địa điểm chi tiết (ví dụ: `F-Town 3, Phòng Lab 204`).
- `planned_trainee_number` (INT, Default 0): Sĩ số mục tiêu dự kiến.
- `actual_trainee_number` (INT, Default 0): Sĩ số thực tế đã đăng ký/nhập.
- `start_date` (DATE): Ngày bắt đầu khóa học.
- `end_date` (DATE): Ngày kết thúc dự kiến.
- `training_program_id` (BIGINT, Foreign Key): Liên kết chương trình đào tạo.

### 3.2. Bảng `teaching_assignments` (Phân công giảng dạy)
- `id` (BIGSERIAL, Primary Key).
- `class_id` (BIGINT, Foreign Key -> `classes.id`).
- `topic_id` (BIGINT, Foreign Key -> `topics.id`): Topic do Lê Minh Hoàng xây dựng.
- `trainer_id` (BIGINT, Foreign Key -> `users.id`): Giảng viên được phân công.
- `role` (VARCHAR(30)): Vai trò giảng dạy (`MAIN_TRAINER`, `ASSISTANT_TRAINER`, `SUB_TRAINER`).
- `status` (VARCHAR(30)): Trạng thái phân công (`ASSIGNED`, `CONFIRMED`, `REPLACED`).

### 3.3. Bảng `class_trainees` (Quan hệ Học viên - Lớp học)
- `id` (BIGSERIAL, Primary Key).
- `class_id` (BIGINT, Foreign Key -> `classes.id`).
- `student_code` (VARCHAR(20), Not Null): MSSV học viên (ví dụ: `SE196647`).
- `full_name` (VARCHAR(150), Not Null): Họ và tên học viên.
- `email` (VARCHAR(150), Not Null): Email sinh viên.
- `status` (VARCHAR(30)): Trạng thái học viên (`Enrolled`, `In-Training`, `Dropped-out`, `Passed`).

---

# CHƯƠNG 4: DANH MỤC USE CASE TỔNG QUAN DO NINH HẢI DANH PHỤ TRÁCH

| Mã Use Case | Tên Use Case | Tác nhân chính | Trạng thái triển khai | Tác giả phụ trách |
| :--- | :--- | :--- | :--- | :--- |
| **UC-01** | Xem và tra cứu danh sách lớp học (Class List & Filter) | Training Admin, Class Admin, Trainer | Đã hoàn thiện 100% | **Ninh Hải Danh** |
| **UC-02** | Xem chi tiết thông tin lớp học & Đánh giá mức độ sẵn sàng (Class Details & Readiness) | Training Admin, Class Admin, Master Trainer | Đã hoàn thiện 100% | **Ninh Hải Danh** |
| **UC-03** | Tạo mới và Cập nhật thông tin lớp học (Create & Edit Class Info) | Training Admin, Class Admin | Đã hoàn thiện 100% | **Ninh Hải Danh** |
| **UC-04** | Thiết lập chương trình đào tạo & Phân công giảng viên (Class Setup & Teaching Assignment) | Training Admin, Master Trainer | Đã hoàn thiện 100% | **Ninh Hải Danh** |
| **UC-05** | Quản lý danh sách học viên trong lớp & Import Excel (Class Trainee Management) | Class Admin, Training Admin | Đã hoàn thiện 100% | **Ninh Hải Danh** |
| **UC-06** | Điều phối và tra cứu lịch học lớp theo tuần (Class Weekly Timetable) | Class Admin, Master Trainer, Trainer | Đã hoàn thiện 100% | **Ninh Hải Danh** |

---

# CHƯƠNG 5: ĐẶC TẢ CHI TIẾT 6 USE CASES CHUẨN 10 MỤC

```
YÊU CẦU CÔ NGA: Mỗi Use Case được đặc tả đầy đủ 10 mục con chi tiết:
1. Tên Use Case & Mã định danh
2. Tác nhân (Actors)
3. Mục tiêu & Mô tả tóm tắt
4. Tiền điều kiện (Preconditions)
5. Hậu điều kiện (Postconditions)
6. Luồng sự kiện chính (Main Flow / Happy Path)
7. Các luồng phụ & luồng ngoại lệ (Alternative & Exception Flows)
8. Quy tắc nghiệp vụ (Business Rules)
9. Thiết kế giao diện & Kết quả thực thi API trên Swagger UI (Hình ảnh thực tế)
10. Yêu cầu phi chức năng & Bảo mật
```

---

## 5.1. UC-01: Xem và tra cứu danh sách lớp học (Class List & Filter)

### 1. Mã Use Case & Tên Use Case
- **Mã định danh:** `UC-01`
- **Tên Use Case:** Xem và tra cứu danh sách lớp học (Class List & Filter)
- **Phân hệ:** Class Management (Quản lý Lớp học)
- **Sinh viên phụ trách:** Ninh Hải Danh (MSSV: SE196647)

### 2. Tác nhân (Actors)
- **Tác nhân chính:** Training Admin, Class Admin.
- **Tác nhân phụ:** Master Trainer, Trainer, System Service.

### 3. Mục tiêu & Mô tả tóm tắt
- Cung cấp giao diện trung tâm hiển thị toàn bộ các lớp học đào tạo đang có trong hệ thống FAMS.
- Hỗ trợ tìm kiếm theo mã lớp, tên lớp, phân loại theo trạng thái vận hành (`Planning`, `Scheduled`, `In-Progress`, `Completed`), và điều hướng nhanh đến chi tiết từng lớp học.

### 4. Tiền điều kiện (Preconditions)
- Người dùng đã đăng nhập thành công vào hệ thống FAMS với tài khoản có quyền `CLASS_READ`.
- Cơ sở dữ liệu lớp học đã được khởi tạo và kết nối ổn định.

### 5. Hậu điều kiện (Postconditions)
- Danh sách lớp học hiển thị đúng theo các tham số phân trang, tìm kiếm và bộ lọc đã chọn.
- Người dùng có thể click vào bất kỳ lớp học nào để xem chi tiết hoặc thực hiện các thao tác quản trị tiếp theo.

### 6. Luồng sự kiện chính (Main Flow)
1. **Bước 1 (User):** Người dùng nhấp chuột vào mục **"Class"** trực tiếp trên thanh menu Sidebar bên trái.
2. **Bước 2 (Frontend):** Hệ thống chuyển route đến `/classes`, hiển thị thanh tìm kiếm, bộ lọc trạng thái và bảng dữ liệu lớp học. Đồng thời gửi yêu cầu `GET /api/v1/classes?page=0&size=10` kèm JWT Token.
3. **Bước 3 (Backend):** Controller `TrainingClassController` nhận request, gọi service `TrainingClassService.getAllClasses(pageable, filter)`.
4. **Bước 4 (Database):** Hệ thống thực thi câu lệnh SQL phân trang và trả về danh sách thực thể `classes`.
5. **Bước 5 (Frontend):** Bảng dữ liệu hiển thị các cột: Mã lớp (Class Code), Tên lớp (Class Name), Class Admin, Master Trainer, Trạng thái (Status Badge) và Nút thao tác (Action Details).

### 7. Các luồng phụ & luồng ngoại lệ (Alternative & Exception Flows)
- **7.1. Tìm kiếm và lọc theo trạng thái:** Khi người dùng nhập từ khóa tìm kiếm (ví dụ: `HCM26`) hoặc chọn trạng thái `Planning`, Frontend tự động reset `page = 0` và gọi API với các tham số tương ứng.
- **7.2. Lớp học trống (Empty State):** Nếu không có lớp học nào thỏa mãn điều kiện, hệ thống hiển thị thông báo "Không tìm thấy lớp học nào phù hợp với bộ lọc".
- **7.3. Lỗi xác thực phiên làm việc:** Nếu JWT Token hết hạn, hệ thống trả về mã lỗi `401 Unauthorized` và điều hướng người dùng về trang Đăng nhập.

### 8. Quy tắc nghiệp vụ (Business Rules)
- **BR-01 (Cải tiến Sidebar):** Thanh Sidebar chỉ hiển thị duy nhất mục "Class" dẫn thẳng đến `/classes`. Không được chứa submenu con "Class List" gây thừa thao tác.
- **BR-02 (Phân quyền dữ liệu):** Class Admin chỉ được xem các lớp do mình quản lý hoặc các lớp chung trong cơ sở (Site). Super Admin và Training Admin được xem toàn bộ các lớp trên toàn quốc.
- **BR-03 (Phân trang mặc định):** Mỗi trang hiển thị chuẩn 10 bản ghi, sắp xếp theo thời gian tạo mới nhất (`createdAt DESC`).

### 9. Thiết kế giao diện & Kết quả thực thi API trên Swagger UI
- **Hình ảnh Giao diện Frontend:** Giao diện Quản lý Lớp học hiển thị danh sách lớp, thanh tìm kiếm, bộ lọc trạng thái và liên kết trực tiếp trên Sidebar.
- **Hình ảnh Swagger UI:** Kết quả thực thi API `GET /api/v1/classes?page=0&size=10&status=Planning` trả về mã phản hồi `200 OK`, Curl command, Request URL và dữ liệu JSON danh sách lớp học.

### 10. Yêu cầu phi chức năng & Bảo mật
- **Thời gian phản hồi:** Thời gian tải danh sách lớp học không vượt quá 800ms cho 10 bản ghi kèm phân trang.
- **Bảo mật:** Bắt buộc gắn Bearer JWT Token trên HTTP Header `Authorization`.

---

## 5.2. UC-02: Xem chi tiết thông tin lớp học & Đánh giá mức độ sẵn sàng (Class Details & Readiness)

### 1. Mã Use Case & Tên Use Case
- **Mã định danh:** `UC-02`
- **Tên Use Case:** Xem chi tiết thông tin lớp học & Đánh giá mức độ sẵn sàng (Class Details & Class Readiness Assessment)
- **Phân hệ:** Class Management (Quản lý Lớp học)
- **Sinh viên phụ trách:** Ninh Hải Danh (MSSV: SE196647)

### 2. Tác nhân (Actors)
- **Tác nhân chính:** Training Admin, Class Admin.
- **Tác nhân phụ:** Master Trainer, Giảng viên chuyên trách.

### 3. Mục tiêu & Mô tả tóm tắt
- Cung cấp chế độ xem chi tiết toàn diện của một lớp học qua 5 tab chuẩn FAMS: `Class Info`, `Trainee List`, `Calendar`, `Budget & Operation`, `Activities`.
- Tự động đánh giá và hiển thị trực quan mức độ sẵn sàng khai giảng thông qua 4 trụ cột nghiệp vụ: Curriculum, Teaching Assignment, Trainee Capacity, Logistics.

### 4. Tiền điều kiện (Preconditions)
- Lớp học đã tồn tại trong hệ thống.
- Người dùng có quyền truy cập vào mã lớp học cụ thể (`CLASS_READ` và `CLASS_READINESS_EVAL`).

### 5. Hậu điều kiện (Postconditions)
- Toàn bộ thông tin hành chính của lớp học hiển thị đầy đủ trên lưới 3x6 (Section General).
- Thẻ đánh giá 4 trụ cột Class Readiness phản ánh chính xác trạng thái thực tế của lớp học.

### 6. Luồng sự kiện chính (Main Flow)
1. **Bước 1 (User):** Người dùng nhấp vào tên lớp học hoặc nút "Details" trên bảng danh sách lớp học.
2. **Bước 2 (Frontend):** Chuyển hướng đến URL `/classes/:classId`. Mặc định chọn tab **"Class Info"**.
3. **Bước 3 (Backend):** Frontend đồng thời gọi 2 API: `GET /api/v1/classes/{classId}` (lấy thông tin chi tiết lớp) và `GET /api/v1/classes/{classId}/readiness` (lấy ma trận đánh giá 4 trụ cột).
4. **Bước 4 (Frontend Render):**
   - **Khối 1 (Ở TRÊN):** Hiển thị khối **"1. General Information"** dạng lưới 3x6 gồm: Class Admin, Master Trainer, Site, Sĩ số kế hoạch, Ngày bắt đầu, Ngày kết thúc, Chương trình đào tạo, Trạng thái.
   - **Khối 2 (Ở DƯỚI):** Hiển thị khối **"2. Class Readiness Status"** với 4 thẻ đánh giá trụ cột có màu sắc cảnh báo (`READY`, `NOT READY`, `BLOCKED`).

### 7. Các luồng phụ & luồng ngoại lệ (Alternative & Exception Flows)
- **7.1. Làm mới trạng thái Readiness:** Người dùng nhấn nút "Refresh Readiness", Frontend gọi lại API đánh giá để cập nhật ngay lập tức nếu vừa có giảng viên hoặc học viên mới được bổ sung.
- **7.2. Lớp học không tồn tại:** Nếu nhập `classId` không hợp lệ, Backend trả về `404 Not Found`, Frontend hiển thị thông báo "Không tìm thấy lớp học yêu cầu".

### 8. Quy tắc nghiệp vụ (Business Rules)
- **BR-04 (Cải tiến thứ tự hiển thị Tab Class Info):** Section **General Information** BẮT BUỘC phải nằm **Ở TRÊN** Section **Class Readiness Status**. Điều này đảm bảo cán bộ đào tạo xem thông tin cơ bản trước khi xem xét điều kiện khai giảng.
- **BR-05 (4 Trụ cột Class Readiness):**
  - Trụ cột 1 (Program & Curriculum): Đạt `READY` khi lớp đã được gán Chương trình đào tạo còn hiệu lực và có đầy đủ syllabus các môn.
  - Trụ cột 2 (Teaching Assignment): Đạt `READY` khi 100% các Topic trong chương trình đã có Main Trainer được phân công hợp lệ. Nếu thiếu dù chỉ 1 Topic -> Trạng thái là `NOT READY`.
  - Trụ cột 3 (Trainee Capacity): Đạt `READY` khi số lượng học viên đã ghi danh đạt từ 80% trở lên so với sĩ số kế hoạch (`actual >= planned * 0.8`).
  - Trụ cột 4 (Classroom & Logistics): Đạt `READY` khi phòng học và đường truyền mạng đã được xác nhận.

### 9. Thiết kế giao diện & Kết quả thực thi API trên Swagger UI
- **Hình ảnh Giao diện Frontend:** Trang chi tiết lớp học hiển thị 5 tab FAMS, khối General (lưới 3x6) ở phía trên và 4 thẻ Readiness ở phía dưới.
- **Hình ảnh Swagger UI:** Kết quả thực thi API `GET /api/v1/classes/1/readiness` trả về `200 OK`, hiển thị chi tiết trạng thái của 4 trụ cột điều kiện khai giảng.

### 10. Yêu cầu phi chức năng & Bảo mật
- Thuật toán tính toán Readiness phải chạy tối ưu, hoàn thành trong vòng dưới 200ms bằng cách sử dụng batch query trên cơ sở dữ liệu.

---

## 5.3. UC-03: Tạo mới và Cập nhật thông tin lớp học (Create & Edit Class Info)

### 1. Mã Use Case & Tên Use Case
- **Mã định danh:** `UC-03`
- **Tên Use Case:** Tạo mới và Cập nhật thông tin lớp học (Create & Edit Class Info)
- **Phân hệ:** Class Management (Quản lý Lớp học)
- **Sinh viên phụ trách:** Ninh Hải Danh (MSSV: SE196647)

### 2. Tác nhân (Actors)
- **Tác nhân chính:** Training Admin, Class Admin.
- **Tác nhân phụ:** Hệ thống FAMS, Directory Service.

### 3. Mục tiêu & Mô tả tóm tắt
- Cho phép người quản trị tạo mới một lớp đào tạo hoặc cập nhật thông tin lớp đang ở trạng thái `Planning`.
- Đảm bảo tính toàn vẹn dữ liệu bằng cách buộc người dùng chọn Class Admin và Master Trainer từ danh mục đã được xác minh.

### 4. Tiền điều kiện (Preconditions)
- Người dùng có quyền `CLASS_CREATE` (khi tạo mới) hoặc `CLASS_UPDATE` (khi chỉnh sửa).
- Danh mục tài khoản Admin và Trainer trong hệ thống đã có dữ liệu khả dụng.

### 5. Hậu điều kiện (Postconditions)
- Bản ghi lớp học mới được lưu thành công vào cơ sở dữ liệu với trạng thái mặc định là `Planning`.
- Mã lớp học duy nhất trên toàn hệ thống.

### 6. Luồng sự kiện chính (Main Flow)
1. **Bước 1 (User):** Người dùng nhấn nút **"+ Add Class"** trên danh sách lớp, hoặc nhấn nút **"Edit Class Info"** trong trang chi tiết lớp học.
2. **Bước 2 (Frontend):** Mở cửa sổ `ClassModal`. Frontend tự động tải danh sách Class Admin từ `adminApi.getAll()` và danh sách Trainer từ `trainerApi.getAll()`.
3. **Bước 3 (User Input):**
   - Nhập Mã lớp (`Class Code`), Tên lớp (`Class Name`), Địa điểm (`Location`), Sĩ số kế hoạch (`Planned Trainees`), Ngày khai giảng và Ngày kết thúc.
   - Chọn **Class Admin** từ hộp chọn Select Box.
   - Chọn **Master Trainer** từ hộp chọn Select Box (nhãn hiển thị chuẩn: "Master Trainer").
4. **Bước 4 (User Submit):** Người dùng nhấn nút **"Save Class"**.
5. **Bước 5 (Backend):** Frontend gửi `POST /api/v1/classes` (nếu tạo mới) hoặc `PUT /api/v1/classes/{classId}` (nếu chỉnh sửa). Backend validate ràng buộc dữ liệu, lưu vào database và trả về mã phản hồi `201 Created` hoặc `200 OK`.
6. **Bước 6 (Frontend Notification):** Đóng modal, hiển thị thông báo thành công "Tạo mới / Cập nhật lớp học thành công!" và tải lại danh sách lớp học.

### 7. Các luồng phụ & luồng ngoại lệ (Alternative & Exception Flows)
- **7.1. Trùng mã lớp học (Duplicate Class Code):** Nếu mã lớp đã tồn tại, Backend trả về `409 Conflict`, hệ thống báo lỗi "Mã lớp học đã tồn tại, vui lòng nhập mã khác".
- **7.2. Chưa điền trường bắt buộc:** Nếu bỏ trống các trường có dấu sao đỏ (`*`), nút "Save Class" bị vô hiệu hóa hoặc form hiển thị cảnh báo đỏ trực tiếp tại ô nhập liệu.

### 8. Quy tắc nghiệp vụ (Business Rules)
- **BR-06 (Select Box bắt buộc cho Admin & Trainer):** Nghiêm cấm hoàn toàn việc cho phép người dùng nhập tự do (Free Text) tên hoặc email của Class Admin và Master Trainer. Bắt buộc phải chọn từ danh mục dropdown được cấp từ API backend để tránh lỗi sai định danh.
- **BR-07 (Chuẩn hóa nhãn Master Trainer):** Nhãn hiển thị trên form BẮT BUỘC là **"Master Trainer"**, không sử dụng nhãn kép "Giáo viên chính (Master Trainer)" để tránh rườm rà.
- **BR-08 (Bảo toàn dữ liệu khi Edit):** Khi người dùng mở modal chỉnh sửa (Edit Class), hệ thống phải tự động bind chính xác ID của Class Admin và Master Trainer hiện tại vào ô Select. Nếu tài khoản không còn hiệu lực, hiển thị cảnh báo `[UNVERIFIED - BLOCKED]`.

### 9. Thiết kế giao diện & Kết quả thực thi API trên Swagger UI
- **Hình ảnh Giao diện Frontend:** Form `ClassModal` hiển thị hộp chọn Select Class Admin, Select Master Trainer và nhãn chuẩn Master Trainer.
- **Hình ảnh Swagger UI:** Kết quả thực thi API `POST /api/v1/classes` với Request Body đầy đủ, mã phản hồi `201 Created`, Response Body chứa ID lớp mới tạo và Response Headers.

### 10. Yêu cầu phi chức năng & Bảo mật
- Tất cả các thao tác thay đổi dữ liệu phải được lưu vết trong bảng Audit Log (`created_by`, `created_at`, `updated_by`, `updated_at`).

---

## 5.4. UC-04: Thiết lập chương trình đào tạo & Phân công giảng viên (Class Setup & Teaching Assignment)

### 1. Mã Use Case & Tên Use Case
- **Mã định danh:** `UC-04`
- **Tên Use Case:** Thiết lập chương trình đào tạo & Phân công giảng viên (Class Setup & Teaching Assignment)
- **Phân hệ:** Class Management (Quản lý Lớp học)
- **Sinh viên phụ trách:** Ninh Hải Danh (MSSV: SE196647)

### 2. Tác nhân (Actors)
- **Tác nhân chính:** Training Admin, Master Trainer.
- **Tác nhân phụ:** Giảng viên bộ môn (Trainer).

### 3. Mục tiêu & Mô tả tóm tắt
- Ghép nối một Chương trình đào tạo (Training Program do phân hệ Topic/Syllabus quản lý) vào Lớp học.
- Phân công giảng viên chuyên trách cho từng Topic cụ thể trong chương trình để chuẩn bị điều kiện giảng dạy.

### 4. Tiền điều kiện (Preconditions)
- Lớp học đang ở trạng thái `Planning`.
- Chương trình đào tạo đã được duyệt (`Active`) và chứa ít nhất một Topic hợp lệ.

### 5. Hậu điều kiện (Postconditions)
- Bảng phân công giảng dạy (`teaching_assignments`) được tạo mới hoặc cập nhật.
- Chỉ số Trụ cột 2 (Teaching Assignment Readiness) tự động cập nhật lại tỷ lệ hoàn thành.

### 6. Luồng sự kiện chính (Main Flow)
1. **Bước 1 (User):** Trong chi tiết lớp học, chọn tab **"Class Setup"** hoặc nhấn nút "Open Class Setup" trên thẻ Readiness.
2. **Bước 2 (Frontend):** Hiển thị Ma trận phân công giảng dạy (Teaching Assignment Matrix) liệt kê toàn bộ các Topic thuộc chương trình đào tạo của lớp.
3. **Bước 3 (User Action):** Với các Topic đang ở trạng thái `UNASSIGNED`, người dùng nhấn nút "+ Assign", chọn giảng viên phù hợp từ danh sách và chọn vai trò (`Main Trainer` hoặc `Assistant Trainer`).
4. **Bước 4 (Frontend Request):** Gửi yêu cầu `POST /api/v1/classes/{classId}/teaching-assignments` với dữ liệu JSON gồm `topicId`, `trainerId`, `role`.
5. **Bước 5 (Backend Response):** Backend kiểm tra trùng lặp, lưu bản ghi phân công vào database và trả về `200 OK`.
6. **Bước 6 (Frontend Update):** Dòng Topic tương ứng chuyển trạng thái thành `ASSIGNED` kèm tên giảng viên và nút đổi giảng viên.

### 7. Các luồng phụ & luồng ngoại lệ (Alternative & Exception Flows)
- **7.1. Trùng lịch giảng viên:** Nếu giảng viên được chọn đã có lịch dạy ở một lớp học khác trong cùng khung thời gian, hệ thống cảnh báo "Giảng viên bị xung đột lịch giảng dạy tại lớp HCM26_FR_DOTNET_01".
- **7.2. Thay đổi giảng viên (Re-assign):** Người dùng có thể nhấn nút "Change" để chọn giảng viên thay thế cho Topic đã được gán trước đó.

### 8. Quy tắc nghiệp vụ (Business Rules)
- **BR-09:** Mỗi Topic trong một lớp học bắt buộc phải có đúng một Giảng viên chính (`MAIN_TRAINER`). Có thể có thêm tối đa 2 trợ giảng (`ASSISTANT_TRAINER`).
- **BR-10:** Chỉ những giảng viên có trạng thái `ACTIVE` trong danh bạ User và có chuyên môn phù hợp mới được hiển thị trong danh sách phân công.

### 9. Thiết kế giao diện & Kết quả thực thi API trên Swagger UI
- **Hình ảnh Giao diện Frontend:** Ma trận phân công giảng dạy hiển thị danh sách Topic, Giảng viên phụ trách, Vai trò và Trạng thái phân công.
- **Hình ảnh Swagger UI:** Kết quả thực thi API `POST /api/v1/classes/1/teaching-assignments` trả về mã `200 OK` và chi tiết bản ghi phân công thành công.

### 10. Yêu cầu phi chức năng & Bảo mật
- Đảm bảo tính toàn vẹn Transactional giữa việc cập nhật bảng phân công và việc tái tính toán chỉ số Readiness.

---

## 5.5. UC-05: Quản lý danh sách học viên trong lớp & Import Excel (Class Trainee Management)

### 1. Mã Use Case & Tên Use Case
- **Mã định danh:** `UC-05`
- **Tên Use Case:** Quản lý danh sách học viên trong lớp & Import Excel (Class Trainee Management & Excel Import)
- **Phân hệ:** Class Management (Quản lý Lớp học)
- **Sinh viên phụ trách:** Ninh Hải Danh (MSSV: SE196647)

### 2. Tác nhân (Actors)
- **Tác nhân chính:** Class Admin, Training Admin.
- **Tác nhân phụ:** Học viên (Trainee).

### 3. Mục tiêu & Mô tả tóm tắt
- Quản lý danh sách học viên ghi danh vào lớp học, hỗ trợ xem thông tin, trạng thái học tập của từng học viên.
- Cho phép Class Admin nhập nhanh toàn bộ danh sách học viên từ file bảng tính Excel theo biểu mẫu chuẩn của FAMS.

### 4. Tiền điều kiện (Preconditions)
- Lớp học đã được tạo trong hệ thống.
- Người dùng có tệp Excel danh sách học viên chuẩn định dạng (.xlsx).

### 5. Hậu điều kiện (Postconditions)
- Danh sách học viên được nhập vào bảng `class_trainees`.
- Sĩ số thực tế của lớp (`actual_trainee_number`) và chỉ số Trụ cột 3 (Trainee Capacity Readiness) được cập nhật lại.

### 6. Luồng sự kiện chính (Main Flow)
1. **Bước 1 (User):** Người dùng mở chi tiết lớp học, nhấp vào tab **"Trainee List"**.
2. **Bước 2 (Frontend):** Hiển thị danh sách học viên hiện tại và các nút chức năng: "Export Excel", "Import Excel".
3. **Bước 3 (User Action):** Người dùng nhấn nút **"📥 Import Excel"**, chọn tệp tin `trainees_HCM26_CA_JAVA_01.xlsx` từ máy tính.
4. **Bước 4 (Frontend Upload):** Gửi yêu cầu `POST /api/v1/classes/{classId}/trainees/import` dưới dạng `multipart/form-data`.
5. **Bước 5 (Backend Processing):** Backend đọc dữ liệu Excel bằng thư viện Apache POI, kiểm tra hợp lệ cấu trúc cột, xác thực email và mã sinh viên, lưu hàng loạt học viên vào cơ sở dữ liệu.
6. **Bước 6 (Response & Render):** Backend trả về kết quả `200 OK` kèm số lượng bản ghi nhập thành công (ví dụ: `importedCount: 25`). Frontend tự động cập nhật danh sách học viên hiển thị.

### 7. Các luồng phụ & luồng ngoại lệ (Alternative & Exception Flows)
- **7.1. Tệp tin không đúng định dạng:** Nếu người dùng tải lên tệp không phải file `.xlsx` hoặc tệp bị hỏng, hệ thống báo lỗi `400 Bad Request: Định dạng tệp không được hỗ trợ`.
- **7.2. Trùng lặp sinh viên:** Nếu mã sinh viên hoặc email đã tồn tại trong lớp, hệ thống tự động bỏ qua bản ghi trùng và thông báo số lượng bản ghi bị bỏ qua.

### 8. Quy tắc nghiệp vụ (Business Rules)
- **BR-11:** Tệp Excel import phải tuân thủ đúng cấu trúc cột chuẩn FAMS: Cột A (STT), Cột B (Mã SV), Cột C (Họ và Tên), Cột D (Email FPT), Cột E (Số điện thoại).
- **BR-12:** Khi sĩ số thực tế đạt từ sĩ số kế hoạch trở lên (`actual >= planned`), hệ thống đánh dấu trạng thái Trụ cột 3 là `READY (FULL)`.

### 9. Thiết kế giao diện & Kết quả thực thi API trên Swagger UI
- **Hình ảnh Giao diện Frontend:** Tab Trainee List hiển thị danh sách 25 học viên đầy đủ thông tin, trạng thái Enrolled và nút Import/Export Excel.
- **Hình ảnh Swagger UI:** Kết quả thực thi API `POST /api/v1/classes/1/trainees/import` với tệp đính kèm, trả về kết quả `200 OK`, `importedCount: 25`, `failedCount: 0`.

### 10. Yêu cầu phi chức năng & Bảo mật
- Xử lý tệp tin Excel lên tới 200 học viên trong thời gian không quá 2 giây.

---

## 5.6. UC-06: Điều phối và tra cứu lịch học lớp theo tuần (Class Weekly Timetable)

### 1. Mã Use Case & Tên Use Case
- **Mã định danh:** `UC-06`
- **Tên Use Case:** Điều phối và tra cứu lịch học lớp theo tuần (Class Weekly Timetable & Schedule Coordination)
- **Phân hệ:** Class Management (Quản lý Lớp học)
- **Sinh viên phụ trách:** Ninh Hải Danh (MSSV: SE196647)

### 2. Tác nhân (Actors)
- **Tác nhân chính:** Class Admin, Master Trainer.
- **Tác nhân phụ:** Giảng viên, Học viên.

### 3. Mục tiêu & Mô tả tóm tắt
- Trực quan hóa toàn bộ lịch giảng dạy, bài thi và hoạt động của lớp học theo từng ngày trong tuần dưới dạng Thời khóa biểu (Timetable Grid).
- Hỗ trợ tra cứu slot học, phòng học, giảng viên phụ trách và điều chỉnh buổi học linh hoạt.

### 4. Tiền điều kiện (Preconditions)
- Lớp học đã được thiết lập chương trình đào tạo và phân công giảng viên.

### 5. Hậu điều kiện (Postconditions)
- Lịch học của lớp được hiển thị rõ ràng trên lưới thời khóa biểu, có thể lọc theo tuần, tháng.

### 6. Luồng sự kiện chính (Main Flow)
1. **Bước 1 (User):** Người dùng truy cập tab **"Calendar"** trong trang chi tiết lớp học hoặc chọn mục "Weekly Timetable" trên menu chính.
2. **Bước 2 (Frontend):** Gửi yêu cầu `GET /api/v1/classes/{classId}/schedules` đến Backend.
3. **Bước 3 (Backend Processing):** Backend truy vấn bảng `class_schedules`, trả về danh sách các buổi học kèm ngày học, ca học (Morning: 08:30 - 11:45), Topic, Giảng viên và Phòng học.
4. **Bước 4 (Frontend Render):** Frontend dựng lưới lịch học theo các ngày Thứ Hai đến Thứ Sáu, các thẻ buổi học được gắn màu sắc trực quan thể hiện trạng thái (Normal, Makeup, Exam).

### 7. Các luồng phụ & luồng ngoại lệ (Alternative & Exception Flows)
- **7.1. Chuyển tuần xem lịch:** Người dùng sử dụng nút chuyển tuần `<< Tuần trước | Tuần sau >>` để xem lịch học của các khoảng thời gian khác nhau.
- **7.2. Đổi phòng hoặc đổi ca:** Class Admin có quyền click vào thẻ buổi học để cập nhật phòng học hoặc thay đổi giảng viên dạy thay.

### 8. Quy tắc nghiệp vụ (Business Rules)
- **BR-13:** Ca học sáng chuẩn FAMS từ 08:30 đến 11:45; ca học chiều từ 13:30 đến 16:45. Không được xếp lịch trùng phòng giữa 2 lớp học khác nhau trong cùng một slot.
- **BR-14:** Bất kỳ thay đổi nào về lịch học đều tự động gửi thông báo hệ thống đến Giảng viên và Học viên của lớp.

### 9. Thiết kế giao diện & Kết quả thực thi API trên Swagger UI
- **Hình ảnh Giao diện Frontend:** Thời khóa biểu tuần của lớp hiển thị lưới các ngày trong tuần, các ca học sáng, phòng Lab 204 và giảng viên phụ trách.
- **Hình ảnh Swagger UI:** Kết quả thực thi API `GET /api/v1/classes/1/schedules` trả về `200 OK` danh sách các slot học chi tiết dưới dạng JSON.

### 10. Yêu cầu phi chức năng & Bảo mật
- Dữ liệu lịch học có thể đồng bộ nhanh chóng với lịch cá nhân của giảng viên và học viên qua định dạng chuẩn iCalendar (.ics).

---

# CHƯƠNG 6: MA TRẬN TRUY VẾT KIỂM THỬ & DANH MỤC API BACKEND TRÊN SWAGGER UI

Bảng tổng hợp đối soát truy vết giữa Use Case, API Backend tương ứng và kết quả kiểm thử thực tế trên Swagger UI:

| Mã Use Case | Chức năng nghiệp vụ | Endpoint API Backend | HTTP Method | Mã HTTP Phản hồi | Trạng thái kiểm thử Swagger | Minh chứng hình ảnh |
| :---: | :--- | :--- | :---: | :---: | :---: | :---: |
| **UC-01** | Lấy danh sách lớp học có phân trang & lọc | `/api/v1/classes` | `GET` | `200 OK` | Đã pass 100% | `swagger-class-list.png` |
| **UC-02** | Lấy thông tin đánh giá độ sẵn sàng 4 trụ cột | `/api/v1/classes/{id}/readiness` | `GET` | `200 OK` | Đã pass 100% | `swagger-class-readiness.png` |
| **UC-03** | Tạo mới thông tin lớp học (Select Admin & Trainer) | `/api/v1/classes` | `POST` | `201 Created` | Đã pass 100% | `swagger-class-create.png` |
| **UC-03** | Cập nhật thông tin hành chính lớp học | `/api/v1/classes/{id}` | `PUT` | `200 OK` | Đã pass 100% | `swagger-class-create.png` |
| **UC-04** | Phân công giảng viên giảng dạy Topic | `/api/v1/classes/{id}/teaching-assignments` | `POST` | `200 OK` | Đã pass 100% | `swagger-teaching-assignment.png` |
| **UC-05** | Nhập danh sách học viên từ file Excel | `/api/v1/classes/{id}/trainees/import` | `POST` | `200 OK` | Đã pass 100% | `swagger-trainee-import.png` |
| **UC-06** | Lấy danh sách lịch học theo thời khóa biểu | `/api/v1/classes/{id}/schedules` | `GET` | `200 OK` | Đã pass 100% | `swagger-class-calendar.png` |

---
**Tài liệu hoàn thành ngày 23/11/2026 bởi Ninh Hải Danh (MSSV: SE196647) - Nhóm HCM26_CPL_JAVA_10.**
