# Kiểm thử US-PRJ-001-02 — Overview và Members

Cập nhật 24/10/2026. UI dùng English; phần hướng dẫn dùng tiếng Việt. Hãy kiểm thử trên database local của bài làm.

## 1. Chuẩn bị một lần

1. Khởi động lại backend sau khi lấy code mới. Đợi Spring Boot khởi động xong.
2. Chạy frontend, mở http://localhost:5173/login.
3. Nếu đang mở app cũ, nhấn Ctrl + Shift + R, rồi đăng xuất và đăng nhập lại. Quyền cũ trong localStorage không tự biến thành quyền mới.
4. Dùng ba tài khoản sẵn có bên dưới. Password seed là password123 nếu bạn chưa đổi; không cần tài khoản workspace.*.demo nữa.
5. Mở hai cửa sổ: cửa sổ thường cho admin/teacher, cửa sổ ẩn danh cho student. Đừng đổi tài khoản liên tục trong cùng tab khi đang so sánh.

| Tài khoản | Quyền Workspace mặc định | Dùng để test |
| --- | --- | --- |
| admin@example.com | Toàn bộ quyền; truy cập team trong tenant | Chuẩn bị dữ liệu, xem mọi workspace trong tenant, quản lý thành viên, cấu hình quyền |
| teacher@example.com | WORKSPACE_READ, WORKSPACE_MEMBER_READ, WORKSPACE_CREATE, TEAM_READ, TEAM_UPDATE | Mentor của Atlas/Nova/Pixel/Horizon, tạo workspace và phân vai trò trong scope |
| student@example.com | WORKSPACE_READ, WORKSPACE_MEMBER_READ | Xem Atlas/Pixel nếu membership còn ACTIVE; không tạo workspace, không sửa roster/role |

Project Management chỉ có Workspace. “Manage members” ở Workspace → Open workspace → Members. Tên trang/breadcrumb là Workspace; nút Create workspace vẫn dùng để tạo mới.

Đây là hai loại role khác nhau:
- Role hệ thống ADMIN/STUDENT/TEACHER cấp quyền thao tác.
- Project role UNASSIGNED/TEAM_LEADER/DEV/FE_DEV/BE_DEV/BA/QA/TESTER mô tả vai trò trong từng team.
- Đổi Project role không thay Role hệ thống. Một Student chưa được phân vai trò vẫn hiển thị Unassigned role.

Các account workspace.viewer.demo / workspace.mentor.demo / workspace.member.demo ngừng được tạo. Nếu đã có dữ liệu cũ, chúng bị khóa/vô hiệu hóa và membership cũ chuyển LEFT; lịch sử được giữ. Không xóa workspace để chuyển tài khoản.

## 2. Dữ liệu để kiểm thử

| Team | Dữ liệu khởi tạo | Người được phân công |
| --- | --- | --- |
| Team Pixel | Student Support Portal; đã có workspace; snapshot v1.0.0; student là member | teacher là mentor; student xem được |
| Team Nova | Learning Resource Hub; chưa có workspace ở database mới; snapshot v1.0.0; admin là member | teacher là mentor; student không thuộc team này |
| Team Atlas | No project; student là member; chưa có workspace ở database mới | teacher là mentor |
| Team Horizon | No project; không có member | teacher là mentor; không tạo được workspace khi team rỗng |
| Team Completed | Project COMPLETED; admin là member | admin kiểm tra; không tạo mới workspace từ project COMPLETED |

Nếu bạn từng tạo workspace/đổi roster, ID và trạng thái hiện tại được giữ lại. Không giả định ID là 5, 7 hay 10. Bộ seed không phục hồi một member bạn đã chuyển LEFT; hãy dùng Manage members để phục hồi trước khi test lại.

Để test bắt đầu dễ nhất, dùng Team Pixel. Nếu student không còn ACTIVE: đăng nhập teacher/admin → Pixel → Members → Manage members → chọn Participation = Active cho student → Save → Done.

Để có workspace B cho AC01/AC09: dùng teacher → Workspace → dòng Team Nova → Create workspace → chọn Team Nova và project của team → Continue → kiểm tra thông tin → Confirm creation. Nếu Nova đã có rồi thì bấm Open workspace. Không tạo lại để “reset”.

## 3. Chuẩn bị Postman bằng file có sẵn

