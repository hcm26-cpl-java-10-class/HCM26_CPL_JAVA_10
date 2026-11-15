### 5.2.5. UC-US-08 – Nhân bản Project Template (Quản lý chương trình)

> Mã use case: **US-08** — Duplicate Project Template
> Phân hệ: Quản lý Mock Project — Project Template (Hub PRJ-02/03)

#### 5.2.5.1. Mục tiêu

Cho phép Quản lý chương trình (Program Manager) **nhân bản** Project Template đang chọn thành một Project Template **hoàn toàn độc lập**. Người dùng chỉ cung cấp tên mới; hệ thống tự sinh mã template, sao chép cấu hình (mô tả, ràng buộc, milestone, checklist, rubric, backlog mẫu, tài nguyên), tạo template mới ở trạng thái **DRAFT** với phiên bản đầu tiên **`v1.0` / DRAFT** và **không** giữ liên kết `parent_template_id` về bản gốc. Template nguồn và toàn bộ phiên bản của nó không bị thay đổi, nhờ đó bản sao và bản gốc có thể phát triển độc lập.

#### 5.2.5.2. Tác nhân

- **Tác nhân chính:** Quản lý chương trình (Program Manager) — persona quản lý Project Template; cần `PROJECT_TEMPLATE_VERSION_CREATE`, `PROJECT_TEMPLATE_VERSION_READ`, `PROJECT_TEMPLATE_READ` và `PROJECT_TEMPLATE_CREATE`.
- **Tác nhân liên quan:**
  - **Quản trị viên (ADMIN):** mặc định có toàn bộ quyền, thực hiện được use case.
  - **Mentor / Teacher / Trainer:** được cấp bộ quyền `PROJECT_TEMPLATE_VERSION_*` và thuộc phạm vi dữ liệu tenant; có thể nhân bản nếu có thêm quyền template tương ứng.
  - **Hệ thống:** lớp bảo mật JWT + RBAC, `ProjectTemplateAccessService` (vai trò, tenant, data scope), `ProjectTemplateSnapshotServiceImpl#duplicateTemplate` (nghiệp vụ nhân bản), `TemplateConfigurationService` (sao chép cấu hình), `ProjectTemplateValidator` (kiểm tra template mới), `TemplateResourceCopyService` (sao chép tài nguyên), `ProjectTemplateSnapshotAuditService` (audit) và `ProjectTemplateSnapshotOutboxService` / relay (phát sự kiện).

#### 5.2.5.3. Điều kiện trước

- Người dùng đã đăng nhập, JWT còn hiệu lực; tenant đang hoạt động và người dùng thuộc phạm vi dữ liệu tenant (trừ ADMIN).
- Tài khoản có `PROJECT_TEMPLATE_VERSION_CREATE` (gọi API nhân bản) và `PROJECT_TEMPLATE_VERSION_READ` (xem phiên bản).
- Tài khoản có `PROJECT_TEMPLATE_READ` trên template nguồn và `PROJECT_TEMPLATE_CREATE` để tạo template mới; vai trò thuộc ADMIN / PROGRAM_MANAGER / MENTOR / TEACHER / TRAINER.
- Phiên bản nguồn tồn tại và là **template version** (không phải workspace snapshot).
- `contentJson` của phiên bản nguồn là JSON hợp lệ và chứa danh sách `milestones` và `backlogItems` (có thể rỗng nhưng phải tồn tại).

#### 5.2.5.4. Điều kiện sau

- Một **Project Template mới** được tạo trong `project_templates`:
  - `tenantId` = tenant của người thực hiện;
  - `code` do hệ thống sinh dạng `<mã template nguồn>-COPY-<UUID>` (duy nhất theo tenant + phiên bản), không nhận từ client;
  - `name` = tên người dùng nhập; `description`, `category`, `level`, `estimatedDurationWeeks`, `constraintsJson`, `technologyStack` được sao chép từ phiên bản nguồn;
  - `status = DRAFT`, `templateVersion = 1`; `parentTemplate` chỉ được kế thừa khi template nguồn thuộc cùng tenant và có template cha (mô hình module).
