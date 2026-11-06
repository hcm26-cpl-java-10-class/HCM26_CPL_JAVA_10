# US-RPT-001 — Project Dashboard (Sprint 3)

## Giao diện cập nhật ngày 03/11/2026

Dashboard dùng bốn thẻ KPI, biểu đồ tròn trạng thái, thanh tiến độ và khu vực rủi ro riêng. Bấm chú giải biểu đồ để lọc trạng thái; nhóm sắp hạn và lịch sử nộp trễ có liên kết lọc nhanh. Thẻ quá hạn hiện tại vẫn hiển thị số quá hạn hiện tại, không đổi thành tổng quá hạn và lịch sử trễ. Chip bên dưới toolbar thể hiện điều kiện đã áp dụng; lựa chọn đang nhập trong popover vẫn là bản nháp tới khi Áp dụng. Master mở rộng ra bảng team, từng dòng mở tiếp milestone; export giữ quy trình tạo nền hiện có. Các công thức, API, quyền và data scope không đổi.

Quy trình tự thực hành với bộ DASH nằm trong [hướng dẫn local 03/11/2026](project-dashboard-test-local-2026-11-03.md).

## Phạm vi và cách mở

- Menu **Project Management → Project Dashboard**, đường dẫn `/management/reports/projects`.
- Dùng chung nhóm menu với Workspace, Sprints, Milestones, Alerts và Project Templates. AutoMenuInitializer chuyển bản ghi menu hiện có theo URL khi khởi động lại, không tạo bản sao. Nhóm Reports rỗng sẽ tự ẩn ở sidebar; không cần xóa nhóm hoặc dữ liệu nghiệp vụ.
- Backend mới nằm trong `system.project.report`; frontend nằm trong `pages/management/project-reports`.
- Đọc dữ liệu Project/Team/Milestone/Backlog/Submission hiện có. Không cập nhật trạng thái Project, cấu hình Milestone, phân nhóm hoặc gửi Alerts khi xem Reports.
- Không thống kê inactive members. Export chỉ hỗ trợ Excel/CSV theo user story đã chốt.
- Bộ lọc ngày là **ngày tạo Project**, tính trong múi giờ báo cáo; không phải deadline milestone hay khoảng thời gian phát sinh hoạt động.
- Toolbar dùng nút **Filters** mở popover theo mẫu các trang danh sách và dùng lại component **SearchInput** chung. Search tự áp dụng sau 300 ms ngừng gõ; điều kiện trong popover giữ bản nháp cho tới khi bấm **Áp dụng**. Badge đếm điều kiện đã áp dụng, không đếm tìm kiếm/phân trang/mặc định. Đổi lớp xóa team đang chọn; đổi template xóa phiên bản đang chọn. Đặt lại đưa tìm kiếm, bộ lọc và trang về mặc định.
- Các KPI và biểu đồ áp dụng toàn bộ bộ lọc hiện tại, không giới hạn theo trang. Bảng phân trang theo Master.
- Hàng KPI đầu hiển thị riêng số **Lớp có dự án**, **Team tham gia**, **Tổng dự án của team**, **Dự án đang thực hiện** (`IN_PROGRESS + SUBMITTED`). Đây là các lớp/team có dự án thuộc scope báo cáo và khớp bộ lọc, không đếm lớp/team chưa có dự án. Không nhầm số Master với số dự án của team.
- Hiển thị thêm tiến độ trung bình, tỷ lệ hoàn thành và rủi ro. Danh sách thu gọn theo đề bài/phiên bản/lớp; bấm **Xem chi tiết** để thấy từng team, lớp, Mentor, trạng thái, tiến độ và milestone.

## Master / Sub-project

Mỗi Project của một Team là một Sub-project. Master là nhóm dữ liệu ảo theo tenant + class + template + **phiên bản đề bài nguồn**.

`Project.templateSnapshotId` có thể trỏ đến bản sao riêng cho từng team, vì vậy không dùng trực tiếp làm khóa Master. Ưu tiên phiên bản được ghim ở `ProjectTeam.projectTemplateVersionId`; dữ liệu cũ dùng `sourceSnapshotId` hoặc parent của snapshot có `purpose=TEAM_ASSIGNMENT`. Phiên bản gốc được clone từ phiên bản trước vẫn có danh tính riêng. Không xác định được nguồn thì tách riêng Project, kèm ghi chú.

