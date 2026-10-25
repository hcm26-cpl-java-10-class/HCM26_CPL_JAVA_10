# US-PRJ-001-03 — Hướng dẫn triển khai theo codebase hiện tại

Đây là **hướng dẫn và mã tham chiếu**. Source chính của ứng dụng chưa được áp dụng US03 trong lượt này. Bản tham chiếu được build/test trong thư mục kiểm chứng riêng. Bạn có thể đọc từng bước rồi tự áp dụng vào project.

UI dùng tiếng Anh, giữ MainLayout, Radix Tabs, Card, Button, Dialog, bảng thành viên và cơ chế JWT/refresh token đang có. Không thêm dependency và không tạo lại Project Template.

## 1. Hiểu đúng phạm vi

US03 quản lý **điều hướng và kiểm soát truy cập** của 8 phân mục: Overview, Members, Milestone, Sprint, Backlog, Artifact, Feedback, Activity.

Các thao tác tạo task, nộp artifact và review được expose để kiểm thử quyền. Với 5 phân mục chưa có model nghiệp vụ, POST/PUT chỉ cập nhật dữ liệu mock trong bộ nhớ. Đây chưa phải CRUD nghiệp vụ hoàn chỉnh: chưa upload file, chưa quản lý deadline/rubric hay tự nghiệm thu giai đoạn. Dữ liệu mock mất khi restart backend.

Overview, Members, Team charter, tenant, project/team, roster và lịch sử workspace tiếp tục dùng dữ liệu thật của US01/US02. Activity đọc lịch sử có sẵn từ database. Không tạo user demo mới.

Luồng đọc:

1. Frontend lấy workspaceId từ URL.
2. GET /api/workspaces/{id}/sections kiểm tra người dùng, tenant, workspace và scope, rồi trả ngữ cảnh và quyền hiện tại của từng tab.
3. Frontend bật/tắt tab theo response này và quyền của vai trò đang xem.
4. Tab đang chọn tự gọi API của nó. Backend kiểm tra lại toàn bộ quyền/ngữ cảnh; không tin manifest hay quyền frontend.
5. Tab tự hiển thị loading, dữ liệu, empty state hoặc lỗi/retry.

URL trực tiếp giữ cấu trúc router hiện có:

    http://localhost:5173/management/workspaces/5?tab=milestones

Thay 5 bằng workspaceId thật. Các giá trị tab: overview, members, milestones, sprints, backlog, artifacts, feedback, activity. Không cần thêm route mới.

## 2. Bảng quyền đã chốt

| Chức năng | Admin / PM | Teacher | Student |
|---|---|---|---|
| Xem workspace | WORKSPACE_READ | WORKSPACE_READ | WORKSPACE_READ |
| Xem thành viên chi tiết | WORKSPACE_MEMBER_READ | WORKSPACE_MEMBER_READ | WORKSPACE_MEMBER_READ |
| Xem Milestone | MILESTONE_READ | MILESTONE_READ | MILESTONE_READ; chỉ published |
| Tạo/review Milestone | MILESTONE_WRITE | MILESTONE_WRITE | Không |
| Xem Sprint/Backlog | SPRINT_READ | SPRINT_READ | SPRINT_READ |
| Tạo Sprint | SPRINT_WRITE | SPRINT_WRITE | Không |
| Tạo/sửa task | SPRINT_WRITE | SPRINT_WRITE | TASK_WRITE |
| Xem Artifact | ARTIFACT_READ | ARTIFACT_READ | ARTIFACT_READ |
| Tạo Artifact | ARTIFACT_WRITE | ARTIFACT_WRITE | Không |
| Nộp Artifact | ARTIFACT_SUBMIT | Không | ARTIFACT_SUBMIT |
| Review Artifact | ARTIFACT_REVIEW hoặc FEEDBACK_WRITE | Tương tự | Không |
| Xem Feedback | FEEDBACK_READ | FEEDBACK_READ | FEEDBACK_READ; chỉ published |
| Tạo Feedback | FEEDBACK_WRITE | FEEDBACK_WRITE | Không |
| Review Sprint | MILESTONE_WRITE | MILESTONE_WRITE | Không |
| Xem Activity | WORKSPACE_ACTIVITY_READ | WORKSPACE_ACTIVITY_READ | WORKSPACE_ACTIVITY_READ |

SPRINT_WRITE cho phép quản lý sprint và task; TASK_WRITE cho phép Student thao tác task mà không tạo sprint. Vì vậy action tạo/sửa task chấp nhận SPRINT_WRITE **hoặc** TASK_WRITE, không cần gán thêm TASK_WRITE cho Teacher/PM.

Mọi action còn yêu cầu READ của chính phân mục đó và WORKSPACE_READ. Ví dụ có ARTIFACT_REVIEW nhưng thiếu ARTIFACT_READ vẫn không được review. Đây là quy ước triển khai cho “quyền xem và quyền thao tác”.

TEAM_UPDATE vẫn là quyền quản lý roster/project role/charter hiện có. Nó không tự cấp quyền tạo milestone hay nộp artifact.