- Một bản ghi **`project_template_version`** mới cho template vừa tạo: `version = v1.0`, `status = DRAFT`, `is_active = true`, `project_id = null`, **`parent_template_id = null`** (không có lineage về bản gốc), `contentJson` được ghi lại từ cấu hình của template mới (id milestone/backlog mới).
- Các bản ghi con được sao chép sang template mới: milestone (kèm checklist, rubric criteria, late policy) và backlog mẫu; danh sách tài nguyên của template cũng được sao chép (tệp dùng chung storage key).
- Bản ghi audit `DUPLICATE` được ghi với `beforeState` của phiên bản nguồn, `afterState` của phiên bản mới kèm `duplicatedFromSnapshotId`, `duplicatedFromTemplateId`, `duplicateName`.
- Outbox event `PROJECT_TEMPLATE_VERSION_CREATED` được enqueue trong cùng transaction (idempotent).
- Template nguồn, các phiên bản nguồn và dữ liệu Workspace/Project đã sinh từ chúng **không thay đổi**.
- Giao diện điều hướng sang trang chi tiết của template mới, tab **Versions**, hiển thị phiên bản `v1.0` ở trạng thái `DRAFT` và toast **“Template duplicated as an independent draft.”**.

#### 5.2.5.5. Kích hoạt

Người dùng mở **Project Templates** → chọn template → tab **Versions** → chọn một phiên bản nguồn → bấm **“Duplicate template”**.

#### 5.2.5.6. Luồng sự kiện chính

| Bước | Tác nhân | Hành động / Phản hồi |
| --- | --- | --- |
| 1 | Người dùng | Mở Project Templates và vào trang chi tiết của template cần nhân bản. |
| 2 | Hệ thống | Kiểm tra quyền xem template/phiên bản, tải danh sách phiên bản (`GET /api/project-template-versions/by-template/{templateId}`) và chọn phiên bản mặc định (bản đang active hoặc bản mới nhất). |
| 3 | Người dùng | Chuyển sang tab **Versions**, chọn phiên bản nguồn và bấm **“Duplicate template”**. |
| 4 | Hệ thống | Mở dialog **Duplicate Project Template**: hiển thị phiên bản nguồn (`vX.Y · Template`), trường **New name** (bắt buộc, tối đa 255 ký tự) và các lưu ý: bản sao ở trạng thái `DRAFT`, phiên bản bắt đầu từ `v1.0`, cấu hình được sao chép nhưng **không** giữ `parent_template_id`. |
| 5 | Người dùng | Nhập tên template mới, bấm **“Duplicate”**. |
| 6 | Hệ thống | Kiểm tra tên không rỗng và ≤ 255 ký tự; nếu sai hiển thị lỗi ngay dưới trường và không gửi request. |
| 7 | Hệ thống | Gửi `POST /api/project-template-versions/{id}/duplicate` với body `{"name": "<tên mới>"}`, kèm `Authorization: Bearer <token>` và tuỳ chọn `X-Correlation-ID`. |
| 8 | Hệ thống | Xác thực JWT; kiểm tra `PROJECT_TEMPLATE_VERSION_CREATE`; đọc phiên bản nguồn (**404** nếu không tồn tại); kiểm tra template nguồn thuộc phạm vi người dùng (`PROJECT_TEMPLATE_READ`) và vai trò/tenant/data scope hợp lệ (**403** nếu không). |
| 9 | Hệ thống | Kiểm tra phiên bản nguồn là template version (**422** nếu là workspace snapshot); kiểm tra tên mới (**422** nếu thiếu/quá dài) và `contentJson` hợp lệ (**422** nếu rỗng/không phải JSON). |
| 10 | Hệ thống | Đọc cấu hình từ `contentJson`; bổ sung các trường còn thiếu từ cấu hình hiện tại của template; kiểm tra `milestones` và `backlogItems` tồn tại, dữ liệu milestone/backlog hợp lệ và template mới hợp lệ (`level`, thời lượng, mô tả…). |
| 11 | Hệ thống | Sinh mã template mới `<CODE>-COPY-<UUID>` (duy nhất theo tenant + phiên bản) và tạo `ProjectTemplate` mới ở trạng thái `DRAFT`, `templateVersion = 1`, tenant = tenant người thực hiện. |
| 12 | Hệ thống | Sao chép milestone (checklist, rubric criteria, late policy) và backlog mẫu sang template mới; tạo phiên bản `v1.0` / `DRAFT` / `projectId = null` / `parentTemplateId = null` với `contentJson` được ghi lại từ template mới. |
| 13 | Hệ thống | Sao chép danh sách tài nguyên của template nguồn sang phiên bản mới. |
| 14 | Hệ thống | Ghi audit `DUPLICATE` (before = phiên bản nguồn, after = phiên bản mới kèm thông tin nguồn) và enqueue outbox event `PROJECT_TEMPLATE_VERSION_CREATED`. |
| 15 | Hệ thống | Trả **201 Created** kèm `ProjectTemplateSnapshotDTO` của phiên bản `v1.0` thuộc template mới (`templateId` mới, `templateName` mới, `version = "v1.0"`, `status = "DRAFT"`, `parentTemplateId = null`, `projectId = null`). |
| 16 | Hệ thống | Điều hướng sang `/project-templates/{templateIdMới}/detail?tab=versions&version={id}`, hiển thị phiên bản `v1.0` ở trạng thái `DRAFT` và toast “Template duplicated as an independent draft.”. |

