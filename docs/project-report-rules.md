# US-RPT-001 — Project Dashboard

## Quy tắc được chốt ngày 07/11/2026

- Bỏ phần trăm tiến độ trung bình, tỷ lệ hoàn thành và phần trăm milestone khỏi Reports.
- Một biểu đồ tổng quan chỉ thống kê trạng thái Master Project.
- Sub-project nằm trong bảng chi tiết của Master.
- Backlog của Master bằng backlog trực tiếp trên Master cộng backlog của toàn bộ Project con trong phạm vi người xem. Hiển thị số lượng Todo, In progress, Review, Done và trạng thái khác nếu có.

## Bổ sung US-RPT-01 ngày 10/11/2026

Theo yêu cầu mới, phần tổng quan bổ sung số lượng theo trạng thái milestone và artifact, Task quá hạn và rủi ro đang tồn tại. Không hiển thị tỷ lệ phần trăm. Các số mới nằm trong `overview` của API; `summary`, biểu đồ trạng thái Master, bảng và export hiện có tiếp tục mô tả toàn bộ kết quả báo cáo.

Hai phân bố trạng thái milestone và artifact hiển thị bằng biểu đồ vòng tròn. Tâm biểu đồ là tổng số; chú giải hiển thị số lượng từng trạng thái, kể cả 0. Không hiển thị phần trăm. Dữ liệu rỗng dùng vòng tròn trung tính, tổng 0 và thông điệp Empty.

Chú giải của milestone, artifact và Master có chiều rộng 192px và tự co khi thiếu chỗ, không kéo giãn theo chiều rộng card. Nhãn và số lượng đặt gần nhau, số căn phải trong chú giải; cả cụm vòng tròn và chú giải được căn giữa card.

Bố cục theo mẫu giao diện tối giản: 6 KPI trên một hàng khi đủ chiều rộng. Khi vùng Dashboard rộng từ 1020px, ba biểu đồ milestone, artifact và Master cùng nằm trên một hàng để giảm khoảng trống hai bên; Backlog thành một hàng ngang gọn bên dưới. Từ 960px đến dưới 1020px, bốn panel chia hai cột; màn hình hẹp hơn xếp dọc. Dashboard dùng vùng cuộn của core MainLayout, phần nội dung ở block flow với một lớp padding để tránh bị flex co/cắt đầu hoặc cuối trang. Danh sách Master, chi tiết và xuất báo cáo vẫn nằm trong luồng cuộn; bảng chi tiết chỉ cuộn ngang trong chính bảng khi không đủ chiều rộng.

Dashboard bật tùy chọn compactHeader của MainLayout: header cao 56px, breadcrumb đầy đủ chỉ hiện khi đủ rộng (xl); ở màn hình nhỏ, tiêu đề trong nội dung vẫn xác định trang hiện tại. Tùy chọn mặc định tắt để giữ bố cục core của các trang khác.

Ở desktop từ 1024px và chiều cao khung nhìn không quá 896px (bao gồm trường hợp browser zoom), Dashboard giảm khoảng cách, padding và kích thước vòng tròn; giữ nguyên các trạng thái và số lượng. Nghiệm thu bố cục phải kiểm tra cả bốn panel tổng quan và vòng tròn Master hiện trọn ngay khi mở trang tại khung nhìn tương đương ảnh 125% và laptop 1366×768, thay vì chỉ kiểm tra có thể cuộn xuống cuối trang. Các khung nhìn quá thấp hoặc màn hình hẹp tiếp tục cuộn tự nhiên, không đặt max-height/overflow để giấu nội dung biểu đồ.

