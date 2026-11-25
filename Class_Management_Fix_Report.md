# Class Management Fix Report

Ngày kiểm tra: **23/11/2026, giờ Việt Nam**. Phạm vi: đúng **19 UC trong yêu cầu hiện tại**; UC-16–19 ở báo cáo này là Class Setup, không dùng cách đánh số 38 UC trong tài liệu cũ.

**Kết quả: 5 lỗi sản phẩm được tái hiện và sửa; 1 lỗi fixture kiểm thử được sửa riêng. Chưa nghiệm thu runtime Frontend + Backend cho bất kỳ UC nào.** Không sửa Word/ảnh SRS, không đổi branch, không commit/push, không sửa database gốc hoặc nới quy tắc nghiệp vụ.

## 1. Môi trường và giới hạn bằng chứng

- Repository được sửa: `training-management/`, không phải bản `backend/` và `frontend/` ở thư mục cha. Git có thay đổi chưa commit từ trước, gồm `ClassModal.tsx`, test Master Trainer, Trainer Management và một file database. Đã lưu trạng thái ban đầu và patch ClassModal tại `verification/class-management-fix-20261123/`; giữ các thay đổi này.
- Java PID **13280**, cổng **8080**, có `user.dir` là `.../HCM26_CPL_JAVA_10-feature-training-management/backend`, **nằm ngoài repository được chỉ định**. Xác minh bằng `jcmd VM.system_properties`, chỉ xuất working directory. Không dừng/restart tiến trình này, không truy vấn dữ liệu nghiệp vụ hoặc mở kết nối JDBC vào database của nó.
- Chỉ đọc tài liệu OpenAPI công khai của 8080: `/swagger-ui/index.html` và `/v3/api-docs` trả **200**. Danh sách OpenAPI đang chạy **không có** `/api/classes/{classId}/setup`, `/program-link` hoặc các endpoint MAIN của Class Setup. Đây là bằng chứng lệch bản runtime; **chưa phải bằng chứng xác định nguyên nhân của một request 403 lịch sử**.
- Frontend 5174 ban đầu không chạy. Đã dùng launcher có sẵn `Start-SrsFrontend.ps1` để mở đúng source tại **http://127.0.0.1:5174**, trỏ API **http://127.0.0.1:18080/api**. Giữ nguyên Vite 5173 đang có. Launcher được gọi với ExecutionPolicy chỉ trong tiến trình PowerShell con; không đổi cấu hình máy.
- Playwright dùng browser context mới: `/classes` trả **200**, chuyển tới `/login`, có form đăng nhập, **0 page errors**. Không nhập credentials/token, không giả phiên đăng nhập. Đây là kiểm tra môi trường, không phải nghiệm thu UC.
- Backend test **18080 chưa chạy**. Launcher test an toàn đã được kiểm tra và thử chạy; từ chối vì thiếu đầu vào. Ban đầu thiếu cả JAR và `approved.env`; đã package JAR đúng repository. **Còn thiếu** `%TEMP%/SRS_NinhHaiDanh_runtime/approved.env`, với hai khóa `SRS_MAIL_USERNAME`, `MAIL_APP_PASSWORD`. Không giả SMTP credentials, không tắt SMTP/auth/security. Sau khi có cấu hình vẫn cần xác minh SMTP/startup và cài fixture runtime/tài khoản test có quyền; launcher hạ tầng hiện không tự tạo fixture.
- Browser/DevTools connector không khả dụng (`browser access host is unavailable`). Kiểm tra Playwright độc lập ghi nhận chưa có response nghiệp vụ từ 18080. Không tái hiện được request Class Setup 403 có JWT thật; không suy diễn 403 từ lỗi mất kết nối. Swagger/OpenAPI 18080 đều **UNREACHABLE**.
- JDBC metadata kiểm chứng được thuộc **JVM test độc lập**, không thuộc tiến trình 8080. Datasource factory buộc đúng URL `jdbc:h2:mem:srs_evidence_<UUID>` và product **H2**, kiểm tra **trước Hibernate tạo schema**, từ chối JNDI/URL khác. JVM đã kết thúc: ID fixture và URL test không còn dùng được trên Swagger/UI.