RoleDataInitializer cập nhật ba role có sẵn ADMIN, TEACHER, STUDENT. Nếu đã có role PM thì bổ sung quyền module cho PM, không tạo PM hoặc cấp quyền toàn hệ thống. Phân công/scope vẫn phải hợp lệ; có quyền không có nghĩa được đọc workspace của mọi team.

## 3. Những phần tận dụng từ project

- WorkspaceAccessService: đọc user từ phiên hiện tại, kiểm tra trạng thái user/tenant, granular permission và quan hệ project-team/scope.
- WorkspaceController, WorkspaceReadService: giữ API Overview và Members của US02.
- WorkspaceRepository, WorkspaceActivityRepository: giữ workspace và lịch sử hiện tại.
- WorkspacePermissionInitializer và RoleDataInitializer: bổ sung permission bằng đúng cơ chế seed đang dùng.
- usePermissions và RoleSwitchContext: dùng quyền UI hiện tại; chuyển role tạo lại ngữ cảnh query.
- workspaceApi dùng axios chung: giữ nguyên refresh token/redirect khi phiên không còn hợp lệ.
- WorkspaceOverviewPanel, WorkspaceMembersPanel, TeamCharterForm, WorkspaceMemberManagementDialog: tận dụng UI đang có.

**Giữ nguyên package Java hiện tại**: com.example.starter_project_2025.system.project. Codebase đang đặt file trong nhiều thư mục con nhưng dùng cùng package này. Không tự đổi package theo đường dẫn trong US03.

## 4. Cách dùng bộ mã tham chiếu

Mở file FULL_CODE.md cùng thư mục để xem toàn bộ code, hoặc mở các file trong reference. Cây reference giữ nguyên đường dẫn đích backend/... và frontend/....

Mỗi file mới: tạo file cùng đường dẫn trong source chính rồi dán toàn bộ nội dung. Mỗi file được sửa: so sánh source hiện tại với bản tham chiếu; nếu chưa có thay đổi mới sau hướng dẫn này thì có thể thay toàn bộ nội dung.

Có thêm Apply-Reference.ps1 để giảm thao tác sao chép. Script mặc định **chỉ kiểm tra và liệt kê**, không sửa file:

~~~powershell
Set-Location -LiteralPath 'D:\SE172316\Semeter 6\HCM26_CPL_JAVA_10'
& '.\docs\us-prj-001-03\Apply-Reference.ps1'
~~~

Sau khi đọc hướng dẫn và muốn áp dụng toàn bộ vào source chính:

~~~powershell
& '.\docs\us-prj-001-03\Apply-Reference.ps1' -Apply
~~~

Script kiểm tra source có còn giống baseline đã đọc không, rồi mới copy. Nếu source thay đổi, script dừng trước khi copy để tránh ghi đè nhầm. Script không cài thư viện, không chạy database, không commit/push.

### Bước 1 — Tách kiểm tra ngữ cảnh và định nghĩa DTO

Xem nhóm **Phase 1** ở danh mục file cuối tài liệu.

WorkspaceContextService.require(user, id) là chỗ dùng chung để xác định workspace có được phép mở không. Thứ tự: tenant hoạt động → workspace tồn tại → cùng tenant → workspace hoạt động → project/team/scope hợp lệ.

WorkspaceAccessService.permitted(user, permission) chỉ mở một wrapper public quanh cách kiểm tra role/permission ACTIVE hiện có. Không tạo cơ chế phân quyền thứ hai.

WorkspaceSectionDtos chứa DTO cho navigation, content, action và cấu hình mock:

~~~json
{
  "workspaceId": 5,
  "projectId": 15,
  "teamId": 17,
  "section": "milestones",
  "items": [
    {
      "id": "milestones-5-published",
      "title": "Workspace 5 · milestones",
      "description": "Published sample for project 15, team 17",
      "status": "OPEN",
      "published": true
    }
  ]
}
~~~

Danh sách rỗng là cùng envelope nhưng items: []. DTO chuẩn hóa này là contract của khung Workspace; khi module nghiệp vụ cần thêm deadline/assignee/repository URL, bổ sung trường một cách tương thích sau khi chốt contract với team phụ trách. Không serialize entity User/Team/Project vào response.

### Bước 2 — Khai báo policy và interface nguồn dữ liệu

Xem **Phase 2**.

WorkspaceSectionPolicy ánh xạ tab → READ permission; action → WRITE/SUBMIT/REVIEW permission. Tất cả logic quyền tập trung tại đây để controller và frontend không tự suy đoán theo tên role.

canSeeDrafts chỉ cho xem bản nháp Milestone khi có MILESTONE_WRITE; Feedback khi có FEEDBACK_WRITE hoặc ARTIFACT_REVIEW. Tài khoản chỉ đọc, bao gồm Student mặc định, chỉ nhận published cho hai phân mục này. Bộ lọc chạy trước khi trả response, nên điểm/feedback nháp không đi vào network response.

WorkspaceSectionDataSource là interface tách nguồn dữ liệu. Khi có repository thật, viết implementation mới của interface; giữ nguyên controller và DTO. Chỉ cấu hình một implementation hoạt động.

