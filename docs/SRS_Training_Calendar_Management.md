# SOFTWARE REQUIREMENTS SPECIFICATION (SRS)
## Training Operations Management System (FAMS / TOMS)
### Phân hệ: Training Calendar & Schedule Version Management (Quản lý Lịch đào tạo & Thời khóa biểu theo Phiên bản)

---

## Bảng thông tin tài liệu & Lịch sử phiên bản (Document Control & Revision History)

| Thông tin | Giá trị |
| :--- | :--- |
| **Tên dự án** | Fresher Academy Management System (FAMS - Mock Project 2026) |
| **Mã tài liệu** | `FAMS-SRS-CAL-01` |
| **Phân hệ / Module** | Training Calendar & Weekly Timetable Management |
| **Phiên bản (Version)** | `1.0` |
| **Ngày ban hành** | 03/11/2026 |
| **Tác giả / Người thực hiện** | Nguyễn Ngọc Tân (Frontend & Calendar Specialist) |
| **Đối tượng áp dụng** | Đội ngũ phát triển (Dev Full-Stack), QA/QC Tester, Product Owner (PO), Giảng viên hướng dẫn |

### Lịch sử thay đổi (Revision History)

| Phiên bản | Ngày | Tác giả | Mô tả thay đổi |
| :---: | :---: | :---: | :--- |
| **0.1** | 20/10/2026 | Dev Team | Khởi tạo cấu trúc ban đầu của màn hình Adjust Calendar & Preview. |
| **0.5** | 28/10/2026 | Nguyễn Ngọc Tân | Bổ sung thuật toán tự động chia buổi học (Auto-split by Duration) và bỏ qua cuối tuần. |
| **0.9** | 02/11/2026 | Nguyễn Ngọc Tân | Tích hợp API thực tế (`Subject`, `StudySession`, `ClassSetup`), loại bỏ dữ liệu ảo, giới hạn ký tự và ràng buộc validate ngày học. |
| **1.0** | 03/11/2026 | Nguyễn Ngọc Tân | Hoàn thiện tài liệu SRS chuẩn theo mẫu FAMS / BA Practical IEEE 830 với đầy đủ User Stories, AC, Screen Element Dictionary, Business Rules & API contract. |

---

## Mục lục (Table of Contents)