## 2. Lỗi đã sửa

1. **CM-01 — Form trạng thái không tuân hợp đồng Backend.** Create cho chọn assigned/active/completed/cancelled dù Backend chỉ cho planning; edit cho chọn bước chuyển không hợp lệ và không có option giữ trạng thái closed. `ClassModal.tsx` hiện giới hạn create ở planning, edit theo trạng thái hiện tại và ma trận có thật; giữ nguyên closed khi sửa thông tin. Không thêm thao tác Close mới.
2. **CM-02 — Mã lớp closed vẫn sửa được trên form.** Backend cấm đổi code ở active/completed/closed, nhưng UI chỉ khóa active/completed. Đã bổ sung closed.
3. **CM-03 — Export khi lọc rỗng xuất toàn bộ dữ liệu.** Bỏ fallback từ kết quả lọc sang toàn danh sách; workbook rỗng giữ đủ header.
4. **CM-04 — Export tự tạo dữ liệu Site/Trainee Type.** Bỏ giá trị mặc định HCM/Fresher khi API không cung cấp; để trống đúng dữ liệu nguồn.
5. **CM-05 — Link chi tiết dùng mã lớp chỉ tìm trang API đầu.** `cls.api.ts/getClassById` hiện tìm qua các trang kết quả tìm kiếm, khớp code/name chính xác rồi gọi GET bằng numeric ID. Không trả một record từ trang list làm detail response.

Các lỗi CM-01–05 được kiểm tra bằng regression test thất bại trước sửa và PASS sau sửa. **17 regression tests** cuối cùng bao gồm thêm các thao tác chuyển trạng thái gửi PUT thật qua API client mock.

**Lỗi test riêng, không tính là lỗi sản phẩm thứ sáu:** `ClassReadinessNavigation.test.tsx` dùng ADMIN để giả lập tài khoản thiếu quyền. Chính sách UI hiện có cho ADMIN quyền đầy đủ, làm 6 ca denial thất bại. Đổi fixture sang STAFF có đúng tập quyền; không sửa `usePermissions`, route policy hoặc cấp thêm quyền trong ứng dụng.

## 3. Bảng đối chiếu 19 UC

`FIXED` nghĩa là lỗi code đã sửa và có test chứng minh; không tự động đồng nghĩa nghiệm thu live runtime. `BLOCKED` ở cột cuối chỉ phần runtime chưa đủ điều kiện. Không gán `VERIFIED` cho UC khi chỉ có MockMvc/service/component test.