- Master đang triển khai: mỗi Master ACTIVE đếm một lần, không cộng số Project con. Project.status hiện dùng ACTIVE cho dự án đang triển khai; không thêm enum IN_PROGRESS giả. Team đang tham gia được đếm duy nhất từ Project ACTIVE dưới Master ACTIVE khớp bộ lọc. Không tính workspace lịch sử/không ACTIVE vào các KPI nghiệp vụ.
- Milestone và artifact: lấy trên Project ACTIVE dưới Master ACTIVE trong Workspace ACTIVE/current, có kiểm tenant và scope. Với Master dùng chung, chỉ lấy phần việc trực tiếp được phép xem khi có Workspace tham gia đang hoạt động. Số liệu tính theo các dòng khớp bộ lọc trước phân trang, không mở rộng sang module bị lọc ẩn. Project đang ACTIVE nhưng chưa có Workspace vẫn có thể góp vào số Master/team; chưa góp vào các thẻ nghiệp vụ.
- Milestone: PLANNED, IN_PROGRESS, SUBMITTED, ACCEPTED, CHANGES_REQUESTED, REJECTED. Quyết định review hiện tại được phản ánh vào trạng thái; WAIVED được hiển thị riêng khi có dữ liệu và không bị tính là rủi ro.
- Artifact: DRAFT, SUBMITTED, ACCEPTED, CHANGES_REQUESTED, REJECTED. Chỉ tính một bản hiện tại cho mỗi milestone/team. Đọc trạng thái review từ MilestoneSubmission/currentVersionNumber, không cộng các SubmissionVersion hoặc bản sao immutable vào tổng. Bản nháp workspace mới hơn vòng review được tính là DRAFT; bản nháp cũ không ghi đè kết quả review. Draft lưu theo tenant/project/milestone của writer cũ có thể không có team_id. Không tạo trạng thái APPROVED trong database; nhãn Đã chấp nhận dùng ACCEPTED hiện có.
- Task quá hạn: backlog item và task con active, TODO hoặc IN_PROGRESS, deadline trước thời điểm thống kê. REVIEW/DONE, thiếu deadline, deadline bằng hiện tại không bị tính. Nếu thuộc sprint thì sprint phải ACTIVE. Task con kế thừa scope/sprint của backlog cha và được kiểm alias Project/tenant. Backlog và task con là các bản ghi công việc riêng, mỗi bản ghi chỉ đếm một lần; không yêu cầu assignee để tính tổng Project.
- Rủi ro milestone: chưa ACCEPTED/WAIVED và đã quá deadline, hoặc còn tối đa 48 giờ chưa nộp (kể cả draft), hoặc hiện bị REJECTED/CHANGES_REQUESTED. Mỗi milestone chỉ đếm một lần dù có nhiều lý do. Nộp rồi nhưng đã quá hạn và chưa được chấp nhận vẫn thuộc KPI rủi ro; không thay đổi định nghĩa bộ lọc OVERDUE lịch sử bên dưới.
- Không hoạt động: thành viên học viên hiện tại không có hoạt động nghiệp vụ được ghi nhận trong cửa sổ cấu hình (mặc định 7 ngày), kể từ lúc tham gia/chuyển nhóm. Không bắt buộc có việc Todo. Credit cho actor của thay đổi backlog, task, hoạt động Project, nộp/chỉnh artifact/milestone và contribution từ integration; không credit cho assignee chỉ vì người khác sửa task. Một người trong nhiều module chỉ đếm một lần trong scope đang xem.
- Tổng rủi ro = số milestone rủi ro + số backlog/task con quá hạn + số thành viên không hoạt động. Không đếm log gửi thông báo, không gửi cảnh báo khi đọc Dashboard; không đổi chính sách gửi của module Alerts.
- Chi tiết Master/Sub-project không hiển thị cột Cần theo dõi, danh sách thành viên rủi ro hoặc nhãn quá hạn/lịch sử trễ trong hộp thoại milestone. Rủi ro hiển thị ở KPI tổng quan; trạng thái nghiệp vụ Project/milestone vẫn hiển thị trong chi tiết.

### AC02 tạm giữ hành vi cũ

