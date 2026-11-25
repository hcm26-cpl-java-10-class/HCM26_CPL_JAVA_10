### 5.2.4. UC-US-07 – Tạo phiên bản mới cho Project Template (Quản lý chương trình)

> Mã use case: **US-07** — Create New Version of Project Template
> Phân hệ: Quản lý Mock Project — Project Template (Hub PRJ-02/03)

#### 5.2.4.1. Mục tiêu

Cho phép Quản lý chương trình (Program Manager) tạo một **phiên bản mới** từ một phiên bản Project Template đang có. Hệ thống tự động tăng nhãn phiên bản (ví dụ `v1.0 → v2.0`), sao chép toàn bộ cấu hình (yêu cầu, milestone, rubric, tài nguyên…) sang bản ghi mới, lưu bản ghi mới ở trạng thái **DRAFT** và ghi nhận `parentTemplateId` để truy vết nguồn gốc. Phiên bản nguồn **không bị sửa đổi**, nhờ đó các Workspace/Project đã sinh ra từ phiên bản đó vẫn giữ nguyên dữ liệu (snapshot isolation).

#### 5.2.4.2. Tác nhân

- **Tác nhân chính:** Quản lý chương trình (Program Manager) — persona quản lý Project Template và chuỗi phiên bản; cần `PROJECT_TEMPLATE_VERSION_CREATE`, `PROJECT_TEMPLATE_VERSION_READ` và quyền `PROJECT_TEMPLATE_READ` / `PROJECT_TEMPLATE_UPDATE` trên template sở hữu.
- **Tác nhân liên quan:**
  - **Quản trị viên (ADMIN):** mặc định có toàn bộ quyền, thực hiện được use case qua bảng CRUD hoặc workspace.
  - **Mentor / Teacher / Trainer:** được cấp bộ quyền `PROJECT_TEMPLATE_VERSION_*` và thuộc phạm vi dữ liệu tenant, có thể thực hiện nếu có thêm quyền template tương ứng.
  - **Hệ thống:** lớp bảo mật JWT + RBAC, `ProjectTemplateAccessService` (vai trò, tenant và data scope), `ProjectTemplateSnapshotServiceImpl` (nghiệp vụ tạo phiên bản), `TemplateVersionLifecycleService` (vòng đời phiên bản), `TemplateResourceCopyService` (sao chép tài nguyên), `ProjectTemplateSnapshotAuditService` (audit) và `ProjectTemplateSnapshotOutboxService` / relay (phát sự kiện).

#### 5.2.4.3. Điều kiện trước

- Người dùng đã đăng nhập, JWT còn hiệu lực; tenant đang hoạt động và người dùng thuộc phạm vi dữ liệu tenant (trừ ADMIN).
- Tài khoản có `PROJECT_TEMPLATE_VERSION_CREATE` (tạo phiên bản) và `PROJECT_TEMPLATE_VERSION_READ` (xem danh sách phiên bản).
- Tài khoản có `PROJECT_TEMPLATE_READ` và `PROJECT_TEMPLATE_UPDATE` trên Project Template sở hữu; template không ở trạng thái `ARCHIVED`.
- Phiên bản nguồn tồn tại, thuộc template mà người dùng được truy cập và là **template version** (không phải workspace snapshot).
- `contentJson` của phiên bản nguồn là JSON hợp lệ.

#### 5.2.4.4. Điều kiện sau

- Một bản ghi mới được lưu vào bảng `project_template_version` với:
  - `version` = nhãn kế tiếp do hệ thống sinh (major lớn nhất + 1, minor = 0, ví dụ `v2.0`);
  - `parent_template_id` = `snapshot_id` của phiên bản nguồn;
  - `content_json` = bản sao nội dung của phiên bản nguồn;
  - `status = DRAFT`, `is_active = true`, `project_id = null`.
