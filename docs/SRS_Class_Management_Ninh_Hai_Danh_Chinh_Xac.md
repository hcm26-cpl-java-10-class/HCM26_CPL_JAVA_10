# BÁO CÁO ĐẶC TẢ YÊU CẦU PHẦN MỀM (SRS)
## PHÂN HỆ: QUẢN LÝ LỚP HỌC (CLASS MANAGEMENT MODULE)
### BẢN CHUẨN XÁC ĐỐI CHIẾU SOURCE CODE & PHÂN ĐỊNH PHẠM VI CÁ NHÂN NINH HẢI DANH

---

- **Sinh viên thực hiện:** **NINH HẢI DANH** (MSSV: **SE196647**)
- **Nhóm đồ án:** `HCM26_CPL_JAVA_10-feature-training-management`
- **Giảng viên hướng dẫn:** **Cô Trần Thị Tố Nga (Ngattt82)**
- **Phân hệ phụ trách:** **Class Management**
- **Phiên bản tài liệu:** Version 1.0 (Bản chuẩn xác nghiệm thu đối chiếu source)
- **Ngày hoàn thành:** 23/11/2026

---

## MỤC LỤC CHI TIẾT
1. [Chương 1: Tổng quan phân hệ và Ma trận phân định phạm vi cá nhân](#chương-1-tổng-quan-phân-hệ-và-ma-trận-phân-định-phạm-vi-cá-nhân)
2. [Chương 2: Kiến trúc hệ thống và Ma trận phân quyền (RBAC)](#chương-2-kiến-trúc-hệ-thống-và-ma-trận-phân-quyền-rbac)
3. [Chương 3: Mô hình dữ liệu và Cấu trúc thực thể Backend](#chương-3-mô-hình-dữ-liệu-và-cấu-trúc-thực-thể-backend)
4. [Chương 4: Danh mục Use Case cá nhân Ninh Hải Danh (19 Use Cases)](#chương-4-danh-mục-use-case-cá-nhân-ninh-hải-danh-19-use-cases)
5. [Chương 5: Đặc tả chi tiết 19 Use Cases chuẩn 10 mục](#chương-5-đặc-tả-chi-tiết-19-use-cases-chuẩn-10-mục)
   - [5.1. Nhóm 1: Hồ sơ lớp học, Vòng đời & Tiện ích (UC-01 đến UC-15)](#51-nhóm-1-hồ-sơ-lớp-học-vòng-đời--tiện-ích-core-class-management)
   - [5.2. Nhóm 2: Thiết lập chương trình & Phân công giảng dạy (UC-16 đến UC-19)](#52-nhóm-2-thiết-lập-chương-trình-đào-tạo--phân-công-giảng-viên-class-setup-integration)
6. [Chương 6: Báo cáo đối soát và Kết luận nghiệm thu](#chương-6-báo-cáo-đối-soát-và-kết-luận-nghiệm-thu)

---

# CHƯƠNG 1: TỔNG QUAN PHÂN HỆ VÀ MA TRẬN PHÂN ĐỊNH PHẠM VI CÁ NHÂN

### 1.1. Ma trận đối chiếu ứng viên chức năng và phân loại phạm vi cá nhân

| Nhóm chức năng | Hành vi nghiệp vụ | Endpoint REST API | Frontend Component | Phân loại phạm vi | Bằng chứng Git / Mã nguồn |
| :--- | :--- | :--- | :--- | :---: | :--- |
| **Class List** | Xem danh sách, tìm kiếm và lọc lớp | `GET /api/classes` | `ClassListPage.tsx` | **VERIFIED OWNERSHIP** | Commit `9f7bfe4a`, `1b17bcfc` (Ninh Hải Danh) |
| **Class Detail** | Xem thông tin chi tiết lớp học | `GET /api/classes/{id}` | `ClassDetailPage.tsx`, `ClassInfoTab.tsx` | **VERIFIED OWNERSHIP** | Commit `9f7bfe4a`, `5e74dd65` (Ninh Hải Danh) |
| **Class CRUD** | Tạo mới lớp học đào tạo | `POST /api/classes` | `ClassModal.tsx` | **VERIFIED OWNERSHIP** | Commit `9f7bfe4a`, `6f93c2e9` (Ninh Hải Danh) |
| **Class CRUD** | Cập nhật thông tin hành chính lớp | `PUT /api/classes/{id}` | `ClassModal.tsx` | **VERIFIED OWNERSHIP** | Commit `9f7bfe4a`, `5e74dd65` (Ninh Hải Danh) |
| **Class Lifecycle** | Chuyển trạng thái lớp sang Assigned | `PUT /api/classes/{id}` | `ClassLifecyclePanel.tsx` | **VERIFIED OWNERSHIP** | `TrainingClassService` lines 23-28 |
| **Class Lifecycle** | Đưa lớp Assigned về Planning | `PUT /api/classes/{id}` | `ClassLifecyclePanel.tsx` | **VERIFIED OWNERSHIP** | `TrainingClassService` lines 23-28 |
| **Class Lifecycle** | Bắt đầu lớp học (Active) | `PUT /api/classes/{id}` | `ClassLifecyclePanel.tsx` | **VERIFIED OWNERSHIP** | `TrainingClassService` lines 23-28 |
| **Class Lifecycle** | Đánh dấu hoàn thành đào tạo (Completed) | `PUT /api/classes/{id}` | `ClassLifecyclePanel.tsx` | **VERIFIED OWNERSHIP** | `TrainingClassService` lines 23-28 |
| **Class Lifecycle** | Đóng lớp đã hoàn thành (Closed) | `PUT /api/classes/{id}` | Chưa có nút thao tác UI | **BACKEND-ONLY** | `TrainingClassService` lines 27-28 |
| **Class Lifecycle** | Hủy lớp học (Cancelled) | `PUT /api/classes/{id}` | `ClassLifecyclePanel.tsx` | **VERIFIED OWNERSHIP** | `TrainingClassService` lines 23-28 |
| **Class Lifecycle** | Ngừng sử dụng lớp (Deactivate / Soft delete) | `DELETE /api/classes/{id}` | `ClassListPage.tsx` nút Deactivate | **VERIFIED OWNERSHIP** | `TrainingClassService.deactivate()` |
| **Class Excel** | Nhập danh sách lớp từ Excel | `POST /api/classes/import` | `ClassImportModal.tsx` | **VERIFIED OWNERSHIP** | Commit `9f7bfe4a`, `69a7a8de` (Ninh Hải Danh) |
| **Class Excel** | Xuất danh sách lớp ra Excel | `GET /api/classes` (all) | `ClassListPage.tsx` nút Export | **VERIFIED OWNERSHIP** | Commit `9f7bfe4a`, `class-import.utils.ts` |
| **Class KPI** | Xem thống kê tổng quan lớp học | `GET /api/classes/stats` | `ClassKpiCards.tsx` | **VERIFIED OWNERSHIP** | `ClassStatisticsService`, Commit `1b17bcfc` |
| **Class Readiness** | Kiểm tra mức độ sẵn sàng khai giảng | `GET /api/classes/{id}/readiness` | `ClassReadinessPanel.tsx` | **VERIFIED OWNERSHIP** | `ClassReadinessService`, Commit `1b17bcfc`, `5800e8ca` |
| **Class Setup** | Xem cấu hình, liên kết program & phân công MAIN | `GET/PUT/POST /api/classes/{id}/setup...` | `ClassSetupForm.tsx` | **SHARED / INTEGRATION** | `ClassSetupController`, Commit `5800e8ca`, `6f93c2e9` |
| **Class Trainees** | Quản lý học viên, import Excel học viên | `GET/POST /api/classes/{id}/trainees...` | `TraineeListTab.tsx`, `TraineeModal` | **OUT OF SCOPE** | **Thanh Tú** phụ trách chính (`mnitu333@gmail.com`) |
| **Class Calendar** | Lịch học, điều phối thời khóa biểu tuần | `GET/POST /api/classes/{id}/calendars...` | `ClassCalendarTab.tsx` | **OUT OF SCOPE** | **Huỳnh Hữu Thắng & Nguyễn Ngọc Tân** phụ trách |
| **Budget & Activities** | Ngân sách vận hành & Nhật ký lớp | `GET/POST /api/external/classes/{id}...` | `ClassBudgetTab.tsx`, `ClassActivitiesTab` | **OUT OF SCOPE** | **Đặng Thành Phát** phụ trách chính |

---

# CHƯƠNG 4: DANH MỤC USE CASE CÁ NHÂN NINH HẢI DANH (19 USE CASES)

| Mã UC | Mục | Tên Use Case cá nhân | Endpoint REST API | Frontend Component | Phân loại phạm vi |
| :---: | :---: | :--- | :--- | :--- | :---: |
| **UC-01** | 5.1.1 | Tìm kiếm và lọc danh sách lớp (Ninh Hải Danh) | `GET /api/classes` | `ClassListPage.tsx` | VERIFIED OWNERSHIP |
| **UC-02** | 5.1.2 | Xem chi tiết lớp (Ninh Hải Danh) | `GET /api/classes/{id}` | `ClassDetailPage.tsx` | VERIFIED OWNERSHIP |
| **UC-03** | 5.1.3 | Tạo lớp học (Ninh Hải Danh) | `POST /api/classes` | `ClassModal.tsx` | VERIFIED OWNERSHIP |
| **UC-04** | 5.1.4 | Cập nhật thông tin lớp (Ninh Hải Danh) | `PUT /api/classes/{id}` | `ClassModal.tsx` | VERIFIED OWNERSHIP |
| **UC-05** | 5.1.5 | Chuyển lớp sang Assigned (Ninh Hải Danh) | `PUT /api/classes/{id}` | `ClassLifecyclePanel.tsx` | VERIFIED OWNERSHIP |
| **UC-06** | 5.1.6 | Đưa lớp Assigned về Planning (Ninh Hải Danh) | `PUT /api/classes/{id}` | `ClassLifecyclePanel.tsx` | VERIFIED OWNERSHIP |
| **UC-07** | 5.1.7 | Bắt đầu lớp học (Ninh Hải Danh) | `PUT /api/classes/{id}` | `ClassLifecyclePanel.tsx` | VERIFIED OWNERSHIP |
| **UC-08** | 5.1.8 | Đánh dấu hoàn thành đào tạo (Ninh Hải Danh) | `PUT /api/classes/{id}` | `ClassLifecyclePanel.tsx` | VERIFIED OWNERSHIP |
| **UC-09** | 5.1.9 | Đóng lớp đã hoàn thành (Ninh Hải Danh) | `PUT /api/classes/{id}` | Chưa có nút UI | **BACKEND-ONLY** |
| **UC-10** | 5.1.10 | Hủy lớp học (Ninh Hải Danh) | `PUT /api/classes/{id}` | `ClassLifecyclePanel.tsx` | VERIFIED OWNERSHIP |
| **UC-11** | 5.1.11 | Ngừng sử dụng lớp (Ninh Hải Danh) | `DELETE /api/classes/{id}` | `ClassListPage.tsx` nút Deactivate | VERIFIED OWNERSHIP |
| **UC-12** | 5.1.12 | Nhập danh sách lớp từ Excel (Ninh Hải Danh) | `POST /api/classes/import` | `ClassImportModal.tsx` | VERIFIED OWNERSHIP |
| **UC-13** | 5.1.13 | Xuất danh sách lớp ra Excel (Ninh Hải Danh) | `GET /api/classes` (all) | `ClassListPage.tsx` nút Export | VERIFIED OWNERSHIP |
| **UC-14** | 5.1.14 | Xem chỉ số tổng quan lớp (Ninh Hải Danh) | `GET /api/classes/stats` | `ClassKpiCards.tsx` | VERIFIED OWNERSHIP |
| **UC-15** | 5.1.15 | Kiểm tra mức độ sẵn sàng của lớp (Ninh Hải Danh) | `GET /api/classes/{id}/readiness` | `ClassReadinessPanel.tsx` | VERIFIED OWNERSHIP |
| **UC-16** | 5.2.1 | Xem cấu hình Class Setup (Ninh Hải Danh) | `GET /api/classes/{classId}/setup` | `ClassSetupForm.tsx` | SHARED / INTEGRATION |
| **UC-17** | 5.2.2 | Liên kết chương trình đào tạo cho lớp (Ninh Hải Danh) | `PUT /api/classes/{classId}/program-link` | `ClassSetupForm.tsx` | SHARED / INTEGRATION |
| **UC-18** | 5.2.3 | Tạo phân công MAIN Trainer cho lớp (Ninh Hải Danh) | `POST /api/classes/{classId}/teaching-assignments` | `ClassSetupForm.tsx` | SHARED / INTEGRATION |
| **UC-19** | 5.2.4 | Cập nhật phân công MAIN Trainer (Ninh Hải Danh) | `PUT /api/classes/{classId}/teaching-assignments/{id}` | `ClassSetupForm.tsx` | SHARED / INTEGRATION |

---
*(Xem chi tiết đầy đủ 10 mục con cho từng Use Case tại file Word `SRS_Class_Management_Ninh_Hai_Danh_Chinh_Xac.docx`)*
