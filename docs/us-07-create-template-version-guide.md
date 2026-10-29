# US-07 — Create Template Version (Tạo Phiên bản mới cho Mẫu đề bài)

Hướng dẫn sử dụng + mô tả phần đã bổ sung cho user story US-07.

---

## 1. Chức năng đã có (tóm tắt)

| Thành phần | Vị trí |
|---|---|
| Entity / bảng | `ProjectTemplateSnapshot` → bảng `project_template_version` (PK `snapshot_id`, unique `(template_id, version)`) |
| Service | `ProjectTemplateSnapshotServiceImpl#createNewVersion(Long)` |
| API | `POST /api/project-template-versions/{id}/new-version` (quyền `PROJECT_TEMPLATE_VERSION_CREATE`) |
| Frontend (workspace) | `pages/management/project-template-version/workspace/*` — nút **Create New Version** + `CreateVersionDialog` |
| Frontend (admin table) | `CreateNewVersionButton` (row action), dùng chung `CreateVersionDialog` |

Nghiệp vụ backend khi gọi "Create New Version" từ phiên bản nguồn `S`:

1. `version` mới = `v(<major cao nhất + 1>).0` → `v1.0 → v2.0`, `v1.1 → v2.0`.
2. `parent_template_id = S.id` (truy vết lịch sử).
3. `content_json = S.content_json` (sao chép toàn bộ cấu hình: yêu cầu, milestone, rubric…).
4. `status = DRAFT`, `is_active = true`.
5. `S` **chỉ được đọc**, không hề bị `save()` → dữ liệu snapshot cũ (đã dùng để sinh Workspace/Project) không đổi (AC02).
6. Ghi audit `CREATE_NEW_VERSION` (kèm `sourceVersionId`, `sourceVersion`, `sourceStatus`) + outbox event `PROJECT_TEMPLATE_VERSION_CREATED`.

## 2. Phần đã bổ sung trong lần cập nhật này

| # | Thay đổi | Lý do |
|---|---|---|
| 1 | Thêm nút **Create new version** vào bảng CRUD của admin/Program Manager (`CreateNewVersionButton.tsx`) | Trước đây US-07 chỉ có trong workspace; persona Program Manager (role ADMIN) chỉ thấy bảng CRUD nên không có lối vào tính năng |
| 2 | Hiển thị **lineage dạng nhãn phiên bản**: `Derived from v1.0` (header) và chip `from v1.0` (danh sách) thay cho `#<id>` | AC01 yêu cầu `parent_template_id` phải kiểm chứng được trên UI |
| 3 | Helper `parentVersionLabel()` trong `version.constants.ts` | Map `parentTemplateId` → nhãn phiên bản |
| 4 | Audit action riêng `CREATE_NEW_VERSION` + `sourceVersionId / sourceVersion / sourceStatus` | Phân biệt "tạo phiên bản mới từ bản cũ" với "tạo record thường" khi truy vết |
| 5 | Chặn đổi `templateId` của một snapshot đã tạo (422) và chặn `parentTemplateId = chính nó` (422) | Bảo vệ lineage + snapshot isolation (AC02) |

---

## 2b. Kết nối Project Template ↔ ProjectTemplateSnapshot

Trước đây `ProjectTemplate` và chuỗi phiên bản là hai module rời nhau (`template_id` chỉ là số, không có kiểm tra, tạo template không sinh phiên bản). Đã nối lại:

| Thay đổi | Vị trí |
|---|---|
| Quan hệ `@ManyToOne` (read-only, `ConstraintMode.NO_CONSTRAINT`) trên cột `template_id` | `ProjectTemplateSnapshot#template` |
| `template_id` phải tồn tại khi tạo phiên bản (422 nếu không) | `ProjectTemplateSnapshotServiceImpl#validateTemplateExists` |
| Tạo template → tự sinh phiên bản `v1.0` / `DRAFT` từ cấu hình (overview + constraints + milestone plan) | `ProjectTemplateService#create` → `createInitialVersion` |
| Kích hoạt template → phiên bản mới nhất chuyển `PUBLISHED`, nội dung được làm mới từ cấu hình đang kích hoạt | `TemplateActivationService#activate` → `publishLatestVersion` |
| `createNewVersion` đồng bộ `project_templates.template_version` (`v2.0` → `2`) | `ProjectTemplateSnapshotServiceImpl#syncTemplateVersion` |
| **AC02**: không cho sửa `content_json` / `version` của phiên bản không phải `DRAFT` (422) | `ProjectTemplateSnapshotServiceImpl#update` |
| `templateName` trả kèm trong DTO để UI hiển thị `v1.0 · Capstone` thay vì `TPL-1` | `ProjectTemplateSnapshotDTO` + `enrichOwnerNames` |
| `projectName` trả kèm trong DTO để UI hiển thị tên dự án thay vì `PRJ-1` | `ProjectTemplateSnapshotDTO` + `enrichOwnerNames` |
| Form create/edit chọn Project Template theo tên (`relation`), import/export có thêm cột `Template Name` / `Project Name` | `project-template-version.schema.ts`, `ProjectTemplateSnapshotExportRow`, `ProjectTemplateVersionImportTemplateProvider` |
| Tab **Versions** + nút **Create new version** ngay trên trang chi tiết template | `TemplateVersionsPanel.tsx`, `ProjectTemplateDetailPage.tsx` |
| `PROGRAM_MANAGER` được cấp quyền `PROJECT_TEMPLATE_VERSION_*` (persona của US-07) | `ProjectTemplateVersionAccessInitializer` |
| Template cũ chưa có phiên bản nào: `POST /api/project-template-versions/by-template/{templateId}/initial-version` | `ProjectTemplateSnapshotController` |

---

## 3. Chạy ứng dụng

```powershell
# Terminal 1 - backend (H2 file DB: backend/data/fams_lms)
cd backend
.\mvnw.cmd "-Dmaven.test.skip=true" spring-boot:run

# Terminal 2 - frontend
cd frontend
npm run dev
```

- Backend: `http://localhost:8080` (Swagger: `/swagger-ui/index.html`)
- Frontend: `http://localhost:5173` (mặc định của Vite), API base `http://localhost:8080/api`
- Tài khoản seed có quyền: `admin@example.com / password123` (ADMIN — dùng cho persona Program Manager)

Seed data sẵn có (`ProjectTemplateSnapshotDataInitializer`):
- Template **1**: `v1.0` → `v1.1` → `v2.0` (chuỗi parent đầy đủ, đều `PUBLISHED`)
- Template **2**: `v1.0`; Template **3**: `v1.0`

---

## 4. Demo AC01 — Tạo phiên bản mới thành công

### 4.1. Đường dẫn 1: bảng quản trị (Program Manager / ADMIN)

1. Đăng nhập `admin@example.com / password123`.
2. Menu **Project Management → Project Template Versions** (`/project-template-versions`).
3. Ở dòng `v1.0`, bấm icon **Create new version** (biểu tượng `CopyPlus`, nằm cạnh **Clone**).
4. Dialog hiển thị `v1.0 → v2.0` và giải thích: tăng version tự động, sao chép cấu hình, trạng thái `DRAFT`, `Parent Version ID` trỏ về `v1.0`, workspace cũ không bị ảnh hưởng.
5. Bấm **Create v2.x** → toast: `Đã tạo phiên bản vX.0 ở trạng thái DRAFT.`
6. Bảng tự refresh; dòng mới có:
   - `Version` = phiên bản vừa tăng,
   - `Status` = **DRAFT**,
   - `Parent Version ID` = `snapshot_id` của `v1.0`.

### 4.2. Đường dẫn 2: workspace phiên bản (STUDENT / có `PROJECT_TEMPLATE_VERSION_*`)

1. Mở `/project-template-versions` bằng tài khoản STUDENT (ví dụ tài khoản học viên chuẩn trong `docs/us-prj-001-02/standard-accounts.sql`).
2. Chọn một phiên bản ở dropdown **Version x of y** (mặc định là phiên bản mới nhất đang active).
3. Bấm **Create New Version** ở góc phải header.
4. Xác nhận trong dialog → app tự chọn phiên bản mới và chuyển sang tab **Versions**.
5. Kiểm tra chip `from v1.0` trên dòng mới và badge **Draft**.

### 4.3. Kiểm chứng bằng API

```powershell
# 1) Đăng nhập lấy token
$login = Invoke-RestMethod -Method Post -Uri http://localhost:8080/api/auth/login `
  -ContentType 'application/json' `
  -Body '{"email":"admin@example.com","password":"password123"}'
$token = $login.accessToken

# 2) Xem các phiên bản của template 1 (mới nhất trước)
Invoke-RestMethod -Uri http://localhost:8080/api/project-template-versions/by-template/1 `
  -Headers @{ Authorization = "Bearer $token" } | Format-Table id,version,status,parentTemplateId,isActive

