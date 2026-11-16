# DASH-C/D — tự thực hành và giữ từng trạng thái để review

**Cập nhật:** bộ demo hiện dùng `DASH-EQUIP-CD1` (ID local 145); đã chuyển Choji/Ino/Shikamaru từ 144 sang 145 theo yêu cầu và archive 144. Xem [trạng thái hiện tại và cách đặt giờ bắt đầu local](EQUIPMENT-QUICKSTART.md); dùng file `04-equipment-start-time.sql` để chọn team/giờ thay các file tên team cố định bên dưới.

## 1. Dữ liệu đã chuẩn bị ngày 05/11/2026

Database: `backend/data/fams_lms_after_merge.mv.db`, tenant 1.

| Lớp | Class ID local | Học viên | Email đăng nhập |
| --- | ---: | --- | --- |
| DASH-C — Dashboard Demo - Lop C | 36 | DASH-C01…DASH-C08 | `dash.c01@demo.example.test`…`dash.c08@demo.example.test` |
| DASH-D — Dashboard Demo - Lop D | 37 | DASH-D01…DASH-D04 | `dash.d01@demo.example.test`…`dash.d04@demo.example.test` |

Mật khẩu học viên: `DemoDashboard2026!`. Cả 12 tài khoản có role STUDENT, active và không bị khóa; đã đối chiếu mật khẩu BCrypt sau khi ghi database. Mentor của hai lớp là tài khoản hiện có `teacher@example.com` (ID 3). Tài khoản admin/teacher hiện có thường dùng `password123`; bộ chuẩn bị này không thay mật khẩu của họ.

**Hiện tại mới có lớp, học viên và liên kết mentor. Chưa tạo phiên chia nhóm, team, project, workspace, submission hay kết quả review cho C/D.** Bạn tự thực hiện các bước bên dưới. DASH-A/B và dữ liệu cũ giữ nguyên.

## 2. Mở đúng dữ liệu

Từ thư mục gốc repo, mở terminal backend:

```powershell
.\backend\data\Start-Dashboard-Local.ps1
```

Trong terminal khác:

```powershell
cd frontend
npm run dev
```

Mở địa chỉ Vite in trong terminal. Launcher backend sử dụng đúng file `backend/data/fams_lms_after_merge.mv.db` và tắt các business demo seeder. Cấu hình **Backend Demo (H2 Mock Data)** dùng database khác, nên không thấy các lớp mới này. Nếu cổng 8080 đang có backend khác, dừng backend đó trước.

Đăng nhập admin; mở **Project Management → Project Team Allocation**, tìm lớp DASH-C/D. Dashboard báo cáo ở `/management/reports/projects`.

## 3. Chia nhóm và phân vai thủ công

Tạo phiên chia nhóm của từng lớp, quy mô 4 người/team. Tạo ba team với **đúng tên** sau để các file chuẩn bị thời gian chỉ tác động đúng dữ liệu của buổi thực hành:

| Team | Lớp | PM | BA | DEV | QA | Dùng để demo |
| --- | --- | --- | --- | --- | --- | --- |
| DASH-C-RISK | DASH-C | C01 | C02 | C03 | C04 | Tiến độ một phần, sắp hạn; có thể thử quá hạn sau |
| DASH-C-REVIEW | DASH-C | C05 | C06 | C07 | C08 | Draft → submit → yêu cầu sửa → nộp lại, dừng chờ chấm |
| DASH-D-FINISH | DASH-D | D01 | D02 | D03 | D04 | Giữ chưa bắt đầu; cuối buổi mới thử hoàn thành một team |

`C01` trong bảng là học viên `DASH-C01`; tương tự cho các tài khoản khác. Gán `teacher@example.com` trực tiếp làm mentor của từng team; mentor của lớp không tự đồng nghĩa quyền xem mọi team trên Reports. Gán PM làm leader nếu màn hình yêu cầu.

