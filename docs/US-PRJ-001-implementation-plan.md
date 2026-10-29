# US-PRJ-001 — Tìm kiếm, lọc và preview đề bài khi gán cho nhóm

## 1. Mục tiêu và phạm vi

Ở màn hình phân nhóm, Mentor/Program Manager mở bộ chọn đề bài của **một nhóm cụ thể**, tìm và lọc trên server, xem nội dung phiên bản đã công bố, rồi xác nhận gán. Kết quả chỉ gồm template `ACTIVE` trong tenant và phạm vi lớp/cohort của actor, có phiên bản baseline `PUBLISHED` được phép gán. Danh sách có phân trang và tổng số kết quả. Thao tác gán hiện có tiếp tục tạo snapshot/project/workspace theo luồng US-13.

Phạm vi đầu tiên là màn hình quản lý `frontend/src/pages/management/team-allocation/index.tsx`. Màn hình `frontend/src/pages/student/draft-team/index.tsx` đang dùng chung `/api/v1/project-templates/options` nhưng persona Student không thuộc story này; cần giữ luồng đó hoạt động qua API riêng có giới hạn theo nhóm của trưởng nhóm, hoặc chuyển nó sang bộ chọn mới với quy tắc quyền được chốt riêng. Không siết endpoint cũ một cách làm hỏng chức năng Student.

## 2. Hiện trạng và khoảng trống

| Hạng mục | Hiện trạng | Việc cần làm |
| --- | --- | --- |
| Bộ chọn | Mỗi team card dùng `<select>`; `getAssignableOptions()` tải toàn bộ danh sách một lần. | Dialog/drawer theo `teamId`, kết quả dạng thẻ hoặc bảng, tìm kiếm, lọc, phân trang, preview, xác nhận. |
| API option | `GET /api/v1/project-templates/options` chỉ yêu cầu `isAuthenticated()`; `ProjectTeamTemplateService#getAssignableTemplates` dùng `findAll()` rồi lọc trong bộ nhớ. | Endpoint mới theo class/session/team, kiểm tra role và scope trước truy vấn; query DB có pagination và count. |
| API thư viện | `GET /api/project-templates/available` có search, level, category, page/size nhưng `ProjectTemplateAccessService` chỉ cho ADMIN/PROGRAM_MANAGER với tenant scope; search chỉ xét code/name, có thể gồm shared template `tenant_id=null`. | Không dùng trực tiếp cho picker; thêm search description, công nghệ, role, chuẩn đầu ra và phạm vi theo nhóm. |
| Dữ liệu | `ProjectTemplate` có name/description/category/level/duration/constraints; role quota trong JSON. Chưa có công nghệ và chuẩn đầu ra chuẩn hóa. | Tạo metadata có kiểm soát để lọc chính xác; backfill dữ liệu theo quy tắc rõ ràng. |
| Phiên bản | `ProjectTemplateSnapshotRepository` tìm `PUBLISHED` + `isActive`, còn `TemplateBriefSnapshotWriter` fallback sang phiên bản active bất kỳ hoặc template gốc. | Định nghĩa một nguồn phiên bản published duy nhất cho picker, preview và assignment; bỏ fallback sang DRAFT cho luồng này. |
| Audit | `ProjectTemplateAudit` gắn với `templateId` và dùng cho thay đổi template; không phù hợp request bị từ chối trước khi có template. | Audit truy cập riêng, ghi cả quyền bị từ chối, không ghi token/nội dung nhạy cảm. |

## 3. Quyết định nghiệp vụ cần cố định trong contract