| UC | Lỗi ban đầu | Nguyên nhân | File đã sửa | Kiểm thử sau sửa | Trạng thái |
|---|---|---|---|---|---|
| UC-01 Danh sách/tìm kiếm/lọc | Cần xác minh bảng/API và dữ liệu thật | Không tìm thấy lỗi trong tìm kiếm/lọc đã test; không có phiên live | Không sửa source UC-01 | Service/JPA: search literal `_`, kết hợp status/program/date, phân trang ổn định; ClassListPage và utility tests PASS, tải trang API tiếp theo | BLOCKED runtime; tests PASS |
| UC-02 Chi tiết | Alias mã lớp ở trang sau không mở đúng detail | CM-05: chỉ tìm trang đầu, dùng list row thay GET detail | `frontend/src/api/features/cls.api.ts` | Regression tìm mã ở trang hai, gọi `/classes/42`; MockMvc GET trả đúng ID đã tạo; service/JPA đọc đúng dữ liệu | FIXED; BLOCKED runtime |
| UC-03 Tạo lớp | Form cho chọn trạng thái gây 400 | CM-01; Backend yêu cầu planning, trường bắt buộc và ngày hợp lệ là đúng | `ClassModal.tsx` | Chỉ có planning trên form; MockMvc POST 201 và xác minh record; `{}` bị 400; service từ chối khởi tạo assigned | FIXED; VALIDATION_EXPECTED; BLOCKED runtime |
| UC-04 Cập nhật | Form cho bước chuyển sai, không giữ closed; code closed sửa được | CM-01/02; endDate phải sau startDate, capacity không thấp hơn enrollment, ID trainer phải hợp lệ | `ClassModal.tsx` | Form giữ đúng trạng thái, khóa code closed; MockMvc PUT 200 và đọc lại tên; ngày bằng nhau 400; service cấm đổi code sau bắt đầu | FIXED; VALIDATION_EXPECTED; BLOCKED runtime |
| UC-05 Planning → Assigned | Cần đối chiếu thao tác và trạng thái | Ma trận cho planning → assigned; validation DTO vẫn áp dụng | `ClassModal.tsx` (CM-01) | Fixture H2 riêng, PUT trong MockMvc và đọc lại assigned; component gửi đúng PUT | FIXED; BLOCKED runtime |
| UC-06 Assigned → Planning | Cần kiểm tra đưa lớp về planning | Ma trận cho assigned → planning | `ClassModal.tsx` (CM-01) | Fixture H2 riêng, PUT và đọc lại planning; component gửi đúng PUT | FIXED; BLOCKED runtime |
| UC-07 Bắt đầu Active | Cần kiểm tra trạng thái đầu | Chỉ assigned → active; service không dùng readiness làm điều kiện chuyển | `ClassModal.tsx` (CM-01) | Fixture assigned riêng, PUT và đọc active; component gửi đúng PUT; không thêm điều kiện mới | FIXED; BLOCKED runtime |
| UC-08 Completed | Cần kiểm tra trạng thái đầu | Chỉ active → completed | `ClassModal.tsx` (CM-01) | Fixture active riêng, PUT và đọc completed; component gửi đúng PUT | FIXED; BLOCKED runtime |
| UC-09 Closed | Hiện Backend-only | completed → closed có trong service; không có thao tác Close triển khai trên UI | Không thêm nút | Fixture completed riêng, PUT và đọc closed; closed không quay lại planning | BLOCKED runtime; Backend-only |
| UC-10 Cancelled | Cần kiểm tra trạng thái được phép hủy | planning/assigned/active → cancelled; completed/closed không hủy | `ClassModal.tsx` (CM-01) | Fixture riêng cho ba trạng thái đầu; MockMvc PUT và đọc cancelled; component gửi cancellation | FIXED; BLOCKED runtime |
| UC-11 Deactivate/soft delete | 409 khi lớp đã bắt đầu | Business rule cấm active/completed/closed, lớp có enrollment hoặc session | Không nới quy tắc | MockMvc DELETE lớp planning 204; flush/clear xác nhận row còn và isActive=false. Lớp active bị 409, vẫn active | VALIDATION_EXPECTED; BLOCKED runtime |
| UC-12 Import | Cần xác minh template/preview/JSON và số lưu | API nhận mảng DTO JSON, không nhận multipart Excel | Không tìm thấy lỗi mới | Component/parser: workbook hợp lệ/sai, preview, giới hạn, row errors, gửi JSON; MockMvc import 2 row tăng đúng 2, batch ngày sai 400 không tăng số row | BLOCKED runtime; tests PASS |
| UC-13 Export | Lọc rỗng vẫn xuất tất cả; Site/Trainee Type giả | CM-03/04: fallback list và default HCM/Fresher | `ClassListPage.tsx` | Component dùng JSON API → XLSX; file thực 12 header, 0/1 data row, đọc lại khớp code và ô trống; không gọi API tải file | FIXED; BLOCKED authenticated browser download |
| UC-14 KPI | Cần đối chiếu cùng DB/thời điểm | Service thống kê từ repository; UI lấy `/classes/stats` | Không tìm thấy lỗi mới | Clock cố định Asia/Ho_Chi_Minh, cửa sổ 30 ngày inclusive, bỏ inactive; MockMvc stats khớp cùng H2; KPI component PASS | BLOCKED live UI/API comparison; tests PASS |
| UC-15 Readiness | Cần xác định checks và trạng thái thực | 5 checks; UNKNOWN/BLOCKED không tính verified | Sửa fixture quyền trong `ClassReadinessNavigation.test.tsx`, không đổi nghiệp vụ | MockMvc 5 checks; service/JPA READY/NOT_READY/UNKNOWN/BLOCKED; UI panel và navigation PASS; không ép READY | BLOCKED runtime; tests PASS |
| UC-16 Xem Class Setup | Báo 403 lịch sử | Runtime 8080 khác repo và không có endpoint; request/token lịch sử chưa tái hiện | Không sửa security/mapping vì source đã khớp | MockMvc GET `/setup` 200 với CLASS_READ+PROGRAM_READ+ASSIGNMENT_READ; thiếu quyền 403; ClassSetupForm component PASS | ACCESS_DENIED_EXPECTED trong negative test; NEED_REVIEW 403 lịch sử; BLOCKED live |
| UC-17 Link Training Program | Báo 403 lịch sử | PUT `/program-link`, cần CLASS_READ+CLASS_UPDATE+PROGRAM_READ | Không đổi endpoint/policy | H2 program ACTIVE và subject hợp lệ; PUT 200 bằng đúng quyền, lưu link; reader thiếu write bị 403; component link/refetch PASS | ACCESS_DENIED_EXPECTED trong negative test; NEED_REVIEW 403 lịch sử; BLOCKED live |
| UC-18 Tạo MAIN Trainer | Báo 403 lịch sử | POST class-specific teaching-assignments; cần CLASS_READ+PROGRAM_READ+ASSIGNMENT_CREATE | Không dùng CRUD lớp để thay setup | Fixture internal trainer ACTIVE đúng topic/master ID; POST 201, lưu assignment INTERNAL; reader thiếu create bị 403; component PASS | ACCESS_DENIED_EXPECTED trong negative test; NEED_REVIEW 403 lịch sử; BLOCKED live |
| UC-19 Cập nhật MAIN Trainer | Báo 403 lịch sử | PUT class-specific teaching-assignments/{assignmentId}; cần CLASS_READ+PROGRAM_READ+ASSIGNMENT_UPDATE | Không dùng CRUD lớp để thay setup | PUT 200 với quyền update; đổi Effective To thành null, clear/read lại, vẫn đúng 1 row; reader thiếu update bị 403; component PASS | ACCESS_DENIED_EXPECTED trong negative test; NEED_REVIEW 403 lịch sử; BLOCKED live |