1. Mở Postman → Import → chọn file US02_STANDARD_ACCOUNTS.postman_collection.json trong cùng thư mục này.
2. Collection có biến baseUrl = http://localhost:8080. Đây là địa chỉ backend, không dùng cổng frontend 5173 cho API.
3. Nếu Environment hiện tại cũng có baseUrl/token/workspaceId, bỏ chọn Environment đó hoặc đổi tên biến trùng. Environment có thể ghi đè biến Collection.
4. Mở lần lượt Login admin, Login teacher, Login student → Send.
5. Các script tự lưu adminToken, teacherToken, studentToken. Không dán cả JSON hoặc chữ Bearer vào ô token.
6. Send “Discover Team Pixel IDs”. Script tự lấy workspaceId, teamId, projectId.
7. Các request sau dùng đúng biến đó. Trong response xem cả HTTP status, Body và Test Results.
8. Có thể chạy cả Collection trước khi thay roster/quyền. Collection chỉ login và đọc; không tạo workspace. Request Invalid session cố ý trả 401, Missing workspace cố ý trả 404, Student management cố ý trả 403; Test Results vẫn phải PASS.
9. Sau đó làm các bước UI/chuẩn bị dữ liệu dưới đây. Collection không tự chứng minh trạng thái loading, thay đổi nguồn đề bài, thu hồi quyền hoặc tenant inactive.

Nếu làm request thủ công:
- Method GET, URL ví dụ {{baseUrl}}/api/workspaces/{{workspaceId}}.
- Authorization → Bearer Token → {{teacherToken}} hoặc {{studentToken}}.
- GET không cần Body.
- Với PUT, Body → raw → JSON và Content-Type: application/json.

## AC01 — Đúng workspace, không dùng nhầm dữ liệu cũ

1. Đăng nhập teacher. Mở Team Pixel từ Workspace.
2. Ghi lại URL /management/workspaces/A, project Student Support Portal, team Team Pixel và project code.
3. Trong Postman gửi GET /api/workspaces/A bằng teacherToken. Đối chiếu id, projectId/projectName/projectCode, teamId/teamName với UI và dòng danh sách.
4. Bấm Workspace list, mở Team Nova. Ghi lại workspace B. Kiểm tra các trường đã đổi sang Learning Resource Hub / Team Nova.
5. Copy URL B, mở trong tab khác với cùng account. Vẫn phải thấy đúng Nova.
6. Trong Chrome DevTools → Network chọn Slow 3G, quay lại Pixel rồi Nova. Trong lúc tải phải thấy loading, không thấy brief/member cũ của Pixel trong nội dung Nova. Đổi lại No throttling sau test.

PASS: dữ liệu đúng theo từng ID; mở URL trực tiếp cũng đúng; không có nội dung cũ của workspace khác.
Bằng chứng: AC01-Pixel.png, AC01-Nova.png kèm URL; response hai ID.

## AC02 — Snapshot/version cố định

1. Mở Pixel → Overview; chụp topic code, topic title, Version v1.0.0, Description, Objectives, Requirements.
2. Gửi request Overview trong Collection để lưu fixedSnapshot.
3. Ở phân hệ Curriculum, cập nhật nguồn đề bài sang version mới nếu phân hệ đó đã có. Không sửa snapshot của Project.
4. Reload Pixel và gửi request “Snapshot remains fixed”.
5. So sánh nội dung: vẫn v1.0.0 và nội dung đã chụp.

Trong codebase hiện tại chưa có API/UI cập nhật nguồn Curriculum. Để kiểm thử độc lập bằng dữ liệu mock local:
- Mở H2 Console http://localhost:8080/h2-console, đăng nhập đúng JDBC URL của backend đang chạy (mặc định jdbc:h2:file:./data/fams_lms; user sa, password trống nếu chưa cấu hình khác).
- Chạy AC02_SOURCE_SETUP.sql đi kèm. Script tạo một bảng nguồn đề bài dùng riêng cho kiểm thử, copy dữ liệu v1 từ Pixel nếu chưa có, rồi đổi nguồn minh họa sang v2.0.0.
- Chụp SELECT nguồn v2 và snapshot v1 ở cuối script, sau đó reload UI/Send lại Overview. Nội dung snapshot phải giữ nguyên.
- Đây là bằng chứng Workspace đọc bản lưu độc lập. Nghiệm thu tích hợp đầy đủ với Curriculum vẫn cần bước cập nhật qua phân hệ sở hữu nguồn khi API đó có sẵn.