WorkspacePermissionInitializer bổ sung các key không thuộc CRUD mặc định như WRITE, SUBMIT, REVIEW. RoleDataInitializer gán đúng role có sẵn. Sau khi áp dụng cần restart backend, rồi logout/login lại để frontend nhận permission mới. Backend vẫn đọc quyền từ DB ở mỗi request.

### Bước 3 — Nguồn mock và công cụ tạo trạng thái kiểm thử

Xem **Phase 3**.

MockWorkspaceSectionDataSource lưu dữ liệu bằng khóa gồm tenantId + workspaceId + projectId + teamId + section. Vì thế hai workspace không dùng chung một mảng mock.

GET chỉ đọc. Không gọi seed hay save khi mở tab. Mock chỉ có dữ liệu khi initializer chạy hoặc người có quyền chủ động tạo dữ liệu/cấu hình DATA.

WorkspaceSectionMockInitializer:
- Chỉ bật khi app.workspace.sections.mock-fixtures.enabled=true.
- Chỉ seed workspace demo đã có (project code WS-DEMO-*), trên H2.
- Không tạo workspace/team/user mới.
- Workspace mới tạo sau startup vẫn rỗng; có thể dùng action hoặc mock-control DATA để chuẩn bị kiểm thử.

WorkspaceMockSectionsController:
- Mặc định không bật.
- Chỉ Admin, H2 và flag app.workspace.sections.mock-controls.enabled=true.
- Vẫn kiểm tra tenant/workspace/scope; không bỏ qua phân quyền của GET nghiệp vụ.
- Dùng PUT riêng để đổi DATA/EMPTY/ERROR/NOT_FOUND/delay, không dùng query string ở GET để vượt quyền.
- DATA phục hồi chế độ đọc, seed nếu chưa có; không xóa các bản ghi đã được thêm bằng action.

Không dùng mock-control cho môi trường chạy thật.

### Bước 4 — Service, Controller và lỗi

Xem **Phase 4**.

WorkspaceSectionService.context() gọi kiểm tra người dùng hiện tại và WorkspaceContextService. read() kiểm tra READ trước khi chạm nguồn mock; create/task/submit/review kiểm tra cả READ lẫn action permission.

WorkspaceSectionsController expose các endpoint dưới đây. Các ID project/team không lấy từ body: chúng được suy ra từ workspace đã được xác thực, tránh người gọi đổi projectId/teamId để đọc chéo dữ liệu.

| Method | API | Quyền bổ sung |
|---|---|---|
| GET | /api/workspaces/{id}/sections | WORKSPACE_READ |
| GET | /api/workspaces/{id} | WORKSPACE_READ; API US02 giữ nguyên |
| GET | /api/workspaces/{id}/members | WORKSPACE_MEMBER_READ; API US02 giữ nguyên |
| GET | /api/workspaces/{id}/milestones | MILESTONE_READ |
| GET | /api/workspaces/{id}/sprints | SPRINT_READ |
| GET | /api/workspaces/{id}/backlog | SPRINT_READ |
| GET | /api/workspaces/{id}/artifacts | ARTIFACT_READ |
| GET | /api/workspaces/{id}/feedback | FEEDBACK_READ |
| GET | /api/workspaces/{id}/activity | WORKSPACE_ACTIVITY_READ |
| POST | /api/workspaces/{id}/milestones | MILESTONE_WRITE |
| POST | /api/workspaces/{id}/sprints | SPRINT_WRITE |
| POST | /api/workspaces/{id}/tasks | SPRINT_WRITE hoặc TASK_WRITE |
| PUT | /api/workspaces/{id}/tasks/{taskId} | SPRINT_WRITE hoặc TASK_WRITE |
| POST | /api/workspaces/{id}/artifacts | ARTIFACT_WRITE |
| POST | /api/workspaces/{id}/artifacts/submit | ARTIFACT_SUBMIT |
| POST | /api/workspaces/{id}/feedback | FEEDBACK_WRITE |
| POST | /api/workspaces/{id}/reviews | Tùy kind: ARTIFACT_REVIEW/FEEDBACK_WRITE hoặc MILESTONE_WRITE |

POST trả 201; PUT task trả 200. Request sai trường bắt buộc trả 422. Không có phiên hợp lệ trả 401; thiếu quyền/tenant/scope trả 403; không tìm thấy trả 404. 500 chỉ là lỗi hệ thống hoặc chế độ mock ERROR.

WorkspaceSectionErrors cần @Order(HIGHEST_PRECEDENCE), giới hạn cho hai controller mới. Codebase có GlobalExceptionHandler bắt RuntimeException và có thể đổi ResponseStatusException thành 400. Handler riêng phải được xét trước để giữ đúng 404/500. Không sửa lỗi chung của module khác.

WorkspaceReadService dùng lại ContextService. **activities trong Overview trở thành null cho mọi user**; lịch sử được tải bằng GET /activity với quyền riêng. Việc này vừa tránh lộ Activity trong response tổng hợp, vừa tránh lỗi Activity làm hỏng Overview. Các test lịch sử cũ chuyển sang endpoint mới; dữ liệu lịch sử trong DB không bị xóa.

Review chỉ ghi bản ghi feedback mock; không tự chuyển project thành COMPLETED, không tự hoàn thành milestone/sprint.