#### 5.2.5.7. Luồng thay thế và ngoại lệ

**5.2.5.7.1. Tên template mới không hợp lệ**

- Tên rỗng hoặc chỉ chứa khoảng trắng: **422** với lỗi `name`: “Vui lòng nhập tên Project Template”.
- Tên vượt quá 255 ký tự: **422** với lỗi `name`: “Tên Project Template không vượt quá 255 ký tự”.
- Dialog giữ nguyên nội dung đã nhập và tô đỏ trường `New name`.

**5.2.5.7.2. Phiên bản nguồn không tồn tại hoặc không đọc được**

- `id` không trỏ tới phiên bản còn tồn tại, hoặc template nguồn không đọc được trong tenant hiện tại: `ResourceNotFoundException` → **404 Not Found**.
- Giao diện đóng trạng thái loading, hiển thị toast lỗi và tải lại danh sách phiên bản.

**5.2.5.7.3. Không có quyền hoặc ngoài phạm vi dữ liệu**

- Thiếu `PROJECT_TEMPLATE_VERSION_CREATE`: **403 Forbidden**.
- Thiếu `PROJECT_TEMPLATE_READ` / `PROJECT_TEMPLATE_CREATE`, sai vai trò (ngoài ADMIN / PROGRAM_MANAGER / MENTOR / TEACHER / TRAINER), tài khoản bị khoá, tenant không hoạt động hoặc template ngoài data scope: `AccessDeniedException` → **403 Forbidden**.
- Chưa đăng nhập hoặc token hết hạn: **401 Unauthorized**.

**5.2.5.7.4. Nguồn là workspace snapshot**

- Phiên bản nguồn có `projectId != null` hoặc `contentJson` mang `purpose = TEAM_ASSIGNMENT`: **422** với lỗi `id`: “Workspace snapshots cannot be used as template versions”.
- Người dùng phải chọn một phiên bản template hợp lệ.

**5.2.5.7.5. Nội dung cấu hình không hợp lệ**

- `contentJson` rỗng hoặc không phải JSON hợp lệ: **422** với lỗi `contentJson`: “Vui lòng nhập nội dung snapshot” / “Nội dung snapshot không phải JSON hợp lệ”.
- Cấu hình thiếu `milestones` hoặc `backlogItems`, milestone thiếu tiêu đề/hạn/đơn vị thời gian/weight, hoặc backlog item có tiêu đề rỗng/quá 200 ký tự: `ProjectTemplateException(422)` với thông điệp “This version contains invalid template configuration” và lỗi `contentJson`: “Correct the template configuration before duplicating it”.
- Không có template/phiên bản mới nào được tạo.

