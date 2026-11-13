# US-RPT-001 — Project Dashboard

## Quy tắc được chốt ngày 07/11/2026

- Bỏ phần trăm tiến độ trung bình, tỷ lệ hoàn thành và phần trăm milestone khỏi Reports.
- Một biểu đồ tổng quan chỉ thống kê trạng thái Master Project.
- Sub-project nằm trong bảng chi tiết của Master.
- Backlog của Master bằng backlog trực tiếp trên Master cộng backlog của toàn bộ Project con trong phạm vi người xem. Hiển thị số lượng Todo, In progress, Review, Done và trạng thái khác nếu có.

## Master và Sub-project

Master là Project gốc thực tế; các Sub-project nối bằng Project.parentProject. Khóa nhóm là ID Project gốc. Hai Project cùng lớp, template hoặc phiên bản vẫn là hai Master nếu không có quan hệ cha–con.

Đọc phân công từ Project.teamId, ProjectTeam.project và TeamSubprojectAssignment. WHOLE có thể gán Master và nhiều module cho cùng một team: team được đếm một lần. SPLIT có thể gán từng module cho các team khác nhau, cùng một Master dùng chung. Project độc lập là một Master có 0 Sub-project.

Chỉ lấy Project được phân công cho team trong scope, cộng các Project cha để định vị cây. Không mở rộng sang module của team ngoài scope. Project cha thuộc team khác chỉ cung cấp ngữ cảnh; backlog/milestone của nó không được đưa vào tổng. Master dùng chung của assignment SPLIT được đọc cùng module được giao.

Template/phiên bản là nguồn đề bài, không phải Master và không có trạng thái triển khai. Snapshot sao chép khi giao đề bài được truy về phiên bản nguồn. Metadata template/snapshot được kiểm tra tenant.

## Trạng thái và backlog

Reports đọc trực tiếp Project.status: DRAFT, PLANNING, ACTIVE, COMPLETED, CANCELLED. Biểu đồ đếm mỗi Master trong kết quả một lần theo trạng thái thực tế của Master; trạng thái từng Sub-project nằm ở bảng chi tiết.

Milestone có lifecycle riêng: PLANNED, IN_PROGRESS, SUBMITTED, CHANGES_REQUESTED, ACCEPTED, REJECTED. Milestone ERD có thể được nộp/chấp nhận khi không có backlog. Reports hiển thị 0 backlog và lifecycle milestone, không quy đổi thành phần trăm hoặc tự hoàn thành Project.

Workflow hoàn thành Project thuộc module nghiệp vụ hiện có. Reports không cập nhật Project/Workspace, điểm, milestone, phân công hoặc lịch sử Alerts.

Mỗi backlog item được đếm một lần theo trạng thái. Nhiều bản nộp artifact không nhân số backlog. Tổng của Master bao gồm phần trực tiếp và toàn bộ Project con được phép đọc, kể cả module bị ẩn bởi bộ lọc chi tiết.

## Bộ lọc và KPI

- Bộ lọc gồm chương trình, cohort, lớp, mentor, Master template/phiên bản, team, Project, trạng thái Master, trạng thái Sub-project, cảnh báo, ngày tạo Project và tìm kiếm.
- masterStatus lọc trạng thái Project gốc. status chỉ lọc Project con. Master độc lập được lọc bằng masterStatus.
- Khi lọc chi tiết, chỉ hiển thị Master có dòng khớp và các Project con khớp. Tổng backlog Master vẫn lấy toàn bộ Project trong scope của Master đó.
- KPI và biểu đồ tính toàn bộ kết quả trước phân trang; bảng phân trang theo Master.
- KPI gồm Master ACTIVE, tổng Master, lớp/cohort, team duy nhất và Sub-project khớp bộ lọc.
- Ngày lọc là ngày tạo Project trong múi giờ báo cáo.
- Toolbar giữ bản nháp đến khi Áp dụng; search tự áp dụng sau 300 ms. Đổi lớp xóa team; đổi template xóa phiên bản.

## Cảnh báo

- OVERDUE: deadline trước hiện tại, milestone chưa SUBMITTED/ACCEPTED, Project chưa COMPLETED/CANCELLED.
- INACTIVE_MEMBERS: Project ACTIVE có thành viên với việc Todo chờ, đã tham gia và không bắt đầu task trong khoảng thời gian cấu hình. Dùng lại quy tắc hoạt động của Alerts cho từng Project được giao; mặc định 7 ngày. Không có việc chờ thì không tự bị kết luận không hoạt động.
- NEEDS_ATTENTION: quá hạn hiện tại hoặc thành viên không hoạt động.
- LATE_SUBMISSION: lịch sử nộp sau deadline hoặc submittedLate. Hiển thị riêng, kể cả milestone đã ACCEPTED.
- Đang chờ chấm không phải quá hạn hiện tại. Lịch sử nộp trễ không lọt vào OVERDUE.
- Không dùng ngưỡng phần trăm để suy cảnh báo sắp hạn trong Reports. Không sửa chính sách module Alerts.

## Quyền và scope

Yêu cầu PROJECT_REPORT_READ; tạo/tải file cần thêm PROJECT_REPORT_EXPORT.

- Admin/School Admin: tenant hiện tại.
- Mentor/Teacher/Trainer: team được gán trực tiếp qua assignedMentorId; phụ trách lớp không tự mở quyền xem các team khác trong lớp.
- Program Manager/Class Admin: team trực tiếp hướng dẫn hoặc scope TENANT/PROGRAM/COHORT/CLASS, hoặc phân công quản lý lớp phù hợp.
- Dropdown, danh sách, tổng hợp, export và download kiểm scope phía server. ID ngoài scope trả 403.
- Team DRAFT đã có Project vẫn có thể xuất hiện để thống kê Project PLANNING.

## Excel và CSV

Giữ job nền, idempotency, audit, thời hạn tải mặc định 24 giờ và kiểm tra lại quyền/scope lúc tải. Xuất tất cả dòng khớp bộ lọc, không giới hạn theo trang.

File gồm chương trình, cohort, lớp, mã/tên/trạng thái Master, template/phiên bản, cấp Project, Project cha, mã/tên Project con, team, mentor, trạng thái Project, số backlog theo trạng thái, tổng backlog Master trong scope, milestone được chấp nhận/tổng, quá hạn, lịch sử trễ, thành viên không hoạt động và thời điểm dữ liệu.

Kiểm tra lại tất cả Project đóng góp vào tổng Master, kể cả module bị ẩn bởi bộ lọc chi tiết. Mất quyền đọc Project đóng góp dữ liệu thì không được tải file cũ. CSV giữ UTF-8 BOM, quoting và bảo vệ chuỗi có thể được hiểu là công thức.

Không đổi schema nghiệp vụ Project/Workspace/Milestone. Các bảng job/audit của Reports tiếp tục dùng như trước.

## Kiểm thử

Bộ test Reports dùng H2 in-memory riêng: WHOLE/SPLIT, cây nhiều cấp, Master cùng template vẫn độc lập, Project/milestone giữ trạng thái riêng, ERD không có backlog, rollup trước bộ lọc chi tiết, scope Admin/Mentor/Manager/tenant, thành viên không hoạt động, Excel/CSV, idempotency, TTL, thu hồi quyền và không ghi dữ liệu nghiệp vụ khi đọc.