### Bước 5 — Frontend: contract, navigation và các panel

Xem **Phase 5**. Áp dụng cùng backend ở bước trước.

1. types/features/workspace.ts: khai báo navigation, section access, item/action DTO; activities cho phép null theo contract mới.
2. api/features/workspace.api.ts: thêm API section/actions; truyền AbortSignal vào GET.
3. workspace.section-access.ts: UI chỉ cho phép khi cả manifest backend và quyền của role đang xem đều cho phép. Đây là điều kiện hiển thị; backend tiếp tục là nơi quyết định truy cập.
4. WorkspaceDetailPage.tsx: lấy header/tab từ navigation, giữ ?tab=...; tab thiếu READ bị disable. URL trực tiếp vào tab thiếu quyền hiển thị Access changed.
5. WorkspaceOverviewSection.tsx: wrapper query độc lập quanh OverviewPanel hoặc TeamCharterForm cũ.
6. WorkspaceBusinessSectionPanel.tsx: mỗi tab tự fetch, kiểm tra workspace/project/team trong response, hiển thị loading/empty/error/retry. Chỉ mount tab đang chọn.
7. WorkspaceSectionActionDialog.tsx: tạo/task/submit/review bằng POST/PUT thực tế khi nhấn nút, không chạy mutation trong useEffect hoặc khi mở tab.
8. Members/MemberManagementDialog/TeamCharterForm: giữ tính năng cũ, bổ sung capability hiện tại và xử lý 403.

Mỗi query có key chứa workspaceId + email + activeRole; query nghiệp vụ còn có section. Không dùng placeholderData từ workspace cũ. Khi chuyển A→B, component đổi key, request cũ được hủy qua signal và response còn sót không thể đi vào query của B. Kiểm tra context trong payload là lớp bảo vệ bổ sung.

Khi query/action trả 403, panel/dialog ngừng hiển thị dữ liệu và nút, parent tải lại manifest. Nếu READ bị thu hồi, tab bị disable; nếu chỉ WRITE bị thu hồi, danh sách có thể được tải lại với nút WRITE đã mất. Không tiếp tục thao tác chỉ dựa vào permission trong localStorage.

401 giữ luồng axios chung: thử refresh một lần; nếu refresh cũng thất bại thì logout và chuyển login. Token hết hạn nhưng refresh còn hợp lệ có thể được tự làm mới. Muốn kiểm thử “phiên hết hiệu lực” phải làm refresh không còn hợp lệ nữa.

Bản tham chiếu dùng danh sách item chung cho khung nghiệp vụ. Sprint chưa phải Kanban đầy đủ; các field chi tiết/board thực tế thuộc phần triển khai nghiệp vụ sau. Team charter tiếp tục ở Members như source hiện có.

### Bước 6 — Test và chạy thử

Xem **Phase 6**:
- WorkspaceSectionsIntegrationTest: 13 ca HTTP, bao gồm ma trận action, unpublished filtering, scope, thu hồi quyền với cùng token, lỗi cục bộ và read-only navigation.
- WorkspaceOverviewIntegrationTest: giữ 14 ca US02; assertion lịch sử chuyển /activity.
- WorkspacePersistenceIntegrationTest: lịch sử thật vẫn tồn tại sau restart, đọc qua Activity service.
- WorkspaceAcceptanceIntegrationTest: giữ 40 ca US01; cập nhật contract activities null và quyền Activity cho fixture lịch sử.

Sau khi áp dụng, chạy trong terminal backend:

~~~powershell
Set-Location -LiteralPath 'D:\SE172316\Semeter 6\HCM26_CPL_JAVA_10\backend'
mvn '-Dtest=WorkspaceSectionsIntegrationTest,WorkspaceOverviewIntegrationTest,WorkspaceAcceptanceIntegrationTest' test
~~~

Nếu máy không nhận mvn, dùng đường dẫn Maven hiện có:

~~~powershell
$env:JAVA_HOME = 'C:\Program Files\Java\jdk-21'
& 'C:\Program Files\apache-maven-3.9.16\bin\mvn.cmd' '-Dtest=WorkspaceSectionsIntegrationTest,WorkspaceOverviewIntegrationTest,WorkspaceAcceptanceIntegrationTest' test
~~~

Mở terminal khác để build frontend:

~~~powershell
Set-Location -LiteralPath 'D:\SE172316\Semeter 6\HCM26_CPL_JAVA_10\frontend'
npm.cmd run build
~~~

Khởi động backend với mock có dữ liệu mẫu và công cụ kiểm thử **local H2**:

~~~powershell
Set-Location -LiteralPath 'D:\SE172316\Semeter 6\HCM26_CPL_JAVA_10\backend'
mvn spring-boot:run '-Dspring-boot.run.arguments=--app.workspace.sections.provider=mock --app.workspace.sections.mock-fixtures.enabled=true --app.workspace.sections.mock-controls.enabled=true'
~~~

Dừng backend đang chạy ở terminal cũ bằng Ctrl+C trước khi chạy lại; không chạy hai backend cùng cổng 8080. Nếu không cần fault-control, bỏ flag mock-controls.enabled=true.

