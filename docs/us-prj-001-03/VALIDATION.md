# Kết quả kiểm chứng US-PRJ-001-03

Ngày kiểm chứng: 24/10/2026. Đây là kết quả của **bản tham chiếu trong thư mục riêng**, không phải xác nhận source chính đã được áp dụng.

## Backend

Lệnh chạy trong backend của bản kiểm chứng:

~~~powershell
mvn -o '-Dtest=Workspace*IntegrationTest,ProjectHubIntegrationTest,TeamMembershipIntegrationTest' test
~~~

| Suite | Tests | Failures | Errors |
|---|---:|---:|---:|
| ProjectHubIntegrationTest | 10 | 0 | 0 |
| TeamMembershipIntegrationTest | 6 | 0 | 0 |
| WorkspaceAcceptanceIntegrationTest | 40 | 0 | 0 |
| WorkspaceDemoIntegrationTest | 8 | 0 | 0 |
| WorkspaceOverviewIntegrationTest | 14 | 0 | 0 |
| WorkspacePersistenceIntegrationTest | 1 | 0 | 0 |
| WorkspaceSectionsIntegrationTest | 13 | 0 | 0 |
| **Tổng** | **92** | **0** | **0** |

MockMvc chạy Spring Security/JWT, service và database H2 thực của test. User/tenant/project/team được tạo riêng cho mỗi test; không gọi database đang phục vụ người dùng.

Các test cũ về Activity được cập nhật để đọc endpoint/service riêng; vẫn kiểm tra dữ liệu lịch sử tồn tại và tồn tại sau restart. Không bỏ kiểm tra lịch sử để làm test pass.

## Frontend

npm.cmd run build: thành công, TypeScript và Vite. Có cảnh báo bundle lớn hơn 500 kB; không phải lỗi build. Không cài thêm dependency và không sửa cấu hình bundle.

Browser check chạy Chrome headless trên Vite riêng cổng 5174, dùng response API có kiểm soát để kiểm tra hành vi frontend. Đây không phải end-to-end với tài khoản thật/backend đang chạy ở cổng 8080.

8 tình huống đã qua:

1. URL trực tiếp mở đúng workspace và active tab.
2. Response rỗng hiển thị empty state.
3. Milestone 500 không ngăn mở Sprint.
4. Try again tải lại thành công.
5. Response 403 xóa rows/actions cũ; manifest mới disable tab bị thu hồi.
6. Teacher thấy Create artifact, không thấy Submit artifact; explicit create gọi đúng POST.
7. Chuyển A sang B bằng SPA khi response A còn chậm: A không ghi đè B.
8. Chỉ chuyển tab/refresh không tạo POST/PUT; chỉ explicit create tạo mutation.

Ảnh UI từ fixture có kiểm soát:

![Workspace UI reference](<D:/SE172316/Semeter 6/HCM26_CPL_JAVA_10/docs/us-prj-001-03/workspace-reference.png>)

## Đối chiếu bộ mã

- 29 file source/test tham chiếu.
- Nội dung bản build/test trùng với các file trong reference sau chuẩn hóa CRLF/LF.
- Apply-Reference.ps1 đã được chạy chế độ dry run trên source chính: preflight thành công, không copy file.
- Source chính của backend/frontend không bị sửa. Chỉ thư mục docs/us-prj-001-03 được bổ sung trong phần việc này.
- Chưa kiểm thử thủ công toàn bộ AC với dữ liệu/tài khoản của người dùng; làm theo IMPLEMENTATION_GUIDE.md khi nghiệm thu.

Các giới hạn có chủ ý: business data mock lưu RAM, mất sau restart; action endpoints là khung để test quyền/ngữ cảnh, chưa thay thế nghiệp vụ Milestone/Sprint/Artifact/Feedback thực tế.
