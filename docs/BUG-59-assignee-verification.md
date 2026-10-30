# Bug 59 — Đồng bộ assignee giữa chi tiết, Backlog và Board

## Những chỗ đã sửa

- Sau khi lưu từ chi tiết hoặc chọn assignee ngay trên thẻ, dùng phản hồi API để cập nhật cache chi tiết và các thẻ tương ứng, rồi làm mới dữ liệu Backlog/Board và audit. Bỏ phân công sẽ xóa cả tên cũ trong cache.
- Giữ option của assignee đã lưu khi người đó không còn trong danh sách thành viên được chọn. Option này bị khóa cho phân công mới và hiển thị `unavailable`; không hiển thị nhầm `Unassigned`.
- Backend giữ tên của assignee thuộc team dù thành viên đã chuyển INACTIVE. Danh sách có thể chọn cho phân công mới vẫn chỉ gồm thành viên hợp lệ.
- Dòng Backlog hiển thị tên/initials và tooltip đầy đủ thay vì chỉ hiển thị ID thành viên. Detail sheet giữ tên được lấy từ dữ liệu Board khi cần hiển thị assignee không còn trong danh sách lựa chọn.
- Không đổi quyền truy cập, điều kiện phân công, dữ liệu task hiện có hay trạng thái workflow.

## Kiểm tra

- `WorkspaceSectionsIntegrationTest`: 23 test pass, bao gồm lưu từ chi tiết rồi đọc Board; lưu từ Board rồi đọc chi tiết; bỏ phân công; giữ tên assignee không còn hoạt động; chặn phân công mới cho thành viên không hợp lệ và giữ nguyên bản ghi.
- Frontend build thành công.
- Kiểm tra hàm tên/options: 5 trường hợp pass. Kiểm tra cập nhật/xóa cache: 7 assertion pass, có kiểm tra bản ghi không liên quan không bị đổi.
- Render trực tiếp selector của thẻ Board trong Chrome với dữ liệu thử: thành viên hoạt động hiện đúng tên; thành viên không có trong options hiện tên kèm unavailable; giá trị null hiện Unassigned.
- Kiểm tra trình duyệt trên dùng fixture riêng, không thay cho kiểm thử toàn bộ ứng dụng với tài khoản thật.

## Demo

1. Mở Workspace → Backlog, chọn task và đổi Assignee sang thành viên A. Chờ lưu xong.
2. Đóng chi tiết: dòng Backlog phải hiện tên A. Chuyển sang Kanban Board: cùng ID task phải hiện A.
3. Đổi sang thành viên B ngay trên thẻ Board. Mở chi tiết: Assignee phải là B. Chuyển về Backlog và refresh: vẫn là B.
4. Chọn Unassigned. Board, Backlog và chi tiết đều phải bỏ tên cũ; refresh không khôi phục tên đó.
5. Trường hợp thành viên không còn hợp lệ: task cũ vẫn thể hiện người đã phân công, nhưng không được dùng người này để phân công mới. Dùng fixture riêng cho tình huống này, không khóa tài khoản demo dùng chung.
