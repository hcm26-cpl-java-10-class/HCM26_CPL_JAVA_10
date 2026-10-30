# Mock data cho bộ chọn Project Template (US-PRJ-001)

## Vì sao 6 dòng cũ không hiện trong picker?

Trang quản trị Project Templates hiện cả mẫu dùng chung có `tenant_id IS NULL`. Bộ chọn khi gán nhóm chỉ trả template thuộc Tenant của lớp và có phiên bản `PUBLISHED`. Bộ demo US-10/US-11 hiện có các mẫu dùng chung và không bảo đảm có published baseline. Vì vậy có thể thấy 6 dòng trong trang quản trị nhưng picker rỗng. Bộ fixture này **thêm dữ liệu riêng**, không sửa 6 dòng cũ.

## Bật fixture

Seeder chỉ chạy khi không ở profile `prod` và được bật rõ ràng. Từ thư mục `backend/`:

```bash
US_PRJ_001_DEMO_SEED_ENABLED=true bash ./mvnw spring-boot:run
```

Nếu đang dùng `DB_URL` riêng, giữ nguyên biến đó trong terminal trên. Seeder lấy Tenant của `admin@example.com` (hoặc `app.seed.admin.email`) và chạy sau seed lớp/nhóm hiện có. Khởi động lại với cờ này sẽ **không tạo trùng**. Sau khi đã tạo dữ liệu, có thể tắt cờ; bản ghi vẫn còn trong database cho tới khi xóa rõ ràng.

Không chạy trên môi trường production; class seeder có `@Profile("!prod")` và mặc định cờ là `false`.

## Dữ liệu được tạo

| Nhóm dữ liệu | Số lượng | Kết quả trong picker |
| --- | ---: | --- |
| Template ACTIVE, tenant hiện tại, mọi cohort, `v1.0 PUBLISHED` | 20 | Hiện ở mọi nhóm trong tenant; đủ 2 trang với size mặc định 12. |
| Template ACTIVE, cohort đầu tiên của tenant | 2 | Chỉ hiện với nhóm thuộc cohort đó. |
| Template ACTIVE, cohort thứ hai của tenant | 2 | Chỉ hiện với nhóm thuộc cohort đó. |
| DRAFT, ARCHIVED, ACTIVE nhưng version DRAFT | 3 | Luôn bị ẩn trong picker. |
| ACTIVE + PUBLISHED ở Tenant fixture riêng | 2 | Luôn bị ẩn với nhóm của tenant hiện tại. |

Nếu tenant không có ít nhất 2 cohort gắn trên lớp, seeder bỏ qua 4 mẫu cohort và vẫn tạo 25 mẫu còn lại. Tổng cộng khi có 2 cohort: **29 template**, trong đó 22 template sẽ hiện trong picker của một nhóm thuộc cohort đầu tiên hoặc thứ hai. Mỗi mẫu ACTIVE có metadata công nghệ, vai trò, chuẩn đầu ra, brief `v1.0` có 2 milestone, 2 backlog item và giới hạn sĩ số. Mẫu 13–16 yêu cầu 2–4 thành viên; mẫu 17–20 yêu cầu 5–8; các mẫu còn lại yêu cầu 3–6.

Mã của mọi template fixture bắt đầu bằng `USPRJ001-`. Tenant fixture khác có mã `USPRJ001-ISOLATED-TENANT`.

## Kịch bản thử nhanh

1. Đăng nhập bằng tài khoản có quyền Program Manager/ADMIN trong Tenant demo. Vào màn phân nhóm, mở **Tìm đề bài** cho một nhóm DRAFT. Để trống filter: thấy trên 20 kết quả và nút sang trang.
2. Nhập từ khóa `học tập` hoặc `tuyển dụng`, nhấn Enter: kết quả theo tên/mô tả. Nhập `Đề bài mẫu` để kiểm tra tìm trong mô tả.
3. Công nghệ `React, Java`, độ khó `Medium`, vai trò `Fullstack`, chuẩn đầu ra `REST API`: các điều kiện kết hợp và tổng số kết quả được cập nhật. Nhiều công nghệ trong một ô dùng OR.
4. Nhập `khong-co-de-bai-xyz`: thấy Empty và nút **Xóa bộ lọc**. Bộ lọc vẫn giữ cho tới khi bấm xóa.
5. Mở **Xem đề bài**: thấy brief, metadata, sức chứa và 2 milestone. Chọn một template phù hợp sĩ số rồi xác nhận gán.
6. Ở trang quản trị, tìm mã `USPRJ001-DRAFT`, `USPRJ001-ARCHIVED`, `USPRJ001-UNPUBLISHED` để đối chiếu với picker: chúng không được trả về trong danh sách gán. Mẫu `USPRJ001-OTHER-TENANT-01` chỉ thấy bằng truy vấn SQL hoặc tài khoản thuộc Tenant fixture riêng.

## Kiểm tra trực tiếp bằng SQL

Trong H2 Console của backend (database URL theo `DB_URL` hoặc `application.properties`):

```sql
SELECT id, code, tenant_id, cohort_id, status
FROM project_templates
WHERE code LIKE 'USPRJ001-%'
ORDER BY code;

SELECT t.code, v.version, v.status, v.is_active
FROM project_templates t
JOIN project_template_version v ON v.template_id = t.id
WHERE t.code LIKE 'USPRJ001-%'
ORDER BY t.code;
```

Nếu cần dọn fixture, trước tiên kiểm tra các nhóm đã gán template fixture:

```sql
SELECT COUNT(*) AS assigned_teams
FROM project_teams
WHERE project_template_id IN (
  SELECT id FROM project_templates WHERE code LIKE 'USPRJ001-%'
);
```

Chỉ xóa fixture trên database test khi `assigned_teams = 0`; cần xóa phiên bản, milestone, backlog và ba bảng metadata trước khi xóa `project_templates`. Không xóa 6 template demo cũ hoặc snapshot/project của nhóm đã gán.