Theo yêu cầu ngày 10/11/2026, chưa chuyển sang cách cho chọn Cohort/Class trống. Options chỉ chứa Cohort/Class đã có Project trong scope. Phạm vi/kết quả rỗng trả 200 với KPI bằng 0 và UI Empty. Gửi trực tiếp ID Cohort/Class không có trong dữ liệu báo cáo vẫn trả 403 theo guard hiện tại. Quyết định đổi sang AC02 nguyên văn user story sẽ được xem xét sau khi trao đổi với leader.

## Phạm vi được xác nhận trước khi triển khai tiếp ngày 10/11/2026

- Hoàn thiện giao diện Admin trước; các vai trò khác là giai đoạn sau. Giữ các kiểm tra permission, tenant và object scope đang có ở API.
- Project Dashboard chỉ hiển thị số lượng và trạng thái, tuyệt đối không hiển thị phần trăm, kể cả khối Task mới. AC yêu cầu phần trăm của US-RPT-03 cần được ghi nhận là điều chỉnh phạm vi.
- Workflow Board hiện chỉ có TODO, IN_PROGRESS, REVIEW, DONE. Không bổ sung BLOCKED hoặc khôi phục tạo cột/trạng thái tùy ý cho đợt Dashboard này.
- Phần thời gian theo chức năng và nguồn dữ liệu đã có; không tự bổ sung kỳ Tuần/Tháng hoặc thống kê lịch sử toàn Dashboard khi các phân hệ nguồn chưa hỗ trợ. Bộ lọc ngày hiện tại vẫn là ngày tạo Project.
- Đã chọn phân bố bốn trạng thái vì dễ xem và demo. Chưa triển khai Burndown/Velocity; không coi phần biểu đồ lịch sử của US-RPT-03 là đã hoàn thành bằng biểu đồ phân bố trạng thái.
- Đã chọn thêm Activity tổng hợp trực tiếp trên Dashboard vì Dashboard theo dõi nhiều Project/team. Đọc lại nguồn hoạt động có sẵn theo scope và bộ lọc; không cần mở Kanban trước. Kanban tiếp tục cung cấp lịch sử chi tiết của từng Project.

### Thiết kế Activity tổng hợp để triển khai

- Mỗi dòng thể hiện thời gian, Master/Project, team, người thực hiện, đối tượng và hành động để phân biệt hoạt động giữa nhiều nhóm. Chỉ hiện metadata nghiệp vụ; không tự đưa nội dung feedback riêng vào feed.
- Tổng hợp hoạt động task/backlog, nộp bài và review milestone/artifact từ các log đã có sau khi đối chiếu chính xác tenant/project/team. Cùng một sự kiện có nhiều bản ghi audit chỉ hiện một lần.
- Phạm vi là toàn bộ kết quả khớp bộ lọc được phép đọc trước phân trang danh sách Master; không chỉ lấy Project ở trang đang mở. Lọc Team/Project thu hẹp feed tương ứng.
- Đề xuất hiển thị 10 hoạt động mới nhất, sắp thời gian giảm dần; có thao tác xem thêm trong Dashboard. Bộ lọc ngày vẫn lọc ngày tạo Project, không ngầm đổi thành ngày xảy ra hoạt động.
- Liên kết tới task, milestone hoặc bài review chỉ là thao tác xem chi tiết đúng đối tượng; không dùng việc chuyển trang Kanban làm nguồn tổng hợp.

### Tình huống nghiệm thu bổ sung trước khi code

Các tình huống sau mô tả kết quả cần đạt; kiểm thử API và giao diện được ghi nhận ở mục Kiểm thử.

