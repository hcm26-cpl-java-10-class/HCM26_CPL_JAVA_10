# DEV 1 - Training Class với Draft và approval theo revision

## Phạm vi và quyết định đã chốt

Module sở hữu `TrainingClass` và snapshot `TrainingClassRevision`. `classId` giữ nguyên qua mọi revision; Calendar, roster, tài nguyên và attendance tiếp tục thuộc module khác. `programVersionId` là tham chiếu, không tạo lại Course/Program.

Theo yêu cầu người dùng sau review leader: Create sinh Draft v1; bản mới chỉ được áp dụng sau khi gửi duyệt và Approve. Người có quyền `TRAINING_CLASS_APPROVE` được tự duyệt để demo trên một tài khoản. Luồng này thay thế việc sửa trực tiếp tên/ghi chú trước đây. Đây là quyết định thiết kế bổ sung của nhóm, không gán toàn bộ cơ chế revision thành yêu cầu nguyên văn trong SRS.

SRS được đối chiếu: UFR-PEO-009 tr.45; BR-UNI-06/08/09 tr.119; ma trận vòng đời tr.120; SCR-48/49 tr.179-180. SRS mô tả vòng đời lớp `PLANNING -> ONGOING -> COMPLETED/CANCELLED`. Phê duyệt revision không tự Start, Complete hoặc Cancel lớp.

## Ba trạng thái độc lập

| Thuộc tính | Ý nghĩa |
| --- | --- |
| `TrainingClass.status` | Vòng đời: PLANNING / ONGOING / COMPLETED / CANCELLED |
| `TrainingClassRevision.status` | DRAFT / UNDER_REVIEW / ACTIVE / ARCHIVED / REJECTED |
| `TrainingClass.isActive` | Lớp có bị deactivate hay không; độc lập với approval |

`revisionNo` là số phiên bản nghiệp vụ v1/v2/v3. `version` trên cả Class và Revision là optimistic locking, không dùng làm số phiên bản nghiệp vụ.

## Luồng

1. Create kiểm tra mã unique, dữ liệu bắt buộc/ngày/capacity, danh mục, approved request và program. Tạo class Planning và Draft v1. Chưa có `currentRevisionId`.
2. Save chỉ ghi Draft. Class chưa từng duyệt có management preview; API published chưa trả lớp này.
3. Submit chuyển Draft sang Under review, ghi actor/thời gian. Under review không sửa được.
4. Approve kiểm tra lại version, trạng thái, base revision và các dependency cần thiết. Lần đầu kiểm tra lại program/request. Sau khi kiểm tra thành công, trong cùng transaction: bản cũ thành Archived, bản mới thành Active, đổi `currentRevisionId`, áp dụng snapshot và xóa pending pointer. Vòng đời lớp giữ nguyên.
5. Edit bản đã duyệt bắt đầu bằng Create Draft vN+1 từ snapshot đang áp dụng. Active cũ tiếp tục chạy trong khi save/submit/review.
6. Reject bắt buộc lý do, ghi actor/thời gian, giữ nguyên bản Active và lưu bản Rejected. Lần Create Draft tiếp theo dùng số tăng tiếp; không dùng lại số bị reject.

Mỗi class có tối đa một Draft/Under review đang mở. Lệnh mutation khóa dòng class và kiểm tra optimistic version; DB có unique `(class_id, revision_no)`. Gửi lại lệnh với version cũ hoặc transition sai trả 409.

Completed, Cancelled và inactive không tạo/sửa/submit/approve/reject revision. Deactivate giữ nguyên toàn bộ lịch sử và mã lớp.

## Dữ liệu

`TrainingClass`: id, code, programVersionId, openClassRequestId, status, isActive, version, currentRevisionId, pendingRevisionId, lastIssuedRevisionNo, lastRevisionActivityAt, audit. Các cột thông tin đang có được giữ làm projection của bản đã duyệt để list/filter và contract cũ truy vấn hiệu quả. Service không cập nhật projection của lớp đã duyệt khi lưu Draft.

`TrainingClassRevision`: id, classId, revisionNo, baseRevisionId, status, version, name, description, traineeType, deliveryFormat, site, location, startDate, endDate, capacity, created/updated audit, submittedBy/At, reviewedBy/At và rejectionReason.

Code và program/request là tham chiếu cố định sau Create. Revision chứa các field có thể đề xuất sửa. Class Code và Class Name tối đa 255 ký tự; Description / Notes tùy chọn tối đa 2000 ký tự; chuỗi trim. Form chặn nhập/dán vượt giới hạn và hiển thị bộ đếm; API vẫn kiểm tra độc lập.

