SOFTWARE REQUIREMENTS SPECIFICATION

HỆ THỐNG QUẢN LÝ ĐÀO TẠO, HỌC TẬP
VÀ MOCK PROJECT HỢP NHẤT

SRS triển khai thực tế - đầy đủ yêu cầu chức năng, dữ liệu, tích hợp, kiểm thử và thiết kế 97 màn hình


|Baseline: Hợp nhất FAMS & LMS v2 và MockProject Hub v1.2. Tài liệu là đầu vào chung cho Product Owner, BA, Solution Architect, UX/UI, Development, QA/UAT và vận hành.|

|---|




|Thuộc tính|Giá trị|

|---|---|

|Mã tài liệu|SRS-UNI-FAMS-LMS-MPH-002|

|Phiên bản|2.0 - Implementation Baseline|

|Ngày|27/08/2026|

|Trạng thái|Draft for Product/Architecture/UI review|

|Phạm vi|108 yêu cầu chức năng; 11 phân hệ; 97 thiết kế màn hình|

|Nguồn|FAMS_LMS_Complete_SRS_v2_With_UI_Designs.docx; SRS_MockProject_Hub_v1.2_Large_Screens.docx|




# Kiểm soát tài liệu


|Phiên bản|Ngày|Người/nhóm|Nội dung|Trạng thái|

|---|---|---|---|---|

|1.0|27/08/2026|BA/Product|Hợp nhất danh mục chức năng từ hai SRS nguồn|Superseded|

|2.0|27/08/2026|BA/Product/Architecture/UI|Bổ sung đặc tả triển khai, dữ liệu, tích hợp, AC và 97 thiết kế màn hình|Draft for review|




## Phê duyệt baseline


|Vai trò|Họ tên|Quyết định|Ngày|Chữ ký/Ghi chú|

|---|---|---|---|---|

|Product Owner||Approve / Reject|||

|Business Owner||Approve / Reject|||

|Solution Architect||Approve / Reject|||

|UX/UI Lead||Approve / Reject|||

|QA Lead||Approve / Reject|||




# Mục lục


|Chương|Nội dung|

|---|---|

|1|Giới thiệu|

|2|Bối cảnh hệ thống và tác nhân|

|3|Kiến trúc chức năng và thông tin|

|4|Danh mục yêu cầu chức năng|

|5|Đặc tả yêu cầu chức năng chi tiết|

|6|Quy tắc nghiệp vụ hợp nhất|

|7|Yêu cầu dữ liệu|

|8|Tích hợp và hợp đồng API|

|9|Yêu cầu phi chức năng|

|10|Chiến lược kiểm thử và nghiệm thu|

|11|Quy chuẩn UX/UI và quản trị màn hình|

|12|Phụ lục thiết kế 97 màn hình|

|13|Truy vết và quản trị thay đổi|

|14|Quyết định cần Product Owner xác nhận|

|Quy ước: Mã UFR là yêu cầu chức năng hợp nhất; SCR là màn hình FAMS/LMS; UI-* là màn hình MockProject Hub; BR là quy tắc nghiệp vụ; NFR là yêu cầu phi chức năng.|Quy ước: Mã UFR là yêu cầu chức năng hợp nhất; SCR là màn hình FAMS/LMS; UI-* là màn hình MockProject Hub; BR là quy tắc nghiệp vụ; NFR là yêu cầu phi chức năng.|




# 1. Giới thiệu


## 1.1 Mục đích

Tài liệu đặc tả hành vi quan sát được của nền tảng hợp nhất quản lý đào tạo, vận hành lớp, LMS, assessment, điểm/chứng nhận và Mock Project. Mục tiêu là cung cấp baseline đủ chi tiết để thiết kế kiến trúc, phân rã backlog, thiết kế API/database, triển khai frontend/backend và lập test case/UAT.


## 1.2 Phạm vi

Quản trị tenant, người dùng, vai trò, quyền, menu/menu item, danh mục nền tảng và audit.

Curriculum, topic, course, training program, nhu cầu mở lớp, lớp, lịch, học viên, điểm danh và bảo lưu.

LMS catalog/enrollment/player/progress, assessment/quiz/coding/grading, gradebook, certificate và reporting.

Mock Project template, team, sprint/task, milestone, artifact, review, interview, feedback và portfolio.

Notification/email, export, API/webhook và các yêu cầu bảo mật, hiệu năng, accessibility, quan sát hệ thống.


## 1.3 Ngoài phạm vi baseline


|Hạng mục|Ghi chú|

|---|---|

|Thanh toán học phí|Không có yêu cầu nguồn; tích hợp sau khi có Product Requirement riêng.|

|Video conference native|Baseline chỉ lưu URL/phòng họp và metadata của provider ngoài.|

|Proctoring xâm nhập|Chỉ dùng tín hiệu hỗ trợ review; không tự động kết luận gian lận.|

|Mobile native|Thiết kế responsive web; ứng dụng native là roadmap riêng.|

|AI quyết định tự động|AI chỉ gợi ý outline/preview; người có thẩm quyền phải review và xác nhận.|




## 1.4 Đối tượng sử dụng

Product Owner/Business Owner phê duyệt phạm vi; BA quản trị yêu cầu; Architect thiết kế giải pháp; UX/UI duy trì design system; Dev triển khai; QA/UAT kiểm thử; Security/Ops đánh giá vận hành.


# 2. Bối cảnh hệ thống và tác nhân


|Tác nhân|Trách nhiệm|Data scope mặc định|

|---|---|---|

|Super Admin|Quản trị toàn cục: user, role, permission, menu/module, danh mục nền tảng, cấu hình và audit.|Toàn hệ thống hoặc tenant được giao|

|School Admin|Quản trị tenant/trường, người dùng, chính sách, tích hợp và phạm vi dữ liệu của trường.|Tenant/trường|

|Program Manager|Thiết kế curriculum/program, cohort, course/class, phê duyệt nội dung và báo cáo chương trình.|Department/program/cohort|

|Department Manager|Khởi tạo, submit/cancel nhu cầu đào tạo của đơn vị và theo dõi trạng thái.|Department và yêu cầu do đơn vị tạo|

|Class Admin|Vận hành lớp, roster, lịch, bảo lưu, email, điểm, export và trạng thái học viên.|Class/cohort được phân công|

|Mentor|Hướng dẫn Mock Project, milestone, đánh giá, feedback, phỏng vấn và theo dõi rủi ro.|Project/team/cohort được phân công|

|Trainer|Soạn course/assessment, điểm danh, chấm bài/điểm và phản hồi trong phạm vi được giao.|Course/topic/class được phân công|

|Interviewer/Reviewer|Đánh giá phỏng vấn hoặc artifact theo lời mời, thời hạn và phạm vi được cấp.|Phiên/bài được phân công|

|Trainee/Sinh viên|Học nội dung, làm bài thi, tham gia project, nộp artifact, xem kết quả được công bố.|Dữ liệu cá nhân, lớp và team của mình|




## 2.1 Mô hình phân quyền

RBAC kết hợp permission theo module/function và data scope. Quyền hiệu lực là hợp của các role nhưng không vượt phạm vi tenant/department/program/cohort/class/project được gán. Mặc định từ chối; ẩn UI không phải là biên bảo mật.


|Nguyên tắc bảo mật: Mọi API phải xác thực tenant, actor, permission và object scope; export, webhook, file URL và thao tác batch cũng áp dụng cùng kiểm soát.|

|---|




# 3. Kiến trúc chức năng và thông tin


|Nhóm|Phân hệ|Số UFR|Dải mã|Màn hình liên quan|

|---|---|---|---|---|

|G01|Quản trị hệ thống, định danh và bảo mật|15|UFR-SYS-xxx|SCR-01..04, SCR-27..33; UI-ADM-01..05, UI-ACC-01..05|

|G02|Quản lý chương trình, học liệu và nhu cầu đào tạo|11|UFR-CUR-xxx|SCR-34..47; UI-STD-08, UI-MNT-03|

|G03|Quản lý học viên, lớp, cohort và nhóm|16|UFR-PEO-xxx|SCR-05..12, SCR-48..53; UI-STD-09, UI-STD-12, UI-MNT-01..02|

|G04|Quản lý bảo lưu và vòng đời học viên|7|UFR-RES-xxx|SCR-18..21|

|G05|Quản lý Mock Project, sprint và sản phẩm bàn giao|10|UFR-PRJ-xxx|UI-STD-02..04, UI-STD-09..10, UI-MNT-02..03|

|G06|Quản lý học tập và tiến độ|9|UFR-LRN-xxx|SCR-66..70; UI-STD-01, UI-STD-07|

|G07|Quản lý thi, assessment và chấm bài|13|UFR-EXM-xxx|SCR-54..65; UI-STD-05, UI-MNT-04|

|G08|Quản lý phỏng vấn mô phỏng|4|UFR-INT-xxx|UI-STD-11, UI-STD-12|

|G09|Quản lý điểm, kết quả và chứng nhận|9|UFR-SCO-xxx|SCR-13..17, SCR-60..61; UI-STD-06..07, UI-MNT-04..05|

|G10|Quản lý thông báo và email|7|UFR-COM-xxx|SCR-22..25; UI-ADM-03, UI-ACC-04|

|G11|Dashboard, báo cáo và xuất dữ liệu|7|UFR-RPT-xxx|SCR-04, SCR-61; UI-STD-01, UI-MNT-01, UI-MNT-05, UI-ADM-04|



Tổng phạm vi: 108 yêu cầu chức năng, 70 màn hình FAMS/LMS và 27 màn hình MockProject Hub.


## 3.1 Điều hướng hợp nhất

Điều hướng cấp một đề xuất: Dashboard; System; Curriculum; Course; Demand; Program; Class; Students; Reservation; Assessment; Learning; Mock Projects; Scores; Communications; Reports. Menu và action được dựng động theo permission, nhưng route/API vẫn tự kiểm tra quyền.


## 3.2 Trạng thái dùng chung


|Trạng thái|Hành vi bắt buộc|

|---|---|

|Loading|Skeleton/spinner có nhãn; không cho thao tác lặp khi request đang xử lý.|

|Empty|Giải thích nguyên nhân, giữ filter, có primary action khi người dùng có quyền.|

|Error|Thông báo dễ hiểu, correlation ID, retry an toàn; không lộ stack trace/secret.|

|Success|Xác nhận kết quả, cập nhật dữ liệu tại chỗ hoặc điều hướng có chủ đích.|

|Permission denied|Không lộ dữ liệu; hướng dẫn quay lại hoặc yêu cầu cấp quyền.|

|Conflict/stale|Báo dữ liệu đã thay đổi, cho reload/merge; không ghi đè im lặng.|




# 4. Danh mục yêu cầu chức năng

Bảng dưới đây là inventory để quản trị phạm vi. Đặc tả triển khai chi tiết của từng UFR nằm tại Chương 5.


|ID|Phân hệ|Chức năng|Actor|Ưu tiên|Nguồn|

|---|---|---|---|---|---|

|UFR-SYS-001|Quản trị hệ thống, định danh và bảo mật|Đăng nhập và SSO|Mọi người dùng|Should|Hub AUTH-01; FAMS AUTH-01, FR-201|

|UFR-SYS-002|Quản trị hệ thống, định danh và bảo mật|Quên/đặt lại mật khẩu|Mọi người dùng|Must|FAMS AUTH-02; SCR-02..03|

|UFR-SYS-003|Quản trị hệ thống, định danh và bảo mật|Đổi mật khẩu và quản lý phiên|Mọi người dùng|Must|Hub AUTH-02; FAMS FR-201|

|UFR-SYS-004|Quản trị hệ thống, định danh và bảo mật|Hồ sơ cá nhân|Mọi người dùng|Should|Hub AUTH-03; FAMS FR-201|

|UFR-SYS-005|Quản trị hệ thống, định danh và bảo mật|Quản lý tenant|Super/School Admin|Must|Hub AUTH-04, ADM-01|

|UFR-SYS-006|Quản trị hệ thống, định danh và bảo mật|Quản lý người dùng|Super Admin|Must|Hub AUTH-02,05; FAMS FR-202|

|UFR-SYS-007|Quản trị hệ thống, định danh và bảo mật|Quản lý vai trò|Super Admin|Should|FAMS FR-203; SCR-30|

|UFR-SYS-008|Quản trị hệ thống, định danh và bảo mật|Quản lý quyền|Super Admin|Must|Hub AUTH-04; FAMS SEC-01, FR-203|

|UFR-SYS-009|Quản trị hệ thống, định danh và bảo mật|Quản lý menu|Super Admin|Must|FAMS FR-203; SCR-31|

|UFR-SYS-010|Quản trị hệ thống, định danh và bảo mật|Quản lý menu item/chức năng|Super Admin|Must|FAMS FR-203; SCR-31|

|UFR-SYS-011|Quản trị hệ thống, định danh và bảo mật|Địa điểm và phòng ban|Super Admin|Must|FAMS FR-204|

|UFR-SYS-012|Quản trị hệ thống, định danh và bảo mật|Danh mục kỹ năng|Admin/Program Manager|Must|FAMS FR-205|

|UFR-SYS-013|Quản trị hệ thống, định danh và bảo mật|Cấu hình chính sách|Super/School Admin|Must|Hub ADM-01; FAMS BR-PWD-01|

|UFR-SYS-014|Quản trị hệ thống, định danh và bảo mật|Audit log|Admin/Auditor|Must|Hub ADM-04; FAMS FR-227|

|UFR-SYS-015|Quản trị hệ thống, định danh và bảo mật|API và webhook|Admin/Integration|Should|Hub ADM-03,05|

|UFR-CUR-001|Quản lý chương trình, học liệu và nhu cầu đào tạo|Danh mục topic|Program Manager|Must|FAMS FR-206|

|UFR-CUR-002|Quản lý chương trình, học liệu và nhu cầu đào tạo|Thiết kế topic|Program Manager|Must|FAMS FR-206; SCR-35..37|

|UFR-CUR-003|Quản lý chương trình, học liệu và nhu cầu đào tạo|Gợi ý outline bằng AI|Program Manager|Should|FAMS FR-207|

|UFR-CUR-004|Quản lý chương trình, học liệu và nhu cầu đào tạo|Soạn course|Trainer/Program Manager|Should|FAMS FR-208|

|UFR-CUR-005|Quản lý chương trình, học liệu và nhu cầu đào tạo|Phê duyệt course|Program Manager|Must|FAMS FR-209|

|UFR-CUR-006|Quản lý chương trình, học liệu và nhu cầu đào tạo|Training Program|Program Manager|Should|FAMS FR-210|

|UFR-CUR-007|Quản lý chương trình, học liệu và nhu cầu đào tạo|Nhu cầu mở lớp|Dept./Program Manager|Must|FAMS FR-211|

|UFR-CUR-008|Quản lý chương trình, học liệu và nhu cầu đào tạo|Thư viện đề bài Mock Project|Admin/Mentor|Must|Hub LIB-01|

|UFR-CUR-009|Quản lý chương trình, học liệu và nhu cầu đào tạo|Version đề bài|Admin/Mentor|Must|Hub LIB-02|

|UFR-CUR-010|Quản lý chương trình, học liệu và nhu cầu đào tạo|Phân loại và phân quyền đề bài|Admin/Mentor|Should|Hub LIB-03,04|

|UFR-CUR-011|Quản lý chương trình, học liệu và nhu cầu đào tạo|Template nghiệp vụ|Admin/Mentor|Should|Hub LIB-05|

|UFR-PEO-001|Quản lý học viên, lớp, cohort và nhóm|Danh sách học viên|Class Admin/Trainer|Must|FAMS STU-01,02|

|UFR-PEO-002|Quản lý học viên, lớp, cohort và nhóm|Hồ sơ học viên|Class Admin/Trainer|Should|FAMS STU-02|

|UFR-PEO-003|Quản lý học viên, lớp, cohort và nhóm|Tạo/sửa học viên|Class Admin|Must|FAMS STU-03|

|UFR-PEO-004|Quản lý học viên, lớp, cohort và nhóm|Import học viên|Class Admin|Must|Hub AUTH-05; FAMS STU-04|

|UFR-PEO-005|Quản lý học viên, lớp, cohort và nhóm|Xuất học viên|Class Admin|Must|FAMS STU-06|

|UFR-PEO-006|Quản lý học viên, lớp, cohort và nhóm|Trạng thái học viên|Class Admin|Must|FAMS STU-05|

|UFR-PEO-007|Quản lý học viên, lớp, cohort và nhóm|Vô hiệu hóa học viên|Class Admin|Must|FAMS STU-07|

|UFR-PEO-008|Quản lý học viên, lớp, cohort và nhóm|Quản lý cohort|Program Manager|Must|Hub TEAM-01|

|UFR-PEO-009|Quản lý học viên, lớp, cohort và nhóm|Quản lý Training Class|Program/Class Admin|Should|FAMS FR-212|

|UFR-PEO-010|Quản lý học viên, lớp, cohort và nhóm|Quản lý roster và tài nguyên|Class Admin|Should|FAMS FR-212; SCR-50|

|UFR-PEO-011|Quản lý học viên, lớp, cohort và nhóm|Xếp nhóm dự án|Program Manager/Mentor|Must|Hub TEAM-02|

|UFR-PEO-012|Quản lý học viên, lớp, cohort và nhóm|Vai trò trong nhóm|Mentor|Should|Hub TEAM-03,04|

|UFR-PEO-013|Quản lý học viên, lớp, cohort và nhóm|Team charter|Sinh viên/Mentor|Must|Hub TEAM-05|

|UFR-PEO-014|Quản lý học viên, lớp, cohort và nhóm|Lịch học và calendar version|Class Admin|Must|FAMS FR-213|

|UFR-PEO-015|Quản lý học viên, lớp, cohort và nhóm|Phân course theo topic|Program/Class Admin|Should|FAMS SCR-52|

|UFR-PEO-016|Quản lý học viên, lớp, cohort và nhóm|Điểm danh|Trainer/Class Admin|Must|FAMS FR-214|

|UFR-RES-001|Quản lý bảo lưu và vòng đời học viên|Danh sách bảo lưu|Class Admin|Must|FAMS RES-01|

|UFR-RES-002|Quản lý bảo lưu và vòng đời học viên|Tạo bảo lưu|Class Admin|Must|FAMS RES-02|

|UFR-RES-003|Quản lý bảo lưu và vòng đời học viên|Cập nhật bảo lưu|Class Admin|Must|FAMS RES-02|

|UFR-RES-004|Quản lý bảo lưu và vòng đời học viên|Kết thúc bảo lưu|Class Admin|Must|FAMS RES-02|

|UFR-RES-005|Quản lý bảo lưu và vòng đời học viên|Nhắc sau bảo lưu|Class Admin|Must|FAMS RES-03|

|UFR-RES-006|Quản lý bảo lưu và vòng đời học viên|Xếp lớp mới|Class Admin|Must|FAMS RES-04|

|UFR-RES-007|Quản lý bảo lưu và vòng đời học viên|Drop Out|Class Admin|Must|FAMS RES-05|

|UFR-PRJ-001|Quản lý Mock Project, sprint và sản phẩm bàn giao|Khởi tạo workspace dự án|Mentor/Team|Must|Hub PRJ-01|

|UFR-PRJ-002|Quản lý Mock Project, sprint và sản phẩm bàn giao|Milestone|Mentor|Must|Hub PRJ-02|

|UFR-PRJ-003|Quản lý Mock Project, sprint và sản phẩm bàn giao|Sprint và backlog|Sinh viên|Must|Hub PRJ-03|

|UFR-PRJ-004|Quản lý Mock Project, sprint và sản phẩm bàn giao|Task|Sinh viên/Mentor|Must|Hub PRJ-03|

|UFR-PRJ-005|Quản lý Mock Project, sprint và sản phẩm bàn giao|Board và activity|Team/Mentor|Must|Hub PRJ-04|

|UFR-PRJ-006|Quản lý Mock Project, sprint và sản phẩm bàn giao|Nộp artifact|Sinh viên|Must|Hub PRJ-05|

|UFR-PRJ-007|Quản lý Mock Project, sprint và sản phẩm bàn giao|Review milestone|Mentor/Reviewer|Must|Hub PRJ-06|

|UFR-PRJ-008|Quản lý Mock Project, sprint và sản phẩm bàn giao|Cảnh báo tiến độ|Mentor/Team|Must|Hub PRJ-07|

|UFR-PRJ-009|Quản lý Mock Project, sprint và sản phẩm bàn giao|Nhật ký dự án|Team/Mentor|Must|Hub PRJ-08|

|UFR-PRJ-010|Quản lý Mock Project, sprint và sản phẩm bàn giao|Tích hợp repository|Team/Admin|Should|Hub ADM-02|

|UFR-LRN-001|Quản lý học tập và tiến độ|Course catalog|Trainee|Must|FAMS FR-222|

|UFR-LRN-002|Quản lý học tập và tiến độ|Đăng ký course|Trainee|Must|FAMS FR-222|

|UFR-LRN-003|Quản lý học tập và tiến độ|My Courses|Trainee|Must|FAMS SCR-67|

|UFR-LRN-004|Quản lý học tập và tiến độ|Course player|Trainee|Must|FAMS FR-223|

|UFR-LRN-005|Quản lý học tập và tiến độ|Theo dõi tiến độ|Trainee/Trainer|Must|FAMS FR-223|

|UFR-LRN-006|Quản lý học tập và tiến độ|Hoàn thành course|Hệ thống|Must|FAMS FR-224|

|UFR-LRN-007|Quản lý học tập và tiến độ|Đánh giá course|Trainee|Should|FAMS FR-224|

|UFR-LRN-008|Quản lý học tập và tiến độ|My Classes/Calendar|Trainee|Must|FAMS SCR-70|

|UFR-LRN-009|Quản lý học tập và tiến độ|Portfolio học tập|Sinh viên/Mentor|Should|Hub RPT-04|

|UFR-EXM-001|Quản lý thi, assessment và chấm bài|Quản lý assessment/checkpoint|Trainer/Mentor/Admin|Must|Hub ASM-01; FAMS FR-216|

|UFR-EXM-002|Quản lý thi, assessment và chấm bài|Cấu hình kỳ thi|Trainer/Admin|Must|Hub ASM-02; FAMS FR-216|

|UFR-EXM-003|Quản lý thi, assessment và chấm bài|Ngân hàng câu hỏi|Trainer|Should|FAMS FR-217|

|UFR-EXM-004|Quản lý thi, assessment và chấm bài|Bài lập trình|Trainer|Must|FAMS FR-218|

|UFR-EXM-005|Quản lý thi, assessment và chấm bài|Mời dự thi|Class/Training Admin|Should|FAMS FR-219|

|UFR-EXM-006|Quản lý thi, assessment và chấm bài|Danh sách bài thi của tôi|Trainee/Sinh viên|Must|FAMS SCR-62|

|UFR-EXM-007|Quản lý thi, assessment và chấm bài|Làm bài an toàn|Trainee/Sinh viên|Must|Hub ASM-03; FAMS FR-220|

|UFR-EXM-008|Quản lý thi, assessment và chấm bài|Làm bài lập trình|Trainee/Sinh viên|Must|FAMS FR-220|

|UFR-EXM-009|Quản lý thi, assessment và chấm bài|Gắn cờ bất thường|Hệ thống/Reviewer|Must|Hub ASM-07|

|UFR-EXM-010|Quản lý thi, assessment và chấm bài|Chấm tự động|Hệ thống|Must|Hub ASM-04; FAMS FR-221|

|UFR-EXM-011|Quản lý thi, assessment và chấm bài|Chấm thủ công|Trainer/Mentor|Must|Hub ASM-05; FAMS FR-221|

|UFR-EXM-012|Quản lý thi, assessment và chấm bài|Tự đánh giá/đánh giá chéo|Sinh viên|Must|Hub ASM-06|

|UFR-EXM-013|Quản lý thi, assessment và chấm bài|Kết quả và thống kê assessment|Trainer/Admin/Trainee|Must|FAMS SCR-61,65|

|UFR-INT-001|Quản lý phỏng vấn mô phỏng|Loại và bộ câu hỏi|Mentor/Admin|Must|Hub INT-01|

|UFR-INT-002|Quản lý phỏng vấn mô phỏng|Lập lịch phỏng vấn|Mentor/Admin|Must|Hub INT-02,05|

|UFR-INT-003|Quản lý phỏng vấn mô phỏng|Chấm phỏng vấn|Interviewer|Must|Hub INT-03|

|UFR-INT-004|Quản lý phỏng vấn mô phỏng|Công bố feedback|Interviewer/Mentor|Must|Hub INT-04|

|UFR-SCO-001|Quản lý điểm, kết quả và chứng nhận|Rubric và scorecard|Admin/Mentor|Must|Hub LIB-05; BR-03|

|UFR-SCO-002|Quản lý điểm, kết quả và chứng nhận|Import điểm|Class Admin/Trainer|Must|FAMS SCO-01, FR-215|

|UFR-SCO-003|Quản lý điểm, kết quả và chứng nhận|Gradebook theo lớp|Class Admin/Trainer|Must|FAMS SCO-02|

|UFR-SCO-004|Quản lý điểm, kết quả và chứng nhận|Kết quả học tập cá nhân|Trainer/Học viên|Must|FAMS SCO-03; Hub RPT-02|

|UFR-SCO-005|Quản lý điểm, kết quả và chứng nhận|Cập nhật/điều chỉnh điểm|Trainer/Admin|Must|FAMS SCO-03; Hub BR-10|

|UFR-SCO-006|Quản lý điểm, kết quả và chứng nhận|Điểm topic|Trainer/Class Admin|Must|FAMS FR-215|

|UFR-SCO-007|Quản lý điểm, kết quả và chứng nhận|Công thức điểm|Program Manager|Must|Hub RPT-01|

|UFR-SCO-008|Quản lý điểm, kết quả và chứng nhận|Công bố và khóa điểm|Mentor/Admin|Must|Hub BR-06,10|

|UFR-SCO-009|Quản lý điểm, kết quả và chứng nhận|Chứng nhận|Admin/Trainer|Must|FAMS SCO-04; Hub RPT-06|

|UFR-COM-001|Quản lý thông báo và email|Trung tâm thông báo|Mọi người dùng|Should|Hub DASH-04; FAMS FR-225|

|UFR-COM-002|Quản lý thông báo và email|Tùy chọn thông báo|Mọi người dùng|Must|Hub DASH-04|

|UFR-COM-003|Quản lý thông báo và email|Lịch sử email|Class Admin|Should|FAMS EML-01|

|UFR-COM-004|Quản lý thông báo và email|Soạn/preview/gửi email|Class Admin|Should|FAMS EML-02|

|UFR-COM-005|Quản lý thông báo và email|Gửi hàng loạt|Class Admin|Should|FAMS EML-02|

|UFR-COM-006|Quản lý thông báo và email|Mẫu email|Admin|Should|FAMS EML-03|

|UFR-COM-007|Quản lý thông báo và email|Reminder tự động|Admin/Hệ thống|Must|FAMS FR-225; Hub INT-02|

|UFR-RPT-001|Dashboard, báo cáo và xuất dữ liệu|Dashboard theo vai trò|Theo vai trò|Should|Hub DASH-01; FAMS SCR-04|

|UFR-RPT-002|Dashboard, báo cáo và xuất dữ liệu|Bộ lọc dashboard|Theo vai trò|Must|Hub DASH-02|

|UFR-RPT-003|Dashboard, báo cáo và xuất dữ liệu|Activity feed|Theo vai trò|Should|Hub DASH-03|

|UFR-RPT-004|Dashboard, báo cáo và xuất dữ liệu|Báo cáo cá nhân/nhóm|Mentor/Program Manager|Should|Hub RPT-02|

|UFR-RPT-005|Dashboard, báo cáo và xuất dữ liệu|Báo cáo cohort/class|Program/Class Admin|Should|Hub RPT-03; FAMS FR-226|

|UFR-RPT-006|Dashboard, báo cáo và xuất dữ liệu|Báo cáo program/assessment|Program Manager|Must|FAMS FR-226|

|UFR-RPT-007|Dashboard, báo cáo và xuất dữ liệu|Xuất báo cáo|Theo quyền|Must|Hub RPT-05; FAMS FR-226|




# 5. Đặc tả yêu cầu chức năng chi tiết

Mỗi contract dưới đây là đơn vị truy vết cho user story, API, database migration và test case. Luồng chính là baseline tối thiểu; màn hình liên quan và SRS nguồn cung cấp chi tiết thành phần UI.


## 5.1 Quản trị hệ thống, định danh và bảo mật

UFR-SYS-001 - Đăng nhập và SSO


|CONTRACT UFR-SYS-001|CONTRACT UFR-SYS-001|

|---|---|

|Phân hệ / Ưu tiên|Quản trị hệ thống, định danh và bảo mật / Should|

|Actor / Quyền|Mọi người dùng. Bắt buộc permission tương ứng và data scope hợp lệ.|

|Yêu cầu|Đăng nhập bằng email/mật khẩu hoặc SSO theo tenant; chỉ tài khoản ACTIVE được tạo phiên.|

|Tiền điều kiện|Người dùng đã xác thực; tenant đang hoạt động; có permission và data scope phù hợp.|

|Luồng chính|1) Người dùng mở chức năng Đăng nhập và SSO; hệ thống tải dữ liệu theo scope.<br>2) Người dùng nhập/chọn điều kiện cần thiết; hệ thống kiểm tra validation và quyền.<br>3) Hệ thống thực hiện: Đăng nhập bằng email/mật khẩu hoặc SSO theo tenant; chỉ tài khoản ACTIVE được tạo phiên.<br>4) Hệ thống lưu giao dịch, hiển thị kết quả, cập nhật dữ liệu liên quan và ghi audit/event.|

|Validation / Quy tắc|Deny-by-default; kiểm tra quyền ở UI và API; dữ liệu tách theo tenant; hành động quản trị phải audit.|

|Ngoại lệ|401 khi phiên không hợp lệ; 403 khi thiếu quyền/scope; 404 khi đối tượng không tồn tại; 409 khi trùng/không đúng version hoặc transition; 422 khi dữ liệu nghiệp vụ không hợp lệ. Không mất dữ liệu người dùng đã nhập và phải có thông báo khắc phục được.|

|Hậu điều kiện|Dữ liệu và trạng thái liên quan nhất quán; sự kiện/outbox phát đúng một lần; audit có actor, thời gian, before/after và correlation ID.|

|Tiêu chí nghiệm thu|AC1. Mọi người dùng thực hiện được nghiệp vụ trong phạm vi được cấp và kết quả đúng mô tả.<br>AC2. Người không có quyền bị chặn nhất quán ở UI và API; không rò rỉ dữ liệu qua response/export.<br>AC3. Validation, trạng thái loading/empty/error/success và xử lý thao tác lặp được kiểm thử.<br>AC4. Giao dịch thành công được lưu bền vững, phản ánh trên màn hình liên quan và có audit/correlation ID.|

|Màn hình / Nguồn|SCR-01..04, SCR-27..33; UI-ADM-01..05, UI-ACC-01..05 \| Hub AUTH-01; FAMS AUTH-01, FR-201|



UFR-SYS-002 - Quên/đặt lại mật khẩu


|CONTRACT UFR-SYS-002|CONTRACT UFR-SYS-002|

|---|---|

|Phân hệ / Ưu tiên|Quản trị hệ thống, định danh và bảo mật / Must|

|Actor / Quyền|Mọi người dùng. Bắt buộc permission tương ứng và data scope hợp lệ.|

|Yêu cầu|Yêu cầu liên kết đặt lại dùng một lần, có thời hạn; phản hồi không tiết lộ tài khoản có tồn tại.|

|Tiền điều kiện|Người dùng đã xác thực; tenant đang hoạt động; có permission và data scope phù hợp.|

|Luồng chính|1) Người dùng mở chức năng Quên/đặt lại mật khẩu; hệ thống tải dữ liệu theo scope.<br>2) Người dùng nhập/chọn điều kiện cần thiết; hệ thống kiểm tra validation và quyền.<br>3) Hệ thống thực hiện: Yêu cầu liên kết đặt lại dùng một lần, có thời hạn; phản hồi không tiết lộ tài khoản có tồn tại.<br>4) Hệ thống lưu giao dịch, hiển thị kết quả, cập nhật dữ liệu liên quan và ghi audit/event.|

|Validation / Quy tắc|Deny-by-default; kiểm tra quyền ở UI và API; dữ liệu tách theo tenant; hành động quản trị phải audit.|

|Ngoại lệ|401 khi phiên không hợp lệ; 403 khi thiếu quyền/scope; 404 khi đối tượng không tồn tại; 409 khi trùng/không đúng version hoặc transition; 422 khi dữ liệu nghiệp vụ không hợp lệ. Không mất dữ liệu người dùng đã nhập và phải có thông báo khắc phục được.|

|Hậu điều kiện|Dữ liệu và trạng thái liên quan nhất quán; sự kiện/outbox phát đúng một lần; audit có actor, thời gian, before/after và correlation ID.|

|Tiêu chí nghiệm thu|AC1. Mọi người dùng thực hiện được nghiệp vụ trong phạm vi được cấp và kết quả đúng mô tả.<br>AC2. Người không có quyền bị chặn nhất quán ở UI và API; không rò rỉ dữ liệu qua response/export.<br>AC3. Validation, trạng thái loading/empty/error/success và xử lý thao tác lặp được kiểm thử.<br>AC4. Giao dịch thành công được lưu bền vững, phản ánh trên màn hình liên quan và có audit/correlation ID.|

|Màn hình / Nguồn|SCR-01..04, SCR-27..33; UI-ADM-01..05, UI-ACC-01..05 \| FAMS AUTH-02; SCR-02..03|



UFR-SYS-003 - Đổi mật khẩu và quản lý phiên


|CONTRACT UFR-SYS-003|CONTRACT UFR-SYS-003|

|---|---|

|Phân hệ / Ưu tiên|Quản trị hệ thống, định danh và bảo mật / Must|

|Actor / Quyền|Mọi người dùng. Bắt buộc permission tương ứng và data scope hợp lệ.|

|Yêu cầu|Đổi mật khẩu, đăng xuất, refresh phiên an toàn và thu hồi các phiên khác theo chính sách.|

|Tiền điều kiện|Người dùng đã xác thực; tenant đang hoạt động; có permission và data scope phù hợp.|

|Luồng chính|1) Người dùng mở chức năng Đổi mật khẩu và quản lý phiên; hệ thống tải dữ liệu theo scope.<br>2) Người dùng nhập/chọn điều kiện cần thiết; hệ thống kiểm tra validation và quyền.<br>3) Hệ thống thực hiện: Đổi mật khẩu, đăng xuất, refresh phiên an toàn và thu hồi các phiên khác theo chính sách.<br>4) Hệ thống lưu giao dịch, hiển thị kết quả, cập nhật dữ liệu liên quan và ghi audit/event.|

|Validation / Quy tắc|Deny-by-default; kiểm tra quyền ở UI và API; dữ liệu tách theo tenant; hành động quản trị phải audit.|

|Ngoại lệ|401 khi phiên không hợp lệ; 403 khi thiếu quyền/scope; 404 khi đối tượng không tồn tại; 409 khi trùng/không đúng version hoặc transition; 422 khi dữ liệu nghiệp vụ không hợp lệ. Không mất dữ liệu người dùng đã nhập và phải có thông báo khắc phục được.|

|Hậu điều kiện|Dữ liệu và trạng thái liên quan nhất quán; sự kiện/outbox phát đúng một lần; audit có actor, thời gian, before/after và correlation ID.|

|Tiêu chí nghiệm thu|AC1. Mọi người dùng thực hiện được nghiệp vụ trong phạm vi được cấp và kết quả đúng mô tả.<br>AC2. Người không có quyền bị chặn nhất quán ở UI và API; không rò rỉ dữ liệu qua response/export.<br>AC3. Validation, trạng thái loading/empty/error/success và xử lý thao tác lặp được kiểm thử.<br>AC4. Giao dịch thành công được lưu bền vững, phản ánh trên màn hình liên quan và có audit/correlation ID.|

|Màn hình / Nguồn|SCR-01..04, SCR-27..33; UI-ADM-01..05, UI-ACC-01..05 \| Hub AUTH-02; FAMS FR-201|



UFR-SYS-004 - Hồ sơ cá nhân


|CONTRACT UFR-SYS-004|CONTRACT UFR-SYS-004|

|---|---|

|Phân hệ / Ưu tiên|Quản trị hệ thống, định danh và bảo mật / Should|

|Actor / Quyền|Mọi người dùng. Bắt buộc permission tương ứng và data scope hợp lệ.|

|Yêu cầu|Xem/cập nhật tên hiển thị, ảnh, múi giờ, liên hệ, kỹ năng và liên kết portfolio trong phạm vi cho phép.|

|Tiền điều kiện|Người dùng đã xác thực; tenant đang hoạt động; có permission và data scope phù hợp.|

|Luồng chính|1) Người dùng mở chức năng Hồ sơ cá nhân; hệ thống tải dữ liệu theo scope.<br>2) Người dùng nhập/chọn điều kiện cần thiết; hệ thống kiểm tra validation và quyền.<br>3) Hệ thống thực hiện: Xem/cập nhật tên hiển thị, ảnh, múi giờ, liên hệ, kỹ năng và liên kết portfolio trong phạm vi cho phép.<br>4) Hệ thống lưu giao dịch, hiển thị kết quả, cập nhật dữ liệu liên quan và ghi audit/event.|

|Validation / Quy tắc|Deny-by-default; kiểm tra quyền ở UI và API; dữ liệu tách theo tenant; hành động quản trị phải audit.|

|Ngoại lệ|401 khi phiên không hợp lệ; 403 khi thiếu quyền/scope; 404 khi đối tượng không tồn tại; 409 khi trùng/không đúng version hoặc transition; 422 khi dữ liệu nghiệp vụ không hợp lệ. Không mất dữ liệu người dùng đã nhập và phải có thông báo khắc phục được.|

|Hậu điều kiện|Dữ liệu và trạng thái liên quan nhất quán; sự kiện/outbox phát đúng một lần; audit có actor, thời gian, before/after và correlation ID.|

|Tiêu chí nghiệm thu|AC1. Mọi người dùng thực hiện được nghiệp vụ trong phạm vi được cấp và kết quả đúng mô tả.<br>AC2. Người không có quyền bị chặn nhất quán ở UI và API; không rò rỉ dữ liệu qua response/export.<br>AC3. Validation, trạng thái loading/empty/error/success và xử lý thao tác lặp được kiểm thử.<br>AC4. Giao dịch thành công được lưu bền vững, phản ánh trên màn hình liên quan và có audit/correlation ID.|

|Màn hình / Nguồn|SCR-01..04, SCR-27..33; UI-ADM-01..05, UI-ACC-01..05 \| Hub AUTH-03; FAMS FR-201|



UFR-SYS-005 - Quản lý tenant


|CONTRACT UFR-SYS-005|CONTRACT UFR-SYS-005|

|---|---|

|Phân hệ / Ưu tiên|Quản trị hệ thống, định danh và bảo mật / Must|

|Actor / Quyền|Super/School Admin. Bắt buộc permission tương ứng và data scope hợp lệ.|

|Yêu cầu|Tạo/cấu hình tenant, tách biệt dữ liệu, branding, ngôn ngữ, múi giờ, thang điểm và retention.|

|Tiền điều kiện|Người dùng đã xác thực; tenant đang hoạt động; có permission và data scope phù hợp.|

|Luồng chính|1) Người dùng mở chức năng Quản lý tenant; hệ thống tải dữ liệu theo scope.<br>2) Người dùng nhập/chọn điều kiện cần thiết; hệ thống kiểm tra validation và quyền.<br>3) Hệ thống thực hiện: Tạo/cấu hình tenant, tách biệt dữ liệu, branding, ngôn ngữ, múi giờ, thang điểm và retention.<br>4) Hệ thống lưu giao dịch, hiển thị kết quả, cập nhật dữ liệu liên quan và ghi audit/event.|

|Validation / Quy tắc|Deny-by-default; kiểm tra quyền ở UI và API; dữ liệu tách theo tenant; hành động quản trị phải audit.|

|Ngoại lệ|401 khi phiên không hợp lệ; 403 khi thiếu quyền/scope; 404 khi đối tượng không tồn tại; 409 khi trùng/không đúng version hoặc transition; 422 khi dữ liệu nghiệp vụ không hợp lệ. Không mất dữ liệu người dùng đã nhập và phải có thông báo khắc phục được.|

|Hậu điều kiện|Dữ liệu và trạng thái liên quan nhất quán; sự kiện/outbox phát đúng một lần; audit có actor, thời gian, before/after và correlation ID.|

|Tiêu chí nghiệm thu|AC1. Super/School Admin thực hiện được nghiệp vụ trong phạm vi được cấp và kết quả đúng mô tả.<br>AC2. Người không có quyền bị chặn nhất quán ở UI và API; không rò rỉ dữ liệu qua response/export.<br>AC3. Validation, trạng thái loading/empty/error/success và xử lý thao tác lặp được kiểm thử.<br>AC4. Giao dịch thành công được lưu bền vững, phản ánh trên màn hình liên quan và có audit/correlation ID.|

|Màn hình / Nguồn|SCR-01..04, SCR-27..33; UI-ADM-01..05, UI-ACC-01..05 \| Hub AUTH-04, ADM-01|



UFR-SYS-006 - Quản lý người dùng


|CONTRACT UFR-SYS-006|CONTRACT UFR-SYS-006|

|---|---|

|Phân hệ / Ưu tiên|Quản trị hệ thống, định danh và bảo mật / Must|

|Actor / Quyền|Super Admin. Bắt buộc permission tương ứng và data scope hợp lệ.|

|Yêu cầu|Tìm kiếm, lọc, tạo, xem, sửa, kích hoạt, khóa, suspend/deactivate, import/export và thu hồi phiên.|

|Tiền điều kiện|Người dùng đã xác thực; tenant đang hoạt động; có permission và data scope phù hợp.|

|Luồng chính|1) Người dùng mở chức năng Quản lý người dùng; hệ thống tải dữ liệu theo scope.<br>2) Người dùng nhập/chọn điều kiện cần thiết; hệ thống kiểm tra validation và quyền.<br>3) Hệ thống thực hiện: Tìm kiếm, lọc, tạo, xem, sửa, kích hoạt, khóa, suspend/deactivate, import/export và thu hồi phiên.<br>4) Hệ thống lưu giao dịch, hiển thị kết quả, cập nhật dữ liệu liên quan và ghi audit/event.|

|Validation / Quy tắc|Deny-by-default; kiểm tra quyền ở UI và API; dữ liệu tách theo tenant; hành động quản trị phải audit.|

|Ngoại lệ|401 khi phiên không hợp lệ; 403 khi thiếu quyền/scope; 404 khi đối tượng không tồn tại; 409 khi trùng/không đúng version hoặc transition; 422 khi dữ liệu nghiệp vụ không hợp lệ. Không mất dữ liệu người dùng đã nhập và phải có thông báo khắc phục được.|

|Hậu điều kiện|Dữ liệu và trạng thái liên quan nhất quán; sự kiện/outbox phát đúng một lần; audit có actor, thời gian, before/after và correlation ID.|

|Tiêu chí nghiệm thu|AC1. Super Admin thực hiện được nghiệp vụ trong phạm vi được cấp và kết quả đúng mô tả.<br>AC2. Người không có quyền bị chặn nhất quán ở UI và API; không rò rỉ dữ liệu qua response/export.<br>AC3. Validation, trạng thái loading/empty/error/success và xử lý thao tác lặp được kiểm thử.<br>AC4. Giao dịch thành công được lưu bền vững, phản ánh trên màn hình liên quan và có audit/correlation ID.|

|Màn hình / Nguồn|SCR-01..04, SCR-27..33; UI-ADM-01..05, UI-ACC-01..05 \| Hub AUTH-02,05; FAMS FR-202|



UFR-SYS-007 - Quản lý vai trò


|CONTRACT UFR-SYS-007|CONTRACT UFR-SYS-007|

|---|---|

|Phân hệ / Ưu tiên|Quản trị hệ thống, định danh và bảo mật / Should|

|Actor / Quyền|Super Admin. Bắt buộc permission tương ứng và data scope hợp lệ.|

|Yêu cầu|Tạo, sao chép, kích hoạt/vô hiệu hóa vai trò; không xóa vai trò mặc định hoặc đang có người dùng.|

|Tiền điều kiện|Người dùng đã xác thực; tenant đang hoạt động; có permission và data scope phù hợp.|

|Luồng chính|1) Người dùng mở chức năng Quản lý vai trò; hệ thống tải dữ liệu theo scope.<br>2) Người dùng nhập/chọn điều kiện cần thiết; hệ thống kiểm tra validation và quyền.<br>3) Hệ thống thực hiện: Tạo, sao chép, kích hoạt/vô hiệu hóa vai trò; không xóa vai trò mặc định hoặc đang có người dùng.<br>4) Hệ thống lưu giao dịch, hiển thị kết quả, cập nhật dữ liệu liên quan và ghi audit/event.|

|Validation / Quy tắc|Deny-by-default; kiểm tra quyền ở UI và API; dữ liệu tách theo tenant; hành động quản trị phải audit.|

|Ngoại lệ|401 khi phiên không hợp lệ; 403 khi thiếu quyền/scope; 404 khi đối tượng không tồn tại; 409 khi trùng/không đúng version hoặc transition; 422 khi dữ liệu nghiệp vụ không hợp lệ. Không mất dữ liệu người dùng đã nhập và phải có thông báo khắc phục được.|

|Hậu điều kiện|Dữ liệu và trạng thái liên quan nhất quán; sự kiện/outbox phát đúng một lần; audit có actor, thời gian, before/after và correlation ID.|

|Tiêu chí nghiệm thu|AC1. Super Admin thực hiện được nghiệp vụ trong phạm vi được cấp và kết quả đúng mô tả.<br>AC2. Người không có quyền bị chặn nhất quán ở UI và API; không rò rỉ dữ liệu qua response/export.<br>AC3. Validation, trạng thái loading/empty/error/success và xử lý thao tác lặp được kiểm thử.<br>AC4. Giao dịch thành công được lưu bền vững, phản ánh trên màn hình liên quan và có audit/correlation ID.|

|Màn hình / Nguồn|SCR-01..04, SCR-27..33; UI-ADM-01..05, UI-ACC-01..05 \| FAMS FR-203; SCR-30|



UFR-SYS-008 - Quản lý quyền


|CONTRACT UFR-SYS-008|CONTRACT UFR-SYS-008|

|---|---|

|Phân hệ / Ưu tiên|Quản trị hệ thống, định danh và bảo mật / Must|

|Actor / Quyền|Super Admin. Bắt buộc permission tương ứng và data scope hợp lệ.|

|Yêu cầu|Gán/thu hồi quyền theo module/function và scope tenant/cohort/class/project; deny-by-default ở UI và API.|

|Tiền điều kiện|Người dùng đã xác thực; tenant đang hoạt động; có permission và data scope phù hợp.|

|Luồng chính|1) Người dùng mở chức năng Quản lý quyền; hệ thống tải dữ liệu theo scope.<br>2) Người dùng nhập/chọn điều kiện cần thiết; hệ thống kiểm tra validation và quyền.<br>3) Hệ thống thực hiện: Gán/thu hồi quyền theo module/function và scope tenant/cohort/class/project; deny-by-default ở UI và API.<br>4) Hệ thống lưu giao dịch, hiển thị kết quả, cập nhật dữ liệu liên quan và ghi audit/event.|

|Validation / Quy tắc|Deny-by-default; kiểm tra quyền ở UI và API; dữ liệu tách theo tenant; hành động quản trị phải audit.|

|Ngoại lệ|401 khi phiên không hợp lệ; 403 khi thiếu quyền/scope; 404 khi đối tượng không tồn tại; 409 khi trùng/không đúng version hoặc transition; 422 khi dữ liệu nghiệp vụ không hợp lệ. Không mất dữ liệu người dùng đã nhập và phải có thông báo khắc phục được.|

|Hậu điều kiện|Dữ liệu và trạng thái liên quan nhất quán; sự kiện/outbox phát đúng một lần; audit có actor, thời gian, before/after và correlation ID.|

|Tiêu chí nghiệm thu|AC1. Super Admin thực hiện được nghiệp vụ trong phạm vi được cấp và kết quả đúng mô tả.<br>AC2. Người không có quyền bị chặn nhất quán ở UI và API; không rò rỉ dữ liệu qua response/export.<br>AC3. Validation, trạng thái loading/empty/error/success và xử lý thao tác lặp được kiểm thử.<br>AC4. Giao dịch thành công được lưu bền vững, phản ánh trên màn hình liên quan và có audit/correlation ID.|

|Màn hình / Nguồn|SCR-01..04, SCR-27..33; UI-ADM-01..05, UI-ACC-01..05 \| Hub AUTH-04; FAMS SEC-01, FR-203|



UFR-SYS-009 - Quản lý menu


|CONTRACT UFR-SYS-009|CONTRACT UFR-SYS-009|

|---|---|

|Phân hệ / Ưu tiên|Quản trị hệ thống, định danh và bảo mật / Must|

|Actor / Quyền|Super Admin. Bắt buộc permission tương ứng và data scope hợp lệ.|

|Yêu cầu|CRUD, sắp xếp, kích hoạt/vô hiệu hóa nhóm menu/menu; cấu hình icon, URL và thứ tự hiển thị.|

|Tiền điều kiện|Người dùng đã xác thực; tenant đang hoạt động; có permission và data scope phù hợp.|

|Luồng chính|1) Người dùng mở chức năng Quản lý menu; hệ thống tải dữ liệu theo scope.<br>2) Người dùng nhập/chọn điều kiện cần thiết; hệ thống kiểm tra validation và quyền.<br>3) Hệ thống thực hiện: CRUD, sắp xếp, kích hoạt/vô hiệu hóa nhóm menu/menu; cấu hình icon, URL và thứ tự hiển thị.<br>4) Hệ thống lưu giao dịch, hiển thị kết quả, cập nhật dữ liệu liên quan và ghi audit/event.|

|Validation / Quy tắc|Deny-by-default; kiểm tra quyền ở UI và API; dữ liệu tách theo tenant; hành động quản trị phải audit.|

|Ngoại lệ|401 khi phiên không hợp lệ; 403 khi thiếu quyền/scope; 404 khi đối tượng không tồn tại; 409 khi trùng/không đúng version hoặc transition; 422 khi dữ liệu nghiệp vụ không hợp lệ. Không mất dữ liệu người dùng đã nhập và phải có thông báo khắc phục được.|

|Hậu điều kiện|Dữ liệu và trạng thái liên quan nhất quán; sự kiện/outbox phát đúng một lần; audit có actor, thời gian, before/after và correlation ID.|

|Tiêu chí nghiệm thu|AC1. Super Admin thực hiện được nghiệp vụ trong phạm vi được cấp và kết quả đúng mô tả.<br>AC2. Người không có quyền bị chặn nhất quán ở UI và API; không rò rỉ dữ liệu qua response/export.<br>AC3. Validation, trạng thái loading/empty/error/success và xử lý thao tác lặp được kiểm thử.<br>AC4. Giao dịch thành công được lưu bền vững, phản ánh trên màn hình liên quan và có audit/correlation ID.|

|Màn hình / Nguồn|SCR-01..04, SCR-27..33; UI-ADM-01..05, UI-ACC-01..05 \| FAMS FR-203; SCR-31|



UFR-SYS-010 - Quản lý menu item/chức năng


|CONTRACT UFR-SYS-010|CONTRACT UFR-SYS-010|

|---|---|

|Phân hệ / Ưu tiên|Quản trị hệ thống, định danh và bảo mật / Must|

|Actor / Quyền|Super Admin. Bắt buộc permission tương ứng và data scope hợp lệ.|

|Yêu cầu|CRUD module function/menu item, ánh xạ quyền và route; kiểm tra unique và dependency trước xóa.|

|Tiền điều kiện|Người dùng đã xác thực; tenant đang hoạt động; có permission và data scope phù hợp.|

|Luồng chính|1) Người dùng mở chức năng Quản lý menu item/chức năng; hệ thống tải dữ liệu theo scope.<br>2) Người dùng nhập/chọn điều kiện cần thiết; hệ thống kiểm tra validation và quyền.<br>3) Hệ thống thực hiện: CRUD module function/menu item, ánh xạ quyền và route; kiểm tra unique và dependency trước xóa.<br>4) Hệ thống lưu giao dịch, hiển thị kết quả, cập nhật dữ liệu liên quan và ghi audit/event.|

|Validation / Quy tắc|Deny-by-default; kiểm tra quyền ở UI và API; dữ liệu tách theo tenant; hành động quản trị phải audit.|

|Ngoại lệ|401 khi phiên không hợp lệ; 403 khi thiếu quyền/scope; 404 khi đối tượng không tồn tại; 409 khi trùng/không đúng version hoặc transition; 422 khi dữ liệu nghiệp vụ không hợp lệ. Không mất dữ liệu người dùng đã nhập và phải có thông báo khắc phục được.|

|Hậu điều kiện|Dữ liệu và trạng thái liên quan nhất quán; sự kiện/outbox phát đúng một lần; audit có actor, thời gian, before/after và correlation ID.|

|Tiêu chí nghiệm thu|AC1. Super Admin thực hiện được nghiệp vụ trong phạm vi được cấp và kết quả đúng mô tả.<br>AC2. Người không có quyền bị chặn nhất quán ở UI và API; không rò rỉ dữ liệu qua response/export.<br>AC3. Validation, trạng thái loading/empty/error/success và xử lý thao tác lặp được kiểm thử.<br>AC4. Giao dịch thành công được lưu bền vững, phản ánh trên màn hình liên quan và có audit/correlation ID.|

|Màn hình / Nguồn|SCR-01..04, SCR-27..33; UI-ADM-01..05, UI-ACC-01..05 \| FAMS FR-203; SCR-31|



UFR-SYS-011 - Địa điểm và phòng ban


|CONTRACT UFR-SYS-011|CONTRACT UFR-SYS-011|

|---|---|

|Phân hệ / Ưu tiên|Quản trị hệ thống, định danh và bảo mật / Must|

|Actor / Quyền|Super Admin. Bắt buộc permission tương ứng và data scope hợp lệ.|

|Yêu cầu|CRUD/import/export location, campus và department; duy trì hierarchy và dependency.|

|Tiền điều kiện|Người dùng đã xác thực; tenant đang hoạt động; có permission và data scope phù hợp.|

|Luồng chính|1) Người dùng mở chức năng Địa điểm và phòng ban; hệ thống tải dữ liệu theo scope.<br>2) Người dùng nhập/chọn điều kiện cần thiết; hệ thống kiểm tra validation và quyền.<br>3) Hệ thống thực hiện: CRUD/import/export location, campus và department; duy trì hierarchy và dependency.<br>4) Hệ thống lưu giao dịch, hiển thị kết quả, cập nhật dữ liệu liên quan và ghi audit/event.|

|Validation / Quy tắc|Deny-by-default; kiểm tra quyền ở UI và API; dữ liệu tách theo tenant; hành động quản trị phải audit.|

|Ngoại lệ|401 khi phiên không hợp lệ; 403 khi thiếu quyền/scope; 404 khi đối tượng không tồn tại; 409 khi trùng/không đúng version hoặc transition; 422 khi dữ liệu nghiệp vụ không hợp lệ. Không mất dữ liệu người dùng đã nhập và phải có thông báo khắc phục được.|

|Hậu điều kiện|Dữ liệu và trạng thái liên quan nhất quán; sự kiện/outbox phát đúng một lần; audit có actor, thời gian, before/after và correlation ID.|

|Tiêu chí nghiệm thu|AC1. Super Admin thực hiện được nghiệp vụ trong phạm vi được cấp và kết quả đúng mô tả.<br>AC2. Người không có quyền bị chặn nhất quán ở UI và API; không rò rỉ dữ liệu qua response/export.<br>AC3. Validation, trạng thái loading/empty/error/success và xử lý thao tác lặp được kiểm thử.<br>AC4. Giao dịch thành công được lưu bền vững, phản ánh trên màn hình liên quan và có audit/correlation ID.|

|Màn hình / Nguồn|SCR-01..04, SCR-27..33; UI-ADM-01..05, UI-ACC-01..05 \| FAMS FR-204|



UFR-SYS-012 - Danh mục kỹ năng


|CONTRACT UFR-SYS-012|CONTRACT UFR-SYS-012|

|---|---|

|Phân hệ / Ưu tiên|Quản trị hệ thống, định danh và bảo mật / Must|

|Actor / Quyền|Admin/Program Manager. Bắt buộc permission tương ứng và data scope hợp lệ.|

|Yêu cầu|CRUD/import/export nhóm kỹ năng, kỹ năng và liên kết với người dùng/topic.|

|Tiền điều kiện|Người dùng đã xác thực; tenant đang hoạt động; có permission và data scope phù hợp.|

|Luồng chính|1) Người dùng mở chức năng Danh mục kỹ năng; hệ thống tải dữ liệu theo scope.<br>2) Người dùng nhập/chọn điều kiện cần thiết; hệ thống kiểm tra validation và quyền.<br>3) Hệ thống thực hiện: CRUD/import/export nhóm kỹ năng, kỹ năng và liên kết với người dùng/topic.<br>4) Hệ thống lưu giao dịch, hiển thị kết quả, cập nhật dữ liệu liên quan và ghi audit/event.|

|Validation / Quy tắc|Deny-by-default; kiểm tra quyền ở UI và API; dữ liệu tách theo tenant; hành động quản trị phải audit.|

|Ngoại lệ|401 khi phiên không hợp lệ; 403 khi thiếu quyền/scope; 404 khi đối tượng không tồn tại; 409 khi trùng/không đúng version hoặc transition; 422 khi dữ liệu nghiệp vụ không hợp lệ. Không mất dữ liệu người dùng đã nhập và phải có thông báo khắc phục được.|

|Hậu điều kiện|Dữ liệu và trạng thái liên quan nhất quán; sự kiện/outbox phát đúng một lần; audit có actor, thời gian, before/after và correlation ID.|

|Tiêu chí nghiệm thu|AC1. Admin/Program Manager thực hiện được nghiệp vụ trong phạm vi được cấp và kết quả đúng mô tả.<br>AC2. Người không có quyền bị chặn nhất quán ở UI và API; không rò rỉ dữ liệu qua response/export.<br>AC3. Validation, trạng thái loading/empty/error/success và xử lý thao tác lặp được kiểm thử.<br>AC4. Giao dịch thành công được lưu bền vững, phản ánh trên màn hình liên quan và có audit/correlation ID.|

|Màn hình / Nguồn|SCR-01..04, SCR-27..33; UI-ADM-01..05, UI-ACC-01..05 \| FAMS FR-205|



UFR-SYS-013 - Cấu hình chính sách


|CONTRACT UFR-SYS-013|CONTRACT UFR-SYS-013|

|---|---|

|Phân hệ / Ưu tiên|Quản trị hệ thống, định danh và bảo mật / Must|

|Actor / Quyền|Super/School Admin. Bắt buộc permission tương ứng và data scope hợp lệ.|

|Yêu cầu|Cấu hình mật khẩu, hạn nộp, điểm, thông báo, lưu trữ, file upload và quy tắc bảo mật.|

|Tiền điều kiện|Người dùng đã xác thực; tenant đang hoạt động; có permission và data scope phù hợp.|

|Luồng chính|1) Người dùng mở chức năng Cấu hình chính sách; hệ thống tải dữ liệu theo scope.<br>2) Người dùng nhập/chọn điều kiện cần thiết; hệ thống kiểm tra validation và quyền.<br>3) Hệ thống thực hiện: Cấu hình mật khẩu, hạn nộp, điểm, thông báo, lưu trữ, file upload và quy tắc bảo mật.<br>4) Hệ thống lưu giao dịch, hiển thị kết quả, cập nhật dữ liệu liên quan và ghi audit/event.|

|Validation / Quy tắc|Deny-by-default; kiểm tra quyền ở UI và API; dữ liệu tách theo tenant; hành động quản trị phải audit.|

|Ngoại lệ|401 khi phiên không hợp lệ; 403 khi thiếu quyền/scope; 404 khi đối tượng không tồn tại; 409 khi trùng/không đúng version hoặc transition; 422 khi dữ liệu nghiệp vụ không hợp lệ. Không mất dữ liệu người dùng đã nhập và phải có thông báo khắc phục được.|

|Hậu điều kiện|Dữ liệu và trạng thái liên quan nhất quán; sự kiện/outbox phát đúng một lần; audit có actor, thời gian, before/after và correlation ID.|

|Tiêu chí nghiệm thu|AC1. Super/School Admin thực hiện được nghiệp vụ trong phạm vi được cấp và kết quả đúng mô tả.<br>AC2. Người không có quyền bị chặn nhất quán ở UI và API; không rò rỉ dữ liệu qua response/export.<br>AC3. Validation, trạng thái loading/empty/error/success và xử lý thao tác lặp được kiểm thử.<br>AC4. Giao dịch thành công được lưu bền vững, phản ánh trên màn hình liên quan và có audit/correlation ID.|

|Màn hình / Nguồn|SCR-01..04, SCR-27..33; UI-ADM-01..05, UI-ACC-01..05 \| Hub ADM-01; FAMS BR-PWD-01|



UFR-SYS-014 - Audit log


|CONTRACT UFR-SYS-014|CONTRACT UFR-SYS-014|

|---|---|

|Phân hệ / Ưu tiên|Quản trị hệ thống, định danh và bảo mật / Must|

|Actor / Quyền|Admin/Auditor. Bắt buộc permission tương ứng và data scope hợp lệ.|

|Yêu cầu|Tra cứu/lọc/export actor, hành động, đối tượng, before/after, lý do, thời gian và correlation ID.|

|Tiền điều kiện|Người dùng đã xác thực; tenant đang hoạt động; có permission và data scope phù hợp.|

|Luồng chính|1) Người dùng mở chức năng Audit log; hệ thống tải dữ liệu theo scope.<br>2) Người dùng nhập/chọn điều kiện cần thiết; hệ thống kiểm tra validation và quyền.<br>3) Hệ thống thực hiện: Tra cứu/lọc/export actor, hành động, đối tượng, before/after, lý do, thời gian và correlation ID.<br>4) Hệ thống lưu giao dịch, hiển thị kết quả, cập nhật dữ liệu liên quan và ghi audit/event.|

|Validation / Quy tắc|Deny-by-default; kiểm tra quyền ở UI và API; dữ liệu tách theo tenant; hành động quản trị phải audit.|

|Ngoại lệ|401 khi phiên không hợp lệ; 403 khi thiếu quyền/scope; 404 khi đối tượng không tồn tại; 409 khi trùng/không đúng version hoặc transition; 422 khi dữ liệu nghiệp vụ không hợp lệ. Không mất dữ liệu người dùng đã nhập và phải có thông báo khắc phục được.|

|Hậu điều kiện|Dữ liệu và trạng thái liên quan nhất quán; sự kiện/outbox phát đúng một lần; audit có actor, thời gian, before/after và correlation ID.|

|Tiêu chí nghiệm thu|AC1. Admin/Auditor thực hiện được nghiệp vụ trong phạm vi được cấp và kết quả đúng mô tả.<br>AC2. Người không có quyền bị chặn nhất quán ở UI và API; không rò rỉ dữ liệu qua response/export.<br>AC3. Validation, trạng thái loading/empty/error/success và xử lý thao tác lặp được kiểm thử.<br>AC4. Giao dịch thành công được lưu bền vững, phản ánh trên màn hình liên quan và có audit/correlation ID.|

|Màn hình / Nguồn|SCR-01..04, SCR-27..33; UI-ADM-01..05, UI-ACC-01..05 \| Hub ADM-04; FAMS FR-227|



UFR-SYS-015 - API và webhook


|CONTRACT UFR-SYS-015|CONTRACT UFR-SYS-015|

|---|---|

|Phân hệ / Ưu tiên|Quản trị hệ thống, định danh và bảo mật / Should|

|Actor / Quyền|Admin/Integration. Bắt buộc permission tương ứng và data scope hợp lệ.|

|Yêu cầu|API version hóa và webhook có chữ ký cho user, project, submission, grade và sự kiện tích hợp được duyệt.|

|Tiền điều kiện|Người dùng đã xác thực; tenant đang hoạt động; có permission và data scope phù hợp.|

|Luồng chính|1) Người dùng mở chức năng API và webhook; hệ thống tải dữ liệu theo scope.<br>2) Người dùng nhập/chọn điều kiện cần thiết; hệ thống kiểm tra validation và quyền.<br>3) Hệ thống thực hiện: API version hóa và webhook có chữ ký cho user, project, submission, grade và sự kiện tích hợp được duyệt.<br>4) Hệ thống lưu giao dịch, hiển thị kết quả, cập nhật dữ liệu liên quan và ghi audit/event.|

|Validation / Quy tắc|Deny-by-default; kiểm tra quyền ở UI và API; dữ liệu tách theo tenant; hành động quản trị phải audit.|

|Ngoại lệ|401 khi phiên không hợp lệ; 403 khi thiếu quyền/scope; 404 khi đối tượng không tồn tại; 409 khi trùng/không đúng version hoặc transition; 422 khi dữ liệu nghiệp vụ không hợp lệ. Không mất dữ liệu người dùng đã nhập và phải có thông báo khắc phục được.|

|Hậu điều kiện|Dữ liệu và trạng thái liên quan nhất quán; sự kiện/outbox phát đúng một lần; audit có actor, thời gian, before/after và correlation ID.|

|Tiêu chí nghiệm thu|AC1. Admin/Integration thực hiện được nghiệp vụ trong phạm vi được cấp và kết quả đúng mô tả.<br>AC2. Người không có quyền bị chặn nhất quán ở UI và API; không rò rỉ dữ liệu qua response/export.<br>AC3. Validation, trạng thái loading/empty/error/success và xử lý thao tác lặp được kiểm thử.<br>AC4. Giao dịch thành công được lưu bền vững, phản ánh trên màn hình liên quan và có audit/correlation ID.|

|Màn hình / Nguồn|SCR-01..04, SCR-27..33; UI-ADM-01..05, UI-ACC-01..05 \| Hub ADM-03,05|




## 5.2 Quản lý chương trình, học liệu và nhu cầu đào tạo

UFR-CUR-001 - Danh mục topic


|CONTRACT UFR-CUR-001|CONTRACT UFR-CUR-001|

|---|---|

|Phân hệ / Ưu tiên|Quản lý chương trình, học liệu và nhu cầu đào tạo / Must|

|Actor / Quyền|Program Manager. Bắt buộc permission tương ứng và data scope hợp lệ.|

|Yêu cầu|Tạo, sửa, tra cứu, import/export, clone version, submit và activate topic.|

|Tiền điều kiện|Người dùng đã xác thực; tenant đang hoạt động; có permission và data scope phù hợp.|

|Luồng chính|1) Người dùng mở chức năng Danh mục topic; hệ thống tải dữ liệu theo scope.<br>2) Người dùng nhập/chọn điều kiện cần thiết; hệ thống kiểm tra validation và quyền.<br>3) Hệ thống thực hiện: Tạo, sửa, tra cứu, import/export, clone version, submit và activate topic.<br>4) Hệ thống lưu giao dịch, hiển thị kết quả, cập nhật dữ liệu liên quan và ghi audit/event.|

|Validation / Quy tắc|Nội dung dùng version; bản ACTIVE đang được lớp sử dụng không sửa trực tiếp; publish cần review/approve.|

|Ngoại lệ|401 khi phiên không hợp lệ; 403 khi thiếu quyền/scope; 404 khi đối tượng không tồn tại; 409 khi trùng/không đúng version hoặc transition; 422 khi dữ liệu nghiệp vụ không hợp lệ. Không mất dữ liệu người dùng đã nhập và phải có thông báo khắc phục được.|

|Hậu điều kiện|Dữ liệu và trạng thái liên quan nhất quán; sự kiện/outbox phát đúng một lần; audit có actor, thời gian, before/after và correlation ID.|

|Tiêu chí nghiệm thu|AC1. Program Manager thực hiện được nghiệp vụ trong phạm vi được cấp và kết quả đúng mô tả.<br>AC2. Người không có quyền bị chặn nhất quán ở UI và API; không rò rỉ dữ liệu qua response/export.<br>AC3. Validation, trạng thái loading/empty/error/success và xử lý thao tác lặp được kiểm thử.<br>AC4. Giao dịch thành công được lưu bền vững, phản ánh trên màn hình liên quan và có audit/correlation ID.|

|Màn hình / Nguồn|SCR-34..47; UI-STD-08, UI-MNT-03 \| FAMS FR-206|



UFR-CUR-002 - Thiết kế topic


|CONTRACT UFR-CUR-002|CONTRACT UFR-CUR-002|

|---|---|

|Phân hệ / Ưu tiên|Quản lý chương trình, học liệu và nhu cầu đào tạo / Must|

|Actor / Quyền|Program Manager. Bắt buộc permission tương ứng và data scope hợp lệ.|

|Yêu cầu|Quản lý overview, skill, objective, assessment scheme, delivery principle, outline và time allocation.|

|Tiền điều kiện|Người dùng đã xác thực; tenant đang hoạt động; có permission và data scope phù hợp.|

|Luồng chính|1) Người dùng mở chức năng Thiết kế topic; hệ thống tải dữ liệu theo scope.<br>2) Người dùng nhập/chọn điều kiện cần thiết; hệ thống kiểm tra validation và quyền.<br>3) Hệ thống thực hiện: Quản lý overview, skill, objective, assessment scheme, delivery principle, outline và time allocation.<br>4) Hệ thống lưu giao dịch, hiển thị kết quả, cập nhật dữ liệu liên quan và ghi audit/event.|

|Validation / Quy tắc|Nội dung dùng version; bản ACTIVE đang được lớp sử dụng không sửa trực tiếp; publish cần review/approve.|

|Ngoại lệ|401 khi phiên không hợp lệ; 403 khi thiếu quyền/scope; 404 khi đối tượng không tồn tại; 409 khi trùng/không đúng version hoặc transition; 422 khi dữ liệu nghiệp vụ không hợp lệ. Không mất dữ liệu người dùng đã nhập và phải có thông báo khắc phục được.|

|Hậu điều kiện|Dữ liệu và trạng thái liên quan nhất quán; sự kiện/outbox phát đúng một lần; audit có actor, thời gian, before/after và correlation ID.|

|Tiêu chí nghiệm thu|AC1. Program Manager thực hiện được nghiệp vụ trong phạm vi được cấp và kết quả đúng mô tả.<br>AC2. Người không có quyền bị chặn nhất quán ở UI và API; không rò rỉ dữ liệu qua response/export.<br>AC3. Validation, trạng thái loading/empty/error/success và xử lý thao tác lặp được kiểm thử.<br>AC4. Giao dịch thành công được lưu bền vững, phản ánh trên màn hình liên quan và có audit/correlation ID.|

|Màn hình / Nguồn|SCR-34..47; UI-STD-08, UI-MNT-03 \| FAMS FR-206; SCR-35..37|



UFR-CUR-003 - Gợi ý outline bằng AI


|CONTRACT UFR-CUR-003|CONTRACT UFR-CUR-003|

|---|---|

|Phân hệ / Ưu tiên|Quản lý chương trình, học liệu và nhu cầu đào tạo / Should|

|Actor / Quyền|Program Manager. Bắt buộc permission tương ứng và data scope hợp lệ.|

|Yêu cầu|Sinh preview learning path/outline từ metadata; chỉ lưu sau khi người có thẩm quyền review và xác nhận.|

|Tiền điều kiện|Người dùng đã xác thực; tenant đang hoạt động; có permission và data scope phù hợp.|

|Luồng chính|1) Người dùng mở chức năng Gợi ý outline bằng AI; hệ thống tải dữ liệu theo scope.<br>2) Người dùng nhập/chọn điều kiện cần thiết; hệ thống kiểm tra validation và quyền.<br>3) Hệ thống thực hiện: Sinh preview learning path/outline từ metadata; chỉ lưu sau khi người có thẩm quyền review và xác nhận.<br>4) Hệ thống lưu giao dịch, hiển thị kết quả, cập nhật dữ liệu liên quan và ghi audit/event.|

|Validation / Quy tắc|Nội dung dùng version; bản ACTIVE đang được lớp sử dụng không sửa trực tiếp; publish cần review/approve.|

|Ngoại lệ|401 khi phiên không hợp lệ; 403 khi thiếu quyền/scope; 404 khi đối tượng không tồn tại; 409 khi trùng/không đúng version hoặc transition; 422 khi dữ liệu nghiệp vụ không hợp lệ. Không mất dữ liệu người dùng đã nhập và phải có thông báo khắc phục được.|

|Hậu điều kiện|Dữ liệu và trạng thái liên quan nhất quán; sự kiện/outbox phát đúng một lần; audit có actor, thời gian, before/after và correlation ID.|

|Tiêu chí nghiệm thu|AC1. Program Manager thực hiện được nghiệp vụ trong phạm vi được cấp và kết quả đúng mô tả.<br>AC2. Người không có quyền bị chặn nhất quán ở UI và API; không rò rỉ dữ liệu qua response/export.<br>AC3. Validation, trạng thái loading/empty/error/success và xử lý thao tác lặp được kiểm thử.<br>AC4. Giao dịch thành công được lưu bền vững, phản ánh trên màn hình liên quan và có audit/correlation ID.|

|Màn hình / Nguồn|SCR-34..47; UI-STD-08, UI-MNT-03 \| FAMS FR-207|



UFR-CUR-004 - Soạn course


|CONTRACT UFR-CUR-004|CONTRACT UFR-CUR-004|

|---|---|

|Phân hệ / Ưu tiên|Quản lý chương trình, học liệu và nhu cầu đào tạo / Should|

|Actor / Quyền|Trainer/Program Manager. Bắt buộc permission tương ứng và data scope hợp lệ.|

|Yêu cầu|Tạo course, gán trainer, quản lý overview, scheme, objective, outline, lesson/session, material và thời lượng.|

|Tiền điều kiện|Người dùng đã xác thực; tenant đang hoạt động; có permission và data scope phù hợp.|

|Luồng chính|1) Người dùng mở chức năng Soạn course; hệ thống tải dữ liệu theo scope.<br>2) Người dùng nhập/chọn điều kiện cần thiết; hệ thống kiểm tra validation và quyền.<br>3) Hệ thống thực hiện: Tạo course, gán trainer, quản lý overview, scheme, objective, outline, lesson/session, material và thời lượng.<br>4) Hệ thống lưu giao dịch, hiển thị kết quả, cập nhật dữ liệu liên quan và ghi audit/event.|

|Validation / Quy tắc|Nội dung dùng version; bản ACTIVE đang được lớp sử dụng không sửa trực tiếp; publish cần review/approve.|

|Ngoại lệ|401 khi phiên không hợp lệ; 403 khi thiếu quyền/scope; 404 khi đối tượng không tồn tại; 409 khi trùng/không đúng version hoặc transition; 422 khi dữ liệu nghiệp vụ không hợp lệ. Không mất dữ liệu người dùng đã nhập và phải có thông báo khắc phục được.|

|Hậu điều kiện|Dữ liệu và trạng thái liên quan nhất quán; sự kiện/outbox phát đúng một lần; audit có actor, thời gian, before/after và correlation ID.|

|Tiêu chí nghiệm thu|AC1. Trainer/Program Manager thực hiện được nghiệp vụ trong phạm vi được cấp và kết quả đúng mô tả.<br>AC2. Người không có quyền bị chặn nhất quán ở UI và API; không rò rỉ dữ liệu qua response/export.<br>AC3. Validation, trạng thái loading/empty/error/success và xử lý thao tác lặp được kiểm thử.<br>AC4. Giao dịch thành công được lưu bền vững, phản ánh trên màn hình liên quan và có audit/correlation ID.|

|Màn hình / Nguồn|SCR-34..47; UI-STD-08, UI-MNT-03 \| FAMS FR-208|



UFR-CUR-005 - Phê duyệt course


|CONTRACT UFR-CUR-005|CONTRACT UFR-CUR-005|

|---|---|

|Phân hệ / Ưu tiên|Quản lý chương trình, học liệu và nhu cầu đào tạo / Must|

|Actor / Quyền|Program Manager. Bắt buộc permission tương ứng và data scope hợp lệ.|

|Yêu cầu|Submit, review, approve/reject kèm ghi chú; duy trì version, trạng thái và lịch sử.|

|Tiền điều kiện|Người dùng đã xác thực; tenant đang hoạt động; có permission và data scope phù hợp.|

|Luồng chính|1) Người dùng mở chức năng Phê duyệt course; hệ thống tải dữ liệu theo scope.<br>2) Người dùng nhập/chọn điều kiện cần thiết; hệ thống kiểm tra validation và quyền.<br>3) Hệ thống thực hiện: Submit, review, approve/reject kèm ghi chú; duy trì version, trạng thái và lịch sử.<br>4) Hệ thống lưu giao dịch, hiển thị kết quả, cập nhật dữ liệu liên quan và ghi audit/event.|

|Validation / Quy tắc|Nội dung dùng version; bản ACTIVE đang được lớp sử dụng không sửa trực tiếp; publish cần review/approve.|

|Ngoại lệ|401 khi phiên không hợp lệ; 403 khi thiếu quyền/scope; 404 khi đối tượng không tồn tại; 409 khi trùng/không đúng version hoặc transition; 422 khi dữ liệu nghiệp vụ không hợp lệ. Không mất dữ liệu người dùng đã nhập và phải có thông báo khắc phục được.|

|Hậu điều kiện|Dữ liệu và trạng thái liên quan nhất quán; sự kiện/outbox phát đúng một lần; audit có actor, thời gian, before/after và correlation ID.|

|Tiêu chí nghiệm thu|AC1. Program Manager thực hiện được nghiệp vụ trong phạm vi được cấp và kết quả đúng mô tả.<br>AC2. Người không có quyền bị chặn nhất quán ở UI và API; không rò rỉ dữ liệu qua response/export.<br>AC3. Validation, trạng thái loading/empty/error/success và xử lý thao tác lặp được kiểm thử.<br>AC4. Giao dịch thành công được lưu bền vững, phản ánh trên màn hình liên quan và có audit/correlation ID.|

|Màn hình / Nguồn|SCR-34..47; UI-STD-08, UI-MNT-03 \| FAMS FR-209|



UFR-CUR-006 - Training Program


|CONTRACT UFR-CUR-006|CONTRACT UFR-CUR-006|

|---|---|

|Phân hệ / Ưu tiên|Quản lý chương trình, học liệu và nhu cầu đào tạo / Should|

|Actor / Quyền|Program Manager. Bắt buộc permission tương ứng và data scope hợp lệ.|

|Yêu cầu|CRUD/version chương trình, cấu thành và thứ tự topic; chỉ version ACTIVE được dùng mở lớp.|

|Tiền điều kiện|Người dùng đã xác thực; tenant đang hoạt động; có permission và data scope phù hợp.|

|Luồng chính|1) Người dùng mở chức năng Training Program; hệ thống tải dữ liệu theo scope.<br>2) Người dùng nhập/chọn điều kiện cần thiết; hệ thống kiểm tra validation và quyền.<br>3) Hệ thống thực hiện: CRUD/version chương trình, cấu thành và thứ tự topic; chỉ version ACTIVE được dùng mở lớp.<br>4) Hệ thống lưu giao dịch, hiển thị kết quả, cập nhật dữ liệu liên quan và ghi audit/event.|

|Validation / Quy tắc|Nội dung dùng version; bản ACTIVE đang được lớp sử dụng không sửa trực tiếp; publish cần review/approve.|

|Ngoại lệ|401 khi phiên không hợp lệ; 403 khi thiếu quyền/scope; 404 khi đối tượng không tồn tại; 409 khi trùng/không đúng version hoặc transition; 422 khi dữ liệu nghiệp vụ không hợp lệ. Không mất dữ liệu người dùng đã nhập và phải có thông báo khắc phục được.|

|Hậu điều kiện|Dữ liệu và trạng thái liên quan nhất quán; sự kiện/outbox phát đúng một lần; audit có actor, thời gian, before/after và correlation ID.|

|Tiêu chí nghiệm thu|AC1. Program Manager thực hiện được nghiệp vụ trong phạm vi được cấp và kết quả đúng mô tả.<br>AC2. Người không có quyền bị chặn nhất quán ở UI và API; không rò rỉ dữ liệu qua response/export.<br>AC3. Validation, trạng thái loading/empty/error/success và xử lý thao tác lặp được kiểm thử.<br>AC4. Giao dịch thành công được lưu bền vững, phản ánh trên màn hình liên quan và có audit/correlation ID.|

|Màn hình / Nguồn|SCR-34..47; UI-STD-08, UI-MNT-03 \| FAMS FR-210|



UFR-CUR-007 - Nhu cầu mở lớp


|CONTRACT UFR-CUR-007|CONTRACT UFR-CUR-007|

|---|---|

|Phân hệ / Ưu tiên|Quản lý chương trình, học liệu và nhu cầu đào tạo / Must|

|Actor / Quyền|Dept./Program Manager. Bắt buộc permission tương ứng và data scope hợp lệ.|

|Yêu cầu|Tạo/sửa draft, submit/cancel, review, approve/reject và liên kết chương trình sau duyệt.|

|Tiền điều kiện|Người dùng đã xác thực; tenant đang hoạt động; có permission và data scope phù hợp.|

|Luồng chính|1) Người dùng mở chức năng Nhu cầu mở lớp; hệ thống tải dữ liệu theo scope.<br>2) Người dùng nhập/chọn điều kiện cần thiết; hệ thống kiểm tra validation và quyền.<br>3) Hệ thống thực hiện: Tạo/sửa draft, submit/cancel, review, approve/reject và liên kết chương trình sau duyệt.<br>4) Hệ thống lưu giao dịch, hiển thị kết quả, cập nhật dữ liệu liên quan và ghi audit/event.|

|Validation / Quy tắc|Nội dung dùng version; bản ACTIVE đang được lớp sử dụng không sửa trực tiếp; publish cần review/approve.|

|Ngoại lệ|401 khi phiên không hợp lệ; 403 khi thiếu quyền/scope; 404 khi đối tượng không tồn tại; 409 khi trùng/không đúng version hoặc transition; 422 khi dữ liệu nghiệp vụ không hợp lệ. Không mất dữ liệu người dùng đã nhập và phải có thông báo khắc phục được.|

|Hậu điều kiện|Dữ liệu và trạng thái liên quan nhất quán; sự kiện/outbox phát đúng một lần; audit có actor, thời gian, before/after và correlation ID.|

|Tiêu chí nghiệm thu|AC1. Dept./Program Manager thực hiện được nghiệp vụ trong phạm vi được cấp và kết quả đúng mô tả.<br>AC2. Người không có quyền bị chặn nhất quán ở UI và API; không rò rỉ dữ liệu qua response/export.<br>AC3. Validation, trạng thái loading/empty/error/success và xử lý thao tác lặp được kiểm thử.<br>AC4. Giao dịch thành công được lưu bền vững, phản ánh trên màn hình liên quan và có audit/correlation ID.|

|Màn hình / Nguồn|SCR-34..47; UI-STD-08, UI-MNT-03 \| FAMS FR-211|



UFR-CUR-008 - Thư viện đề bài Mock Project


|CONTRACT UFR-CUR-008|CONTRACT UFR-CUR-008|

|---|---|

|Phân hệ / Ưu tiên|Quản lý chương trình, học liệu và nhu cầu đào tạo / Must|

|Actor / Quyền|Admin/Mentor. Bắt buộc permission tương ứng và data scope hợp lệ.|

|Yêu cầu|Tạo đề bài gồm bối cảnh, mục tiêu, phạm vi, persona, ràng buộc, deliverable và tiêu chí hoàn thành.|

|Tiền điều kiện|Người dùng đã xác thực; tenant đang hoạt động; có permission và data scope phù hợp.|

|Luồng chính|1) Người dùng mở chức năng Thư viện đề bài Mock Project; hệ thống tải dữ liệu theo scope.<br>2) Người dùng nhập/chọn điều kiện cần thiết; hệ thống kiểm tra validation và quyền.<br>3) Hệ thống thực hiện: Tạo đề bài gồm bối cảnh, mục tiêu, phạm vi, persona, ràng buộc, deliverable và tiêu chí hoàn thành.<br>4) Hệ thống lưu giao dịch, hiển thị kết quả, cập nhật dữ liệu liên quan và ghi audit/event.|

|Validation / Quy tắc|Nội dung dùng version; bản ACTIVE đang được lớp sử dụng không sửa trực tiếp; publish cần review/approve.|

|Ngoại lệ|401 khi phiên không hợp lệ; 403 khi thiếu quyền/scope; 404 khi đối tượng không tồn tại; 409 khi trùng/không đúng version hoặc transition; 422 khi dữ liệu nghiệp vụ không hợp lệ. Không mất dữ liệu người dùng đã nhập và phải có thông báo khắc phục được.|

|Hậu điều kiện|Dữ liệu và trạng thái liên quan nhất quán; sự kiện/outbox phát đúng một lần; audit có actor, thời gian, before/after và correlation ID.|

|Tiêu chí nghiệm thu|AC1. Admin/Mentor thực hiện được nghiệp vụ trong phạm vi được cấp và kết quả đúng mô tả.<br>AC2. Người không có quyền bị chặn nhất quán ở UI và API; không rò rỉ dữ liệu qua response/export.<br>AC3. Validation, trạng thái loading/empty/error/success và xử lý thao tác lặp được kiểm thử.<br>AC4. Giao dịch thành công được lưu bền vững, phản ánh trên màn hình liên quan và có audit/correlation ID.|

|Màn hình / Nguồn|SCR-34..47; UI-STD-08, UI-MNT-03 \| Hub LIB-01|



UFR-CUR-009 - Version đề bài


|CONTRACT UFR-CUR-009|CONTRACT UFR-CUR-009|

|---|---|

|Phân hệ / Ưu tiên|Quản lý chương trình, học liệu và nhu cầu đào tạo / Must|

|Actor / Quyền|Admin/Mentor. Bắt buộc permission tương ứng và data scope hợp lệ.|

|Yêu cầu|Version hóa và snapshot đề bài khi tạo project; sửa bản gốc không tự thay đổi project đang chạy.|

|Tiền điều kiện|Người dùng đã xác thực; tenant đang hoạt động; có permission và data scope phù hợp.|

|Luồng chính|1) Người dùng mở chức năng Version đề bài; hệ thống tải dữ liệu theo scope.<br>2) Người dùng nhập/chọn điều kiện cần thiết; hệ thống kiểm tra validation và quyền.<br>3) Hệ thống thực hiện: Version hóa và snapshot đề bài khi tạo project; sửa bản gốc không tự thay đổi project đang chạy.<br>4) Hệ thống lưu giao dịch, hiển thị kết quả, cập nhật dữ liệu liên quan và ghi audit/event.|

|Validation / Quy tắc|Nội dung dùng version; bản ACTIVE đang được lớp sử dụng không sửa trực tiếp; publish cần review/approve.|

|Ngoại lệ|401 khi phiên không hợp lệ; 403 khi thiếu quyền/scope; 404 khi đối tượng không tồn tại; 409 khi trùng/không đúng version hoặc transition; 422 khi dữ liệu nghiệp vụ không hợp lệ. Không mất dữ liệu người dùng đã nhập và phải có thông báo khắc phục được.|

|Hậu điều kiện|Dữ liệu và trạng thái liên quan nhất quán; sự kiện/outbox phát đúng một lần; audit có actor, thời gian, before/after và correlation ID.|

|Tiêu chí nghiệm thu|AC1. Admin/Mentor thực hiện được nghiệp vụ trong phạm vi được cấp và kết quả đúng mô tả.<br>AC2. Người không có quyền bị chặn nhất quán ở UI và API; không rò rỉ dữ liệu qua response/export.<br>AC3. Validation, trạng thái loading/empty/error/success và xử lý thao tác lặp được kiểm thử.<br>AC4. Giao dịch thành công được lưu bền vững, phản ánh trên màn hình liên quan và có audit/correlation ID.|

|Màn hình / Nguồn|SCR-34..47; UI-STD-08, UI-MNT-03 \| Hub LIB-02|



UFR-CUR-010 - Phân loại và phân quyền đề bài


|CONTRACT UFR-CUR-010|CONTRACT UFR-CUR-010|

|---|---|

|Phân hệ / Ưu tiên|Quản lý chương trình, học liệu và nhu cầu đào tạo / Should|

|Actor / Quyền|Admin/Mentor. Bắt buộc permission tương ứng và data scope hợp lệ.|

|Yêu cầu|Tag công nghệ, vai trò, độ khó, thời lượng, chuẩn đầu ra; clone, archive, preview và giới hạn tenant/cohort.|

|Tiền điều kiện|Người dùng đã xác thực; tenant đang hoạt động; có permission và data scope phù hợp.|

|Luồng chính|1) Người dùng mở chức năng Phân loại và phân quyền đề bài; hệ thống tải dữ liệu theo scope.<br>2) Người dùng nhập/chọn điều kiện cần thiết; hệ thống kiểm tra validation và quyền.<br>3) Hệ thống thực hiện: Tag công nghệ, vai trò, độ khó, thời lượng, chuẩn đầu ra; clone, archive, preview và giới hạn tenant/cohort.<br>4) Hệ thống lưu giao dịch, hiển thị kết quả, cập nhật dữ liệu liên quan và ghi audit/event.|

|Validation / Quy tắc|Nội dung dùng version; bản ACTIVE đang được lớp sử dụng không sửa trực tiếp; publish cần review/approve.|

|Ngoại lệ|401 khi phiên không hợp lệ; 403 khi thiếu quyền/scope; 404 khi đối tượng không tồn tại; 409 khi trùng/không đúng version hoặc transition; 422 khi dữ liệu nghiệp vụ không hợp lệ. Không mất dữ liệu người dùng đã nhập và phải có thông báo khắc phục được.|

|Hậu điều kiện|Dữ liệu và trạng thái liên quan nhất quán; sự kiện/outbox phát đúng một lần; audit có actor, thời gian, before/after và correlation ID.|

|Tiêu chí nghiệm thu|AC1. Admin/Mentor thực hiện được nghiệp vụ trong phạm vi được cấp và kết quả đúng mô tả.<br>AC2. Người không có quyền bị chặn nhất quán ở UI và API; không rò rỉ dữ liệu qua response/export.<br>AC3. Validation, trạng thái loading/empty/error/success và xử lý thao tác lặp được kiểm thử.<br>AC4. Giao dịch thành công được lưu bền vững, phản ánh trên màn hình liên quan và có audit/correlation ID.|

|Màn hình / Nguồn|SCR-34..47; UI-STD-08, UI-MNT-03 \| Hub LIB-03,04|



UFR-CUR-011 - Template nghiệp vụ


|CONTRACT UFR-CUR-011|CONTRACT UFR-CUR-011|

|---|---|

|Phân hệ / Ưu tiên|Quản lý chương trình, học liệu và nhu cầu đào tạo / Should|

|Actor / Quyền|Admin/Mentor. Bắt buộc permission tương ứng và data scope hợp lệ.|

|Yêu cầu|Quản lý template tài liệu, checklist, rubric, scorecard và nội dung thông báo/email.|

|Tiền điều kiện|Người dùng đã xác thực; tenant đang hoạt động; có permission và data scope phù hợp.|

|Luồng chính|1) Người dùng mở chức năng Template nghiệp vụ; hệ thống tải dữ liệu theo scope.<br>2) Người dùng nhập/chọn điều kiện cần thiết; hệ thống kiểm tra validation và quyền.<br>3) Hệ thống thực hiện: Quản lý template tài liệu, checklist, rubric, scorecard và nội dung thông báo/email.<br>4) Hệ thống lưu giao dịch, hiển thị kết quả, cập nhật dữ liệu liên quan và ghi audit/event.|

|Validation / Quy tắc|Nội dung dùng version; bản ACTIVE đang được lớp sử dụng không sửa trực tiếp; publish cần review/approve.|

|Ngoại lệ|401 khi phiên không hợp lệ; 403 khi thiếu quyền/scope; 404 khi đối tượng không tồn tại; 409 khi trùng/không đúng version hoặc transition; 422 khi dữ liệu nghiệp vụ không hợp lệ. Không mất dữ liệu người dùng đã nhập và phải có thông báo khắc phục được.|

|Hậu điều kiện|Dữ liệu và trạng thái liên quan nhất quán; sự kiện/outbox phát đúng một lần; audit có actor, thời gian, before/after và correlation ID.|

|Tiêu chí nghiệm thu|AC1. Admin/Mentor thực hiện được nghiệp vụ trong phạm vi được cấp và kết quả đúng mô tả.<br>AC2. Người không có quyền bị chặn nhất quán ở UI và API; không rò rỉ dữ liệu qua response/export.<br>AC3. Validation, trạng thái loading/empty/error/success và xử lý thao tác lặp được kiểm thử.<br>AC4. Giao dịch thành công được lưu bền vững, phản ánh trên màn hình liên quan và có audit/correlation ID.|

|Màn hình / Nguồn|SCR-34..47; UI-STD-08, UI-MNT-03 \| Hub LIB-05|




## 5.3 Quản lý học viên, lớp, cohort và nhóm

UFR-PEO-001 - Danh sách học viên


|CONTRACT UFR-PEO-001|CONTRACT UFR-PEO-001|

|---|---|

|Phân hệ / Ưu tiên|Quản lý học viên, lớp, cohort và nhóm / Must|

|Actor / Quyền|Class Admin/Trainer. Bắt buộc permission tương ứng và data scope hợp lệ.|

|Yêu cầu|Danh sách toàn hệ thống/theo lớp với tìm kiếm, lọc, sắp xếp, phân trang và data scope.|

|Tiền điều kiện|Người dùng đã xác thực; tenant đang hoạt động; có permission và data scope phù hợp. Hồ sơ học viên/lớp tồn tại và chưa bị xóa cứng.|

|Luồng chính|1) Người dùng mở chức năng Danh sách học viên; hệ thống tải dữ liệu theo scope.<br>2) Người dùng nhập/chọn điều kiện cần thiết; hệ thống kiểm tra validation và quyền.<br>3) Hệ thống thực hiện: Danh sách toàn hệ thống/theo lớp với tìm kiếm, lọc, sắp xếp, phân trang và data scope.<br>4) Hệ thống lưu giao dịch, hiển thị kết quả, cập nhật dữ liệu liên quan và ghi audit/event.|

|Validation / Quy tắc|Mã học viên/lớp là duy nhất theo tenant; cập nhật roster phải kiểm tra lớp, thời gian, sức chứa và optimistic locking.|

|Ngoại lệ|401 khi phiên không hợp lệ; 403 khi thiếu quyền/scope; 404 khi đối tượng không tồn tại; 409 khi trùng/không đúng version hoặc transition; 422 khi dữ liệu nghiệp vụ không hợp lệ. Không mất dữ liệu người dùng đã nhập và phải có thông báo khắc phục được.|

|Hậu điều kiện|Dữ liệu và trạng thái liên quan nhất quán; sự kiện/outbox phát đúng một lần; audit có actor, thời gian, before/after và correlation ID.|

|Tiêu chí nghiệm thu|AC1. Class Admin/Trainer thực hiện được nghiệp vụ trong phạm vi được cấp và kết quả đúng mô tả.<br>AC2. Người không có quyền bị chặn nhất quán ở UI và API; không rò rỉ dữ liệu qua response/export.<br>AC3. Validation, trạng thái loading/empty/error/success và xử lý thao tác lặp được kiểm thử.<br>AC4. Giao dịch thành công được lưu bền vững, phản ánh trên màn hình liên quan và có audit/correlation ID.|

|Màn hình / Nguồn|SCR-05..12, SCR-48..53; UI-STD-09, UI-STD-12, UI-MNT-01..02 \| FAMS STU-01,02|



UFR-PEO-002 - Hồ sơ học viên


|CONTRACT UFR-PEO-002|CONTRACT UFR-PEO-002|

|---|---|

|Phân hệ / Ưu tiên|Quản lý học viên, lớp, cohort và nhóm / Should|

|Actor / Quyền|Class Admin/Trainer. Bắt buộc permission tương ứng và data scope hợp lệ.|

|Yêu cầu|Xem chi tiết thông tin, lớp, trạng thái, kỹ năng, kết quả, bảo lưu, email và audit theo quyền.|

|Tiền điều kiện|Người dùng đã xác thực; tenant đang hoạt động; có permission và data scope phù hợp. Hồ sơ học viên/lớp tồn tại và chưa bị xóa cứng.|

|Luồng chính|1) Người dùng mở chức năng Hồ sơ học viên; hệ thống tải dữ liệu theo scope.<br>2) Người dùng nhập/chọn điều kiện cần thiết; hệ thống kiểm tra validation và quyền.<br>3) Hệ thống thực hiện: Xem chi tiết thông tin, lớp, trạng thái, kỹ năng, kết quả, bảo lưu, email và audit theo quyền.<br>4) Hệ thống lưu giao dịch, hiển thị kết quả, cập nhật dữ liệu liên quan và ghi audit/event.|

|Validation / Quy tắc|Mã học viên/lớp là duy nhất theo tenant; cập nhật roster phải kiểm tra lớp, thời gian, sức chứa và optimistic locking.|

|Ngoại lệ|401 khi phiên không hợp lệ; 403 khi thiếu quyền/scope; 404 khi đối tượng không tồn tại; 409 khi trùng/không đúng version hoặc transition; 422 khi dữ liệu nghiệp vụ không hợp lệ. Không mất dữ liệu người dùng đã nhập và phải có thông báo khắc phục được.|

|Hậu điều kiện|Dữ liệu và trạng thái liên quan nhất quán; sự kiện/outbox phát đúng một lần; audit có actor, thời gian, before/after và correlation ID.|

|Tiêu chí nghiệm thu|AC1. Class Admin/Trainer thực hiện được nghiệp vụ trong phạm vi được cấp và kết quả đúng mô tả.<br>AC2. Người không có quyền bị chặn nhất quán ở UI và API; không rò rỉ dữ liệu qua response/export.<br>AC3. Validation, trạng thái loading/empty/error/success và xử lý thao tác lặp được kiểm thử.<br>AC4. Giao dịch thành công được lưu bền vững, phản ánh trên màn hình liên quan và có audit/correlation ID.|

|Màn hình / Nguồn|SCR-05..12, SCR-48..53; UI-STD-09, UI-STD-12, UI-MNT-01..02 \| FAMS STU-02|



UFR-PEO-003 - Tạo/sửa học viên


|CONTRACT UFR-PEO-003|CONTRACT UFR-PEO-003|

|---|---|

|Phân hệ / Ưu tiên|Quản lý học viên, lớp, cohort và nhóm / Must|

|Actor / Quyền|Class Admin. Bắt buộc permission tương ứng và data scope hợp lệ.|

|Yêu cầu|Tạo và cập nhật hồ sơ với validation unique, field lock theo trạng thái và optimistic locking.|

|Tiền điều kiện|Người dùng đã xác thực; tenant đang hoạt động; có permission và data scope phù hợp. Hồ sơ học viên/lớp tồn tại và chưa bị xóa cứng.|

|Luồng chính|1) Người dùng mở chức năng Tạo/sửa học viên; hệ thống tải dữ liệu theo scope.<br>2) Người dùng nhập/chọn điều kiện cần thiết; hệ thống kiểm tra validation và quyền.<br>3) Hệ thống thực hiện: Tạo và cập nhật hồ sơ với validation unique, field lock theo trạng thái và optimistic locking.<br>4) Hệ thống lưu giao dịch, hiển thị kết quả, cập nhật dữ liệu liên quan và ghi audit/event.|

|Validation / Quy tắc|Mã học viên/lớp là duy nhất theo tenant; cập nhật roster phải kiểm tra lớp, thời gian, sức chứa và optimistic locking.|

|Ngoại lệ|401 khi phiên không hợp lệ; 403 khi thiếu quyền/scope; 404 khi đối tượng không tồn tại; 409 khi trùng/không đúng version hoặc transition; 422 khi dữ liệu nghiệp vụ không hợp lệ. Không mất dữ liệu người dùng đã nhập và phải có thông báo khắc phục được.|

|Hậu điều kiện|Dữ liệu và trạng thái liên quan nhất quán; sự kiện/outbox phát đúng một lần; audit có actor, thời gian, before/after và correlation ID.|

|Tiêu chí nghiệm thu|AC1. Class Admin thực hiện được nghiệp vụ trong phạm vi được cấp và kết quả đúng mô tả.<br>AC2. Người không có quyền bị chặn nhất quán ở UI và API; không rò rỉ dữ liệu qua response/export.<br>AC3. Validation, trạng thái loading/empty/error/success và xử lý thao tác lặp được kiểm thử.<br>AC4. Giao dịch thành công được lưu bền vững, phản ánh trên màn hình liên quan và có audit/correlation ID.|

|Màn hình / Nguồn|SCR-05..12, SCR-48..53; UI-STD-09, UI-STD-12, UI-MNT-01..02 \| FAMS STU-03|



UFR-PEO-004 - Import học viên


|CONTRACT UFR-PEO-004|CONTRACT UFR-PEO-004|

|---|---|

|Phân hệ / Ưu tiên|Quản lý học viên, lớp, cohort và nhóm / Must|

|Actor / Quyền|Class Admin. Bắt buộc permission tương ứng và data scope hợp lệ.|

|Yêu cầu|Tải mẫu, preview, validate theo dòng/field, partial result, error report và chống nhập trùng.|

|Tiền điều kiện|Người dùng đã xác thực; tenant đang hoạt động; có permission và data scope phù hợp. Hồ sơ học viên/lớp tồn tại và chưa bị xóa cứng.|

|Luồng chính|1) Người dùng mở chức năng Import học viên; hệ thống tải dữ liệu theo scope.<br>2) Người dùng nhập/chọn điều kiện cần thiết; hệ thống kiểm tra validation và quyền.<br>3) Hệ thống thực hiện: Tải mẫu, preview, validate theo dòng/field, partial result, error report và chống nhập trùng.<br>4) Hệ thống lưu giao dịch, hiển thị kết quả, cập nhật dữ liệu liên quan và ghi audit/event.|

|Validation / Quy tắc|Mã học viên/lớp là duy nhất theo tenant; cập nhật roster phải kiểm tra lớp, thời gian, sức chứa và optimistic locking.|

|Ngoại lệ|401 khi phiên không hợp lệ; 403 khi thiếu quyền/scope; 404 khi đối tượng không tồn tại; 409 khi trùng/không đúng version hoặc transition; 422 khi dữ liệu nghiệp vụ không hợp lệ. Không mất dữ liệu người dùng đã nhập và phải có thông báo khắc phục được.|

|Hậu điều kiện|Dữ liệu và trạng thái liên quan nhất quán; sự kiện/outbox phát đúng một lần; audit có actor, thời gian, before/after và correlation ID.|

|Tiêu chí nghiệm thu|AC1. Class Admin thực hiện được nghiệp vụ trong phạm vi được cấp và kết quả đúng mô tả.<br>AC2. Người không có quyền bị chặn nhất quán ở UI và API; không rò rỉ dữ liệu qua response/export.<br>AC3. Validation, trạng thái loading/empty/error/success và xử lý thao tác lặp được kiểm thử.<br>AC4. Giao dịch thành công được lưu bền vững, phản ánh trên màn hình liên quan và có audit/correlation ID.|

|Màn hình / Nguồn|SCR-05..12, SCR-48..53; UI-STD-09, UI-STD-12, UI-MNT-01..02 \| Hub AUTH-05; FAMS STU-04|



UFR-PEO-005 - Xuất học viên


|CONTRACT UFR-PEO-005|CONTRACT UFR-PEO-005|

|---|---|

|Phân hệ / Ưu tiên|Quản lý học viên, lớp, cohort và nhóm / Must|

|Actor / Quyền|Class Admin. Bắt buộc permission tương ứng và data scope hợp lệ.|

|Yêu cầu|Xuất selection hoặc toàn bộ kết quả theo filter, chỉ gồm bản ghi/trường dữ liệu được phép.|

|Tiền điều kiện|Người dùng đã xác thực; tenant đang hoạt động; có permission và data scope phù hợp. Hồ sơ học viên/lớp tồn tại và chưa bị xóa cứng.|

|Luồng chính|1) Người dùng mở chức năng Xuất học viên; hệ thống tải dữ liệu theo scope.<br>2) Người dùng nhập/chọn điều kiện cần thiết; hệ thống kiểm tra validation và quyền.<br>3) Hệ thống thực hiện: Xuất selection hoặc toàn bộ kết quả theo filter, chỉ gồm bản ghi/trường dữ liệu được phép.<br>4) Hệ thống lưu giao dịch, hiển thị kết quả, cập nhật dữ liệu liên quan và ghi audit/event.|

|Validation / Quy tắc|Mã học viên/lớp là duy nhất theo tenant; cập nhật roster phải kiểm tra lớp, thời gian, sức chứa và optimistic locking.|

|Ngoại lệ|401 khi phiên không hợp lệ; 403 khi thiếu quyền/scope; 404 khi đối tượng không tồn tại; 409 khi trùng/không đúng version hoặc transition; 422 khi dữ liệu nghiệp vụ không hợp lệ. Không mất dữ liệu người dùng đã nhập và phải có thông báo khắc phục được.|

|Hậu điều kiện|Dữ liệu và trạng thái liên quan nhất quán; sự kiện/outbox phát đúng một lần; audit có actor, thời gian, before/after và correlation ID.|

|Tiêu chí nghiệm thu|AC1. Class Admin thực hiện được nghiệp vụ trong phạm vi được cấp và kết quả đúng mô tả.<br>AC2. Người không có quyền bị chặn nhất quán ở UI và API; không rò rỉ dữ liệu qua response/export.<br>AC3. Validation, trạng thái loading/empty/error/success và xử lý thao tác lặp được kiểm thử.<br>AC4. Giao dịch thành công được lưu bền vững, phản ánh trên màn hình liên quan và có audit/correlation ID.|

|Màn hình / Nguồn|SCR-05..12, SCR-48..53; UI-STD-09, UI-STD-12, UI-MNT-01..02 \| FAMS STU-06|



UFR-PEO-006 - Trạng thái học viên


|CONTRACT UFR-PEO-006|CONTRACT UFR-PEO-006|

|---|---|

|Phân hệ / Ưu tiên|Quản lý học viên, lớp, cohort và nhóm / Must|

|Actor / Quyền|Class Admin. Bắt buộc permission tương ứng và data scope hợp lệ.|

|Yêu cầu|Đổi trạng thái đơn lẻ/hàng loạt theo state machine; trả kết quả từng bản ghi khi xử lý batch.|

|Tiền điều kiện|Người dùng đã xác thực; tenant đang hoạt động; có permission và data scope phù hợp. Hồ sơ học viên/lớp tồn tại và chưa bị xóa cứng.|

|Luồng chính|1) Người dùng mở chức năng Trạng thái học viên; hệ thống tải dữ liệu theo scope.<br>2) Người dùng nhập/chọn điều kiện cần thiết; hệ thống kiểm tra validation và quyền.<br>3) Hệ thống thực hiện: Đổi trạng thái đơn lẻ/hàng loạt theo state machine; trả kết quả từng bản ghi khi xử lý batch.<br>4) Hệ thống lưu giao dịch, hiển thị kết quả, cập nhật dữ liệu liên quan và ghi audit/event.|

|Validation / Quy tắc|Mã học viên/lớp là duy nhất theo tenant; cập nhật roster phải kiểm tra lớp, thời gian, sức chứa và optimistic locking.|

|Ngoại lệ|401 khi phiên không hợp lệ; 403 khi thiếu quyền/scope; 404 khi đối tượng không tồn tại; 409 khi trùng/không đúng version hoặc transition; 422 khi dữ liệu nghiệp vụ không hợp lệ. Không mất dữ liệu người dùng đã nhập và phải có thông báo khắc phục được.|

|Hậu điều kiện|Dữ liệu và trạng thái liên quan nhất quán; sự kiện/outbox phát đúng một lần; audit có actor, thời gian, before/after và correlation ID.|

|Tiêu chí nghiệm thu|AC1. Class Admin thực hiện được nghiệp vụ trong phạm vi được cấp và kết quả đúng mô tả.<br>AC2. Người không có quyền bị chặn nhất quán ở UI và API; không rò rỉ dữ liệu qua response/export.<br>AC3. Validation, trạng thái loading/empty/error/success và xử lý thao tác lặp được kiểm thử.<br>AC4. Giao dịch thành công được lưu bền vững, phản ánh trên màn hình liên quan và có audit/correlation ID.|

|Màn hình / Nguồn|SCR-05..12, SCR-48..53; UI-STD-09, UI-STD-12, UI-MNT-01..02 \| FAMS STU-05|



UFR-PEO-007 - Vô hiệu hóa học viên


|CONTRACT UFR-PEO-007|CONTRACT UFR-PEO-007|

|---|---|

|Phân hệ / Ưu tiên|Quản lý học viên, lớp, cohort và nhóm / Must|

|Actor / Quyền|Class Admin. Bắt buộc permission tương ứng và data scope hợp lệ.|

|Yêu cầu|Soft-disable học viên đủ điều kiện, giữ lịch sử học tập và dependency.|

|Tiền điều kiện|Người dùng đã xác thực; tenant đang hoạt động; có permission và data scope phù hợp. Hồ sơ học viên/lớp tồn tại và chưa bị xóa cứng.|

|Luồng chính|1) Người dùng mở chức năng Vô hiệu hóa học viên; hệ thống tải dữ liệu theo scope.<br>2) Người dùng nhập/chọn điều kiện cần thiết; hệ thống kiểm tra validation và quyền.<br>3) Hệ thống thực hiện: Soft-disable học viên đủ điều kiện, giữ lịch sử học tập và dependency.<br>4) Hệ thống lưu giao dịch, hiển thị kết quả, cập nhật dữ liệu liên quan và ghi audit/event.|

|Validation / Quy tắc|Mã học viên/lớp là duy nhất theo tenant; cập nhật roster phải kiểm tra lớp, thời gian, sức chứa và optimistic locking.|

|Ngoại lệ|401 khi phiên không hợp lệ; 403 khi thiếu quyền/scope; 404 khi đối tượng không tồn tại; 409 khi trùng/không đúng version hoặc transition; 422 khi dữ liệu nghiệp vụ không hợp lệ. Không mất dữ liệu người dùng đã nhập và phải có thông báo khắc phục được.|

|Hậu điều kiện|Dữ liệu và trạng thái liên quan nhất quán; sự kiện/outbox phát đúng một lần; audit có actor, thời gian, before/after và correlation ID.|

|Tiêu chí nghiệm thu|AC1. Class Admin thực hiện được nghiệp vụ trong phạm vi được cấp và kết quả đúng mô tả.<br>AC2. Người không có quyền bị chặn nhất quán ở UI và API; không rò rỉ dữ liệu qua response/export.<br>AC3. Validation, trạng thái loading/empty/error/success và xử lý thao tác lặp được kiểm thử.<br>AC4. Giao dịch thành công được lưu bền vững, phản ánh trên màn hình liên quan và có audit/correlation ID.|

|Màn hình / Nguồn|SCR-05..12, SCR-48..53; UI-STD-09, UI-STD-12, UI-MNT-01..02 \| FAMS STU-07|



UFR-PEO-008 - Quản lý cohort


|CONTRACT UFR-PEO-008|CONTRACT UFR-PEO-008|

|---|---|

|Phân hệ / Ưu tiên|Quản lý học viên, lớp, cohort và nhóm / Must|

|Actor / Quyền|Program Manager. Bắt buộc permission tương ứng và data scope hợp lệ.|

|Yêu cầu|Tạo, sửa, đóng cohort với chương trình, thời gian, quy mô và mentor phụ trách.|

|Tiền điều kiện|Người dùng đã xác thực; tenant đang hoạt động; có permission và data scope phù hợp. Hồ sơ học viên/lớp tồn tại và chưa bị xóa cứng.|

|Luồng chính|1) Người dùng mở chức năng Quản lý cohort; hệ thống tải dữ liệu theo scope.<br>2) Người dùng nhập/chọn điều kiện cần thiết; hệ thống kiểm tra validation và quyền.<br>3) Hệ thống thực hiện: Tạo, sửa, đóng cohort với chương trình, thời gian, quy mô và mentor phụ trách.<br>4) Hệ thống lưu giao dịch, hiển thị kết quả, cập nhật dữ liệu liên quan và ghi audit/event.|

|Validation / Quy tắc|Mã học viên/lớp là duy nhất theo tenant; cập nhật roster phải kiểm tra lớp, thời gian, sức chứa và optimistic locking.|

|Ngoại lệ|401 khi phiên không hợp lệ; 403 khi thiếu quyền/scope; 404 khi đối tượng không tồn tại; 409 khi trùng/không đúng version hoặc transition; 422 khi dữ liệu nghiệp vụ không hợp lệ. Không mất dữ liệu người dùng đã nhập và phải có thông báo khắc phục được.|

|Hậu điều kiện|Dữ liệu và trạng thái liên quan nhất quán; sự kiện/outbox phát đúng một lần; audit có actor, thời gian, before/after và correlation ID.|

|Tiêu chí nghiệm thu|AC1. Program Manager thực hiện được nghiệp vụ trong phạm vi được cấp và kết quả đúng mô tả.<br>AC2. Người không có quyền bị chặn nhất quán ở UI và API; không rò rỉ dữ liệu qua response/export.<br>AC3. Validation, trạng thái loading/empty/error/success và xử lý thao tác lặp được kiểm thử.<br>AC4. Giao dịch thành công được lưu bền vững, phản ánh trên màn hình liên quan và có audit/correlation ID.|

|Màn hình / Nguồn|SCR-05..12, SCR-48..53; UI-STD-09, UI-STD-12, UI-MNT-01..02 \| Hub TEAM-01|



UFR-PEO-009 - Quản lý Training Class


|CONTRACT UFR-PEO-009|CONTRACT UFR-PEO-009|

|---|---|

|Phân hệ / Ưu tiên|Quản lý học viên, lớp, cohort và nhóm / Should|

|Actor / Quyền|Program/Class Admin. Bắt buộc permission tương ứng và data scope hợp lệ.|

|Yêu cầu|CRUD/import/export lớp, gán program, học viên, master trainer, class admin và course/topic.|

|Tiền điều kiện|Người dùng đã xác thực; tenant đang hoạt động; có permission và data scope phù hợp. Hồ sơ học viên/lớp tồn tại và chưa bị xóa cứng.|

|Luồng chính|1) Người dùng mở chức năng Quản lý Training Class; hệ thống tải dữ liệu theo scope.<br>2) Người dùng nhập/chọn điều kiện cần thiết; hệ thống kiểm tra validation và quyền.<br>3) Hệ thống thực hiện: CRUD/import/export lớp, gán program, học viên, master trainer, class admin và course/topic.<br>4) Hệ thống lưu giao dịch, hiển thị kết quả, cập nhật dữ liệu liên quan và ghi audit/event.|

|Validation / Quy tắc|Mã học viên/lớp là duy nhất theo tenant; cập nhật roster phải kiểm tra lớp, thời gian, sức chứa và optimistic locking.|

|Ngoại lệ|401 khi phiên không hợp lệ; 403 khi thiếu quyền/scope; 404 khi đối tượng không tồn tại; 409 khi trùng/không đúng version hoặc transition; 422 khi dữ liệu nghiệp vụ không hợp lệ. Không mất dữ liệu người dùng đã nhập và phải có thông báo khắc phục được.|

|Hậu điều kiện|Dữ liệu và trạng thái liên quan nhất quán; sự kiện/outbox phát đúng một lần; audit có actor, thời gian, before/after và correlation ID.|

|Tiêu chí nghiệm thu|AC1. Program/Class Admin thực hiện được nghiệp vụ trong phạm vi được cấp và kết quả đúng mô tả.<br>AC2. Người không có quyền bị chặn nhất quán ở UI và API; không rò rỉ dữ liệu qua response/export.<br>AC3. Validation, trạng thái loading/empty/error/success và xử lý thao tác lặp được kiểm thử.<br>AC4. Giao dịch thành công được lưu bền vững, phản ánh trên màn hình liên quan và có audit/correlation ID.|

|Màn hình / Nguồn|SCR-05..12, SCR-48..53; UI-STD-09, UI-STD-12, UI-MNT-01..02 \| FAMS FR-212|



UFR-PEO-010 - Quản lý roster và tài nguyên


|CONTRACT UFR-PEO-010|CONTRACT UFR-PEO-010|

|---|---|

|Phân hệ / Ưu tiên|Quản lý học viên, lớp, cohort và nhóm / Should|

|Actor / Quyền|Class Admin. Bắt buộc permission tương ứng và data scope hợp lệ.|

|Yêu cầu|Thêm/loại học viên hợp lệ, phân công trainer/admin, room và các nguồn lực của lớp.|

|Tiền điều kiện|Người dùng đã xác thực; tenant đang hoạt động; có permission và data scope phù hợp. Hồ sơ học viên/lớp tồn tại và chưa bị xóa cứng.|

|Luồng chính|1) Người dùng mở chức năng Quản lý roster và tài nguyên; hệ thống tải dữ liệu theo scope.<br>2) Người dùng nhập/chọn điều kiện cần thiết; hệ thống kiểm tra validation và quyền.<br>3) Hệ thống thực hiện: Thêm/loại học viên hợp lệ, phân công trainer/admin, room và các nguồn lực của lớp.<br>4) Hệ thống lưu giao dịch, hiển thị kết quả, cập nhật dữ liệu liên quan và ghi audit/event.|

|Validation / Quy tắc|Mã học viên/lớp là duy nhất theo tenant; cập nhật roster phải kiểm tra lớp, thời gian, sức chứa và optimistic locking.|

|Ngoại lệ|401 khi phiên không hợp lệ; 403 khi thiếu quyền/scope; 404 khi đối tượng không tồn tại; 409 khi trùng/không đúng version hoặc transition; 422 khi dữ liệu nghiệp vụ không hợp lệ. Không mất dữ liệu người dùng đã nhập và phải có thông báo khắc phục được.|

|Hậu điều kiện|Dữ liệu và trạng thái liên quan nhất quán; sự kiện/outbox phát đúng một lần; audit có actor, thời gian, before/after và correlation ID.|

|Tiêu chí nghiệm thu|AC1. Class Admin thực hiện được nghiệp vụ trong phạm vi được cấp và kết quả đúng mô tả.<br>AC2. Người không có quyền bị chặn nhất quán ở UI và API; không rò rỉ dữ liệu qua response/export.<br>AC3. Validation, trạng thái loading/empty/error/success và xử lý thao tác lặp được kiểm thử.<br>AC4. Giao dịch thành công được lưu bền vững, phản ánh trên màn hình liên quan và có audit/correlation ID.|

|Màn hình / Nguồn|SCR-05..12, SCR-48..53; UI-STD-09, UI-STD-12, UI-MNT-01..02 \| FAMS FR-212; SCR-50|



UFR-PEO-011 - Xếp nhóm dự án


|CONTRACT UFR-PEO-011|CONTRACT UFR-PEO-011|

|---|---|

|Phân hệ / Ưu tiên|Quản lý học viên, lớp, cohort và nhóm / Must|

|Actor / Quyền|Program Manager/Mentor. Bắt buộc permission tương ứng và data scope hợp lệ.|

|Yêu cầu|Tạo nhóm thủ công hoặc tự động theo quy mô, kỹ năng và nguyện vọng; cho phép hiệu chỉnh trước công bố.|

|Tiền điều kiện|Người dùng đã xác thực; tenant đang hoạt động; có permission và data scope phù hợp. Hồ sơ học viên/lớp tồn tại và chưa bị xóa cứng.|

|Luồng chính|1) Người dùng mở chức năng Xếp nhóm dự án; hệ thống tải dữ liệu theo scope.<br>2) Người dùng nhập/chọn điều kiện cần thiết; hệ thống kiểm tra validation và quyền.<br>3) Hệ thống thực hiện: Tạo nhóm thủ công hoặc tự động theo quy mô, kỹ năng và nguyện vọng; cho phép hiệu chỉnh trước công bố.<br>4) Hệ thống lưu giao dịch, hiển thị kết quả, cập nhật dữ liệu liên quan và ghi audit/event.|

|Validation / Quy tắc|Mã học viên/lớp là duy nhất theo tenant; cập nhật roster phải kiểm tra lớp, thời gian, sức chứa và optimistic locking.|

|Ngoại lệ|401 khi phiên không hợp lệ; 403 khi thiếu quyền/scope; 404 khi đối tượng không tồn tại; 409 khi trùng/không đúng version hoặc transition; 422 khi dữ liệu nghiệp vụ không hợp lệ. Không mất dữ liệu người dùng đã nhập và phải có thông báo khắc phục được.|

|Hậu điều kiện|Dữ liệu và trạng thái liên quan nhất quán; sự kiện/outbox phát đúng một lần; audit có actor, thời gian, before/after và correlation ID.|

|Tiêu chí nghiệm thu|AC1. Program Manager/Mentor thực hiện được nghiệp vụ trong phạm vi được cấp và kết quả đúng mô tả.<br>AC2. Người không có quyền bị chặn nhất quán ở UI và API; không rò rỉ dữ liệu qua response/export.<br>AC3. Validation, trạng thái loading/empty/error/success và xử lý thao tác lặp được kiểm thử.<br>AC4. Giao dịch thành công được lưu bền vững, phản ánh trên màn hình liên quan và có audit/correlation ID.|

|Màn hình / Nguồn|SCR-05..12, SCR-48..53; UI-STD-09, UI-STD-12, UI-MNT-01..02 \| Hub TEAM-02|



UFR-PEO-012 - Vai trò trong nhóm


|CONTRACT UFR-PEO-012|CONTRACT UFR-PEO-012|

|---|---|

|Phân hệ / Ưu tiên|Quản lý học viên, lớp, cohort và nhóm / Should|

|Actor / Quyền|Mentor. Bắt buộc permission tương ứng và data scope hợp lệ.|

|Yêu cầu|Cấu hình và phân PM, BA, Dev, QA, UX; lưu lịch sử khi chuyển thành viên giữa nhóm.|

|Tiền điều kiện|Người dùng đã xác thực; tenant đang hoạt động; có permission và data scope phù hợp. Hồ sơ học viên/lớp tồn tại và chưa bị xóa cứng.|

|Luồng chính|1) Người dùng mở chức năng Vai trò trong nhóm; hệ thống tải dữ liệu theo scope.<br>2) Người dùng nhập/chọn điều kiện cần thiết; hệ thống kiểm tra validation và quyền.<br>3) Hệ thống thực hiện: Cấu hình và phân PM, BA, Dev, QA, UX; lưu lịch sử khi chuyển thành viên giữa nhóm.<br>4) Hệ thống lưu giao dịch, hiển thị kết quả, cập nhật dữ liệu liên quan và ghi audit/event.|

|Validation / Quy tắc|Mã học viên/lớp là duy nhất theo tenant; cập nhật roster phải kiểm tra lớp, thời gian, sức chứa và optimistic locking.|

|Ngoại lệ|401 khi phiên không hợp lệ; 403 khi thiếu quyền/scope; 404 khi đối tượng không tồn tại; 409 khi trùng/không đúng version hoặc transition; 422 khi dữ liệu nghiệp vụ không hợp lệ. Không mất dữ liệu người dùng đã nhập và phải có thông báo khắc phục được.|

|Hậu điều kiện|Dữ liệu và trạng thái liên quan nhất quán; sự kiện/outbox phát đúng một lần; audit có actor, thời gian, before/after và correlation ID.|

|Tiêu chí nghiệm thu|AC1. Mentor thực hiện được nghiệp vụ trong phạm vi được cấp và kết quả đúng mô tả.<br>AC2. Người không có quyền bị chặn nhất quán ở UI và API; không rò rỉ dữ liệu qua response/export.<br>AC3. Validation, trạng thái loading/empty/error/success và xử lý thao tác lặp được kiểm thử.<br>AC4. Giao dịch thành công được lưu bền vững, phản ánh trên màn hình liên quan và có audit/correlation ID.|

|Màn hình / Nguồn|SCR-05..12, SCR-48..53; UI-STD-09, UI-STD-12, UI-MNT-01..02 \| Hub TEAM-03,04|



UFR-PEO-013 - Team charter


|CONTRACT UFR-PEO-013|CONTRACT UFR-PEO-013|

|---|---|

|Phân hệ / Ưu tiên|Quản lý học viên, lớp, cohort và nhóm / Must|

|Actor / Quyền|Sinh viên/Mentor. Bắt buộc permission tương ứng và data scope hợp lệ.|

|Yêu cầu|Sinh viên xác nhận quy ước làm việc, phạm vi trách nhiệm và phân công ban đầu.|

|Tiền điều kiện|Người dùng đã xác thực; tenant đang hoạt động; có permission và data scope phù hợp. Hồ sơ học viên/lớp tồn tại và chưa bị xóa cứng.|

|Luồng chính|1) Người dùng mở chức năng Team charter; hệ thống tải dữ liệu theo scope.<br>2) Người dùng nhập/chọn điều kiện cần thiết; hệ thống kiểm tra validation và quyền.<br>3) Hệ thống thực hiện: Sinh viên xác nhận quy ước làm việc, phạm vi trách nhiệm và phân công ban đầu.<br>4) Hệ thống lưu giao dịch, hiển thị kết quả, cập nhật dữ liệu liên quan và ghi audit/event.|

|Validation / Quy tắc|Mã học viên/lớp là duy nhất theo tenant; cập nhật roster phải kiểm tra lớp, thời gian, sức chứa và optimistic locking.|

|Ngoại lệ|401 khi phiên không hợp lệ; 403 khi thiếu quyền/scope; 404 khi đối tượng không tồn tại; 409 khi trùng/không đúng version hoặc transition; 422 khi dữ liệu nghiệp vụ không hợp lệ. Không mất dữ liệu người dùng đã nhập và phải có thông báo khắc phục được.|

|Hậu điều kiện|Dữ liệu và trạng thái liên quan nhất quán; sự kiện/outbox phát đúng một lần; audit có actor, thời gian, before/after và correlation ID.|

|Tiêu chí nghiệm thu|AC1. Sinh viên/Mentor thực hiện được nghiệp vụ trong phạm vi được cấp và kết quả đúng mô tả.<br>AC2. Người không có quyền bị chặn nhất quán ở UI và API; không rò rỉ dữ liệu qua response/export.<br>AC3. Validation, trạng thái loading/empty/error/success và xử lý thao tác lặp được kiểm thử.<br>AC4. Giao dịch thành công được lưu bền vững, phản ánh trên màn hình liên quan và có audit/correlation ID.|

|Màn hình / Nguồn|SCR-05..12, SCR-48..53; UI-STD-09, UI-STD-12, UI-MNT-01..02 \| Hub TEAM-05|



UFR-PEO-014 - Lịch học và calendar version


|CONTRACT UFR-PEO-014|CONTRACT UFR-PEO-014|

|---|---|

|Phân hệ / Ưu tiên|Quản lý học viên, lớp, cohort và nhóm / Must|

|Actor / Quyền|Class Admin. Bắt buộc permission tương ứng và data scope hợp lệ.|

|Yêu cầu|Tạo nhiều version lịch, xếp session theo ngày/room/slot/holiday; chỉ một version active.|

|Tiền điều kiện|Người dùng đã xác thực; tenant đang hoạt động; có permission và data scope phù hợp. Hồ sơ học viên/lớp tồn tại và chưa bị xóa cứng.|

|Luồng chính|1) Người dùng mở chức năng Lịch học và calendar version; hệ thống tải dữ liệu theo scope.<br>2) Người dùng nhập/chọn điều kiện cần thiết; hệ thống kiểm tra validation và quyền.<br>3) Hệ thống thực hiện: Tạo nhiều version lịch, xếp session theo ngày/room/slot/holiday; chỉ một version active.<br>4) Hệ thống lưu giao dịch, hiển thị kết quả, cập nhật dữ liệu liên quan và ghi audit/event.|

|Validation / Quy tắc|Mã học viên/lớp là duy nhất theo tenant; cập nhật roster phải kiểm tra lớp, thời gian, sức chứa và optimistic locking.|

|Ngoại lệ|401 khi phiên không hợp lệ; 403 khi thiếu quyền/scope; 404 khi đối tượng không tồn tại; 409 khi trùng/không đúng version hoặc transition; 422 khi dữ liệu nghiệp vụ không hợp lệ. Không mất dữ liệu người dùng đã nhập và phải có thông báo khắc phục được.|

|Hậu điều kiện|Dữ liệu và trạng thái liên quan nhất quán; sự kiện/outbox phát đúng một lần; audit có actor, thời gian, before/after và correlation ID.|

|Tiêu chí nghiệm thu|AC1. Class Admin thực hiện được nghiệp vụ trong phạm vi được cấp và kết quả đúng mô tả.<br>AC2. Người không có quyền bị chặn nhất quán ở UI và API; không rò rỉ dữ liệu qua response/export.<br>AC3. Validation, trạng thái loading/empty/error/success và xử lý thao tác lặp được kiểm thử.<br>AC4. Giao dịch thành công được lưu bền vững, phản ánh trên màn hình liên quan và có audit/correlation ID.|

|Màn hình / Nguồn|SCR-05..12, SCR-48..53; UI-STD-09, UI-STD-12, UI-MNT-01..02 \| FAMS FR-213|



UFR-PEO-015 - Phân course theo topic


|CONTRACT UFR-PEO-015|CONTRACT UFR-PEO-015|

|---|---|

|Phân hệ / Ưu tiên|Quản lý học viên, lớp, cohort và nhóm / Should|

|Actor / Quyền|Program/Class Admin. Bắt buộc permission tương ứng và data scope hợp lệ.|

|Yêu cầu|Ánh xạ course/trainer vào topic của lớp và kiểm tra đủ nguồn lực trước vận hành.|

|Tiền điều kiện|Người dùng đã xác thực; tenant đang hoạt động; có permission và data scope phù hợp. Hồ sơ học viên/lớp tồn tại và chưa bị xóa cứng.|

|Luồng chính|1) Người dùng mở chức năng Phân course theo topic; hệ thống tải dữ liệu theo scope.<br>2) Người dùng nhập/chọn điều kiện cần thiết; hệ thống kiểm tra validation và quyền.<br>3) Hệ thống thực hiện: Ánh xạ course/trainer vào topic của lớp và kiểm tra đủ nguồn lực trước vận hành.<br>4) Hệ thống lưu giao dịch, hiển thị kết quả, cập nhật dữ liệu liên quan và ghi audit/event.|

|Validation / Quy tắc|Mã học viên/lớp là duy nhất theo tenant; cập nhật roster phải kiểm tra lớp, thời gian, sức chứa và optimistic locking.|

|Ngoại lệ|401 khi phiên không hợp lệ; 403 khi thiếu quyền/scope; 404 khi đối tượng không tồn tại; 409 khi trùng/không đúng version hoặc transition; 422 khi dữ liệu nghiệp vụ không hợp lệ. Không mất dữ liệu người dùng đã nhập và phải có thông báo khắc phục được.|

|Hậu điều kiện|Dữ liệu và trạng thái liên quan nhất quán; sự kiện/outbox phát đúng một lần; audit có actor, thời gian, before/after và correlation ID.|

|Tiêu chí nghiệm thu|AC1. Program/Class Admin thực hiện được nghiệp vụ trong phạm vi được cấp và kết quả đúng mô tả.<br>AC2. Người không có quyền bị chặn nhất quán ở UI và API; không rò rỉ dữ liệu qua response/export.<br>AC3. Validation, trạng thái loading/empty/error/success và xử lý thao tác lặp được kiểm thử.<br>AC4. Giao dịch thành công được lưu bền vững, phản ánh trên màn hình liên quan và có audit/correlation ID.|

|Màn hình / Nguồn|SCR-05..12, SCR-48..53; UI-STD-09, UI-STD-12, UI-MNT-01..02 \| FAMS SCR-52|



UFR-PEO-016 - Điểm danh


|CONTRACT UFR-PEO-016|CONTRACT UFR-PEO-016|

|---|---|

|Phân hệ / Ưu tiên|Quản lý học viên, lớp, cohort và nhóm / Must|

|Actor / Quyền|Trainer/Class Admin. Bắt buộc permission tương ứng và data scope hợp lệ.|

|Yêu cầu|Ghi PRESENT/ABSENT/LATE/EXCUSED theo ngày, xử lý hàng loạt và export.|

|Tiền điều kiện|Người dùng đã xác thực; tenant đang hoạt động; có permission và data scope phù hợp. Hồ sơ học viên/lớp tồn tại và chưa bị xóa cứng.|

|Luồng chính|1) Người dùng mở chức năng Điểm danh; hệ thống tải dữ liệu theo scope.<br>2) Người dùng nhập/chọn điều kiện cần thiết; hệ thống kiểm tra validation và quyền.<br>3) Hệ thống thực hiện: Ghi PRESENT/ABSENT/LATE/EXCUSED theo ngày, xử lý hàng loạt và export.<br>4) Hệ thống lưu giao dịch, hiển thị kết quả, cập nhật dữ liệu liên quan và ghi audit/event.|

|Validation / Quy tắc|Mã học viên/lớp là duy nhất theo tenant; cập nhật roster phải kiểm tra lớp, thời gian, sức chứa và optimistic locking.|

|Ngoại lệ|401 khi phiên không hợp lệ; 403 khi thiếu quyền/scope; 404 khi đối tượng không tồn tại; 409 khi trùng/không đúng version hoặc transition; 422 khi dữ liệu nghiệp vụ không hợp lệ. Không mất dữ liệu người dùng đã nhập và phải có thông báo khắc phục được.|

|Hậu điều kiện|Dữ liệu và trạng thái liên quan nhất quán; sự kiện/outbox phát đúng một lần; audit có actor, thời gian, before/after và correlation ID.|

|Tiêu chí nghiệm thu|AC1. Trainer/Class Admin thực hiện được nghiệp vụ trong phạm vi được cấp và kết quả đúng mô tả.<br>AC2. Người không có quyền bị chặn nhất quán ở UI và API; không rò rỉ dữ liệu qua response/export.<br>AC3. Validation, trạng thái loading/empty/error/success và xử lý thao tác lặp được kiểm thử.<br>AC4. Giao dịch thành công được lưu bền vững, phản ánh trên màn hình liên quan và có audit/correlation ID.|

|Màn hình / Nguồn|SCR-05..12, SCR-48..53; UI-STD-09, UI-STD-12, UI-MNT-01..02 \| FAMS FR-214|




## 5.4 Quản lý bảo lưu và vòng đời học viên

UFR-RES-001 - Danh sách bảo lưu


|CONTRACT UFR-RES-001|CONTRACT UFR-RES-001|

|---|---|

|Phân hệ / Ưu tiên|Quản lý bảo lưu và vòng đời học viên / Must|

|Actor / Quyền|Class Admin. Bắt buộc permission tương ứng và data scope hợp lệ.|

|Yêu cầu|Tra cứu, lọc, ưu tiên sắp đến hạn/quá hạn và điều hướng từ dashboard.|

|Tiền điều kiện|Người dùng đã xác thực; tenant đang hoạt động; có permission và data scope phù hợp. Hồ sơ học viên/lớp tồn tại và chưa bị xóa cứng.|

|Luồng chính|1) Người dùng mở chức năng Danh sách bảo lưu; hệ thống tải dữ liệu theo scope.<br>2) Người dùng nhập/chọn điều kiện cần thiết; hệ thống kiểm tra validation và quyền.<br>3) Hệ thống thực hiện: Tra cứu, lọc, ưu tiên sắp đến hạn/quá hạn và điều hướng từ dashboard.<br>4) Hệ thống lưu giao dịch, hiển thị kết quả, cập nhật dữ liệu liên quan và ghi audit/event.|

|Validation / Quy tắc|Chuyển trạng thái theo state machine; không chồng khoảng bảo lưu; kết thúc phải chọn hướng xử lý hợp lệ.|

|Ngoại lệ|401 khi phiên không hợp lệ; 403 khi thiếu quyền/scope; 404 khi đối tượng không tồn tại; 409 khi trùng/không đúng version hoặc transition; 422 khi dữ liệu nghiệp vụ không hợp lệ. Không mất dữ liệu người dùng đã nhập và phải có thông báo khắc phục được.|

|Hậu điều kiện|Dữ liệu và trạng thái liên quan nhất quán; sự kiện/outbox phát đúng một lần; audit có actor, thời gian, before/after và correlation ID.|

|Tiêu chí nghiệm thu|AC1. Class Admin thực hiện được nghiệp vụ trong phạm vi được cấp và kết quả đúng mô tả.<br>AC2. Người không có quyền bị chặn nhất quán ở UI và API; không rò rỉ dữ liệu qua response/export.<br>AC3. Validation, trạng thái loading/empty/error/success và xử lý thao tác lặp được kiểm thử.<br>AC4. Giao dịch thành công được lưu bền vững, phản ánh trên màn hình liên quan và có audit/correlation ID.|

|Màn hình / Nguồn|SCR-18..21 \| FAMS RES-01|



UFR-RES-002 - Tạo bảo lưu


|CONTRACT UFR-RES-002|CONTRACT UFR-RES-002|

|---|---|

|Phân hệ / Ưu tiên|Quản lý bảo lưu và vòng đời học viên / Must|

|Actor / Quyền|Class Admin. Bắt buộc permission tương ứng và data scope hợp lệ.|

|Yêu cầu|Tạo reservation hợp lệ và đồng bộ trạng thái học viên sang Reserve.|

|Tiền điều kiện|Người dùng đã xác thực; tenant đang hoạt động; có permission và data scope phù hợp. Hồ sơ học viên/lớp tồn tại và chưa bị xóa cứng.|

|Luồng chính|1) Người dùng mở chức năng Tạo bảo lưu; hệ thống tải dữ liệu theo scope.<br>2) Người dùng nhập/chọn điều kiện cần thiết; hệ thống kiểm tra validation và quyền.<br>3) Hệ thống thực hiện: Tạo reservation hợp lệ và đồng bộ trạng thái học viên sang Reserve.<br>4) Hệ thống lưu giao dịch, hiển thị kết quả, cập nhật dữ liệu liên quan và ghi audit/event.|

|Validation / Quy tắc|Chuyển trạng thái theo state machine; không chồng khoảng bảo lưu; kết thúc phải chọn hướng xử lý hợp lệ.|

|Ngoại lệ|401 khi phiên không hợp lệ; 403 khi thiếu quyền/scope; 404 khi đối tượng không tồn tại; 409 khi trùng/không đúng version hoặc transition; 422 khi dữ liệu nghiệp vụ không hợp lệ. Không mất dữ liệu người dùng đã nhập và phải có thông báo khắc phục được.|

|Hậu điều kiện|Dữ liệu và trạng thái liên quan nhất quán; sự kiện/outbox phát đúng một lần; audit có actor, thời gian, before/after và correlation ID.|

|Tiêu chí nghiệm thu|AC1. Class Admin thực hiện được nghiệp vụ trong phạm vi được cấp và kết quả đúng mô tả.<br>AC2. Người không có quyền bị chặn nhất quán ở UI và API; không rò rỉ dữ liệu qua response/export.<br>AC3. Validation, trạng thái loading/empty/error/success và xử lý thao tác lặp được kiểm thử.<br>AC4. Giao dịch thành công được lưu bền vững, phản ánh trên màn hình liên quan và có audit/correlation ID.|

|Màn hình / Nguồn|SCR-18..21 \| FAMS RES-02|



UFR-RES-003 - Cập nhật bảo lưu


|CONTRACT UFR-RES-003|CONTRACT UFR-RES-003|

|---|---|

|Phân hệ / Ưu tiên|Quản lý bảo lưu và vòng đời học viên / Must|

|Actor / Quyền|Class Admin. Bắt buộc permission tương ứng và data scope hợp lệ.|

|Yêu cầu|Sửa khoảng thời gian, lý do, ghi chú và lịch sử mà không làm mất audit.|

|Tiền điều kiện|Người dùng đã xác thực; tenant đang hoạt động; có permission và data scope phù hợp. Hồ sơ học viên/lớp tồn tại và chưa bị xóa cứng.|

|Luồng chính|1) Người dùng mở chức năng Cập nhật bảo lưu; hệ thống tải dữ liệu theo scope.<br>2) Người dùng nhập/chọn điều kiện cần thiết; hệ thống kiểm tra validation và quyền.<br>3) Hệ thống thực hiện: Sửa khoảng thời gian, lý do, ghi chú và lịch sử mà không làm mất audit.<br>4) Hệ thống lưu giao dịch, hiển thị kết quả, cập nhật dữ liệu liên quan và ghi audit/event.|

|Validation / Quy tắc|Chuyển trạng thái theo state machine; không chồng khoảng bảo lưu; kết thúc phải chọn hướng xử lý hợp lệ.|

|Ngoại lệ|401 khi phiên không hợp lệ; 403 khi thiếu quyền/scope; 404 khi đối tượng không tồn tại; 409 khi trùng/không đúng version hoặc transition; 422 khi dữ liệu nghiệp vụ không hợp lệ. Không mất dữ liệu người dùng đã nhập và phải có thông báo khắc phục được.|

|Hậu điều kiện|Dữ liệu và trạng thái liên quan nhất quán; sự kiện/outbox phát đúng một lần; audit có actor, thời gian, before/after và correlation ID.|

|Tiêu chí nghiệm thu|AC1. Class Admin thực hiện được nghiệp vụ trong phạm vi được cấp và kết quả đúng mô tả.<br>AC2. Người không có quyền bị chặn nhất quán ở UI và API; không rò rỉ dữ liệu qua response/export.<br>AC3. Validation, trạng thái loading/empty/error/success và xử lý thao tác lặp được kiểm thử.<br>AC4. Giao dịch thành công được lưu bền vững, phản ánh trên màn hình liên quan và có audit/correlation ID.|

|Màn hình / Nguồn|SCR-18..21 \| FAMS RES-02|



UFR-RES-004 - Kết thúc bảo lưu


|CONTRACT UFR-RES-004|CONTRACT UFR-RES-004|

|---|---|

|Phân hệ / Ưu tiên|Quản lý bảo lưu và vòng đời học viên / Must|

|Actor / Quyền|Class Admin. Bắt buộc permission tương ứng và data scope hợp lệ.|

|Yêu cầu|Terminate reservation và bắt buộc chọn hướng xử lý tiếp theo hợp lệ.|

|Tiền điều kiện|Người dùng đã xác thực; tenant đang hoạt động; có permission và data scope phù hợp. Hồ sơ học viên/lớp tồn tại và chưa bị xóa cứng.|

|Luồng chính|1) Người dùng mở chức năng Kết thúc bảo lưu; hệ thống tải dữ liệu theo scope.<br>2) Người dùng nhập/chọn điều kiện cần thiết; hệ thống kiểm tra validation và quyền.<br>3) Hệ thống thực hiện: Terminate reservation và bắt buộc chọn hướng xử lý tiếp theo hợp lệ.<br>4) Hệ thống lưu giao dịch, hiển thị kết quả, cập nhật dữ liệu liên quan và ghi audit/event.|

|Validation / Quy tắc|Chuyển trạng thái theo state machine; không chồng khoảng bảo lưu; kết thúc phải chọn hướng xử lý hợp lệ.|

|Ngoại lệ|401 khi phiên không hợp lệ; 403 khi thiếu quyền/scope; 404 khi đối tượng không tồn tại; 409 khi trùng/không đúng version hoặc transition; 422 khi dữ liệu nghiệp vụ không hợp lệ. Không mất dữ liệu người dùng đã nhập và phải có thông báo khắc phục được.|

|Hậu điều kiện|Dữ liệu và trạng thái liên quan nhất quán; sự kiện/outbox phát đúng một lần; audit có actor, thời gian, before/after và correlation ID.|

|Tiêu chí nghiệm thu|AC1. Class Admin thực hiện được nghiệp vụ trong phạm vi được cấp và kết quả đúng mô tả.<br>AC2. Người không có quyền bị chặn nhất quán ở UI và API; không rò rỉ dữ liệu qua response/export.<br>AC3. Validation, trạng thái loading/empty/error/success và xử lý thao tác lặp được kiểm thử.<br>AC4. Giao dịch thành công được lưu bền vững, phản ánh trên màn hình liên quan và có audit/correlation ID.|

|Màn hình / Nguồn|SCR-18..21 \| FAMS RES-02|



UFR-RES-005 - Nhắc sau bảo lưu


|CONTRACT UFR-RES-005|CONTRACT UFR-RES-005|

|---|---|

|Phân hệ / Ưu tiên|Quản lý bảo lưu và vòng đời học viên / Must|

|Actor / Quyền|Class Admin. Bắt buộc permission tương ứng và data scope hợp lệ.|

|Yêu cầu|Gửi thông báo/reminder, áp dụng cooldown chống gửi trùng và lưu lịch sử.|

|Tiền điều kiện|Người dùng đã xác thực; tenant đang hoạt động; có permission và data scope phù hợp. Hồ sơ học viên/lớp tồn tại và chưa bị xóa cứng.|

|Luồng chính|1) Người dùng mở chức năng Nhắc sau bảo lưu; hệ thống tải dữ liệu theo scope.<br>2) Người dùng nhập/chọn điều kiện cần thiết; hệ thống kiểm tra validation và quyền.<br>3) Hệ thống thực hiện: Gửi thông báo/reminder, áp dụng cooldown chống gửi trùng và lưu lịch sử.<br>4) Hệ thống lưu giao dịch, hiển thị kết quả, cập nhật dữ liệu liên quan và ghi audit/event.|

|Validation / Quy tắc|Chuyển trạng thái theo state machine; không chồng khoảng bảo lưu; kết thúc phải chọn hướng xử lý hợp lệ.|

|Ngoại lệ|401 khi phiên không hợp lệ; 403 khi thiếu quyền/scope; 404 khi đối tượng không tồn tại; 409 khi trùng/không đúng version hoặc transition; 422 khi dữ liệu nghiệp vụ không hợp lệ. Không mất dữ liệu người dùng đã nhập và phải có thông báo khắc phục được.|

|Hậu điều kiện|Dữ liệu và trạng thái liên quan nhất quán; sự kiện/outbox phát đúng một lần; audit có actor, thời gian, before/after và correlation ID.|

|Tiêu chí nghiệm thu|AC1. Class Admin thực hiện được nghiệp vụ trong phạm vi được cấp và kết quả đúng mô tả.<br>AC2. Người không có quyền bị chặn nhất quán ở UI và API; không rò rỉ dữ liệu qua response/export.<br>AC3. Validation, trạng thái loading/empty/error/success và xử lý thao tác lặp được kiểm thử.<br>AC4. Giao dịch thành công được lưu bền vững, phản ánh trên màn hình liên quan và có audit/correlation ID.|

|Màn hình / Nguồn|SCR-18..21 \| FAMS RES-03|



UFR-RES-006 - Xếp lớp mới


|CONTRACT UFR-RES-006|CONTRACT UFR-RES-006|

|---|---|

|Phân hệ / Ưu tiên|Quản lý bảo lưu và vòng đời học viên / Must|

|Actor / Quyền|Class Admin. Bắt buộc permission tương ứng và data scope hợp lệ.|

|Yêu cầu|Tìm lớp phù hợp/còn chỗ, kiểm tra xung đột và cập nhật nguyên tử class, status, reservation.|

|Tiền điều kiện|Người dùng đã xác thực; tenant đang hoạt động; có permission và data scope phù hợp. Hồ sơ học viên/lớp tồn tại và chưa bị xóa cứng.|

|Luồng chính|1) Người dùng mở chức năng Xếp lớp mới; hệ thống tải dữ liệu theo scope.<br>2) Người dùng nhập/chọn điều kiện cần thiết; hệ thống kiểm tra validation và quyền.<br>3) Hệ thống thực hiện: Tìm lớp phù hợp/còn chỗ, kiểm tra xung đột và cập nhật nguyên tử class, status, reservation.<br>4) Hệ thống lưu giao dịch, hiển thị kết quả, cập nhật dữ liệu liên quan và ghi audit/event.|

|Validation / Quy tắc|Chuyển trạng thái theo state machine; không chồng khoảng bảo lưu; kết thúc phải chọn hướng xử lý hợp lệ.|

|Ngoại lệ|401 khi phiên không hợp lệ; 403 khi thiếu quyền/scope; 404 khi đối tượng không tồn tại; 409 khi trùng/không đúng version hoặc transition; 422 khi dữ liệu nghiệp vụ không hợp lệ. Không mất dữ liệu người dùng đã nhập và phải có thông báo khắc phục được.|

|Hậu điều kiện|Dữ liệu và trạng thái liên quan nhất quán; sự kiện/outbox phát đúng một lần; audit có actor, thời gian, before/after và correlation ID.|

|Tiêu chí nghiệm thu|AC1. Class Admin thực hiện được nghiệp vụ trong phạm vi được cấp và kết quả đúng mô tả.<br>AC2. Người không có quyền bị chặn nhất quán ở UI và API; không rò rỉ dữ liệu qua response/export.<br>AC3. Validation, trạng thái loading/empty/error/success và xử lý thao tác lặp được kiểm thử.<br>AC4. Giao dịch thành công được lưu bền vững, phản ánh trên màn hình liên quan và có audit/correlation ID.|

|Màn hình / Nguồn|SCR-18..21 \| FAMS RES-04|



UFR-RES-007 - Drop Out


|CONTRACT UFR-RES-007|CONTRACT UFR-RES-007|

|---|---|

|Phân hệ / Ưu tiên|Quản lý bảo lưu và vòng đời học viên / Must|

|Actor / Quyền|Class Admin. Bắt buộc permission tương ứng và data scope hợp lệ.|

|Yêu cầu|Chuyển Drop Out chỉ qua transition cho phép, bắt buộc lý do và bảo toàn lịch sử.|

|Tiền điều kiện|Người dùng đã xác thực; tenant đang hoạt động; có permission và data scope phù hợp. Hồ sơ học viên/lớp tồn tại và chưa bị xóa cứng.|

|Luồng chính|1) Người dùng mở chức năng Drop Out; hệ thống tải dữ liệu theo scope.<br>2) Người dùng nhập/chọn điều kiện cần thiết; hệ thống kiểm tra validation và quyền.<br>3) Hệ thống thực hiện: Chuyển Drop Out chỉ qua transition cho phép, bắt buộc lý do và bảo toàn lịch sử.<br>4) Hệ thống lưu giao dịch, hiển thị kết quả, cập nhật dữ liệu liên quan và ghi audit/event.|

|Validation / Quy tắc|Chuyển trạng thái theo state machine; không chồng khoảng bảo lưu; kết thúc phải chọn hướng xử lý hợp lệ.|

|Ngoại lệ|401 khi phiên không hợp lệ; 403 khi thiếu quyền/scope; 404 khi đối tượng không tồn tại; 409 khi trùng/không đúng version hoặc transition; 422 khi dữ liệu nghiệp vụ không hợp lệ. Không mất dữ liệu người dùng đã nhập và phải có thông báo khắc phục được.|

|Hậu điều kiện|Dữ liệu và trạng thái liên quan nhất quán; sự kiện/outbox phát đúng một lần; audit có actor, thời gian, before/after và correlation ID.|

|Tiêu chí nghiệm thu|AC1. Class Admin thực hiện được nghiệp vụ trong phạm vi được cấp và kết quả đúng mô tả.<br>AC2. Người không có quyền bị chặn nhất quán ở UI và API; không rò rỉ dữ liệu qua response/export.<br>AC3. Validation, trạng thái loading/empty/error/success và xử lý thao tác lặp được kiểm thử.<br>AC4. Giao dịch thành công được lưu bền vững, phản ánh trên màn hình liên quan và có audit/correlation ID.|

|Màn hình / Nguồn|SCR-18..21 \| FAMS RES-05|




## 5.5 Quản lý Mock Project, sprint và sản phẩm bàn giao

UFR-PRJ-001 - Khởi tạo workspace dự án


|CONTRACT UFR-PRJ-001|CONTRACT UFR-PRJ-001|

|---|---|

|Phân hệ / Ưu tiên|Quản lý Mock Project, sprint và sản phẩm bàn giao / Must|

|Actor / Quyền|Mentor/Team. Bắt buộc permission tương ứng và data scope hợp lệ.|

|Yêu cầu|Tạo workspace theo nhóm gồm overview, thành viên, milestone, sprint, backlog, artifact, feedback và activity.|

|Tiền điều kiện|Người dùng đã xác thực; tenant đang hoạt động; có permission và data scope phù hợp. Project/team đã tồn tại và người dùng là thành viên hoặc người được phân công.|

|Luồng chính|1) Người dùng mở chức năng Khởi tạo workspace dự án; hệ thống tải dữ liệu theo scope.<br>2) Người dùng nhập/chọn điều kiện cần thiết; hệ thống kiểm tra validation và quyền.<br>3) Hệ thống thực hiện: Tạo workspace theo nhóm gồm overview, thành viên, milestone, sprint, backlog, artifact, feedback và activity.<br>4) Hệ thống lưu giao dịch, hiển thị kết quả, cập nhật dữ liệu liên quan và ghi audit/event.|

|Validation / Quy tắc|Milestone có deadline/rubric/late policy; submission bất biến theo version; trạng thái project và task theo workflow.|

|Ngoại lệ|401 khi phiên không hợp lệ; 403 khi thiếu quyền/scope; 404 khi đối tượng không tồn tại; 409 khi trùng/không đúng version hoặc transition; 422 khi dữ liệu nghiệp vụ không hợp lệ. Không mất dữ liệu người dùng đã nhập và phải có thông báo khắc phục được.|

|Hậu điều kiện|Dữ liệu và trạng thái liên quan nhất quán; sự kiện/outbox phát đúng một lần; audit có actor, thời gian, before/after và correlation ID.|

|Tiêu chí nghiệm thu|AC1. Mentor/Team thực hiện được nghiệp vụ trong phạm vi được cấp và kết quả đúng mô tả.<br>AC2. Người không có quyền bị chặn nhất quán ở UI và API; không rò rỉ dữ liệu qua response/export.<br>AC3. Validation, trạng thái loading/empty/error/success và xử lý thao tác lặp được kiểm thử.<br>AC4. Giao dịch thành công được lưu bền vững, phản ánh trên màn hình liên quan và có audit/correlation ID.|

|Màn hình / Nguồn|UI-STD-02..04, UI-STD-09..10, UI-MNT-02..03 \| Hub PRJ-01|



UFR-PRJ-002 - Milestone


|CONTRACT UFR-PRJ-002|CONTRACT UFR-PRJ-002|

|---|---|

|Phân hệ / Ưu tiên|Quản lý Mock Project, sprint và sản phẩm bàn giao / Must|

|Actor / Quyền|Mentor. Bắt buộc permission tương ứng và data scope hợp lệ.|

|Yêu cầu|Tạo milestone với hạn, checklist, rubric, late policy và người duyệt.|

|Tiền điều kiện|Người dùng đã xác thực; tenant đang hoạt động; có permission và data scope phù hợp. Project/team đã tồn tại và người dùng là thành viên hoặc người được phân công.|

|Luồng chính|1) Người dùng mở chức năng Milestone; hệ thống tải dữ liệu theo scope.<br>2) Người dùng nhập/chọn điều kiện cần thiết; hệ thống kiểm tra validation và quyền.<br>3) Hệ thống thực hiện: Tạo milestone với hạn, checklist, rubric, late policy và người duyệt.<br>4) Hệ thống lưu giao dịch, hiển thị kết quả, cập nhật dữ liệu liên quan và ghi audit/event.|

|Validation / Quy tắc|Milestone có deadline/rubric/late policy; submission bất biến theo version; trạng thái project và task theo workflow.|

|Ngoại lệ|401 khi phiên không hợp lệ; 403 khi thiếu quyền/scope; 404 khi đối tượng không tồn tại; 409 khi trùng/không đúng version hoặc transition; 422 khi dữ liệu nghiệp vụ không hợp lệ. Không mất dữ liệu người dùng đã nhập và phải có thông báo khắc phục được.|

|Hậu điều kiện|Dữ liệu và trạng thái liên quan nhất quán; sự kiện/outbox phát đúng một lần; audit có actor, thời gian, before/after và correlation ID.|

|Tiêu chí nghiệm thu|AC1. Mentor thực hiện được nghiệp vụ trong phạm vi được cấp và kết quả đúng mô tả.<br>AC2. Người không có quyền bị chặn nhất quán ở UI và API; không rò rỉ dữ liệu qua response/export.<br>AC3. Validation, trạng thái loading/empty/error/success và xử lý thao tác lặp được kiểm thử.<br>AC4. Giao dịch thành công được lưu bền vững, phản ánh trên màn hình liên quan và có audit/correlation ID.|

|Màn hình / Nguồn|UI-STD-02..04, UI-STD-09..10, UI-MNT-02..03 \| Hub PRJ-02|



UFR-PRJ-003 - Sprint và backlog


|CONTRACT UFR-PRJ-003|CONTRACT UFR-PRJ-003|

|---|---|

|Phân hệ / Ưu tiên|Quản lý Mock Project, sprint và sản phẩm bàn giao / Must|

|Actor / Quyền|Sinh viên. Bắt buộc permission tương ứng và data scope hợp lệ.|

|Yêu cầu|Tạo sprint, mục tiêu sprint và backlog; liên kết với milestone/project.|

|Tiền điều kiện|Người dùng đã xác thực; tenant đang hoạt động; có permission và data scope phù hợp. Project/team đã tồn tại và người dùng là thành viên hoặc người được phân công.|

|Luồng chính|1) Người dùng mở chức năng Sprint và backlog; hệ thống tải dữ liệu theo scope.<br>2) Người dùng nhập/chọn điều kiện cần thiết; hệ thống kiểm tra validation và quyền.<br>3) Hệ thống thực hiện: Tạo sprint, mục tiêu sprint và backlog; liên kết với milestone/project.<br>4) Hệ thống lưu giao dịch, hiển thị kết quả, cập nhật dữ liệu liên quan và ghi audit/event.|

|Validation / Quy tắc|Milestone có deadline/rubric/late policy; submission bất biến theo version; trạng thái project và task theo workflow.|

|Ngoại lệ|401 khi phiên không hợp lệ; 403 khi thiếu quyền/scope; 404 khi đối tượng không tồn tại; 409 khi trùng/không đúng version hoặc transition; 422 khi dữ liệu nghiệp vụ không hợp lệ. Không mất dữ liệu người dùng đã nhập và phải có thông báo khắc phục được.|

|Hậu điều kiện|Dữ liệu và trạng thái liên quan nhất quán; sự kiện/outbox phát đúng một lần; audit có actor, thời gian, before/after và correlation ID.|

|Tiêu chí nghiệm thu|AC1. Sinh viên thực hiện được nghiệp vụ trong phạm vi được cấp và kết quả đúng mô tả.<br>AC2. Người không có quyền bị chặn nhất quán ở UI và API; không rò rỉ dữ liệu qua response/export.<br>AC3. Validation, trạng thái loading/empty/error/success và xử lý thao tác lặp được kiểm thử.<br>AC4. Giao dịch thành công được lưu bền vững, phản ánh trên màn hình liên quan và có audit/correlation ID.|

|Màn hình / Nguồn|UI-STD-02..04, UI-STD-09..10, UI-MNT-02..03 \| Hub PRJ-03|



UFR-PRJ-004 - Task


|CONTRACT UFR-PRJ-004|CONTRACT UFR-PRJ-004|

|---|---|

|Phân hệ / Ưu tiên|Quản lý Mock Project, sprint và sản phẩm bàn giao / Must|

|Actor / Quyền|Sinh viên/Mentor. Bắt buộc permission tương ứng và data scope hợp lệ.|

|Yêu cầu|CRUD task, assignee, estimate, priority, tag, dependency và trạng thái.|

|Tiền điều kiện|Người dùng đã xác thực; tenant đang hoạt động; có permission và data scope phù hợp. Project/team đã tồn tại và người dùng là thành viên hoặc người được phân công.|

|Luồng chính|1) Người dùng mở chức năng Task; hệ thống tải dữ liệu theo scope.<br>2) Người dùng nhập/chọn điều kiện cần thiết; hệ thống kiểm tra validation và quyền.<br>3) Hệ thống thực hiện: CRUD task, assignee, estimate, priority, tag, dependency và trạng thái.<br>4) Hệ thống lưu giao dịch, hiển thị kết quả, cập nhật dữ liệu liên quan và ghi audit/event.|

|Validation / Quy tắc|Milestone có deadline/rubric/late policy; submission bất biến theo version; trạng thái project và task theo workflow.|

|Ngoại lệ|401 khi phiên không hợp lệ; 403 khi thiếu quyền/scope; 404 khi đối tượng không tồn tại; 409 khi trùng/không đúng version hoặc transition; 422 khi dữ liệu nghiệp vụ không hợp lệ. Không mất dữ liệu người dùng đã nhập và phải có thông báo khắc phục được.|

|Hậu điều kiện|Dữ liệu và trạng thái liên quan nhất quán; sự kiện/outbox phát đúng một lần; audit có actor, thời gian, before/after và correlation ID.|

|Tiêu chí nghiệm thu|AC1. Sinh viên/Mentor thực hiện được nghiệp vụ trong phạm vi được cấp và kết quả đúng mô tả.<br>AC2. Người không có quyền bị chặn nhất quán ở UI và API; không rò rỉ dữ liệu qua response/export.<br>AC3. Validation, trạng thái loading/empty/error/success và xử lý thao tác lặp được kiểm thử.<br>AC4. Giao dịch thành công được lưu bền vững, phản ánh trên màn hình liên quan và có audit/correlation ID.|

|Màn hình / Nguồn|UI-STD-02..04, UI-STD-09..10, UI-MNT-02..03 \| Hub PRJ-03|



UFR-PRJ-005 - Board và activity


|CONTRACT UFR-PRJ-005|CONTRACT UFR-PRJ-005|

|---|---|

|Phân hệ / Ưu tiên|Quản lý Mock Project, sprint và sản phẩm bàn giao / Must|

|Actor / Quyền|Team/Mentor. Bắt buộc permission tương ứng và data scope hợp lệ.|

|Yêu cầu|Hiển thị board/list và ghi actor/timestamp cho mọi thay đổi trạng thái.|

|Tiền điều kiện|Người dùng đã xác thực; tenant đang hoạt động; có permission và data scope phù hợp. Project/team đã tồn tại và người dùng là thành viên hoặc người được phân công.|

|Luồng chính|1) Người dùng mở chức năng Board và activity; hệ thống tải dữ liệu theo scope.<br>2) Người dùng nhập/chọn điều kiện cần thiết; hệ thống kiểm tra validation và quyền.<br>3) Hệ thống thực hiện: Hiển thị board/list và ghi actor/timestamp cho mọi thay đổi trạng thái.<br>4) Hệ thống lưu giao dịch, hiển thị kết quả, cập nhật dữ liệu liên quan và ghi audit/event.|

|Validation / Quy tắc|Milestone có deadline/rubric/late policy; submission bất biến theo version; trạng thái project và task theo workflow.|

|Ngoại lệ|401 khi phiên không hợp lệ; 403 khi thiếu quyền/scope; 404 khi đối tượng không tồn tại; 409 khi trùng/không đúng version hoặc transition; 422 khi dữ liệu nghiệp vụ không hợp lệ. Không mất dữ liệu người dùng đã nhập và phải có thông báo khắc phục được.|

|Hậu điều kiện|Dữ liệu và trạng thái liên quan nhất quán; sự kiện/outbox phát đúng một lần; audit có actor, thời gian, before/after và correlation ID.|

|Tiêu chí nghiệm thu|AC1. Team/Mentor thực hiện được nghiệp vụ trong phạm vi được cấp và kết quả đúng mô tả.<br>AC2. Người không có quyền bị chặn nhất quán ở UI và API; không rò rỉ dữ liệu qua response/export.<br>AC3. Validation, trạng thái loading/empty/error/success và xử lý thao tác lặp được kiểm thử.<br>AC4. Giao dịch thành công được lưu bền vững, phản ánh trên màn hình liên quan và có audit/correlation ID.|

|Màn hình / Nguồn|UI-STD-02..04, UI-STD-09..10, UI-MNT-02..03 \| Hub PRJ-04|



UFR-PRJ-006 - Nộp artifact


|CONTRACT UFR-PRJ-006|CONTRACT UFR-PRJ-006|

|---|---|

|Phân hệ / Ưu tiên|Quản lý Mock Project, sprint và sản phẩm bàn giao / Must|

|Actor / Quyền|Sinh viên. Bắt buộc permission tương ứng và data scope hợp lệ.|

|Yêu cầu|Nộp file hoặc URL; mỗi lần nộp tạo version bất biến với người nộp, thời gian và thay đổi.|

|Tiền điều kiện|Người dùng đã xác thực; tenant đang hoạt động; có permission và data scope phù hợp. Project/team đã tồn tại và người dùng là thành viên hoặc người được phân công.|

|Luồng chính|1) Người dùng mở chức năng Nộp artifact; hệ thống tải dữ liệu theo scope.<br>2) Người dùng nhập/chọn điều kiện cần thiết; hệ thống kiểm tra validation và quyền.<br>3) Hệ thống thực hiện: Nộp file hoặc URL; mỗi lần nộp tạo version bất biến với người nộp, thời gian và thay đổi.<br>4) Hệ thống lưu giao dịch, hiển thị kết quả, cập nhật dữ liệu liên quan và ghi audit/event.|

|Validation / Quy tắc|Milestone có deadline/rubric/late policy; submission bất biến theo version; trạng thái project và task theo workflow.|

|Ngoại lệ|401 khi phiên không hợp lệ; 403 khi thiếu quyền/scope; 404 khi đối tượng không tồn tại; 409 khi trùng/không đúng version hoặc transition; 422 khi dữ liệu nghiệp vụ không hợp lệ. Không mất dữ liệu người dùng đã nhập và phải có thông báo khắc phục được.|

|Hậu điều kiện|Dữ liệu và trạng thái liên quan nhất quán; sự kiện/outbox phát đúng một lần; audit có actor, thời gian, before/after và correlation ID.|

|Tiêu chí nghiệm thu|AC1. Sinh viên thực hiện được nghiệp vụ trong phạm vi được cấp và kết quả đúng mô tả.<br>AC2. Người không có quyền bị chặn nhất quán ở UI và API; không rò rỉ dữ liệu qua response/export.<br>AC3. Validation, trạng thái loading/empty/error/success và xử lý thao tác lặp được kiểm thử.<br>AC4. Giao dịch thành công được lưu bền vững, phản ánh trên màn hình liên quan và có audit/correlation ID.|

|Màn hình / Nguồn|UI-STD-02..04, UI-STD-09..10, UI-MNT-02..03 \| Hub PRJ-05|



UFR-PRJ-007 - Review milestone


|CONTRACT UFR-PRJ-007|CONTRACT UFR-PRJ-007|

|---|---|

|Phân hệ / Ưu tiên|Quản lý Mock Project, sprint và sản phẩm bàn giao / Must|

|Actor / Quyền|Mentor/Reviewer. Bắt buộc permission tương ứng và data scope hợp lệ.|

|Yêu cầu|Yêu cầu sửa, chấp nhận hoặc từ chối kèm feedback có cấu trúc.|

|Tiền điều kiện|Người dùng đã xác thực; tenant đang hoạt động; có permission và data scope phù hợp. Project/team đã tồn tại và người dùng là thành viên hoặc người được phân công.|

|Luồng chính|1) Người dùng mở chức năng Review milestone; hệ thống tải dữ liệu theo scope.<br>2) Người dùng nhập/chọn điều kiện cần thiết; hệ thống kiểm tra validation và quyền.<br>3) Hệ thống thực hiện: Yêu cầu sửa, chấp nhận hoặc từ chối kèm feedback có cấu trúc.<br>4) Hệ thống lưu giao dịch, hiển thị kết quả, cập nhật dữ liệu liên quan và ghi audit/event.|

|Validation / Quy tắc|Milestone có deadline/rubric/late policy; submission bất biến theo version; trạng thái project và task theo workflow.|

|Ngoại lệ|401 khi phiên không hợp lệ; 403 khi thiếu quyền/scope; 404 khi đối tượng không tồn tại; 409 khi trùng/không đúng version hoặc transition; 422 khi dữ liệu nghiệp vụ không hợp lệ. Không mất dữ liệu người dùng đã nhập và phải có thông báo khắc phục được.|

|Hậu điều kiện|Dữ liệu và trạng thái liên quan nhất quán; sự kiện/outbox phát đúng một lần; audit có actor, thời gian, before/after và correlation ID.|

|Tiêu chí nghiệm thu|AC1. Mentor/Reviewer thực hiện được nghiệp vụ trong phạm vi được cấp và kết quả đúng mô tả.<br>AC2. Người không có quyền bị chặn nhất quán ở UI và API; không rò rỉ dữ liệu qua response/export.<br>AC3. Validation, trạng thái loading/empty/error/success và xử lý thao tác lặp được kiểm thử.<br>AC4. Giao dịch thành công được lưu bền vững, phản ánh trên màn hình liên quan và có audit/correlation ID.|

|Màn hình / Nguồn|UI-STD-02..04, UI-STD-09..10, UI-MNT-02..03 \| Hub PRJ-06|



UFR-PRJ-008 - Cảnh báo tiến độ


|CONTRACT UFR-PRJ-008|CONTRACT UFR-PRJ-008|

|---|---|

|Phân hệ / Ưu tiên|Quản lý Mock Project, sprint và sản phẩm bàn giao / Must|

|Actor / Quyền|Mentor/Team. Bắt buộc permission tương ứng và data scope hợp lệ.|

|Yêu cầu|Cảnh báo task quá hạn, milestone rủi ro và thành viên không hoạt động.|

|Tiền điều kiện|Người dùng đã xác thực; tenant đang hoạt động; có permission và data scope phù hợp. Project/team đã tồn tại và người dùng là thành viên hoặc người được phân công.|

|Luồng chính|1) Người dùng mở chức năng Cảnh báo tiến độ; hệ thống tải dữ liệu theo scope.<br>2) Người dùng nhập/chọn điều kiện cần thiết; hệ thống kiểm tra validation và quyền.<br>3) Hệ thống thực hiện: Cảnh báo task quá hạn, milestone rủi ro và thành viên không hoạt động.<br>4) Hệ thống lưu giao dịch, hiển thị kết quả, cập nhật dữ liệu liên quan và ghi audit/event.|

|Validation / Quy tắc|Milestone có deadline/rubric/late policy; submission bất biến theo version; trạng thái project và task theo workflow.|

|Ngoại lệ|401 khi phiên không hợp lệ; 403 khi thiếu quyền/scope; 404 khi đối tượng không tồn tại; 409 khi trùng/không đúng version hoặc transition; 422 khi dữ liệu nghiệp vụ không hợp lệ. Không mất dữ liệu người dùng đã nhập và phải có thông báo khắc phục được.|

|Hậu điều kiện|Dữ liệu và trạng thái liên quan nhất quán; sự kiện/outbox phát đúng một lần; audit có actor, thời gian, before/after và correlation ID.|

|Tiêu chí nghiệm thu|AC1. Mentor/Team thực hiện được nghiệp vụ trong phạm vi được cấp và kết quả đúng mô tả.<br>AC2. Người không có quyền bị chặn nhất quán ở UI và API; không rò rỉ dữ liệu qua response/export.<br>AC3. Validation, trạng thái loading/empty/error/success và xử lý thao tác lặp được kiểm thử.<br>AC4. Giao dịch thành công được lưu bền vững, phản ánh trên màn hình liên quan và có audit/correlation ID.|

|Màn hình / Nguồn|UI-STD-02..04, UI-STD-09..10, UI-MNT-02..03 \| Hub PRJ-07|



UFR-PRJ-009 - Nhật ký dự án


|CONTRACT UFR-PRJ-009|CONTRACT UFR-PRJ-009|

|---|---|

|Phân hệ / Ưu tiên|Quản lý Mock Project, sprint và sản phẩm bàn giao / Must|

|Actor / Quyền|Team/Mentor. Bắt buộc permission tương ứng và data scope hợp lệ.|

|Yêu cầu|Decision log, risk/issue log và meeting note có liên kết task/milestone.|

|Tiền điều kiện|Người dùng đã xác thực; tenant đang hoạt động; có permission và data scope phù hợp. Project/team đã tồn tại và người dùng là thành viên hoặc người được phân công.|

|Luồng chính|1) Người dùng mở chức năng Nhật ký dự án; hệ thống tải dữ liệu theo scope.<br>2) Người dùng nhập/chọn điều kiện cần thiết; hệ thống kiểm tra validation và quyền.<br>3) Hệ thống thực hiện: Decision log, risk/issue log và meeting note có liên kết task/milestone.<br>4) Hệ thống lưu giao dịch, hiển thị kết quả, cập nhật dữ liệu liên quan và ghi audit/event.|

|Validation / Quy tắc|Milestone có deadline/rubric/late policy; submission bất biến theo version; trạng thái project và task theo workflow.|

|Ngoại lệ|401 khi phiên không hợp lệ; 403 khi thiếu quyền/scope; 404 khi đối tượng không tồn tại; 409 khi trùng/không đúng version hoặc transition; 422 khi dữ liệu nghiệp vụ không hợp lệ. Không mất dữ liệu người dùng đã nhập và phải có thông báo khắc phục được.|

|Hậu điều kiện|Dữ liệu và trạng thái liên quan nhất quán; sự kiện/outbox phát đúng một lần; audit có actor, thời gian, before/after và correlation ID.|

|Tiêu chí nghiệm thu|AC1. Team/Mentor thực hiện được nghiệp vụ trong phạm vi được cấp và kết quả đúng mô tả.<br>AC2. Người không có quyền bị chặn nhất quán ở UI và API; không rò rỉ dữ liệu qua response/export.<br>AC3. Validation, trạng thái loading/empty/error/success và xử lý thao tác lặp được kiểm thử.<br>AC4. Giao dịch thành công được lưu bền vững, phản ánh trên màn hình liên quan và có audit/correlation ID.|

|Màn hình / Nguồn|UI-STD-02..04, UI-STD-09..10, UI-MNT-02..03 \| Hub PRJ-08|



UFR-PRJ-010 - Tích hợp repository


|CONTRACT UFR-PRJ-010|CONTRACT UFR-PRJ-010|

|---|---|

|Phân hệ / Ưu tiên|Quản lý Mock Project, sprint và sản phẩm bàn giao / Should|

|Actor / Quyền|Team/Admin. Bắt buộc permission tương ứng và data scope hợp lệ.|

|Yêu cầu|Liên kết repo URL/webhook và ghi metadata commit/pull request; không lưu secret dạng rõ.|

|Tiền điều kiện|Người dùng đã xác thực; tenant đang hoạt động; có permission và data scope phù hợp. Project/team đã tồn tại và người dùng là thành viên hoặc người được phân công.|

|Luồng chính|1) Người dùng mở chức năng Tích hợp repository; hệ thống tải dữ liệu theo scope.<br>2) Người dùng nhập/chọn điều kiện cần thiết; hệ thống kiểm tra validation và quyền.<br>3) Hệ thống thực hiện: Liên kết repo URL/webhook và ghi metadata commit/pull request; không lưu secret dạng rõ.<br>4) Hệ thống lưu giao dịch, hiển thị kết quả, cập nhật dữ liệu liên quan và ghi audit/event.|

|Validation / Quy tắc|Milestone có deadline/rubric/late policy; submission bất biến theo version; trạng thái project và task theo workflow.|

|Ngoại lệ|401 khi phiên không hợp lệ; 403 khi thiếu quyền/scope; 404 khi đối tượng không tồn tại; 409 khi trùng/không đúng version hoặc transition; 422 khi dữ liệu nghiệp vụ không hợp lệ. Không mất dữ liệu người dùng đã nhập và phải có thông báo khắc phục được.|

|Hậu điều kiện|Dữ liệu và trạng thái liên quan nhất quán; sự kiện/outbox phát đúng một lần; audit có actor, thời gian, before/after và correlation ID.|

|Tiêu chí nghiệm thu|AC1. Team/Admin thực hiện được nghiệp vụ trong phạm vi được cấp và kết quả đúng mô tả.<br>AC2. Người không có quyền bị chặn nhất quán ở UI và API; không rò rỉ dữ liệu qua response/export.<br>AC3. Validation, trạng thái loading/empty/error/success và xử lý thao tác lặp được kiểm thử.<br>AC4. Giao dịch thành công được lưu bền vững, phản ánh trên màn hình liên quan và có audit/correlation ID.|

|Màn hình / Nguồn|UI-STD-02..04, UI-STD-09..10, UI-MNT-02..03 \| Hub ADM-02|




## 5.6 Quản lý học tập và tiến độ

UFR-LRN-001 - Course catalog


|CONTRACT UFR-LRN-001|CONTRACT UFR-LRN-001|

|---|---|

|Phân hệ / Ưu tiên|Quản lý học tập và tiến độ / Must|

|Actor / Quyền|Trainee. Bắt buộc permission tương ứng và data scope hợp lệ.|

|Yêu cầu|Duyệt/tìm/lọc course đang mở và xem thông tin trước khi đăng ký.|

|Tiền điều kiện|Người dùng đã xác thực; tenant đang hoạt động; có permission và data scope phù hợp.|

|Luồng chính|1) Người dùng mở chức năng Course catalog; hệ thống tải dữ liệu theo scope.<br>2) Người dùng nhập/chọn điều kiện cần thiết; hệ thống kiểm tra validation và quyền.<br>3) Hệ thống thực hiện: Duyệt/tìm/lọc course đang mở và xem thông tin trước khi đăng ký.<br>4) Hệ thống lưu giao dịch, hiển thị kết quả, cập nhật dữ liệu liên quan và ghi audit/event.|

|Validation / Quy tắc|Tiến độ được tính từ material/session/assessment bắt buộc; completion và certificate chỉ phát khi đủ điều kiện.|

|Ngoại lệ|401 khi phiên không hợp lệ; 403 khi thiếu quyền/scope; 404 khi đối tượng không tồn tại; 409 khi trùng/không đúng version hoặc transition; 422 khi dữ liệu nghiệp vụ không hợp lệ. Không mất dữ liệu người dùng đã nhập và phải có thông báo khắc phục được.|

|Hậu điều kiện|Dữ liệu và trạng thái liên quan nhất quán; sự kiện/outbox phát đúng một lần; audit có actor, thời gian, before/after và correlation ID.|

|Tiêu chí nghiệm thu|AC1. Trainee thực hiện được nghiệp vụ trong phạm vi được cấp và kết quả đúng mô tả.<br>AC2. Người không có quyền bị chặn nhất quán ở UI và API; không rò rỉ dữ liệu qua response/export.<br>AC3. Validation, trạng thái loading/empty/error/success và xử lý thao tác lặp được kiểm thử.<br>AC4. Giao dịch thành công được lưu bền vững, phản ánh trên màn hình liên quan và có audit/correlation ID.|

|Màn hình / Nguồn|SCR-66..70; UI-STD-01, UI-STD-07 \| FAMS FR-222|



UFR-LRN-002 - Đăng ký course


|CONTRACT UFR-LRN-002|CONTRACT UFR-LRN-002|

|---|---|

|Phân hệ / Ưu tiên|Quản lý học tập và tiến độ / Must|

|Actor / Quyền|Trainee. Bắt buộc permission tương ứng và data scope hợp lệ.|

|Yêu cầu|Kiểm tra điều kiện, chống đăng ký trùng và tạo tiến độ NOT_STARTED.|

|Tiền điều kiện|Người dùng đã xác thực; tenant đang hoạt động; có permission và data scope phù hợp.|

|Luồng chính|1) Người dùng mở chức năng Đăng ký course; hệ thống tải dữ liệu theo scope.<br>2) Người dùng nhập/chọn điều kiện cần thiết; hệ thống kiểm tra validation và quyền.<br>3) Hệ thống thực hiện: Kiểm tra điều kiện, chống đăng ký trùng và tạo tiến độ NOT_STARTED.<br>4) Hệ thống lưu giao dịch, hiển thị kết quả, cập nhật dữ liệu liên quan và ghi audit/event.|

|Validation / Quy tắc|Tiến độ được tính từ material/session/assessment bắt buộc; completion và certificate chỉ phát khi đủ điều kiện.|

|Ngoại lệ|401 khi phiên không hợp lệ; 403 khi thiếu quyền/scope; 404 khi đối tượng không tồn tại; 409 khi trùng/không đúng version hoặc transition; 422 khi dữ liệu nghiệp vụ không hợp lệ. Không mất dữ liệu người dùng đã nhập và phải có thông báo khắc phục được.|

|Hậu điều kiện|Dữ liệu và trạng thái liên quan nhất quán; sự kiện/outbox phát đúng một lần; audit có actor, thời gian, before/after và correlation ID.|

|Tiêu chí nghiệm thu|AC1. Trainee thực hiện được nghiệp vụ trong phạm vi được cấp và kết quả đúng mô tả.<br>AC2. Người không có quyền bị chặn nhất quán ở UI và API; không rò rỉ dữ liệu qua response/export.<br>AC3. Validation, trạng thái loading/empty/error/success và xử lý thao tác lặp được kiểm thử.<br>AC4. Giao dịch thành công được lưu bền vững, phản ánh trên màn hình liên quan và có audit/correlation ID.|

|Màn hình / Nguồn|SCR-66..70; UI-STD-01, UI-STD-07 \| FAMS FR-222|



UFR-LRN-003 - My Courses


|CONTRACT UFR-LRN-003|CONTRACT UFR-LRN-003|

|---|---|

|Phân hệ / Ưu tiên|Quản lý học tập và tiến độ / Must|

|Actor / Quyền|Trainee. Bắt buộc permission tương ứng và data scope hợp lệ.|

|Yêu cầu|Danh sách course đã đăng ký theo trạng thái và mức hoàn thành.|

|Tiền điều kiện|Người dùng đã xác thực; tenant đang hoạt động; có permission và data scope phù hợp.|

|Luồng chính|1) Người dùng mở chức năng My Courses; hệ thống tải dữ liệu theo scope.<br>2) Người dùng nhập/chọn điều kiện cần thiết; hệ thống kiểm tra validation và quyền.<br>3) Hệ thống thực hiện: Danh sách course đã đăng ký theo trạng thái và mức hoàn thành.<br>4) Hệ thống lưu giao dịch, hiển thị kết quả, cập nhật dữ liệu liên quan và ghi audit/event.|

|Validation / Quy tắc|Tiến độ được tính từ material/session/assessment bắt buộc; completion và certificate chỉ phát khi đủ điều kiện.|

|Ngoại lệ|401 khi phiên không hợp lệ; 403 khi thiếu quyền/scope; 404 khi đối tượng không tồn tại; 409 khi trùng/không đúng version hoặc transition; 422 khi dữ liệu nghiệp vụ không hợp lệ. Không mất dữ liệu người dùng đã nhập và phải có thông báo khắc phục được.|

|Hậu điều kiện|Dữ liệu và trạng thái liên quan nhất quán; sự kiện/outbox phát đúng một lần; audit có actor, thời gian, before/after và correlation ID.|

|Tiêu chí nghiệm thu|AC1. Trainee thực hiện được nghiệp vụ trong phạm vi được cấp và kết quả đúng mô tả.<br>AC2. Người không có quyền bị chặn nhất quán ở UI và API; không rò rỉ dữ liệu qua response/export.<br>AC3. Validation, trạng thái loading/empty/error/success và xử lý thao tác lặp được kiểm thử.<br>AC4. Giao dịch thành công được lưu bền vững, phản ánh trên màn hình liên quan và có audit/correlation ID.|

|Màn hình / Nguồn|SCR-66..70; UI-STD-01, UI-STD-07 \| FAMS SCR-67|



UFR-LRN-004 - Course player


|CONTRACT UFR-LRN-004|CONTRACT UFR-LRN-004|

|---|---|

|Phân hệ / Ưu tiên|Quản lý học tập và tiến độ / Must|

|Actor / Quyền|Trainee. Bắt buộc permission tương ứng và data scope hợp lệ.|

|Yêu cầu|Phát video, xem tài liệu, điều hướng lesson/session/material và lưu vị trí học.|

|Tiền điều kiện|Người dùng đã xác thực; tenant đang hoạt động; có permission và data scope phù hợp.|

|Luồng chính|1) Người dùng mở chức năng Course player; hệ thống tải dữ liệu theo scope.<br>2) Người dùng nhập/chọn điều kiện cần thiết; hệ thống kiểm tra validation và quyền.<br>3) Hệ thống thực hiện: Phát video, xem tài liệu, điều hướng lesson/session/material và lưu vị trí học.<br>4) Hệ thống lưu giao dịch, hiển thị kết quả, cập nhật dữ liệu liên quan và ghi audit/event.|

|Validation / Quy tắc|Tiến độ được tính từ material/session/assessment bắt buộc; completion và certificate chỉ phát khi đủ điều kiện.|

|Ngoại lệ|401 khi phiên không hợp lệ; 403 khi thiếu quyền/scope; 404 khi đối tượng không tồn tại; 409 khi trùng/không đúng version hoặc transition; 422 khi dữ liệu nghiệp vụ không hợp lệ. Không mất dữ liệu người dùng đã nhập và phải có thông báo khắc phục được.|

|Hậu điều kiện|Dữ liệu và trạng thái liên quan nhất quán; sự kiện/outbox phát đúng một lần; audit có actor, thời gian, before/after và correlation ID.|

|Tiêu chí nghiệm thu|AC1. Trainee thực hiện được nghiệp vụ trong phạm vi được cấp và kết quả đúng mô tả.<br>AC2. Người không có quyền bị chặn nhất quán ở UI và API; không rò rỉ dữ liệu qua response/export.<br>AC3. Validation, trạng thái loading/empty/error/success và xử lý thao tác lặp được kiểm thử.<br>AC4. Giao dịch thành công được lưu bền vững, phản ánh trên màn hình liên quan và có audit/correlation ID.|

|Màn hình / Nguồn|SCR-66..70; UI-STD-01, UI-STD-07 \| FAMS FR-223|



UFR-LRN-005 - Theo dõi tiến độ


|CONTRACT UFR-LRN-005|CONTRACT UFR-LRN-005|

|---|---|

|Phân hệ / Ưu tiên|Quản lý học tập và tiến độ / Must|

|Actor / Quyền|Trainee/Trainer. Bắt buộc permission tương ứng và data scope hợp lệ.|

|Yêu cầu|Theo dõi Material -> Session -> Course theo thời gian thực và đồng bộ đa phiên.|

|Tiền điều kiện|Người dùng đã xác thực; tenant đang hoạt động; có permission và data scope phù hợp.|

|Luồng chính|1) Người dùng mở chức năng Theo dõi tiến độ; hệ thống tải dữ liệu theo scope.<br>2) Người dùng nhập/chọn điều kiện cần thiết; hệ thống kiểm tra validation và quyền.<br>3) Hệ thống thực hiện: Theo dõi Material -> Session -> Course theo thời gian thực và đồng bộ đa phiên.<br>4) Hệ thống lưu giao dịch, hiển thị kết quả, cập nhật dữ liệu liên quan và ghi audit/event.|

|Validation / Quy tắc|Tiến độ được tính từ material/session/assessment bắt buộc; completion và certificate chỉ phát khi đủ điều kiện.|

|Ngoại lệ|401 khi phiên không hợp lệ; 403 khi thiếu quyền/scope; 404 khi đối tượng không tồn tại; 409 khi trùng/không đúng version hoặc transition; 422 khi dữ liệu nghiệp vụ không hợp lệ. Không mất dữ liệu người dùng đã nhập và phải có thông báo khắc phục được.|

|Hậu điều kiện|Dữ liệu và trạng thái liên quan nhất quán; sự kiện/outbox phát đúng một lần; audit có actor, thời gian, before/after và correlation ID.|

|Tiêu chí nghiệm thu|AC1. Trainee/Trainer thực hiện được nghiệp vụ trong phạm vi được cấp và kết quả đúng mô tả.<br>AC2. Người không có quyền bị chặn nhất quán ở UI và API; không rò rỉ dữ liệu qua response/export.<br>AC3. Validation, trạng thái loading/empty/error/success và xử lý thao tác lặp được kiểm thử.<br>AC4. Giao dịch thành công được lưu bền vững, phản ánh trên màn hình liên quan và có audit/correlation ID.|

|Màn hình / Nguồn|SCR-66..70; UI-STD-01, UI-STD-07 \| FAMS FR-223|



UFR-LRN-006 - Hoàn thành course


|CONTRACT UFR-LRN-006|CONTRACT UFR-LRN-006|

|---|---|

|Phân hệ / Ưu tiên|Quản lý học tập và tiến độ / Must|

|Actor / Quyền|Hệ thống. Bắt buộc permission tương ứng và data scope hợp lệ.|

|Yêu cầu|Đánh dấu complete khi đủ material/session và assessment bắt buộc theo rule.|

|Tiền điều kiện|Người dùng đã xác thực; tenant đang hoạt động; có permission và data scope phù hợp.|

|Luồng chính|1) Người dùng mở chức năng Hoàn thành course; hệ thống tải dữ liệu theo scope.<br>2) Người dùng nhập/chọn điều kiện cần thiết; hệ thống kiểm tra validation và quyền.<br>3) Hệ thống thực hiện: Đánh dấu complete khi đủ material/session và assessment bắt buộc theo rule.<br>4) Hệ thống lưu giao dịch, hiển thị kết quả, cập nhật dữ liệu liên quan và ghi audit/event.|

|Validation / Quy tắc|Tiến độ được tính từ material/session/assessment bắt buộc; completion và certificate chỉ phát khi đủ điều kiện.|

|Ngoại lệ|401 khi phiên không hợp lệ; 403 khi thiếu quyền/scope; 404 khi đối tượng không tồn tại; 409 khi trùng/không đúng version hoặc transition; 422 khi dữ liệu nghiệp vụ không hợp lệ. Không mất dữ liệu người dùng đã nhập và phải có thông báo khắc phục được.|

|Hậu điều kiện|Dữ liệu và trạng thái liên quan nhất quán; sự kiện/outbox phát đúng một lần; audit có actor, thời gian, before/after và correlation ID.|

|Tiêu chí nghiệm thu|AC1. Hệ thống thực hiện được nghiệp vụ trong phạm vi được cấp và kết quả đúng mô tả.<br>AC2. Người không có quyền bị chặn nhất quán ở UI và API; không rò rỉ dữ liệu qua response/export.<br>AC3. Validation, trạng thái loading/empty/error/success và xử lý thao tác lặp được kiểm thử.<br>AC4. Giao dịch thành công được lưu bền vững, phản ánh trên màn hình liên quan và có audit/correlation ID.|

|Màn hình / Nguồn|SCR-66..70; UI-STD-01, UI-STD-07 \| FAMS FR-224|



UFR-LRN-007 - Đánh giá course


|CONTRACT UFR-LRN-007|CONTRACT UFR-LRN-007|

|---|---|

|Phân hệ / Ưu tiên|Quản lý học tập và tiến độ / Should|

|Actor / Quyền|Trainee. Bắt buộc permission tương ứng và data scope hợp lệ.|

|Yêu cầu|Rating 1-5 và review cho course đã enroll; mỗi người một review và được cập nhật.|

|Tiền điều kiện|Người dùng đã xác thực; tenant đang hoạt động; có permission và data scope phù hợp.|

|Luồng chính|1) Người dùng mở chức năng Đánh giá course; hệ thống tải dữ liệu theo scope.<br>2) Người dùng nhập/chọn điều kiện cần thiết; hệ thống kiểm tra validation và quyền.<br>3) Hệ thống thực hiện: Rating 1-5 và review cho course đã enroll; mỗi người một review và được cập nhật.<br>4) Hệ thống lưu giao dịch, hiển thị kết quả, cập nhật dữ liệu liên quan và ghi audit/event.|

|Validation / Quy tắc|Tiến độ được tính từ material/session/assessment bắt buộc; completion và certificate chỉ phát khi đủ điều kiện.|

|Ngoại lệ|401 khi phiên không hợp lệ; 403 khi thiếu quyền/scope; 404 khi đối tượng không tồn tại; 409 khi trùng/không đúng version hoặc transition; 422 khi dữ liệu nghiệp vụ không hợp lệ. Không mất dữ liệu người dùng đã nhập và phải có thông báo khắc phục được.|

|Hậu điều kiện|Dữ liệu và trạng thái liên quan nhất quán; sự kiện/outbox phát đúng một lần; audit có actor, thời gian, before/after và correlation ID.|

|Tiêu chí nghiệm thu|AC1. Trainee thực hiện được nghiệp vụ trong phạm vi được cấp và kết quả đúng mô tả.<br>AC2. Người không có quyền bị chặn nhất quán ở UI và API; không rò rỉ dữ liệu qua response/export.<br>AC3. Validation, trạng thái loading/empty/error/success và xử lý thao tác lặp được kiểm thử.<br>AC4. Giao dịch thành công được lưu bền vững, phản ánh trên màn hình liên quan và có audit/correlation ID.|

|Màn hình / Nguồn|SCR-66..70; UI-STD-01, UI-STD-07 \| FAMS FR-224|



UFR-LRN-008 - My Classes/Calendar


|CONTRACT UFR-LRN-008|CONTRACT UFR-LRN-008|

|---|---|

|Phân hệ / Ưu tiên|Quản lý học tập và tiến độ / Must|

|Actor / Quyền|Trainee. Bắt buộc permission tương ứng và data scope hợp lệ.|

|Yêu cầu|Xem lớp, lịch, chuyên cần, topic/course và thay đổi lịch trong phạm vi cá nhân.|

|Tiền điều kiện|Người dùng đã xác thực; tenant đang hoạt động; có permission và data scope phù hợp.|

|Luồng chính|1) Người dùng mở chức năng My Classes/Calendar; hệ thống tải dữ liệu theo scope.<br>2) Người dùng nhập/chọn điều kiện cần thiết; hệ thống kiểm tra validation và quyền.<br>3) Hệ thống thực hiện: Xem lớp, lịch, chuyên cần, topic/course và thay đổi lịch trong phạm vi cá nhân.<br>4) Hệ thống lưu giao dịch, hiển thị kết quả, cập nhật dữ liệu liên quan và ghi audit/event.|

|Validation / Quy tắc|Tiến độ được tính từ material/session/assessment bắt buộc; completion và certificate chỉ phát khi đủ điều kiện.|

|Ngoại lệ|401 khi phiên không hợp lệ; 403 khi thiếu quyền/scope; 404 khi đối tượng không tồn tại; 409 khi trùng/không đúng version hoặc transition; 422 khi dữ liệu nghiệp vụ không hợp lệ. Không mất dữ liệu người dùng đã nhập và phải có thông báo khắc phục được.|

|Hậu điều kiện|Dữ liệu và trạng thái liên quan nhất quán; sự kiện/outbox phát đúng một lần; audit có actor, thời gian, before/after và correlation ID.|

|Tiêu chí nghiệm thu|AC1. Trainee thực hiện được nghiệp vụ trong phạm vi được cấp và kết quả đúng mô tả.<br>AC2. Người không có quyền bị chặn nhất quán ở UI và API; không rò rỉ dữ liệu qua response/export.<br>AC3. Validation, trạng thái loading/empty/error/success và xử lý thao tác lặp được kiểm thử.<br>AC4. Giao dịch thành công được lưu bền vững, phản ánh trên màn hình liên quan và có audit/correlation ID.|

|Màn hình / Nguồn|SCR-66..70; UI-STD-01, UI-STD-07 \| FAMS SCR-70|



UFR-LRN-009 - Portfolio học tập


|CONTRACT UFR-LRN-009|CONTRACT UFR-LRN-009|

|---|---|

|Phân hệ / Ưu tiên|Quản lý học tập và tiến độ / Should|

|Actor / Quyền|Sinh viên/Mentor. Bắt buộc permission tương ứng và data scope hợp lệ.|

|Yêu cầu|Tổng hợp vai trò, kỹ năng, artifact được duyệt và feedback đã công bố.|

|Tiền điều kiện|Người dùng đã xác thực; tenant đang hoạt động; có permission và data scope phù hợp.|

|Luồng chính|1) Người dùng mở chức năng Portfolio học tập; hệ thống tải dữ liệu theo scope.<br>2) Người dùng nhập/chọn điều kiện cần thiết; hệ thống kiểm tra validation và quyền.<br>3) Hệ thống thực hiện: Tổng hợp vai trò, kỹ năng, artifact được duyệt và feedback đã công bố.<br>4) Hệ thống lưu giao dịch, hiển thị kết quả, cập nhật dữ liệu liên quan và ghi audit/event.|

|Validation / Quy tắc|Tiến độ được tính từ material/session/assessment bắt buộc; completion và certificate chỉ phát khi đủ điều kiện.|

|Ngoại lệ|401 khi phiên không hợp lệ; 403 khi thiếu quyền/scope; 404 khi đối tượng không tồn tại; 409 khi trùng/không đúng version hoặc transition; 422 khi dữ liệu nghiệp vụ không hợp lệ. Không mất dữ liệu người dùng đã nhập và phải có thông báo khắc phục được.|

|Hậu điều kiện|Dữ liệu và trạng thái liên quan nhất quán; sự kiện/outbox phát đúng một lần; audit có actor, thời gian, before/after và correlation ID.|

|Tiêu chí nghiệm thu|AC1. Sinh viên/Mentor thực hiện được nghiệp vụ trong phạm vi được cấp và kết quả đúng mô tả.<br>AC2. Người không có quyền bị chặn nhất quán ở UI và API; không rò rỉ dữ liệu qua response/export.<br>AC3. Validation, trạng thái loading/empty/error/success và xử lý thao tác lặp được kiểm thử.<br>AC4. Giao dịch thành công được lưu bền vững, phản ánh trên màn hình liên quan và có audit/correlation ID.|

|Màn hình / Nguồn|SCR-66..70; UI-STD-01, UI-STD-07 \| Hub RPT-04|




## 5.7 Quản lý thi, assessment và chấm bài

UFR-EXM-001 - Quản lý assessment/checkpoint


|CONTRACT UFR-EXM-001|CONTRACT UFR-EXM-001|

|---|---|

|Phân hệ / Ưu tiên|Quản lý thi, assessment và chấm bài / Must|

|Actor / Quyền|Trainer/Mentor/Admin. Bắt buộc permission tương ứng và data scope hợp lệ.|

|Yêu cầu|CRUD, duplicate, publish assessment; hỗ trợ quiz, tự luận, upload file, URL, coding và rubric.|

|Tiền điều kiện|Người dùng đã xác thực; tenant đang hoạt động; có permission và data scope phù hợp. Cấu hình thời gian, người tham gia và nội dung đã được publish/phân công.|

|Luồng chính|1) Người dùng mở chức năng Quản lý assessment/checkpoint; hệ thống tải dữ liệu theo scope.<br>2) Người dùng nhập/chọn điều kiện cần thiết; hệ thống kiểm tra validation và quyền.<br>3) Hệ thống thực hiện: CRUD, duplicate, publish assessment; hỗ trợ quiz, tự luận, upload file, URL, coding và rubric.<br>4) Hệ thống lưu giao dịch, hiển thị kết quả, cập nhật dữ liệu liên quan và ghi audit/event.|

|Validation / Quy tắc|Attempt tuân thủ time window, attempt limit và autosave; bài coding chạy trong sandbox; kết quả chỉ hiện theo release policy.|

|Ngoại lệ|401 khi phiên không hợp lệ; 403 khi thiếu quyền/scope; 404 khi đối tượng không tồn tại; 409 khi trùng/không đúng version hoặc transition; 422 khi dữ liệu nghiệp vụ không hợp lệ. Không mất dữ liệu người dùng đã nhập và phải có thông báo khắc phục được.|

|Hậu điều kiện|Dữ liệu và trạng thái liên quan nhất quán; sự kiện/outbox phát đúng một lần; audit có actor, thời gian, before/after và correlation ID.|

|Tiêu chí nghiệm thu|AC1. Trainer/Mentor/Admin thực hiện được nghiệp vụ trong phạm vi được cấp và kết quả đúng mô tả.<br>AC2. Người không có quyền bị chặn nhất quán ở UI và API; không rò rỉ dữ liệu qua response/export.<br>AC3. Validation, trạng thái loading/empty/error/success và xử lý thao tác lặp được kiểm thử.<br>AC4. Giao dịch thành công được lưu bền vững, phản ánh trên màn hình liên quan và có audit/correlation ID.|

|Màn hình / Nguồn|SCR-54..65; UI-STD-05, UI-MNT-04 \| Hub ASM-01; FAMS FR-216|



UFR-EXM-002 - Cấu hình kỳ thi


|CONTRACT UFR-EXM-002|CONTRACT UFR-EXM-002|

|---|---|

|Phân hệ / Ưu tiên|Quản lý thi, assessment và chấm bài / Must|

|Actor / Quyền|Trainer/Admin. Bắt buộc permission tương ứng và data scope hợp lệ.|

|Yêu cầu|Thời gian mở/đóng, duration, số lần làm, random, scoring, late policy, security và result visibility.|

|Tiền điều kiện|Người dùng đã xác thực; tenant đang hoạt động; có permission và data scope phù hợp. Cấu hình thời gian, người tham gia và nội dung đã được publish/phân công.|

|Luồng chính|1) Người dùng mở chức năng Cấu hình kỳ thi; hệ thống tải dữ liệu theo scope.<br>2) Người dùng nhập/chọn điều kiện cần thiết; hệ thống kiểm tra validation và quyền.<br>3) Hệ thống thực hiện: Thời gian mở/đóng, duration, số lần làm, random, scoring, late policy, security và result visibility.<br>4) Hệ thống lưu giao dịch, hiển thị kết quả, cập nhật dữ liệu liên quan và ghi audit/event.|

|Validation / Quy tắc|Attempt tuân thủ time window, attempt limit và autosave; bài coding chạy trong sandbox; kết quả chỉ hiện theo release policy.|

|Ngoại lệ|401 khi phiên không hợp lệ; 403 khi thiếu quyền/scope; 404 khi đối tượng không tồn tại; 409 khi trùng/không đúng version hoặc transition; 422 khi dữ liệu nghiệp vụ không hợp lệ. Không mất dữ liệu người dùng đã nhập và phải có thông báo khắc phục được.|

|Hậu điều kiện|Dữ liệu và trạng thái liên quan nhất quán; sự kiện/outbox phát đúng một lần; audit có actor, thời gian, before/after và correlation ID.|

|Tiêu chí nghiệm thu|AC1. Trainer/Admin thực hiện được nghiệp vụ trong phạm vi được cấp và kết quả đúng mô tả.<br>AC2. Người không có quyền bị chặn nhất quán ở UI và API; không rò rỉ dữ liệu qua response/export.<br>AC3. Validation, trạng thái loading/empty/error/success và xử lý thao tác lặp được kiểm thử.<br>AC4. Giao dịch thành công được lưu bền vững, phản ánh trên màn hình liên quan và có audit/correlation ID.|

|Màn hình / Nguồn|SCR-54..65; UI-STD-05, UI-MNT-04 \| Hub ASM-02; FAMS FR-216|



UFR-EXM-003 - Ngân hàng câu hỏi


|CONTRACT UFR-EXM-003|CONTRACT UFR-EXM-003|

|---|---|

|Phân hệ / Ưu tiên|Quản lý thi, assessment và chấm bài / Should|

|Actor / Quyền|Trainer. Bắt buộc permission tương ứng và data scope hợp lệ.|

|Yêu cầu|CRUD/import/export/tag câu hỏi, option, đáp án; hỗ trợ tạo gợi ý quiz bằng AI có review.|

|Tiền điều kiện|Người dùng đã xác thực; tenant đang hoạt động; có permission và data scope phù hợp. Cấu hình thời gian, người tham gia và nội dung đã được publish/phân công.|

|Luồng chính|1) Người dùng mở chức năng Ngân hàng câu hỏi; hệ thống tải dữ liệu theo scope.<br>2) Người dùng nhập/chọn điều kiện cần thiết; hệ thống kiểm tra validation và quyền.<br>3) Hệ thống thực hiện: CRUD/import/export/tag câu hỏi, option, đáp án; hỗ trợ tạo gợi ý quiz bằng AI có review.<br>4) Hệ thống lưu giao dịch, hiển thị kết quả, cập nhật dữ liệu liên quan và ghi audit/event.|

|Validation / Quy tắc|Attempt tuân thủ time window, attempt limit và autosave; bài coding chạy trong sandbox; kết quả chỉ hiện theo release policy.|

|Ngoại lệ|401 khi phiên không hợp lệ; 403 khi thiếu quyền/scope; 404 khi đối tượng không tồn tại; 409 khi trùng/không đúng version hoặc transition; 422 khi dữ liệu nghiệp vụ không hợp lệ. Không mất dữ liệu người dùng đã nhập và phải có thông báo khắc phục được.|

|Hậu điều kiện|Dữ liệu và trạng thái liên quan nhất quán; sự kiện/outbox phát đúng một lần; audit có actor, thời gian, before/after và correlation ID.|

|Tiêu chí nghiệm thu|AC1. Trainer thực hiện được nghiệp vụ trong phạm vi được cấp và kết quả đúng mô tả.<br>AC2. Người không có quyền bị chặn nhất quán ở UI và API; không rò rỉ dữ liệu qua response/export.<br>AC3. Validation, trạng thái loading/empty/error/success và xử lý thao tác lặp được kiểm thử.<br>AC4. Giao dịch thành công được lưu bền vững, phản ánh trên màn hình liên quan và có audit/correlation ID.|

|Màn hình / Nguồn|SCR-54..65; UI-STD-05, UI-MNT-04 \| FAMS FR-217|



UFR-EXM-004 - Bài lập trình


|CONTRACT UFR-EXM-004|CONTRACT UFR-EXM-004|

|---|---|

|Phân hệ / Ưu tiên|Quản lý thi, assessment và chấm bài / Must|

|Actor / Quyền|Trainer. Bắt buộc permission tương ứng và data scope hợp lệ.|

|Yêu cầu|CRUD/import/export bài code, ngôn ngữ, sample/hidden test case, timeout và sandbox policy.|

|Tiền điều kiện|Người dùng đã xác thực; tenant đang hoạt động; có permission và data scope phù hợp. Cấu hình thời gian, người tham gia và nội dung đã được publish/phân công.|

|Luồng chính|1) Người dùng mở chức năng Bài lập trình; hệ thống tải dữ liệu theo scope.<br>2) Người dùng nhập/chọn điều kiện cần thiết; hệ thống kiểm tra validation và quyền.<br>3) Hệ thống thực hiện: CRUD/import/export bài code, ngôn ngữ, sample/hidden test case, timeout và sandbox policy.<br>4) Hệ thống lưu giao dịch, hiển thị kết quả, cập nhật dữ liệu liên quan và ghi audit/event.|

|Validation / Quy tắc|Attempt tuân thủ time window, attempt limit và autosave; bài coding chạy trong sandbox; kết quả chỉ hiện theo release policy.|

|Ngoại lệ|401 khi phiên không hợp lệ; 403 khi thiếu quyền/scope; 404 khi đối tượng không tồn tại; 409 khi trùng/không đúng version hoặc transition; 422 khi dữ liệu nghiệp vụ không hợp lệ. Không mất dữ liệu người dùng đã nhập và phải có thông báo khắc phục được.|

|Hậu điều kiện|Dữ liệu và trạng thái liên quan nhất quán; sự kiện/outbox phát đúng một lần; audit có actor, thời gian, before/after và correlation ID.|

|Tiêu chí nghiệm thu|AC1. Trainer thực hiện được nghiệp vụ trong phạm vi được cấp và kết quả đúng mô tả.<br>AC2. Người không có quyền bị chặn nhất quán ở UI và API; không rò rỉ dữ liệu qua response/export.<br>AC3. Validation, trạng thái loading/empty/error/success và xử lý thao tác lặp được kiểm thử.<br>AC4. Giao dịch thành công được lưu bền vững, phản ánh trên màn hình liên quan và có audit/correlation ID.|

|Màn hình / Nguồn|SCR-54..65; UI-STD-05, UI-MNT-04 \| FAMS FR-218|



UFR-EXM-005 - Mời dự thi


|CONTRACT UFR-EXM-005|CONTRACT UFR-EXM-005|

|---|---|

|Phân hệ / Ưu tiên|Quản lý thi, assessment và chấm bài / Should|

|Actor / Quyền|Class/Training Admin. Bắt buộc permission tương ứng và data scope hợp lệ.|

|Yêu cầu|Invite/bulk invite/resend/revoke theo course/class và email; kiểm tra eligibility.|

|Tiền điều kiện|Người dùng đã xác thực; tenant đang hoạt động; có permission và data scope phù hợp. Cấu hình thời gian, người tham gia và nội dung đã được publish/phân công.|

|Luồng chính|1) Người dùng mở chức năng Mời dự thi; hệ thống tải dữ liệu theo scope.<br>2) Người dùng nhập/chọn điều kiện cần thiết; hệ thống kiểm tra validation và quyền.<br>3) Hệ thống thực hiện: Invite/bulk invite/resend/revoke theo course/class và email; kiểm tra eligibility.<br>4) Hệ thống lưu giao dịch, hiển thị kết quả, cập nhật dữ liệu liên quan và ghi audit/event.|

|Validation / Quy tắc|Attempt tuân thủ time window, attempt limit và autosave; bài coding chạy trong sandbox; kết quả chỉ hiện theo release policy.|

|Ngoại lệ|401 khi phiên không hợp lệ; 403 khi thiếu quyền/scope; 404 khi đối tượng không tồn tại; 409 khi trùng/không đúng version hoặc transition; 422 khi dữ liệu nghiệp vụ không hợp lệ. Không mất dữ liệu người dùng đã nhập và phải có thông báo khắc phục được.|

|Hậu điều kiện|Dữ liệu và trạng thái liên quan nhất quán; sự kiện/outbox phát đúng một lần; audit có actor, thời gian, before/after và correlation ID.|

|Tiêu chí nghiệm thu|AC1. Class/Training Admin thực hiện được nghiệp vụ trong phạm vi được cấp và kết quả đúng mô tả.<br>AC2. Người không có quyền bị chặn nhất quán ở UI và API; không rò rỉ dữ liệu qua response/export.<br>AC3. Validation, trạng thái loading/empty/error/success và xử lý thao tác lặp được kiểm thử.<br>AC4. Giao dịch thành công được lưu bền vững, phản ánh trên màn hình liên quan và có audit/correlation ID.|

|Màn hình / Nguồn|SCR-54..65; UI-STD-05, UI-MNT-04 \| FAMS FR-219|



UFR-EXM-006 - Danh sách bài thi của tôi


|CONTRACT UFR-EXM-006|CONTRACT UFR-EXM-006|

|---|---|

|Phân hệ / Ưu tiên|Quản lý thi, assessment và chấm bài / Must|

|Actor / Quyền|Trainee/Sinh viên. Bắt buộc permission tương ứng và data scope hợp lệ.|

|Yêu cầu|Hiển thị bài sắp mở, đang mở, đã nộp/hết hạn và số lượt còn lại.|

|Tiền điều kiện|Người dùng đã xác thực; tenant đang hoạt động; có permission và data scope phù hợp. Cấu hình thời gian, người tham gia và nội dung đã được publish/phân công.|

|Luồng chính|1) Người dùng mở chức năng Danh sách bài thi của tôi; hệ thống tải dữ liệu theo scope.<br>2) Người dùng nhập/chọn điều kiện cần thiết; hệ thống kiểm tra validation và quyền.<br>3) Hệ thống thực hiện: Hiển thị bài sắp mở, đang mở, đã nộp/hết hạn và số lượt còn lại.<br>4) Hệ thống lưu giao dịch, hiển thị kết quả, cập nhật dữ liệu liên quan và ghi audit/event.|

|Validation / Quy tắc|Attempt tuân thủ time window, attempt limit và autosave; bài coding chạy trong sandbox; kết quả chỉ hiện theo release policy.|

|Ngoại lệ|401 khi phiên không hợp lệ; 403 khi thiếu quyền/scope; 404 khi đối tượng không tồn tại; 409 khi trùng/không đúng version hoặc transition; 422 khi dữ liệu nghiệp vụ không hợp lệ. Không mất dữ liệu người dùng đã nhập và phải có thông báo khắc phục được.|

|Hậu điều kiện|Dữ liệu và trạng thái liên quan nhất quán; sự kiện/outbox phát đúng một lần; audit có actor, thời gian, before/after và correlation ID.|

|Tiêu chí nghiệm thu|AC1. Trainee/Sinh viên thực hiện được nghiệp vụ trong phạm vi được cấp và kết quả đúng mô tả.<br>AC2. Người không có quyền bị chặn nhất quán ở UI và API; không rò rỉ dữ liệu qua response/export.<br>AC3. Validation, trạng thái loading/empty/error/success và xử lý thao tác lặp được kiểm thử.<br>AC4. Giao dịch thành công được lưu bền vững, phản ánh trên màn hình liên quan và có audit/correlation ID.|

|Màn hình / Nguồn|SCR-54..65; UI-STD-05, UI-MNT-04 \| FAMS SCR-62|



UFR-EXM-007 - Làm bài an toàn


|CONTRACT UFR-EXM-007|CONTRACT UFR-EXM-007|

|---|---|

|Phân hệ / Ưu tiên|Quản lý thi, assessment và chấm bài / Must|

|Actor / Quyền|Trainee/Sinh viên. Bắt buộc permission tương ứng và data scope hợp lệ.|

|Yêu cầu|Timer, autosave, resume, điều hướng câu hỏi, tab/fullscreen guard và auto-submit khi hết giờ.|

|Tiền điều kiện|Người dùng đã xác thực; tenant đang hoạt động; có permission và data scope phù hợp. Cấu hình thời gian, người tham gia và nội dung đã được publish/phân công.|

|Luồng chính|1) Người dùng mở chức năng Làm bài an toàn; hệ thống tải dữ liệu theo scope.<br>2) Người dùng nhập/chọn điều kiện cần thiết; hệ thống kiểm tra validation và quyền.<br>3) Hệ thống thực hiện: Timer, autosave, resume, điều hướng câu hỏi, tab/fullscreen guard và auto-submit khi hết giờ.<br>4) Hệ thống lưu giao dịch, hiển thị kết quả, cập nhật dữ liệu liên quan và ghi audit/event.|

|Validation / Quy tắc|Attempt tuân thủ time window, attempt limit và autosave; bài coding chạy trong sandbox; kết quả chỉ hiện theo release policy.|

|Ngoại lệ|401 khi phiên không hợp lệ; 403 khi thiếu quyền/scope; 404 khi đối tượng không tồn tại; 409 khi trùng/không đúng version hoặc transition; 422 khi dữ liệu nghiệp vụ không hợp lệ. Không mất dữ liệu người dùng đã nhập và phải có thông báo khắc phục được.|

|Hậu điều kiện|Dữ liệu và trạng thái liên quan nhất quán; sự kiện/outbox phát đúng một lần; audit có actor, thời gian, before/after và correlation ID.|

|Tiêu chí nghiệm thu|AC1. Trainee/Sinh viên thực hiện được nghiệp vụ trong phạm vi được cấp và kết quả đúng mô tả.<br>AC2. Người không có quyền bị chặn nhất quán ở UI và API; không rò rỉ dữ liệu qua response/export.<br>AC3. Validation, trạng thái loading/empty/error/success và xử lý thao tác lặp được kiểm thử.<br>AC4. Giao dịch thành công được lưu bền vững, phản ánh trên màn hình liên quan và có audit/correlation ID.|

|Màn hình / Nguồn|SCR-54..65; UI-STD-05, UI-MNT-04 \| Hub ASM-03; FAMS FR-220|



UFR-EXM-008 - Làm bài lập trình


|CONTRACT UFR-EXM-008|CONTRACT UFR-EXM-008|

|---|---|

|Phân hệ / Ưu tiên|Quản lý thi, assessment và chấm bài / Must|

|Actor / Quyền|Trainee/Sinh viên. Bắt buộc permission tương ứng và data scope hợp lệ.|

|Yêu cầu|Editor, chạy sample, submit, trạng thái test và giới hạn tài nguyên/network/filesystem.|

|Tiền điều kiện|Người dùng đã xác thực; tenant đang hoạt động; có permission và data scope phù hợp. Cấu hình thời gian, người tham gia và nội dung đã được publish/phân công.|

|Luồng chính|1) Người dùng mở chức năng Làm bài lập trình; hệ thống tải dữ liệu theo scope.<br>2) Người dùng nhập/chọn điều kiện cần thiết; hệ thống kiểm tra validation và quyền.<br>3) Hệ thống thực hiện: Editor, chạy sample, submit, trạng thái test và giới hạn tài nguyên/network/filesystem.<br>4) Hệ thống lưu giao dịch, hiển thị kết quả, cập nhật dữ liệu liên quan và ghi audit/event.|

|Validation / Quy tắc|Attempt tuân thủ time window, attempt limit và autosave; bài coding chạy trong sandbox; kết quả chỉ hiện theo release policy.|

|Ngoại lệ|401 khi phiên không hợp lệ; 403 khi thiếu quyền/scope; 404 khi đối tượng không tồn tại; 409 khi trùng/không đúng version hoặc transition; 422 khi dữ liệu nghiệp vụ không hợp lệ. Không mất dữ liệu người dùng đã nhập và phải có thông báo khắc phục được.|

|Hậu điều kiện|Dữ liệu và trạng thái liên quan nhất quán; sự kiện/outbox phát đúng một lần; audit có actor, thời gian, before/after và correlation ID.|

|Tiêu chí nghiệm thu|AC1. Trainee/Sinh viên thực hiện được nghiệp vụ trong phạm vi được cấp và kết quả đúng mô tả.<br>AC2. Người không có quyền bị chặn nhất quán ở UI và API; không rò rỉ dữ liệu qua response/export.<br>AC3. Validation, trạng thái loading/empty/error/success và xử lý thao tác lặp được kiểm thử.<br>AC4. Giao dịch thành công được lưu bền vững, phản ánh trên màn hình liên quan và có audit/correlation ID.|

|Màn hình / Nguồn|SCR-54..65; UI-STD-05, UI-MNT-04 \| FAMS FR-220|



UFR-EXM-009 - Gắn cờ bất thường


|CONTRACT UFR-EXM-009|CONTRACT UFR-EXM-009|

|---|---|

|Phân hệ / Ưu tiên|Quản lý thi, assessment và chấm bài / Must|

|Actor / Quyền|Hệ thống/Reviewer. Bắt buộc permission tương ứng và data scope hợp lệ.|

|Yêu cầu|Ghi tín hiệu đổi tab, thời lượng cực đoan hoặc nội dung trùng để người có thẩm quyền review; không tự kết luận gian lận.|

|Tiền điều kiện|Người dùng đã xác thực; tenant đang hoạt động; có permission và data scope phù hợp. Cấu hình thời gian, người tham gia và nội dung đã được publish/phân công.|

|Luồng chính|1) Người dùng mở chức năng Gắn cờ bất thường; hệ thống tải dữ liệu theo scope.<br>2) Người dùng nhập/chọn điều kiện cần thiết; hệ thống kiểm tra validation và quyền.<br>3) Hệ thống thực hiện: Ghi tín hiệu đổi tab, thời lượng cực đoan hoặc nội dung trùng để người có thẩm quyền review; không tự kết luận gian lận.<br>4) Hệ thống lưu giao dịch, hiển thị kết quả, cập nhật dữ liệu liên quan và ghi audit/event.|

|Validation / Quy tắc|Attempt tuân thủ time window, attempt limit và autosave; bài coding chạy trong sandbox; kết quả chỉ hiện theo release policy.|

|Ngoại lệ|401 khi phiên không hợp lệ; 403 khi thiếu quyền/scope; 404 khi đối tượng không tồn tại; 409 khi trùng/không đúng version hoặc transition; 422 khi dữ liệu nghiệp vụ không hợp lệ. Không mất dữ liệu người dùng đã nhập và phải có thông báo khắc phục được.|

|Hậu điều kiện|Dữ liệu và trạng thái liên quan nhất quán; sự kiện/outbox phát đúng một lần; audit có actor, thời gian, before/after và correlation ID.|

|Tiêu chí nghiệm thu|AC1. Hệ thống/Reviewer thực hiện được nghiệp vụ trong phạm vi được cấp và kết quả đúng mô tả.<br>AC2. Người không có quyền bị chặn nhất quán ở UI và API; không rò rỉ dữ liệu qua response/export.<br>AC3. Validation, trạng thái loading/empty/error/success và xử lý thao tác lặp được kiểm thử.<br>AC4. Giao dịch thành công được lưu bền vững, phản ánh trên màn hình liên quan và có audit/correlation ID.|

|Màn hình / Nguồn|SCR-54..65; UI-STD-05, UI-MNT-04 \| Hub ASM-07|



UFR-EXM-010 - Chấm tự động


|CONTRACT UFR-EXM-010|CONTRACT UFR-EXM-010|

|---|---|

|Phân hệ / Ưu tiên|Quản lý thi, assessment và chấm bài / Must|

|Actor / Quyền|Hệ thống. Bắt buộc permission tương ứng và data scope hợp lệ.|

|Yêu cầu|Auto-grade câu hỏi objective và code theo test case; lưu phiên bản đáp án/test dùng chấm.|

|Tiền điều kiện|Người dùng đã xác thực; tenant đang hoạt động; có permission và data scope phù hợp. Cấu hình thời gian, người tham gia và nội dung đã được publish/phân công.|

|Luồng chính|1) Người dùng mở chức năng Chấm tự động; hệ thống tải dữ liệu theo scope.<br>2) Người dùng nhập/chọn điều kiện cần thiết; hệ thống kiểm tra validation và quyền.<br>3) Hệ thống thực hiện: Auto-grade câu hỏi objective và code theo test case; lưu phiên bản đáp án/test dùng chấm.<br>4) Hệ thống lưu giao dịch, hiển thị kết quả, cập nhật dữ liệu liên quan và ghi audit/event.|

|Validation / Quy tắc|Attempt tuân thủ time window, attempt limit và autosave; bài coding chạy trong sandbox; kết quả chỉ hiện theo release policy.|

|Ngoại lệ|401 khi phiên không hợp lệ; 403 khi thiếu quyền/scope; 404 khi đối tượng không tồn tại; 409 khi trùng/không đúng version hoặc transition; 422 khi dữ liệu nghiệp vụ không hợp lệ. Không mất dữ liệu người dùng đã nhập và phải có thông báo khắc phục được.|

|Hậu điều kiện|Dữ liệu và trạng thái liên quan nhất quán; sự kiện/outbox phát đúng một lần; audit có actor, thời gian, before/after và correlation ID.|

|Tiêu chí nghiệm thu|AC1. Hệ thống thực hiện được nghiệp vụ trong phạm vi được cấp và kết quả đúng mô tả.<br>AC2. Người không có quyền bị chặn nhất quán ở UI và API; không rò rỉ dữ liệu qua response/export.<br>AC3. Validation, trạng thái loading/empty/error/success và xử lý thao tác lặp được kiểm thử.<br>AC4. Giao dịch thành công được lưu bền vững, phản ánh trên màn hình liên quan và có audit/correlation ID.|

|Màn hình / Nguồn|SCR-54..65; UI-STD-05, UI-MNT-04 \| Hub ASM-04; FAMS FR-221|



UFR-EXM-011 - Chấm thủ công


|CONTRACT UFR-EXM-011|CONTRACT UFR-EXM-011|

|---|---|

|Phân hệ / Ưu tiên|Quản lý thi, assessment và chấm bài / Must|

|Actor / Quyền|Trainer/Mentor. Bắt buộc permission tương ứng và data scope hợp lệ.|

|Yêu cầu|Hàng đợi chấm, rubric, nhận xét theo tiêu chí, override có lý do, trả sửa và audit.|

|Tiền điều kiện|Người dùng đã xác thực; tenant đang hoạt động; có permission và data scope phù hợp. Cấu hình thời gian, người tham gia và nội dung đã được publish/phân công.|

|Luồng chính|1) Người dùng mở chức năng Chấm thủ công; hệ thống tải dữ liệu theo scope.<br>2) Người dùng nhập/chọn điều kiện cần thiết; hệ thống kiểm tra validation và quyền.<br>3) Hệ thống thực hiện: Hàng đợi chấm, rubric, nhận xét theo tiêu chí, override có lý do, trả sửa và audit.<br>4) Hệ thống lưu giao dịch, hiển thị kết quả, cập nhật dữ liệu liên quan và ghi audit/event.|

|Validation / Quy tắc|Attempt tuân thủ time window, attempt limit và autosave; bài coding chạy trong sandbox; kết quả chỉ hiện theo release policy.|

|Ngoại lệ|401 khi phiên không hợp lệ; 403 khi thiếu quyền/scope; 404 khi đối tượng không tồn tại; 409 khi trùng/không đúng version hoặc transition; 422 khi dữ liệu nghiệp vụ không hợp lệ. Không mất dữ liệu người dùng đã nhập và phải có thông báo khắc phục được.|

|Hậu điều kiện|Dữ liệu và trạng thái liên quan nhất quán; sự kiện/outbox phát đúng một lần; audit có actor, thời gian, before/after và correlation ID.|

|Tiêu chí nghiệm thu|AC1. Trainer/Mentor thực hiện được nghiệp vụ trong phạm vi được cấp và kết quả đúng mô tả.<br>AC2. Người không có quyền bị chặn nhất quán ở UI và API; không rò rỉ dữ liệu qua response/export.<br>AC3. Validation, trạng thái loading/empty/error/success và xử lý thao tác lặp được kiểm thử.<br>AC4. Giao dịch thành công được lưu bền vững, phản ánh trên màn hình liên quan và có audit/correlation ID.|

|Màn hình / Nguồn|SCR-54..65; UI-STD-05, UI-MNT-04 \| Hub ASM-05; FAMS FR-221|



UFR-EXM-012 - Tự đánh giá/đánh giá chéo


|CONTRACT UFR-EXM-012|CONTRACT UFR-EXM-012|

|---|---|

|Phân hệ / Ưu tiên|Quản lý thi, assessment và chấm bài / Must|

|Actor / Quyền|Sinh viên. Bắt buộc permission tương ứng và data scope hợp lệ.|

|Yêu cầu|Self/peer review theo rubric, tùy chọn ẩn danh và chỉ hợp lệ khi reviewer đủ điều kiện.|

|Tiền điều kiện|Người dùng đã xác thực; tenant đang hoạt động; có permission và data scope phù hợp. Cấu hình thời gian, người tham gia và nội dung đã được publish/phân công.|

|Luồng chính|1) Người dùng mở chức năng Tự đánh giá/đánh giá chéo; hệ thống tải dữ liệu theo scope.<br>2) Người dùng nhập/chọn điều kiện cần thiết; hệ thống kiểm tra validation và quyền.<br>3) Hệ thống thực hiện: Self/peer review theo rubric, tùy chọn ẩn danh và chỉ hợp lệ khi reviewer đủ điều kiện.<br>4) Hệ thống lưu giao dịch, hiển thị kết quả, cập nhật dữ liệu liên quan và ghi audit/event.|

|Validation / Quy tắc|Attempt tuân thủ time window, attempt limit và autosave; bài coding chạy trong sandbox; kết quả chỉ hiện theo release policy.|

|Ngoại lệ|401 khi phiên không hợp lệ; 403 khi thiếu quyền/scope; 404 khi đối tượng không tồn tại; 409 khi trùng/không đúng version hoặc transition; 422 khi dữ liệu nghiệp vụ không hợp lệ. Không mất dữ liệu người dùng đã nhập và phải có thông báo khắc phục được.|

|Hậu điều kiện|Dữ liệu và trạng thái liên quan nhất quán; sự kiện/outbox phát đúng một lần; audit có actor, thời gian, before/after và correlation ID.|

|Tiêu chí nghiệm thu|AC1. Sinh viên thực hiện được nghiệp vụ trong phạm vi được cấp và kết quả đúng mô tả.<br>AC2. Người không có quyền bị chặn nhất quán ở UI và API; không rò rỉ dữ liệu qua response/export.<br>AC3. Validation, trạng thái loading/empty/error/success và xử lý thao tác lặp được kiểm thử.<br>AC4. Giao dịch thành công được lưu bền vững, phản ánh trên màn hình liên quan và có audit/correlation ID.|

|Màn hình / Nguồn|SCR-54..65; UI-STD-05, UI-MNT-04 \| Hub ASM-06|



UFR-EXM-013 - Kết quả và thống kê assessment


|CONTRACT UFR-EXM-013|CONTRACT UFR-EXM-013|

|---|---|

|Phân hệ / Ưu tiên|Quản lý thi, assessment và chấm bài / Must|

|Actor / Quyền|Trainer/Admin/Trainee. Bắt buộc permission tương ứng và data scope hợp lệ.|

|Yêu cầu|Kết quả cá nhân, phân bố điểm, item analysis, completion, attempt history và export.|

|Tiền điều kiện|Người dùng đã xác thực; tenant đang hoạt động; có permission và data scope phù hợp. Cấu hình thời gian, người tham gia và nội dung đã được publish/phân công.|

|Luồng chính|1) Người dùng mở chức năng Kết quả và thống kê assessment; hệ thống tải dữ liệu theo scope.<br>2) Người dùng nhập/chọn điều kiện cần thiết; hệ thống kiểm tra validation và quyền.<br>3) Hệ thống thực hiện: Kết quả cá nhân, phân bố điểm, item analysis, completion, attempt history và export.<br>4) Hệ thống lưu giao dịch, hiển thị kết quả, cập nhật dữ liệu liên quan và ghi audit/event.|

|Validation / Quy tắc|Attempt tuân thủ time window, attempt limit và autosave; bài coding chạy trong sandbox; kết quả chỉ hiện theo release policy.|

|Ngoại lệ|401 khi phiên không hợp lệ; 403 khi thiếu quyền/scope; 404 khi đối tượng không tồn tại; 409 khi trùng/không đúng version hoặc transition; 422 khi dữ liệu nghiệp vụ không hợp lệ. Không mất dữ liệu người dùng đã nhập và phải có thông báo khắc phục được.|

|Hậu điều kiện|Dữ liệu và trạng thái liên quan nhất quán; sự kiện/outbox phát đúng một lần; audit có actor, thời gian, before/after và correlation ID.|

|Tiêu chí nghiệm thu|AC1. Trainer/Admin/Trainee thực hiện được nghiệp vụ trong phạm vi được cấp và kết quả đúng mô tả.<br>AC2. Người không có quyền bị chặn nhất quán ở UI và API; không rò rỉ dữ liệu qua response/export.<br>AC3. Validation, trạng thái loading/empty/error/success và xử lý thao tác lặp được kiểm thử.<br>AC4. Giao dịch thành công được lưu bền vững, phản ánh trên màn hình liên quan và có audit/correlation ID.|

|Màn hình / Nguồn|SCR-54..65; UI-STD-05, UI-MNT-04 \| FAMS SCR-61,65|




## 5.8 Quản lý phỏng vấn mô phỏng

UFR-INT-001 - Loại và bộ câu hỏi


|CONTRACT UFR-INT-001|CONTRACT UFR-INT-001|

|---|---|

|Phân hệ / Ưu tiên|Quản lý phỏng vấn mô phỏng / Must|

|Actor / Quyền|Mentor/Admin. Bắt buộc permission tương ứng và data scope hợp lệ.|

|Yêu cầu|Tạo loại phỏng vấn, competency, bộ câu hỏi và scorecard.|

|Tiền điều kiện|Người dùng đã xác thực; tenant đang hoạt động; có permission và data scope phù hợp. Cấu hình thời gian, người tham gia và nội dung đã được publish/phân công.|

|Luồng chính|1) Người dùng mở chức năng Loại và bộ câu hỏi; hệ thống tải dữ liệu theo scope.<br>2) Người dùng nhập/chọn điều kiện cần thiết; hệ thống kiểm tra validation và quyền.<br>3) Hệ thống thực hiện: Tạo loại phỏng vấn, competency, bộ câu hỏi và scorecard.<br>4) Hệ thống lưu giao dịch, hiển thị kết quả, cập nhật dữ liệu liên quan và ghi audit/event.|

|Validation / Quy tắc|Interviewer chỉ truy cập phiên được phân công; scorecard khóa sau submit; feedback riêng không lộ cho học viên.|

|Ngoại lệ|401 khi phiên không hợp lệ; 403 khi thiếu quyền/scope; 404 khi đối tượng không tồn tại; 409 khi trùng/không đúng version hoặc transition; 422 khi dữ liệu nghiệp vụ không hợp lệ. Không mất dữ liệu người dùng đã nhập và phải có thông báo khắc phục được.|

|Hậu điều kiện|Dữ liệu và trạng thái liên quan nhất quán; sự kiện/outbox phát đúng một lần; audit có actor, thời gian, before/after và correlation ID.|

|Tiêu chí nghiệm thu|AC1. Mentor/Admin thực hiện được nghiệp vụ trong phạm vi được cấp và kết quả đúng mô tả.<br>AC2. Người không có quyền bị chặn nhất quán ở UI và API; không rò rỉ dữ liệu qua response/export.<br>AC3. Validation, trạng thái loading/empty/error/success và xử lý thao tác lặp được kiểm thử.<br>AC4. Giao dịch thành công được lưu bền vững, phản ánh trên màn hình liên quan và có audit/correlation ID.|

|Màn hình / Nguồn|UI-STD-11, UI-STD-12 \| Hub INT-01|



UFR-INT-002 - Lập lịch phỏng vấn


|CONTRACT UFR-INT-002|CONTRACT UFR-INT-002|

|---|---|

|Phân hệ / Ưu tiên|Quản lý phỏng vấn mô phỏng / Must|

|Actor / Quyền|Mentor/Admin. Bắt buộc permission tương ứng và data scope hợp lệ.|

|Yêu cầu|Ghép sinh viên-interviewer, hỗ trợ múi giờ, nhắc lịch và URL phòng họp ngoài.|

|Tiền điều kiện|Người dùng đã xác thực; tenant đang hoạt động; có permission và data scope phù hợp. Cấu hình thời gian, người tham gia và nội dung đã được publish/phân công.|

|Luồng chính|1) Người dùng mở chức năng Lập lịch phỏng vấn; hệ thống tải dữ liệu theo scope.<br>2) Người dùng nhập/chọn điều kiện cần thiết; hệ thống kiểm tra validation và quyền.<br>3) Hệ thống thực hiện: Ghép sinh viên-interviewer, hỗ trợ múi giờ, nhắc lịch và URL phòng họp ngoài.<br>4) Hệ thống lưu giao dịch, hiển thị kết quả, cập nhật dữ liệu liên quan và ghi audit/event.|

|Validation / Quy tắc|Interviewer chỉ truy cập phiên được phân công; scorecard khóa sau submit; feedback riêng không lộ cho học viên.|

|Ngoại lệ|401 khi phiên không hợp lệ; 403 khi thiếu quyền/scope; 404 khi đối tượng không tồn tại; 409 khi trùng/không đúng version hoặc transition; 422 khi dữ liệu nghiệp vụ không hợp lệ. Không mất dữ liệu người dùng đã nhập và phải có thông báo khắc phục được.|

|Hậu điều kiện|Dữ liệu và trạng thái liên quan nhất quán; sự kiện/outbox phát đúng một lần; audit có actor, thời gian, before/after và correlation ID.|

|Tiêu chí nghiệm thu|AC1. Mentor/Admin thực hiện được nghiệp vụ trong phạm vi được cấp và kết quả đúng mô tả.<br>AC2. Người không có quyền bị chặn nhất quán ở UI và API; không rò rỉ dữ liệu qua response/export.<br>AC3. Validation, trạng thái loading/empty/error/success và xử lý thao tác lặp được kiểm thử.<br>AC4. Giao dịch thành công được lưu bền vững, phản ánh trên màn hình liên quan và có audit/correlation ID.|

|Màn hình / Nguồn|UI-STD-11, UI-STD-12 \| Hub INT-02,05|



UFR-INT-003 - Chấm phỏng vấn


|CONTRACT UFR-INT-003|CONTRACT UFR-INT-003|

|---|---|

|Phân hệ / Ưu tiên|Quản lý phỏng vấn mô phỏng / Must|

|Actor / Quyền|Interviewer. Bắt buộc permission tương ứng và data scope hợp lệ.|

|Yêu cầu|Interviewer ghi note riêng, điểm theo tiêu chí, nhận xét tổng hợp và khuyến nghị.|

|Tiền điều kiện|Người dùng đã xác thực; tenant đang hoạt động; có permission và data scope phù hợp. Cấu hình thời gian, người tham gia và nội dung đã được publish/phân công.|

|Luồng chính|1) Người dùng mở chức năng Chấm phỏng vấn; hệ thống tải dữ liệu theo scope.<br>2) Người dùng nhập/chọn điều kiện cần thiết; hệ thống kiểm tra validation và quyền.<br>3) Hệ thống thực hiện: Interviewer ghi note riêng, điểm theo tiêu chí, nhận xét tổng hợp và khuyến nghị.<br>4) Hệ thống lưu giao dịch, hiển thị kết quả, cập nhật dữ liệu liên quan và ghi audit/event.|

|Validation / Quy tắc|Interviewer chỉ truy cập phiên được phân công; scorecard khóa sau submit; feedback riêng không lộ cho học viên.|

|Ngoại lệ|401 khi phiên không hợp lệ; 403 khi thiếu quyền/scope; 404 khi đối tượng không tồn tại; 409 khi trùng/không đúng version hoặc transition; 422 khi dữ liệu nghiệp vụ không hợp lệ. Không mất dữ liệu người dùng đã nhập và phải có thông báo khắc phục được.|

|Hậu điều kiện|Dữ liệu và trạng thái liên quan nhất quán; sự kiện/outbox phát đúng một lần; audit có actor, thời gian, before/after và correlation ID.|

|Tiêu chí nghiệm thu|AC1. Interviewer thực hiện được nghiệp vụ trong phạm vi được cấp và kết quả đúng mô tả.<br>AC2. Người không có quyền bị chặn nhất quán ở UI và API; không rò rỉ dữ liệu qua response/export.<br>AC3. Validation, trạng thái loading/empty/error/success và xử lý thao tác lặp được kiểm thử.<br>AC4. Giao dịch thành công được lưu bền vững, phản ánh trên màn hình liên quan và có audit/correlation ID.|

|Màn hình / Nguồn|UI-STD-11, UI-STD-12 \| Hub INT-03|



UFR-INT-004 - Công bố feedback


|CONTRACT UFR-INT-004|CONTRACT UFR-INT-004|

|---|---|

|Phân hệ / Ưu tiên|Quản lý phỏng vấn mô phỏng / Must|

|Actor / Quyền|Interviewer/Mentor. Bắt buộc permission tương ứng và data scope hợp lệ.|

|Yêu cầu|Sinh viên chỉ xem nội dung được đánh dấu công bố; tuyệt đối không lộ note riêng.|

|Tiền điều kiện|Người dùng đã xác thực; tenant đang hoạt động; có permission và data scope phù hợp. Cấu hình thời gian, người tham gia và nội dung đã được publish/phân công.|

|Luồng chính|1) Người dùng mở chức năng Công bố feedback; hệ thống tải dữ liệu theo scope.<br>2) Người dùng nhập/chọn điều kiện cần thiết; hệ thống kiểm tra validation và quyền.<br>3) Hệ thống thực hiện: Sinh viên chỉ xem nội dung được đánh dấu công bố; tuyệt đối không lộ note riêng.<br>4) Hệ thống lưu giao dịch, hiển thị kết quả, cập nhật dữ liệu liên quan và ghi audit/event.|

|Validation / Quy tắc|Interviewer chỉ truy cập phiên được phân công; scorecard khóa sau submit; feedback riêng không lộ cho học viên.|

|Ngoại lệ|401 khi phiên không hợp lệ; 403 khi thiếu quyền/scope; 404 khi đối tượng không tồn tại; 409 khi trùng/không đúng version hoặc transition; 422 khi dữ liệu nghiệp vụ không hợp lệ. Không mất dữ liệu người dùng đã nhập và phải có thông báo khắc phục được.|

|Hậu điều kiện|Dữ liệu và trạng thái liên quan nhất quán; sự kiện/outbox phát đúng một lần; audit có actor, thời gian, before/after và correlation ID.|

|Tiêu chí nghiệm thu|AC1. Interviewer/Mentor thực hiện được nghiệp vụ trong phạm vi được cấp và kết quả đúng mô tả.<br>AC2. Người không có quyền bị chặn nhất quán ở UI và API; không rò rỉ dữ liệu qua response/export.<br>AC3. Validation, trạng thái loading/empty/error/success và xử lý thao tác lặp được kiểm thử.<br>AC4. Giao dịch thành công được lưu bền vững, phản ánh trên màn hình liên quan và có audit/correlation ID.|

|Màn hình / Nguồn|UI-STD-11, UI-STD-12 \| Hub INT-04|




## 5.9 Quản lý điểm, kết quả và chứng nhận

UFR-SCO-001 - Rubric và scorecard


|CONTRACT UFR-SCO-001|CONTRACT UFR-SCO-001|

|---|---|

|Phân hệ / Ưu tiên|Quản lý điểm, kết quả và chứng nhận / Must|

|Actor / Quyền|Admin/Mentor. Bắt buộc permission tương ứng và data scope hợp lệ.|

|Yêu cầu|Tạo/version rubric; snapshot rubric khi bắt đầu assessment, checkpoint hoặc interview.|

|Tiền điều kiện|Người dùng đã xác thực; tenant đang hoạt động; có permission và data scope phù hợp. Hồ sơ học viên/lớp tồn tại và chưa bị xóa cứng.|

|Luồng chính|1) Người dùng mở chức năng Rubric và scorecard; hệ thống tải dữ liệu theo scope.<br>2) Người dùng nhập/chọn điều kiện cần thiết; hệ thống kiểm tra validation và quyền.<br>3) Hệ thống thực hiện: Tạo/version rubric; snapshot rubric khi bắt đầu assessment, checkpoint hoặc interview.<br>4) Hệ thống lưu giao dịch, hiển thị kết quả, cập nhật dữ liệu liên quan và ghi audit/event.|

|Validation / Quy tắc|Điểm dùng formula/rubric version; thay đổi điểm đã công bố phải qua adjustment có lý do, người duyệt và audit.|

|Ngoại lệ|401 khi phiên không hợp lệ; 403 khi thiếu quyền/scope; 404 khi đối tượng không tồn tại; 409 khi trùng/không đúng version hoặc transition; 422 khi dữ liệu nghiệp vụ không hợp lệ. Không mất dữ liệu người dùng đã nhập và phải có thông báo khắc phục được.|

|Hậu điều kiện|Dữ liệu và trạng thái liên quan nhất quán; sự kiện/outbox phát đúng một lần; audit có actor, thời gian, before/after và correlation ID.|

|Tiêu chí nghiệm thu|AC1. Admin/Mentor thực hiện được nghiệp vụ trong phạm vi được cấp và kết quả đúng mô tả.<br>AC2. Người không có quyền bị chặn nhất quán ở UI và API; không rò rỉ dữ liệu qua response/export.<br>AC3. Validation, trạng thái loading/empty/error/success và xử lý thao tác lặp được kiểm thử.<br>AC4. Giao dịch thành công được lưu bền vững, phản ánh trên màn hình liên quan và có audit/correlation ID.|

|Màn hình / Nguồn|SCR-13..17, SCR-60..61; UI-STD-06..07, UI-MNT-04..05 \| Hub LIB-05; BR-03|



UFR-SCO-002 - Import điểm


|CONTRACT UFR-SCO-002|CONTRACT UFR-SCO-002|

|---|---|

|Phân hệ / Ưu tiên|Quản lý điểm, kết quả và chứng nhận / Must|

|Actor / Quyền|Class Admin/Trainer. Bắt buộc permission tương ứng và data scope hợp lệ.|

|Yêu cầu|Import theo lớp, syllabus/version, module/topic; preview, validate, partial result và error report.|

|Tiền điều kiện|Người dùng đã xác thực; tenant đang hoạt động; có permission và data scope phù hợp. Hồ sơ học viên/lớp tồn tại và chưa bị xóa cứng.|

|Luồng chính|1) Người dùng mở chức năng Import điểm; hệ thống tải dữ liệu theo scope.<br>2) Người dùng nhập/chọn điều kiện cần thiết; hệ thống kiểm tra validation và quyền.<br>3) Hệ thống thực hiện: Import theo lớp, syllabus/version, module/topic; preview, validate, partial result và error report.<br>4) Hệ thống lưu giao dịch, hiển thị kết quả, cập nhật dữ liệu liên quan và ghi audit/event.|

|Validation / Quy tắc|Điểm dùng formula/rubric version; thay đổi điểm đã công bố phải qua adjustment có lý do, người duyệt và audit.|

|Ngoại lệ|401 khi phiên không hợp lệ; 403 khi thiếu quyền/scope; 404 khi đối tượng không tồn tại; 409 khi trùng/không đúng version hoặc transition; 422 khi dữ liệu nghiệp vụ không hợp lệ. Không mất dữ liệu người dùng đã nhập và phải có thông báo khắc phục được.|

|Hậu điều kiện|Dữ liệu và trạng thái liên quan nhất quán; sự kiện/outbox phát đúng một lần; audit có actor, thời gian, before/after và correlation ID.|

|Tiêu chí nghiệm thu|AC1. Class Admin/Trainer thực hiện được nghiệp vụ trong phạm vi được cấp và kết quả đúng mô tả.<br>AC2. Người không có quyền bị chặn nhất quán ở UI và API; không rò rỉ dữ liệu qua response/export.<br>AC3. Validation, trạng thái loading/empty/error/success và xử lý thao tác lặp được kiểm thử.<br>AC4. Giao dịch thành công được lưu bền vững, phản ánh trên màn hình liên quan và có audit/correlation ID.|

|Màn hình / Nguồn|SCR-13..17, SCR-60..61; UI-STD-06..07, UI-MNT-04..05 \| FAMS SCO-01, FR-215|



UFR-SCO-003 - Gradebook theo lớp


|CONTRACT UFR-SCO-003|CONTRACT UFR-SCO-003|

|---|---|

|Phân hệ / Ưu tiên|Quản lý điểm, kết quả và chứng nhận / Must|

|Actor / Quyền|Class Admin/Trainer. Bắt buộc permission tương ứng và data scope hợp lệ.|

|Yêu cầu|Bảng động theo syllabus gồm điểm module/topic, final, GPA, rank, result và certificate.|

|Tiền điều kiện|Người dùng đã xác thực; tenant đang hoạt động; có permission và data scope phù hợp. Hồ sơ học viên/lớp tồn tại và chưa bị xóa cứng.|

|Luồng chính|1) Người dùng mở chức năng Gradebook theo lớp; hệ thống tải dữ liệu theo scope.<br>2) Người dùng nhập/chọn điều kiện cần thiết; hệ thống kiểm tra validation và quyền.<br>3) Hệ thống thực hiện: Bảng động theo syllabus gồm điểm module/topic, final, GPA, rank, result và certificate.<br>4) Hệ thống lưu giao dịch, hiển thị kết quả, cập nhật dữ liệu liên quan và ghi audit/event.|

|Validation / Quy tắc|Điểm dùng formula/rubric version; thay đổi điểm đã công bố phải qua adjustment có lý do, người duyệt và audit.|

|Ngoại lệ|401 khi phiên không hợp lệ; 403 khi thiếu quyền/scope; 404 khi đối tượng không tồn tại; 409 khi trùng/không đúng version hoặc transition; 422 khi dữ liệu nghiệp vụ không hợp lệ. Không mất dữ liệu người dùng đã nhập và phải có thông báo khắc phục được.|

|Hậu điều kiện|Dữ liệu và trạng thái liên quan nhất quán; sự kiện/outbox phát đúng một lần; audit có actor, thời gian, before/after và correlation ID.|

|Tiêu chí nghiệm thu|AC1. Class Admin/Trainer thực hiện được nghiệp vụ trong phạm vi được cấp và kết quả đúng mô tả.<br>AC2. Người không có quyền bị chặn nhất quán ở UI và API; không rò rỉ dữ liệu qua response/export.<br>AC3. Validation, trạng thái loading/empty/error/success và xử lý thao tác lặp được kiểm thử.<br>AC4. Giao dịch thành công được lưu bền vững, phản ánh trên màn hình liên quan và có audit/correlation ID.|

|Màn hình / Nguồn|SCR-13..17, SCR-60..61; UI-STD-06..07, UI-MNT-04..05 \| FAMS SCO-02|



UFR-SCO-004 - Kết quả học tập cá nhân


|CONTRACT UFR-SCO-004|CONTRACT UFR-SCO-004|

|---|---|

|Phân hệ / Ưu tiên|Quản lý điểm, kết quả và chứng nhận / Must|

|Actor / Quyền|Trainer/Học viên. Bắt buộc permission tương ứng và data scope hợp lệ.|

|Yêu cầu|Xem study record, module score, assessment, project, interview, attendance và lịch sử.|

|Tiền điều kiện|Người dùng đã xác thực; tenant đang hoạt động; có permission và data scope phù hợp. Hồ sơ học viên/lớp tồn tại và chưa bị xóa cứng.|

|Luồng chính|1) Người dùng mở chức năng Kết quả học tập cá nhân; hệ thống tải dữ liệu theo scope.<br>2) Người dùng nhập/chọn điều kiện cần thiết; hệ thống kiểm tra validation và quyền.<br>3) Hệ thống thực hiện: Xem study record, module score, assessment, project, interview, attendance và lịch sử.<br>4) Hệ thống lưu giao dịch, hiển thị kết quả, cập nhật dữ liệu liên quan và ghi audit/event.|

|Validation / Quy tắc|Điểm dùng formula/rubric version; thay đổi điểm đã công bố phải qua adjustment có lý do, người duyệt và audit.|

|Ngoại lệ|401 khi phiên không hợp lệ; 403 khi thiếu quyền/scope; 404 khi đối tượng không tồn tại; 409 khi trùng/không đúng version hoặc transition; 422 khi dữ liệu nghiệp vụ không hợp lệ. Không mất dữ liệu người dùng đã nhập và phải có thông báo khắc phục được.|

|Hậu điều kiện|Dữ liệu và trạng thái liên quan nhất quán; sự kiện/outbox phát đúng một lần; audit có actor, thời gian, before/after và correlation ID.|

|Tiêu chí nghiệm thu|AC1. Trainer/Học viên thực hiện được nghiệp vụ trong phạm vi được cấp và kết quả đúng mô tả.<br>AC2. Người không có quyền bị chặn nhất quán ở UI và API; không rò rỉ dữ liệu qua response/export.<br>AC3. Validation, trạng thái loading/empty/error/success và xử lý thao tác lặp được kiểm thử.<br>AC4. Giao dịch thành công được lưu bền vững, phản ánh trên màn hình liên quan và có audit/correlation ID.|

|Màn hình / Nguồn|SCR-13..17, SCR-60..61; UI-STD-06..07, UI-MNT-04..05 \| FAMS SCO-03; Hub RPT-02|



UFR-SCO-005 - Cập nhật/điều chỉnh điểm


|CONTRACT UFR-SCO-005|CONTRACT UFR-SCO-005|

|---|---|

|Phân hệ / Ưu tiên|Quản lý điểm, kết quả và chứng nhận / Must|

|Actor / Quyền|Trainer/Admin. Bắt buộc permission tương ứng và data scope hợp lệ.|

|Yêu cầu|Sửa điểm hợp lệ theo quyền/trạng thái khóa; lưu old/new, actor, lý do và phê duyệt khi cần.|

|Tiền điều kiện|Người dùng đã xác thực; tenant đang hoạt động; có permission và data scope phù hợp. Hồ sơ học viên/lớp tồn tại và chưa bị xóa cứng.|

|Luồng chính|1) Người dùng mở chức năng Cập nhật/điều chỉnh điểm; hệ thống tải dữ liệu theo scope.<br>2) Người dùng nhập/chọn điều kiện cần thiết; hệ thống kiểm tra validation và quyền.<br>3) Hệ thống thực hiện: Sửa điểm hợp lệ theo quyền/trạng thái khóa; lưu old/new, actor, lý do và phê duyệt khi cần.<br>4) Hệ thống lưu giao dịch, hiển thị kết quả, cập nhật dữ liệu liên quan và ghi audit/event.|

|Validation / Quy tắc|Điểm dùng formula/rubric version; thay đổi điểm đã công bố phải qua adjustment có lý do, người duyệt và audit.|

|Ngoại lệ|401 khi phiên không hợp lệ; 403 khi thiếu quyền/scope; 404 khi đối tượng không tồn tại; 409 khi trùng/không đúng version hoặc transition; 422 khi dữ liệu nghiệp vụ không hợp lệ. Không mất dữ liệu người dùng đã nhập và phải có thông báo khắc phục được.|

|Hậu điều kiện|Dữ liệu và trạng thái liên quan nhất quán; sự kiện/outbox phát đúng một lần; audit có actor, thời gian, before/after và correlation ID.|

|Tiêu chí nghiệm thu|AC1. Trainer/Admin thực hiện được nghiệp vụ trong phạm vi được cấp và kết quả đúng mô tả.<br>AC2. Người không có quyền bị chặn nhất quán ở UI và API; không rò rỉ dữ liệu qua response/export.<br>AC3. Validation, trạng thái loading/empty/error/success và xử lý thao tác lặp được kiểm thử.<br>AC4. Giao dịch thành công được lưu bền vững, phản ánh trên màn hình liên quan và có audit/correlation ID.|

|Màn hình / Nguồn|SCR-13..17, SCR-60..61; UI-STD-06..07, UI-MNT-04..05 \| FAMS SCO-03; Hub BR-10|



UFR-SCO-006 - Điểm topic


|CONTRACT UFR-SCO-006|CONTRACT UFR-SCO-006|

|---|---|

|Phân hệ / Ưu tiên|Quản lý điểm, kết quả và chứng nhận / Must|

|Actor / Quyền|Trainer/Class Admin. Bắt buộc permission tương ứng và data scope hợp lệ.|

|Yêu cầu|Nhập/import/export điểm topic và tính GPA theo assessment scheme.|

|Tiền điều kiện|Người dùng đã xác thực; tenant đang hoạt động; có permission và data scope phù hợp. Hồ sơ học viên/lớp tồn tại và chưa bị xóa cứng.|

|Luồng chính|1) Người dùng mở chức năng Điểm topic; hệ thống tải dữ liệu theo scope.<br>2) Người dùng nhập/chọn điều kiện cần thiết; hệ thống kiểm tra validation và quyền.<br>3) Hệ thống thực hiện: Nhập/import/export điểm topic và tính GPA theo assessment scheme.<br>4) Hệ thống lưu giao dịch, hiển thị kết quả, cập nhật dữ liệu liên quan và ghi audit/event.|

|Validation / Quy tắc|Điểm dùng formula/rubric version; thay đổi điểm đã công bố phải qua adjustment có lý do, người duyệt và audit.|

|Ngoại lệ|401 khi phiên không hợp lệ; 403 khi thiếu quyền/scope; 404 khi đối tượng không tồn tại; 409 khi trùng/không đúng version hoặc transition; 422 khi dữ liệu nghiệp vụ không hợp lệ. Không mất dữ liệu người dùng đã nhập và phải có thông báo khắc phục được.|

|Hậu điều kiện|Dữ liệu và trạng thái liên quan nhất quán; sự kiện/outbox phát đúng một lần; audit có actor, thời gian, before/after và correlation ID.|

|Tiêu chí nghiệm thu|AC1. Trainer/Class Admin thực hiện được nghiệp vụ trong phạm vi được cấp và kết quả đúng mô tả.<br>AC2. Người không có quyền bị chặn nhất quán ở UI và API; không rò rỉ dữ liệu qua response/export.<br>AC3. Validation, trạng thái loading/empty/error/success và xử lý thao tác lặp được kiểm thử.<br>AC4. Giao dịch thành công được lưu bền vững, phản ánh trên màn hình liên quan và có audit/correlation ID.|

|Màn hình / Nguồn|SCR-13..17, SCR-60..61; UI-STD-06..07, UI-MNT-04..05 \| FAMS FR-215|



UFR-SCO-007 - Công thức điểm


|CONTRACT UFR-SCO-007|CONTRACT UFR-SCO-007|

|---|---|

|Phân hệ / Ưu tiên|Quản lý điểm, kết quả và chứng nhận / Must|

|Actor / Quyền|Program Manager. Bắt buộc permission tương ứng và data scope hợp lệ.|

|Yêu cầu|Version hóa công thức hợp nhất điểm nhóm, cá nhân, assessment, interview và peer review.|

|Tiền điều kiện|Người dùng đã xác thực; tenant đang hoạt động; có permission và data scope phù hợp. Hồ sơ học viên/lớp tồn tại và chưa bị xóa cứng.|

|Luồng chính|1) Người dùng mở chức năng Công thức điểm; hệ thống tải dữ liệu theo scope.<br>2) Người dùng nhập/chọn điều kiện cần thiết; hệ thống kiểm tra validation và quyền.<br>3) Hệ thống thực hiện: Version hóa công thức hợp nhất điểm nhóm, cá nhân, assessment, interview và peer review.<br>4) Hệ thống lưu giao dịch, hiển thị kết quả, cập nhật dữ liệu liên quan và ghi audit/event.|

|Validation / Quy tắc|Điểm dùng formula/rubric version; thay đổi điểm đã công bố phải qua adjustment có lý do, người duyệt và audit.|

|Ngoại lệ|401 khi phiên không hợp lệ; 403 khi thiếu quyền/scope; 404 khi đối tượng không tồn tại; 409 khi trùng/không đúng version hoặc transition; 422 khi dữ liệu nghiệp vụ không hợp lệ. Không mất dữ liệu người dùng đã nhập và phải có thông báo khắc phục được.|

|Hậu điều kiện|Dữ liệu và trạng thái liên quan nhất quán; sự kiện/outbox phát đúng một lần; audit có actor, thời gian, before/after và correlation ID.|

|Tiêu chí nghiệm thu|AC1. Program Manager thực hiện được nghiệp vụ trong phạm vi được cấp và kết quả đúng mô tả.<br>AC2. Người không có quyền bị chặn nhất quán ở UI và API; không rò rỉ dữ liệu qua response/export.<br>AC3. Validation, trạng thái loading/empty/error/success và xử lý thao tác lặp được kiểm thử.<br>AC4. Giao dịch thành công được lưu bền vững, phản ánh trên màn hình liên quan và có audit/correlation ID.|

|Màn hình / Nguồn|SCR-13..17, SCR-60..61; UI-STD-06..07, UI-MNT-04..05 \| Hub RPT-01|



UFR-SCO-008 - Công bố và khóa điểm


|CONTRACT UFR-SCO-008|CONTRACT UFR-SCO-008|

|---|---|

|Phân hệ / Ưu tiên|Quản lý điểm, kết quả và chứng nhận / Must|

|Actor / Quyền|Mentor/Admin. Bắt buộc permission tương ứng và data scope hợp lệ.|

|Yêu cầu|Chỉ kết quả RELEASED hiển thị cho học viên; khóa điểm sau chốt và dùng adjustment record cho thay đổi.|

|Tiền điều kiện|Người dùng đã xác thực; tenant đang hoạt động; có permission và data scope phù hợp. Hồ sơ học viên/lớp tồn tại và chưa bị xóa cứng.|

|Luồng chính|1) Người dùng mở chức năng Công bố và khóa điểm; hệ thống tải dữ liệu theo scope.<br>2) Người dùng nhập/chọn điều kiện cần thiết; hệ thống kiểm tra validation và quyền.<br>3) Hệ thống thực hiện: Chỉ kết quả RELEASED hiển thị cho học viên; khóa điểm sau chốt và dùng adjustment record cho thay đổi.<br>4) Hệ thống lưu giao dịch, hiển thị kết quả, cập nhật dữ liệu liên quan và ghi audit/event.|

|Validation / Quy tắc|Điểm dùng formula/rubric version; thay đổi điểm đã công bố phải qua adjustment có lý do, người duyệt và audit.|

|Ngoại lệ|401 khi phiên không hợp lệ; 403 khi thiếu quyền/scope; 404 khi đối tượng không tồn tại; 409 khi trùng/không đúng version hoặc transition; 422 khi dữ liệu nghiệp vụ không hợp lệ. Không mất dữ liệu người dùng đã nhập và phải có thông báo khắc phục được.|

|Hậu điều kiện|Dữ liệu và trạng thái liên quan nhất quán; sự kiện/outbox phát đúng một lần; audit có actor, thời gian, before/after và correlation ID.|

|Tiêu chí nghiệm thu|AC1. Mentor/Admin thực hiện được nghiệp vụ trong phạm vi được cấp và kết quả đúng mô tả.<br>AC2. Người không có quyền bị chặn nhất quán ở UI và API; không rò rỉ dữ liệu qua response/export.<br>AC3. Validation, trạng thái loading/empty/error/success và xử lý thao tác lặp được kiểm thử.<br>AC4. Giao dịch thành công được lưu bền vững, phản ánh trên màn hình liên quan và có audit/correlation ID.|

|Màn hình / Nguồn|SCR-13..17, SCR-60..61; UI-STD-06..07, UI-MNT-04..05 \| Hub BR-06,10|



UFR-SCO-009 - Chứng nhận


|CONTRACT UFR-SCO-009|CONTRACT UFR-SCO-009|

|---|---|

|Phân hệ / Ưu tiên|Quản lý điểm, kết quả và chứng nhận / Must|

|Actor / Quyền|Admin/Trainer. Bắt buộc permission tương ứng và data scope hợp lệ.|

|Yêu cầu|Cập nhật award status hoặc phát hành chứng nhận có mã xác minh khi học viên đủ điều kiện Finish/pass.|

|Tiền điều kiện|Người dùng đã xác thực; tenant đang hoạt động; có permission và data scope phù hợp. Hồ sơ học viên/lớp tồn tại và chưa bị xóa cứng.|

|Luồng chính|1) Người dùng mở chức năng Chứng nhận; hệ thống tải dữ liệu theo scope.<br>2) Người dùng nhập/chọn điều kiện cần thiết; hệ thống kiểm tra validation và quyền.<br>3) Hệ thống thực hiện: Cập nhật award status hoặc phát hành chứng nhận có mã xác minh khi học viên đủ điều kiện Finish/pass.<br>4) Hệ thống lưu giao dịch, hiển thị kết quả, cập nhật dữ liệu liên quan và ghi audit/event.|

|Validation / Quy tắc|Điểm dùng formula/rubric version; thay đổi điểm đã công bố phải qua adjustment có lý do, người duyệt và audit.|

|Ngoại lệ|401 khi phiên không hợp lệ; 403 khi thiếu quyền/scope; 404 khi đối tượng không tồn tại; 409 khi trùng/không đúng version hoặc transition; 422 khi dữ liệu nghiệp vụ không hợp lệ. Không mất dữ liệu người dùng đã nhập và phải có thông báo khắc phục được.|

|Hậu điều kiện|Dữ liệu và trạng thái liên quan nhất quán; sự kiện/outbox phát đúng một lần; audit có actor, thời gian, before/after và correlation ID.|

|Tiêu chí nghiệm thu|AC1. Admin/Trainer thực hiện được nghiệp vụ trong phạm vi được cấp và kết quả đúng mô tả.<br>AC2. Người không có quyền bị chặn nhất quán ở UI và API; không rò rỉ dữ liệu qua response/export.<br>AC3. Validation, trạng thái loading/empty/error/success và xử lý thao tác lặp được kiểm thử.<br>AC4. Giao dịch thành công được lưu bền vững, phản ánh trên màn hình liên quan và có audit/correlation ID.|

|Màn hình / Nguồn|SCR-13..17, SCR-60..61; UI-STD-06..07, UI-MNT-04..05 \| FAMS SCO-04; Hub RPT-06|




## 5.10 Quản lý thông báo và email

UFR-COM-001 - Trung tâm thông báo


|CONTRACT UFR-COM-001|CONTRACT UFR-COM-001|

|---|---|

|Phân hệ / Ưu tiên|Quản lý thông báo và email / Should|

|Actor / Quyền|Mọi người dùng. Bắt buộc permission tương ứng và data scope hợp lệ.|

|Yêu cầu|Thông báo in-app/email cho deadline, feedback, điểm, lịch, invitation, reservation và class event.|

|Tiền điều kiện|Người dùng đã xác thực; tenant đang hoạt động; có permission và data scope phù hợp.|

|Luồng chính|1) Người dùng mở chức năng Trung tâm thông báo; hệ thống tải dữ liệu theo scope.<br>2) Người dùng nhập/chọn điều kiện cần thiết; hệ thống kiểm tra validation và quyền.<br>3) Hệ thống thực hiện: Thông báo in-app/email cho deadline, feedback, điểm, lịch, invitation, reservation và class event.<br>4) Hệ thống lưu giao dịch, hiển thị kết quả, cập nhật dữ liệu liên quan và ghi audit/event.|

|Validation / Quy tắc|Gửi email/notification là idempotent; có cooldown chống trùng; không log credential hoặc nội dung nhạy cảm ngoài chính sách.|

|Ngoại lệ|401 khi phiên không hợp lệ; 403 khi thiếu quyền/scope; 404 khi đối tượng không tồn tại; 409 khi trùng/không đúng version hoặc transition; 422 khi dữ liệu nghiệp vụ không hợp lệ. Không mất dữ liệu người dùng đã nhập và phải có thông báo khắc phục được.|

|Hậu điều kiện|Dữ liệu và trạng thái liên quan nhất quán; sự kiện/outbox phát đúng một lần; audit có actor, thời gian, before/after và correlation ID.|

|Tiêu chí nghiệm thu|AC1. Mọi người dùng thực hiện được nghiệp vụ trong phạm vi được cấp và kết quả đúng mô tả.<br>AC2. Người không có quyền bị chặn nhất quán ở UI và API; không rò rỉ dữ liệu qua response/export.<br>AC3. Validation, trạng thái loading/empty/error/success và xử lý thao tác lặp được kiểm thử.<br>AC4. Giao dịch thành công được lưu bền vững, phản ánh trên màn hình liên quan và có audit/correlation ID.|

|Màn hình / Nguồn|SCR-22..25; UI-ADM-03, UI-ACC-04 \| Hub DASH-04; FAMS FR-225|



UFR-COM-002 - Tùy chọn thông báo


|CONTRACT UFR-COM-002|CONTRACT UFR-COM-002|

|---|---|

|Phân hệ / Ưu tiên|Quản lý thông báo và email / Must|

|Actor / Quyền|Mọi người dùng. Bắt buộc permission tương ứng và data scope hợp lệ.|

|Yêu cầu|Người dùng cấu hình kênh và loại thông báo trong giới hạn chính sách tenant.|

|Tiền điều kiện|Người dùng đã xác thực; tenant đang hoạt động; có permission và data scope phù hợp.|

|Luồng chính|1) Người dùng mở chức năng Tùy chọn thông báo; hệ thống tải dữ liệu theo scope.<br>2) Người dùng nhập/chọn điều kiện cần thiết; hệ thống kiểm tra validation và quyền.<br>3) Hệ thống thực hiện: Người dùng cấu hình kênh và loại thông báo trong giới hạn chính sách tenant.<br>4) Hệ thống lưu giao dịch, hiển thị kết quả, cập nhật dữ liệu liên quan và ghi audit/event.|

|Validation / Quy tắc|Gửi email/notification là idempotent; có cooldown chống trùng; không log credential hoặc nội dung nhạy cảm ngoài chính sách.|

|Ngoại lệ|401 khi phiên không hợp lệ; 403 khi thiếu quyền/scope; 404 khi đối tượng không tồn tại; 409 khi trùng/không đúng version hoặc transition; 422 khi dữ liệu nghiệp vụ không hợp lệ. Không mất dữ liệu người dùng đã nhập và phải có thông báo khắc phục được.|

|Hậu điều kiện|Dữ liệu và trạng thái liên quan nhất quán; sự kiện/outbox phát đúng một lần; audit có actor, thời gian, before/after và correlation ID.|

|Tiêu chí nghiệm thu|AC1. Mọi người dùng thực hiện được nghiệp vụ trong phạm vi được cấp và kết quả đúng mô tả.<br>AC2. Người không có quyền bị chặn nhất quán ở UI và API; không rò rỉ dữ liệu qua response/export.<br>AC3. Validation, trạng thái loading/empty/error/success và xử lý thao tác lặp được kiểm thử.<br>AC4. Giao dịch thành công được lưu bền vững, phản ánh trên màn hình liên quan và có audit/correlation ID.|

|Màn hình / Nguồn|SCR-22..25; UI-ADM-03, UI-ACC-04 \| Hub DASH-04|



UFR-COM-003 - Lịch sử email


|CONTRACT UFR-COM-003|CONTRACT UFR-COM-003|

|---|---|

|Phân hệ / Ưu tiên|Quản lý thông báo và email / Should|

|Actor / Quyền|Class Admin. Bắt buộc permission tương ứng và data scope hợp lệ.|

|Yêu cầu|Tra cứu/lọc email theo ngữ cảnh, recipient, thời gian và delivery status; không lộ credential.|

|Tiền điều kiện|Người dùng đã xác thực; tenant đang hoạt động; có permission và data scope phù hợp.|

|Luồng chính|1) Người dùng mở chức năng Lịch sử email; hệ thống tải dữ liệu theo scope.<br>2) Người dùng nhập/chọn điều kiện cần thiết; hệ thống kiểm tra validation và quyền.<br>3) Hệ thống thực hiện: Tra cứu/lọc email theo ngữ cảnh, recipient, thời gian và delivery status; không lộ credential.<br>4) Hệ thống lưu giao dịch, hiển thị kết quả, cập nhật dữ liệu liên quan và ghi audit/event.|

|Validation / Quy tắc|Gửi email/notification là idempotent; có cooldown chống trùng; không log credential hoặc nội dung nhạy cảm ngoài chính sách.|

|Ngoại lệ|401 khi phiên không hợp lệ; 403 khi thiếu quyền/scope; 404 khi đối tượng không tồn tại; 409 khi trùng/không đúng version hoặc transition; 422 khi dữ liệu nghiệp vụ không hợp lệ. Không mất dữ liệu người dùng đã nhập và phải có thông báo khắc phục được.|

|Hậu điều kiện|Dữ liệu và trạng thái liên quan nhất quán; sự kiện/outbox phát đúng một lần; audit có actor, thời gian, before/after và correlation ID.|

|Tiêu chí nghiệm thu|AC1. Class Admin thực hiện được nghiệp vụ trong phạm vi được cấp và kết quả đúng mô tả.<br>AC2. Người không có quyền bị chặn nhất quán ở UI và API; không rò rỉ dữ liệu qua response/export.<br>AC3. Validation, trạng thái loading/empty/error/success và xử lý thao tác lặp được kiểm thử.<br>AC4. Giao dịch thành công được lưu bền vững, phản ánh trên màn hình liên quan và có audit/correlation ID.|

|Màn hình / Nguồn|SCR-22..25; UI-ADM-03, UI-ACC-04 \| FAMS EML-01|



UFR-COM-004 - Soạn/preview/gửi email


|CONTRACT UFR-COM-004|CONTRACT UFR-COM-004|

|---|---|

|Phân hệ / Ưu tiên|Quản lý thông báo và email / Should|

|Actor / Quyền|Class Admin. Bắt buộc permission tương ứng và data scope hợp lệ.|

|Yêu cầu|Soạn người nhận, subject, body hoặc chọn template; preview biến và chống double-submit.|

|Tiền điều kiện|Người dùng đã xác thực; tenant đang hoạt động; có permission và data scope phù hợp.|

|Luồng chính|1) Người dùng mở chức năng Soạn/preview/gửi email; hệ thống tải dữ liệu theo scope.<br>2) Người dùng nhập/chọn điều kiện cần thiết; hệ thống kiểm tra validation và quyền.<br>3) Hệ thống thực hiện: Soạn người nhận, subject, body hoặc chọn template; preview biến và chống double-submit.<br>4) Hệ thống lưu giao dịch, hiển thị kết quả, cập nhật dữ liệu liên quan và ghi audit/event.|

|Validation / Quy tắc|Gửi email/notification là idempotent; có cooldown chống trùng; không log credential hoặc nội dung nhạy cảm ngoài chính sách.|

|Ngoại lệ|401 khi phiên không hợp lệ; 403 khi thiếu quyền/scope; 404 khi đối tượng không tồn tại; 409 khi trùng/không đúng version hoặc transition; 422 khi dữ liệu nghiệp vụ không hợp lệ. Không mất dữ liệu người dùng đã nhập và phải có thông báo khắc phục được.|

|Hậu điều kiện|Dữ liệu và trạng thái liên quan nhất quán; sự kiện/outbox phát đúng một lần; audit có actor, thời gian, before/after và correlation ID.|

|Tiêu chí nghiệm thu|AC1. Class Admin thực hiện được nghiệp vụ trong phạm vi được cấp và kết quả đúng mô tả.<br>AC2. Người không có quyền bị chặn nhất quán ở UI và API; không rò rỉ dữ liệu qua response/export.<br>AC3. Validation, trạng thái loading/empty/error/success và xử lý thao tác lặp được kiểm thử.<br>AC4. Giao dịch thành công được lưu bền vững, phản ánh trên màn hình liên quan và có audit/correlation ID.|

|Màn hình / Nguồn|SCR-22..25; UI-ADM-03, UI-ACC-04 \| FAMS EML-02|



UFR-COM-005 - Gửi hàng loạt


|CONTRACT UFR-COM-005|CONTRACT UFR-COM-005|

|---|---|

|Phân hệ / Ưu tiên|Quản lý thông báo và email / Should|

|Actor / Quyền|Class Admin. Bắt buộc permission tương ứng và data scope hợp lệ.|

|Yêu cầu|Gửi email theo selection/filter, báo sent/failed từng phần và tạo history cho mỗi attempt.|

|Tiền điều kiện|Người dùng đã xác thực; tenant đang hoạt động; có permission và data scope phù hợp.|

|Luồng chính|1) Người dùng mở chức năng Gửi hàng loạt; hệ thống tải dữ liệu theo scope.<br>2) Người dùng nhập/chọn điều kiện cần thiết; hệ thống kiểm tra validation và quyền.<br>3) Hệ thống thực hiện: Gửi email theo selection/filter, báo sent/failed từng phần và tạo history cho mỗi attempt.<br>4) Hệ thống lưu giao dịch, hiển thị kết quả, cập nhật dữ liệu liên quan và ghi audit/event.|

|Validation / Quy tắc|Gửi email/notification là idempotent; có cooldown chống trùng; không log credential hoặc nội dung nhạy cảm ngoài chính sách.|

|Ngoại lệ|401 khi phiên không hợp lệ; 403 khi thiếu quyền/scope; 404 khi đối tượng không tồn tại; 409 khi trùng/không đúng version hoặc transition; 422 khi dữ liệu nghiệp vụ không hợp lệ. Không mất dữ liệu người dùng đã nhập và phải có thông báo khắc phục được.|

|Hậu điều kiện|Dữ liệu và trạng thái liên quan nhất quán; sự kiện/outbox phát đúng một lần; audit có actor, thời gian, before/after và correlation ID.|

|Tiêu chí nghiệm thu|AC1. Class Admin thực hiện được nghiệp vụ trong phạm vi được cấp và kết quả đúng mô tả.<br>AC2. Người không có quyền bị chặn nhất quán ở UI và API; không rò rỉ dữ liệu qua response/export.<br>AC3. Validation, trạng thái loading/empty/error/success và xử lý thao tác lặp được kiểm thử.<br>AC4. Giao dịch thành công được lưu bền vững, phản ánh trên màn hình liên quan và có audit/correlation ID.|

|Màn hình / Nguồn|SCR-22..25; UI-ADM-03, UI-ACC-04 \| FAMS EML-02|



UFR-COM-006 - Mẫu email


|CONTRACT UFR-COM-006|CONTRACT UFR-COM-006|

|---|---|

|Phân hệ / Ưu tiên|Quản lý thông báo và email / Should|

|Actor / Quyền|Admin. Bắt buộc permission tương ứng và data scope hợp lệ.|

|Yêu cầu|Danh sách, tạo, sửa, preview, activate/deactivate; sanitize HTML và không làm đổi lịch sử đã gửi.|

|Tiền điều kiện|Người dùng đã xác thực; tenant đang hoạt động; có permission và data scope phù hợp.|

|Luồng chính|1) Người dùng mở chức năng Mẫu email; hệ thống tải dữ liệu theo scope.<br>2) Người dùng nhập/chọn điều kiện cần thiết; hệ thống kiểm tra validation và quyền.<br>3) Hệ thống thực hiện: Danh sách, tạo, sửa, preview, activate/deactivate; sanitize HTML và không làm đổi lịch sử đã gửi.<br>4) Hệ thống lưu giao dịch, hiển thị kết quả, cập nhật dữ liệu liên quan và ghi audit/event.|

|Validation / Quy tắc|Gửi email/notification là idempotent; có cooldown chống trùng; không log credential hoặc nội dung nhạy cảm ngoài chính sách.|

|Ngoại lệ|401 khi phiên không hợp lệ; 403 khi thiếu quyền/scope; 404 khi đối tượng không tồn tại; 409 khi trùng/không đúng version hoặc transition; 422 khi dữ liệu nghiệp vụ không hợp lệ. Không mất dữ liệu người dùng đã nhập và phải có thông báo khắc phục được.|

|Hậu điều kiện|Dữ liệu và trạng thái liên quan nhất quán; sự kiện/outbox phát đúng một lần; audit có actor, thời gian, before/after và correlation ID.|

|Tiêu chí nghiệm thu|AC1. Admin thực hiện được nghiệp vụ trong phạm vi được cấp và kết quả đúng mô tả.<br>AC2. Người không có quyền bị chặn nhất quán ở UI và API; không rò rỉ dữ liệu qua response/export.<br>AC3. Validation, trạng thái loading/empty/error/success và xử lý thao tác lặp được kiểm thử.<br>AC4. Giao dịch thành công được lưu bền vững, phản ánh trên màn hình liên quan và có audit/correlation ID.|

|Màn hình / Nguồn|SCR-22..25; UI-ADM-03, UI-ACC-04 \| FAMS EML-03|



UFR-COM-007 - Reminder tự động


|CONTRACT UFR-COM-007|CONTRACT UFR-COM-007|

|---|---|

|Phân hệ / Ưu tiên|Quản lý thông báo và email / Must|

|Actor / Quyền|Admin/Hệ thống. Bắt buộc permission tương ứng và data scope hợp lệ.|

|Yêu cầu|Lập lịch nhắc start/end, hạn nộp, bảo lưu, assessment và lịch phỏng vấn; chống gửi trùng.|

|Tiền điều kiện|Người dùng đã xác thực; tenant đang hoạt động; có permission và data scope phù hợp.|

|Luồng chính|1) Người dùng mở chức năng Reminder tự động; hệ thống tải dữ liệu theo scope.<br>2) Người dùng nhập/chọn điều kiện cần thiết; hệ thống kiểm tra validation và quyền.<br>3) Hệ thống thực hiện: Lập lịch nhắc start/end, hạn nộp, bảo lưu, assessment và lịch phỏng vấn; chống gửi trùng.<br>4) Hệ thống lưu giao dịch, hiển thị kết quả, cập nhật dữ liệu liên quan và ghi audit/event.|

|Validation / Quy tắc|Gửi email/notification là idempotent; có cooldown chống trùng; không log credential hoặc nội dung nhạy cảm ngoài chính sách.|

|Ngoại lệ|401 khi phiên không hợp lệ; 403 khi thiếu quyền/scope; 404 khi đối tượng không tồn tại; 409 khi trùng/không đúng version hoặc transition; 422 khi dữ liệu nghiệp vụ không hợp lệ. Không mất dữ liệu người dùng đã nhập và phải có thông báo khắc phục được.|

|Hậu điều kiện|Dữ liệu và trạng thái liên quan nhất quán; sự kiện/outbox phát đúng một lần; audit có actor, thời gian, before/after và correlation ID.|

|Tiêu chí nghiệm thu|AC1. Admin/Hệ thống thực hiện được nghiệp vụ trong phạm vi được cấp và kết quả đúng mô tả.<br>AC2. Người không có quyền bị chặn nhất quán ở UI và API; không rò rỉ dữ liệu qua response/export.<br>AC3. Validation, trạng thái loading/empty/error/success và xử lý thao tác lặp được kiểm thử.<br>AC4. Giao dịch thành công được lưu bền vững, phản ánh trên màn hình liên quan và có audit/correlation ID.|

|Màn hình / Nguồn|SCR-22..25; UI-ADM-03, UI-ACC-04 \| FAMS FR-225; Hub INT-02|




## 5.11 Dashboard, báo cáo và xuất dữ liệu

UFR-RPT-001 - Dashboard theo vai trò


|CONTRACT UFR-RPT-001|CONTRACT UFR-RPT-001|

|---|---|

|Phân hệ / Ưu tiên|Dashboard, báo cáo và xuất dữ liệu / Should|

|Actor / Quyền|Theo vai trò. Bắt buộc permission tương ứng và data scope hợp lệ.|

|Yêu cầu|KPI tiến độ, milestone, bài chờ chấm, bảo lưu đến hạn, điểm, cảnh báo và hoạt động gần đây.|

|Tiền điều kiện|Người dùng đã xác thực; tenant đang hoạt động; có permission và data scope phù hợp.|

|Luồng chính|1) Người dùng mở chức năng Dashboard theo vai trò; hệ thống tải dữ liệu theo scope.<br>2) Người dùng nhập/chọn điều kiện cần thiết; hệ thống kiểm tra validation và quyền.<br>3) Hệ thống thực hiện: KPI tiến độ, milestone, bài chờ chấm, bảo lưu đến hạn, điểm, cảnh báo và hoạt động gần đây.<br>4) Hệ thống lưu giao dịch, hiển thị kết quả, cập nhật dữ liệu liên quan và ghi audit/event.|

|Validation / Quy tắc|Số liệu phải khớp nguồn giao dịch, tôn trọng data scope; export chạy nền với file có thời hạn và audit tải xuống.|

|Ngoại lệ|401 khi phiên không hợp lệ; 403 khi thiếu quyền/scope; 404 khi đối tượng không tồn tại; 409 khi trùng/không đúng version hoặc transition; 422 khi dữ liệu nghiệp vụ không hợp lệ. Không mất dữ liệu người dùng đã nhập và phải có thông báo khắc phục được.|

|Hậu điều kiện|Dữ liệu và trạng thái liên quan nhất quán; sự kiện/outbox phát đúng một lần; audit có actor, thời gian, before/after và correlation ID.|

|Tiêu chí nghiệm thu|AC1. Theo vai trò thực hiện được nghiệp vụ trong phạm vi được cấp và kết quả đúng mô tả.<br>AC2. Người không có quyền bị chặn nhất quán ở UI và API; không rò rỉ dữ liệu qua response/export.<br>AC3. Validation, trạng thái loading/empty/error/success và xử lý thao tác lặp được kiểm thử.<br>AC4. Giao dịch thành công được lưu bền vững, phản ánh trên màn hình liên quan và có audit/correlation ID.|

|Màn hình / Nguồn|SCR-04, SCR-61; UI-STD-01, UI-MNT-01, UI-MNT-05, UI-ADM-04 \| Hub DASH-01; FAMS SCR-04|



UFR-RPT-002 - Bộ lọc dashboard


|CONTRACT UFR-RPT-002|CONTRACT UFR-RPT-002|

|---|---|

|Phân hệ / Ưu tiên|Dashboard, báo cáo và xuất dữ liệu / Must|

|Actor / Quyền|Theo vai trò. Bắt buộc permission tương ứng và data scope hợp lệ.|

|Yêu cầu|Lọc theo tenant, program, cohort, class, project, nhóm, thời gian và trạng thái.|

|Tiền điều kiện|Người dùng đã xác thực; tenant đang hoạt động; có permission và data scope phù hợp.|

|Luồng chính|1) Người dùng mở chức năng Bộ lọc dashboard; hệ thống tải dữ liệu theo scope.<br>2) Người dùng nhập/chọn điều kiện cần thiết; hệ thống kiểm tra validation và quyền.<br>3) Hệ thống thực hiện: Lọc theo tenant, program, cohort, class, project, nhóm, thời gian và trạng thái.<br>4) Hệ thống lưu giao dịch, hiển thị kết quả, cập nhật dữ liệu liên quan và ghi audit/event.|

|Validation / Quy tắc|Số liệu phải khớp nguồn giao dịch, tôn trọng data scope; export chạy nền với file có thời hạn và audit tải xuống.|

|Ngoại lệ|401 khi phiên không hợp lệ; 403 khi thiếu quyền/scope; 404 khi đối tượng không tồn tại; 409 khi trùng/không đúng version hoặc transition; 422 khi dữ liệu nghiệp vụ không hợp lệ. Không mất dữ liệu người dùng đã nhập và phải có thông báo khắc phục được.|

|Hậu điều kiện|Dữ liệu và trạng thái liên quan nhất quán; sự kiện/outbox phát đúng một lần; audit có actor, thời gian, before/after và correlation ID.|

|Tiêu chí nghiệm thu|AC1. Theo vai trò thực hiện được nghiệp vụ trong phạm vi được cấp và kết quả đúng mô tả.<br>AC2. Người không có quyền bị chặn nhất quán ở UI và API; không rò rỉ dữ liệu qua response/export.<br>AC3. Validation, trạng thái loading/empty/error/success và xử lý thao tác lặp được kiểm thử.<br>AC4. Giao dịch thành công được lưu bền vững, phản ánh trên màn hình liên quan và có audit/correlation ID.|

|Màn hình / Nguồn|SCR-04, SCR-61; UI-STD-01, UI-MNT-01, UI-MNT-05, UI-ADM-04 \| Hub DASH-02|



UFR-RPT-003 - Activity feed


|CONTRACT UFR-RPT-003|CONTRACT UFR-RPT-003|

|---|---|

|Phân hệ / Ưu tiên|Dashboard, báo cáo và xuất dữ liệu / Should|

|Actor / Quyền|Theo vai trò. Bắt buộc permission tương ứng và data scope hợp lệ.|

|Yêu cầu|Dòng sự kiện quan trọng đã tối thiểu hóa dữ liệu cá nhân và có liên kết đến đối tượng.|

|Tiền điều kiện|Người dùng đã xác thực; tenant đang hoạt động; có permission và data scope phù hợp.|

|Luồng chính|1) Người dùng mở chức năng Activity feed; hệ thống tải dữ liệu theo scope.<br>2) Người dùng nhập/chọn điều kiện cần thiết; hệ thống kiểm tra validation và quyền.<br>3) Hệ thống thực hiện: Dòng sự kiện quan trọng đã tối thiểu hóa dữ liệu cá nhân và có liên kết đến đối tượng.<br>4) Hệ thống lưu giao dịch, hiển thị kết quả, cập nhật dữ liệu liên quan và ghi audit/event.|

|Validation / Quy tắc|Số liệu phải khớp nguồn giao dịch, tôn trọng data scope; export chạy nền với file có thời hạn và audit tải xuống.|

|Ngoại lệ|401 khi phiên không hợp lệ; 403 khi thiếu quyền/scope; 404 khi đối tượng không tồn tại; 409 khi trùng/không đúng version hoặc transition; 422 khi dữ liệu nghiệp vụ không hợp lệ. Không mất dữ liệu người dùng đã nhập và phải có thông báo khắc phục được.|

|Hậu điều kiện|Dữ liệu và trạng thái liên quan nhất quán; sự kiện/outbox phát đúng một lần; audit có actor, thời gian, before/after và correlation ID.|

|Tiêu chí nghiệm thu|AC1. Theo vai trò thực hiện được nghiệp vụ trong phạm vi được cấp và kết quả đúng mô tả.<br>AC2. Người không có quyền bị chặn nhất quán ở UI và API; không rò rỉ dữ liệu qua response/export.<br>AC3. Validation, trạng thái loading/empty/error/success và xử lý thao tác lặp được kiểm thử.<br>AC4. Giao dịch thành công được lưu bền vững, phản ánh trên màn hình liên quan và có audit/correlation ID.|

|Màn hình / Nguồn|SCR-04, SCR-61; UI-STD-01, UI-MNT-01, UI-MNT-05, UI-ADM-04 \| Hub DASH-03|



UFR-RPT-004 - Báo cáo cá nhân/nhóm


|CONTRACT UFR-RPT-004|CONTRACT UFR-RPT-004|

|---|---|

|Phân hệ / Ưu tiên|Dashboard, báo cáo và xuất dữ liệu / Should|

|Actor / Quyền|Mentor/Program Manager. Bắt buộc permission tương ứng và data scope hợp lệ.|

|Yêu cầu|Điểm, rubric, artifact, feedback, tiến độ, lịch sử nộp và vai trò dự án.|

|Tiền điều kiện|Người dùng đã xác thực; tenant đang hoạt động; có permission và data scope phù hợp.|

|Luồng chính|1) Người dùng mở chức năng Báo cáo cá nhân/nhóm; hệ thống tải dữ liệu theo scope.<br>2) Người dùng nhập/chọn điều kiện cần thiết; hệ thống kiểm tra validation và quyền.<br>3) Hệ thống thực hiện: Điểm, rubric, artifact, feedback, tiến độ, lịch sử nộp và vai trò dự án.<br>4) Hệ thống lưu giao dịch, hiển thị kết quả, cập nhật dữ liệu liên quan và ghi audit/event.|

|Validation / Quy tắc|Số liệu phải khớp nguồn giao dịch, tôn trọng data scope; export chạy nền với file có thời hạn và audit tải xuống.|

|Ngoại lệ|401 khi phiên không hợp lệ; 403 khi thiếu quyền/scope; 404 khi đối tượng không tồn tại; 409 khi trùng/không đúng version hoặc transition; 422 khi dữ liệu nghiệp vụ không hợp lệ. Không mất dữ liệu người dùng đã nhập và phải có thông báo khắc phục được.|

|Hậu điều kiện|Dữ liệu và trạng thái liên quan nhất quán; sự kiện/outbox phát đúng một lần; audit có actor, thời gian, before/after và correlation ID.|

|Tiêu chí nghiệm thu|AC1. Mentor/Program Manager thực hiện được nghiệp vụ trong phạm vi được cấp và kết quả đúng mô tả.<br>AC2. Người không có quyền bị chặn nhất quán ở UI và API; không rò rỉ dữ liệu qua response/export.<br>AC3. Validation, trạng thái loading/empty/error/success và xử lý thao tác lặp được kiểm thử.<br>AC4. Giao dịch thành công được lưu bền vững, phản ánh trên màn hình liên quan và có audit/correlation ID.|

|Màn hình / Nguồn|SCR-04, SCR-61; UI-STD-01, UI-MNT-01, UI-MNT-05, UI-ADM-04 \| Hub RPT-02|



UFR-RPT-005 - Báo cáo cohort/class


|CONTRACT UFR-RPT-005|CONTRACT UFR-RPT-005|

|---|---|

|Phân hệ / Ưu tiên|Dashboard, báo cáo và xuất dữ liệu / Should|

|Actor / Quyền|Program/Class Admin. Bắt buộc permission tương ứng và data scope hợp lệ.|

|Yêu cầu|Chuẩn đầu ra, phân bố điểm, rủi ro, tiến độ, attendance, completion và pass/fail.|

|Tiền điều kiện|Người dùng đã xác thực; tenant đang hoạt động; có permission và data scope phù hợp.|

|Luồng chính|1) Người dùng mở chức năng Báo cáo cohort/class; hệ thống tải dữ liệu theo scope.<br>2) Người dùng nhập/chọn điều kiện cần thiết; hệ thống kiểm tra validation và quyền.<br>3) Hệ thống thực hiện: Chuẩn đầu ra, phân bố điểm, rủi ro, tiến độ, attendance, completion và pass/fail.<br>4) Hệ thống lưu giao dịch, hiển thị kết quả, cập nhật dữ liệu liên quan và ghi audit/event.|

|Validation / Quy tắc|Số liệu phải khớp nguồn giao dịch, tôn trọng data scope; export chạy nền với file có thời hạn và audit tải xuống.|

|Ngoại lệ|401 khi phiên không hợp lệ; 403 khi thiếu quyền/scope; 404 khi đối tượng không tồn tại; 409 khi trùng/không đúng version hoặc transition; 422 khi dữ liệu nghiệp vụ không hợp lệ. Không mất dữ liệu người dùng đã nhập và phải có thông báo khắc phục được.|

|Hậu điều kiện|Dữ liệu và trạng thái liên quan nhất quán; sự kiện/outbox phát đúng một lần; audit có actor, thời gian, before/after và correlation ID.|

|Tiêu chí nghiệm thu|AC1. Program/Class Admin thực hiện được nghiệp vụ trong phạm vi được cấp và kết quả đúng mô tả.<br>AC2. Người không có quyền bị chặn nhất quán ở UI và API; không rò rỉ dữ liệu qua response/export.<br>AC3. Validation, trạng thái loading/empty/error/success và xử lý thao tác lặp được kiểm thử.<br>AC4. Giao dịch thành công được lưu bền vững, phản ánh trên màn hình liên quan và có audit/correlation ID.|

|Màn hình / Nguồn|SCR-04, SCR-61; UI-STD-01, UI-MNT-01, UI-MNT-05, UI-ADM-04 \| Hub RPT-03; FAMS FR-226|



UFR-RPT-006 - Báo cáo program/assessment


|CONTRACT UFR-RPT-006|CONTRACT UFR-RPT-006|

|---|---|

|Phân hệ / Ưu tiên|Dashboard, báo cáo và xuất dữ liệu / Must|

|Actor / Quyền|Program Manager. Bắt buộc permission tương ứng và data scope hợp lệ.|

|Yêu cầu|Tổng hợp theo chương trình, course, assessment, item/result statistics và thời gian.|

|Tiền điều kiện|Người dùng đã xác thực; tenant đang hoạt động; có permission và data scope phù hợp.|

|Luồng chính|1) Người dùng mở chức năng Báo cáo program/assessment; hệ thống tải dữ liệu theo scope.<br>2) Người dùng nhập/chọn điều kiện cần thiết; hệ thống kiểm tra validation và quyền.<br>3) Hệ thống thực hiện: Tổng hợp theo chương trình, course, assessment, item/result statistics và thời gian.<br>4) Hệ thống lưu giao dịch, hiển thị kết quả, cập nhật dữ liệu liên quan và ghi audit/event.|

|Validation / Quy tắc|Số liệu phải khớp nguồn giao dịch, tôn trọng data scope; export chạy nền với file có thời hạn và audit tải xuống.|

|Ngoại lệ|401 khi phiên không hợp lệ; 403 khi thiếu quyền/scope; 404 khi đối tượng không tồn tại; 409 khi trùng/không đúng version hoặc transition; 422 khi dữ liệu nghiệp vụ không hợp lệ. Không mất dữ liệu người dùng đã nhập và phải có thông báo khắc phục được.|

|Hậu điều kiện|Dữ liệu và trạng thái liên quan nhất quán; sự kiện/outbox phát đúng một lần; audit có actor, thời gian, before/after và correlation ID.|

|Tiêu chí nghiệm thu|AC1. Program Manager thực hiện được nghiệp vụ trong phạm vi được cấp và kết quả đúng mô tả.<br>AC2. Người không có quyền bị chặn nhất quán ở UI và API; không rò rỉ dữ liệu qua response/export.<br>AC3. Validation, trạng thái loading/empty/error/success và xử lý thao tác lặp được kiểm thử.<br>AC4. Giao dịch thành công được lưu bền vững, phản ánh trên màn hình liên quan và có audit/correlation ID.|

|Màn hình / Nguồn|SCR-04, SCR-61; UI-STD-01, UI-MNT-01, UI-MNT-05, UI-ADM-04 \| FAMS FR-226|



UFR-RPT-007 - Xuất báo cáo


|CONTRACT UFR-RPT-007|CONTRACT UFR-RPT-007|

|---|---|

|Phân hệ / Ưu tiên|Dashboard, báo cáo và xuất dữ liệu / Must|

|Actor / Quyền|Theo quyền. Bắt buộc permission tương ứng và data scope hợp lệ.|

|Yêu cầu|Export PDF/CSV/Excel theo quyền; dữ liệu lớn xử lý background và thông báo khi sẵn sàng.|

|Tiền điều kiện|Người dùng đã xác thực; tenant đang hoạt động; có permission và data scope phù hợp.|

|Luồng chính|1) Người dùng mở chức năng Xuất báo cáo; hệ thống tải dữ liệu theo scope.<br>2) Người dùng nhập/chọn điều kiện cần thiết; hệ thống kiểm tra validation và quyền.<br>3) Hệ thống thực hiện: Export PDF/CSV/Excel theo quyền; dữ liệu lớn xử lý background và thông báo khi sẵn sàng.<br>4) Hệ thống lưu giao dịch, hiển thị kết quả, cập nhật dữ liệu liên quan và ghi audit/event.|

|Validation / Quy tắc|Số liệu phải khớp nguồn giao dịch, tôn trọng data scope; export chạy nền với file có thời hạn và audit tải xuống.|

|Ngoại lệ|401 khi phiên không hợp lệ; 403 khi thiếu quyền/scope; 404 khi đối tượng không tồn tại; 409 khi trùng/không đúng version hoặc transition; 422 khi dữ liệu nghiệp vụ không hợp lệ. Không mất dữ liệu người dùng đã nhập và phải có thông báo khắc phục được.|

|Hậu điều kiện|Dữ liệu và trạng thái liên quan nhất quán; sự kiện/outbox phát đúng một lần; audit có actor, thời gian, before/after và correlation ID.|

|Tiêu chí nghiệm thu|AC1. Theo quyền thực hiện được nghiệp vụ trong phạm vi được cấp và kết quả đúng mô tả.<br>AC2. Người không có quyền bị chặn nhất quán ở UI và API; không rò rỉ dữ liệu qua response/export.<br>AC3. Validation, trạng thái loading/empty/error/success và xử lý thao tác lặp được kiểm thử.<br>AC4. Giao dịch thành công được lưu bền vững, phản ánh trên màn hình liên quan và có audit/correlation ID.|

|Màn hình / Nguồn|SCR-04, SCR-61; UI-STD-01, UI-MNT-01, UI-MNT-05, UI-ADM-04 \| Hub RPT-05; FAMS FR-226|




# 6. Quy tắc nghiệp vụ hợp nhất


|ID|Quy tắc|

|---|---|

|BR-UNI-01|Mọi quyền được kiểm tra ở backend theo role + granular permission + data scope; UI ẩn nút không phải ranh giới bảo mật.|

|BR-UNI-02|Dữ liệu tenant/trường phải tách biệt; reviewer ngoài tenant chỉ truy cập đối tượng được mời trong thời hạn.|

|BR-UNI-03|Tài khoản chỉ đăng nhập khi ACTIVE; user có dependency không hard-delete mà deactivate/ẩn danh theo retention.|

|BR-UNI-04|Role/module/menu mặc định không sửa/xóa; dependency phải được tháo hoặc entity được deactivate trước.|

|BR-UNI-05|Course: DRAFT -> UNDER_REVIEW -> ACTIVE/REJECTED; chỉ DRAFT/REJECTED được sửa nội dung.|

|BR-UNI-06|Topic/program có version và chỉ version ACTIVE được dùng cho lớp/course đang vận hành.|

|BR-UNI-07|Open Class Request: DRAFT -> SUBMITTED -> UNDER_REVIEW -> APPROVED/REJECTED/CANCELLED; reject cần lý do.|

|BR-UNI-08|Class: PLANNING -> ONGOING -> COMPLETED/CANCELLED; phải có Class Admin active và trainer theo topic.|

|BR-UNI-09|Calendar có nhiều version nhưng chỉ một active; session không ngoài date range, holiday hoặc trùng room/slot.|

|BR-UNI-10|Học viên chỉ có một trạng thái hợp lệ; reservation và class assignment phải đồng bộ theo state machine.|

|BR-UNI-11|Attendance chỉ ghi cho lớp ONGOING/ngày hợp lệ; mỗi học viên/ngày một record.|

|BR-UNI-12|Project Completed khi milestone bắt buộc đã Accepted/waived và điểm đã khóa.|

|BR-UNI-13|Submission/artifact và attempt đã finalize là bất biến; sửa đổi tạo version hoặc adjustment record.|

|BR-UNI-14|Assessment start < end, duration không vượt time window, không vượt attempt limit; autosave tối đa 30 giây.|

|BR-UNI-15|Điểm nhóm không tự động là điểm cá nhân; công thức version hóa phải nêu rõ hệ số và cách làm tròn.|

|BR-UNI-16|Rubric/đề bài/đáp án/test case dùng để đánh giá phải được snapshot tại thời điểm bắt đầu.|

|BR-UNI-17|Chỉ kết quả RELEASED hiển thị cho người học; thay đổi sau công bố cần lý do, audit và quyền phê duyệt.|

|BR-UNI-18|AI chỉ tạo suggestion; con người review, chỉnh và xác nhận trước khi trở thành dữ liệu chính thức.|

|BR-UNI-19|Cờ bất thường chỉ hỗ trợ review, không tự động kết luận gian lận hay áp dụng kỷ luật.|

|BR-UNI-20|Mọi import/bulk/email phải idempotent hoặc có kiểm soát chống thao tác lặp; trả kết quả từng phần rõ ràng.|




## 6.1 Ma trận chuyển trạng thái chủ chốt


|Đối tượng|Từ|Sự kiện|Đến|Điều kiện|

|---|---|---|---|---|

|Course|DRAFT|Submit|UNDER_REVIEW|Đủ overview/scheme/objective/outline.|

|Course|UNDER_REVIEW|Approve/Reject|ACTIVE/REJECTED|Program Manager có quyền; ghi nhận xét.|

|OpenClassRequest|DRAFT|Submit|SUBMITTED|Đủ program, số lượng, thời gian dự kiến.|

|OpenClassRequest|UNDER_REVIEW|Approve/Reject|APPROVED/REJECTED|Reviewer khác người gửi khi policy yêu cầu.|

|TrainingClass|PLANNING|Start|ONGOING|Có Class Admin, trainer, topic/course và calendar active.|

|TrainingClass|ONGOING|Complete|COMPLETED|Đã khóa attendance/grade theo policy.|

|Reservation|ACTIVE|End|ENDED|Có next action: reclassify hoặc drop out.|

|Project|ACTIVE|Accept final milestone|COMPLETED|Các milestone bắt buộc được accepted; final grade khóa.|

|Attempt|IN_PROGRESS|Submit/Timeout|SUBMITTED/EXPIRED|Lưu answer cuối cùng idempotent.|

|Grade|REVIEWED|Release|RELEASED|Đủ rubric/formula version và người duyệt.|




# 7. Yêu cầu dữ liệu

Mô hình dưới đây là logical data baseline. Thiết kế vật lý có thể tách bảng hoặc service nhưng phải giữ khóa, trạng thái, tính bất biến và khả năng audit.


|Entity|Khóa|Thuộc tính chính|Trạng thái|Ràng buộc/Ý nghĩa|

|---|---|---|---|---|

|Tenant|tenant_id|name, code, locale, timezone, retention_policy, status|ACTIVE/INACTIVE|Phân vùng dữ liệu và cấu hình tổ chức.|

|User|user_id|tenant_id, email, display_name, status, last_login_at|INVITED/ACTIVE/SUSPENDED/DEACTIVATED|Tài khoản đăng nhập; email duy nhất trong tenant.|

|Role/Permission|role_id/permission_id|code, module, function, scope_type, active|ACTIVE/INACTIVE|RBAC và quyền chi tiết theo phạm vi dữ liệu.|

|Module/MenuItem|module_id/function_id|group_id, code, label, route, icon, order_no, active|ACTIVE/INACTIVE|Điều hướng và ánh xạ permission.|

|Skill/Topic|skill_id/topic_id|code, name, version, objectives, scheme, status|DRAFT/REVIEW/ACTIVE/ARCHIVED|Danh mục năng lực và nội dung đào tạo.|

|Course|course_id|topic_id, version, trainer_id, outline, materials, status|DRAFT/UNDER_REVIEW/ACTIVE/REJECTED|Học liệu và cấu trúc khóa học.|

|TrainingProgram|program_id|code, name, version, topic_sequence, status|DRAFT/ACTIVE/ARCHIVED|Chương trình đào tạo có version.|

|OpenClassRequest|request_id|department_id, program_id, quantity, planned_dates, status|DRAFT/SUBMITTED/UNDER_REVIEW/APPROVED/REJECTED/CANCELLED|Nhu cầu mở lớp và phê duyệt.|

|TrainingClass|class_id|program_id, code, cohort_id, dates, capacity, room, trainers, status|PLANNING/ONGOING/COMPLETED/CANCELLED|Đơn vị vận hành đào tạo.|

|Student/ClassMember|student_id/member_id|user_id, class_id, status, joined_at, version|ACTIVE/RESERVE/DROP_OUT/COMPLETED/INACTIVE|Hồ sơ và quan hệ học viên-lớp.|

|CalendarVersion/Session|calendar_version_id/session_id|class_id, date, slot, room, trainer, topic, active|DRAFT/ACTIVE/ARCHIVED|Lịch lớp được version hóa.|

|Attendance|attendance_id|class_id, student_id, session_id, status, note|PRESENT/ABSENT/LATE/EXCUSED|Một bản ghi trên học viên/buổi.|

|Reservation|reservation_id|student_id, start_date, end_date, reason, next_action, status|ACTIVE/ENDED/RECLASSIFIED/DROP_OUT|Bảo lưu và vòng đời sau bảo lưu.|

|ProjectTemplate|template_id|version, context, goals, constraints, deliverables, rubric, status|DRAFT/ACTIVE/ARCHIVED|Đề bài gốc; snapshot khi tạo project.|

|Project/Team|project_id/team_id|class_id, template_snapshot_id, members, roles, charter, status|PLANNING/ACTIVE/COMPLETED/CANCELLED|Workspace Mock Project.|

|Milestone/Sprint/Task|milestone_id/sprint_id/task_id|project_id, deadline, assignee, priority, dependency, status|TODO/IN_PROGRESS/REVIEW/DONE/BLOCKED|Kế hoạch và thực thi dự án.|

|Artifact/Submission|artifact_id/submission_id|project_id, milestone_id, version, file_url, repo_url, submitted_by, submitted_at|DRAFT/SUBMITTED/ACCEPTED/REJECTED|Bàn giao bất biến theo version.|

|Assessment|assessment_id|type, rules, duration, attempts, release_policy, status|DRAFT/PUBLISHED/CLOSED/ARCHIVED|Cấu hình bài thi/đánh giá.|

|Question/CodingExercise|question_id|bank_id, type, content, options, test_cases, points, version|DRAFT/ACTIVE/ARCHIVED|Ngân hàng câu hỏi và bài lập trình.|

|Attempt/Answer|attempt_id/answer_id|assessment_id, user_id, started_at, ended_at, autosave_version, status|NOT_STARTED/IN_PROGRESS/SUBMITTED/EXPIRED/GRADED|Phiên làm bài an toàn.|

|Grade/Adjustment|grade_id/adjustment_id|subject_ref, rubric_version, formula_version, value, reason, approved_by, released_at|DRAFT/REVIEWED/RELEASED/ADJUSTED|Điểm, lịch sử điều chỉnh và công bố.|

|Interview/Scorecard|interview_id/scorecard_id|student_id, interviewer_id, schedule, criteria, feedback, status|SCHEDULED/ONGOING/SUBMITTED/CANCELLED|Phỏng vấn mô phỏng và đánh giá.|

|Notification/EmailAttempt|notification_id/email_attempt_id|recipient, template_version, context_ref, sent_at, delivery_status|QUEUED/SENT/DELIVERED/FAILED|Thông báo và lịch sử gửi.|

|Certificate|certificate_id|student_id, program_id, award_status, issued_at, verification_code|PENDING/ISSUED/REVOKED|Chứng nhận hoàn thành.|

|AuditLog|audit_id|tenant_id, actor_id, action, entity, before, after, ip, correlation_id, created_at|IMMUTABLE|Nhật ký kiểm toán không chỉnh sửa.|




## 7.1 Toàn vẹn, lưu trữ và quyền riêng tư

Mọi bản ghi nghiệp vụ có tenant_id, created_at/by, updated_at/by; entity có cạnh tranh cập nhật dùng version/ETag.

Submission, attempt đã finalize, grade đã release và audit không sửa trực tiếp; thay đổi tạo version hoặc adjustment.

Hard-delete chỉ theo retention và phê duyệt; mặc định deactivate, archive hoặc ẩn danh theo business purpose.

File kiểm tra MIME/kích thước, malware scan, random key, signed URL; log không chứa password/token/secret.

Batch/import/webhook/job phải idempotent; giao dịch nhiều entity dùng transaction hoặc outbox/saga có bù trừ.


# 8. Tích hợp và hợp đồng API


|Tích hợp|Mục đích|Hợp đồng|Lỗi cần xử lý|

|---|---|---|---|

|SSO/OIDC|Đăng nhập doanh nghiệp, mapping tenant/role|OIDC authorization code + PKCE; validate issuer/audience/nonce; JIT provisioning chỉ khi policy cho phép|Timeout, invalid token, user chưa được cấp quyền|

|Email provider|Email giao dịch và reminder|Queue/outbox; idempotency key; template version; retry exponential; webhook delivery status|Provider timeout, bounce, rate limit|

|Object storage|Tài liệu, submission, export|Signed URL có thời hạn; MIME/size allowlist; malware scan; random object key|Upload thất bại, file độc hại, link hết hạn|

|Git/Repository|Liên kết repo, commit, pull request|Lưu URL và metadata; webhook có chữ ký; không lưu access token dạng rõ|Webhook giả mạo, repo private, rate limit|

|Assessment sandbox|Chạy test bài lập trình|Giới hạn CPU/RAM/time; chặn network/filesystem; tách process/container; lưu kết quả test|Timeout, runtime error, malicious code|

|Calendar/Meeting|Lịch lớp và phỏng vấn|Lưu external_event_id; đồng bộ idempotent; timezone UTC + display timezone|Conflict, deleted event, provider unavailable|

|Webhook/API consumers|Sự kiện user/project/submission/grade|Versioned API; HMAC signature; replay protection; delivery log; dead-letter queue|Consumer 4xx/5xx, replay, schema mismatch|




## 8.1 Chuẩn API

Base path có version (/api/v1); resource dùng danh từ; filter/sort/page rõ ràng; cursor cho feed lớn.

Mọi request có correlation ID; mutation hỗ trợ idempotency key khi có nguy cơ gửi lặp.

Response lỗi chuẩn gồm code, message, fieldErrors, correlationId; không lộ stack trace hoặc dữ liệu nhạy cảm.

Optimistic locking qua version/ETag; conflict trả 409 và currentVersion để UI reload/merge.

OpenAPI là source of truth cho contract; thay đổi breaking phải nâng version và có kế hoạch migration/deprecation.


# 9. Yêu cầu phi chức năng


|ID|Nhóm|Yêu cầu|

|---|---|---|

|NFR-PERF|Hiệu năng|Trang đầu danh sách phản hồi trong 2 giây ở p95 dưới tải đã thống nhất; tác vụ lớn dùng background job/progress.|

|NFR-SEC|Bảo mật|Hash mật khẩu thích ứng; token reset hashed, một lần; cookie an toàn; authorization server-side; quét malware và sanitize HTML.|

|NFR-PRIV|Riêng tư|Tối thiểu hóa dữ liệu cá nhân; hiển thị/export theo business purpose và permission; note riêng không lộ.|

|NFR-REL|Tin cậy|Autosave/resume cho luồng thi/học; retry an toàn; idempotency cho import, bulk, submit và email.|

|NFR-AUD|Kiểm toán|Ghi actor, timestamp, entity, before/after, reason và correlation ID cho thay đổi trọng yếu.|

|NFR-USA|Khả dụng|Danh sách thống nhất search/filter/sort/page/loading/empty/error; action rủi ro có confirmation và outcome.|

|NFR-A11Y|Tiếp cận|WCAG 2.1 AA cho luồng chính; keyboard, focus rõ, label/error liên kết; không dùng màu làm tín hiệu duy nhất.|

|NFR-RESP|Responsive|Tối ưu desktop >=1280px, dùng được tablet >=768px; bảng rộng có horizontal scroll, không ép chữ quá nhỏ.|

|NFR-I18N|Quốc tế hóa|Hỗ trợ giao diện Việt/Anh, Unicode, múi giờ tenant/user và định dạng ngày cấu hình được.|

|NFR-OBS|Quan sát|Log/metric/trace cho lỗi và job; UI cung cấp support ID an toàn khi cần.|

|NFR-DATA|Toàn vẹn dữ liệu|Optimistic locking/version/ETag cho dữ liệu cạnh tranh; transaction cho thay đổi liên thực thể.|

|NFR-SBX|Sandbox code|Giới hạn CPU/memory/time, chặn network/filesystem trái phép và cô lập từng lần chạy.|




## 9.1 Security baseline


|Miền|Yêu cầu kiểm soát|

|---|---|

|Authentication|Password hash thích ứng; SSO OIDC; reset token một lần; session rotation/revocation; MFA theo tenant policy.|

|Authorization|RBAC + permission + object scope ở backend; deny by default; kiểm thử privilege escalation và IDOR.|

|Input/File|Allowlist, canonicalization, parameterized query; MIME/size/malware scan; chặn path traversal và formula injection.|

|Data protection|TLS; mã hóa secret/PII phù hợp; key rotation; backup encrypted; signed URL ngắn hạn.|

|Audit/Monitoring|Log actor/action/entity/before-after/reason/correlation; cảnh báo auth bất thường, export lớn, webhook lỗi và thay đổi quyền.|

|Secure SDLC|SAST/SCA/secret scan; threat model cho auth, file, assessment sandbox và multi-tenant; pentest trước go-live.|




# 10. Chiến lược kiểm thử và nghiệm thu


|Lớp kiểm thử|Phạm vi|Điều kiện đạt|

|---|---|---|

|Unit|Validation, state machine, formula, permission helpers, mapper|Critical domain logic >=80% branch hoặc theo quality gate dự án.|

|API/Integration|Auth, scope, CRUD, concurrency, outbox, provider adapters|Contract khớp OpenAPI; test lỗi 4xx/5xx; không có rò dữ liệu tenant.|

|UI Component|Form, table, filter, upload, editor, timer, grading|Loading/empty/error/success/denied; keyboard và label đúng.|

|E2E|Các luồng login, class, reservation, project, assessment, grade, email, export|Happy path và ít nhất một alternate/error path cho mỗi Must UFR.|

|Security|OWASP ASVS/web, IDOR, injection, file, session, sandbox|Không còn Critical/High; Medium có risk acceptance rõ.|

|Performance|List, dashboard, import/export, assessment autosave|Đạt p95/SLA đã chốt và không mất dữ liệu khi retry.|

|UAT|Scenario theo vai trò và dữ liệu thật đã ẩn danh|PO/Business Owner ký; mọi Must UFR có evidence và defect disposition.|




## 10.1 Definition of Done cho mỗi UFR

Có user story/AC, API contract, schema/migration, permission mapping và thiết kế màn hình liên quan.

Có unit/API/UI/E2E test phù hợp; negative test cho quyền, validation, conflict và retry.

Có audit/log/metric; không chứa secret/PII trong log; accessibility pass ở luồng chính.

PO/BA/QA xác nhận traceability UFR -> screen -> API -> test case -> evidence.


# 11. Quy chuẩn UX/UI và quản trị màn hình


## 11.1 Design system hợp nhất


|Thành phần|Quy chuẩn|

|---|---|

|Shell|Sidebar theo permission; top bar có search, notification, user menu; breadcrumb phản ánh hierarchy.|

|Trang danh sách|Title + primary action; filter có thể khôi phục; sort/page; bulk action có xác nhận và summary kết quả.|

|Form|Label cố định, required rõ, inline validation, disabled có lý do; lưu draft khi nghiệp vụ cho phép; chống double-submit.|

|Chi tiết|Overview/status/owner/audit; action theo state; tab không che validation hoặc dữ liệu quan trọng.|

|Feedback|Toast cho kết quả ngắn; banner cho lỗi trang; modal chỉ cho quyết định/confirm; correlation ID ở lỗi kỹ thuật.|

|Màu & trạng thái|Không dùng màu là tín hiệu duy nhất; status có text/icon; focus visible; contrast WCAG 2.1 AA.|

|Responsive|Desktop-first; tablet >=768px; bảng rộng cho scroll ngang có header cố định; không ép chữ quá nhỏ.|

|I18N|Vi/en; timezone theo user; lưu UTC; định dạng ngày/số/điểm theo locale và tenant policy.|




## 11.2 Quy tắc validation và message

Client validation cải thiện UX nhưng server là nguồn quyết định; message chỉ rõ trường, quy tắc và cách sửa.

Các thao tác destructive, release grade, terminate reservation, deactivate user và cancel class phải xác nhận và nêu hậu quả.

Import luôn có tải mẫu, preview, validation theo dòng/field, partial result có chủ đích và file lỗi tải xuống.

Không mất filter/dữ liệu form khi lỗi recoverable; nút submit bị khóa trong lúc xử lý; retry không tạo bản ghi trùng.

Mọi màn hình có loading, empty, error, success, permission denied; màn hình chỉnh sửa thêm stale/conflict state.


## 11.3 Danh mục màn hình


|Screen ID|Màn hình|Module|Actor|Route|Truy vết|

|---|---|---|---|---|---|

|SCR-01|Đăng nhập|Platform / Authentication|Tất cả người dùng|/fams/ang-nhap|Platform|

|SCR-02|Quên mật khẩu|Platform / Authentication|Người dùng chưa đăng nhập|/fams/quen-mat-khau|Platform|

|SCR-03|Đặt lại mật khẩu|Platform / Authentication|Người dùng có reset token|/fams/at-lai-mat-khau|Platform|

|SCR-04|Dashboard và điều hướng|Platform|Class Admin, Trainer|/fams/dashboard-va-ieu-huong|Platform|

|SCR-05|Danh sách toàn bộ học viên|Student Information|Class Admin; Trainer read-only nếu được cấp quyền|/fams/danh-sach-toan-bo-hoc-vien|US-01..09|

|SCR-06|Chi tiết lớp - danh sách học viên|Student Information|Class Admin; Trainer theo quyền|/fams/chi-tiet-lop-danh-sach-hoc-vien|US-01..09|

|SCR-07|Chi tiết học viên|Student Information|Class Admin; Trainer read-only theo quyền|/fams/chi-tiet-hoc-vien|US-01..09|

|SCR-08|Thêm/Sửa học viên|Student Information|Class Admin|/fams/them-sua-hoc-vien|US-01..09|

|SCR-09|Import danh sách học viên|Student Information|Class Admin|/fams/import-danh-sach-hoc-vien|US-01..09|

|SCR-10|Thay đổi trạng thái học viên|Student Information / Reservation|Class Admin|/fams/thay-oi-trang-thai-hoc-vien|US-01..09|

|SCR-11|Xuất danh sách học viên|Student Information|Class Admin|/fams/xuat-danh-sach-hoc-vien|US-01..09|

|SCR-12|Vô hiệu hóa học viên|Student Information|Class Admin|/fams/vo-hieu-hoa-hoc-vien|US-01..09|

|SCR-13|Import điểm|Score Management|Class Admin, Trainer|/fams/import-iem|US-10..14|

|SCR-14|Gradebook theo lớp|Score Management|Class Admin, Trainer|/fams/gradebook-theo-lop|US-10..14|

|SCR-15|Kết quả học tập từng học viên|Score Management|Class Admin, Trainer|/fams/ket-qua-hoc-tap-tung-hoc-vien|US-10..14|

|SCR-16|Cập nhật điểm học viên|Score Management|Class Admin, Trainer|/fams/cap-nhat-iem-hoc-vien|US-10..14|

|SCR-17|Cập nhật trạng thái chứng chỉ|Score Management|Class Admin, Trainer theo quyền|/fams/cap-nhat-trang-thai-chung-chi|US-10..14|

|SCR-18|Danh sách học viên bảo lưu|Reservation|Class Admin; Trainer read-only nếu cấp quyền|/fams/danh-sach-hoc-vien-bao-luu|US-15..21|

|SCR-19|Chi tiết bảo lưu|Reservation|Class Admin|/fams/chi-tiet-bao-luu|US-15..21|

|SCR-20|Tạo/Cập nhật/Kết thúc bảo lưu|Reservation|Class Admin|/fams/tao-cap-nhat-ket-thuc-bao-luu|US-15..21|

|SCR-21|Xếp lớp mới / Drop out sau bảo lưu|Reservation|Class Admin|/fams/xep-lop-moi-drop-out-sau-bao-luu|US-15..21|

|SCR-22|Lịch sử email|Email Inform/Remind|Class Admin; Trainer read-only nếu cấp quyền|/fams/lich-su-email|US-22..26|

|SCR-23|Soạn và gửi email|Email Inform/Remind|Class Admin|/fams/soan-va-gui-email|US-22..26|

|SCR-24|Danh sách mẫu email|Email Inform/Remind|Class Admin|/fams/danh-sach-mau-email|US-22..26|

|SCR-25|Tạo/Sửa mẫu email|Email Inform/Remind|Class Admin|/fams/tao-sua-mau-email|US-22..26|

|SCR-26|Access denied / Not found / Error state|Platform|Tất cả|/fams/access-denied-not-found-error-state|Platform|

|SCR-27|Hồ sơ cá nhân & đổi mật khẩu|Identity|Tất cả user|/fams/ho-so-ca-nhan-oi-mat-khau|Theo module|

|SCR-28|Danh sách người dùng|System|Super Admin|/fams/danh-sach-nguoi-dung|Theo module|

|SCR-29|Tạo/Sửa/Chi tiết người dùng|System|Super Admin|/fams/tao-sua-chi-tiet-nguoi-dung|Theo module|

|SCR-30|Role & Permission Matrix|System|Super Admin|/fams/role-permission-matrix|Theo module|

|SCR-31|Module Group & Module|System|Super Admin|/fams/module-group-module|Theo module|

|SCR-32|Location & Department|System|Super Admin|/fams/location-department|Theo module|

|SCR-33|Skill Group & Skill|Curriculum|Super Admin, Program Manager (read/use)|/fams/skill-group-skill|Theo module|

|SCR-34|Danh sách Topic|Curriculum|Program Manager, Super Admin|/fams/danh-sach-topic|Theo module|

|SCR-35|Topic Overview & Skills|Curriculum|Program Manager|/fams/topic-overview-skills|Theo module|

|SCR-36|Topic Objectives & Assessment Scheme|Curriculum|Program Manager|/fams/topic-objectives-assessment-scheme|Theo module|

|SCR-37|Topic Delivery, Outline & AI Preview|Curriculum|Program Manager|/fams/topic-delivery-outline-ai-preview|Theo module|

|SCR-38|Danh sách Course|Course|Program Manager, Trainer, Trainee read|/fams/danh-sach-course|Theo module|

|SCR-39|Course Overview & Workflow|Course|Program Manager, assigned Trainer|/fams/course-overview-workflow|Theo module|

|SCR-40|Course Scheme & Objectives|Course|Program Manager, assigned Trainer|/fams/course-scheme-objectives|Theo module|

|SCR-41|Course Outline & Materials|Course|Assigned Trainer, Program Manager|/fams/course-outline-materials|Theo module|

|SCR-42|Course Time Allocation|Course|Program Manager, Trainer|/fams/course-time-allocation|Theo module|

|SCR-43|Danh sách Training Program|Program|Super Admin, Program Manager|/fams/danh-sach-training-program|Theo module|

|SCR-44|Tạo/Sửa/Chi tiết Training Program|Program|Super Admin, Program Manager|/fams/tao-sua-chi-tiet-training-program|Theo module|

|SCR-45|Danh sách yêu cầu mở lớp|Demand|Department Manager, Program Manager, Super Admin|/fams/danh-sach-yeu-cau-mo-lop|Theo module|

|SCR-46|Tạo/Sửa yêu cầu mở lớp|Demand|Department Manager|/fams/tao-sua-yeu-cau-mo-lop|Theo module|

|SCR-47|Chi tiết & Review yêu cầu mở lớp|Demand|Department Manager, Program Manager, Super Admin|/fams/chi-tiet-review-yeu-cau-mo-lop|Theo module|

|SCR-48|Danh sách Training Class|Class|Program Manager, Class Admin, Trainer read|/fams/danh-sach-training-class|Theo module|

|SCR-49|Tạo/Sửa Training Class|Class|Program Manager, Class Admin authorized|/fams/tao-sua-training-class|Theo module|

|SCR-50|Class Overview & Resource Assignment|Class|Program Manager, Class Admin, Trainer, Trainee read own|/fams/class-overview-resource-assignment|Theo module|

|SCR-51|Calendar Version & Schedule Editor|Class|Program Manager, Class Admin|/fams/calendar-version-schedule-editor|Theo module|

|SCR-52|Course Assignment theo Topic|Class|Class Admin, Program Manager|/fams/course-assignment-theo-topic|Theo module|

|SCR-53|Attendance Workspace|Class|Trainer, Class Admin|/fams/attendance-workspace|Theo module|

|SCR-54|Assessment Management|Assessment|Super Admin, Program Manager, Trainer|/fams/assessment-management|Theo module|

|SCR-55|Assessment Builder & Security|Assessment|Program Manager, Trainer|/fams/assessment-builder-security|Theo module|

|SCR-56|Assessment Invitation|Assessment|Program Manager, Trainer, Class Admin|/fams/assessment-invitation|Theo module|

|SCR-57|Quiz & Question Bank|Assessment|Program Manager, Trainer|/fams/quiz-question-bank|Theo module|

|SCR-58|Programming Exercise Builder|Assessment|Program Manager, Trainer|/fams/programming-exercise-builder|Theo module|

|SCR-59|Programming Practice Preview|Assessment|Program Manager, Trainer|/fams/programming-practice-preview|Theo module|

|SCR-60|Grading Workspace|Assessment|Trainer authorized|/fams/grading-workspace|Theo module|

|SCR-61|Assessment Results & Statistics|Assessment|Program Manager, Trainer, Class Admin|/fams/assessment-results-statistics|Theo module|

|SCR-62|My Assessments|Learner|Trainee|/fams/my-assessments|Theo module|

|SCR-63|Secure Quiz Attempt|Learner|Trainee|/fams/secure-quiz-attempt|Theo module|

|SCR-64|Secure Coding Attempt|Learner|Trainee|/fams/secure-coding-attempt|Theo module|

|SCR-65|Attempt Complete & Result History|Learner|Trainee|/fams/attempt-complete-result-history|Theo module|

|SCR-66|Course Catalog|Learner|Trainee|/fams/course-catalog|Theo module|

|SCR-67|My Courses|Learner|Trainee|/fams/my-courses|Theo module|

|SCR-68|Course Detail & Enrollment|Learner|Trainee|/fams/course-detail-enrollment|Theo module|

|SCR-69|Course Player & Progress|Learner|Trainee|/fams/course-player-progress|Theo module|

|SCR-70|My Classes, Calendar & Attendance|Learner|Trainee|/fams/my-classes-calendar-attendance|Theo module|

|UI-STD-01|Dashboard|MockProject Hub|Sinh viên|/student/dashboard|FR-DASH-01..04|

|UI-STD-02|Project Overview|MockProject Hub|Sinh viên|/student/projects/{id}|FR-PRJ-01, FR-LIB-01|

|UI-STD-03|Sprint Board|MockProject Hub|Sinh viên|/student/projects/{id}/board|FR-PRJ-03..04|

|UI-STD-04|Milestone Submission|MockProject Hub|Sinh viên|/student/projects/{id}/milestones/{id}|FR-PRJ-02, FR-PRJ-05..06|

|UI-STD-05|Assessment|MockProject Hub|Sinh viên|/student/assessments/{id}|FR-ASM-01..04|

|UI-STD-06|Feedback|MockProject Hub|Sinh viên|/student/feedback|FR-ASM-05, FR-INT-04|

|UI-STD-07|Portfolio|MockProject Hub|Sinh viên|/student/portfolio|FR-RPT-04..05|

|UI-STD-08|Explore Projects|MockProject Hub|Sinh viên|/student/projects/explore|FR-LIB-01..04|

|UI-STD-09|Team Charter|MockProject Hub|Sinh viên|/student/team/charter|FR-TEAM-03, FR-TEAM-05|

|UI-STD-10|Risks & Decisions|MockProject Hub|Sinh viên|/student/projects/{id}/logs|FR-PRJ-08|

|UI-STD-11|Mock Interview|MockProject Hub|Sinh viên|/student/interviews/{id}|FR-INT-01..05|

|UI-STD-12|Project Calendar|MockProject Hub|Sinh viên|/student/calendar|FR-INT-02, FR-DASH-04|

|UI-MNT-01|Cohort Dashboard|MockProject Hub|Mentor/PM|/mentor/cohorts/{id}|FR-DASH-01..05, FR-RPT-03|

|UI-MNT-02|Teams & Mentors|MockProject Hub|Mentor/PM|/mentor/teams|FR-TEAM-01..04|

|UI-MNT-03|Project Template Builder|MockProject Hub|Mentor/PM|/mentor/templates/{id}|FR-LIB-01..05|

|UI-MNT-04|Grading Queue|MockProject Hub|Mentor/PM|/mentor/grading|FR-ASM-04..06, FR-PRJ-06|

|UI-MNT-05|Learning Analytics|MockProject Hub|Mentor/PM|/mentor/analytics|FR-RPT-01..03|

|UI-ADM-01|Users & Roles|MockProject Hub|School Admin|/admin/users|FR-AUTH-04..05|

|UI-ADM-02|Integrations|MockProject Hub|School Admin|/admin/integrations|FR-ADM-02..03, FR-ADM-05|

|UI-ADM-03|Message Templates|MockProject Hub|School Admin|/admin/message-templates|FR-LIB-05, FR-DASH-04|

|UI-ADM-04|Audit Log|MockProject Hub|School Admin|/admin/audit-log|FR-ADM-04, NFR-AUD-01|

|UI-ADM-05|Tenant Settings|MockProject Hub|School Admin|/admin/settings|FR-ADM-01|

|UI-ACC-01|Sign-in / SSO|MockProject Hub|Tất cả|/auth/sign-in|FR-AUTH-01..02|

|UI-ACC-02|Invitation|MockProject Hub|Tất cả|/invitations/{token}|FR-AUTH-01, FR-TEAM-01|

|UI-ACC-03|Student Onboarding|MockProject Hub|Sinh viên|/onboarding/student|FR-AUTH-03, FR-TEAM-03|

|UI-ACC-04|Notification Center|MockProject Hub|Tất cả|/notifications|FR-DASH-03..04|

|UI-ACC-05|System States|MockProject Hub|Tất cả|Dùng chung|NFR-USA-01, NFR-ACC-01|




# 12. Phụ lục thiết kế màn hình

Phụ lục giữ nguyên toàn bộ thiết kế high-fidelity từ hai SRS nguồn. Các hình là baseline cấu trúc và nghiệp vụ; khi hợp nhất visual design system, team UX/UI có thể chuẩn hóa màu/logo/component nhưng không được làm mất actor, route, trạng thái, validation hoặc traceability đã quy định.


|Tổng số: 70 màn hình FAMS/LMS và 27 màn hình MockProject Hub; mỗi màn hình được trình bày ở một trang ngang độc lập.|

|---|




## SCR-01 - Đăng nhập


|Module: Platform / Authentication|Actor: Tất cả người dùng|Route: /fams/ang-nhap|Trace: Platform|

|---|---|---|---|



Thiết kế tham chiếu triển khai: Xác thực người dùng và điều hướng tới trang phù hợp với vai trò/quyền. Trạng thái bắt buộc: loading, empty, error, success, permission denied; thêm conflict khi có cập nhật đồng thời.


## SCR-02 - Quên mật khẩu


|Module: Platform / Authentication|Actor: Người dùng chưa đăng nhập|Route: /fams/quen-mat-khau|Trace: Platform|

|---|---|---|---|



Thiết kế tham chiếu triển khai: Yêu cầu hệ thống gửi liên kết đặt lại mật khẩu an toàn. Trạng thái bắt buộc: loading, empty, error, success, permission denied; thêm conflict khi có cập nhật đồng thời.


## SCR-03 - Đặt lại mật khẩu


|Module: Platform / Authentication|Actor: Người dùng có reset token|Route: /fams/at-lai-mat-khau|Trace: Platform|

|---|---|---|---|



Thiết kế tham chiếu triển khai: Đặt mật khẩu mới qua token một lần. Trạng thái bắt buộc: loading, empty, error, success, permission denied; thêm conflict khi có cập nhật đồng thời.


## SCR-04 - Dashboard và điều hướng


|Module: Platform|Actor: Class Admin, Trainer|Route: /fams/dashboard-va-ieu-huong|Trace: Platform|

|---|---|---|---|



Thiết kế tham chiếu triển khai: Hiển thị tổng quan, cảnh báo và lối vào nhanh theo quyền. Trạng thái bắt buộc: loading, empty, error, success, permission denied; thêm conflict khi có cập nhật đồng thời.


## SCR-05 - Danh sách toàn bộ học viên


|Module: Student Information|Actor: Class Admin; Trainer read-only nếu được cấp quyền|Route: /fams/danh-sach-toan-bo-hoc-vien|Trace: US-01..09|

|---|---|---|---|



Thiết kế tham chiếu triển khai: Xem, tìm kiếm, lọc, sắp xếp và xử lý học viên. Trạng thái bắt buộc: loading, empty, error, success, permission denied; thêm conflict khi có cập nhật đồng thời.


## SCR-06 - Chi tiết lớp - danh sách học viên


|Module: Student Information|Actor: Class Admin; Trainer theo quyền|Route: /fams/chi-tiet-lop-danh-sach-hoc-vien|Trace: US-01..09|

|---|---|---|---|



Thiết kế tham chiếu triển khai: Quản lý học viên trong ngữ cảnh một lớp cụ thể. Trạng thái bắt buộc: loading, empty, error, success, permission denied; thêm conflict khi có cập nhật đồng thời.


## SCR-07 - Chi tiết học viên


|Module: Student Information|Actor: Class Admin; Trainer read-only theo quyền|Route: /fams/chi-tiet-hoc-vien|Trace: US-01..09|

|---|---|---|---|



Thiết kế tham chiếu triển khai: Cung cấp hồ sơ 360 độ gồm thông tin, học tập, bảo lưu và email. Trạng thái bắt buộc: loading, empty, error, success, permission denied; thêm conflict khi có cập nhật đồng thời.


## SCR-08 - Thêm/Sửa học viên


|Module: Student Information|Actor: Class Admin|Route: /fams/them-sua-hoc-vien|Trace: US-01..09|

|---|---|---|---|



Thiết kế tham chiếu triển khai: Tạo mới hoặc cập nhật thông tin học viên theo business rule. Trạng thái bắt buộc: loading, empty, error, success, permission denied; thêm conflict khi có cập nhật đồng thời.


## SCR-09 - Import danh sách học viên


|Module: Student Information|Actor: Class Admin|Route: /fams/import-danh-sach-hoc-vien|Trace: US-01..09|

|---|---|---|---|



Thiết kế tham chiếu triển khai: Nhập số lượng lớn học viên an toàn, có preview và báo lỗi theo dòng. Trạng thái bắt buộc: loading, empty, error, success, permission denied; thêm conflict khi có cập nhật đồng thời.


## SCR-10 - Thay đổi trạng thái học viên


|Module: Student Information / Reservation|Actor: Class Admin|Route: /fams/thay-oi-trang-thai-hoc-vien|Trace: US-01..09|

|---|---|---|---|



Thiết kế tham chiếu triển khai: Cập nhật trạng thái một hoặc nhiều học viên theo state transition. Trạng thái bắt buộc: loading, empty, error, success, permission denied; thêm conflict khi có cập nhật đồng thời.


## SCR-11 - Xuất danh sách học viên


|Module: Student Information|Actor: Class Admin|Route: /fams/xuat-danh-sach-hoc-vien|Trace: US-01..09|

|---|---|---|---|



Thiết kế tham chiếu triển khai: Xuất dữ liệu theo filter, selection và cột mong muốn. Trạng thái bắt buộc: loading, empty, error, success, permission denied; thêm conflict khi có cập nhật đồng thời.


## SCR-12 - Vô hiệu hóa học viên


|Module: Student Information|Actor: Class Admin|Route: /fams/vo-hieu-hoa-hoc-vien|Trace: US-01..09|

|---|---|---|---|



Thiết kế tham chiếu triển khai: Disable học viên theo rule trước khi lớp bắt đầu/chuyển waiting list. Trạng thái bắt buộc: loading, empty, error, success, permission denied; thêm conflict khi có cập nhật đồng thời.


## SCR-13 - Import điểm


|Module: Score Management|Actor: Class Admin, Trainer|Route: /fams/import-iem|Trace: US-10..14|

|---|---|---|---|



Thiết kế tham chiếu triển khai: Nhập điểm hàng loạt theo lớp/module. Trạng thái bắt buộc: loading, empty, error, success, permission denied; thêm conflict khi có cập nhật đồng thời.


## SCR-14 - Gradebook theo lớp


|Module: Score Management|Actor: Class Admin, Trainer|Route: /fams/gradebook-theo-lop|Trace: US-10..14|

|---|---|---|---|



Thiết kế tham chiếu triển khai: Xem điểm tất cả module, xếp hạng và đánh giá cuối theo lớp. Trạng thái bắt buộc: loading, empty, error, success, permission denied; thêm conflict khi có cập nhật đồng thời.


## SCR-15 - Kết quả học tập từng học viên


|Module: Score Management|Actor: Class Admin, Trainer|Route: /fams/ket-qua-hoc-tap-tung-hoc-vien|Trace: US-10..14|

|---|---|---|---|



Thiết kế tham chiếu triển khai: Xem study record, điểm module, GPA/final result và certificate. Trạng thái bắt buộc: loading, empty, error, success, permission denied; thêm conflict khi có cập nhật đồng thời.


## SCR-16 - Cập nhật điểm học viên


|Module: Score Management|Actor: Class Admin, Trainer|Route: /fams/cap-nhat-iem-hoc-vien|Trace: US-10..14|

|---|---|---|---|



Thiết kế tham chiếu triển khai: Sửa điểm có kiểm soát và audit. Trạng thái bắt buộc: loading, empty, error, success, permission denied; thêm conflict khi có cập nhật đồng thời.


## SCR-17 - Cập nhật trạng thái chứng chỉ


|Module: Score Management|Actor: Class Admin, Trainer theo quyền|Route: /fams/cap-nhat-trang-thai-chung-chi|Trace: US-10..14|

|---|---|---|---|



Thiết kế tham chiếu triển khai: Ghi nhận học viên đủ điều kiện/đã nhận chứng chỉ. Trạng thái bắt buộc: loading, empty, error, success, permission denied; thêm conflict khi có cập nhật đồng thời.


## SCR-18 - Danh sách học viên bảo lưu


|Module: Reservation|Actor: Class Admin; Trainer read-only nếu cấp quyền|Route: /fams/danh-sach-hoc-vien-bao-luu|Trace: US-15..21|

|---|---|---|---|



Thiết kế tham chiếu triển khai: Theo dõi toàn bộ reservation, thời hạn và công việc cần xử lý. Trạng thái bắt buộc: loading, empty, error, success, permission denied; thêm conflict khi có cập nhật đồng thời.


## SCR-19 - Chi tiết bảo lưu


|Module: Reservation|Actor: Class Admin|Route: /fams/chi-tiet-bao-luu|Trace: US-15..21|

|---|---|---|---|



Thiết kế tham chiếu triển khai: Xem đầy đủ reservation, lịch sử email và quyết định xử lý tiếp. Trạng thái bắt buộc: loading, empty, error, success, permission denied; thêm conflict khi có cập nhật đồng thời.


## SCR-20 - Tạo/Cập nhật/Kết thúc bảo lưu


|Module: Reservation|Actor: Class Admin|Route: /fams/tao-cap-nhat-ket-thuc-bao-luu|Trace: US-15..21|

|---|---|---|---|



Thiết kế tham chiếu triển khai: Thiết lập thời gian, lý do và trạng thái reservation theo business rule. Trạng thái bắt buộc: loading, empty, error, success, permission denied; thêm conflict khi có cập nhật đồng thời.


## SCR-21 - Xếp lớp mới / Drop out sau bảo lưu


|Module: Reservation|Actor: Class Admin|Route: /fams/xep-lop-moi-drop-out-sau-bao-luu|Trace: US-15..21|

|---|---|---|---|



Thiết kế tham chiếu triển khai: Đưa học viên trở lại lớp phù hợp hoặc đánh dấu Drop out khi không quay lại. Trạng thái bắt buộc: loading, empty, error, success, permission denied; thêm conflict khi có cập nhật đồng thời.


## SCR-22 - Lịch sử email


|Module: Email Inform/Remind|Actor: Class Admin; Trainer read-only nếu cấp quyền|Route: /fams/lich-su-email|Trace: US-22..26|

|---|---|---|---|



Thiết kế tham chiếu triển khai: Tra cứu email đã gửi và tránh gửi trùng. Trạng thái bắt buộc: loading, empty, error, success, permission denied; thêm conflict khi có cập nhật đồng thời.


## SCR-23 - Soạn và gửi email


|Module: Email Inform/Remind|Actor: Class Admin|Route: /fams/soan-va-gui-email|Trace: US-22..26|

|---|---|---|---|



Thiết kế tham chiếu triển khai: Gửi email cho học viên bảo lưu hoặc trainer theo lớp bằng template. Trạng thái bắt buộc: loading, empty, error, success, permission denied; thêm conflict khi có cập nhật đồng thời.


## SCR-24 - Danh sách mẫu email


|Module: Email Inform/Remind|Actor: Class Admin|Route: /fams/danh-sach-mau-email|Trace: US-22..26|

|---|---|---|---|



Thiết kế tham chiếu triển khai: Xem, tìm kiếm, preview và quản lý mẫu email. Trạng thái bắt buộc: loading, empty, error, success, permission denied; thêm conflict khi có cập nhật đồng thời.


## SCR-25 - Tạo/Sửa mẫu email


|Module: Email Inform/Remind|Actor: Class Admin|Route: /fams/tao-sua-mau-email|Trace: US-22..26|

|---|---|---|---|



Thiết kế tham chiếu triển khai: Tạo template tái sử dụng có biến và preview. Trạng thái bắt buộc: loading, empty, error, success, permission denied; thêm conflict khi có cập nhật đồng thời.


## SCR-26 - Access denied / Not found / Error state


|Module: Platform|Actor: Tất cả|Route: /fams/access-denied-not-found-error-state|Trace: Platform|

|---|---|---|---|



Thiết kế tham chiếu triển khai: Xử lý nhất quán lỗi điều hướng và lỗi hệ thống. Trạng thái bắt buộc: loading, empty, error, success, permission denied; thêm conflict khi có cập nhật đồng thời.


## SCR-27 - Hồ sơ cá nhân & đổi mật khẩu


|Module: Identity|Actor: Tất cả user|Route: /fams/ho-so-ca-nhan-oi-mat-khau|Trace: Theo module|

|---|---|---|---|



Thiết kế tham chiếu triển khai: Xem thông tin tài khoản và tự đổi mật khẩu Trạng thái bắt buộc: loading, empty, error, success, permission denied; thêm conflict khi có cập nhật đồng thời.


## SCR-28 - Danh sách người dùng


|Module: System|Actor: Super Admin|Route: /fams/danh-sach-nguoi-dung|Trace: Theo module|

|---|---|---|---|



Thiết kế tham chiếu triển khai: Tra cứu và quản trị account Trạng thái bắt buộc: loading, empty, error, success, permission denied; thêm conflict khi có cập nhật đồng thời.


## SCR-29 - Tạo/Sửa/Chi tiết người dùng


|Module: System|Actor: Super Admin|Route: /fams/tao-sua-chi-tiet-nguoi-dung|Trace: Theo module|

|---|---|---|---|



Thiết kế tham chiếu triển khai: Quản lý identity, role, department và skill Trạng thái bắt buộc: loading, empty, error, success, permission denied; thêm conflict khi có cập nhật đồng thời.


## SCR-30 - Role & Permission Matrix


|Module: System|Actor: Super Admin|Route: /fams/role-permission-matrix|Trace: Theo module|

|---|---|---|---|



Thiết kế tham chiếu triển khai: Cấu hình RBAC động Trạng thái bắt buộc: loading, empty, error, success, permission denied; thêm conflict khi có cập nhật đồng thời.


## SCR-31 - Module Group & Module


|Module: System|Actor: Super Admin|Route: /fams/module-group-module|Trace: Theo module|

|---|---|---|---|



Thiết kế tham chiếu triển khai: Quản lý menu/function mapping Trạng thái bắt buộc: loading, empty, error, success, permission denied; thêm conflict khi có cập nhật đồng thời.


## SCR-32 - Location & Department


|Module: System|Actor: Super Admin|Route: /fams/location-department|Trace: Theo module|

|---|---|---|---|



Thiết kế tham chiếu triển khai: Quản lý cơ cấu địa điểm và đơn vị Trạng thái bắt buộc: loading, empty, error, success, permission denied; thêm conflict khi có cập nhật đồng thời.


## SCR-33 - Skill Group & Skill


|Module: Curriculum|Actor: Super Admin, Program Manager (read/use)|Route: /fams/skill-group-skill|Trace: Theo module|

|---|---|---|---|



Thiết kế tham chiếu triển khai: Duy trì taxonomy năng lực Trạng thái bắt buộc: loading, empty, error, success, permission denied; thêm conflict khi có cập nhật đồng thời.


## SCR-34 - Danh sách Topic


|Module: Curriculum|Actor: Program Manager, Super Admin|Route: /fams/danh-sach-topic|Trace: Theo module|

|---|---|---|---|



Thiết kế tham chiếu triển khai: Tra cứu và quản lý topic/version Trạng thái bắt buộc: loading, empty, error, success, permission denied; thêm conflict khi có cập nhật đồng thời.


## SCR-35 - Topic Overview & Skills


|Module: Curriculum|Actor: Program Manager|Route: /fams/topic-overview-skills|Trace: Theo module|

|---|---|---|---|



Thiết kế tham chiếu triển khai: Cấu hình thông tin và skill của topic Trạng thái bắt buộc: loading, empty, error, success, permission denied; thêm conflict khi có cập nhật đồng thời.


## SCR-36 - Topic Objectives & Assessment Scheme


|Module: Curriculum|Actor: Program Manager|Route: /fams/topic-objectives-assessment-scheme|Trace: Theo module|

|---|---|---|---|



Thiết kế tham chiếu triển khai: Định nghĩa outcome và cách đánh giá Trạng thái bắt buộc: loading, empty, error, success, permission denied; thêm conflict khi có cập nhật đồng thời.


## SCR-37 - Topic Delivery, Outline & AI Preview


|Module: Curriculum|Actor: Program Manager|Route: /fams/topic-delivery-outline-ai-preview|Trace: Theo module|

|---|---|---|---|



Thiết kế tham chiếu triển khai: Thiết kế delivery và lesson sequence Trạng thái bắt buộc: loading, empty, error, success, permission denied; thêm conflict khi có cập nhật đồng thời.


## SCR-38 - Danh sách Course


|Module: Course|Actor: Program Manager, Trainer, Trainee read|Route: /fams/danh-sach-course|Trace: Theo module|

|---|---|---|---|



Thiết kế tham chiếu triển khai: Quản lý và khám phá course Trạng thái bắt buộc: loading, empty, error, success, permission denied; thêm conflict khi có cập nhật đồng thời.


## SCR-39 - Course Overview & Workflow


|Module: Course|Actor: Program Manager, assigned Trainer|Route: /fams/course-overview-workflow|Trace: Theo module|

|---|---|---|---|



Thiết kế tham chiếu triển khai: Quản lý metadata và approval Trạng thái bắt buộc: loading, empty, error, success, permission denied; thêm conflict khi có cập nhật đồng thời.


## SCR-40 - Course Scheme & Objectives


|Module: Course|Actor: Program Manager, assigned Trainer|Route: /fams/course-scheme-objectives|Trace: Theo module|

|---|---|---|---|



Thiết kế tham chiếu triển khai: Đặc tả chuẩn pass và objective Trạng thái bắt buộc: loading, empty, error, success, permission denied; thêm conflict khi có cập nhật đồng thời.


## SCR-41 - Course Outline & Materials


|Module: Course|Actor: Assigned Trainer, Program Manager|Route: /fams/course-outline-materials|Trace: Theo module|

|---|---|---|---|



Thiết kế tham chiếu triển khai: Soạn lesson/session và tài liệu Trạng thái bắt buộc: loading, empty, error, success, permission denied; thêm conflict khi có cập nhật đồng thời.


## SCR-42 - Course Time Allocation


|Module: Course|Actor: Program Manager, Trainer|Route: /fams/course-time-allocation|Trace: Theo module|

|---|---|---|---|



Thiết kế tham chiếu triển khai: Kiểm tra phân bổ hoạt động Trạng thái bắt buộc: loading, empty, error, success, permission denied; thêm conflict khi có cập nhật đồng thời.


## SCR-43 - Danh sách Training Program


|Module: Program|Actor: Super Admin, Program Manager|Route: /fams/danh-sach-training-program|Trace: Theo module|

|---|---|---|---|



Thiết kế tham chiếu triển khai: Quản lý program/version Trạng thái bắt buộc: loading, empty, error, success, permission denied; thêm conflict khi có cập nhật đồng thời.


## SCR-44 - Tạo/Sửa/Chi tiết Training Program


|Module: Program|Actor: Super Admin, Program Manager|Route: /fams/tao-sua-chi-tiet-training-program|Trace: Theo module|

|---|---|---|---|



Thiết kế tham chiếu triển khai: Gom topic thành curriculum có version Trạng thái bắt buộc: loading, empty, error, success, permission denied; thêm conflict khi có cập nhật đồng thời.


## SCR-45 - Danh sách yêu cầu mở lớp


|Module: Demand|Actor: Department Manager, Program Manager, Super Admin|Route: /fams/danh-sach-yeu-cau-mo-lop|Trace: Theo module|

|---|---|---|---|



Thiết kế tham chiếu triển khai: Theo dõi yêu cầu đào tạo Trạng thái bắt buộc: loading, empty, error, success, permission denied; thêm conflict khi có cập nhật đồng thời.


## SCR-46 - Tạo/Sửa yêu cầu mở lớp


|Module: Demand|Actor: Department Manager|Route: /fams/tao-sua-yeu-cau-mo-lop|Trace: Theo module|

|---|---|---|---|



Thiết kế tham chiếu triển khai: Ghi nhận nhu cầu đào tạo Trạng thái bắt buộc: loading, empty, error, success, permission denied; thêm conflict khi có cập nhật đồng thời.


## SCR-47 - Chi tiết & Review yêu cầu mở lớp


|Module: Demand|Actor: Department Manager, Program Manager, Super Admin|Route: /fams/chi-tiet-review-yeu-cau-mo-lop|Trace: Theo module|

|---|---|---|---|



Thiết kế tham chiếu triển khai: Review và quyết định yêu cầu Trạng thái bắt buộc: loading, empty, error, success, permission denied; thêm conflict khi có cập nhật đồng thời.


## SCR-48 - Danh sách Training Class


|Module: Class|Actor: Program Manager, Class Admin, Trainer read|Route: /fams/danh-sach-training-class|Trace: Theo module|

|---|---|---|---|



Thiết kế tham chiếu triển khai: Quản lý toàn bộ lớp Trạng thái bắt buộc: loading, empty, error, success, permission denied; thêm conflict khi có cập nhật đồng thời.


## SCR-49 - Tạo/Sửa Training Class


|Module: Class|Actor: Program Manager, Class Admin authorized|Route: /fams/tao-sua-training-class|Trace: Theo module|

|---|---|---|---|



Thiết kế tham chiếu triển khai: Thiết lập lớp và nguồn lực Trạng thái bắt buộc: loading, empty, error, success, permission denied; thêm conflict khi có cập nhật đồng thời.


## SCR-50 - Class Overview & Resource Assignment


|Module: Class|Actor: Program Manager, Class Admin, Trainer, Trainee read own|Route: /fams/class-overview-resource-assignment|Trace: Theo module|

|---|---|---|---|



Thiết kế tham chiếu triển khai: Xem trạng thái và assignment Trạng thái bắt buộc: loading, empty, error, success, permission denied; thêm conflict khi có cập nhật đồng thời.


## SCR-51 - Calendar Version & Schedule Editor


|Module: Class|Actor: Program Manager, Class Admin|Route: /fams/calendar-version-schedule-editor|Trace: Theo module|

|---|---|---|---|



Thiết kế tham chiếu triển khai: Quản lý lịch có version Trạng thái bắt buộc: loading, empty, error, success, permission denied; thêm conflict khi có cập nhật đồng thời.


## SCR-52 - Course Assignment theo Topic


|Module: Class|Actor: Class Admin, Program Manager|Route: /fams/course-assignment-theo-topic|Trace: Theo module|

|---|---|---|---|



Thiết kế tham chiếu triển khai: Gán active course cho class topic Trạng thái bắt buộc: loading, empty, error, success, permission denied; thêm conflict khi có cập nhật đồng thời.


## SCR-53 - Attendance Workspace


|Module: Class|Actor: Trainer, Class Admin|Route: /fams/attendance-workspace|Trace: Theo module|

|---|---|---|---|



Thiết kế tham chiếu triển khai: Điểm danh theo session/ngày Trạng thái bắt buộc: loading, empty, error, success, permission denied; thêm conflict khi có cập nhật đồng thời.


## SCR-54 - Assessment Management


|Module: Assessment|Actor: Super Admin, Program Manager, Trainer|Route: /fams/assessment-management|Trace: Theo module|

|---|---|---|---|



Thiết kế tham chiếu triển khai: Quản lý assessment catalog Trạng thái bắt buộc: loading, empty, error, success, permission denied; thêm conflict khi có cập nhật đồng thời.


## SCR-55 - Assessment Builder & Security


|Module: Assessment|Actor: Program Manager, Trainer|Route: /fams/assessment-builder-security|Trace: Theo module|

|---|---|---|---|



Thiết kế tham chiếu triển khai: Cấu hình assessment end-to-end Trạng thái bắt buộc: loading, empty, error, success, permission denied; thêm conflict khi có cập nhật đồng thời.


## SCR-56 - Assessment Invitation


|Module: Assessment|Actor: Program Manager, Trainer, Class Admin|Route: /fams/assessment-invitation|Trace: Theo module|

|---|---|---|---|



Thiết kế tham chiếu triển khai: Quản lý candidate access Trạng thái bắt buộc: loading, empty, error, success, permission denied; thêm conflict khi có cập nhật đồng thời.


## SCR-57 - Quiz & Question Bank


|Module: Assessment|Actor: Program Manager, Trainer|Route: /fams/quiz-question-bank|Trace: Theo module|

|---|---|---|---|



Thiết kế tham chiếu triển khai: Xây quiz và ngân hàng câu hỏi Trạng thái bắt buộc: loading, empty, error, success, permission denied; thêm conflict khi có cập nhật đồng thời.


## SCR-58 - Programming Exercise Builder


|Module: Assessment|Actor: Program Manager, Trainer|Route: /fams/programming-exercise-builder|Trace: Theo module|

|---|---|---|---|



Thiết kế tham chiếu triển khai: Tạo coding challenge có test cases Trạng thái bắt buộc: loading, empty, error, success, permission denied; thêm conflict khi có cập nhật đồng thời.


## SCR-59 - Programming Practice Preview


|Module: Assessment|Actor: Program Manager, Trainer|Route: /fams/programming-practice-preview|Trace: Theo module|

|---|---|---|---|



Thiết kế tham chiếu triển khai: Preview exercise như trainee Trạng thái bắt buộc: loading, empty, error, success, permission denied; thêm conflict khi có cập nhật đồng thời.


## SCR-60 - Grading Workspace


|Module: Assessment|Actor: Trainer authorized|Route: /fams/grading-workspace|Trace: Theo module|

|---|---|---|---|



Thiết kế tham chiếu triển khai: Chấm submission và finalize Trạng thái bắt buộc: loading, empty, error, success, permission denied; thêm conflict khi có cập nhật đồng thời.


## SCR-61 - Assessment Results & Statistics


|Module: Assessment|Actor: Program Manager, Trainer, Class Admin|Route: /fams/assessment-results-statistics|Trace: Theo module|

|---|---|---|---|



Thiết kế tham chiếu triển khai: Theo dõi attempts và kết quả Trạng thái bắt buộc: loading, empty, error, success, permission denied; thêm conflict khi có cập nhật đồng thời.


## SCR-62 - My Assessments


|Module: Learner|Actor: Trainee|Route: /fams/my-assessments|Trace: Theo module|

|---|---|---|---|



Thiết kế tham chiếu triển khai: Xem bài được giao và trạng thái Trạng thái bắt buộc: loading, empty, error, success, permission denied; thêm conflict khi có cập nhật đồng thời.


## SCR-63 - Secure Quiz Attempt


|Module: Learner|Actor: Trainee|Route: /fams/secure-quiz-attempt|Trace: Theo module|

|---|---|---|---|



Thiết kế tham chiếu triển khai: Làm quiz an toàn Trạng thái bắt buộc: loading, empty, error, success, permission denied; thêm conflict khi có cập nhật đồng thời.


## SCR-64 - Secure Coding Attempt


|Module: Learner|Actor: Trainee|Route: /fams/secure-coding-attempt|Trace: Theo module|

|---|---|---|---|



Thiết kế tham chiếu triển khai: Làm coding section Trạng thái bắt buộc: loading, empty, error, success, permission denied; thêm conflict khi có cập nhật đồng thời.


## SCR-65 - Attempt Complete & Result History


|Module: Learner|Actor: Trainee|Route: /fams/attempt-complete-result-history|Trace: Theo module|

|---|---|---|---|



Thiết kế tham chiếu triển khai: Xem xác nhận và lịch sử attempt Trạng thái bắt buộc: loading, empty, error, success, permission denied; thêm conflict khi có cập nhật đồng thời.


## SCR-66 - Course Catalog


|Module: Learner|Actor: Trainee|Route: /fams/course-catalog|Trace: Theo module|

|---|---|---|---|



Thiết kế tham chiếu triển khai: Khám phá course có thể học Trạng thái bắt buộc: loading, empty, error, success, permission denied; thêm conflict khi có cập nhật đồng thời.


## SCR-67 - My Courses


|Module: Learner|Actor: Trainee|Route: /fams/my-courses|Trace: Theo module|

|---|---|---|---|



Thiết kế tham chiếu triển khai: Theo dõi course đã enroll Trạng thái bắt buộc: loading, empty, error, success, permission denied; thêm conflict khi có cập nhật đồng thời.


## SCR-68 - Course Detail & Enrollment


|Module: Learner|Actor: Trainee|Route: /fams/course-detail-enrollment|Trace: Theo module|

|---|---|---|---|



Thiết kế tham chiếu triển khai: Đánh giá course trước và sau enroll Trạng thái bắt buộc: loading, empty, error, success, permission denied; thêm conflict khi có cập nhật đồng thời.


## SCR-69 - Course Player & Progress


|Module: Learner|Actor: Trainee|Route: /fams/course-player-progress|Trace: Theo module|

|---|---|---|---|



Thiết kế tham chiếu triển khai: Học video/document/link theo session Trạng thái bắt buộc: loading, empty, error, success, permission denied; thêm conflict khi có cập nhật đồng thời.


## SCR-70 - My Classes, Calendar & Attendance


|Module: Learner|Actor: Trainee|Route: /fams/my-classes-calendar-attendance|Trace: Theo module|

|---|---|---|---|



Thiết kế tham chiếu triển khai: Xem lớp, lịch, điểm và chuyên cần cá nhân Trạng thái bắt buộc: loading, empty, error, success, permission denied; thêm conflict khi có cập nhật đồng thời.


## UI-STD-01 - Dashboard


|Module: MockProject Hub|Actor: Sinh viên|Route: /student/dashboard|Trace: FR-DASH-01..04|

|---|---|---|---|



Thiết kế tham chiếu triển khai: Cung cấp màn hình Dashboard đúng vai trò, trạng thái và yêu cầu được truy vết. Trạng thái bắt buộc: loading, empty, error, success, permission denied; thêm conflict khi có cập nhật đồng thời.


## UI-STD-02 - Project Overview


|Module: MockProject Hub|Actor: Sinh viên|Route: /student/projects/{id}|Trace: FR-PRJ-01, FR-LIB-01|

|---|---|---|---|



Thiết kế tham chiếu triển khai: Cung cấp màn hình Project Overview đúng vai trò, trạng thái và yêu cầu được truy vết. Trạng thái bắt buộc: loading, empty, error, success, permission denied; thêm conflict khi có cập nhật đồng thời.


## UI-STD-03 - Sprint Board


|Module: MockProject Hub|Actor: Sinh viên|Route: /student/projects/{id}/board|Trace: FR-PRJ-03..04|

|---|---|---|---|



Thiết kế tham chiếu triển khai: Cung cấp màn hình Sprint Board đúng vai trò, trạng thái và yêu cầu được truy vết. Trạng thái bắt buộc: loading, empty, error, success, permission denied; thêm conflict khi có cập nhật đồng thời.


## UI-STD-04 - Milestone Submission


|Module: MockProject Hub|Actor: Sinh viên|Route: /student/projects/{id}/milestones/{id}|Trace: FR-PRJ-02, FR-PRJ-05..06|

|---|---|---|---|



Thiết kế tham chiếu triển khai: Cung cấp màn hình Milestone Submission đúng vai trò, trạng thái và yêu cầu được truy vết. Trạng thái bắt buộc: loading, empty, error, success, permission denied; thêm conflict khi có cập nhật đồng thời.


## UI-STD-05 - Assessment


|Module: MockProject Hub|Actor: Sinh viên|Route: /student/assessments/{id}|Trace: FR-ASM-01..04|

|---|---|---|---|



Thiết kế tham chiếu triển khai: Cung cấp màn hình Assessment đúng vai trò, trạng thái và yêu cầu được truy vết. Trạng thái bắt buộc: loading, empty, error, success, permission denied; thêm conflict khi có cập nhật đồng thời.


## UI-STD-06 - Feedback


|Module: MockProject Hub|Actor: Sinh viên|Route: /student/feedback|Trace: FR-ASM-05, FR-INT-04|

|---|---|---|---|



Thiết kế tham chiếu triển khai: Cung cấp màn hình Feedback đúng vai trò, trạng thái và yêu cầu được truy vết. Trạng thái bắt buộc: loading, empty, error, success, permission denied; thêm conflict khi có cập nhật đồng thời.


## UI-STD-07 - Portfolio


|Module: MockProject Hub|Actor: Sinh viên|Route: /student/portfolio|Trace: FR-RPT-04..05|

|---|---|---|---|



Thiết kế tham chiếu triển khai: Cung cấp màn hình Portfolio đúng vai trò, trạng thái và yêu cầu được truy vết. Trạng thái bắt buộc: loading, empty, error, success, permission denied; thêm conflict khi có cập nhật đồng thời.


## UI-STD-08 - Explore Projects


|Module: MockProject Hub|Actor: Sinh viên|Route: /student/projects/explore|Trace: FR-LIB-01..04|

|---|---|---|---|



Thiết kế tham chiếu triển khai: Cung cấp màn hình Explore Projects đúng vai trò, trạng thái và yêu cầu được truy vết. Trạng thái bắt buộc: loading, empty, error, success, permission denied; thêm conflict khi có cập nhật đồng thời.


## UI-STD-09 - Team Charter


|Module: MockProject Hub|Actor: Sinh viên|Route: /student/team/charter|Trace: FR-TEAM-03, FR-TEAM-05|

|---|---|---|---|



Thiết kế tham chiếu triển khai: Cung cấp màn hình Team Charter đúng vai trò, trạng thái và yêu cầu được truy vết. Trạng thái bắt buộc: loading, empty, error, success, permission denied; thêm conflict khi có cập nhật đồng thời.


## UI-STD-10 - Risks & Decisions


|Module: MockProject Hub|Actor: Sinh viên|Route: /student/projects/{id}/logs|Trace: FR-PRJ-08|

|---|---|---|---|



Thiết kế tham chiếu triển khai: Cung cấp màn hình Risks & Decisions đúng vai trò, trạng thái và yêu cầu được truy vết. Trạng thái bắt buộc: loading, empty, error, success, permission denied; thêm conflict khi có cập nhật đồng thời.


## UI-STD-11 - Mock Interview


|Module: MockProject Hub|Actor: Sinh viên|Route: /student/interviews/{id}|Trace: FR-INT-01..05|

|---|---|---|---|



Thiết kế tham chiếu triển khai: Cung cấp màn hình Mock Interview đúng vai trò, trạng thái và yêu cầu được truy vết. Trạng thái bắt buộc: loading, empty, error, success, permission denied; thêm conflict khi có cập nhật đồng thời.


## UI-STD-12 - Project Calendar


|Module: MockProject Hub|Actor: Sinh viên|Route: /student/calendar|Trace: FR-INT-02, FR-DASH-04|

|---|---|---|---|



Thiết kế tham chiếu triển khai: Cung cấp màn hình Project Calendar đúng vai trò, trạng thái và yêu cầu được truy vết. Trạng thái bắt buộc: loading, empty, error, success, permission denied; thêm conflict khi có cập nhật đồng thời.


## UI-MNT-01 - Cohort Dashboard


|Module: MockProject Hub|Actor: Mentor/PM|Route: /mentor/cohorts/{id}|Trace: FR-DASH-01..05, FR-RPT-03|

|---|---|---|---|



Thiết kế tham chiếu triển khai: Cung cấp màn hình Cohort Dashboard đúng vai trò, trạng thái và yêu cầu được truy vết. Trạng thái bắt buộc: loading, empty, error, success, permission denied; thêm conflict khi có cập nhật đồng thời.


## UI-MNT-02 - Teams & Mentors


|Module: MockProject Hub|Actor: Mentor/PM|Route: /mentor/teams|Trace: FR-TEAM-01..04|

|---|---|---|---|



Thiết kế tham chiếu triển khai: Cung cấp màn hình Teams & Mentors đúng vai trò, trạng thái và yêu cầu được truy vết. Trạng thái bắt buộc: loading, empty, error, success, permission denied; thêm conflict khi có cập nhật đồng thời.


## UI-MNT-03 - Project Template Builder


|Module: MockProject Hub|Actor: Mentor/PM|Route: /mentor/templates/{id}|Trace: FR-LIB-01..05|

|---|---|---|---|



Thiết kế tham chiếu triển khai: Cung cấp màn hình Project Template Builder đúng vai trò, trạng thái và yêu cầu được truy vết. Trạng thái bắt buộc: loading, empty, error, success, permission denied; thêm conflict khi có cập nhật đồng thời.


## UI-MNT-04 - Grading Queue


|Module: MockProject Hub|Actor: Mentor/PM|Route: /mentor/grading|Trace: FR-ASM-04..06, FR-PRJ-06|

|---|---|---|---|



Thiết kế tham chiếu triển khai: Cung cấp màn hình Grading Queue đúng vai trò, trạng thái và yêu cầu được truy vết. Trạng thái bắt buộc: loading, empty, error, success, permission denied; thêm conflict khi có cập nhật đồng thời.


## UI-MNT-05 - Learning Analytics


|Module: MockProject Hub|Actor: Mentor/PM|Route: /mentor/analytics|Trace: FR-RPT-01..03|

|---|---|---|---|



Thiết kế tham chiếu triển khai: Cung cấp màn hình Learning Analytics đúng vai trò, trạng thái và yêu cầu được truy vết. Trạng thái bắt buộc: loading, empty, error, success, permission denied; thêm conflict khi có cập nhật đồng thời.


## UI-ADM-01 - Users & Roles


|Module: MockProject Hub|Actor: School Admin|Route: /admin/users|Trace: FR-AUTH-04..05|

|---|---|---|---|



Thiết kế tham chiếu triển khai: Cung cấp màn hình Users & Roles đúng vai trò, trạng thái và yêu cầu được truy vết. Trạng thái bắt buộc: loading, empty, error, success, permission denied; thêm conflict khi có cập nhật đồng thời.


## UI-ADM-02 - Integrations


|Module: MockProject Hub|Actor: School Admin|Route: /admin/integrations|Trace: FR-ADM-02..03, FR-ADM-05|

|---|---|---|---|



Thiết kế tham chiếu triển khai: Cung cấp màn hình Integrations đúng vai trò, trạng thái và yêu cầu được truy vết. Trạng thái bắt buộc: loading, empty, error, success, permission denied; thêm conflict khi có cập nhật đồng thời.


## UI-ADM-03 - Message Templates


|Module: MockProject Hub|Actor: School Admin|Route: /admin/message-templates|Trace: FR-LIB-05, FR-DASH-04|

|---|---|---|---|



Thiết kế tham chiếu triển khai: Cung cấp màn hình Message Templates đúng vai trò, trạng thái và yêu cầu được truy vết. Trạng thái bắt buộc: loading, empty, error, success, permission denied; thêm conflict khi có cập nhật đồng thời.


## UI-ADM-04 - Audit Log


|Module: MockProject Hub|Actor: School Admin|Route: /admin/audit-log|Trace: FR-ADM-04, NFR-AUD-01|

|---|---|---|---|



Thiết kế tham chiếu triển khai: Cung cấp màn hình Audit Log đúng vai trò, trạng thái và yêu cầu được truy vết. Trạng thái bắt buộc: loading, empty, error, success, permission denied; thêm conflict khi có cập nhật đồng thời.


## UI-ADM-05 - Tenant Settings


|Module: MockProject Hub|Actor: School Admin|Route: /admin/settings|Trace: FR-ADM-01|

|---|---|---|---|



Thiết kế tham chiếu triển khai: Cung cấp màn hình Tenant Settings đúng vai trò, trạng thái và yêu cầu được truy vết. Trạng thái bắt buộc: loading, empty, error, success, permission denied; thêm conflict khi có cập nhật đồng thời.


## UI-ACC-01 - Sign-in / SSO


|Module: MockProject Hub|Actor: Tất cả|Route: /auth/sign-in|Trace: FR-AUTH-01..02|

|---|---|---|---|



Thiết kế tham chiếu triển khai: Cung cấp màn hình Sign-in / SSO đúng vai trò, trạng thái và yêu cầu được truy vết. Trạng thái bắt buộc: loading, empty, error, success, permission denied; thêm conflict khi có cập nhật đồng thời.


## UI-ACC-02 - Invitation


|Module: MockProject Hub|Actor: Tất cả|Route: /invitations/{token}|Trace: FR-AUTH-01, FR-TEAM-01|

|---|---|---|---|



Thiết kế tham chiếu triển khai: Cung cấp màn hình Invitation đúng vai trò, trạng thái và yêu cầu được truy vết. Trạng thái bắt buộc: loading, empty, error, success, permission denied; thêm conflict khi có cập nhật đồng thời.


## UI-ACC-03 - Student Onboarding


|Module: MockProject Hub|Actor: Sinh viên|Route: /onboarding/student|Trace: FR-AUTH-03, FR-TEAM-03|

|---|---|---|---|



Thiết kế tham chiếu triển khai: Cung cấp màn hình Student Onboarding đúng vai trò, trạng thái và yêu cầu được truy vết. Trạng thái bắt buộc: loading, empty, error, success, permission denied; thêm conflict khi có cập nhật đồng thời.


## UI-ACC-04 - Notification Center


|Module: MockProject Hub|Actor: Tất cả|Route: /notifications|Trace: FR-DASH-03..04|

|---|---|---|---|



Thiết kế tham chiếu triển khai: Cung cấp màn hình Notification Center đúng vai trò, trạng thái và yêu cầu được truy vết. Trạng thái bắt buộc: loading, empty, error, success, permission denied; thêm conflict khi có cập nhật đồng thời.


## UI-ACC-05 - System States


|Module: MockProject Hub|Actor: Tất cả|Route: Dùng chung|Trace: NFR-USA-01, NFR-ACC-01|

|---|---|---|---|



Thiết kế tham chiếu triển khai: Cung cấp màn hình System States đúng vai trò, trạng thái và yêu cầu được truy vết. Trạng thái bắt buộc: loading, empty, error, success, permission denied; thêm conflict khi có cập nhật đồng thời.


# 13. Truy vết và quản trị thay đổi


|Artifact|Quy ước|Chủ sở hữu|

|---|---|---|

|Requirement|UFR-<nhóm>-<số>; có priority, source và screen refs|BA/Product|

|Business rule|BR-UNI-xx; được tham chiếu trong domain service và test|BA/Architect|

|Screen|SCR-xx hoặc UI-<role>-xx; gắn route, actor và UFR/FR|UX/UI + Frontend|

|API|OpenAPI operationId gắn UFR trong description/tag|Backend/Architect|

|Test|TC-<UFR>-<nn>; evidence chứa build/version/data set|QA/UAT|

|Change request|CR-xxxx; impact tới UFR, screen, API, data, test và migration|Change Control Board|




## 13.1 Ma trận truy vết cấp nhóm


|Nhóm|Dải UFR|Màn hình|Quy tắc chính|

|---|---|---|---|

|SYS|UFR-SYS-001..015|SCR-01..04, SCR-27..33; UI-ADM-01..05, UI-ACC-01..05|Deny-by-default; kiểm tra quyền ở UI và API; dữ liệu tách theo tenant; hành động quản trị phải audit.|

|CUR|UFR-CUR-001..011|SCR-34..47; UI-STD-08, UI-MNT-03|Nội dung dùng version; bản ACTIVE đang được lớp sử dụng không sửa trực tiếp; publish cần review/approve.|

|PEO|UFR-PEO-001..016|SCR-05..12, SCR-48..53; UI-STD-09, UI-STD-12, UI-MNT-01..02|Mã học viên/lớp là duy nhất theo tenant; cập nhật roster phải kiểm tra lớp, thời gian, sức chứa và optimistic locking.|

|RES|UFR-RES-001..007|SCR-18..21|Chuyển trạng thái theo state machine; không chồng khoảng bảo lưu; kết thúc phải chọn hướng xử lý hợp lệ.|

|PRJ|UFR-PRJ-001..010|UI-STD-02..04, UI-STD-09..10, UI-MNT-02..03|Milestone có deadline/rubric/late policy; submission bất biến theo version; trạng thái project và task theo workflow.|

|LRN|UFR-LRN-001..009|SCR-66..70; UI-STD-01, UI-STD-07|Tiến độ được tính từ material/session/assessment bắt buộc; completion và certificate chỉ phát khi đủ điều kiện.|

|EXM|UFR-EXM-001..013|SCR-54..65; UI-STD-05, UI-MNT-04|Attempt tuân thủ time window, attempt limit và autosave; bài coding chạy trong sandbox; kết quả chỉ hiện theo release policy.|

|INT|UFR-INT-001..004|UI-STD-11, UI-STD-12|Interviewer chỉ truy cập phiên được phân công; scorecard khóa sau submit; feedback riêng không lộ cho học viên.|

|SCO|UFR-SCO-001..009|SCR-13..17, SCR-60..61; UI-STD-06..07, UI-MNT-04..05|Điểm dùng formula/rubric version; thay đổi điểm đã công bố phải qua adjustment có lý do, người duyệt và audit.|

|COM|UFR-COM-001..007|SCR-22..25; UI-ADM-03, UI-ACC-04|Gửi email/notification là idempotent; có cooldown chống trùng; không log credential hoặc nội dung nhạy cảm ngoài chính sách.|

|RPT|UFR-RPT-001..007|SCR-04, SCR-61; UI-STD-01, UI-MNT-01, UI-MNT-05, UI-ADM-04|Số liệu phải khớp nguồn giao dịch, tôn trọng data scope; export chạy nền với file có thời hạn và audit tải xuống.|




# 14. Quyết định cần Product Owner xác nhận


|ID|Quyết định cần chốt|

|---|---|

|OD-01|Công thức final/GPA/rank/pass-fail, hệ số nhóm-cá nhân và quy trình phúc khảo/điều chỉnh.|

|OD-02|Quyền mặc định của Trainer tại Student/Reservation/Email: không truy cập hay chỉ đọc.|

|OD-03|Chính sách import: all-or-nothing hay partial; duplicate update/skip/reject; giới hạn file.|

|OD-04|Thời hạn reservation, lịch reminder và duplicate cooldown.|

|OD-05|SSO/Git/LMS/mail provider bắt buộc, SLA và chiến lược xử lý lỗi tích hợp.|

|OD-06|Retention, vị trí lưu dữ liệu, quyền xem portfolio và yêu cầu pháp lý của từng tenant.|

|OD-07|Ngưỡng hoàn thành video/material, course completion và điều kiện cấp chứng nhận.|

|OD-08|Danh sách field chính thức và data scope theo campus/department/program/class/project.|




## 14.1 Điều kiện đóng baseline

PO chốt OD-01..OD-08 và đánh dấu Must/Should/Could/Won't theo release mục tiêu.

Security/Architecture duyệt tenant isolation, permission matrix, data retention và integration contract.

UX/UI duyệt mapping 97 màn hình sang design system hợp nhất và xác nhận responsive/accessibility.

QA duyệt traceability UFR-screen-API-test và UAT data set; Business Owner ký biên bản nghiệm thu baseline.


|Lưu ý triển khai: Các giá trị chưa được nguồn chốt (SLA, retention, file limit, score formula, provider bắt buộc) phải được cấu hình hoặc ghi rõ TBD có owner/deadline; không hard-code ngầm trong code.|

|---|