**Ca validation chia nhóm:** trước khi thêm người cuối, thử kiểm tra điều kiện công bố/gán đề bài. Với template yêu cầu 4 người và mỗi vai trò ít nhất 1, hệ thống phải chỉ ra điều kiện còn thiếu. Sau đó bổ sung đủ người/vai trò mới tiếp tục. Ghi nhận thông báo thực tế; không bấm lặp để tạo team trùng.

## 4. Chuẩn bị một đề bài chung cho cả ba team

Trong **Project Templates**, tạo template riêng của buổi demo (ví dụ code `DASH-REVIEW-CD`, tên `DASH C/D - Review chuc nang`) hoặc dùng **Clone template** trên bản đang ACTIVE của `DASH-LEARN-02`, rồi sửa trên bản sao. Tài liệu cũ của A/B dùng đề bài này; không cần sửa bản gốc đang dùng.

Thiết lập quy mô min/max = 4, các vai trò PM/BA/DEV/QA tối thiểu 1, thời lượng ít nhất 1 tuần. Trong Milestone plan, chuẩn bị:

| Milestone | Trọng số | Due after | Checklist gợi ý | Late policy |
| --- | ---: | --- | --- | --- |
| M1 - Analysis | 40% | 1 day | Có yêu cầu; có thiết kế; có đường dẫn tài liệu | Cho trễ 2 ngày, 5%/ngày |
| M2 - Implementation | 40% | 3 days | Chạy được chức năng; có kiểm thử | Cho trễ 2 ngày, 5%/ngày |
| M3 - Handover | 20% | 7 days | Có hướng dẫn; có kết quả demo | Cho trễ 2 ngày, 5%/ngày |

Chọn rubric đã publish cho từng milestone và lưu tổng trọng số đúng 100%. Nếu clone có backlog cũ, kiểm tra lại nội dung; lúc tính tiến độ chỉ tính backlog thực tế bạn đã liên kết vào milestone.

Activate/publish bản đề bài theo màn hình. Khi các team còn DRAFT, gán **cùng template và cùng phiên bản nguồn** cho cả ba team, rồi công bố các team đủ điều kiện. Tạo Workspace cho từng team từ màn hình Workspace nếu chưa có; khi tạo phải chọn đúng đề bài/team.

**Điểm dừng 1:** chưa thao tác artifact. Vào Dashboard, lọc lần lượt DASH-C và DASH-D. Project được sinh từ đề bài hiện được tạo `PLANNING`, nên trước khi kích hoạt sẽ là **Chưa bắt đầu**. C có một Master với hai team nếu cùng phiên bản nguồn; D là Master riêng do khác lớp. Nếu team chưa có Project, team đó chưa nằm trong thống kê Reports; cần hoàn tất tạo Workspace/Project trước.

Ghi lại Project ID, Team ID và Workspace ID từ URL/danh sách của chính ba team. Không dùng lại ID Naruto/Sasuke/Sakura trong hướng dẫn cũ.

## 5. Cho hai team C bắt đầu demo ngay

Code sau khi đồng bộ nhánh dùng **lịch tự bắt đầu milestone**. Form tạo/sửa milestone yêu cầu Start date sau hôm nay; milestone sinh từ template hiện chưa tự có lịch bắt đầu. Vì vậy hướng dẫn cũ yêu cầu nút “Start milestone” không khớp màn hình hiện tại.

Để tập ngay trên local, có file `01-start-c.sql`: chỉ kích hoạt Project đang `PLANNING` và đặt lịch bắt đầu của milestone còn `PLANNED` thuộc hai team C nêu trên. File không tạo bài nộp hay kết quả chấm. Scheduler ứng dụng thực hiện việc bắt đầu và tạo audit/outbox.