## 4. Business rules giữ nguyên

Ma trận trực tiếp từ `TrainingClassService`: planning → assigned/cancelled; assigned → active/cancelled/planning; active → completed/cancelled; completed → closed; closed/cancelled không chuyển tiếp. Tạo mới chỉ planning. Update và chuyển trạng thái dùng **PUT `/api/classes/{id}` với DTO đầy đủ**, không phải PATCH status hoặc external API. Không thêm giả định phải READY hoặc có học viên để bắt đầu vì service hiện không áp dụng điều kiện đó; cần thay đổi yêu cầu riêng nếu muốn bổ sung.

Deactivate yêu cầu chưa bắt đầu, không enrollment và không session còn hoạt động. HTTP 409 ở lớp đang học là **đúng**, không phải lỗi cần đổi thành 200.

Readiness có đúng **5 nhóm**: `basic`, `trainer`, `enrollment`, `calendar`, `operations`. Mỗi check có một trong bốn trạng thái, không có trường overall state thay thế tất cả checks:

- READY: bằng chứng hợp lệ theo từng nhóm — hồ sơ/link chương trình ACTIVE khớp; MAIN assignment phủ ngày và trainer hợp lệ; ACTIVE enrollment/capacity; session không hủy trong khoảng ngày; URL online hoặc phòng thật đủ sức chứa.
- NOT_READY: thông tin/điều kiện đã kiểm tra không đạt, ví dụ ngày sai, trainer không hợp lệ, thiếu học viên/session, URL không hợp lệ.
- UNKNOWN: chưa đủ bằng chứng, ví dụ chưa có link/MAIN phù hợp, format lưu không hỗ trợ hoặc không xác định duy nhất phòng.
- BLOCKED: directory cần kiểm chứng là sample hoặc upstream không khả dụng. Test dùng dữ liệu tổng hợp chỉ trong H2; không coi fixture là directory thật của runtime.
- `verified = 5 - unknown - blocked`; `ready` chỉ đếm check READY. UI hiển thị số do API trả; không tự đổi trạng thái lớp hoặc tạo readiness giả.