Frontend:

~~~powershell
Set-Location -LiteralPath 'D:\SE172316\Semeter 6\HCM26_CPL_JAVA_10\frontend'
npm.cmd run dev
~~~

Đăng xuất/đăng nhập lại bằng tài khoản admin/teacher/student sẵn có. Dùng tài khoản Teacher thật để kiểm thử Teacher; Admin View→Teacher chỉ là preview UI và JWT vẫn là Admin.

## 5. Postman: chuẩn bị và kiểm thử từng AC

Environment có baseUrl=http://localhost:8080, token=<JWT đăng nhập>, workspaceId=<workspace đã có>. Trong Authorization chọn Bearer Token, ô Token nhập {{token}}. Không thêm chữ Bearer vào biến token. Dán JWT thành một dòng, không dấu ngoặc kép hoặc xuống dòng.

Lấy workspaceId bằng GET {{baseUrl}}/api/workspaces/candidates. Chọn team có workspaceId; Teacher/Student phải thuộc scope team đó. Workspace chưa có thì tạo bằng luồng US01 có sẵn. Các ví dụ dưới đây không yêu cầu tạo lại workspace.

**Chuẩn bị dữ liệu (Admin, mock-control đã bật):**

PUT {{baseUrl}}/api/workspaces/{{workspaceId}}/mock-sections/milestones

Body → raw → JSON:

~~~json
{"mode":"DATA","delayMs":0}
~~~

Lặp lại cho sprints, backlog, artifacts, feedback nếu cần. GET tương ứng trả envelope items có dữ liệu. Đừng kết luận có lỗi khi workspace mới trả []: chưa seed là trạng thái hợp lệ.

| AC | Cách thực hiện và bằng chứng cần giữ |
|---|---|
| AC01 | Mở ?tab=milestones, chụp active tab. GET /milestones: workspaceId/projectId/teamId khớp GET /sections và đúng team. Lặp qua các tab. |
| AC02 | Copy URL tab sang tab trình duyệt mới. Kiểm tra như trên. Postman gọi cùng API với No Auth →401, token có quyền →200, token thiếu quyền hoặc ngoài scope →403. |
| AC03 | Admin PUT mock-sections/milestones body {"mode":"EMPTY","delayMs":0}; GET /milestones →200, items:[], UI hiện No milestone yet. Với user READ-only không có nút Create milestone. |
| AC04 | Thu hồi MILESTONE_READ của role tài khoản thử trong màn RBAC có sẵn. Request tiếp theo /milestones →403; /sections có canRead:false. Overview vẫn200 nếu còn WORKSPACE_READ. /activity403 nếu bỏ WORKSPACE_ACTIVITY_READ; Overview.activities là null. Khôi phục quyền sau test. |
| AC05 | Student gọi POST /milestones →403, POST /tasks →201, POST /artifacts/submit →201. Teacher POST /artifacts →201 nhưng POST /artifacts/submit →403. UI chỉ hiện nút tương ứng. Xem body mẫu bên dưới. |
| AC06 | Chuẩn bị hai workspace A/B mà tài khoản đều có scope. Cho A milestones delayMs=5000, B DATA delay0. Trên UI mở A/Milestone rồi dùng điều hướng SPA sang B trước khi A tải xong. Chờ >5s: chỉ có dữ liệu B. Đối chiếu Network request/workspaceId; không chỉ reload toàn trang vì reload không kiểm tra race trong cùng app. |
| AC07 | Admin PUT A mock-sections/milestones mode ERROR →GET500. UI có Try again, vẫn bấm Sprint/Overview được. Đổi NOT_FOUND →404 với lỗi cục bộ tương tự; đổi DATA và Try again →khôi phục. |
| AC08 | Đang xem tab, thu hồi READ hoặc phân công. Bấm Refresh section; request403 →nội dung/nút cũ biến mất, manifest được tải lại. Thu hồi chỉ WRITE →danh sách vẫn đọc được, nút WRITE mất sau POST403/Refresh access. Phiên không hợp lệ: Postman token sai →401; UI cần cả access và refresh hết hiệu lực để yêu cầu login. |
| AC09 | Bật DevTools Network rồi chỉ chuyển tab/refresh: chỉ GET, không có POST/PUT. Đối chiếu project status, số workspace/roster trước-sau. Integration test kiểm tra thêm số record mock và Activity không tăng. |

Với AC06, nếu hai workspace hiện không có sẵn trong scope Teacher/Student, dùng Admin có scope cả hai. Để chuyển SPA thuận tiện có thể quay Workspace list rồi mở B; browser test tham chiếu cũng kiểm tra chuyển URL bằng History API trong cùng app.

**Body tạo mới/task/nộp artifact** (Content-Type: application/json):

~~~json
{"title":"AC05 test item","description":"Created explicitly from Postman","published":true}
~~~

Khi submit artifact, backend luôn đặt published=false và status=SUBMITTED, bỏ qua published:true từ client. Điều này không cấp quyền publish feedback.

**Body review artifact**:

~~~json
{
  "kind":"ARTIFACT",
  "targetId":"artifacts-5-published",
  "comment":"Meets the agreed criteria.",
  "score":8,
  "published":false
}
~~~