1. Trước khi đổi fixture thời gian, có thể dừng backend và sao chép file database sang một tên backup mới. Khởi động lại đúng launcher ở bước 2.
2. Mở `http://localhost:8080/h2-console`, dùng driver `org.h2.Driver`, user `sa`, mật khẩu trống. JDBC URL trỏ đúng database đang chạy, dùng đường dẫn tuyệt đối:

   ```text
   jdbc:h2:file:D:/SE172316/Semeter 6/HCM26_CPL_JAVA_10/backend/data/fams_lms_after_merge;IFEXISTS=TRUE;DB_CLOSE_ON_EXIT=FALSE
   ```

3. Trong `01-start-c.sql`, chạy câu SELECT đầu tiên để kiểm tra đúng hai team rồi mới chạy khối UPDATE/COMMIT. Nếu thiếu team, quay lại hoàn tất bước 3–4.
4. Chờ một chu kỳ scheduler (mặc định khoảng 60 giây), tải lại Workspace → Milestone. Trạng thái phải thành `IN_PROGRESS`. Sau khi nhận trạng thái này mới cho student thao tác artifact.
5. DASH-D chưa chạy file bắt đầu, nên giữ **Chưa bắt đầu** để đối chiếu.

Các file SQL này là chuẩn bị fixture thời gian ở local, không chứng minh validation/scheduler ngày tương lai chạy end-to-end. Muốn kiểm tra lịch tự mở qua UI đầy đủ, tạo milestone với ngày bắt đầu hợp lệ và kiểm tra lúc tới ngày đó.

## 6. Ca C-RISK: làm một phần rồi dừng

1. Vào Workspace của DASH-C-RISK → Backlog. Tạo/chọn **4 backlog item cấp trên cùng**, liên kết cả bốn với **M1 - Analysis**; nếu dùng Board thì tạo Sprint của đúng team và đưa các item vào Sprint đó.
2. Giữ M2/M3 chưa có item Done. Chuyển đúng một item của M1 qua các trạng thái hợp lệ tới Done. Để ba item còn lại ở To do/In progress. Subtask không thay thế item cấp trên cùng trong công thức Reports.
3. Mở Dashboard → Filters → lớp DASH-C → Áp dụng → Xem chi tiết → milestone của DASH-C-RISK.
4. Kỳ vọng M1: **1/4 Done = 25%**; Project: **25% × 40% = 10%**. Project vẫn **Đang thực hiện**.
5. Nếu M1 còn trong 48 giờ tới (vừa tạo với Due after 1 day), M1 phải nằm trong **Sắp hạn · Có rủi ro**, vì tiến độ dưới 50%. Đối chiếu deadline thực tế trước khi kết luận.

**Dừng tại đây cho C-RISK.** Chưa submit, chưa accept M1; không kéo hết item sang Done. Chụp Workspace/Board và Dashboard để đối chiếu.

Ca lỗi nhỏ: thử URL không hợp lệ khi soạn artifact, đóng form sau khi thấy validation; không tạo bài nộp thành công cho team này trong luồng chính.

## 7. Ca C-REVIEW: lưu draft, submit, yêu cầu sửa, nộp lại

Dùng cửa sổ thường cho admin/teacher và cửa sổ riêng tư cho student, tránh thay nhầm tài khoản.

| Bước | Tài khoản / thao tác | Kết quả cần kiểm tra | Điểm dừng |
| --- | --- | --- | --- |
| 1 | `dash.c05@demo.example.test`, Workspace DASH-C-REVIEW → Milestone → Prepare and submit artifact của M1 | Đúng team/milestone; milestone đang `IN_PROGRESS` | Chưa nộp |
| 2 | Nhập URL HTTP(S) thật bạn dùng demo, release notes `C-REVIEW v1`; thử một URL sai rồi sửa lại | Lỗi URL được báo, không tạo submission thành công | Chụp validation |
| 3 | Lưu nháp, rời trang rồi mở lại | Nội dung draft còn; chưa được xem là đã nộp | Chụp draft |
| 4 | Hoàn tất các URL bắt buộc → Review & submit → Xác nhận | Version 1 `SUBMITTED`, thời điểm nộp; Dashboard **Đã nộp · Chờ chấm** | Chụp trạng thái chờ chấm trước khi review |
| 5 | Teacher: Workspace → Milestone → Review submissions → Review trên bản mới nhất | Đúng `C-REVIEW v1`, rubric/checklist của M1 | Không chọn Accept |
| 6 | Chọn rating cho mọi tiêu chí; ghi feedback từng tiêu chí và Revision instructions, ví dụ `Bo sung test case cho form tao workspace`; bấm **Request student revision**, xác nhận **Request changes** | `CHANGES_REQUESTED`; student thấy feedback; version cũ giữ nội dung | Chụp yêu cầu sửa |
| 7 | Student bấm Resubmit, sửa release notes thành `C-REVIEW v2 - da bo sung test case`, sửa URL nếu cần rồi nộp | Version 2 `SUBMITTED`; version 1 và feedback còn trong history | **Dừng, chưa Accept v2** |

