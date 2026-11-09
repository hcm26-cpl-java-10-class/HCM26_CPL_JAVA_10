# Kiểm tra bug 64, 66, 67 và 70

## 64 — Project chưa ACTIVE khi nộp artifact

Luồng tạo Workspace đã kích hoạt Project PLANNING; luồng provisioning từ template cũng đã kích hoạt Project sau khi tạo Workspace. Giữ nguyên kiểm tra từ chối nộp cho Team/Project không ACTIVE.

Bổ sung lần này: API tải form kiểm tra cùng điều kiện Team/Project như API submit, trả `canSubmit=false` và `submissionBlockReason`. Giao diện hiển thị nguyên nhân trước khi gửi. Không tự kích hoạt Project cũ khi sinh viên mở form hoặc nộp bài.

Demo: tạo Workspace cho Project PLANNING, kiểm tra Project chuyển ACTIVE; mở milestone và nộp URL hợp lệ. Với dữ liệu cũ còn PLANNING, cần quản trị viên kích hoạt Project; form phải giải thích điều này. Project hoàn tất không được tự mở lại.

## 66 — Cảnh báo vàng sau khi nộp thành công

Trang nộp theo Team cập nhật cache ngay bằng phản hồi submit thành công trước khi refresh. Trang theo Project không hiển thị cảnh báo chưa mở nộp khi đã có bản nộp. Lịch sử được yêu cầu tải lại sau submit.

Demo: nộp thành công, kiểm tra thông tin phiên bản đã nộp xuất hiện và không có cảnh báo vàng chưa mở nộp. Refresh trang để kiểm tra phiên bản tồn tại. Không dùng việc nút nộp bị khóa sau submit làm bằng chứng lỗi: nộp lại vẫn phải theo điều kiện reviewer yêu cầu chỉnh sửa.

## 67 — Dialog lịch sử bị tràn

Giới hạn chiều rộng/chiều cao dialog; bảng có kích thước cột cố định, cuộn ngang bên trong. Ghi chú và feedback dài có giới hạn chiều cao, xuống dòng với chuỗi không có dấu cách. Footer tự xuống hàng trên màn hình nhỏ.

Đã render trực tiếp JSX dialog với dữ liệu thử gồm 8 phiên bản, tiêu đề và ghi chú dài trong Chrome headless ở 1280px và 390px. Dialog, footer và các nút đều nằm trong viewport, không tràn ngang ra ngoài; nội dung cuộn bên trong. Đây là kiểm tra bố cục bằng fixture, không phải kiểm thử toàn bộ ứng dụng với tài khoản thật.

Demo: Workspace → Artifact → Submission history; kiểm tra nhiều phiên bản, ghi chú dài, màn hình hẹp và nút mở trang bài nộp đầy đủ.

## 70 — Xóa cột

Cho phép xóa thật cột IN_PROGRESS, REVIEW và cột tùy chỉnh khi không có work item đang dùng trong Workspace. Backend kiểm tra phạm vi Workspace, gồm các sprint khác và sprint gắn Project. Không xóa task. Cột đã xóa không tự xuất hiện lại khi refresh. Workflow chuyển qua lại giữa các cột liền kề còn lại.

Giới hạn an toàn có chủ đích: BACKLOG, TODO và DONE là các cột bắt buộc, hiển thị Required; vẫn có thể đổi tên/ẩn theo chức năng hiện tại. Không xóa IN_PROGRESS nếu còn item BLOCKED cần quay lại cột này. Có thể khôi phục cột mặc định bằng Restore defaults.

Demo: xóa REVIEW trống, lưu và refresh; từ IN_PROGRESS chuyển sang DONE rồi quay lại IN_PROGRESS. Thử xóa cột đang có task: phải bị chặn và cấu hình đã lưu không thay đổi. Không dùng task demo chung để thử nếu chưa chuẩn bị dữ liệu riêng.

## Kiểm tra tự động

- Frontend: `npm run build`.
- Backend: `WorkspaceSectionsIntegrationTest` (21), `MilestoneIntegrationTest` (38), `WorkspacePersistenceIntegrationTest` (1): 60 test pass sau thay đổi cuối.
- `MilestoneSubmissionIntegrationTest` (14) pass trong lượt kiểm tra trước đó của cùng lần sửa.
- Không thay đổi database, tài khoản hay cấu hình khởi chạy local của người dùng trong lần này.