| Mã | Thao tác hoặc dữ liệu mẫu | Kết quả mong đợi |
| --- | --- | --- |
| RPT03-01 | 20 công việc được thống kê có Todo 5, In progress 8, Review 3, Done 4 | Đúng số lượng 5/8/3/4; tổng 20; không có phần trăm hoặc BLOCKED |
| RPT03-02 | Chuyển một công việc từ In progress sang Done thành công | Sau đồng bộ, các số thành 5/7/3/5; tổng vẫn là 20 |
| RPT03-03 | Chọn một Sprint cụ thể | Chỉ lấy các công việc chính thuộc Sprint được chọn; không cộng task con vào cùng tổng |
| ACT-01 | Các Project A và B thuộc bộ lọc đều có hoạt động | Feed hiển thị cả hai, mỗi dòng định danh đúng Project và team |
| ACT-02 | Lọc riêng Team A hoặc Project A | Không còn dòng ngoài điều kiện lọc; KPI, bảng và feed dùng cùng ngữ cảnh Project/team |
| ACT-03 | Đổi trang danh sách Master | Feed vẫn tổng hợp toàn bộ kết quả khớp bộ lọc trước phân trang |
| ACT-04 | Có sự kiện mới hoặc cùng sự kiện xuất hiện ở nhiều nguồn audit | Sau đồng bộ hiển thị sự kiện mới đúng thứ tự; không lặp cùng một sự kiện |
| ACT-05 | Không có hoạt động hoặc tải dữ liệu thất bại | Empty có giải thích khi không có log; lỗi có Retry và giữ bộ lọc |
| ACT-06 | Có hoạt động ngoài tenant/scope hoặc Project chỉ cung cấp ngữ cảnh cha | Không đưa hoạt động không được phép đọc vào feed |

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

## Triển khai bổ sung ngày 11/11/2026

- Ba tab Tổng quan, Sprint & Task, Milestone & Bài nộp dùng chung bộ lọc. Ở màn hình rộng, bộ lọc và tab cùng một hàng để không tăng chiều cao phần tổng quan. Master và Backlog phải hiện trọn trong các khung desktop nghiệm thu.
- Bộ lọc thêm Master Project thực tế (`masterId`) và phần việc Project cụ thể (`projectId`), tách biệt với template. Chọn Master lấy các Project con được phép đọc trong Master đó; chọn Project cụ thể lấy đúng phần việc ấy. Đổi chương trình/cohort/lớp/Master/team xóa các lựa chọn con không còn phù hợp.
- Query params giữ bộ lọc, tab và nhóm trạng thái bài nộp. Các đường dẫn review/milestone nhận `returnTo` của Dashboard để quay lại đúng ngữ cảnh. Request cũ bị hủy khi đổi điều kiện; không giữ kết quả của scope trước trong lúc tải scope mới.
- Khối công việc thống kê bốn trạng thái từ backlog chính của Workspace và các công việc chính của Kanban cũ, mỗi bản ghi nguồn tính một lần; không cộng task con UUID. Tổng này khác tổng backlog thuần ở tab Tổng quan khi hệ thống có công việc Kanban cũ. Các Sprint không có công việc vẫn xuất hiện nếu thuộc Project/team được đọc.
- `workSprintId` là lựa chọn riêng của khối công việc và sheet công việc trong Excel. Không làm thay đổi phạm vi Project/team của KPI hoặc Activity; giao diện giải thích rõ điều này. Bộ lọc ngày chung tiếp tục là ngày tạo Project, chưa có Tuần/Tháng hoặc số liệu lịch sử Burndown/Velocity.
- Dashboard tự tải lại mỗi 30 giây khi trang đang mở. Feed tải thêm từng 10 dòng, sắp thời gian giảm dần rồi ID ổn định. Các trang tiếp theo dùng mốc `asOf` của trang đầu để hoạt động mới không làm dịch trang; không lặp sự kiện có cùng đối tượng/hành động/correlation.
- Feed đọc metadata từ ProjectActivityLog, audit backlog/task con, audit milestone/submission và bản nộp legacy. Không trả raw before/after JSON, nội dung notes hoặc feedback riêng. Bản sao artifact được version audit đại diện không xuất hiện lần nữa. Mọi nguồn đều đối chiếu tuple tenant/project/team/milestone hoặc liên kết Project thực tế trước khi tổng hợp.
- Milestone & Bài nộp dùng cùng kết quả tính trạng thái hiện tại với KPI. Hiện deadline, Project/team, trạng thái milestone/bài nộp, phiên bản, thời điểm nộp, người duyệt, checklist dạng số lượng và đường dẫn xem mốc/review. Danh sách phân trang 20 dòng; lọc trạng thái ở tab này không tự đổi bộ lọc chung.
- Cảnh báo milestone phân biệt sắp hạn chưa nộp, quá hạn chưa nộp, quá hạn chưa nghiệm thu và bài cần xử lý; ACCEPTED/WAIVED được loại theo quy tắc KPI. Không bổ sung lại cột Cần theo dõi vào chi tiết Master.