**5.2.5.7.6. Dữ liệu template mới không hợp lệ**

- `ProjectTemplateValidator` từ chối khi thiếu `level`, thời lượng không phải số nguyên dương, mô tả > 1000 ký tự, danh mục/mã quá dài… → **422** với bản đồ lỗi theo trường (“Please correct the highlighted fields”).
- Transaction rollback toàn bộ: không để lại template mới ở trạng thái dở dang.

**5.2.5.7.7. Trùng mã template do gửi đồng thời**

- Mã template được sinh ngẫu nhiên và kiểm tra trùng trước khi lưu; nếu hai request đồng thời vẫn vi phạm ràng buộc duy nhất của `project_templates`, `DataIntegrityViolationException` được ánh xạ thành lỗi trùng mã (**409 Conflict**).
- Người dùng chỉ cần thực hiện lại thao tác để nhận mã mới.

**5.2.5.7.8. Người dùng bấm nhân bản nhiều lần**

- Dialog giữ cờ `pending`/`busy`, nút **Duplicate** bị vô hiệu hoá trong lúc gọi API nên không phát sinh request lặp.
- Nếu vẫn có hai request đồng thời, mỗi request tạo một mã template riêng nên không ghi đè lên nhau; người dùng có thể xoá bản sao thừa nếu cần.

**5.2.5.7.9. Lỗi máy chủ hoặc mất kết nối**

- Hệ thống trả **500 Internal Server Error**; giao diện hiển thị toast lỗi và giữ nguyên dialog để người dùng thử lại.

#### 5.2.5.8. Quy tắc nghiệp vụ và ghi chú

1. Request chỉ chứa `name`; **mã template** và **mã phiên bản** do backend sinh, client không được gửi.
2. Tên template mới bắt buộc, tối đa 255 ký tự và được trim trước khi lưu.
3. Template mới thuộc **tenant của người thực hiện**, có `status = DRAFT`, `templateVersion = 1` và mã `<mã nguồn>-COPY-<UUID>`; mã được kiểm tra duy nhất theo tenant + phiên bản.
4. Cấu hình được sao chép từ **phiên bản nguồn đang chọn** (không bắt buộc là bản mới nhất/published): mô tả, danh mục, level, thời lượng, ràng buộc, technology stack, milestone (checklist, rubric criteria, late policy) và backlog mẫu.
5. Nếu `contentJson` của phiên bản nguồn thiếu một số trường, hệ thống bổ sung từ cấu hình hiện tại của template nguồn trước khi tạo bản sao.
6. Phiên bản đầu tiên của template mới luôn là **`v1.0` / `DRAFT` / `isActive = true` / `projectId = null`** và **`parentTemplateId = null`** — bản sao **không** nằm trong cây phiên bản của template gốc (khác với “Create New Version” của US-07).
7. `contentJson` của phiên bản `v1.0` được ghi lại từ cấu hình của template mới (milestone/backlog có id mới), không phải bản sao byte-for-byte của nguồn.
8. Danh sách tài nguyên của template được sao chép sang phiên bản mới; các tệp dùng chung storage key nên không nhân đôi dữ liệu nhị phân.
9. Template nguồn, các phiên bản nguồn, project và workspace đã sinh từ chúng không bị sửa; bản sao và bản gốc độc lập sau khi tạo.
10. Nếu template nguồn thuộc cùng tenant và có template cha, template mới kế thừa `parentTemplate` (mô hình module); nếu khác tenant thì không kế thừa.
11. Audit action `DUPLICATE` ghi `beforeState` của phiên bản nguồn và `afterState` của phiên bản mới kèm `duplicatedFromSnapshotId`, `duplicatedFromTemplateId`, `duplicateName`; ghi trong cùng transaction (`Propagation.MANDATORY`).
12. Outbox event `PROJECT_TEMPLATE_VERSION_CREATED` dùng aggregate type `PROJECT_TEMPLATE_VERSION`, khoá chống trùng `PROJECT_TEMPLATE_VERSION:{snapshotId}:{eventType}:{correlationId}`, payload hướng tới `TEAM_MEMBERS`.
13. `correlationId` lấy từ header `X-Correlation-ID` nếu có; nếu không, sinh UUID dùng chung cho audit và outbox event.
14. Quyền: nhân bản cần `PROJECT_TEMPLATE_VERSION_CREATE`; đọc nguồn cần `PROJECT_TEMPLATE_READ`; tạo template mới cần `PROJECT_TEMPLATE_CREATE`; vai trò và data scope tenant phải hợp lệ.
15. Phân biệt với US-07: **Create New Version** tạo phiên bản kế tiếp trong cùng template và giữ `parentTemplateId`; **Duplicate Project Template** tạo template mới + phiên bản `v1.0` và không giữ lineage.