Khi lọc chỉ một số Team (ví dụ Overdue), tiến độ và trạng thái Master vẫn lấy **toàn bộ Team thuộc scope người xem trong Master đó**. Bảng ghi số nhóm khớp / số nhóm trong scope. Không dùng nhóm ngoài quyền xem để tính rollup của Mentor.

## Trạng thái và tiến độ

Thứ tự nhận diện trạng thái Reports (mỗi Project được đếm đúng một trạng thái):

1. Project `CANCELLED` → `CANCELLED`.
2. Project `COMPLETED`, hoặc có ít nhất một milestone đang hoạt động và toàn bộ đều `ACCEPTED` → `DONE`.
3. Có milestone `SUBMITTED` → `SUBMITTED`.
4. Project `DRAFT` / `PLANNING` → `NOT_STARTED`.
5. Còn lại → `IN_PROGRESS`.

**Thay đổi đã được người phụ trách chấp thuận so với SRS BR-UNI-12:** Reports dùng điều kiện DONE giản lược trên, không kiểm tra điểm đã khóa / waived. Đây là trạng thái suy ra cho báo cáo, không sửa workflow hoàn thành dự án của nhóm.

“Milestone đang hoạt động” ở đây là record `is_active=true` của đúng tenant/project/team, gồm cả milestone ở lifecycle `PLANNED`; không có nghĩa chỉ lấy lifecycle `IN_PROGRESS`.

- Milestone `ACCEPTED`: 100% bất kể task bên trong.
- Milestone khác: số **backlog item cấp trên cùng** Done / tổng backlog item liên kết milestone. Không cộng thêm subtask; không có item thì 0%.
- Các trọng số dương và tổng đúng 100%: cộng tiến độ milestone × trọng số / 100.
- Toàn bộ trọng số null/0: chia đều, kèm ghi chú.
- Chỉ một phần thiếu trọng số, có trọng số âm, hoặc tổng khác 100%: không tự phân bổ lại; trả tiến độ null, UI hiện **Chưa đủ cấu hình**. Trạng thái/rủi ro vẫn được tính.
- Project chưa có milestone: dùng tỷ lệ backlog item Done của Project, kèm ghi chú.
- Reports `DONE`: tiến độ Sub-project là 100%.
- Tiến độ Master: trung bình các Sub-project trong scope, loại `CANCELLED`. Nếu một Sub-project cần tính có tiến độ chưa xác định, Master cũng chưa xác định; không âm thầm loại nhóm đó khỏi mẫu số.
- Không có nhóm hợp lệ để tính: hiển thị `—` / chưa đủ dữ liệu, không chia cho 0.

Ví dụ: A tiến độ 100%, trọng số 40%; B tiến độ 30%, trọng số 60% → Sub-project = 58%. Nếu B chưa có trọng số, Reports chưa đưa ra phần trăm chung, vì tự chia đều sẽ biến trọng số A từ 40% thành 50%. Chỉ khi cả A và B đều chưa có trọng số thì áp dụng chia đều → 65%. Không chỉnh bất cứ trọng số nào ở module Milestone.

Completion Rate = `DONE / (IN_PROGRESS + SUBMITTED + DONE) × 100%`. Không đếm trùng Project ACTIVE có milestone đã nộp. `NOT_STARTED` và `CANCELLED` vẫn nằm trong biểu đồ nhưng không nằm trong mẫu số KPI này. Nếu mẫu số 0 thì hiển thị chưa có dự án triển khai.

## Rủi ro thời gian thực

- **Đang quá hạn:** `now > deadline`, milestone chưa `SUBMITTED`/`ACCEPTED`, Project chưa DONE/CANCELLED.
- **Sắp hạn có rủi ro:** deadline trong 48 giờ tới, tiến độ milestone <50%, chưa nộp/chưa Accepted và Project chưa đóng.
- **Có lần nộp trễ:** có bản submission `submittedLate=true` hoặc `submittedAt > deadline`. Giữ lịch sử kể cả đã Accepted; hiển thị riêng, không gọi là cảnh báo đang cần xử lý.
- Nộp đúng hạn, đang `SUBMITTED` chờ Mentor chấm: không tính đang quá hạn.
- Deadline null: bỏ qua phép so sánh thời gian, không làm lỗi toàn Dashboard.