Capacity là số nguyên từ **1 đến 50 học viên/lớp**, theo giới hạn người dùng đã chốt. Form chặn chữ, số âm, số thập phân, ký pháp số mũ và số vượt giới hạn. API chỉ nhận JSON integer, không tự chuyển chuỗi hay cắt phần thập phân. Bean validation/service và DB constraint đều kiểm tra khoảng 1–50.

Location là dropdown theo Site, lấy từ `/api/classes/create-options`. Đổi Site sẽ xóa Location không còn phù hợp; API kiểm tra lại cặp Site–Location. Danh mục phòng hiện là dữ liệu tham chiếu demo DEV 1, chưa phải tích hợp tài nguyên hay kiểm tra phòng trống.

End Date phải từ Start Date trở đi. Khi lớp **ONGOING**, Start Date không được thay đổi, kể cả Draft được tạo lúc lớp còn Planning. UI để chỉ đọc; API kiểm tra lại khi Save, Submit và Approve. Site, Location và End Date vẫn được đề xuất sửa qua Draft, áp dụng sau approval và kiểm tra dependency. Lớp Planning vẫn sửa được Start Date. Không tự đổi trạng thái theo ngày.

## Dependency khi approve

- Lần đầu publish: kiểm tra lại request APPROVED, program khớp và program được phép mở lớp qua adapter hiện có.
- Lớp đã có bản Active: thay tên/ghi chú có thể qua approval độc lập. Thay trainee type, delivery format, site, location, ngày hoặc capacity cần `TrainingClassChangeChecker` kiểm tra lịch, roster và tài nguyên trước khi publish.
- Khi checker này chưa được tích hợp, đề xuất thay đổi vẫn lưu/gửi duyệt được nhưng Approve trả 503 và giữ nguyên bản Active. Không có mock trả "valid" cho mọi thay đổi để bỏ qua dependency.
- Adapter phải kiểm tra tính hợp lệ và nhất quán của dữ liệu phụ thuộc trong giao dịch/contract được nhóm thống nhất. Đổi revision không tự ghi lại session hoặc attendance quá khứ.

## API

| Method / URL | Hành vi |
| --- | --- |
| POST `/api/classes` | Tạo Planning + Draft v1, trả 201 |
| GET `/api/classes` | Management list, tìm code/name, lọc status/site/program/date, page/sort |
| GET `/api/classes/{id}` | Thông tin đang áp dụng; nếu chưa duyệt, management actor thấy preview |
| GET `/api/classes/{id}/published` | Chỉ trả lớp active đã có revision được duyệt; chưa duyệt/deactivate trả 404. Module vận hành nên dùng contract này |
| GET `/api/classes/{id}/revisions` | Snapshot/lịch sử, gồm actor/thời gian, reason và dependencyValidationRequired |
| POST `/api/classes/{id}/revisions` | Tạo Draft kế tiếp, body `{version}` |
| PUT `/api/classes/{id}` | Save Draft; full fields + `{version, revisionId, revisionVersion}` |
| POST `/api/classes/{id}/revisions/{revisionId}/submit` | Body `{version, revisionVersion}` |
| POST `/api/classes/{id}/revisions/{revisionId}/approve` | Body `{version, revisionVersion}` |
| POST `/api/classes/{id}/revisions/{revisionId}/reject` | Body `{version, revisionVersion, reason}` |
| DELETE `/api/classes/{id}` | Deactivate; không đổi lifecycle thành Cancelled |

Response Class có `currentRevisionId/No`, `pendingRevisionId/No/Status`, `lastIssuedRevisionNo` và optimistic `version`. Lưu Draft của lớp đã publish vẫn trả thông tin Active ở các field chính; gọi revisions API để đọc nội dung đang soạn.

## Phân quyền

Backend và UI kiểm tra permission riêng cho READ, CREATE, UPDATE, DELETE, SUBMIT và APPROVE. `TRAINING_CLASS_APPROVE` dùng cho cả approve/reject. Không tự cấp Approve cho người chỉ có Update. ADMIN seed nhận các permission này; cho phép tự duyệt theo lựa chọn của người dùng.

Đọc list/detail/published cần READ. Xem snapshot chưa duyệt/lịch sử cần thêm một trong CREATE/UPDATE/SUBMIT/APPROVE. Actor chỉ READ không thấy class chưa từng duyệt trong list/detail và không đọc revisions API. Role cụ thể có thể mang permission; không yêu cầu thêm tên role ADMIN cố định ở Class service.