1. [Giới thiệu & Tổng quan (Introduction & Overview)](#1-giới-thiệu--tổng-quan-introduction--overview)
   - 1.1. Mục đích (Purpose)
   - 1.2. Tổng quan sản phẩm (Product Overview)
   - 1.3. Phạm vi chức năng trong Scope (Scope of Work)
   - 1.4. Ngoài phạm vi (Out of Scope)
   - 1.5. Đối tượng độc giả (Intended Audience)
   - 1.6. Ràng buộc & Giả định (Constraints & Assumptions)
   - 1.7. Bảng thuật ngữ viết tắt (Abbreviations & Terminology)
   - 1.8. Tài liệu tham chiếu (References)
2. [Yêu cầu mức cao & Kiến trúc dữ liệu (High-Level Requirements & Data Model)](#2-yêu-cầu-mức-cao--kiến-trúc-dữ-liệu-high-level-requirements--data-model)
   - 2.1. Mô hình dữ liệu khái niệm & logic (Conceptual & Logical Data Model)
   - 2.2. Danh sách User Story mức cao (High-Level User Story List)
   - 2.3. Ma trận phân quyền (Permission Matrix)
   - 2.4. Sơ đồ chuyển đổi trạng thái (State Transition Diagram)
   - 2.5. Luồng di chuyển màn hình (Navigation Flow & Site Map)
3. [Đặc tả chi tiết User Story (Detailed User Story Specifications)](#3-đặc-tả-chi-tiết-user-story-detailed-user-story-specifications)
   - 3.1. US-CAL-01: Xem danh sách phiên bản lịch của lớp (Calendar Version List)
   - 3.2. US-CAL-02: Tự động nạp môn học chuẩn từ chương trình (Load All Topics)
   - 3.3. US-CAL-03: Thêm môn học thủ công vào lịch (Add Topic Manually)
   - 3.4. US-CAL-04: Tự động chia buổi học theo thời lượng (Auto-split Sessions by Duration)
   - 3.5. US-CAL-05: Điều chỉnh chi tiết ca học, giảng viên, phòng học (Edit Day & Activity Schedule)
   - 3.6. US-CAL-06: Kiểm tra xung đột & Ràng buộc ngày học (Validate Conflicts & Start Date)
   - 3.7. US-CAL-07: Lưu & Xác nhận phiên bản lịch đào tạo (Save & Commit Calendar Version)
   - 3.8. US-CAL-08: Xem thời khóa biểu tuần trực quan (Weekly Timetable Preview)
4. [Quy tắc nghiệp vụ & Xử lý lỗi (Business Rules & Application Messages)](#4-quy-tắc-nghiệp-vụ--xử-lý-lỗi-business-rules--application-messages)
   - 4.1. Bảng quy tắc nghiệp vụ (Business Rules - BR)
   - 4.2. Bảng mã thông báo & Lỗi ứng dụng (Application Messages - EM)
5. [Quy chuẩn kiểm soát giao diện dùng chung (Common Field Controls & UI/UX Standards)](#5-quy-chuẩn-kiểm-soát-giao-diện-dùng-chung-common-field-controls--uiux-standards)
6. [Yêu cầu phi chức năng (Non-Functional Requirements - NFR)](#6-yêu-cầu-phi-chức-năng-non-functional-requirements---nfr)
7. [Đặc tả hợp đồng API (REST API Contract)](#7-đặc-tả-hợp-đồng-api-rest-api-contract)
8. [Tiêu chí nghiệm thu & Luồng vàng (Acceptance Test Scenarios & Definition of Done)](#8-tiêu-chí-nghiệm-thu--luồng-vàng-acceptance-test-scenarios--definition-of-done)

---

## 1. Giới thiệu & Tổng quan (Introduction & Overview)

### 1.1. Mục đích (Purpose)
Tài liệu này định nghĩa chi tiết các yêu cầu kỹ thuật và nghiệp vụ cho phân hệ **Training Calendar & Schedule Version Management** trong hệ thống Quản lý Vận hành Đào tạo **FAMS (Fresher Academy Management System)**. Tài liệu đóng vai trò là cơ sở duy nhất để:
- Hướng dẫn lập trình viên Frontend và Backend hiện thực hóa chức năng chính xác.
- Đội ngũ QA/QC thiết kế Test Plan, Test Cases và kịch bản kiểm thử nghiệm thu (UAT).
- Giảng viên và Hội đồng đánh giá nghiệm thu sản phẩm Mock Project.

### 1.2. Tổng quan sản phẩm (Product Overview)
Trong các học viện đào tạo công nghệ chuyên sâu, việc lập lịch học truyền thống bằng bảng tính Excel gặp rất nhiều bất cập: tốn thời gian, dễ trùng lịch giảng viên/phòng lab, khó kiểm soát phiên bản khi có phát sinh thay đổi và không đồng bộ tức thời đến học viên và người giảng dạy.

Phân hệ **Training Calendar Management** cung cấp giải pháp toàn diện:
1. **Lập kế hoạch & Điều chỉnh lịch (Calendar Adjust)**: Cho phép Class Admin và Training Operator sắp xếp lộ trình môn học, tự động tính toán số buổi học dựa trên tổng thời lượng (Duration) và số giờ mỗi ca (Session Hours), tự động dàn lịch bỏ qua thứ 7 và Chủ nhật.
2. **Quản lý phiên bản không phá hủy (Non-destructive Schedule Versioning)**: Mỗi lần điều chỉnh lịch lớn được lưu thành một phiên bản riêng biệt (`v1.0`, `v1.1`,...), có ghi chú lý do thay đổi (*Change Note*) và phân biệt trạng thái `DRAFT` / `PUBLISHED`.
3. **Phát hiện xung đột tự động (Conflict Detection)**: Kiểm tra chéo thời gian thực về tính hợp lệ của ngày học (không được trước ngày lớp bắt đầu học thực tế), không trùng lịch giảng viên (Trainer), không trùng phòng học (Room).
4. **Thời khóa biểu tuần trực quan (Weekly Timetable Preview)**: Trực quan hóa lịch học dạng lưới đa chiều theo tuần với đầy đủ thông tin ca sáng/chiều, phòng học, giảng viên, mã môn và trạng thái buổi học.

### 1.3. Phạm vi chức năng trong Scope (Scope of Work)
- **Quản lý danh sách phiên bản lịch theo lớp học**: Tra cứu, lọc theo lớp, xem lịch sử sửa đổi, chuyển đổi phiên bản.
- **Tự động nạp môn học chuẩn**: Đồng bộ danh mục môn học (`Subject`) từ hệ thống backend và sinh buổi học tự động.
- **Thêm/Sửa/Xóa môn học trong lịch đào tạo**: Cho phép nhập môn tự do hoặc chọn môn trong danh mục, cấu hình tổng thời lượng và tự động chia buổi.
- **Điều chỉnh linh hoạt từng buổi học (Day & Activity)**: Thay đổi tên buổi, ngày học, ca học (Start/End), hình thức (Offline / Online / Self Learning), giảng viên phụ trách (PIC) và phòng học.
- **Tính năng Auto-split by Duration**: Tự động tính toán lại lịch học cho môn khi thay đổi thời lượng buổi học hoặc ngày bắt đầu môn.
- **Ràng buộc nghiệp vụ và tự động đồng bộ ngày học**: Cảnh báo tức thì khi ngày học vi phạm quy tắc ngày bắt đầu học (`Actual Learning Start Date`), cung cấp nút 1-click tự động đồng bộ ngày.
- **Lưu và đồng bộ dữ liệu buổi học**: Lưu trữ phiên bản lịch và sinh tự động các bản ghi `StudySession` xuống máy chủ backend.
- **Màn hình Thời khóa biểu tuần**: Lọc theo lớp, trạng thái buổi học (`SCHEDULED`, `COMPLETED`, `CANCELLED`), tìm kiếm từ khóa, điều hướng tuần trước/sau/hôm nay và xem chi tiết buổi học (Detail Modal).

### 1.4. Ngoài phạm vi (Out of Scope)
- Hệ thống chấm công tự động bằng sinh trắc học hoặc quét vân tay tại cửa phòng học.
- Tích hợp thanh toán thù lao giảng viên tự động qua cổng ngân hàng.
- Ứng dụng di động Native (iOS/Android) độc lập (hệ thống tập trung giao diện Web Responsive).

### 1.5. Đối tượng độc giả (Intended Audience)
- **Product Owner / Business Analyst**: Theo dõi tính đúng đắn của yêu cầu và tiêu chí nghiệm thu.
- **Frontend & Backend Engineers**: Bám sát cấu trúc dữ liệu, validation rules, API endpoints và UI elements.
- **QA/QC Engineers**: Đối soát Acceptance Criteria để viết test case.

### 1.6. Ràng buộc & Giả định (Constraints & Assumptions)
- Hệ thống chạy trên nền tảng web hiện đại (Google Chrome, Microsoft Edge, Cốc Cốc, Firefox 2 phiên bản mới nhất).
- Toàn bộ thời gian được chuẩn hóa theo múi giờ Việt Nam: `Asia/Ho_Chi_Minh` (UTC+7).
- Dữ liệu hiển thị trong Mock Project là dữ liệu giả lập có ý nghĩa thực tế, tuân thủ chính sách bảo mật thông tin.

### 1.7. Bảng thuật ngữ viết tắt (Abbreviations & Terminology)

| Thuật ngữ | Tên đầy đủ | Định nghĩa / Diễn giải |
| :--- | :--- | :--- |
| **FAMS** | Fresher Academy Management System | Hệ thống Quản lý Vận hành Học viện Đào tạo Fresher. |
| **TOMS** | Training Operations Management System | Tên mô phỏng nghiệp vụ của hệ thống. |
| **RBAC** | Role-Based Access Control | Cơ chế kiểm soát và phân quyền người dùng dựa trên vai trò. |
| **Topic / Subject** | Training Topic / Subject | Đơn vị môn học trong chương trình đào tạo (ví dụ: `JAVA_CORE`, `SPRING_BOOT`). |
| **Session** | Study Session / Activity | Một buổi học hoặc hoạt động học tập cụ thể trong ngày (có giờ bắt đầu, kết thúc, phòng học, trainer). |
| **Schedule Version** | Calendar Version | Phiên bản lưu vết cấu trúc lịch đào tạo của một lớp học cụ thể (ví dụ: `v1.0`). |
| **Class Start Date** | Ngày khai giảng lớp | Ngày lớp học chính thức được thành lập trên hệ thống. |
| **Actual Learning Start Date** | Ngày bắt đầu học thực tế | Mốc ngày bắt đầu diễn ra buổi học chuyên môn đầu tiên (buổi đào tạo không được diễn ra trước mốc này). |
| **PIC / Trainer** | Person In Charge / Instructor | Giảng viên hoặc người chịu trách nhiệm chính của buổi học. |
| **NFP** | New Fresher Program | Khung chương trình đào tạo chuẩn dành cho Fresher. |

### 1.8. Tài liệu tham chiếu (References)
1. `FAMS_PracticalBA2_SRS_25.11_2023-1.pdf` - Tài liệu đặc tả phân tích nghiệp vụ FAMS FPT Academy.
2. `SRS_Mock_Project_Training_Management_System_With_UI_Designs.pdf` - Đặc tả hệ thống quản lý vận hành đào tạo TOMS.
3. `FAMS_LMS.txt` - Đặc tả chi tiết phân hệ Calendar Version List & Add new Calendar Version (Section 3.2.23.15 & 3.2.23.16).

---

## 2. Yêu cầu mức cao & Kiến trúc dữ liệu (High-Level Requirements & Data Model)

### 2.1. Mô hình dữ liệu khái niệm & logic (Conceptual & Logical Data Model)

```mermaid
erDiagram
    CLASS ||--o{ SCHEDULE_VERSION : "has many versions"
    CLASS ||--o{ STUDY_SESSION : "conducts"
    SCHEDULE_VERSION ||--o{ SCHEDULE_TOPIC : "contains"
    SCHEDULE_TOPIC ||--o{ SCHEDULE_DAY : "consists of"
    SCHEDULE_DAY ||--o{ SCHEDULE_ACTIVITY : "schedules"
    SUBJECT ||--o{ SCHEDULE_TOPIC : "referenced by"
    USER ||--o{ STUDY_SESSION : "teaches as trainer"
    ROOM ||--o{ STUDY_SESSION : "located in"

    CLASS {
        bigint id PK
        string code "Unique Class Code (e.g. HCM26_FR_FU_KS_JAVA_01)"
        string name "Class Full Name"
        date start_date "Class Start Date"
        date actual_learning_start_date "Learning Start Date"
        string status "PLANNING, IN_PROGRESS, COMPLETED"
    }

    SCHEDULE_VERSION {
        bigint id PK
        bigint class_id FK
        int version_number "e.g. 1, 2"
        string status "DRAFT, PUBLISHED, ARCHIVED"
        string note "Change note explaining adjustments"
        datetime created_at
        string created_by
    }

    SCHEDULE_TOPIC {
        string id PK
        bigint version_id FK
        string code "e.g. JAVA_CORE"
        string name "e.g. Java Core & OOP"
        decimal duration_hours "Total duration (e.g. 20h)"
        decimal session_hours "Hours per session (e.g. 2.5h)"
        string trainer "Lead trainer / PIC"
        string location "Default room / lab"
        int display_order
    }

    SCHEDULE_DAY {
        string id PK
        string topic_id FK
        int day_no "Day 1, Day 2..."
        string name "Day title"
        date date "Training Date (YYYY-MM-DD)"
    }

    SCHEDULE_ACTIVITY {
        string id PK
        string day_id FK
        string name "Activity title"
        time start_time "HH:mm"
        time end_time "HH:mm"
        string pic "Assigned Trainer"
        string contribution "Lecture, Assignment, Review"
        string format "Offline, Online, Self Learning"
    }

    STUDY_SESSION {
        bigint id PK
        bigint class_id FK
        string title "e.g. [JAVA_CORE] OOP Fundamentals"
        datetime start_time "ISO-8601"
        datetime end_time "ISO-8601"
        string location "Room / Teams link"
        string status "SCHEDULED, COMPLETED, CANCELLED"
        string note "PIC & contribution details"
    }
```

### 2.2. Danh sách User Story mức cao (High-Level User Story List)

| STT | Mã US | Tên chức năng (Function) | Tác nhân chính (Actor) | Mục tiêu nghiệp vụ (Business Goal) | Ưu tiên |
| :---: | :--- | :--- | :--- | :--- | :---: |
| 1 | **US-CAL-01** | Xem danh sách phiên bản lịch lớp | Class Admin / Operator | Quản lý vòng đời và các phiên bản lịch đào tạo của lớp. | **P0** |
| 2 | **US-CAL-02** | Tự động nạp môn học chuẩn | Class Admin / Operator | Nhanh chóng tạo khung chương trình từ danh mục môn học hệ thống. | **P0** |
| 3 | **US-CAL-03** | Thêm môn học thủ công vào lịch | Class Admin / Operator | Linh hoạt bổ sung môn học/chuyên đề đặc thù ngoài chương trình chuẩn. | **P0** |
| 4 | **US-CAL-04** | Tự động chia buổi theo thời lượng | Class Admin / Operator | Tối ưu hóa tính toán số buổi, số giờ và lịch học bỏ qua cuối tuần. | **P0** |
| 5 | **US-CAL-05** | Điều chỉnh chi tiết ca học & trainer | Class Admin / Trainer | Phân bổ giảng viên, phòng học và khung giờ chính xác cho từng ngày học. | **P0** |
| 6 | **US-CAL-06** | Kiểm tra xung đột & Ràng buộc ngày | Hệ thống (System Engine) | Đảm bảo tính khả thi, không trùng tài nguyên và đúng mốc đào tạo. | **P0** |
| 7 | **US-CAL-07** | Lưu & Xác nhận phiên bản lịch | Class Admin / Operator | Đồng bộ lịch đào tạo thành các buổi học chính thức trên máy chủ. | **P0** |
| 8 | **US-CAL-08** | Xem Thời khóa biểu tuần trực quan | Toàn bộ người dùng | Trực quan hóa lịch học dạng tuần, hỗ trợ theo dõi và điều phối lớp học. | **P0** |

### 2.3. Ma trận phân quyền (Permission Matrix)

| Nhóm chức năng / Thao tác | Super Admin | Training Operator | Class Admin | Trainer (Được gán) | Trainee (Học viên) |
| :--- | :---: | :---: | :---: | :---: | :---: |
| Xem thời khóa biểu tuần (Weekly Timetable) | **Full** | **Full** | **Full (Lớp quản lý)** | **View (Lớp dạy)** | **View (Lớp học)** |
| Xem danh sách phiên bản lịch (Version List) | **Full** | **Full** | **Full** | View | No |
| Tạo mới / Điều chỉnh lịch (Adjust Calendar) | **Full** | **Full** | **Full** | Sửa buổi được gán | No |
| Tự động chia buổi học (Auto-split Duration) | **Full** | **Full** | **Full** | No | No |
| Kiểm tra xung đột lịch (Conflict Detection) | **Full** | **Full** | **Full** | View | No |
| Lưu phiên bản lịch / Publish lịch đào tạo | **Full** | **Full** | **Full** | No | No |
| Đánh dấu trạng thái buổi học (Completed/Cancelled)| **Full** | **Full** | **Full** | **Update** | No |

### 2.4. Sơ đồ chuyển đổi trạng thái (State Transition Diagram)

#### Trạng thái phiên bản lịch đào tạo (Schedule Version State Machine):
```
[DRAFT]  ----(Hoàn thiện & Không xung đột)---->  [PUBLISHED]
   |                                                    |
   +----(Tạo bản sao chỉnh sửa / Re-adjust)--------> [DRAFT v+1]
   |
   +----(Hủy bỏ / Thay thế bởi phiên bản mới)------> [ARCHIVED]
```

#### Trạng thái buổi học đào tạo (Study Session State Machine):
```
[SCHEDULED] (Đã lên lịch)
     |
     +----(Buổi học diễn ra thành công)----------> [COMPLETED] (Đã hoàn thành)
     |
     +----(Sự cố / Nghỉ lễ / Hoãn đột xuất)-------> [CANCELLED] (Đã hủy)
```

### 2.5. Luồng di chuyển màn hình (Navigation Flow & Site Map)

```
[Sidebar Menu: Training Operations]
   |
   +---> [Adjust Calendar] (/calendar/adjust)
   |        |
   |        +---> [Header: Chọn lớp & Mốc ngày học]
   |        +---> [Action Toolbar: Load All Topics | + Add Topic | Check Conflicts | Save Schedule]
   |        +---> [Topic Card Accordion]
   |                 +---> [Modal: Chia theo Duration]
   |                 +---> [Data Table: Days & Time Slots]
   |                 +---> [Modal: Save Training Calendar (Change Note)]
   |
   +---> [Timetable] (/calendar/preview)
            |
            +---> [Bộ lọc: Lớp học | Trạng thái buổi học | Tìm kiếm tiêu đề]
            +---> [Điều hướng tuần: Tuần trước | Hôm nay | Tuần sau]
            +---> [Lưới ma trận 6 ngày (Thứ Hai -> Thứ Bảy)]
                     +---> [Card buổi học (Ca 1, Ca 2)]
                              +---> [Modal: Chi tiết buổi học (Session Detail Modal)]
```

---

## 3. Đặc tả chi tiết User Story (Detailed User Story Specifications)

### 3.1. US-CAL-01: Xem danh sách phiên bản lịch của lớp (Calendar Version List)

- **Mã User Story**: `US-CAL-01`
- **Tên chức năng**: Quản lý và chuyển đổi danh sách phiên bản lịch đào tạo theo lớp.
- **Tác nhân (Actor)**: Super Admin, Training Operator, Class Admin.
- **Mô tả nghiệp vụ**:
  > Là một Class Admin / Training Operator,  
  > Tôi muốn xem danh sách các phiên bản lịch đào tạo đã tạo cho một lớp học cụ thể,  
  > Để tôi có thể theo dõi lịch sử điều chỉnh lịch, chọn phiên bản đang áp dụng hoặc tiếp tục hoàn thiện bản nháp.

#### Tiêu chí nghiệm thu (Acceptance Criteria - AC):
- **AC1**: Khi người dùng chọn một lớp học từ danh sách, hệ thống hiển thị mã lớp và tên lớp tương ứng.
- **AC2**: Hệ thống tải và hiển thị danh sách các phiên bản lịch thuộc lớp đó, bao gồm: Mã phiên bản (`Version`), Trạng thái (`Status`: `DRAFT` hoặc `PUBLISHED`), Ghi chú thay đổi (`Change Note`), Ngày tạo và Người tạo.
- **AC3**: Phiên bản `PUBLISHED` được làm nổi bật với huy hiệu màu xanh lục lá cây; phiên bản `DRAFT` hiển thị huy hiệu cảnh báo màu vàng cam.
- **AC4**: Người dùng có thể nhấn nút "Chỉnh sửa lịch" (*Adjust Calendar*) để mở giao diện điều chỉnh chi tiết cho phiên bản được chọn.

---

### 3.2. US-CAL-02: Tự động nạp môn học chuẩn từ chương trình (Load All Topics)

- **Mã User Story**: `US-CAL-02`
- **Tên chức năng**: Tự động nạp toàn bộ môn học chuẩn từ API danh mục môn học (`Subject API`).
- **Tác nhân (Actor)**: Class Admin, Training Operator.
- **Mô tả nghiệp vụ**:
  > Là một người lập lịch đào tạo,  
  > Tôi muốn nhấn nút "Load All Topics" để hệ thống tự động lấy toàn bộ môn học chính thức và dàn lịch khởi tạo,  
  > Giúp tôi tiết kiệm thời gian nhập liệu thủ công từng môn học từ đầu.

#### Tiêu chí nghiệm thu (Acceptance Criteria - AC):
- **AC1 (GIVEN - WHEN - THEN)**:
  - **GIVEN**: Người dùng đang ở màn hình Adjust Calendar của một lớp học.
  - **WHEN**: Người dùng nhấn nút **"Load All Topics"** (biểu tượng Sparkles).
  - **THEN**: Hệ thống gọi API `GET /api/subjects/active` để lấy danh sách các môn học đang hoạt động trong hệ thống.
- **AC2 (Tính toán ngày kế tiếp)**:
  - Môn học đầu tiên bắt đầu từ ngày `Actual Learning Start Date`.
  - Môn học tiếp theo tự động bắt đầu nối tiếp ngay sau ngày kết thúc của môn học trước đó (tự động bỏ qua Thứ Bảy và Chủ Nhật).
- **AC3 (Xử lý ngoại lệ)**:
  - Nếu hệ thống chưa có môn học nào đang hoạt động, hiển thị cảnh báo `EM-CAL-01`: *"Chưa có môn học nào trong hệ thống. Vui lòng tạo môn học trong mục Quản lý môn học trước."*
  - Nếu nạp thành công, hiển thị thông báo Toast thành công với số lượng môn học đã được nạp.

---

### 3.3. US-CAL-03: Thêm môn học thủ công vào lịch (Add Topic Manually)

- **Mã User Story**: `US-CAL-03`
- **Tên chức năng**: Thêm mới một môn học tùy chỉnh vào kế hoạch đào tạo của lớp.
- **Tác nhân (Actor)**: Class Admin, Training Operator.
- **Mô tả nghiệp vụ**:
  > Là một người quản lý lớp,  
  > Tôi muốn có thể bổ sung một môn học mới với mã môn, tên môn và thời lượng xác định,  
  > Để linh hoạt điều chỉnh chương trình đào tạo theo yêu cầu thực tế của doanh nghiệp.

#### Tiêu chí nghiệm thu (Acceptance Criteria - AC):
- **AC1**: Khi nhấn nút **"+ Add Topic"**, hệ thống hiển thị Dialog thêm môn học với các trường thông tin:
  - Danh mục môn học (*Subject Preset*): Chọn từ môn có sẵn hoặc chọn *"Môn tùy chỉnh (Custom Topic)"*.
  - Mã môn học (*Topic Code*): Bắt buộc nhập, tối đa 30 ký tự, tự động viết hoa, chỉ cho phép ký tự chữ in hoa, số, gạch dưới `_`, gạch ngang `-`, ngoặc vuông `[]`.
  - Tên môn học (*Topic Name*): Bắt buộc nhập, tối đa 100 ký tự.
  - Tổng thời lượng môn (*Total Duration*): Bắt buộc nhập, giá trị số nguyên từ 1 đến 300 giờ.
  - Thời lượng 1 buổi (*Session Duration*): Chọn từ danh sách: 2.0 giờ, 2.5 giờ (chuẩn), 3.0 giờ, 4.0 giờ.
  - Giờ bắt đầu ca học (*Daily Start Time*): Mặc định `08:00`.
  - Tùy chọn bỏ qua cuối tuần (*Skip Weekends*): Checkbox mặc định được chọn (Checked).
- **AC2**: Kiểm tra tính hợp lệ tại chỗ (Inline Validation):
  - Nếu mã môn hoặc tên môn để trống, hiển thị thông báo lỗi dưới trường tương ứng.
  - Bộ đếm ký tự hiển thị trực quan (ví dụ: `12/30`, `45/100`).
- **AC3**: Khi nhấn nút **"Thêm môn & Tự động chia buổi"**, hệ thống:
  - Tự động tính toán số buổi học = $\lceil \text{Tổng thời lượng} / \text{Thời lượng 1 buổi} \rceil$.
  - Sinh danh sách các ngày học và ca học tương ứng.
  - Thêm thẻ môn học vào cuối danh sách lộ trình và đóng dialog.

#### Bảng từ điển trường dữ liệu Modal Thêm Topic (Screen Element Dictionary):

| STT | Tên trường (Element) | Loại điều khiển (Format) | Bắt buộc (Require) | Kiểu dữ liệu (Data Type) | Giới hạn / Ràng buộc (Validation) | Giá trị mặc định | Diễn giải chức năng |
| :---: | :--- | :--- | :---: | :--- | :--- | :--- | :--- |
| 1 | **Subject Preset** | Dropdown Select | Không | String | Chọn từ danh mục Active Subjects hoặc `CUSTOM` | `CUSTOM` | Chọn môn mẫu hệ thống để tự điền mã và tên môn. |
| 2 | **Topic Code** | Text Input | **Có** | Alphanumeric | Max 30 ký tự, Regex: `^[A-Z0-9_\-\[\]]+$` | Rỗng | Mã định danh môn học (viết hoa). |
| 3 | **Topic Name** | Text Input | **Có** | Unicode Text | Max 100 ký tự | Rỗng | Tên đầy đủ của môn học đào tạo. |
| 4 | **Total Hours** | Number Input | **Có** | Integer | Min: 1, Max: 300 giờ. Ngăn chặn ký tự `e`, `+`, `-`, `.` | `20` | Tổng thời lượng đào tạo của toàn bộ môn học. |
| 5 | **Session Hours** | Dropdown Select | **Có** | Decimal | Danh sách: 2.0h, 2.5h, 3.0h, 4.0h | `2.5` | Số giờ học chuẩn của một buổi học trong ngày. |
| 6 | **Start Time** | Time Input | **Có** | Time (HH:mm) | Định dạng 24 giờ | `08:00` | Giờ bắt đầu ca học mỗi ngày. |
| 7 | **Skip Weekends** | Checkbox | Không | Boolean | True / False | `True` | Tự động bỏ qua Thứ 7 và Chủ Nhật khi xếp ngày. |
| 8 | **Btn Submit** | Button | - | Action | Kích hoạt thuật toán sinh buổi học | - | Tạo môn học và chia buổi tự động. |
| 9 | **Btn Cancel** | Button | - | Action | Đóng popup, không lưu | - | Hủy thao tác thêm môn. |

---

### 3.4. US-CAL-04: Tự động chia buổi học theo thời lượng (Auto-split Sessions by Duration)

- **Mã User Story**: `US-CAL-04`
- **Tên chức năng**: Tự động tính toán và phân bổ lại buổi học theo thời lượng cho một môn học cụ thể.
- **Tác nhân (Actor)**: Class Admin, Training Operator.
- **Mô tả nghiệp vụ**:
  > Là một người điều phối lịch,  
  > Tôi muốn nhấn nút "Chia theo Duration" trên từng môn học để cấu hình lại số giờ/buổi hoặc đổi ngày bắt đầu môn,  
  > Để hệ thống tự động tính lại số buổi và tự động dàn lại ngày học mà tôi không cần sửa tay từng dòng.

#### Tiêu chí nghiệm thu (Acceptance Criteria - AC):
- **AC1**: Trên mỗi thanh tiêu đề của môn học (*Topic Card Header*), hiển thị nút **"✨ Chia theo Duration"**.
- **AC2**: Khi nhấn nút, hiển thị Modal cho phép tùy chỉnh:
  - Tổng thời lượng môn (giờ).
  - Thời lượng 1 buổi học (giờ).
  - Giờ bắt đầu học mỗi ngày (HH:mm).
  - Ngày bắt đầu môn học (*Start Date of Topic*): Mặc định là ngày của buổi học đầu tiên của môn đó hoặc `Actual Learning Start Date`.
  - Tùy chọn bỏ qua thứ 7 / Chủ nhật.
- **AC3 (Thuật toán chia buổi - Splitting Algorithm)**:
  - Số buổi cần tạo = $\lceil \text{Tổng thời lượng} / \text{Thời lượng 1 buổi} \rceil$.
  - Buổi cuối cùng có thời lượng bằng phần dư còn lại (nếu tổng thời lượng không chia hết cho thời lượng buổi).
  - Ngày của buổi $i+1$ là ngày làm việc tiếp theo của ngày buổi $i$ (nếu ngày rơi vào thứ 7 hoặc Chủ nhật, tự động nhảy sang Thứ Hai tuần kế tiếp).
- **AC4**: Khi áp dụng thành công, toàn bộ danh sách ngày học cũ của môn học đó được thay thế bằng danh sách ngày học mới được sinh ra.

---

### 3.5. US-CAL-05: Điều chỉnh chi tiết ca học, giảng viên, phòng học (Edit Day & Activity Schedule)

- **Mã User Story**: `US-CAL-05`
- **Tên chức năng**: Chỉnh sửa trực tiếp thông tin từng ngày học, ca học, giảng viên và phòng học trên bảng dữ liệu.
- **Tác nhân (Actor)**: Class Admin, Trainer.
- **Mô tả nghiệp vụ**:
  > Là người trực tiếp phụ trách lớp,  
  > Tôi muốn chỉnh sửa tiêu đề ngày, giờ học, đổi phòng học hoặc đổi giảng viên cho từng buổi học cụ thể,  
  > Để lịch đào tạo phản ánh chính xác phân công thực tế của học viện.

#### Tiêu chí nghiệm thu (Acceptance Criteria - AC):
- **AC1 (Chỉnh sửa cấp độ môn học - Topic Level)**:
  - Chọn Phòng học mặc định (*Default Location/Room*): Danh sách phòng lấy từ danh mục phòng học thực tế (`Phòng Lab 201 (F-Town 2)`, `Phòng 304 (Innovation Hall)`, `Phòng Online Zoom A`,...).
  - Chọn Giảng viên phụ trách môn (*Lead Trainer / PIC*): Danh sách giảng viên thực tế lấy từ hệ thống.
- **AC2 (Chỉnh sửa cấp độ ngày học - Day Level)**:
  - Tiêu đề ngày (*Day title*): Cho phép sửa text, giới hạn tối đa 100 ký tự.
  - Ngày diễn ra (*Date Picker*): Chọn ngày học định dạng `YYYY-MM-DD`. Nếu ngày học nhỏ hơn ngày bắt đầu học thực tế, hiển thị viền đỏ cảnh báo.
  - Nút thêm ngày học (*+ Add Day*): Bổ sung thêm 1 ngày học nối tiếp vào môn.
  - Nút xóa ngày học (*Delete Day*): Xóa ngày học kèm hộp thoại xác nhận.
- **AC3 (Chỉnh sửa cấp độ hoạt động/ca học - Activity Level)**:
  - Tên hoạt động (*Activity name*): Nhập tên bài giảng / bài thực hành, tối đa 100 ký tự.
  - Giờ bắt đầu & Giờ kết thúc (*Start / End Time*): Định dạng HH:mm. Ràng buộc: Giờ kết thúc phải sau giờ bắt đầu.
  - Giảng viên phụ trách ca (*PIC*): Chọn từ danh sách giảng viên.
  - Hình thức đào tạo (*Delivery Format*): Chọn `Offline`, `Online`, hoặc `Self Learning`.
  - Hạng mục đóng góp (*Contribution*): Chọn `Lecture`, `Assignment`, hoặc `Review`.

---

### 3.6. US-CAL-06: Kiểm tra xung đột & Ràng buộc ngày học (Validate Conflicts & Start Date)

- **Mã User Story**: `US-CAL-06`
- **Tên chức năng**: Kiểm tra tính hợp lệ toàn vẹn của lịch đào tạo trước khi lưu.
- **Tác nhân (Actor)**: Hệ thống (Validation Engine), Class Admin.
- **Mô tả nghiệp vụ**:
  > Là người phê duyệt lịch,  
  > Tôi muốn hệ thống tự động kiểm tra tất cả các ràng buộc ngày tháng và trùng lặp tài nguyên,  
  > Để đảm bảo lịch đào tạo không có lỗi logic trước khi công bố cho học viên.

#### Tiêu chí nghiệm thu (Acceptance Criteria - AC):
- **AC1 (Ràng buộc ngày bắt đầu học - Learning Start Date Constraint)**:
  - Ngày học của mọi buổi học ($Date_{session}$) **BẮT BUỘC** phải $\ge$ Ngày bắt đầu học thực tế của lớp (`Actual Learning Start Date`).
  - Nếu tồn tại bất kỳ buổi học nào có $Date_{session} < \text{Actual Learning Start Date}$, hệ thống chặn việc lưu lịch và hiển thị dải thông báo lỗi màu đỏ nổi bật:
    `[[Mã môn]]: Training date (YYYY-MM-DD) cannot be before actual learning start (YYYY-MM-DD).`
- **AC2 (Nút 1-click Đồng bộ ngày học - Quick Auto-Sync Button)**:
  - Khi xuất hiện lỗi vi phạm ngày bắt đầu học, ngay bên trong thông báo lỗi màu đỏ, hệ thống cung cấp một nút bấm thông minh:
    `[Đồng bộ ngày bắt đầu học (YYYY-MM-DD)]` (với ngày là ngày của buổi học sớm nhất).
  - Khi người dùng nhấn nút này, hệ thống tự động cập nhật trường `Actual Learning Start Date` và `Class Start Date` về ngày sớm nhất đó, xóa bỏ thông báo lỗi và đưa trạng thái lịch về hợp lệ ngay lập tức.
- **AC3 (Kiểm tra xung đột tài nguyên - Resource Conflicts)**:
  - Phát hiện nếu cùng một Trainer bị phân công dạy 2 lớp khác nhau trong cùng một khoảng thời gian.
  - Phát hiện nếu cùng một Phòng học bị xếp cho 2 hoạt động trùng khung giờ.
  - Kiểm tra giờ kết thúc phải sau giờ bắt đầu của từng hoạt động.
- **AC4**: Khi nhấn nút **"Check Conflicts"**:
  - Nếu phát hiện lỗi: Hiển thị danh sách các điểm xung đột và tô viền cảnh báo các ô bị lỗi.
  - Nếu không có lỗi: Hiển thị thông báo Toast thành công: *"Client schedule structure verified successfully."*

---

### 3.7. US-CAL-07: Lưu & Xác nhận phiên bản lịch đào tạo (Save & Commit Calendar Version)

- **Mã User Story**: `US-CAL-07`
- **Tên chức năng**: Lưu phiên bản lịch đào tạo và đồng bộ các buổi học xuống máy chủ Backend.
- **Tác nhân (Actor)**: Class Admin, Training Operator.
- **Mô tả nghiệp vụ**:
  > Là một Class Admin,  
  > Tôi muốn lưu toàn bộ kế hoạch lịch vừa chỉnh sửa vào cơ sở dữ liệu kèm theo ghi chú lý do,  
  > Để lưu vết phiên bản và cập nhật dữ liệu buổi học chính thức cho lớp.

#### Tiêu chí nghiệm thu (Acceptance Criteria - AC):
- **AC1**: Người dùng nhấn nút **"Save Schedule"**. Nếu lịch có lỗi xung đột chưa được xử lý, hệ thống từ chối mở modal lưu và yêu cầu sửa lỗi.
- **AC2**: Nếu lịch hợp lệ (hoặc nếu ngày học sớm hơn ngày bắt đầu học, hệ thống tự động căn chỉnh mốc ngày trước khi xác nhận), hiển thị Modal **"Save Training Calendar"**:
  - Tiêu đề modal: `Save Training Calendar : [Class Code]`.
  - Ô nhập Ghi chú thay đổi (*Change Note / Reason*): Bắt buộc nhập, tối đa 255 ký tự, có bộ đếm ký tự.
- **AC3 (Xử lý đồng bộ dữ liệu - Persistence Execution)**:
  - Bước 1: Cập nhật thông tin phiên bản lịch (`ScheduleVersion`).
  - Bước 2: Chuyển đổi toàn bộ các hoạt động (`activities`) thành các đối tượng `SessionDTO` và gửi đồng bộ qua API `POST /api/sessions`.
    - Payload mỗi session: `classId`, `title: "[Code] ActivityName"`, `startTime`, `endTime`, `location`, `status: "SCHEDULED"`, `note`.
- **AC4**: Khi lưu thành công, đóng modal, hiển thị Toast thông báo:
  `"Đã lưu thành công lịch đào tạo cho lớp [Class Code] (X buổi học)!"`.
  Giao diện xóa bỏ cờ đánh dấu dữ liệu thay đổi (*dirty state = false*).

---

### 3.8. US-CAL-08: Xem thời khóa biểu tuần trực quan (Weekly Timetable Preview)

- **Mã User Story**: `US-CAL-08`
- **Tên chức năng**: Hiển thị thời khóa biểu đào tạo trực quan theo dạng lưới tuần với đa bộ lọc.
- **Tác nhân (Actor)**: Super Admin, Training Operator, Class Admin, Trainer, Trainee.
- **Mô tả nghiệp vụ**:
  > Là một học viên hoặc giảng viên,  
  > Tôi muốn xem thời khóa biểu các buổi học trong tuần theo từng ngày và ca học,  
  > Để nắm rõ lịch trình giảng dạy và học tập của mình.

#### Tiêu chí nghiệm thu (Acceptance Criteria - AC):
- **AC1 (Cấu trúc giao diện lưới tuần - Weekly Grid Layout)**:
  - Hiển thị 6 cột tương ứng từ Thứ Hai đến Thứ Bảy trong tuần làm việc.
  - Mỗi cột ngày hiển thị: Tên thứ, ngày/tháng (định dạng `DD/MM`), và tổng số buổi học trong ngày đó.
  - Cột ngày hiện tại (*Hôm nay*) được đánh dấu nổi bật với huy hiệu nhận diện.
- **AC2 (Thẻ hiển thị buổi học - Session Card Item)**:
  - Khung giờ buổi học: `07:00 - 09:15`, `09:30 - 11:45`, `13:00 - 17:00`,... kèm thời lượng (ví dụ: `2.3h`, `4h`).
  - Huy hiệu ca học: `Ca 1`, `Ca 2`.
  - Tiêu đề buổi học: Mã môn và tên nội dung đào tạo (ví dụ: `Java Core: OOP & Clean Architecture`).
  - Thông tin định danh: Tên lớp học, Trainer phụ trách, Phòng học/Địa điểm.
  - Huy hiệu trạng thái (*Status Badge*):
    - `Đã lên lịch` (*SCHEDULED*): Nền xanh dương nhạt.
    - `Đã hoàn thành` (*COMPLETED*): Nền xanh lá cây nhạt.
    - `Đã hủy` (*CANCELLED*): Nền đỏ nhạt.
- **AC3 (Bộ lọc & Điều hướng thời gian)**:
  - Điều hướng: Nút "Tuần trước", "Hôm nay", "Tuần sau" kèm dải ngày hiển thị (ví dụ: `11/05/2026 - 16/05/2026`).
  - Lọc theo Lớp học (*Filter by Class*): Dropdown danh sách tất cả các lớp học thực tế.
  - Lọc theo Trạng thái (*Filter by Status*): Tất cả trạng thái / Đã lên lịch / Đã hoàn thành / Đã hủy.
  - Tìm kiếm nhanh (*Search*): Tìm theo tiêu đề buổi học, phòng học, giảng viên.
  - Nút "Đặt lại bộ lọc": Khôi phục trạng thái tuần hiện tại và bỏ mọi bộ lọc.
- **AC4 (Modal Chi tiết buổi học - Session Detail Modal)**:
  - Khi click vào một thẻ buổi học bất kỳ, hiển thị Modal chi tiết bao gồm: ID buổi học, Trạng thái, Tiêu đề đầy đủ, Địa điểm/Phòng học, Thời gian bắt đầu/kết thúc (giờ Việt Nam), Lớp học, Giảng viên và Ghi chú phân công.
- **AC5 (Trạng thái rỗng - Empty State)**:
  - Nếu trong tuần không có buổi học nào khớp bộ lọc, hiển thị biểu tượng lịch mờ kèm thông báo thân thiện: *"Không có buổi học nào trong tuần này."*

---

## 4. Quy tắc nghiệp vụ & Xử lý lỗi (Business Rules & Application Messages)

### 4.1. Bảng quy tắc nghiệp vụ (Business Rules - BR)

| Mã quy tắc | Tên quy tắc nghiệp vụ | Chi tiết ràng buộc & Xử lý logic |
| :---: | :--- | :--- |
| **BR-CAL-01** | **Ràng buộc ngày bắt đầu học (Learning Start Rule)** | Ngày của tất cả các buổi học đào tạo ($Date_{session}$) phải lớn hơn hoặc bằng Ngày bắt đầu học thực tế của lớp (`Actual Learning Start Date`). Không được phép lên lịch buổi học trước ngày bắt đầu học. |
| **BR-CAL-02** | **Ràng buộc thứ tự ngày bắt đầu (Date Order Rule)** | Ngày bắt đầu học thực tế (`Actual Learning Start Date`) không được diễn ra trước Ngày khai giảng lớp học (`Class Start Date`). Logic: $Date_{learning\_start} \ge Date_{class\_start}$. |
| **BR-CAL-03** | **Tính bất biến của lịch đã Publish (Non-destructive Versioning)** | Một phiên bản lịch ở trạng thái `PUBLISHED` không được ghi đè trực tiếp. Khi có nhu cầu điều chỉnh lớn, hệ thống tự động nhân bản thành phiên bản `DRAFT` mới ($v+1$) để chỉnh sửa, phiên bản cũ được giữ nguyên để phục vụ kiểm toán (Audit Trail). |
| **BR-CAL-04** | **Quy tắc bỏ qua ngày nghỉ cuối tuần (Skip Weekends Rule)** | Khi tự động sinh lịch (*Auto-split by Duration*), nếu ngày tiếp theo rơi vào Thứ Bảy (DayOfWeek = 6) hoặc Chủ Nhật (DayOfWeek = 0), hệ thống tự động cộng dồn ngày chuyển sang Thứ Hai tuần tiếp theo. |
| **BR-CAL-05** | **Ràng buộc giờ học trong ngày (Session Time Slot Rule)** | Giờ kết thúc buổi học ($Time_{end}$) bắt buộc phải lớn hơn Giờ bắt đầu ($Time_{start}$). Khoảng cách tối thiểu của một buổi học là 30 phút, tối đa không quá 8 giờ/buổi. |
| **BR-CAL-06** | **Chống trùng tài nguyên Giảng viên (Trainer Conflict Prevention)** | Một Giảng viên (Trainer) không thể đồng thời chủ trì 2 buổi học khác nhau trong cùng một khoảng ngày và giờ trùng lặp. |
| **BR-CAL-07** | **Chống trùng tài nguyên Phòng học (Room Conflict Prevention)** | Một Phòng học vật lý (Physical Room/Lab) không thể được phân bổ cho 2 lớp học khác nhau trong cùng một thời điểm. Phòng Online (Zoom/Teams) không bị giới hạn phòng vật lý nhưng cần tài khoản bản quyền riêng. |
| **BR-CAL-08** | **Định dạng và giới hạn mã môn học (Subject Code Constraint)** | Mã môn học chỉ gồm chữ cái viết hoa tiếng Anh không dấu, chữ số từ 0-9, dấu gạch dưới `_`, gạch ngang `-`, ngoặc vuông `[]`. Độ dài tối đa 30 ký tự. |
| **BR-CAL-09** | **Bắt buộc nhập lý do thay đổi (Change Note Requirement)** | Mọi thao tác lưu phiên bản lịch đào tạo bắt buộc phải có Ghi chú thay đổi (`Change Note`), độ dài tối đa 255 ký tự, mô tả tóm tắt lý do điều chỉnh lịch. |
| **BR-CAL-10** | **Quyền Admin truy cập toàn diện (Admin Super-Access Rule)** | Người dùng có vai trò `ADMIN` hoặc đang ở chế độ xem quản trị (*Admin View*) luôn có toàn quyền truy cập toàn bộ menu và phân hệ điều chỉnh lịch, không bị ẩn do lệch phân quyền tạm thời ở bộ nhớ đệm trình duyệt. |

---

### 4.2. Bảng mã thông báo & Lỗi ứng dụng (Application Messages - EM)

| Mã lỗi (Code) | Loại (Type) | Nội dung thông báo hiển thị (Message Text) | Hướng xử lý của hệ thống / Người dùng |
| :---: | :---: | :--- | :--- |
| **EM-CAL-01** | Warning | *"Chưa có môn học nào trong hệ thống. Vui lòng tạo môn học trong mục Quản lý môn học trước."* | Thông báo khi nhấn "Load All Topics" nhưng cơ sở dữ liệu rỗng. Điều hướng sang Quản lý môn học. |
| **EM-CAL-02** | Error | *"[Mã môn]: Ngày học (YYYY-MM-DD) không được diễn ra trước Ngày bắt đầu học thực tế (YYYY-MM-DD)."* | Chặn lưu lịch. Hiển thị nút bấm 1-click để đồng bộ ngày bắt đầu học về ngày sớm nhất. |
| **EM-CAL-03** | Error | *"Ngày bắt đầu học thực tế không được trước ngày khai giảng lớp học."* | Yêu cầu người dùng chỉnh lại ngày bắt đầu học trong ô Date Picker. |
| **EM-CAL-04** | Error | *"Chương trình đào tạo phải có ít nhất một môn học."* | Ngăn chặn việc lưu phiên bản lịch rỗng không có môn học nào. |
| **EM-CAL-05** | Error | *"Mỗi môn học phải có đầy đủ mã môn và tên môn hợp lệ."* | Yêu cầu điền đủ thông tin các trường bắt buộc có gắn dấu sao (*). |
| **EM-CAL-06** | Error | *"Giờ kết thúc buổi học phải diễn ra sau giờ bắt đầu."* | Báo đỏ trường thời gian kết thúc của hoạt động tương ứng. |
| **EM-CAL-07** | Error | *"Vui lòng nhập ghi chú thay đổi để giải thích việc điều chỉnh phiên bản lịch này."* | Báo lỗi khi người dùng nhấn Xác nhận lưu mà để trống ô Change Note. |
| **EM-CAL-08** | Success | *"Đã lưu thành công lịch đào tạo cho lớp [Mã lớp] ([X] buổi học)!"* | Hiển thị Toast thông báo màu xanh lá sau khi đồng bộ dữ liệu buổi học thành công. |
| **EM-CAL-09** | Success | *"Đã tự động chia [X] buổi học cho môn [Mã môn] ([Y] giờ)!"* | Thông báo sau khi hoàn thành tính năng Auto-split by Duration. |
| **EM-CAL-10** | Error | *"Phát hiện xung đột lịch: Giảng viên hoặc phòng học bị trùng lặp."* | Liệt kê chi tiết tên giảng viên/phòng bị trùng khung giờ để người dùng đổi lại. |
| **EM-CAL-11** | Error | *"Không thể kết nối máy chủ backend. Vui lòng kiểm tra lại dịch vụ mạng."* | Thông báo khi kết nối mạng hoặc server Spring Boot gặp sự cố kết nối. |
| **EM-CAL-12** | Info | *"Đã tự động đồng bộ ngày bắt đầu học thành [YYYY-MM-DD]!"* | Thông báo xác nhận sau khi nhấn nút 1-click đồng bộ mốc ngày. |

---

## 5. Quy chuẩn kiểm soát giao diện dùng chung (Common Field Controls & UI/UX Standards)

Tuân thủ nghiêm ngặt các quy chuẩn kiểm soát giao diện (Section 5 của tài liệu FAMS FPT Academy):

1. **Kiểm soát trường nhập tự do (Free Text Input)**:
   - Tất cả các trường văn bản một dòng (*Single-line text*) đều có quy định giới hạn độ dài tối đa (`maxLength`):
     - Mã môn học (*Subject Code*): Tối đa **30 ký tự**.
     - Tên môn học (*Subject Name*): Tối đa **100 ký tự**.
     - Tiêu đề ngày học & Tên hoạt động (*Day Name & Activity Name*): Tối đa **100 ký tự**.
     - Ghi chú thay đổi (*Change Note*): Tối đa **255 ký tự**.
     - Từ khóa tìm kiếm (*Search Input*): Tối đa **100 ký tự**.
   - Khi người dùng nhập chạm giới hạn tối đa, ô nhập liệu không nhận thêm ký tự và hiển thị bộ đếm ký tự rõ ràng.
2. **Kiểm soát chọn lựa (Option Set / Dropdown Menu)**:
   - Dropdown phòng học, giảng viên, trạng thái tự động sắp xếp theo thứ tự bảng chữ cái hoặc danh mục hoạt động.
   - Khi chưa chọn giá trị, hiển thị placeholder rõ ràng: *"Chọn giảng viên..."*, *"Chọn phòng học..."*.
3. **Bộ chọn ngày tháng (Date Picker)**:
   - Hiển thị theo định dạng chuẩn quốc tế và Việt Nam: `YYYY-MM-DD` cho lưu trữ và `DD/MM/YYYY` cho hiển thị người dùng.
   - Cho phép chọn nhanh ngày hiện tại (*Today*) và điều hướng lịch trực quan.
4. **Quy chuẩn thông báo & Hộp thoại (Dialogs & Confirmation Popups)**:
   - Các hành động mang tính chất thay đổi lớn hoặc xóa dữ liệu (*Destructive Actions*) như xóa môn học, xóa buổi học bắt buộc phải có Dialog xác nhận nêu rõ hậu quả.
   - Hộp thoại luôn có nút dấu `X` ở góc trên bên phải, nút `Hủy (Cancel)` và nút xác nhận với màu sắc tương ứng (nút Xóa dùng màu đỏ `destructive`, nút Lưu dùng màu đen/xanh thương hiệu `primary`).
5. **Quy chuẩn Trạng thái giao diện (Interface States)**:
   - **Loading State**: Hiển thị spinner hoặc khung xương (*Skeleton Loader*), làm mờ và vô hiệu hóa các nút ghi dữ liệu để tránh gửi trùng lặp (*duplicate submission*).
   - **Empty State**: Khi một tuần không có buổi học hoặc một lớp chưa có lịch đào tạo, hiển thị thông điệp rỗng kèm nút hành động gợi ý (*Call To Action - CTA*).
   - **Error Banner**: Hiển thị cạnh trường bị lỗi hoặc ở đầu danh sách nội dung với nền đỏ nhạt và chữ đỏ đậm tương phản cao.

---

## 6. Yêu cầu phi chức năng (Non-Functional Requirements - NFR)

| Mã NFR | Tiêu chí (Attribute) | Yêu cầu kỹ thuật chi tiết | Phương pháp kiểm chứng |
| :---: | :--- | :--- | :--- |
| **NFR-PERF-01** | **Hiệu năng hiển thị (Performance)** | Thời gian render bảng thời khóa biểu tuần và danh sách môn học dưới **1.0 giây** với quy mô lớp lên đến 100 buổi học. | Kiểm thử đo thời gian bằng Google Lighthouse & Chrome DevTools Performance. |
| **NFR-PERF-02** | **Tốc độ tính toán (Algorithm Speed)** | Thuật toán tự động chia buổi học (*Auto-split by Duration*) xử lý hoàn tất dưới **50 mili-giây** ngay trên trình duyệt client. | Đo lường bằng `console.time()` trong Unit Test. |
| **NFR-SEC-01** | **Bảo mật truy cập (Access Control)** | Tất cả các yêu cầu đọc và ghi lịch đào tạo đều được bảo vệ bằng JWT Token qua Header `Authorization: Bearer <token>`. Phân quyền nghiêm ngặt theo RBAC. | Kiểm tra gọi API không kèm token trả mã lỗi `401 Unauthorized` hoặc `403 Forbidden`. |
| **NFR-SEC-02** | **Xác thực dữ liệu (Data Sanitization)** | Mọi dữ liệu mã môn, tên môn và ghi chú được làm sạch (sanitize), ngăn chặn triệt để tấn công XSS (Cross-Site Scripting) và SQL Injection. | Kiểm tra nhập chuỗi chứa mã HTML/JavaScript `<script>alert(1)</script>`. |
| **NFR-REL-01** | **Toàn vẹn giao dịch (Atomic Reliability)** | Quá trình lưu lịch đào tạo gồm nhiều buổi học được thực hiện đảm bảo tính toàn vẹn: nếu xảy ra lỗi mạng giữa chừng, hệ thống thông báo rõ ràng từng buổi bị lỗi. | Kiểm thử mô phỏng ngắt kết nối mạng bất thường. |
| **NFR-USA-01** | **Tính khả dụng (Usability & UX)** | Giao diện trực quan, rõ ràng, hỗ trợ đầy đủ các trạng thái Loading, Empty, Validation Error và Success Toast. Không sử dụng màu sắc làm chỉ báo duy nhất. | Đánh giá theo bộ tiêu chuẩn WCAG 2.1 AA. |
| **NFR-COMP-01** | **Độ tương thích (Compatibility)** | Hoạt động mượt mà và hiển thị đồng nhất trên các trình duyệt: Google Chrome, Microsoft Edge, Cốc Cốc, Firefox phiên bản mới nhất ở độ phân giải từ 1280px trở lên. | Kiểm thử thực tế trên các trình duyệt mục tiêu. |

---

## 7. Đặc tả hợp đồng API (REST API Contract)

### 7.1. Danh mục API sử dụng trong phân hệ Lịch đào tạo

| Method | Endpoint URI | Mô tả chức năng | Quyền yêu cầu (Permission) |
| :---: | :--- | :--- | :---: |
| `GET` | `/api/calendar/sessions` | Lấy danh sách các buổi học phục vụ hiển thị Thời khóa biểu tuần theo khoảng thời gian và lớp học. | `SESSION_READ` |
| `GET` | `/api/classes/active` | Lấy danh sách tất cả các lớp học đang hoạt động để đưa vào bộ lọc. | `CLASS_READ` |
| `GET` | `/api/subjects/active` | Lấy danh sách danh mục các môn học chuẩn đang kích hoạt trong hệ thống. | `SUBJECT_READ` |
| `GET` | `/api/trainers/active` | Lấy danh sách các giảng viên (Trainer) đang hoạt động để phân công giảng dạy. | `USER_READ` |
| `GET` | `/api/rooms` | Lấy danh sách các phòng học, phòng lab vật lý trong cơ sở. | `CLASS_READ` |
| `POST` | `/api/schedule-versions` | Tạo mới hoặc cập nhật một phiên bản lịch đào tạo cho lớp. | `SCHEDULE_VERSION_CREATE` |
| `POST` | `/api/sessions` | Lưu mới một buổi học đào tạo cụ thể vào cơ sở dữ liệu. | `SESSION_CREATE` |
| `PUT` | `/api/sessions/{id}` | Cập nhật thông tin chi tiết hoặc trạng thái của một buổi học (`SCHEDULED` $\rightarrow$ `COMPLETED`). | `SESSION_UPDATE` |

### 7.2. Cấu trúc Payload mẫu

#### Request Payload lưu buổi học (`POST /api/sessions`):
```json
{
  "classId": 1,
  "title": "[JAVA_CORE] OOP Fundamentals & Clean Architecture",
  "startTime": "2026-10-01T08:00:00",
  "endTime": "2026-10-01T10:30:00",
  "location": "Phòng Lab 201 (F-Town 2)",
  "status": "SCHEDULED",
  "note": "PIC: Nguyễn Ngọc Tân (Trainer) · Lecture"
}
```

#### Response Payload lấy danh sách buổi học tuần (`GET /api/calendar/sessions`):
```json
{
  "content": [
    {
      "id": 101,
      "classId": 1,
      "topicId": 5,
      "trainerId": 2,
      "title": "[JAVA_CORE] OOP Fundamentals & Clean Architecture",
      "startTime": "2026-10-01T08:00:00",
      "endTime": "2026-10-01T10:30:00",
      "location": "Phòng Lab 201 (F-Town 2)",
      "status": "SCHEDULED",
      "note": "PIC: Nguyễn Ngọc Tân (Trainer) · Lecture"
    }
  ],
  "totalElements": 1,
  "totalPages": 1
}
```

---

## 8. Tiêu chí nghiệm thu & Luồng vàng (Acceptance Test Scenarios & Definition of Done)

### 8.1. Kịch bản kiểm thử luồng vàng (Golden Path Test Scenarios)

| Mã kịch bản | Tên kịch bản kiểm thử | Các bước thực hiện (Test Steps) | Kết quả kỳ vọng (Expected Result) |
| :---: | :--- | :--- | :--- |
| **AT-CAL-01** | **Khởi tạo lịch từ môn học chuẩn** | 1. Mở màn hình Adjust Calendar.<br>2. Chọn lớp học `HCM26_FR_FU_KS_JAVA_01`.<br>3. Nhấn nút "Load All Topics". | Danh sách môn học được nạp đầy đủ. Các ngày học được tính toán bắt đầu từ ngày bắt đầu học thực tế của lớp và tự động bỏ qua T7, CN. |
| **AT-CAL-02** | **Thêm môn học tùy chỉnh & Validate** | 1. Nhấn nút "+ Add Topic".<br>2. Nhập mã môn `REACT_TEST`, tên môn, tổng thời lượng `20` giờ, thời lượng buổi `2.5` giờ.<br>3. Nhấn "Thêm môn". | Hệ thống tự động chia thành 8 buổi học (20 / 2.5 = 8). Thẻ môn học mới xuất hiện ở cuối danh sách. |
| **AT-CAL-03** | **Tự động chia lại buổi (Auto-split)** | 1. Trên thẻ môn học, nhấn "✨ Chia theo Duration".<br>2. Đổi thời lượng 1 buổi thành `4.0` giờ.<br>3. Nhấn "Áp dụng chia buổi". | Hệ thống tính lại thành 5 buổi học (20 / 4 = 5). Ngày học được dàn lại tự động. |
| **AT-CAL-04** | **Bắt lỗi ngày học trước ngày bắt đầu học** | 1. Chỉnh ngày của một buổi học về trước ngày `Actual Learning Start Date`.<br>2. Nhấn "Save Schedule". | Hệ thống chặn lưu, hiển thị dải thông báo lỗi màu đỏ kèm nút bấm "Đồng bộ ngày bắt đầu học". |
| **AT-CAL-05** | **1-click Đồng bộ mốc ngày học** | 1. Nhấn vào nút "Đồng bộ ngày bắt đầu học" trên banner lỗi. | Mốc ngày bắt đầu học của lớp tự động cập nhật khớp với buổi học sớm nhất. Thông báo lỗi biến mất, giao diện trở về trạng thái hợp lệ. |
| **AT-CAL-06** | **Lưu phiên bản lịch xuống máy chủ** | 1. Nhấn "Save Schedule".<br>2. Nhập ghi chú thay đổi "Điều chỉnh kế hoạch học tập kỳ 1".<br>3. Nhấn "Confirm & Save". | Hệ thống lưu phiên bản thành công, gửi danh sách buổi học xuống backend và hiển thị Toast thông báo màu xanh. |
| **AT-CAL-07** | **Kiểm tra hiển thị bên Thời khóa biểu tuần** | 1. Điều hướng sang tab "Timetable".<br>2. Chọn lớp học vừa lưu lịch.<br>3. Điều hướng đến tuần có lịch học. | Toàn bộ các buổi học hiển thị trực quan theo đúng ngày trong tuần (Thứ Hai - Thứ Bảy), đúng ca học, tên môn, giảng viên và phòng học. |

### 8.2. Tiêu chuẩn hoàn thành (Definition of Done - DoD)
- [x] Toàn bộ các yêu cầu chức năng mức **P0** (US-CAL-01 đến US-CAL-08) được triển khai đầy đủ cả Frontend và Backend.
- [x] Đã loại bỏ 100% dữ liệu mẫu/mock tĩnh; hệ thống kết nối trực tiếp với API thật.
- [x] Áp dụng đầy đủ giới hạn ký tự (`maxLength`), định dạng chữ hoa và kiểm soát nhập liệu cho tất cả các trường.
- [x] Không còn lỗi vi phạm logic ngày tháng (`Training date cannot be before actual learning start`).
- [x] Menu điều hướng bên trái (*Sidebar Navigation*) đảm bảo hiển thị đầy đủ và ổn định cho tài khoản Quản trị viên (`ADMIN`).
- [x] Kiểm thử build TypeScript (`npx tsc -b`) đạt **0 lỗi** biên dịch.
- [x] Mã nguồn được chuẩn hóa, ghi log có cấu trúc và sẵn sàng cho việc nghiệm thu đồ án.

---
*(Tài liệu này được biên soạn bởi Nguyễn Ngọc Tân dựa trên các tiêu chuẩn SRS Mock Project FAMS & IEEE 830).*