#### 5.2.5.9. Minh chứng kiểm thử Backend trên Swagger

##### 5.2.5.9.1. API nhân bản Project Template

- **API:** `POST /api/project-template-versions/{id}/duplicate`
- **Header:** `Authorization: Bearer <access_token>`; tuỳ chọn `X-Correlation-ID: <uuid>`.
- **Dữ liệu gửi lên:**

```json
{
  "name": "Capstone Project Template (Copy)"
}
```

- **Kết quả mong đợi:** `201 Created`, trả về `ProjectTemplateSnapshotDTO` của template mới với `templateId` mới, `templateName = "Capstone Project Template (Copy)"`, `version = "v1.0"`, `status = "DRAFT"`, `isActive = true`, `projectId = null`, `parentTemplateId = null`; audit `DUPLICATE` và outbox event `PROJECT_TEMPLATE_VERSION_CREATED` được ghi nhận.
- **Kết quả thực tế:** `[Điền HTTP status code và thông tin phản hồi thực tế]`

**Hình 5.2.5-1. Kết quả kiểm thử API nhân bản Project Template trên Swagger**

##### 5.2.5.9.2. API kiểm tra phiên bản của template mới

- **API:** `GET /api/project-template-versions/by-template/{templateIdMới}`
- **Header:** `Authorization: Bearer <access_token>`.
- **Dữ liệu gửi lên:** không có body; `templateId` của template vừa nhân bản truyền trên path.
- **Kết quả mong đợi:** `200 OK`, trả về danh sách chỉ gồm một phiên bản `v1.0` với `status = "DRAFT"`, `parentTemplateId = null`; template nguồn (gọi lại `by-template/{templateIdNguồn}`) vẫn giữ nguyên danh sách phiên bản cũ.
- **Kết quả thực tế:** `[Điền HTTP status code và thông tin phản hồi thực tế]`

**Hình 5.2.5-2. Kết quả kiểm thử API danh sách phiên bản của template mới trên Swagger**

#### 5.2.5.10. Màn hình Frontend

Màn hình chi tiết Project Template (`/project-templates/{id}/detail`) → tab **Versions**, với nút **“Duplicate template”**; dialog **Duplicate Project Template** hiển thị phiên bản nguồn, trường **New name** và các lưu ý: bản sao ở trạng thái `DRAFT`, phiên bản bắt đầu từ `v1.0`, cấu hình được sao chép nhưng không giữ `parent_template_id`. Sau khi nhân bản, ứng dụng điều hướng sang template mới với phiên bản `v1.0` ở trạng thái `DRAFT`.

Ảnh chụp cần thể hiện: (1) dialog **Duplicate Project Template** đã nhập tên mới, và (2) trạng thái sau khi nhân bản thành công (trang chi tiết template mới, tab Versions có `v1.0` / `DRAFT`, toast “Template duplicated as an independent draft.”).

**Hình 5.2.5-3. Màn hình nhân bản Project Template**