Lấy targetId thật từ items[].id của GET /artifacts. Review Milestone đổi kind=MILESTONE và lấy id từ /milestones; Review Sprint đổi kind=SPRINT và lấy id từ /sprints. Không dùng target của workspace khác; trả404. Student review phải403 trước khi đọc target.

Trong tab Scripts → Post-response của request test quyền, ví dụ Teacher nộp artifact:

~~~javascript
pm.test("Teacher cannot submit artifacts", function () {
  pm.response.to.have.status(403);
});
~~~

Request kiểm tra danh sách rỗng:

~~~javascript
pm.test("Valid empty section", function () {
  pm.response.to.have.status(200);
  const body = pm.response.json();
  pm.expect(body.workspaceId).to.eql(Number(pm.environment.get("workspaceId")));
  pm.expect(body.items).to.eql([]);
});
~~~

Bằng chứng nên có URL/method, loại tài khoản, body request, HTTP status, response và Test Results. UI dùng để chứng minh active tab/loading/empty/retry/không trộn A-B; Postman dùng để chứng minh backend không cho vượt quyền. Không dùng Postman đơn lẻ để kết luận frontend xử lý race đúng.

Sau test, đổi mode về DATA, delayMs=0 và khôi phục các quyền đã thu hồi. Record action mock không cần xóa database: restart sẽ mất phần dữ liệu mock trong bộ nhớ, còn workspace/roster/lịch sử thật giữ nguyên.

## 6. Khi có repository nghiệp vụ thật

Viết implementation WorkspaceSectionDataSource dùng repository của module đó. Query phải ràng buộc tenant/workspace/project/team từ Scope được backend xác định, không nhận scope tùy ý từ client.

Bỏ mock provider đang hoạt động và cấu hình provider mới; tắt mock fixture/control. Controller/policy/frontend vẫn dùng contract đã có. Với review/submit thực tế, triển khai transaction/audit/idempotency/quy tắc nghiệp vụ trong module phụ trách trước khi xem đây là chức năng production hoàn chỉnh.

## 7. Danh mục file và thứ tự áp dụng

Các đường dẫn đích bên dưới tính từ thư mục project đã nêu. Link mở mã tham chiếu; nội dung phải được đặt vào đúng đường dẫn backend/frontend tương ứng.

### Phase 1 — Context và DTO

- **Tạo** [backend/src/main/java/com/example/starter_project_2025/system/project/workspace/service/WorkspaceContextService.java](<D:/SE172316/Semeter 6/HCM26_CPL_JAVA_10/docs/us-prj-001-03/reference/backend/src/main/java/com/example/starter_project_2025/system/project/workspace/service/WorkspaceContextService.java>). Tách kiểm tra workspace/tenant/scope đang có để Overview và mọi phân mục dùng chung.
- **Sửa** [backend/src/main/java/com/example/starter_project_2025/system/project/workspace/service/WorkspaceAccessService.java](<D:/SE172316/Semeter 6/HCM26_CPL_JAVA_10/docs/us-prj-001-03/reference/backend/src/main/java/com/example/starter_project_2025/system/project/workspace/service/WorkspaceAccessService.java>). Tái sử dụng kiểm tra permission hiện tại trong DB cho từng request; không dựa vào localStorage.
- **Tạo** [backend/src/main/java/com/example/starter_project_2025/system/project/workspace/dto/WorkspaceSectionDtos.java](<D:/SE172316/Semeter 6/HCM26_CPL_JAVA_10/docs/us-prj-001-03/reference/backend/src/main/java/com/example/starter_project_2025/system/project/workspace/dto/WorkspaceSectionDtos.java>). DTO whitelist cho dữ liệu đọc, action và metadata quyền. Không serialize Entity trực tiếp.

### Phase 2 — Policy, interface và permission

- **Tạo** [backend/src/main/java/com/example/starter_project_2025/system/project/workspace/service/WorkspaceSectionPolicy.java](<D:/SE172316/Semeter 6/HCM26_CPL_JAVA_10/docs/us-prj-001-03/reference/backend/src/main/java/com/example/starter_project_2025/system/project/workspace/service/WorkspaceSectionPolicy.java>). Một nơi ánh xạ READ/action; ARTIFACT_WRITE không kéo theo SUBMIT. Người chỉ READ không xem draft milestone/feedback.
- **Tạo** [backend/src/main/java/com/example/starter_project_2025/system/project/workspace/service/WorkspaceSectionDataSource.java](<D:/SE172316/Semeter 6/HCM26_CPL_JAVA_10/docs/us-prj-001-03/reference/backend/src/main/java/com/example/starter_project_2025/system/project/workspace/service/WorkspaceSectionDataSource.java>). Điểm thay thế mock bằng Repository sau này. Controller/DTO/permission không phụ thuộc Entity của nhóm khác.
- **Sửa** [backend/src/main/java/com/example/starter_project_2025/system/project/workspace/service/WorkspacePermissionInitializer.java](<D:/SE172316/Semeter 6/HCM26_CPL_JAVA_10/docs/us-prj-001-03/reference/backend/src/main/java/com/example/starter_project_2025/system/project/workspace/service/WorkspacePermissionInitializer.java>). Tạo WRITE/SUBMIT/REVIEW rõ ràng vì CrudAction hiện chỉ có CREATE/READ/UPDATE/DELETE.
- **Sửa** [backend/src/main/java/com/example/starter_project_2025/init/RoleDataInitializer.java](<D:/SE172316/Semeter 6/HCM26_CPL_JAVA_10/docs/us-prj-001-03/reference/backend/src/main/java/com/example/starter_project_2025/init/RoleDataInitializer.java>). Gán đúng ma trận đã chốt. Teacher không có ARTIFACT_SUBMIT; Student có TASK_WRITE. PM nếu đã tồn tại nhận quyền nhưng vẫn giữ scope.

