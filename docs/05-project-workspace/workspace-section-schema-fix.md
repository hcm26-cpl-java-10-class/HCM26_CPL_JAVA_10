# H2: tạo Workspace bị từ chối RESOURCES

Sau khi lấy code có tab Resources, `WorkspaceSection` có 9 giá trị nhưng database local cũ vẫn khai báo `workspace_sections.section` bằng ENUM 8 giá trị. Hibernate `ddl-auto=update` không bổ sung nhãn vào ENUM đã tồn tại, nên transaction tạo Workspace bị lỗi SQL 22030 khi ghi RESOURCES.

`WorkspaceSectionSchemaMigration` chạy lúc khởi động, trước các initializer Workspace. Migration chỉ xử lý H2 có cột native ENUM: đọc nhãn theo thứ tự ordinal, giữ các nhãn cũ, thêm các giá trị hiện có trong `WorkspaceSection`, rồi mở rộng kiểu cột. Chạy lại không sửa schema nếu đã đủ nhãn. Cột VARCHAR và các database khác giữ nguyên.

Migration không xóa/tạo lại bảng hay backfill section vào Workspace cũ. Ràng buộc NOT NULL, unique, foreign key và thứ tự section đã lưu được giữ nguyên.

## Sửa database local ngày 05/11/2026

- Database: `backend/data/fams_lms_after_merge.mv.db`.
- Backup: `backend/data/backups/workspace-sections-20261105-110954-845/before.mv.db`.
- Đã thử migration trên bản sao rồi áp dụng cùng migration vào file local.
- Đã xác nhận 9 nhãn gồm RESOURCES; thử INSERT RESOURCES trong transaction và rollback thành công.
- So sánh trước/sau: mọi dòng của 131 bảng giữ nguyên. Hai team Choji/Ino vẫn DRAFT, chưa có Project/Workspace; không chạy tiếp demo thay người dùng.

Sau khi nhận bản sửa, khởi động lại backend để nạp migration cho những database local khác còn schema cũ, rồi thử lại thao tác tạo Workspace ban đầu. Database đã sửa trên máy này nhận RESOURCES ngay cả trước khi khởi động lại; restart bảo đảm backend cũng nạp code mới.

## Kiểm thử

Kết quả 05/11/2026: **6/6 passed** (5 test migration và 1 test tạo/đọc Workspace qua API). Log: `backend/target/workspace-section-schema-final-tests.log`. Test dùng H2 in-memory riêng.

`WorkspaceSectionSchemaMigrationTest` kiểm tra schema cũ từ chối RESOURCES trước migration và chấp nhận sau migration, giữ dữ liệu/ràng buộc, chạy lặp, nhãn từ bản mới hơn, schema hiện tại, bảng chưa tồn tại và cột VARCHAR.

Ca `creationPersistsEverySectionIncludingResources` trong `WorkspaceOverviewIntegrationTest` dùng fixture ProjectTeam hiện tại: tạo Workspace qua API, kiểm tra cả 9 section đã lưu theo đúng thứ tự và response Overview có resources.

Ca AC06 cũ trong `WorkspaceAcceptanceIntegrationTest` dùng fixture bảng Team legacy và đang bị 404 trước bước ghi section, nên không dùng ca đó làm bằng chứng cho bản sửa này.

```powershell
cd backend
.\mvnw.cmd -o '-Dtest=WorkspaceSectionSchemaMigrationTest,WorkspaceOverviewIntegrationTest#creationPersistsEverySectionIncludingResources' test
```