Tenant/object scope vẫn chưa có context trong module. Unique hiện toàn DB bằng `uk_training_class_code`; phải bổ sung `(tenant_id, class_code)` và object scope trước khi dùng nhiều tenant. Không xem permission đơn thuần là đã hoàn tất data scope. Quy tắc code hoa/thường vẫn theo DB hiện có; mã deactivate được giữ. Audit field và revision history hiện có chưa thay thế audit event/correlation đầy đủ của hệ thống.

## UI và demo

Create: **Save Draft v1**. List hiển thị bản Active và trạng thái pending. Class Code mở Class Info; nút lịch sử/tab **Revisions & Approval** để so sánh snapshot, Edit Draft, Submit, Approve hoặc Reject có lý do. Class Info luôn hiển thị bản đang áp dụng nếu đã duyệt. Form giữ dữ liệu khi conflict; Reload latest chỉ bỏ dữ liệu nhập khi người dùng chọn.

Chạy backend:

```powershell
mvn spring-boot:run "-Dspring-boot.run.profiles=dev1-demo"
```

Profile có request 101 / program 1, các lớp `DEV1-JAVA-PLANNING`, `ONGOING`, `COMPLETED`, `CANCELLED`, `INACTIVE` với Active v1; thêm `DEV1-JAVA-DRAFT` (Draft v1) và `DEV1-JAVA-REVIEW` (Under review v1). Seed chỉ thêm khi mã chưa tồn tại. Các fixture không chứng minh đã vượt điều kiện Start thật và không tạo dữ liệu module khác.

Khởi động lại backend với profile trên và đăng nhập lại để frontend nhận permission SUBMIT/APPROVE mới. Nếu chưa đổi cấu hình seed, dùng ADMIN `admin@example.com` / `password123`. Role tự cấu hình cần thêm quyền menu phù hợp để truy cập màn hình qua sidebar.

Để demo: mở lớp On-going -> Revisions & Approval -> Create Draft v2 -> Edit tên/ghi chú -> Save -> Submit -> Approve. Quan sát Class Info dùng v1 cho tới Approve, rồi v2 Active/v1 Archived, classId và lifecycle không đổi. Có thể demo lần đầu từ lớp DRAFT.

Database H2 in-memory/create-drop mất dữ liệu khi tắt. Database persistent cần migration thêm bảng, FK, version, unique revision number và backfill Active v1 cho lớp đã vận hành; không chạy Create để nhân đôi classId. Cần chốt trạng thái backfill với nhóm. Trước khi áp constraint capacity 1–50, cần rà soát dữ liệu cũ vượt 50 và thống nhất xử lý; không tự cắt số lượng. Chưa xây Start/Complete/Cancel, import/export, tenant scope hay các module phụ thuộc.

Kiểm tra:

```powershell
mvn test "-Dtest=TrainingClassServiceImplTest,TrainingClassApiIntegrationTest"
```

51 kiểm thử Training Class đã qua: v1/v2, projection giữ nguyên trước approve, lịch sử archived/rejected, self-approval, concurrent draft, optimistic lock, permission tách editor/reviewer/reader, checker chưa có và checker chấp thuận, terminal state, unique và validation. Có kiểm thử biên độ dài text, capacity 1/50 và dữ liệu sai kiểu/vượt giới hạn, constraint DB, Location theo Site, khóa Start Date của On-going tại Save/Submit/Approve. Frontend `npm run build` qua.

Smoke test trình duyệt Edge headless với backend JWT/H2 thật đã qua: giới hạn ký tự/bộ đếm, chặn capacity sai, dropdown Location lọc theo Site và xóa lựa chọn cũ khi đổi Site, sửa Site/Location/End Date của On-going với Start Date chỉ đọc. Luồng Create Draft v1, self-approval, Draft v2 của On-going, giữ input khi 409 và reload chủ động, Active không đổi trước duyệt, archive sau duyệt, reject bắt buộc lý do và lifecycle giữ nguyên cũng đã qua. Các server test dùng cổng riêng và đã được dừng.

Bộ kiểm thử backend mở rộng còn 7 lỗi ở `ModuleGroupControllerTest`: WebMvc test context thiếu bean/mock `RefreshTokenService` cho `JwtAuthenticationFilter`. Các kiểm thử Calendar và phần còn lại đã qua trong lần chạy đó. File test ModuleGroup không được sửa trong thay đổi này. Cấu hình ESLint hiện có vẫn import package `typescript-eslint` chưa cài; không tuyên bố lint đã qua.