Trong bước 4, thử mở lại form nộp khi version hiện tại vẫn `SUBMITTED`: hệ thống phải khóa/từ chối nộp tiếp cho tới khi reviewer yêu cầu sửa. Nếu Request revision bị khóa, kiểm tra quyền reviewer trực tiếp trên team và số lần được nộp lại; không sửa status trong database để vượt điều kiện.

Để có con số dễ đối chiếu cuối buổi, ở team C-REVIEW liên kết 4 item cấp trên cùng vào M1 và hoàn thành cả 4 qua workflow hợp lệ; M2/M3 giữ 0%. M1 đạt 100% theo task nhưng vẫn đang chờ chấm; Project đạt **40%**, trạng thái **SUBMITTED**. Đây là ca chứng minh **task Done không đồng nghĩa milestone Accepted hay Project hoàn thành**.

Nếu UI chưa hiện Review trên bản nộp mới nhất, ghi lại trạng thái và response lỗi; không đổi sang Accepted bằng SQL để làm đẹp kết quả.

## 8. Điểm dừng chính: ba team còn ba trạng thái khác nhau

Lọc theo template riêng của buổi demo, xóa các bộ lọc khác; dùng lớp để xem từng Master. Với số task/trọng số chính xác ở trên:

| Team | Trạng thái Reports | Tiến độ | Cần giữ |
| --- | --- | ---: | --- |
| DASH-C-RISK | Đang thực hiện | 10% | M1 mới 1/4 Done, chưa nộp |
| DASH-C-REVIEW | Đã nộp · Chờ chấm | 40% | Version 2 M1 đang `SUBMITTED` |
| DASH-D-FINISH | Chưa bắt đầu | 0% | Project `PLANNING`, chưa chạy bước 9 |

Master DASH-C = `(10 + 40) / 2 = 25%`. Khi lọc riêng team C-RISK, hàng Master vẫn lấy toàn bộ hai team C trong scope nên vẫn 25%, kèm 1/2 team khớp lọc. Đây là ca kiểm tra rollup không bị đổi theo team đang lọc.

Với bộ lọc chỉ ba team mới: có 2 lớp có dự án, 3 team, 3 Project, 2 Project đang thực hiện (`IN_PROGRESS + SUBMITTED`). Completion Rate = `0 / (1 + 1 + 0) = 0%`. Nếu không lọc riêng template, dữ liệu A/B/cũ sẽ làm tổng KPI khác các số này.

**Bạn có thể kết thúc buổi review ở đây và giữ nguyên bộ dữ liệu để demo lại.**

## 9. Tùy chọn: chỉ cho team D hoàn thành

Chỉ làm sau khi đã chụp điểm dừng chính, nếu cần trình bày trạng thái Hoàn thành:

1. Trong H2 Console, preview rồi chạy `02-start-d.sql`; chờ scheduler và kiểm tra M1/M2/M3 thành `IN_PROGRESS`.
2. Student `dash.d01@demo.example.test` lần lượt soạn và nộp từng milestone. Sau mỗi lần nộp, teacher vào đúng **Review submissions → Review**.
3. Chọn rating cho mọi criterion và kiểm tra đủ checklist mandatory, rồi **Accept submission**. Có thể thử thiếu một mục checklist để chụp lỗi validation trước khi chọn đầy đủ.
4. Sau khi chỉ M1 Accepted, mở Dashboard: D chưa DONE vì M2/M3 còn chưa Accepted. Tiếp tục chỉ trên team D.
5. Khi toàn bộ milestone active của D được Accepted, Reports hiển thị **Hoàn thành, 100%**. Đây là trạng thái suy ra của Reports; Project có đổi hẳn sang `COMPLETED` còn phụ thuộc workflow hoàn thành/khóa điểm của module Project.

**Dừng sau D.** C-RISK vẫn 10% đang làm, C-REVIEW vẫn 40% chờ chấm. Chỉ một team hoàn thành. Completion Rate ba team = `1 / (1 + 1 + 1) = 33,33%`; tiến độ trung bình ba Project = `(10 + 40 + 100) / 3 = 50%`.

## 10. Tùy chọn: quá hạn hiện tại và lịch sử nộp trễ

Làm sau khi lưu ảnh/export của luồng chính vì các bước này sẽ thay đổi trạng thái C-RISK.

1. Trước khi C-RISK có bài nộp M1, chạy phần preview rồi UPDATE trong `03-overdue-c1.sql`. File chỉ đặt deadline M1 của đúng team về 5 phút trước và cho trễ thêm 2 ngày; không tạo submission/review.
2. Refresh Dashboard: C-RISK có **Đang quá hạn**, nằm trong bộ lọc **Đang cần xử lý** và **Overdue / Có lần nộp trễ**. Vì deadline đã qua, badge Sắp hạn không còn áp dụng cho M1.
3. **Dừng ở đây** nếu muốn giữ cảnh báo quá hạn để demo nhiều lần.
4. Chỉ khi cần trình bày lịch sử: student C01 nộp M1 trong cửa sổ cho trễ. Kiểm tra thời gian nộp sau deadline, nhãn Late và mức phạt; không nộp sau `lateUntil`.
5. Dashboard không còn tính M1 đang quá hạn khi đã `SUBMITTED`, nhưng vẫn có **Có lần nộp trễ**. Team còn trong bộ lọc gồm lịch sử trễ; việc còn trong Đang cần xử lý phụ thuộc các milestone còn lại.
6. **Dừng ở SUBMITTED** để giữ ca Late đang chờ chấm. Chưa Accept các milestone còn lại của C-RISK.

Không đổi deadline của bài đã nộp để tạo lịch sử trễ giả. Muốn kiểm tra từ chối sau cutoff/Reject, dùng thêm một milestone thử riêng; các thao tác kết thúc này không dùng trên M1 đang cần giữ để review.

## 11. Ca đọc dữ liệu, bộ lọc, quyền và export

| Ca | Thao tác | Kết quả kỳ vọng |
| --- | --- | --- |
| Lọc theo lớp | Chọn DASH-C trong Filters nhưng chưa Áp dụng, rồi bấm Áp dụng | Kết quả chỉ đổi theo bộ lọc sau khi áp dụng |
| Tìm kiếm | Tìm mã Project `DASH-C-T...` thực tế hoặc tên team; bỏ từ khóa sau khi chụp | Chỉ còn Project khớp, không sửa tiến độ/trạng thái |
| Lọc trạng thái | Bấm chú giải Đang thực hiện / Đã nộp trên biểu đồ | Team hiển thị khớp trạng thái, chip lọc cập nhật |
| Rollup | Lọc riêng C-RISK, mở Master | 1/2 team khớp; Master C vẫn tính trên cả hai team trong scope |
| Drilldown | Master → Xem chi tiết → số milestone được chấp nhận | Đúng team, trọng số, deadline, số Done/tổng |
| Đọc không gây thay đổi | Refresh Dashboard nhiều lần, quay lại Workspace | Không tự Accepted/Completed; không phát sinh review do xem báo cáo |
| Export | Lọc C hoặc template riêng → xuất Excel/CSV → chờ Sẵn sàng tải | File khớp bộ lọc, có thời điểm dữ liệu; kiểm tra code/team và tiến độ |
| Student | Đăng nhập C01 và thử mở `/management/reports/projects` | Không được xem Reports nếu không có `PROJECT_REPORT_READ`; Workspace trong scope vẫn theo quyền |
| Mentor | Đăng nhập teacher đã gán trực tiếp cho ba team | Thấy các team thuộc scope, không tự thấy mọi team khác chỉ vì cùng lớp |
| Không có kết quả | Tìm từ khóa không tồn tại | Empty state, không giữ kết quả/bảng cũ như thể còn khớp |