PASS: nguồn mới không làm thay đổi snapshot của Project. Chỉ Send GET hai lần mà không đổi nguồn chưa đủ chứng minh toàn bộ AC02.
Bằng chứng: AC02-source-v2-and-snapshot-v1.png + AC02-overview-still-v1.png.

## AC03 — Danh sách đúng team, đủ trường và không trùng

1. Teacher → Pixel → Members.
2. Mỗi dòng phải có Member code, Display name, Project role, Status. Student mặc định là John Doe; mã SE... lấy từ User.user_code.
3. Send GET /api/workspaces/{{workspaceId}}/members bằng teacherToken. Body là mảng, mỗi phần tử chỉ có user_code, display_name, project_role, status.
4. Đối chiếu số dòng với member_count ở Overview. Chỉ membership ACTIVE còn hiệu lực xuất hiện.
5. Sang Nova → Members: phải là roster Nova, không tự lấy roster Pixel.
6. Không bấm Add member để “sửa số lượng” khi chỉ đang xem. Nếu có dòng trùng cùng một member code thì FAIL.

PASS: đúng roster, đúng bốn trường, không trùng quan hệ thành viên.
Bằng chứng: UI Members + response tương ứng; Collection có assertion kiểm tra bốn field, ACTIVE và số lượng.

## AC04 — Vai trò chưa phân công

1. Teacher/admin → Pixel → Members → Manage members.
2. Ở student, chọn Project role = Unassigned role → Save → Done.
3. Members phải hiện Unassigned role. API /members phải có project_role = UNASSIGNED.
4. Role hệ thống của account vẫn STUDENT; không tự biến thành Developer/Team leader.
5. Để kiểm tra dropdown hoạt động: đổi sang Frontend developer → Save → Done; refresh tab student và kiểm tra FE_DEV. Cuối cùng đổi về Unassigned role nếu chuẩn bị lại baseline.

PASS: role dự án lấy từ membership, không suy diễn từ role hệ thống.
Bằng chứng: ảnh dropdown, UI Unassigned role, response UNASSIGNED.

## AC05 — Đồng bộ roster và giữ lịch sử

1. Mở Pixel bằng teacher/admin; ghi lại workspaceId, member_count, danh sách và tab Activity.
2. Members → Manage members → Add an existing user → chọn admin (hoặc account có sẵn khác chưa ở team) → chọn Developer → Add member → Done.
3. Refresh workspace/student tab. Overview count tăng 1; Members có user vừa thêm. workspaceId giữ nguyên.
4. Teacher/admin → Manage members → ở user vừa thêm, chọn Participation = Left → Save → Done.
5. Refresh: user đó biến mất khỏi danh sách ACTIVE và count giảm 1. Manage members vẫn giữ dòng LEFT để khôi phục; không tạo bản ghi trùng.
6. Tab Activity vẫn giữ sự kiện và actor cũ. Đổi roster không xóa lịch sử workspace.
7. Chọn lại Participation = Active để kiểm tra tái tham gia; số dòng không bị nhân đôi. Sau test trả user thêm tạm về Left.
8. Nếu test cho student LEFT, account student sẽ mất scope và nhận 403 cho workspace đó. Dùng teacher/admin để khôi phục student Active, không tự thêm người đang xem qua GET.

API cập nhật tương ứng (chỉ teacher có scope/admin):
PUT /api/project-hub/teams/{{teamId}}/members/USER_ID

~~~json
{
  "projectRole": "DEV",
  "status": "ACTIVE"
}
~~~

USER_ID lấy từ management roster/member-options; không đoán ID và không dùng member_code thay cho userId. Các trường hợp status hợp lệ: ACTIVE, INACTIVE, LEFT.
PASS: count/danh sách đồng bộ khi refresh; workspace không tạo lại; lịch sử còn; không trùng membership.

## AC06 — Chỉ có quyền Overview, thiếu quyền Members

Không cần tạo account demo mới. Tạm thu hồi WORKSPACE_MEMBER_READ của STUDENT bằng admin:

1. Admin → RBAC Management → Roles → tìm STUDENT → Edit.
2. Ghi lại các permission hiện tại. Bỏ chọn duy nhất WORKSPACE_MEMBER_READ; giữ WORKSPACE_READ và các quyền học tập khác → Save.
3. Student đăng xuất/đăng nhập lại. Postman Send Login student để cập nhật token. Không dùng token admin để test ca này.
4. Student mở Pixel → Overview: vẫn thấy project/team/snapshot và số lượng thành viên.
5. Members hiển thị You do not have permission to view member details. Không có Manage members.
6. Send GET /api/workspaces/{{workspaceId}}/members bằng studentToken: HTTP 403, không có roster.
7. GET Overview vẫn HTTP 200, can_view_members=false, member_count vẫn có và không có field members.
8. Kết thúc: admin cấp lại WORKSPACE_MEMBER_READ cho STUDENT. Student login lại và kiểm tra /members trở về 200.

Không restart backend giữa bước 2–7: RoleDataInitializer thiết lập lại quyền mặc định khi startup. Nếu màn hình Roles có quy định khóa role mặc định trong nhánh chung của nhóm, dùng API/quy trình quản lý quyền được nhóm cho phép hoặc mô phỏng trên H2 local; không bỏ qua bước kiểm tra response 403.

PASS: chỉ chặn chi tiết roster; Overview vẫn dùng được. Chụp cả 200 Overview và 403 Members cùng account student.

## AC07 — Thông tin trống, team rỗng

Phần A — Mô tả/mục tiêu:
1. Mở H2 Console của database local đang chạy.
2. Chạy AC07_EMPTY_INFO_SETUP.sql. Script backup Description/Objectives của snapshot Pixel trước khi đặt NULL.
3. Refresh Pixel → Overview: Description và Objectives hiện No information available, không hiện undefined/null hoặc nội dung live khác.
4. Chạy AC07_EMPTY_INFO_RESTORE.sql để khôi phục đúng nội dung đã backup. Không xóa database.

Phần B — Team không có thành viên hiện tại:
1. Dùng teacher/admin → Pixel → Members → Manage members.
2. Chuyển tất cả member hiện có của Pixel sang Left → Save từng dòng → Done. Teacher là mentor nên vẫn mở được workspace.
3. Refresh: Overview 0 active members, Members No team members.
4. Reload hoặc Send GET nhiều lần. Team vẫn rỗng; viewer/teacher không tự được thêm vào roster.
5. Khôi phục student Active; các member thêm tạm có thể giữ Left.

Team Horizon rỗng nhưng chưa có workspace, nên không dùng thao tác Create workspace cho AC07. Ca này kiểm tra workspace đã tồn tại sau khi roster thay đổi.
PASS: rỗng là trạng thái hợp lệ; không tự thêm người xem; sau khi restore dữ liệu bình thường.

## AC08 — Không lộ dữ liệu nhạy cảm

1. Chuẩn bị student ACTIVE ở Pixel và có đủ hai quyền xem.
2. Đăng nhập Postman bằng student; Send Overview và Members.
3. Kiểm tra Body: không password/passwordHash/token/accessToken/refreshToken/email/phone; không draftScores hoặc unreleasedFeedback.
4. Members chỉ bốn field đã chốt. Overview không kèm mảng members.
5. Trong browser student, DevTools → Network → chọn request → Response để đối chiếu. Đừng chỉ nhìn UI.
6. Collection có kiểm tra đệ quy các tên field bị cấm. Thực hiện thêm với teacher nếu muốn đối chiếu.
7. Endpoint Login phải trả access token để đăng nhập; token ở response Login không phải lỗi AC08. AC08 áp dụng API dữ liệu Workspace/Members.

Code hiện chưa có chức năng nộp/chấm điểm hoặc feedback nháp trong module này. Response hiện tại không chứa các trường đó; khi tích hợp module assessment cần có dữ liệu unpublished thật để nghiệm thu thêm.
PASS: không có restricted fields trong response, kể cả phần tổng hợp.

## AC09 — 401 / 403 / 404

Chụp ba nhóm kết quả riêng, không dùng một response cho mọi trường hợp.

