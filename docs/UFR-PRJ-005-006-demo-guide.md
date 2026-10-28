# Kịch bản demo tổng hợp UFR-PRJ-005 và UFR-PRJ-006

**Người thực hiện:** Trần Trọng Hòa  
**Phạm vi:** Kanban Board, Task List, lịch sử trạng thái; chuẩn bị, nộp và nộp lại artifact.

## Các user story

| User Story | Nội dung | Màn hình |
|---|---|---|
| UFR-PRJ-005-US01 | Kanban Board theo Project/Sprint; xem, tạo/sửa task, kéo task đổi trạng thái và xem Activity Trail. | `/project-board` |
| UFR-PRJ-005-US02 | Tìm kiếm, lọc, sắp xếp, phân trang và cập nhật task từ List View. | `/project-board` → List View |
| UFR-PRJ-005-US03 | Lịch sử trạng thái gồm trạng thái cũ/mới, actor, thời điểm, version và correlation ID. | List View → Lịch sử |
| UFR-PRJ-006-US01 | Tạo/cập nhật draft `DRAFT`, tiếp tục chỉnh sửa được. | `/projects/{projectId}/milestones/{milestoneId}/submit` |
| UFR-PRJ-006-US02 | Kiểm tra quyền, scope, trạng thái, URL/tệp, deadline/late policy; tạo bản `SUBMITTED`, audit/outbox và idempotency. | Màn hình artifact → Review & submit |
| UFR-PRJ-006-US03 | Nộp lại thành version mới, giữ nguyên version trước. | `/student/milestone-submissions` và màn hình artifact |

`SUBMITTED` chỉ xác nhận hệ thống đã nhận bài, không đồng nghĩa được reviewer chấp nhận hay Project hoàn thành. Review là bước riêng.

## Khởi chạy demo trong IntelliJ

Mở project root trong IntelliJ, chọn **Backend Demo (H2 Mock Data)** ở menu Run configuration cạnh nút Run, rồi bấm **Run**. Cấu hình dùng H2 kết hợp tại `backend/data/demo/fams_lms_legacy_plus_demo`, cổng `8080`, profile `milestone-mock`, đồng thời bật mock data cho Workspace, Board, team allocation, task alerts, milestone và submission/review. Database kết hợp được tạo từ bản sao `backend/data/fams_lms_after_merge.mv.db`; database gốc được giữ nguyên. Nếu backend khác đang dùng cổng `8080`, hãy dừng backend đó trước.

`backend/run-demo.ps1` là lựa chọn khác: dùng H2 riêng `backend/data/demo/fams_lms_showcase` ở cổng `8080`, không chứa snapshot dữ liệu cũ. Hai cấu hình đều dùng cổng `8080`, vì vậy chỉ chạy một backend tại một thời điểm. Lệnh `mvnw.cmd spring-boot:run` tự nó không nạp `backend/.env` trong cấu hình hiện tại; mặc định `application.properties` dùng H2 `backend/data/fams_lms`. Nếu IntelliJ hoặc terminal được cấu hình inject `DB_URL`, giá trị đó sẽ quyết định database.

Nếu chưa thấy cấu hình, mở lại project hoặc reload project để IntelliJ nạp shared configuration từ `.run`. Log backend cần thể hiện profile `milestone-mock` và cổng `8080`.

Frontend mặc định gọi `http://localhost:8080/api`, nên không cần đổi `VITE_API_URL` cho cấu hình IntelliJ hoặc `backend/run-demo.ps1`. Dừng backend hiện tại trước khi chuyển cấu hình để tránh lỗi cổng đang được sử dụng.

Tài khoản demo đã được kiểm tra trên database kết hợp: `admin@example.com`, `teacher@example.com`, `student@example.com`; mật khẩu `password123`. Mock Workspace trả 5 team candidate; đăng nhập admin/student thành công. Database kết hợp giữ thay đổi qua các lần chạy. Run config cũng bật seed bốn phiên bản artifact cho milestone Team-only đầu tiên của Team ID `3` (Team Pixel); mở tab **Milestone** → **View all** → **Submissions** để xem. Vì milestone Team-only chưa nối reviewer workflow của Project, các bản này hiển thị đúng trạng thái `SUBMITTED`; UI không tự gán `CHANGES_REQUESTED` hay `ACCEPTED`. Quyền reviewer mock được gán cho `admin@example.com` và `teacher@example.com` trên team demo. Seed chỉ thêm dữ liệu nếu milestone chưa có submission. Tắt `TEAM_ARTIFACT_SUBMISSION_DEMO_SEED_ENABLED` nếu không muốn tạo các bản demo này; tắt `MILESTONE_SUBMISSION_MOCK_SEED_ENABLED` nếu không muốn seed submission/review thuộc luồng Project.

Release notes có giới hạn độ dài 10.000 ký tự, khung cao tối đa 12rem và cuộn nội dung bên trong ở cả form artifact Project và Team.

## Dữ liệu và thao tác demo

### UFR-PRJ-005 – Board, List, history (5–7 phút)

1. Đăng nhập tài khoản có quyền, mở `/project-board`, chọn Project và Sprint có task.
2. Xem Board, chuyển List View; thử tìm kiếm, filter, sort, pagination.
3. Kéo task `TODO` sang `In progress` hoặc đổi trạng thái trong List. Refresh để xác nhận trạng thái đồng nhất.
4. Mở Lịch sử của task, chỉ ra actor, trạng thái cũ/mới, thời điểm và correlation ID.
5. Nếu dùng Team-only workspace, Board cần có Sprint; List hiện chỉ hỗ trợ dữ liệu Project-backed.