Đã đối chiếu `SecurityConfig`, `JwtAuthenticationFilter`, `UserDetailsServiceImpl`, `UserPrincipal`, `@PreAuthorize` và Frontend guards. JWT filter lấy subject và tải lại authorities từ user/role/permission còn active; role có prefix ROLE_, business permission không có prefix đó. Test method authorization dùng principal test có quyền rõ ràng, **không chứng nhận login/JWT/CORS của server chạy thật**. Route Class List/Detail hiện dùng SESSION_READ theo registry có sẵn, trong khi API lớp dùng CLASS_READ; không thay chính sách module dùng chung khi chưa có bằng chứng yêu cầu khác.

## 5. Kiểm thử và bằng chứng

- **Backend compile PASS**, Java 21, Maven offline. **Package PASS**, tạo executable JAR đúng đường dẫn launcher. Không khởi động ứng dụng trong bước build.
- **32/32 Backend tests PASS**, 0 failures/errors/skipped: JPA + service + controller JSON/MockMvc + method authorization, trên H2 memory có metadata guard. Test mới: `backend/src/test/java/com/example/starter_project_2025/system/training/ClassManagementIsolationTest.java`, kế thừa bộ test service độc lập do người dùng cung cấp và mở rộng Class Setup/HTTP contract. SMTP và full application context không được nạp trong slice; không sửa cấu hình startup để vượt SMTP.
- **161/161 Frontend tests trọng tâm PASS**, 11 file, gồm danh sách, form, import, KPI, readiness/navigation, setup và utility tests. **17 regression tests mới PASS**. Tất cả API trong component tests là transport test có fixture, không phải API mạng.
- **TypeScript `tsc -b` PASS**, **Vite production build PASS**. Build có cảnh báo chunk lớn; không có lỗi build.
- Suite rộng dưới thư mục class: ban đầu **176 PASS / 11 FAIL**; cuối cùng **199 PASS / 5 FAIL** (204 tests, đã thêm 17 ca). Sáu ca fixture ADMIN đã được sửa. Năm ca còn lại **đã tồn tại trước thay đổi**: bốn ca Calendar tìm lesson-details/scrollbar/back-button/date text không khớp UI, một ca Attendance Tracker chờ 91% nhưng thấy 95%. Chúng thuộc Calendar/Attendance ngoài 19 UC đã chỉ định; không sửa source của phần đó hoặc đổi kỳ vọng để che lỗi. **Không tuyên bố toàn bộ suite xanh hay không có regression ở mọi chức năng**; cần rà soát riêng nếu mở rộng phạm vi.
- Một lần mở rộng Backend test gặp lỗi test tự clear persistence context trước flush khi kiểm tra soft delete trong transaction của DataJpaTest. Đã sửa fixture kiểm tra `flush(); clear()`; không đổi production service. Lần cuối đủ 32/32 PASS.
- File Excel thực được serialize từ workbook của handler Export với API fixture, đã đọc lại bằng SheetJS: `export-empty-filter.xlsx` **12 header / 0 data row**; `export-api-data.xlsx` **12 header / 1 data row**, code CLASS_42, Site/Trainee Type trống. Chưa phải file tải từ phiên UI kết nối Backend thật.