Bộ lọc **Overdue / Có lần nộp trễ** bao gồm quá hạn hiện tại hoặc lịch sử nộp trễ. Bộ lọc **Đang cần xử lý** chỉ bao gồm quá hạn hiện tại hoặc sắp hạn có rủi ro. Các quy tắc này riêng cho Reports; không tự thay đổi ngưỡng 80% đang có của Alerts.

## Quyền và scope

- Yêu cầu `PROJECT_REPORT_READ`; xuất/tải file cần thêm `PROJECT_REPORT_EXPORT`.
- School Admin/Admin: trong tenant hiện tại của tài khoản.
- Mentor/Teacher/Trainer: chỉ Team có `assignedMentorId` trùng người xem; được phụ trách Lớp không tự mở quyền xem toàn bộ Team trong Lớp.
- Program Manager/Class Admin: Team trực tiếp hướng dẫn, hoặc phạm vi TENANT/PROGRAM/COHORT/CLASS đã được cấp trong `UserDataScope`, hoặc Lớp có assignment quản lý phù hợp.
- Tái sử dụng các bảng quyền, scope và assignment hiện có, không tạo hệ phân quyền mới. Dropdown, danh sách, KPI, export và download đều kiểm scope phía server. Bộ lọc ID ngoài phạm vi trả 403.
- Permission initializer của Reports cấp hai quyền mới cho các vai trò quản lý/giảng dạy có sẵn; không cấp cho Student, không tạo tài khoản hoặc mở rộng data scope.

## Export nền và thay đổi database

Thêm riêng hai bảng `project_report_exports` và `project_report_export_audits`; không đổi bảng nghiệp vụ của đồng đội. Database local đang dùng Hibernate schema update sẽ tạo hai bảng khi backend khởi động. Với môi trường dùng schema migration/validate, cần migration tương ứng trước khi triển khai.

1. POST `/api/project-reports/exports` với UUID `Idempotency-Key`, `format=EXCEL|CSV`, `filters`.
2. Server xác minh quyền/scope, lưu job, trả 202. Yêu cầu lặp cùng key/cùng nội dung dùng cùng job; khác nội dung trả 409.
3. Worker riêng của Reports tạo file nền bằng exporter Excel sẵn có / OpenCSV sẵn có. Không có bước duyệt của người khác. Không giữ việc tạo file trên scheduler chung của các module khác.
4. UI tự cập nhật trạng thái **Đang tạo → Sẵn sàng tải**, liệt kê tối đa 20 file gần nhất của chính người dùng. Xuất toàn bộ dòng khớp bộ lọc, không chỉ trang đang xem.
5. File có hạn tải mặc định 24h kể từ lúc tạo xong. Download kiểm tra lại tài khoản, tenant, quyền và tất cả Project đã góp vào nội dung file, gồm các nhóm góp vào tiến độ Master dù không khớp bộ lọc chi tiết.
6. Ghi audit khi yêu cầu/bắt đầu/sẵn sàng/tải/thất bại/hết hạn hoặc từ chối tải do đổi scope. Xóa nội dung file đã hết hạn, giữ metadata/audit. Job RUNNING quá 10 phút chuyển FAILED để người dùng tạo lại, tránh treo sau restart.

File có Program, Cohort, Lớp, Master template, phiên bản, mã/tên Sub-project, Team, Mentor, trạng thái, tiến độ Sub/Master, milestone Accepted/tổng, rủi ro, tiến độ từng milestone, ghi chú và thời điểm dữ liệu. CSV dùng UTF-8 BOM, quote đầy đủ và xử lý chuỗi có thể bị hiểu thành công thức.

Các cấu hình mặc định (không cần sửa application.properties để demo):

```properties
app.project-reports.time-zone=Asia/Ho_Chi_Minh
app.project-reports.at-risk-hours=48
app.project-reports.at-risk-threshold=50
app.project-reports.export.ttl-hours=24
app.project-reports.export.worker-enabled=true
app.project-reports.export.poll-ms=2000
```

## Các file chính để đọc code