### Phase 3 — Nguồn mock và công cụ kiểm thử

- **Tạo** [backend/src/main/java/com/example/starter_project_2025/system/project/workspace/service/MockWorkspaceSectionDataSource.java](<D:/SE172316/Semeter 6/HCM26_CPL_JAVA_10/docs/us-prj-001-03/reference/backend/src/main/java/com/example/starter_project_2025/system/project/workspace/service/MockWorkspaceSectionDataSource.java>). Mock in-memory theo tenant/workspace/project/team. GET không seed; control local mô phỏng empty/404/500/delay. Activity dùng repository sẵn có.
- **Tạo** [backend/src/main/java/com/example/starter_project_2025/system/project/workspace/controller/WorkspaceMockSectionsController.java](<D:/SE172316/Semeter 6/HCM26_CPL_JAVA_10/docs/us-prj-001-03/reference/backend/src/main/java/com/example/starter_project_2025/system/project/workspace/controller/WorkspaceMockSectionsController.java>). Control chỉ bật bằng property và dùng H2 local; mặc định tắt, ADMIN vẫn phải qua tenant/scope. Không có query ?debug bypass quyền.
- **Tạo** [backend/src/main/java/com/example/starter_project_2025/system/project/workspace/demo/WorkspaceSectionMockInitializer.java](<D:/SE172316/Semeter 6/HCM26_CPL_JAVA_10/docs/us-prj-001-03/reference/backend/src/main/java/com/example/starter_project_2025/system/project/workspace/demo/WorkspaceSectionMockInitializer.java>). Nạp mock vào các workspace demo đã tồn tại khi startup; không tạo workspace/team/user, không seed lúc GET.

### Phase 4 — API/service và aggregate

- **Tạo** [backend/src/main/java/com/example/starter_project_2025/system/project/workspace/service/WorkspaceSectionService.java](<D:/SE172316/Semeter 6/HCM26_CPL_JAVA_10/docs/us-prj-001-03/reference/backend/src/main/java/com/example/starter_project_2025/system/project/workspace/service/WorkspaceSectionService.java>). Service kiểm tra quyền trước khi đọc/ghi mock, lọc draft bằng permission và xác định context từ workspace; không tin projectId/teamId do client gửi.
- **Tạo** [backend/src/main/java/com/example/starter_project_2025/system/project/workspace/controller/WorkspaceSectionsController.java](<D:/SE172316/Semeter 6/HCM26_CPL_JAVA_10/docs/us-prj-001-03/reference/backend/src/main/java/com/example/starter_project_2025/system/project/workspace/controller/WorkspaceSectionsController.java>). API đọc và action thật. Service kiểm tra action riêng nên Teacher có ARTIFACT_WRITE vẫn nhận 403 khi submit.
- **Tạo** [backend/src/main/java/com/example/starter_project_2025/system/project/workspace/controller/WorkspaceSectionErrors.java](<D:/SE172316/Semeter 6/HCM26_CPL_JAVA_10/docs/us-prj-001-03/reference/backend/src/main/java/com/example/starter_project_2025/system/project/workspace/controller/WorkspaceSectionErrors.java>). Lỗi riêng của phân mục có status/correlationId; không đổi lỗi thành danh sách rỗng.
- **Sửa** [backend/src/main/java/com/example/starter_project_2025/system/project/workspace/service/WorkspaceReadService.java](<D:/SE172316/Semeter 6/HCM26_CPL_JAVA_10/docs/us-prj-001-03/reference/backend/src/main/java/com/example/starter_project_2025/system/project/workspace/service/WorkspaceReadService.java>). Overview không tải payload Activity nữa; trả activities=null, phần Activity đọc API riêng có quyền/lỗi riêng.

### Phase 5 — Frontend