- Danh sách tài nguyên của template được sao chép sang phiên bản mới (`TemplateResourceCopyService`), cấu hình version được đồng bộ từ `contentJson`.
- Nếu Project Template đang `DRAFT`, thuộc tính `template_version` của template được cập nhật theo major mới.
- Bản ghi audit `CREATE_NEW_VERSION` được ghi với actor, thời gian, `correlationId`, `afterState` (kèm `sourceVersionId`, `sourceVersion`, `sourceStatus`).
- Outbox event `PROJECT_TEMPLATE_VERSION_CREATED` được enqueue trong cùng transaction (idempotent theo aggregate + event + correlation ID).
- Phiên bản nguồn và dữ liệu Workspace/Project đã sinh từ phiên bản nguồn **không thay đổi**.
- Tại workspace, giao diện tự chọn phiên bản mới, chuyển sang tab **Versions** và hiển thị toast **“Đã tạo phiên bản vX.0 ở trạng thái DRAFT.”**; tại bảng quản trị, bảng được tải lại và hiển thị toast “Version vX.0 created as a draft.”.

#### 5.2.4.5. Kích hoạt

Người dùng mở `/project-template-versions`, chọn một phiên bản trong ribbon/danh sách và bấm **“Create New Version”** ở header workspace, hoặc bấm icon **Create new version** (`CopyPlus`) trên dòng tương ứng ở bảng quản trị Project Template Versions.

#### 5.2.4.6. Luồng sự kiện chính

| Bước | Tác nhân | Hành động / Phản hồi |
| --- | --- | --- |
| 1 | Người dùng | Mở Project Template Versions (`/project-template-versions`) hoặc menu **Project Management → Project Template Versions**. |
| 2 | Hệ thống | Kiểm tra quyền đọc phiên bản, tải danh sách phiên bản (`templateId` tăng dần, `createdAt` giảm dần) và chọn mặc định phiên bản mới nhất đang active. |
| 3 | Người dùng | Chọn phiên bản nguồn (ví dụ `v1.0`) và bấm **“Create New Version”** / icon **Create new version**. |
| 4 | Hệ thống | Mở dialog **Create New Version**, tải các phiên bản cùng template (`GET /api/project-template-versions/by-template/{templateId}`) và hiển thị chuỗi `v1.0 → v2.0` kèm giải thích: tăng version tự động, sao chép cấu hình, trạng thái `DRAFT`, `Parent Version ID` trỏ về phiên bản nguồn, workspace cũ không bị ảnh hưởng. |
| 5 | Người dùng | Bấm **“Create vX.0”** để xác nhận. |
| 6 | Hệ thống | Gửi `POST /api/project-template-versions/{id}/new-version` (không có body), kèm `Authorization: Bearer <token>` và tuỳ chọn header `X-Correlation-ID`. |
| 7 | Hệ thống | Xác thực JWT; kiểm tra `PROJECT_TEMPLATE_VERSION_CREATE`; đọc phiên bản nguồn (**404** nếu không tồn tại) và kiểm tra template sở hữu thuộc phạm vi người dùng (readable + owned, **403/404** nếu không). |
| 8 | Hệ thống | Kiểm tra phiên bản nguồn là template version (**422** nếu là workspace snapshot); kiểm tra template chưa `ARCHIVED` (**422**); kiểm tra `templateId` và `contentJson` hợp lệ (**422**). |
| 9 | Hệ thống | Tính nhãn phiên bản kế tiếp từ danh sách phiên bản hiện có của template (`highest major + 1`, minor = 0), lặp đến khi nhãn chưa tồn tại. |
| 10 | Hệ thống | Tạo bản ghi mới: `templateId` của nguồn, `projectId = null`, `parentTemplateId = source.id`, `version` vừa tính, `contentJson` sao chép, `status = DRAFT`, `isActive = true`; lưu trong transaction. |
| 11 | Hệ thống | Đồng bộ `template_version` của template (nếu template đang `DRAFT`), đồng bộ cấu hình version và sao chép danh sách tài nguyên từ phiên bản nguồn. |
| 12 | Hệ thống | Ghi audit `CREATE_NEW_VERSION` (after-state kèm thông tin phiên bản nguồn) và enqueue outbox event `PROJECT_TEMPLATE_VERSION_CREATED`. |
| 13 | Hệ thống | Trả **201 Created** kèm `ProjectTemplateSnapshotDTO` của phiên bản mới (`id`, `version`, `status = DRAFT`, `parentTemplateId`, `templateName`, `contentJson`, …). |
| 14 | Hệ thống | Tải lại danh sách phiên bản; tại workspace, chọn phiên bản mới, chuyển sang tab **Versions**, hiển thị chip `from v1.0` / dòng **Derived from v1.0** và toast “Đã tạo phiên bản vX.0 ở trạng thái DRAFT.”. |

