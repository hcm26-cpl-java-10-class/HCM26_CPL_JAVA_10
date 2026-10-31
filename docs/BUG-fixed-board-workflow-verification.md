# Workflow Board cố định theo yêu cầu mới

## Phạm vi

Đồng bộ nhánh nhóm `feature/project` tại `6c6fc3ab`. Yêu cầu mới thay thế thiết kế trước của Bug 35/36/70 về thêm, xóa và đổi tên cột.

- Board Workspace và backlog item chỉ dùng `TODO`, `IN_PROGRESS`, `REVIEW`, `DONE`.
- Không thêm, xóa, đổi tên hay đảo thứ tự trạng thái qua giao diện hoặc API cấu hình.
- Theo yêu cầu tiếp theo, bỏ luôn nút và popup tùy chỉnh cột. Board luôn hiển thị đủ bốn cột chuẩn, không phụ thuộc cờ ẩn/hiện đã lưu trước đây. API cấu hình cũ vẫn kiểm tra bốn key và tên cố định.
- Cấu hình tên/cột cũ được đọc thành bốn cột chuẩn. Migration của nhánh nhóm chuyển status cũ không còn trong enum thành `IN_PROGRESS` khi backend khởi động.
- Giữ quy tắc tiến/lùi một cột liền kề. Menu Backlog và chi tiết không đưa ra lựa chọn nhảy bước.
- Product Backlog là nhóm item chưa thuộc Sprint, không phải trạng thái thứ năm; item chưa vào Sprint giữ `TODO`.

## Kiểm tra

- API cấu hình: lưu/đọc lại ẩn/hiện; từ chối thêm, bỏ từng cột, đổi tên từng cột, thay key, đảo thứ tự, null và ẩn tất cả; kiểm tra quyền và dữ liệu cũ.
- API work item: từ chối `CUSTOM_1`, `BLOCKED`, `BACKLOG`; kiểm tra chuyển liền kề và không đổi dữ liệu khi request sai.
- Kiểm tra hồi quy milestone, submission, draft/workspace persistence, giới hạn Release notes, Board, task workflow và task alerts bằng các test tích hợp/unit hiện có.
- Popup được render bằng component thực tế với fixture trình duyệt: bốn switch, không có input tên/nút đổi tên; sau khi thử ẩn cả bốn vẫn còn một cột hiển thị.
- Frontend: `npm run build`.

## Demo

1. Khởi động lại backend, tải lại frontend, vào Workspace → Kanban Board.
2. Kiểm tra bốn cột To do, In progress, Review, Done. Không có nút thêm/xóa/đổi tên hay Tùy chỉnh cột.
3. Refresh trang: cả bốn cột vẫn hiển thị, kể cả workspace từng lưu cấu hình ẩn cột.
4. Đưa item qua To do → In progress → Review → Done; thử đi lùi từng bước. Thử nhảy To do → Done phải bị chặn.
5. Mở Backlog và chi tiết cùng item để đối chiếu status, assignee và nội dung. Không tạo trạng thái mới.

Không chỉnh cấu hình chạy IntelliJ hoặc database demo của người dùng trong lần kiểm tra này. Test trình duyệt dùng fixture, không thay thế kiểm thử end-to-end toàn hệ thống.
