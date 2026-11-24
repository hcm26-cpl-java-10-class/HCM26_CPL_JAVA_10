# Note: team DRAFT đã có Project không đổi được đề bài

## Tái hiện trên dữ liệu local

1. Team DRAFT có 4 thành viên, gán template 144 cho phép 4 người.
2. Việc gán tự sinh Project, Workspace và snapshot đề bài, nhưng team vẫn hiển thị DRAFT.
3. Tạo/activate template 145, cũng cho phép 4 người; dùng UI đổi đề bài của team sang 145.
4. Backend trả `409 CONFLICT: This team already has a project. Its assigned project brief cannot be changed`.
5. Tiêu đề frontend trước bản sửa local lại là “Sĩ số nhóm vượt quá sức chứa của đề bài”, gây hiểu nhầm. Các team thực tế đủ 4/4.

## Vị trí và điều kiện

- Backend: `ProjectTeamTemplateService.applyAssignment` chặn khi `team.getProject() != null` và template mới khác template hiện tại. Kiểm tra này chạy trước kiểm tra sức chứa.
- Gán lần đầu gọi `TemplateAssignmentProvisioningService.provision`, tự tạo Project/Workspace ngay lúc team còn DRAFT.
- UI Team Allocation mở chọn đề bài dựa trên trạng thái DRAFT; chưa giải thích rõ Project đã được tạo và đề bài bị khóa.
- Tiêu đề lỗi mặc định ở `frontend/src/pages/management/team-allocation/index.tsx` trước đó gán mọi lỗi khác thành vượt sức chứa. Đã sửa riêng ở local để chỉ dùng tiêu đề này cho reason `MAX_MEMBERS_EXCEEDED`.

## Đề nghị người phụ trách module xem xét

Thống nhất thời điểm khóa đề bài (sau gán/tạo Project hay sau công bố team). Nếu giữ quy tắc hiện tại, UI cần khóa đổi hoặc giải thích khi team đã có Project, dù còn DRAFT. Thông báo lỗi sức chứa và lỗi Project đã tồn tại cần được phân biệt.

## Cách xử lý để tiếp tục demo

Theo yêu cầu người dùng, đã chuyển dữ liệu local của Choji/Ino/Shikamaru sang template 145 sau khi sao lưu/thử trên bản sao. Giữ nguyên team, Project, Workspace, thành viên; đồng bộ snapshot, rubric, checklist và backlog; archive 144. Không thay quy tắc backend và không nộp/chấm bài tự động.

Đây là xử lý fixture local để tiếp tục review, không phải bản triển khai chức năng đổi đề bài cho Project đã có dữ liệu.