## Bố cục Master và Activity ngày 12/11/2026

- Trong tab Tổng quan, danh sách Master và Activity nằm cùng hàng khi vùng nội dung báo cáo rộng từ 1020 px: Master chiếm phần còn lại, Activity rộng 288–352 px. Dưới ngưỡng này, hai khối xếp dọc.
- Hàng Master thu gọn khoảng cách, giữ tên, lớp/team, số Sub-project khớp/tổng, trạng thái, tổng backlog và thao tác mở chi tiết. Chi tiết Project con dùng bảng 5 cột khi khung Master rộng từ 960 px; dưới ngưỡng này chuyển thành các hàng thông tin có nhãn để nhóm/mentor, backlog và nút Milestone luôn hiện đủ. Nút Milestone trình bày số đạt/tổng và nhãn trên hai dòng; không yêu cầu cuộn ngang để mở mốc.
- Activity dùng khung nhỏ tương tự Activity Trail của Kanban, tối đa 512 px và tiếp tục giảm theo chiều cao màn hình. Danh sách sự kiện cuộn riêng, hỗ trợ bàn phím; tiêu đề, cập nhật và nút tải thêm nằm ngoài vùng cuộn. Trên desktop, khung bám khi cuộn phần chi tiết Master.
- Giữ phạm vi tổng hợp theo bộ lọc chung, 10 sự kiện mỗi lượt, tải thêm, làm mới và xử lý lỗi/Retry. Mở hoặc đổi trang Master không tự đổi phạm vi Activity.
- Kiểm tra trên Dashboard/MainLayout thật với API mô phỏng: 10 cấu hình desktop/laptop/zoom/tablet/mobile/narrow/empty/dark/tên dài/màn hình thấp; thêm mở Master bằng bàn phím, tải thêm 10→13 sự kiện không tăng chiều cao khung, làm mới các trang đã tải, lọc team và Retry sau lỗi. Bộ kiểm tra bố cục 14 cấu hình trước đó cũng đạt; frontend TypeScript/Vite build đạt. Ảnh và kết quả nằm trong `outputs/project-dashboard-activity-20261112/`.

## Cảnh báo

- OVERDUE: deadline trước hiện tại, milestone chưa SUBMITTED/ACCEPTED, Project chưa COMPLETED/CANCELLED.
- INACTIVE_MEMBERS: Project ACTIVE có thành viên với việc Todo chờ, đã tham gia và không bắt đầu task trong khoảng thời gian cấu hình. Dùng lại quy tắc hoạt động của Alerts cho từng Project được giao; mặc định 7 ngày. Không có việc chờ thì không tự bị kết luận không hoạt động.
- NEEDS_ATTENTION: quá hạn hiện tại hoặc thành viên không hoạt động.
- LATE_SUBMISSION: lịch sử nộp sau deadline hoặc submittedLate. Hiển thị riêng, kể cả milestone đã ACCEPTED.
- Đang chờ chấm không phải quá hạn hiện tại. Lịch sử nộp trễ không lọt vào OVERDUE.
- Không dùng ngưỡng phần trăm để suy cảnh báo sắp hạn trong Reports. Không sửa chính sách module Alerts.

