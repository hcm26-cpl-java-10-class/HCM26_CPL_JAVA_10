# Implement plan: Workspace Milestone tab

## Mục tiêu

Đổi tab Milestone của Workspace thành bảng quản lý gần với ảnh tham chiếu: heading rõ ngữ cảnh, nút tạo nổi bật, thanh Search / Status / Sort / More Filters, hàng dữ liệu có trạng thái và action, footer phân trang. Giữ hành vi khác nhau theo quyền Student, Teacher và Workspace read-only. Dùng lifecycle status thật của hệ thống (`ACCEPTED` thay cho chữ `COMPLETED` trong ảnh); không tạo mã `MS-101` vì API hiện không cung cấp mã milestone.

## Contract và khoảng trống hiện tại

| Nội dung | Hiện tại | Thay đổi |
| --- | --- | --- |
| Workspace list | Luôn tải page 0, size 100; không có search/filter/sort/pagination | Query server-side theo `page`, `size`, `sort`, `search`, `lifecycleStatus`, `mandatory`, `latePolicyType`, `deadlineFrom`, `deadlineTo` |
| Project list API | Đã hỗ trợ đầy đủ tham số trên | Tái sử dụng, luôn truyền `teamId` của Workspace |
| Team list API | Controller nhận đủ tham số, nhưng frontend chỉ gửi page/size/status; service bỏ qua deadline range | Mở rộng frontend API; service đổi ngày tenant thành khoảng instant và đưa vào Specification |
| URL Workspace | `tab` và `project` dùng chung query string | Thêm các tham số có tiền tố `ms` để không va chạm tab khác và giữ trạng thái khi quay lại |
| Submission count | Lấy từ API review riêng | Giữ count hiện có; count là số bản nộp, không giả làm tiến độ checklist |

Sort được cung cấp: Deadline sớm nhất/muộn nhất, tên A–Z/Z–A, mới tạo. Backend đã có thứ tự phụ `id` để phân trang ổn định. Search tìm trong title/description, debounce 300 ms, tối đa 120 ký tự. Status dùng sáu `MilestoneLifecycleStatus` hiện có. More Filters gồm Mandatory, Late policy và khoảng Deadline theo ngày tenant. Đổi search/filter/sort/page size sẽ về page đầu; đổi trang chỉ thay page. Page size: 10, 20, 50.

## Các bước thực hiện

### 1. Đồng bộ API và backend

1. Mở rộng `milestoneApi.getTeamList` để gửi đủ tham số như `getList`, không phân trang ở client.
2. Trong `MilestoneQueryService.getTeamList`, chuyển `deadlineFrom` thành đầu ngày tenant và `deadlineTo` thành đầu ngày kế tiếp (exclusive), rồi truyền vào `MilestoneSpecifications.matching`.
3. Thêm kiểm thử tích hợp cho team endpoint: search + status + sort + phân trang và deadline range; kiểm tra team scope không lẫn project khác.

### 2. Trạng thái URL và tải dữ liệu

1. Tạo parser/serializer cho các tham số `msPage`, `msSize`, `msSearch`, `msStatus`, `msSort`, `msMandatory`, `msLatePolicy`, `msFrom`, `msTo`. Bỏ qua giá trị không hợp lệ; giữ `tab`/`project` và query của tab khác.
2. Query key chứa Workspace scope và toàn bộ tham số danh sách. Giữ dữ liệu trang cũ khi đang tải trang mới, đồng thời có chỉ báo loading để tránh nhấp nháy.
3. Khi xóa milestone hoặc số trang giảm, chuyển về trang cuối hợp lệ; refetch theo query key prefix hiện có.
4. Search nhập tức thì nhưng chỉ đổi URL/gọi API sau 300 ms; Back/Forward đồng bộ lại ô tìm kiếm.

### 3. UI gần ảnh tham chiếu

1. Header ngoài bảng: tên module/team, trạng thái project nếu có, mô tả ngắn và nút Create milestone theo quyền hiện có.
2. Toolbar trong bảng: Search bên trái, Status / Sort / More Filters bên phải. More Filters mở popover, có lựa chọn, ngày From/To, nút Clear và Apply; báo số bộ lọc đang dùng.
3. Desktop hiển thị cột Milestone, Description, Deadline, Status, Actions. Mobile/tablet dùng hàng xếp lớp, không ép cuộn ngang. Dot và status badge dùng màu phù hợp lifecycle; deadline quá hạn được nhấn mạnh khi milestone còn cần xử lý.
4. Action giữ đúng route và điều kiện hiện có: edit, delete, view, submit, review/my submissions. Mỗi icon có tên truy cập được; không hiển thị action thiếu quyền.
5. Footer hiển thị `Showing X–Y of Z milestones`, page size, Previous / số trang / Next. Nút điều hướng tắt đúng ở biên.

### 4. Trạng thái và nghiệm thu

- Loading có skeleton theo bảng; lỗi có thông báo và Retry.
- Không có milestone: empty state có CTA tạo nếu được phép. Có query nhưng không khớp: nêu rõ không có kết quả và có Clear search and filters.
- 403/404 không bị hiển thị thành danh sách trống.
- Filter ngày `From > To` được báo trước khi gọi API; ngày `To` là inclusive theo tenant.
- Bảng và toolbar dùng được ở màn hình 375 px và desktop; không tràn ngang, action vẫn chạm/bấm được.
- Trang 2+ hoạt động với trên 10 bản ghi, search/filter áp dụng trên toàn bộ dữ liệu server và tổng bản ghi đúng.
- Query URL giữ `tab=milestones` và `project`; quay lại từ detail không mất search/filter/sort/page.
- Student không thấy milestone PLANNED và không có create/edit/delete/review; Teacher/read-only giữ quyền như trước.

## File dự kiến

- `frontend/src/pages/management/workspace/WorkspaceMilestonesPanel.tsx`: UI, query, action và pagination.
- `frontend/src/pages/management/workspace/workspace-milestone-list-query.ts`: parse/serialize query URL.
- `frontend/src/pages/management/workspace/WorkspaceDetailPage.tsx`: truyền tên/trạng thái project cho header.
- `frontend/src/api/features/milestone.api.ts`: query params cho team endpoint.
- `backend/src/main/java/com/example/starter_project_2025/system/project/milestone/service/MilestoneQueryService.java`: lọc deadline theo tenant cho team.
- `backend/src/test/java/com/example/starter_project_2025/system/project/milestone/MilestoneIntegrationTest.java`: kiểm thử endpoint.

## Kiểm tra trước khi hoàn tất

Chạy frontend build + lint các file thay đổi, backend test Milestone tập trung, và kiểm tra thủ công ở Workspace Project-backed và Team-only. Đối chiếu UI với ảnh tham chiếu về thứ bậc nội dung, khoảng cách, trạng thái, toolbar và footer; giữ cách đặt tên/status theo dữ liệu thật của ứng dụng.