#### 5.2.4.7. Luồng thay thế và ngoại lệ

**5.2.4.7.1. Phiên bản nguồn không tồn tại**

- `id` không trỏ tới phiên bản còn tồn tại: `ResourceNotFoundException` → **404 Not Found**.
- Giao diện đóng trạng thái loading, hiển thị toast “Không thể tạo phiên bản mới.” và tải lại danh sách.

**5.2.4.7.2. Không có quyền hoặc ngoài phạm vi dữ liệu**

- Thiếu `PROJECT_TEMPLATE_VERSION_CREATE`: **403 Forbidden**.
- Thiếu `PROJECT_TEMPLATE_READ` / `PROJECT_TEMPLATE_UPDATE`, sai vai trò (ngoài ADMIN / PROGRAM_MANAGER / MENTOR / TEACHER / TRAINER), tài khoản bị khoá, tenant không hoạt động hoặc template ngoài data scope: `AccessDeniedException` → **403 Forbidden**.
- Chưa đăng nhập hoặc token hết hạn: **401 Unauthorized**.

**5.2.4.7.3. Template đã bị lưu trữ (ARCHIVED)**

- `requireOwnedTemplate` từ chối template `ARCHIVED`: **422** với lỗi `templateId`: “Archived templates cannot be changed”.
- Không có bản ghi mới nào được tạo.

**5.2.4.7.4. Nguồn là workspace snapshot**

- Phiên bản nguồn có `projectId != null`, thuộc bản ghi đã dùng cho project, hoặc `contentJson` mang `purpose = TEAM_ASSIGNMENT`: **422** với lỗi `id`: “Workspace snapshots cannot be used as template versions”.
- Người dùng phải chọn một phiên bản template hợp lệ.

**5.2.4.7.5. Nội dung cấu hình không hợp lệ**

- `contentJson` của phiên bản nguồn rỗng hoặc không phải JSON hợp lệ: **422** với lỗi `contentJson`: “Vui lòng nhập nội dung snapshot” / “Nội dung snapshot không phải JSON hợp lệ”.
- Người dùng phải sửa phiên bản nguồn (nếu còn `DRAFT`) hoặc chọn phiên bản khác.

**5.2.4.7.6. Trùng nhãn phiên bản do gửi đồng thời**

- Hai người cùng tạo phiên bản từ một nguồn: request đến sau có thể trùng `(template_id, version)`; ràng buộc duy nhất `uk_project_template_version` hoặc `DataIntegrityViolationException` → **409 Conflict** với thông điệp “Phiên bản này đã tồn tại cho Project Template đã chọn”.
- Hệ thống tính nhãn kế tiếp bằng cách lặp tới nhãn chưa tồn tại, nên người dùng chỉ cần gọi lại để nhận nhãn mới.

**5.2.4.7.7. Nhãn phiên bản không theo chuẩn**