## Lịch sử Activity ngày 12/11/2026

- Khung cạnh Master giữ tối đa 10 hoạt động mới nhất. Nút Xem lịch sử mở hộp thoại trên Dashboard, không thêm route/tab. Khi đóng, bộ lọc Dashboard, trạng thái mở Master và vị trí cuộn được giữ nguyên.
- Hộp thoại mặc định 7 ngày gần đây theo múi giờ báo cáo; lọc Từ ngày/Đến ngày theo thời điểm phát sinh hoạt động. Đây là bộ lọc riêng, khác bộ lọc ngày tạo Project của Dashboard; không đổi KPI, danh sách Master hay nội dung Excel.
- Phân trang 20 sự kiện, có Đầu/Trước/Sau/Cuối và tổng số sự kiện. Các trang dùng chung mốc `asOf`; nút Làm mới lịch sử lấy mốc mới và quay về trang đầu. Đổi trang/lọc ngày cuộn danh sách về đầu. Có Loading, Empty, Error và Retry; màn hình nhỏ dùng danh sách thẻ thay cho bảng.
- Endpoint `/api/project-reports/activities/history` tiếp tục kiểm tra Tenant/Data scope. Khoảng ngày được áp dụng ngay vào truy vấn từng nguồn log, có xử lý thời gian local của audit cũ và Instant của milestone/submission. Bản thử nghiệm vẫn hợp nhất, loại trùng và tính tổng trong bộ nhớ đối với khoảng ngày được chọn; chưa thay bằng bảng sự kiện riêng hoặc phân trang hợp nhất hoàn toàn tại database.
- Excel và endpoint Activity cũ được giữ để có thể hoàn tác phần bổ sung riêng. Story Activity rút gọn còn 5 AC theo chức năng nằm trong `docs/project-dashboard-activity-user-story.md`; các yêu cầu kiểm tra lỗi và bảo vệ scope tiếp tục áp dụng theo chuẩn chung dù không tách AC riêng trong story.
- Kiểm tra: 56 test Reports đạt, gồm 205 hoạt động/ngày, phân trang, mốc dữ liệu ổn định, ranh giới ngày theo múi giờ và quyền truy cập; frontend build đạt. Browser kiểm tra dữ liệu mẫu 205 hoạt động, trang đầu/cuối, ngày không hợp lệ/rỗng, bộ lọc team, đóng/mở không mất trạng thái, mobile, zoom, màn hình thấp, dark, Loading và Retry.
- Bản trước khi sửa nằm trong `outputs/activity-history-trial-20261112/before/`; danh sách và hash các file của riêng lần thử nghiệm được lưu cùng thư mục để kiểm tra trước khi hoàn tác.

## Quyền và scope

Yêu cầu PROJECT_REPORT_READ; tạo/tải file cần thêm PROJECT_REPORT_EXPORT.

- Admin/School Admin: tenant hiện tại.
- Mentor/Teacher/Trainer: team được gán trực tiếp qua assignedMentorId; phụ trách lớp không tự mở quyền xem các team khác trong lớp.
- Program Manager/Class Admin: team trực tiếp hướng dẫn hoặc scope TENANT/PROGRAM/COHORT/CLASS, hoặc phân công quản lý lớp phù hợp.
- Dropdown, danh sách, tổng hợp, export và download kiểm scope phía server. ID ngoài scope trả 403.
- Team DRAFT đã có Project vẫn có thể xuất hiện để thống kê Project PLANNING.

## Xuất Excel

Giữ job nền, idempotency, audit, thời hạn tải mặc định 24 giờ và kiểm tra lại quyền/scope lúc tải. Xuất tất cả dòng khớp bộ lọc, không giới hạn theo trang.