## 12. Ghi nhận và thực hành lại

Mỗi ca ghi: tài khoản, lớp/team, thao tác, kết quả mong đợi, kết quả thực tế, ảnh trước/sau. Đừng gộp “API chạy xong” thành bằng chứng mọi trạng thái đã đúng. Ví dụ lời trình bày:

> Team C-RISK mới làm được 10% và đang có rủi ro sắp hạn. Team C-REVIEW đã nộp v2, còn chờ mentor chấm. Team D chưa bắt đầu; phần hoàn thành sẽ được demo riêng trên D.

Các ca tìm kiếm/lọc/export/đọc có thể lặp lại trên cùng dữ liệu. Ca submit/resubmit/accept tiêu thụ trạng thái; để demo lại hãy giữ các điểm dừng, dùng milestone/team thử mới, hoặc khôi phục một bản sao riêng lúc backend đã dừng. Không cần đẩy tất cả team về Completed sau mỗi lượt.

## 13. Kết quả chuẩn bị và công cụ tái tạo

Đã thử trên bản sao rồi mới áp dụng vào database local. Kiểm tra 131 bảng: mọi dòng cũ giữ nguyên; chỉ thêm 2 `TRAINING_CLASSES`, 12 `USERS`, 12 `USER_ROLES`, 12 `CLASS_MEMBERS`, 2 `CLASS_STAFF_ASSIGNMENTS`. Kiểm tra lại sau khi ghi: C/D vẫn 0 phiên chia nhóm, 0 team; cả 12 mật khẩu hợp lệ. Chưa chạy các kịch bản UI thay bạn.

Ba file SQL đã được kiểm tra SELECT và `EXPLAIN UPDATE` trên schema H2 hiện tại ở chế độ chỉ đọc. Các câu UPDATE này chưa được thực thi trên C/D; bạn chọn chạy đúng bước sau khi tự tạo team/workspace. Kiểm tra cú pháp không thay cho việc demo UI và quan sát scheduler thực tế.

Backup trước khi thêm: `backend/data/backups/dashboard-review-20261105-103019-875/before.mv.db`. Cùng thư mục có `prepared.properties`, `rehearsal.txt`, `applied.txt`, `verified.txt` để đối chiếu.

`Prepare-DashboardReview.ps1` và `AddDashboardReviewClasses.java` chỉ phục vụ chuẩn bị local, không phải seeder chạy cùng ứng dụng. `prepare` sao lưu và thử trên bản sao; `apply` chỉ chạy nếu hash database/backup còn khớp; lần chạy lại sẽ từ chối ghi đè C/D. `verify` kiểm tra bộ dữ liệu mới còn sạch, nên chỉ dùng trước khi bạn tự chia nhóm:

```powershell
.\docs\dashboard-review\Prepare-DashboardReview.ps1 -Mode verify -BackupDirectory 'D:\SE172316\Semeter 6\HCM26_CPL_JAVA_10\backend\data\backups\dashboard-review-20261105-103019-875'
```

Database, backup và mật khẩu học viên demo nằm local; file `.mv.db` được Git bỏ qua. Push tài liệu/công cụ không tự đưa lớp C/D sang máy người khác. Không chạy `apply` lại trên máy này vì hai lớp đã được tạo.