Bằng chứng tại `verification/class-management-fix-20261123/`: `git-before.txt`, `user-changes-before.patch`, `regression-before.log`, `regression-after.log`, `frontend-baseline.log`, `frontend-focused.log`, `frontend-final.log`, `frontend-typecheck.log`, `frontend-build.log`, `backend-compile.log`, `backend-package.log`, `backend-isolation.log`, `existing-runtime-inspection.json`, `runtime-preflight.json`, `xlsx-verification.json`, hai workbook `.xlsx`, `test-summary.json` và `jdbc-attestation.json`. Log test không chứa mật khẩu hay JWT đăng nhập runtime.

Lệnh tái chạy (JAVA_HOME dùng JDK 21; từ backend/frontend tương ứng):

```powershell
# backend: explicit empty dotenv file prevents reading the development .env
mvn.cmd -o '-Dtest=ClassManagementIsolationTest' '-Ddotenv.file=../verification/class-management-fix-20261123/empty.env' test
# frontend: broad suite includes the five pre-existing failures described above
node node_modules/vitest/vitest.mjs run src/pages/management/training/class src/utils/class.utils.test.ts src/utils/class-import.utils.test.ts
node node_modules/typescript/bin/tsc -b --pretty false
node node_modules/vite/bin/vite.js build
```

## 6. Trả lời bàn giao

1. **Lỗi code sản phẩm thực sự: 5 nhóm nguyên nhân** CM-01–05. Ngoài ra có **1 lỗi fixture kiểm thử**, không cộng vào lỗi sản phẩm.
2. **Đã sửa: 5/5 lỗi sản phẩm được chứng minh**, cùng lỗi fixture; chưa thể khẳng định không còn lỗi khác khi thiếu live runtime.
3. **Business API PASS qua mạng: 0**. GET Swagger UI/OpenAPI 8080 PASS là kiểm tra tài liệu của bản runtime khác, không tính UC. Các API create/get/update/delete/import/stats/readiness và 4 endpoint Class Setup PASS trong **MockMvc**, không cộng vào live API PASS.
4. **UC nghiệm thu đầy đủ Frontend + Backend thật: 0/19**. Source và test riêng của hai phía đã được đối chiếu; chưa có phiên đăng nhập/fixture của Backend test đang chạy.
5. **UC-09 vẫn Backend-only**; các UC khác có luồng UI trong source, chưa nghiệm thu end-to-end.
6. **400/403/409 live: chưa đo được** vì 18080 chưa chạy. Trong test: 400 cho dữ liệu bắt buộc/ngày/status không hợp lệ; 403 cho thiếu quyền Class Setup; 409 cho transition bị cấm hoặc xóa lớp đã học là expected. 403 mà người dùng từng gặp cần request URL/method/status và quyền phiên test thực để kết luận; không đánh dấu đã sửa khi chưa tái hiện.
7. **Chưa đủ điều kiện chụp ảnh SRS thật của 19 UC.** Cần bổ sung cấu hình test tại máy, chạy launcher Backend đúng repo/H2 memory, xác minh metadata của chính server đó, tạo fixture test/tài khoản đủ quyền, kiểm tra JWT/CORS, rồi chạy Network/API/UI và export download. Frontend 5174 đã sẵn sàng, API target đã xác minh; Backend 8080 cũ được giữ nguyên. Không dùng ảnh login hoặc kết quả MockMvc làm ảnh UC thành công.