Giữ sheet Tiến độ dự án với 7 cột đã có. Bổ sung Tổng quan, Trạng thái công việc, Milestone và bài nộp, Cảnh báo và Hoạt động: tổng cộng 6 sheet. Các số lượng là ô số, ngày theo múi giờ báo cáo; mỗi sheet có thời điểm dữ liệu và mô tả bộ lọc. Toàn bộ hoạt động khớp scope được xuất, không chỉ 10 dòng preview hoặc trang Master hiện tại.

Kiểm tra lại tất cả Project đóng góp vào tổng Master, kể cả module bị ẩn bởi bộ lọc chi tiết. Mất quyền đọc Project đóng góp dữ liệu thì không được tải file cũ. Giữ giá trị dạng công thức trong tên dưới dạng ô văn bản. Khi file tạo thành công, ghi thêm action EXPORT_MOCK_PROJECT_DASHBOARD cùng actor, tenant, thời gian và correlation ID, bên cạnh audit vòng đời job. Đợt này chỉ mở rộng Excel hiện có; không bổ sung CSV/PDF.

Không đổi schema nghiệp vụ Project/Workspace/Milestone. Các bảng job/audit của Reports tiếp tục dùng như trước.

## Kiểm thử

Bộ test Reports dùng H2 in-memory riêng: WHOLE/SPLIT, cây nhiều cấp, Master cùng template vẫn độc lập, Project/milestone giữ trạng thái riêng, ERD không có backlog, rollup trước bộ lọc chi tiết, scope Admin/Mentor/Manager/tenant, thành viên không hoạt động, Excel, idempotency, TTL, thu hồi quyền và không ghi dữ liệu nghiệp vụ khi đọc. Các ca mới kiểm tra phân bố công việc, lựa chọn Sprint riêng, Activity trước phân trang Master/không trùng/không lộ notes, bộ lọc Master, phiên bản mới nhất, sáu sheet và audit export thành công.

Kiểm tra giao diện bằng dữ liệu mẫu với trang Dashboard và MainLayout thật: đổi tab/Sprint, lọc lớp-team, tải thêm Activity, lỗi và Retry, liên kết review và khôi phục bộ lọc; thêm các khung laptop, zoom 125%, desktop thấp, tablet, mobile, dữ liệu rỗng, lỗi, loading và dark mode. Việc mở link review và quay lại trong bộ kiểm tra giao diện dùng trang đích mô phỏng; nghiệp vụ nộp/chấm bài có bộ test riêng của module Submission.

Kết quả ngày 11/11/2026: 53 test Reports đạt (45 integration, 6 policy, 2 dispatcher); frontend TypeScript/Vite build đạt. Kiểm tra bố cục đạt 14 cấu hình; các luồng chọn Sprint, thu hẹp lớp/team, tải thêm và Retry Activity, làm mới toàn bộ các trang Activity đã mở, liên kết review và khôi phục bộ lọc đều đạt trên dữ liệu mẫu. Test API cũng kiểm tra ba nguồn audit cùng một lần nộp chỉ hiện một sự kiện và từ chối Sprint không thuộc bộ lọc ngay trước khi tạo job Excel.

Bổ sung kiểm tra ngày 12/11/2026: 12 cấu hình bố cục chi tiết Master đạt với 7 Project con, tên dài, bảng rộng, khung hẹp, laptop/zoom, mobile và dark mode; mọi nút Milestone hiện đủ và mở đúng Project, không làm tràn ngang. Frontend build đạt. Hai kiểm tra tích hợp Excel đạt, gồm ca 205 hoạt động gần đây và 1 hoạt động cũ ngoài 7 ngày: preview trả 10, lịch sử trả 20/trang, nhưng Excel xuất đủ 206 sự kiện của team được phép đọc; không chứa team khác và không phụ thuộc trang Master. Ca Excel còn lại tiếp tục xác nhận 6 sheet, kiểu dữ liệu và audit khi tạo file thành công. Ảnh và bản lưu trước khi chỉnh nằm trong `outputs/project-dashboard-milestone-fix-20261112/`.