- Các nhãn không khớp `^[vV]?(\d+)(?:\.(\d+))?$` bị bỏ qua khi tính major lớn nhất.
- Nếu không parse được nhãn nào, nhãn kế tiếp = số phiên bản hiện có + 1.

**5.2.4.7.8. Template chưa có phiên bản nào**

- Với template cũ chưa từng có phiên bản, hệ thống hỗ trợ tạo phiên bản nền `v1.0` qua `POST /api/project-template-versions/by-template/{templateId}/initial-version`.
- Trả **201 Created** với phiên bản `v1.0`; nếu template đã có baseline `v1.0` (chưa gắn project) thì trả **200 OK** với body `null` (idempotent, không tạo trùng).

**5.2.4.7.9. Người dùng bấm tạo nhiều lần**

- Dialog giữ cờ `pending`/`loading`, nút xác nhận bị vô hiệu hoá trong lúc gọi API nên không phát sinh request lặp.
- Nếu vẫn có hai request đồng thời, ràng buộc duy nhất ở database bảo đảm chỉ một phiên bản được tạo; request còn lại nhận **409**.

**5.2.4.7.10. Lỗi máy chủ hoặc mất kết nối**

- Hệ thống trả **500 Internal Server Error**; giao diện hiển thị toast lỗi và giữ nguyên dialog để người dùng thử lại.

#### 5.2.4.8. Quy tắc nghiệp vụ và ghi chú

1. Nhãn phiên bản do **backend** sinh, không nhận từ client: major lớn nhất trong các phiên bản của template + 1, minor luôn là `0` (`v1.0 → v2.0`, `v1.1 → v2.0`). Hệ thống lặp tới khi nhãn chưa tồn tại.
2. Nhãn không đúng định dạng `v<major>[.<minor>]` bị bỏ qua; nếu không có nhãn nào parse được, nhãn kế tiếp = số phiên bản hiện có + 1.
3. Phiên bản mới luôn có `status = DRAFT`, `isActive = true`, `projectId = null` và `parentTemplateId = snapshot_id` của phiên bản nguồn (truy vết lineage).
4. Nội dung cấu hình (`contentJson`) được sao chép nguyên vẹn sang bản ghi mới; chuỗi là immutable nên phiên bản nguồn không thể bị thay đổi thông qua phiên bản con.
5. **Snapshot isolation (AC02):** phương thức chỉ `save()` bản ghi mới, không `save()` bản ghi nguồn. Workspace/Project đã sinh từ phiên bản cũ giữ nguyên dữ liệu; bảng `project_topic_snapshots` là `@Immutable`.
6. Chỉ phiên bản `DRAFT` mới được sửa nội dung/nhãn/trạng thái. Phiên bản `PUBLISHED` / `ARCHIVED` là read-only; muốn thay đổi phải tạo phiên bản mới (**422** nếu cố sửa).
7. Không thể đổi `templateId` của một phiên bản đã tạo (**422** “Không thể thay đổi Project Template của phiên bản đã tạo”) và không thể đặt một phiên bản làm cha của chính nó (**422**).
8. Khi tạo phiên bản mới, danh sách tài nguyên của template được sao chép sang phiên bản mới; bản nháp sau đó có thể thay đổi độc lập.
9. Nếu Project Template đang `DRAFT`, `template_version` của template được đồng bộ theo major mới; template `ARCHIVED` không được thay đổi.
10. Audit action riêng `CREATE_NEW_VERSION` (khác với `CREATE` thông thường) kèm `sourceVersionId`, `sourceVersion`, `sourceStatus`; audit được ghi trong cùng transaction (`Propagation.MANDATORY`).
11. Outbox event `PROJECT_TEMPLATE_VERSION_CREATED` dùng aggregate type `PROJECT_TEMPLATE_VERSION`, khoá chống trùng `PROJECT_TEMPLATE_VERSION:{snapshotId}:{eventType}:{correlationId}`, payload hướng tới `TEAM_MEMBERS`.
12. `correlationId` lấy từ header `X-Correlation-ID` nếu có; nếu không, sinh UUID dùng chung cho audit và outbox event của request.
13. “Create New Version” giữ nguyên template và tạo phiên bản kế tiếp trong cùng chuỗi; khác với “Duplicate template” (US-08) — tạo **Project Template mới** với phiên bản `v1.0` / `DRAFT` và **không** có `parentTemplateId`.
14. Quyền: tạo phiên bản cần `PROJECT_TEMPLATE_VERSION_CREATE`; thao tác còn yêu cầu quyền đọc/ghi trên Project Template sở hữu cùng vai trò và data scope tenant hợp lệ.

