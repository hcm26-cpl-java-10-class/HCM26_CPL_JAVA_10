# Kiểm tra bug 31 và 35–39

Ngày kiểm tra: 30/10/2026. Nhánh: `feature/workspace-backlog-board-polish`.

## Kết quả sửa

| Bug | Hành vi hiện tại |
| --- | --- |
| 31 | Review `REJECT` cho raw score/final score bằng 0. Luồng tạo version review và luồng submit artifact project-backed đều chặn nộp lại sau `REJECTED`; request thất bại không tạo artifact version/audit/outbox mới. |
| 35 | Lưu tối đa 8 cột tổng cộng, gồm 5 cột mặc định và tối đa 3 cột tùy chỉnh. Trạng thái mới dùng khóa ổn định trên backend. Cấu hình không nhận cột null, tên trùng hoặc xóa cột mặc định. Không được xóa custom status đang được work item sử dụng, kể cả sprint chỉ gắn Project mà không có teamId. |
| 36 | Tên/thứ tự/hiển thị cột lưu theo Workspace trên backend. Board, List và selector trong chi tiết dùng tên đã lưu. Thay đổi trong dialog chỉ áp dụng sau khi lưu thành công; Đóng/Hủy hoặc lưu thất bại giữ nguyên cấu hình đang dùng. |
| 37–38 | Chỉ chuyển giữa hai cột liền kề, theo cả hai chiều: `Backlog ↔ To do ↔ In progress ↔ Review ↔ Done`. Chặn `Done → In progress`, `In progress → Backlog` và `Backlog → In progress`. Khi có cột tùy chỉnh, dùng thứ tự cấu hình, ví dụ `Review ↔ QA ↔ Staging ↔ Ready for release ↔ Done`; Done chỉ quay về cột ngay trước nó. Backend kiểm tra cả chuyển trạng thái lẫn đưa work item vào/ra Sprint. Ẩn cột chỉ là tùy chọn hiển thị, không xóa trạng thái khỏi workflow. |
| 39 | Card Board mở detail sheet bằng click hoặc Enter/Space. Editor dùng cùng API và component với Backlog, có team/members/milestones. Quyền sửa, chuyển sprint và xóa được kiểm tra riêng. Chọn assignee trên card không vô tình mở editor. Lỗi tải chi tiết có thông báo và nút thử lại. |

## Kiểm tra đã chạy

```powershell
# backend
.\mvnw.cmd -q "-Dtest=WorkspaceSectionsIntegrationTest,MilestoneSubmissionIntegrationTest,TaskStatusWorkflowTest,BoardDemoTenantIntegrationTest" test

# frontend
npm run build
```

- `WorkspaceSectionsIntegrationTest`: **19 passed**, 0 failures, 0 errors.
- `MilestoneSubmissionIntegrationTest`: **14 passed**, 0 failures, 0 errors.
- `TaskStatusWorkflowTest`: **2 passed**, 0 failures, 0 errors.
- `BoardDemoTenantIntegrationTest`: **2 passed**, 0 failures, 0 errors.
- Tổng: **37 passed**, 0 failures, 0 errors.
- Frontend TypeScript + Vite production build: **passed**.
- `git diff --check`: **passed**.

Fixture Workspace đã chuyển từ `Team`/`TeamMember` cũ sang `ProjectTeam`/`ProjectMember` và Training Class hiện tại. Các test milestone được cập nhật đúng lifecycle hiện tại: milestone chưa ở trạng thái chờ review trả 409; reviewer có thể yêu cầu chỉnh sửa sau deadline, nhưng submit lại vẫn bị chặn đến khi được gia hạn hoặc late policy cho phép. Test kiểm tra cả việc submit thành công sau gia hạn.

Các test hồi quy kiểm tra: lưu/đọc lại 8 cột và tên mới; cấu hình không hợp lệ không ghi đè cấu hình cũ; người chỉ có quyền đọc không lưu được cấu hình; chuyển qua custom statuses; chặn nhảy bước; chặn xóa status đang dùng; đọc/sửa chi tiết và đồng bộ assignee về Board; người chỉ có quyền đọc không sửa được task; điểm 0 và chặn version mới sau rejection.

Quy tắc liền kề cũng được kiểm tra ở API đưa work item vào/ra Sprint: `In progress → Backlog` bị từ chối và giữ nguyên dữ liệu; `To do → Backlog → To do` thành công; request vừa gán Sprint vừa nhảy sang In progress bị chặn. Project Board được kiểm tra tương tự, gồm ghi audit khi sprintId chuyển sang/từ null.

## Kiểm tra giao diện sau khi khởi động lại

1. Restart backend `StarterProject2025Application` để nạp code Java mới, rồi tải lại frontend.
2. Vào Workspace → Kanban Board, bấm phần tiêu đề/nội dung card: detail sheet mở bên phải. Sửa title/description/priority/assignee/milestone, đóng rồi mở lại để đối chiếu dữ liệu đã lưu.
3. Mở Tùy chỉnh cột, thêm/đổi tên nhưng bấm Đóng: Board giữ cấu hình đã lưu. Mở lại, lưu thành công rồi reload: tên và cột vẫn còn.
4. Kéo card qua từng trạng thái tùy chỉnh theo thứ tự. Chuyển sai bước phải bị chặn và giữ nguyên trạng thái cũ. Xóa custom status đang có card phải bị chặn.
5. Review một bài nộp thành `REJECTED`: điểm là 0; thử tạo version/nộp artifact mới phải bị chặn.

Phạm vi xác minh tự động là các API integration test và frontend build nêu trên. Lượt kiểm tra này chưa chạy thao tác click/kéo thả bằng trình duyệt tự động và không phải kết quả của toàn bộ test suite hệ thống.