| File / Nhóm file | Trách nhiệm |
| --- | --- |
| `ProjectReportStatusPolicy`, `ProjectReportProgressPolicy`, `ProjectReportRiskPolicy` | Các công thức và điều kiện nghiệp vụ thuần, có unit test biên. |
| `ProjectReportScopeService` | Kiểm tra tài khoản/quyền trực tiếp từ DB, dựng tập Team được phép đọc. |
| `ProjectReportQueryRepository` | Đọc theo tập scope, aggregate task và submission riêng để tránh JOIN làm nhân số dòng. |
| `ProjectReportService` / `ProjectReportDtos` | Tạo Sub-project/Master, áp dụng bộ lọc, KPI và phân trang. |
| `ProjectReportController` / `ProjectReportErrors` | API Reports và lỗi HTTP có correlation ID. |
| `ProjectReportExport*` | Job/audit riêng, worker, file Excel/CSV, kiểm quyền lại và hạn tải. |
| `ProjectReportPermissionInitializer` / `ProjectReportConfig` / `ProjectReportSettings` | Đăng ký quyền, clock và worker riêng, cấu hình ngưỡng. |
| `frontend/src/pages/management/project-reports/index.tsx` / `ReportFilters.tsx` | Trang Dashboard, toolbar bộ lọc, KPI và biểu đồ. |
| `ReportMasters.tsx` / `ReportExports.tsx` | Bảng drilldown và tạo/tải báo cáo nền. |
| `frontend/src/api/features/project-report.api.ts` / `types/features/project-report.ts` | API client và kiểu dữ liệu frontend tương ứng DTO backend. |

## Demo AC01–AC04

1. Khởi động lại backend để tạo quyền/menu/bảng mới; đăng xuất và đăng nhập lại để nhận quyền frontend mới.
2. Mở Project Management → Project Dashboard. Giải thích Master = một phiên bản template trong một Lớp; bấm Xem chi tiết để xem từng Team, Lớp, Mentor, trạng thái, tiến độ và milestone.
3. Dùng dữ liệu demo riêng đã chuẩn bị: một nhóm có milestone đang làm, một nhóm Accepted; đối chiếu số lượng và công thức Completion Rate. 100% task Done chưa đồng nghĩa milestone đã Accepted.
4. Lọc Lớp + Đang cần xử lý / Overdue. Đối chiếu nhóm khớp lọc và tiến độ Master trên toàn scope. Nêu rõ nộp trễ lịch sử khác quá hạn đang cần xử lý.
5. Export Excel/CSV; đợi **Sẵn sàng tải**, tải và đối chiếu với bộ lọc đã áp dụng. Không cần người duyệt. Nội dung file có thời điểm dữ liệu và hạn tải.
6. Nếu demo scope, dùng Mentor được gán trực tiếp cho Team, kiểm tra không thấy Team khác cùng Lớp. Chỉ thao tác trên fixture riêng, giữ nguyên dữ liệu dùng chung.

Kiểm thử tự động sử dụng H2 in-memory riêng: policy trạng thái/trọng số/rủi ro, group nguồn snapshot, scope Admin/Mentor/Program Manager, rollup khi lọc, deadline null, export/CSV/idempotency/TTL/revocation và không cập nhật Project/Alerts khi đọc báo cáo. Kiểm tra frontend bằng `npm run build`; lint của repository cần package `typescript-eslint` được khai báo trong cấu hình ESLint nhưng hiện chưa được cài.

Lần kiểm tra 30/10/2026: 27 test Reports PASS (`mvnw.cmd -o "-Dtest=ProjectReport*Test" test`), bao gồm chuyển menu cũ từ Reports sang Project Management mà giữ nguyên ID và không tạo bản sao; KPI đếm toàn bộ kết quả kể cả khi bảng phân trang. Frontend build PASS. ESLint riêng `index.tsx` và `ReportMasters.tsx` PASS bằng cấu hình tạm dùng parser/plugin đã cài; `npm run lint` toàn repo vẫn bị chặn bởi package thiếu nêu trên. Không thay package/config ESLint chung.

Kịch bản thao tác từ tạo template mới, chia team đến nghiệm thu và kiểm tra KPI: [project-dashboard-demo.md](project-dashboard-demo.md). Lưu ý lịch bắt đầu milestone cần được chuẩn bị trước buổi demo theo workflow hiện tại; giảm Due after không bỏ được quy tắc Start date phải sau hôm nay.

Rà soát dữ liệu local và bản sao lưu: [local-data-review/README.md](local-data-review/README.md). Trạng thái reset mới nhất ngày 01/11/2026: [fresh-start-2026-11-01.md](local-data-review/fresh-start-2026-11-01.md).