# 3) Tạo phiên bản mới từ snapshot id = 1  -> 201 Created
Invoke-RestMethod -Method Post -Uri http://localhost:8080/api/project-template-versions/1/new-version `
  -Headers @{ Authorization = "Bearer $token" } | ConvertTo-Json -Depth 4
```

Kết quả mong đợi: `version = v3.0` (do template 1 đã có tới `v2.0`), `status = DRAFT`, `parentTemplateId = 1`, `contentJson` giống hệt `v1.0`.

> Gọi lại lần nữa sẽ tạo tiếp `v4.0` vì version luôn lấy **major lớn nhất + 1**.

### 4.4. Xem audit trail

```powershell
Invoke-RestMethod -Uri http://localhost:8080/api/project-template-versions/6/audit-logs `
  -Headers @{ Authorization = "Bearer $token" } | Format-Table action,actorEmail,correlationId,createdAt
```

Dòng mới nhất có `action = CREATE_NEW_VERSION`, `after_state` chứa `sourceVersionId`, `sourceVersion`, `sourceStatus`.

---

## 5. Demo AC02 — Snapshot Isolation

Mục tiêu: sửa `v2.0` **không** làm đổi dữ liệu Workspace/Project đã sinh từ `v1.0`.

1. **Chụp trạng thái trước**: mở **Workspace** (`/management/workspaces/candidates` → chọn một workspace → tab **Overview**). Ghi lại nội dung `topic_snapshot` (topic code/title, version, description, requirements…).
   - Nội dung này nằm ở bảng `project_topic_snapshots` và là `@Immutable` — được copy một lần khi workspace được sinh ra.
2. **Tạo phiên bản mới** từ `v1.0` (mục 4).
3. **Sửa nội dung phiên bản mới**: ở workspace → **Version Actions → Edit version**, đổi `Content JSON` (thêm milestone/yêu cầu mới), giữ nguyên `Status = DRAFT`, lưu.
   - Hoặc gọi `PUT /api/project-template-versions/{id}` với `contentJson` mới.
4. **Kiểm tra lại**:
   - Workspace ở bước 1: nội dung `topic_snapshot` **không đổi**.
   - Phiên bản `v1.0`: `GET /api/project-template-versions/by-template/1` → `contentJson` của `v1.0` **không đổi** (chỉ dòng mới bị sửa; mỗi phiên bản là một bản ghi độc lập).
   - Header của phiên bản mới hiển thị `Derived from v1.0`.

Lý do kỹ thuật: `createNewVersion` chỉ `save()` bản ghi **mới**; `update()` chỉ cập nhật đúng `snapshot_id` được gửi lên. Ngoài ra API `update` giờ từ chối (422) việc đổi `templateId` của một phiên bản, nên một phiên bản không thể bị "chuyển" sang template khác và phá vỡ lineage.

---

## 6. Bảng lỗi thường gặp

| HTTP | Trường hợp | Xử lý |
|---|---|---|
| 401/403 | Không có `PROJECT_TEMPLATE_VERSION_CREATE` | Đăng nhập ADMIN, hoặc cấp quyền cho role đang dùng |
| 404 | `id` phiên bản nguồn không tồn tại | Kiểm tra lại `snapshot_id` |
| 409 | Trùng `(template_id, version)` (2 request đồng thời) | Gọi lại — version sẽ được tính lại |
| 422 `contentJson` | Snapshot nguồn chứa JSON không hợp lệ | Sửa `contentJson` của phiên bản nguồn trước |
| 422 `templateId` | Cố đổi template của phiên bản | Không hỗ trợ: hãy tạo phiên bản ở template đích |
| 422 `parentTemplateId` | Đặt một phiên bản làm cha của chính nó | Chọn phiên bản nguồn khác |

---

## 7. Ghi chú triển khai

- Version label dùng regex `^[vV]?(\d+)(?:\.(\d+))?$`; nhãn không đúng chuẩn bị bỏ qua khi tính version kế tiếp.
- Nếu **không** parse được nhãn nào, version kế tiếp = `số phiên bản hiện có + 1`.
- `status` lifecycle: `DRAFT` (mới tạo) → `PUBLISHED` (đang dùng) → `ARCHIVED` (chỉ lưu trữ). Việc chuyển trạng thái thực hiện qua **Edit version** (hoặc `PUT` API), backend không tự publish.
- Outbox: mỗi thao tác tạo phiên bản phát event `PROJECT_TEMPLATE_VERSION_CREATED` (payload có `parentTemplateId`, `sourceVersionId`).