#### 5.2.4.9. Minh chứng kiểm thử Backend trên Swagger

##### 5.2.4.9.1. API tạo phiên bản mới

- **API:** `POST /api/project-template-versions/{id}/new-version`
- **Header:** `Authorization: Bearer <access_token>`; tuỳ chọn `X-Correlation-ID: <uuid>`.
- **Dữ liệu gửi lên:** không có request body; `id` của phiên bản nguồn truyền trên path (ví dụ `id = 1` – phiên bản `v1.0` của template 1).
- **Kết quả mong đợi:** `201 Created`, trả về `ProjectTemplateSnapshotDTO` với `version` là nhãn kế tiếp (template 1 đã có `v1.0`, `v1.1`, `v2.0` nên kết quả là `v3.0`), `status = "DRAFT"`, `parentTemplateId = 1`, `templateId` giữ nguyên, `contentJson` giống hệt phiên bản nguồn; audit `CREATE_NEW_VERSION` và outbox event `PROJECT_TEMPLATE_VERSION_CREATED` được ghi nhận.
- **Kết quả thực tế:** `[Điền HTTP status code và thông tin phản hồi thực tế]`

**Hình 5.2.4-1. Kết quả kiểm thử API tạo phiên bản mới trên Swagger**

##### 5.2.4.9.2. API kiểm tra chuỗi phiên bản của Project Template

- **API:** `GET /api/project-template-versions/by-template/{templateId}`
- **Header:** `Authorization: Bearer <access_token>`.
- **Dữ liệu gửi lên:** không có body; `templateId` truyền trên path.
- **Kết quả mong đợi:** `200 OK`, trả về danh sách phiên bản của template (mới nhất trước) thể hiện chuỗi `v3.0 → v2.0 → v1.1 → v1.0`; phiên bản mới có `status = "DRAFT"` và `parentTemplateId` trỏ về phiên bản nguồn, phiên bản nguồn giữ nguyên `contentJson`.
- **Kết quả thực tế:** `[Điền HTTP status code và thông tin phản hồi thực tế]`

**Hình 5.2.4-2. Kết quả kiểm thử API danh sách phiên bản của Project Template trên Swagger**

#### 5.2.4.10. Màn hình Frontend

Màn hình `Project Template Versions` (`/project-template-versions`) với ribbon chọn phiên bản, nút **“Create New Version”** ở header (hoặc icon **Create new version** trên dòng của bảng quản trị), dialog xác nhận hiển thị chuỗi `v1.0 → v2.0` cùng các lưu ý về sao chép cấu hình, trạng thái `DRAFT`, `Parent Version ID` và việc workspace cũ không bị ảnh hưởng; sau khi tạo, phiên bản mới được chọn, tab **Versions** mở ra với chip **from v1.0** và badge **Draft**.

Ảnh chụp cần thể hiện: (1) dialog **Create New Version** đang xem trước nhãn phiên bản kế tiếp, và (2) trạng thái sau khi tạo thành công (phiên bản mới ở trạng thái `DRAFT`, có nhãn `Derived from v1.0`, toast “Đã tạo phiên bản vX.0 ở trạng thái DRAFT.”).

**Hình 5.2.4-3. Màn hình tạo phiên bản mới cho Project Template**
