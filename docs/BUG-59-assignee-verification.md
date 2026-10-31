# Bug 59 — Đồng bộ assignee giữa chi tiết, Backlog và Board

## Những chỗ đã sửa

- Sau khi lưu từ chi tiết hoặc chọn assignee ngay trên thẻ, dùng phản hồi API để cập nhật cache chi tiết và các thẻ tương ứng, rồi làm mới dữ liệu Backlog/Board và audit. Bỏ phân công sẽ xóa cả tên cũ trong cache.
- Giữ tên assignee đã lưu khi người đó không còn trong danh sách thành viên được chọn. Không gắn hậu tố `unavailable` vào tên. Option không hợp lệ vẫn bị khóa cho phân công mới, có tooltip giải thích; không hiển thị nhầm `Unassigned`.
- Backend giữ tên của assignee thuộc team dù thành viên đã chuyển INACTIVE. Danh sách có thể chọn cho phân công mới vẫn chỉ gồm thành viên hợp lệ.
- Dòng Backlog hiển thị tên/initials và tooltip đầy đủ thay vì chỉ hiển thị ID thành viên. Detail sheet giữ tên được lấy từ dữ liệu Board khi cần hiển thị assignee không còn trong danh sách lựa chọn.
- Board và chi tiết dùng chung điều kiện thành viên còn hoạt động, thuộc phạm vi phù hợp và tài khoản không bị khóa. API tạo/sửa cũng kiểm tra điều kiện này khi phân công mới; vẫn cho sửa nội dung task đang giữ phân công lịch sử. Không đổi quyền truy cập, dữ liệu task hiện có hay trạng thái workflow.

## Kiểm tra

- `WorkspaceSectionsIntegrationTest`: 28 test pass sau khi tích hợp nhánh nhóm `fee9a20f` và đồng bộ điều kiện phân công, bao gồm lưu từ chi tiết rồi đọc Board; lưu từ Board rồi đọc chi tiết; bỏ phân công; giữ tên assignee không còn hoạt động; chặn phân công mới cho thành viên không hợp lệ và giữ nguyên bản ghi.
- Kiểm tra danh sách Board/chi tiết thống nhất khi khóa tài khoản, ngừng hoạt động tài khoản, membership bị vô hiệu hóa hoặc trạng thái thành viên lớp INACTIVE; sau kích hoạt lại, thành viên xuất hiện trở lại ở cả hai danh sách. API tạo/sửa từ chối ID không tồn tại hoặc ngoài phạm vi. Request hợp lệ vẫn tạo/sửa thành công. Phân công lịch sử không ngăn sửa nội dung khác của task.
- Điều kiện roster khớp code nhóm mới: ClassMember phải thuộc đúng lớp của Team và User thuộc cùng tenant. Membership sai tenant không xuất hiện trong danh sách assignee và bị từ chối khi gửi trực tiếp qua API; tên lịch sử cũng không lấy từ membership sai phạm vi này.
- Frontend build thành công.
- Kiểm tra hàm tên/options: 5 trường hợp pass. Kiểm tra cập nhật/xóa cache: 7 assertion pass, có kiểm tra bản ghi không liên quan không bị đổi.
- Render trực tiếp selector của thẻ Board trong Chrome với dữ liệu thử: thành viên hoạt động hiện đúng tên, không có unavailable; thành viên không có trong options vẫn giữ tên nhưng option bị khóa; giá trị null hiện Unassigned.
- Kiểm tra trình duyệt trên dùng fixture riêng, không thay cho kiểm thử toàn bộ ứng dụng với tài khoản thật.

## Tích hợp code nhóm

- Đã tích hợp `origin/feature/project` tại `fdf3eb12`, gồm phần đồng bộ avatar assignee của nhóm. Conflict ở `BacklogRow` được xử lý bằng cách giữ helper tạo initials của nhóm, bổ sung tên đầy đủ và fallback cho thành viên không còn khả dụng. Khi bỏ phân công, avatar cũng phải trở lại biểu tượng người dùng, không giữ initials cũ.
- Cập nhật nhóm `999793ee` đã bỏ kiểm tra thứ tự trạng thái trong `SprintBacklogServiceImpl`. Theo yêu cầu của người dùng, khôi phục kiểm tra chuyển cột liền kề ở backend: cho phép tiến/lùi một cột; chặn nhảy cột, kể cả workflow có cột tùy chỉnh. Giữ các sửa mới của nhóm về hiển thị trạng thái Review/Blocked và uniqueness tên Sprint theo project/team.
- Sau tích hợp: 76 integration test pass (WorkspaceSections 23, milestone 38, submission 14, persistence 1); 10 unit test pass (Board service 5, task workflow 2, Release notes 3). Frontend build pass. Không sửa dữ liệu demo hoặc chạy migration trên database đang dùng của người dùng để kiểm thử.
- Lượt kiểm tra mới sau `fee9a20f`: tổng 93 test pass — WorkspaceSections 28, milestone 39, submission 14, persistence 1, Board service 5, task workflow 2, Release notes 3, start-schedule backfill 1. Không khôi phục các thay đổi giao diện/quy trình milestone mà nhóm đã chủ động loại bỏ; quy tắc chuyển trạng thái liền kề vẫn được giữ và kiểm thử.

## Demo

1. Mở Workspace → Backlog, chọn task và đổi Assignee sang thành viên A. Chờ lưu xong.
2. Đóng chi tiết: dòng Backlog phải hiện tên A. Chuyển sang Kanban Board: cùng ID task phải hiện A.
3. Đổi sang thành viên B ngay trên thẻ Board. Mở chi tiết: Assignee phải là B. Chuyển về Backlog và refresh: vẫn là B.
4. Chọn Unassigned. Board, Backlog và chi tiết đều phải bỏ tên cũ; refresh không khôi phục tên đó.
5. Trường hợp thành viên không còn hợp lệ: task cũ vẫn thể hiện người đã phân công, nhưng không được dùng người này để phân công mới. Dùng fixture riêng cho tình huống này, không khóa tài khoản demo dùng chung.