| Ca | Thao tác | Kết quả |
| --- | --- | --- |
| 401 phiên sai | Collection Invalid session gửi Authorization: Bearer invalid-token-for-ac09 | 401 |
| 403 thiếu quyền Members | Các bước AC06, student GET /members | 403 |
| 403 ngoài scope | Tạo/mở Nova; đảm bảo student không có membership ACTIVE ở Nova; student GET Overview Nova | 403, không dữ liệu Nova |
| 403 tenant inactive | Dùng token hợp lệ đã cấp, tạm đặt tenant ACTIVE=false trên H2 local, gửi Overview Pixel rồi khôi phục ngay | 403 |
| 404 không tồn tại | Admin GET /api/workspaces/9223372036854775807 | 404 |

Nếu muốn test No Auth thay vì token sai: Postman Authorization → No Auth, bỏ header Authorization cũ và tắt cookie jar/clear cookie cho localhost trong request đó. Cookie phiên còn lưu có thể làm request vẫn được nhận diện là đăng nhập.

Tenant inactive dùng SQL local sau; chạy SELECT để xác nhận trước, và phải chạy lệnh khôi phục sau kiểm tra:

~~~sql
SELECT id, code, active FROM tenants
WHERE id = (SELECT tenant_id FROM users WHERE email = 'student@example.com');

UPDATE tenants SET active = FALSE
WHERE id = (SELECT tenant_id FROM users WHERE email = 'student@example.com');

-- Sau khi chụp response 403, khôi phục ngay:
UPDATE tenants SET active = TRUE
WHERE id = (SELECT tenant_id FROM users WHERE email = 'student@example.com');
~~~

Đừng đăng xuất/restart giữa lúc tenant inactive để rồi mất token chuẩn bị. Không test tenant inactive trên môi trường dùng chung của nhóm.
PASS: đúng status và response lỗi không chứa dữ liệu workspace.

## AC10 — Loading, lỗi/thử lại và chỉ đọc

Loading:
1. Chrome F12 → Network → chọn Slow 3G.
2. Mở Pixel từ Workspace: thấy Loading workspace...
3. Mở Members: thấy Loading members...
4. Chụp hai trạng thái rồi trả No throttling.

Lỗi/thử lại:
1. F12 → Network → tìm request GET /api/workspaces/ID/members.
2. Chuột phải request → Block request URL (Chrome). Refresh hoặc mở lại tab Members.
3. Phải thấy Unable to load members + Try again. Không được hiện No team members vì đây là lỗi tải.
4. Mở Network request blocking, bỏ chặn URL đó.
5. Bấm Try again: danh sách tải thành công.
6. Lặp lại với GET /api/workspaces/ID: thấy Unable to open workspace, rồi bỏ chặn và Try again.

Chỉ đọc:
1. Ghi lại workspaceId, projectStatus, member_count và roster trước khi test.
2. Chỉ mở/reload Overview/Members, bấm Refresh, đổi workspace hoặc Try again. Không bấm Create workspace, Save charter hay Save/Add member.
3. Network không có POST/PUT/PATCH/DELETE tới Workspace hoặc Team Management do các thao tác xem này.
4. Kiểm tra lại ID, projectStatus, roster không đổi. Token refresh/auth có thể dùng POST /auth/refresh; đó không phải ghi dữ liệu workspace.
5. Test tự động WorkspaceOverviewIntegrationTest cũng đối chiếu count các bảng nghiệp vụ và project status trước/sau GET.

PASS: loading có hiển thị; lỗi khác dữ liệu rỗng; Retry hoạt động; GET không tạo workspace, thêm member hoặc đổi project status.

## 4. Kết thúc và lưu bằng chứng

- Student đã được cấp lại WORKSPACE_MEMBER_READ và membership Pixel Active.
- Tenant active = TRUE.
- Khôi phục text snapshot bằng script restore.
- Trả các member thêm tạm về Left hoặc trạng thái trước test.
- Tắt Network throttling và Request blocking.
- Chụp status + Body/Test Results, không chụp token đang mở.
- Đặt tên ảnh theo AC và bước. Ghi Expected/Actual/PASS-FAIL riêng cho mỗi ca; đừng ghi PASS cho phần chưa chuẩn bị được dữ liệu.

Collection JSON kiểm tra các response có thể tự động. Các ca loading, role dropdown, chuyển workspace, thay nguồn, thiếu quyền, empty roster và tenant inactive cần thao tác/chuẩn bị như hướng dẫn; chỉ chạy Collection chưa thay thế được toàn bộ nghiệm thu UI.