Trong Team Workspace, mở tab **Kanban Board** để demo Board theo Sprint của team: lọc member, kéo work item giữa các trạng thái hợp lệ, phân công người phụ trách nếu có quyền, rồi đối chiếu Activity Trail. Lane `Blocked` và ô thống kê `Blocked` đã được bỏ khỏi Board Workspace; trạng thái `Blocked` vẫn được xem/lọc và chuyển về trạng thái hợp lệ trong **List**. Nếu Team Pixel báo chưa có Sprint, không dùng empty state để minh họa Board có dữ liệu: chuyển sang Team có Sprint hoặc dùng `/project-board` với Project/Sprint demo.

### UFR-PRJ-006-US01 – Lưu draft (3–4 phút)

1. Dùng Teacher/Admin có quyền mở milestone; chuyển milestone từ `PLANNED` sang `OPEN` nếu cần.
2. Đăng nhập Student thuộc đúng Project/Team, mở Prepare artifact.
3. Kiểm tra thông tin milestone, checklist và rubric. Nhập Repository URL hợp lệ và release notes; các URL không mặc định đều bắt buộc.
4. Bấm **Lưu nháp**, xác nhận trạng thái `DRAFT`; tải lại màn hình để xác nhận dữ liệu còn và tiếp tục sửa được.

### UFR-PRJ-006-US02 – Nộp artifact (3–5 phút)

1. Đảm bảo Project đang `ACTIVE`, milestone `OPEN`, Student đúng scope. Nhập tối thiểu một URL HTTP(S) hợp lệ (hoặc tệp đã upload sạch).
2. Bấm **Review & submit**, kiểm tra nội dung rồi **Xác nhận nộp**.
3. Chỉ báo thành công khi nhận kết quả xác nhận; đối chiếu version `SUBMITTED` và thời điểm trong `/student/milestone-submissions`.
4. Có thể thử URL không hợp lệ hoặc thiếu cả URL lẫn tệp để xem lỗi validation `422`; không được tạo version thành công.
5. Nộp muộn chỉ được nhận nếu late policy cho phép và còn trong `lateUntil`. Upload bị khóa nếu thiếu MIME/size/storage/scanner config; demo chính nên dùng URL.

### UFR-PRJ-006-US03 – Nộp lại version mới (4–6 phút)

1. Reviewer mở submission `SUBMITTED` và chọn **Request changes**, ghi feedback.
2. Student xem feedback, chỉnh URL/release notes rồi nộp lại.
3. Xác nhận version mới `SUBMITTED`; version cũ vẫn nguyên nội dung và thời điểm.
4. Retry cùng request/idempotency key phải trả kết quả cũ, không tạo version hoặc event trùng. Một lần nộp chủ động mới dùng request mới sẽ tạo version mới.

## Điều kiện trước buổi demo

- Backend và frontend chạy; frontend gọi backend mock tại `http://localhost:8080/api`. Chỉ chạy một trong hai cấu hình backend vì cả hai cùng dùng cổng `8080`.
- Student có membership/scope đúng; Project `ACTIVE`; milestone `OPEN` có checklist/rubric.
- Có Project/Sprint/task để demo Board và có submission phù hợp để demo review/resubmit.
- Chọn trước URL hợp lệ. Không tuyên bố upload chạy nếu policy/scanner vẫn khóa.
- Không dùng database production hoặc bật seed vào MySQL dùng chung.

## Giới hạn đã biết cần trình bày trung thực

- Team-only Board cần Sprint gắn với đúng team; dữ liệu Workspace trống có thể do tài khoản thiếu mentor/member scope hoặc frontend đang gọi nhầm backend/database.
- Upload yêu cầu cấu hình MIME, giới hạn dung lượng, storage riêng và ClamAV.
- Project completion không xảy ra chỉ vì student submit. Hiện code kiểm tra final grade đã khóa và mọi milestone mandatory được `ACCEPTED` hoặc waive; chưa xét task/backlog bắt buộc vì chưa có mapping required-task.
- Với Team-only mock, seed tạo bốn artifact version `SUBMITTED` để trình bày lịch sử; Team-only milestone chưa nối reviewer workflow Project nên không dùng các bản seed đó để demo `Request changes`. Dùng luồng Project-backed có reviewer để demo yêu cầu chỉnh sửa và resubmit.
- Reviewer đồng bộ với artifact hiện vẫn cập nhật submission đang review khi student nộp version mới trước khi reviewer yêu cầu chỉnh sửa. Để tránh trình bày sai tính bất biến, demo resubmit sau khi reviewer đã chọn **Request changes**; trường hợp gửi version mới khi bản trước vẫn `SUBMITTED` còn cần sửa/kiểm thử riêng.
- Kiểm tra lần này: frontend TypeScript đạt; backend compile đạt; các test trọng tâm Board (6), task workflow (2), milestone lifecycle (33), artifact submission (13), scope adapter (3) và demo seed (1) đều qua. Toàn bộ backend suite **chưa đạt**: 353 test, 78 failures và 164 errors. Nhiều lỗi context liên quan Mockito mock `Clock` trên Java 24; `WorkspaceAcceptanceIntegrationTest` còn có 34 assertion failures (ví dụ team fixture trả 404). Frontend production build bị môi trường chặn `esbuild` (`spawn EPERM`), ESLint không chạy do thiếu package `typescript-eslint`. Không coi trạng thái hiện tại là full end-to-end pass.