1. **Scope:** lấy tenant từ principal đã xác thực, lấy cohort/class từ `team -> allocation session -> training class`; kiểm tra tenant của principal khớp tenant của class và actor có role `MENTOR` hoặc `PROGRAM_MANAGER` cùng assignment/scope hợp lệ cho class/cohort. Không dùng `tenantId` client gửi để cấp quyền. Nếu UI gửi `X-Tenant-Id`, chỉ dùng để đối chiếu và trả `403` khi lệch.
2. **Template thuộc cohort:** hiện `ProjectTemplate` chỉ có `tenantId`, chưa có `cohortId`. Để đáp ứng đúng câu “cùng Tenant/Cohort”, thêm quan hệ phạm vi template (ví dụ bảng `project_template_scopes` gồm `template_id`, `tenant_id`, `cohort_id` nullable). `cohort_id = null` nghĩa là template dùng chung trong tenant; giá trị cụ thể chỉ hiện trong cohort đó. Quy tắc này phải áp dụng đồng nhất cho search, preview và gán. Không coi `tenant_id=null` là được chia sẻ giữa các tenant trong picker mới nếu story yêu cầu cô lập tenant tuyệt đối; dữ liệu demo dùng chung hiện có cần migrate/copy theo tenant hoặc loại khỏi picker.
3. **Baseline:** mỗi template đủ điều kiện có đúng một phiên bản hiện hành `PUBLISHED` + `isActive=true` và không phải snapshot tạo khi gán (`purpose != TEAM_ASSIGNMENT`). Có thể lưu `current_published_version_id` trên template hoặc ràng buộc bất biến tương đương ở service/database. Chỉ trả phiên bản này trong search và preview. Nếu chưa có bản published hợp lệ thì bỏ template khỏi kết quả và chặn gán. Chốt nghĩa của “baseline công bố” là **bản published hiện hành**, không mặc định luôn là `v1.0`.
4. **Tổ hợp bộ lọc:** các nhóm điều kiện khác nhau dùng AND; nhiều công nghệ trong cùng nhóm dùng OR (`React` hoặc `Java`), nhiều role/outcome trong cùng nhóm dùng OR. Nếu nghiệp vụ cần “phải có tất cả” công nghệ, đổi contract thành `match=ALL` và test tương ứng. `level` dùng enum hiện có; xác nhận giá trị thực tế của `Medium` trước khi nối UI. Role `Fullstack` cần ánh xạ rõ trong metadata, không suy diễn từ role quota `DEV`.
5. **Trạng thái nhóm:** có thể xem đề bài trong phạm vi được giao, nhưng nút gán chỉ bật cho nhóm `DRAFT` và các ràng buộc hiện có. Không ẩn template vì sĩ số chưa phù hợp nếu Mentor cần cân nhắc; hiển thị nhãn “phù hợp sĩ số/không phù hợp” và để server chặn lúc gán.

## 4. Thiết kế backend

### 4.1. Metadata và migration

- Bổ sung taxonomy có ID/code ổn định cho `technology`, `target_role`, `learning_outcome`; bảng liên kết `project_template_technologies`, `project_template_roles`, `project_template_outcomes`, và phạm vi cohort. Mỗi bảng liên kết có unique key `(template_id, taxonomy_id)` và index chiều ngược để tìm kiếm. Nếu danh mục đã tồn tại ở module khác, tái sử dụng thay vì tạo taxonomy trùng.
- Thêm CRUD metadata vào form tạo/sửa template, validation code hợp lệ, tenant ownership và giới hạn số lượng tag. Dữ liệu cũ không tự suy diễn từ mô tả; backfill những template có nguồn xác thực, còn lại để rỗng và hiển thị “Chưa phân loại”.
- Bổ sung index cho `project_templates(tenant_id, status, is_active, name)` và `project_template_version(template_id, status, is_active)`; xem query plan với dữ liệu lớn. Không dùng lọc JSON trên toàn bảng cho role/technology/outcome.

### 4.2. API theo team

Đề xuất endpoint (giữ `/api/v1/project-templates/options` cho compatibility trong giai đoạn chuyển đổi):

```text
GET /api/v1/classes/{classId}/allocation-sessions/{sessionId}/teams/{teamId}/project-template-candidates
    ?q=...&technology=React&technology=Java&level=MEDIUM
    &role=FULLSTACK&outcome=...&category=...&page=0&size=12
GET /api/v1/classes/{classId}/allocation-sessions/{sessionId}/teams/{teamId}/project-template-candidates/{templateId}
```

Search trả `items`, `page`, `size`, `totalElements`, `totalPages` (hoặc `Page<T>` nếu theo contract hiện tại). Mỗi item gồm `templateId`, `versionId`, `version`, `name`, đoạn mô tả ngắn, category, level, technologies, roles, outcomes, duration, `minMembers`, `maxMembers`, `capacityMatch`; không trả `contentJson` đầy đủ trong list. Preview trả nội dung brief của đúng `versionId`: mô tả/bối cảnh, mục tiêu, chuẩn đầu ra, công nghệ, role, quy mô nhóm, ràng buộc, milestones/deliverables và phiên bản. Chỉ trả dữ liệu cần hiển thị, parse JSON thành DTO rõ kiểu; không expose entity/JPA.

Quy trình service cho cả hai API:

1. Xác thực token; kiểm tra actor đang active, có role được phép và quyền đọc picker. Thiếu token trả `401`; có token nhưng sai role/scope trả `403` và audit.
2. Resolve class/session/team theo quan hệ thật; xác nhận tenant của actor và class khớp, cohort/scope của actor hợp lệ. Với ID tồn tại ngoài tenant, trả `403` theo AC04, không có template body; với ID không tồn tại trong scope có thể dùng `404` sau khi xác thực scope gốc để hạn chế enumeration.
3. Query DB với tenant/cohort, `status=ACTIVE`, `isActive=true`, published baseline hiện hành, keyword trên name/code/description; `EXISTS` cho từng taxonomy để tránh nhân bản rows khi lọc nhiều tag. Dùng `distinct`/count query đúng với pagination, sort allowlist và tie-breaker `id`.
4. Ràng buộc `q` đã trim, giới hạn độ dài (ví dụ 120 ký tự), `page >= 0`, `1 <= size <= 50`, filter code hợp lệ. Escape `%`, `_`, `\` trong LIKE; keyword không phân biệt hoa thường. Reset page khi thay bộ lọc.
5. Preview dùng cùng predicate quyền và eligibility với search, tra theo `templateId` và baseline đã trả; nếu template bị archive/unpublish sau khi mở list thì thông báo kết quả không còn khả dụng.

Thêm permission riêng `PROJECT_TEMPLATE_ASSIGN_SEARCH` và gán cho role Mentor/Program Manager phù hợp. Không dựa độc quyền vào `PROJECT_TEMPLATE_READ`, vì hiện permission này chủ yếu dành cho quản trị template và `ProjectTemplateAccessService` loại Mentor. Đối với `ADMIN` hiện có, chốt rõ có được đóng vai Program Manager hay không; nếu có thì vẫn bắt buộc tenant và scope, không bypass trong picker.

### 4.3. Gán và audit

- `PUT .../project-template` hiện kiểm tra class scope và template ACTIVE theo tenant, nhưng cần tái dùng cùng eligibility predicate với search/preview, kiểm tra baseline published ngay trong transaction. Nên gửi `versionId` hoặc revision token đã preview; server xác nhận còn là phiên bản hiện hành trước khi chụp snapshot. Nếu thay đổi giữa preview và gán, trả `409` để tải lại preview. Snapshot writer lấy **đúng versionId đã xác nhận**, không fallback sang DRAFT/template gốc.
- Việc này phải được áp dụng cho cả đường gán từ màn quản lý và các đường khác có thể gọi `ProjectTeamTemplateService`, hoặc tách policy rõ theo persona; không để một API khác gán template mà picker mới đã loại.
- Tạo audit truy cập riêng có `actorId` (nếu có), `tenantId`, `classId`, `teamId`, endpoint/action, kết quả `ALLOW/DENY`, reason code, timestamp và correlation ID. Ghi denial cả ở method security/filter khi request chưa vào service; thiếu token có thể ghi actor=null. Không log token, raw keyword hoặc nội dung brief. Audit write phải sống được khi transaction nghiệp vụ rollback; kiểm thử cả `403` do role và do tenant/scope.

## 5. Thiết kế frontend

1. Trong card nhóm tại `team-allocation/index.tsx`, thay `<select>` bằng nút **Tìm đề bài** mở `TemplatePickerDialog` với `teamId`, `classId`, `sessionId`, tên và sĩ số nhóm. Dialog có ô keyword (`Enter`/nút Tìm kiếm), filter công nghệ, độ khó, vai trò, chuẩn đầu ra và category, nút **Áp dụng bộ lọc**, **Xóa bộ lọc**.
2. Tách `draftFilters` và `appliedFilters`; chỉ request khi bấm Search/Enter/Apply. Lưu applied filters và page vào URL query hoặc state keyed theo `teamId` để đóng/mở preview, chuyển trang, đóng/mở dialog vẫn giữ điều kiện. Khi đổi nhóm, không dùng lại bộ lọc của nhóm trước trừ khi cố ý chia sẻ theo URL.
3. React Query key gồm `classId`, `sessionId`, `teamId`, toàn bộ applied filters và `page/size`; axios truyền `signal` để hủy request cũ. Không dùng lại query cache toàn cục `['project-templates','options']` cho dữ liệu có scope. Sau assign/archive/publish invalidation đúng key.
4. List hiển thị số bản ghi và pagination; mỗi kết quả có tên, mô tả ngắn, level, category, technology chips, role/outcome, phiên bản, số thành viên phù hợp. Nút **Xem đề bài** mở preview đọc API theo team; nút **Chọn đề bài** cập nhật selection, chưa gán ngay. Dialog xác nhận cuối hiển thị team + template + version; chỉ lúc xác nhận mới gọi mutation hiện có.
5. Trạng thái: Loading có skeleton và disable thao tác phụ thuộc; Empty có “Không tìm thấy đề bài mẫu phù hợp” và **Xóa bộ lọc** nhưng giữ bộ lọc cho tới khi người dùng bấm; Error có Retry, phân biệt `403` (mất quyền/scope) và `409` (phiên bản thay đổi); Success hiển thị toast, cập nhật card và đóng dialog. Preview cũng có Loading/Error/Empty riêng. Giữ selection và filter nếu mutation lỗi.
6. Bảo đảm bàn phím và accessibility: focus vào ô tìm kiếm khi mở, Enter thực hiện search, Escape đóng preview, label cho filter, focus quay về nút mở sau khi đóng, thông báo tổng kết quả bằng `aria-live`.

## 6. Kiểm thử theo acceptance criteria

| AC | Backend | Frontend |
| --- | --- | --- |
| AC01 | Mentor có scope class, keyword trong name **hoặc description**, chỉ template ACTIVE + published baseline đúng tenant/cohort. | Enter và nút Tìm kiếm tạo request, loading rồi kết quả; filter giữ nguyên. |
| AC02 | AND giữa nhóm filter; nhiều technology cùng nhóm theo contract; count không bị nhân bởi join; trang sau ổn định. | Apply gửi đúng params, tổng số kết quả và pagination cập nhật. |
| AC03 | Kết quả `items=[]`, `totalElements=0`, không lỗi. | Empty message, bộ lọc còn nguyên, Clear đưa về trang 0. |
| AC04 | Thiếu token `401`; Student/role khác, tenant khác, cohort/class ngoài scope `403`, response không chứa dữ liệu và có audit DENY. Kiểm tra cả preview và assign. | Hiển thị lỗi quyền; không render dữ liệu cache của actor trước sau khi đổi tài khoản/role. |
| Preview + gán | Preview đúng versionId; archive/unpublish/chuyển version trước khi gán trả `409`/`404`; không tạo snapshot/project sai phiên bản. | Xem preview, chọn, xác nhận, lỗi giữ nguyên lựa chọn; thành công refresh card. |

Thêm test repository/service và MockMvc cho security + filter + pagination + race phiên bản. Fixture gồm 2 tenant, 2 cohort, Mentor được/không được phân công, Program Manager, Student, template shared demo, DRAFT/ARCHIVED, nhiều version PUBLISHED và snapshot `TEAM_ASSIGNMENT`. Chạy `cd backend && ./mvnw test`, `cd frontend && npm run build`, `cd frontend && npm run lint`; kiểm thử tay UI với nhóm DRAFT đủ/thiếu sĩ số.

## 7. Thứ tự triển khai và tiêu chí hoàn tất

1. Chốt scope cohort của template, nghĩa baseline và taxonomy `Fullstack`/chuẩn đầu ra với nghiệp vụ; viết contract API và migration.
2. Bổ sung metadata, backfill dữ liệu có nguồn, policy baseline và test repository.
3. Viết authorization, search/preview API, audit DENY, test security và AC01–AC04.
4. Đồng bộ policy với assignment/snapshot; test thay đổi version đồng thời.
5. Làm picker + preview UI, giữ filter, trạng thái và accessibility; xác nhận luồng Student vẫn hoạt động.
6. Chạy test/build/lint và walkthrough acceptance với dữ liệu nhiều tenant/cohort. Hoàn tất khi mọi truy vấn picker/preview/gán chỉ thấy cùng tập template đủ điều kiện, audit denial có thể truy vết và UI không cần duyệt dropdown dài.

## 8. Ghi chú triển khai trong repository

- Metadata dùng ba bảng `@ElementCollection` chứa giá trị chuẩn hóa chữ hoa (`technology`, `target_role`, `outcome`), thay cho taxonomy ID phức tạp ở mục 4.1. Form quản trị nhập các giá trị cách nhau bằng dấu phẩy. Các giá trị cũ không được suy diễn từ description.
- Phạm vi cohort dùng cột `project_templates.cohort_id` nullable. Form quản trị có danh sách cohort của tenant; null nghĩa là tất cả cohort trong tenant. Picker không lấy template demo `tenant_id = null` vì business rule yêu cầu cô lập tenant.
- Program Manager có role `PROGRAM_MANAGER`; role `ADMIN` cũ được coi là persona Program Manager trong phạm vi tenant của nó. Student team leader dùng endpoint option riêng `/api/v1/students/me/draft-teams/template-options`.
- Quyền picker dùng role và `PEO_TEAM_ALLOCATE`/`PRJ_WORKSPACE_MANAGE` cùng scope đang active; audit denial được lưu riêng trong `template_search_audit`. Assignment giữ `project_template_version_id` trên team để workspace về sau chụp đúng phiên bản đã chọn.
- Chưa có dữ liệu tenant-owned được migrate tự động từ template demo global. Với tenant chỉ có template global, picker sẽ Empty đúng theo quy tắc scope; cần tạo/kích hoạt template cho tenant hoặc thực hiện migration dữ liệu đã được nghiệp vụ duyệt.