- **Sửa** [frontend/src/types/features/workspace.ts](<D:/SE172316/Semeter 6/HCM26_CPL_JAVA_10/docs/us-prj-001-03/reference/frontend/src/types/features/workspace.ts>). Type cho manifest/context/item/action; activities nullable vì dữ liệu Activity chuyển sang API riêng.
- **Sửa** [frontend/src/api/features/workspace.api.ts](<D:/SE172316/Semeter 6/HCM26_CPL_JAVA_10/docs/us-prj-001-03/reference/frontend/src/api/features/workspace.api.ts>). Tất cả GET mới nhận AbortSignal; giữ client refresh-token chung và API US01/US02.
- **Tạo** [frontend/src/pages/management/workspace/workspace.section-access.ts](<D:/SE172316/Semeter 6/HCM26_CPL_JAVA_10/docs/us-prj-001-03/reference/frontend/src/pages/management/workspace/workspace.section-access.ts>). Kết hợp capability từ backend với role đang preview trên UI. Backend vẫn là ranh giới bảo mật.
- **Tạo** [frontend/src/pages/management/workspace/WorkspaceSectionState.tsx](<D:/SE172316/Semeter 6/HCM26_CPL_JAVA_10/docs/us-prj-001-03/reference/frontend/src/pages/management/workspace/WorkspaceSectionState.tsx>). Một trạng thái lỗi/403 dùng chung; lỗi không giả thành empty, có thao tác khôi phục.
- **Tạo** [frontend/src/pages/management/workspace/WorkspaceSectionActionDialog.tsx](<D:/SE172316/Semeter 6/HCM26_CPL_JAVA_10/docs/us-prj-001-03/reference/frontend/src/pages/management/workspace/WorkspaceSectionActionDialog.tsx>). Action dialog uses real POST/PUT; only submits on an explicit user action.
- **Tạo** [frontend/src/pages/management/workspace/WorkspaceBusinessSectionPanel.tsx](<D:/SE172316/Semeter 6/HCM26_CPL_JAVA_10/docs/us-prj-001-03/reference/frontend/src/pages/management/workspace/WorkspaceBusinessSectionPanel.tsx>). Independent loading, context verification, empty/error states and fresh permission guards.
- **Tạo** [frontend/src/pages/management/workspace/WorkspaceOverviewSection.tsx](<D:/SE172316/Semeter 6/HCM26_CPL_JAVA_10/docs/us-prj-001-03/reference/frontend/src/pages/management/workspace/WorkspaceOverviewSection.tsx>). Overview and charter failures do not block unrelated business section queries.
- **Sửa** [frontend/src/pages/management/workspace/WorkspaceMembersPanel.tsx](<D:/SE172316/Semeter 6/HCM26_CPL_JAVA_10/docs/us-prj-001-03/reference/frontend/src/pages/management/workspace/WorkspaceMembersPanel.tsx>). Keep existing roster UI, add signal and fresh server capability/403 guard.
- **Sửa** [frontend/src/pages/management/workspace/TeamCharterForm.tsx](<D:/SE172316/Semeter 6/HCM26_CPL_JAVA_10/docs/us-prj-001-03/reference/frontend/src/pages/management/workspace/TeamCharterForm.tsx>). Retain existing charter; revoke cached write access after403.
- **Sửa** [frontend/src/pages/management/workspace/WorkspaceMemberManagementDialog.tsx](<D:/SE172316/Semeter 6/HCM26_CPL_JAVA_10/docs/us-prj-001-03/reference/frontend/src/pages/management/workspace/WorkspaceMemberManagementDialog.tsx>). A direct roster write/read403 clears dialog content and rechecks workspace capabilities.
- **Sửa** [frontend/src/pages/management/workspace/WorkspaceDetailPage.tsx](<D:/SE172316/Semeter 6/HCM26_CPL_JAVA_10/docs/us-prj-001-03/reference/frontend/src/pages/management/workspace/WorkspaceDetailPage.tsx>). Navigation manifest controls tabs; every panel owns its request and permission failure.

### Phase 6 — Integration test

- **Sửa** [backend/src/test/java/com/example/starter_project_2025/system/project/WorkspaceOverviewIntegrationTest.java](<D:/SE172316/Semeter 6/HCM26_CPL_JAVA_10/docs/us-prj-001-03/reference/backend/src/test/java/com/example/starter_project_2025/system/project/WorkspaceOverviewIntegrationTest.java>). History assertions move to permission-gated activity API.
- **Sửa** [backend/src/test/java/com/example/starter_project_2025/system/project/WorkspaceAcceptanceIntegrationTest.java](<D:/SE172316/Semeter 6/HCM26_CPL_JAVA_10/docs/us-prj-001-03/reference/backend/src/test/java/com/example/starter_project_2025/system/project/WorkspaceAcceptanceIntegrationTest.java>). Update the aggregate contract and retain the US01 history assertion through Activity.
- **Tạo** [backend/src/test/java/com/example/starter_project_2025/system/project/WorkspaceSectionsIntegrationTest.java](<D:/SE172316/Semeter 6/HCM26_CPL_JAVA_10/docs/us-prj-001-03/reference/backend/src/test/java/com/example/starter_project_2025/system/project/WorkspaceSectionsIntegrationTest.java>). 13 integration cases verify actual HTTP security, mock isolation and read-only navigation.

- **Sửa** [backend/src/test/java/com/example/starter_project_2025/system/project/WorkspacePersistenceIntegrationTest.java](<D:/SE172316/Semeter 6/HCM26_CPL_JAVA_10/docs/us-prj-001-03/reference/backend/src/test/java/com/example/starter_project_2025/system/project/WorkspacePersistenceIntegrationTest.java>). Kiểm tra Activity tồn tại sau restart qua service/API riêng.
