# Training Class: đối chiếu SRS và hướng triển khai

Ngày phân tích: 21/10/2026. Phạm vi: module Training Class trong repository hiện tại.

**Cập nhật triển khai:** Xem [training-class-dev1.md](training-class-dev1.md) để biết policy UI/API và fixture đã triển khai. Các mục mô tả hiện trạng bên dưới là snapshot lúc review, trước khi bổ sung form sửa On-going, description, optimistic locking và fixture `dev1-demo`.

Nguồn: `SRS_FAMS_LMS_MockProject_Hub_ThucTe_v2.0_With_UI.pdf`, mã tài liệu `SRS-UNI-FAMS-LMS-MPH-002`, phiên bản 2.0. Số trang dưới đây là số trang PDF, trùng số in ở chân trang đã kiểm tra. Tài liệu còn ở trạng thái Draft for review; không xem những quyết định chưa chốt là BR chính thức.

Quy ước:

- **SRS**: yêu cầu được ghi rõ trong tài liệu.
- **Review leader**: yêu cầu người dùng cung cấp trong chat: lớp COMPLETED không được edit.
- **Đề xuất**: chính sách triển khai để leader/BA chốt, chưa phải BR được SRS quy định đầy đủ.

## 1. Phạm vi bạn cần đảm nhiệm

| Phần việc | Căn cứ | Phạm vi đề xuất cho người làm Class CRUD |
| --- | --- | --- |
| Danh sách, tìm kiếm, lọc, phân trang, chi tiết, tạo/sửa/vô hiệu hóa lớp | UFR-PEO-009, tr.45; SCR-48/49, tr.179-180 | Phần cốt lõi bạn sở hữu |
| Gán chương trình, học viên, master trainer, class admin, course/topic | UFR-PEO-009, tr.45 | Thuộc feature Training Class tổng thể; cần chia rõ phần bạn làm và API nhóm khác cung cấp |
| Import/export lớp | UFR-PEO-009, tr.45 | Có trong SRS. Nếu sprint này chỉ CRUD thì phải ghi rõ là backlog/deferred |
| Roster và nguồn lực | UFR-PEO-010, tr.46; SCR-50 | Module liên quan; CRUD không được phá ràng buộc roster/capacity |
| Lịch, calendar version, session | UFR-PEO-014, tr.50; BR-UNI-09, tr.119 | Phối hợp qua contract; không cần viết lại bộ sinh lịch trong CRUD |
| Course/trainer theo topic | UFR-PEO-015, tr.51 | Cung cấp điều kiện đủ nguồn lực trước Start |
| Attendance và grade | BR-UNI-11, tr.119; ma trận tr.120 | Module khác sở hữu dữ liệu; Class cần kết quả kiểm tra khi Complete |

Actor chính là Program Manager/Class Admin; SCR-48 cho Trainer đọc. Tất cả thao tác chịu permission và data scope. Role ADMIN trong code hiện tại là quy ước demo, chưa đại diện đầy đủ mô hình actor của SRS (tr.3-4,45,179).

## 2. Luồng nghiệp vụ nên bám theo

1. Người dùng mở danh sách, backend xác thực actor/permission/tenant và lọc theo phạm vi được giao.
2. Tạo lớp với chương trình **version ACTIVE**. Kiểm tra mã, dữ liệu ngày, sức chứa và các trường đã chốt. Khởi tạo PLANNING là hướng triển khai phù hợp điểm đầu vòng đời.
3. Mở Class Info bằng Class Code. Class Info thể hiện overview, trạng thái, người phụ trách, thông tin liên quan và audit. Các tab roster/lịch gọi module tương ứng.
4. Trong PLANNING, chuẩn bị Class Admin active, master trainer/trainer theo topic, course/topic và lịch active. Cho phép lưu lớp đang chuẩn bị, không đồng nhất Save với Start.
5. Start là lệnh nghiệp vụ riêng: kiểm tra đủ điều kiện rồi chuyển PLANNING sang ONGOING. Không tự chuyển chỉ vì đến ngày bắt đầu.
6. ONGOING chỉ cập nhật các trường được policy cho phép; thay đổi lịch/nguồn lực phải đi qua kiểm tra liên quan.
7. Complete là lệnh riêng: ONGOING sang COMPLETED khi attendance/grade đã khóa theo policy (tr.120). Sau đó không cho edit theo yêu cầu leader.
8. Cancel và deactivate/archive là hai thao tác khác nhau. Cancel kết thúc nghiệp vụ với trạng thái CANCELLED; deactivate chủ yếu kiểm soát hiển thị/lưu trữ. Cần chốt các trạng thái được Cancel và hậu quả đến lịch, học viên, điểm.

**Không suy diễn từ Open Class Request:** UFR-CUR-007/BR-UNI-07 mô tả phê duyệt nhu cầu; UFR-CUR-006 yêu cầu program ACTIVE để mở lớp. Tuy nhiên tài liệu chưa ghi rõ mọi lớp bắt buộc sinh từ một request APPROVED, một request được sinh bao nhiêu lớp, hoặc chỉ được tạo trực tiếp từ màn Request. SCR-49 còn có ô chọn Training Program, không có ô request trong hình tham chiếu. `openClassRequestId` bắt buộc ở code hiện tại là chính sách cần leader xác nhận, không thể gán thành BR-UNI-07 một cách mặc định.

## 3. Ràng buộc có căn cứ trong SRS

| Ràng buộc | Căn cứ | Ảnh hưởng tới CRUD |
| --- | --- | --- |
| Backend kiểm tra role/permission và object scope; UI ẩn nút chưa đủ | BR-UNI-01/02, tr.119; mục 2.1, tr.4 | List, detail, create, update, deactivate và batch đều kiểm tra |
| Class code duy nhất theo tenant | UFR-PEO-009, tr.45; traceability tr.229 | Unique theo tenant, không phải chỉ kiểm tra toàn hệ thống |
| Chỉ program version ACTIVE được dùng mở lớp | UFR-CUR-006, tr.31; BR-UNI-06, tr.119 | Backend đọc trạng thái program; không chỉ tin dropdown hoặc ID |
| Class có PLANNING, ONGOING, COMPLETED, CANCELLED | BR-UNI-08, tr.119 | Không dùng enum trạng thái Course cho Class |
| Start cần Class Admin, trainer, topic/course và calendar active | Ma trận trạng thái, tr.120 | Kiểm tra lại tại thời điểm chuyển trạng thái |
| Complete cần attendance/grade khóa theo policy | Ma trận trạng thái, tr.120 | Không chỉ thay status bằng form thông tin |
| Session nằm trong khoảng ngày của lớp; lịch chỉ có một version active, không trùng room/slot/holiday | BR-UNI-09, tr.119 | Sửa ngày lớp phải kiểm tra lịch liên quan |
| Thay roster kiểm tra lớp, thời gian, sức chứa, optimistic locking | UFR-PEO-009/010, tr.45-46 | Capacity không được sửa làm dữ liệu roster mất hợp lệ |
| Entity cạnh tranh cập nhật dùng version/ETag; stale trả 409/currentVersion | Mục 7.1/8.1, tr.121-122 | Hai người sửa không được ghi đè im lặng |
| Mặc định deactivate/archive; hard-delete theo retention và phê duyệt | Mục 7.1, tr.121 | Giữ lịch sử và dữ liệu phụ thuộc |
| Audit có actor, thời gian, before/after, correlation ID | UFR-PEO-009, tr.45; NFR-AUD, tr.123 | createdBy/updatedBy chỉ là một phần, chưa thay audit log |
| UI có loading/empty/error/success/denied và stale/conflict; giữ dữ liệu khi lỗi, chống submit lặp | Tr.5,123,125 | Validation client hỗ trợ UX; backend quyết định |
| Import/bulk idempotent, kết quả từng phần rõ ràng | BR-UNI-20, tr.119; tr.125 | Import cũng đi qua quy tắc trạng thái, quyền và validation |

SRS quy định lỗi 401/403/404/409 và 422 cho lỗi nghiệp vụ tại UFR-PEO-009. Dự án hiện dùng 400 cho nhiều validation; nên thống nhất contract với nhóm trước khi đổi toàn bộ error handler.

Các kiểm tra `endDate >= startDate`, capacity là số nguyên dương, trim chuỗi, giới hạn độ dài là kiểm tra toàn vẹn phù hợp mô hình. SRS chưa chốt regex Class Code, cách so sánh hoa/thường, có được dùng lại mã đã deactivate, thời gian tối đa của lớp, hoặc capacity tối đa. Không tự đặt các giá trị này thành BR đã được phê duyệt.

## 4. Completed và Ongoing được sửa gì?

**COMPLETED:** khóa edit thông tin lớp ở cả UI/API theo review leader. Không mở khóa bằng quyền UPDATE thông thường. Nếu sau này cần điều chỉnh dữ liệu lịch sử, phải đặc tả luồng correction/reopen riêng với quyền và audit; hiện chưa có yêu cầu này.

**ONGOING:** SRS chưa cho ma trận sửa theo từng field. Bảng sau là **đề xuất để review**, không phải quy định nguyên văn. Không bật quyền sửa rộng toàn bộ form chỉ vì lớp chưa Completed.

| Trường/thao tác | PLANNING - đề xuất | ONGOING - đề xuất | COMPLETED |
| --- | --- | --- | --- |
| Class name; description/note nếu được bổ sung | Được sửa | Cho sửa có audit, vì không đổi cấu trúc đào tạo | Khóa |
| Class code | Được sửa nếu policy cho phép và vẫn duy nhất | Khóa để giữ định danh ổn định | Khóa |
| Program version | Chỉ cân nhắc đổi khi chưa có dependency và không trái request đã duyệt | Khóa | Khóa |
| Trainee type, delivery format, site/campus | Được sửa theo danh mục và scope | Khóa ở form chung; nếu cần đổi phải có luồng đánh giá roster/nguồn lực | Khóa |
| Location | Được sửa khi nguồn lực hợp lệ | Không sửa tự do: đổi phòng/địa điểm phải kiểm tra lịch và các session tương lai | Khóa |
| Start date | Được sửa nếu toàn bộ lịch còn hợp lệ | Khóa ngày bắt đầu đã vận hành | Khóa |
| End date | Được sửa sau kiểm tra lịch | Chỉ cho đổi qua lệnh có kiểm tra session còn lại và dữ liệu đã phát sinh | Khóa |
| Capacity | Dương và phù hợp roster/nguồn lực | Chỉ cho đổi khi không thấp hơn số học viên đang chiếm chỗ, theo policy roster | Khóa |
| Class Admin/master trainer/trainer theo topic | Gán người active, đúng scope | Luồng phân công riêng; giữ lịch sử, không viết lại session/attendance cũ | Khóa trong edit chung |
| Status | Qua Start/Cancel có điều kiện | Qua Complete/Cancel có điều kiện | Không PATCH status tùy ý |
| isActive/deactivate | Theo policy dependency/retention | Chốt riêng; không dùng để thay Cancel | Chốt archive riêng; không phải edit nội dung |

Với `description/note`, model/DTO TrainingClass hiện tại chưa có field. Hình SCR-49 có mô tả/ghi chú, nhưng danh sách field chính thức còn nằm trong OD-08 (tr.230).

Giải pháp cho giai đoạn mock: trước khi có checker lịch/roster, giữ các thay đổi endDate/capacity/location của ONGOING bị chặn hoặc chưa expose; mô tả rõ là giới hạn tích hợp tạm thời. Khi checker đầy đủ mới bật khả năng sửa có điều kiện. Không return "valid" cho mọi yêu cầu chỉ để demo đi qua.

## 5. Đối chiếu code hiện tại

| Điểm | Hiện trạng sau thay đổi trong chat này | Hướng xử lý tiếp |
| --- | --- | --- |
| Click vào dòng mở chi tiết | Đã bỏ điều hướng cả dòng; Class Code là link mở `?tab=info`, áp dụng table/card | Giữ icon mắt cho quick view, không biến icon này thành điều hướng Class Info |
| Completed edit | Đã thêm kiểm tra tại service, trả ConflictException/409 trước khi thay dữ liệu; UI vốn chỉ hiện Edit cho PLANNING | Có regression test Completed bị từ chối và Planning vẫn sửa được |
| Ongoing edit | UI đang ẩn Edit; backend vẫn cho sửa hầu hết trường khi gọi API trực tiếp, ngoại trừ program version và lớp inactive | Chốt field policy; áp dụng cùng policy ở backend và form |
| Role/scope | Service read/update/delete yêu cầu ADMIN + permission; create chỉ yêu cầu permission. TrainingClass chưa có tenant/scope/assignment | Thống nhất role business với RBAC chung; không chỉ xóa `hasRole` rồi bỏ trống scope |
| Class code | `unique = true` trên code; existsByCode kiểm tra toàn cục | Hỗ trợ tenant rồi unique theo tenant + quy tắc canonicalization đã thống nhất |
| Program | Có interface checker nhưng mock chỉ chấp nhận ID=1 trong profile dev1-demo | Mock trả program fixture có ACTIVE/DRAFT/ARCHIVED và tenant, kiểm tra đúng nghiệp vụ |
| Request mở lớp | DTO bắt buộc request; mock có approved/review/rejected và kiểm tra program khớp | Xác nhận việc bắt buộc request và quan hệ 1-n với Class |
| Sửa program | Backend luôn cấm đổi; form Edit chung vẫn cho nhập programVersionId | Nếu giữ cấm thì hiển thị readonly; không cho nhập rồi mới báo lỗi. Nếu cho Planning đổi thì cần dependency policy |
| Vòng đời | Enum đủ 4 trạng thái nhưng Class service chưa có Start/Complete/Cancel và checker tương ứng | Đưa vào backlog riêng, không nhét vào update chung |
| Sửa ngày lớp | Update chỉ kiểm tra start/end; chưa kiểm tra session/đồng bộ Calendar | Calendar có bản sao classStartDate/classEndDate; cần thống nhất nguồn dữ liệu và giao dịch cập nhật |
| Sức chứa | DTO kiểm tra dương; chưa kiểm tra roster khi giảm capacity | Contract với module roster trả số đang chiếm chỗ theo policy |
| Optimistic locking | TrainingClass/BaseEntity và request chưa có version | Thêm version vào entity/response/request hoặc If-Match; kiểm tra 409 |
| Audit | Có createdAt/by, updatedAt/by | Bổ sung change log before/after/correlation, dùng hạ tầng audit chung nếu có |
| Import/export | UI đang tắt cả hai và Class chưa triển khai contract tương ứng | Không xem feature UFR-PEO-009 đầy đủ nếu chưa có hoặc chưa được defer chính thức |
| Danh mục | Site chỉ HCM/LONG_AN, trainee type FRESHER/INTERN, format ONLINE/OFFLINE/HYBRID | Đây là fixture/demo catalog, chưa có căn cứ coi là danh sách đóng của SRS |
| Danh sách | Search/page/sort và API lọc có sẵn; status trong schema chưa filterable; program hiển thị ID | Bổ sung status filter, hiển thị program name/version theo SCR-48; giữ ID bên trong |
| Trainees/calendar | Trainees dùng mock frontend; calendar seed classId=1001, Class CRUD sinh ID từ DB; calendar còn lấy class qua External API | Đồng bộ classId và nguồn Class, tránh tạo Class local nhưng Calendar tra một hệ thống khác |

Các file chính: `TrainingClassServiceImpl.java`, `TrainingClass.java`, `TrainingClassRepository.java`, DTO trong `system/schedule/trainingclass`, `TrainingClassListPage.tsx`, `TrainingClassCreateForm.tsx`, `ClassTraineesTab.tsx`, `Calendar.java`, `CalendarDemoDataInitializer.java`, `ExternalApiServiceImpl.java`.

## 6. Hướng làm lại theo thứ tự

### Bước 1: Chốt contract nghiệp vụ trước khi mở rộng form

Đưa bảng mục 4 cho leader/BA review. Ghi thành AC những điểm còn thiếu: tạo bắt buộc từ approved request hay được tạo trực tiếp; policy ONGOING; Cancel/deactivate; đổi program trong Planning; role/scope; danh mục và import/export của sprint. SRS đã dành OD-08 cho field/scope và OD-03 cho policy import, không hard-code ngầm.

### Bước 2: Bảo vệ dữ liệu tại Class service

- Tách kiểm tra authorization/scope khỏi điều kiện trạng thái nhưng chạy cả hai cho mọi mutation.
- Update thông tin có version và whitelist field theo status; kiểm tra cả giá trị gửi lên so với giá trị cũ.
- Completed khóa edit. Cancelled nên readonly theo đề xuất, chờ chốt có luồng reopen hay không.
- Field bị khóa vẫn phải kiểm tra server, không chỉ disabled input. Client có thể gửi request trực tiếp.
- Nếu request làm đổi trường cần Calendar/Roster kiểm tra mà dependency chưa sẵn sàng, báo lỗi rõ; không lưu trước rồi mới validate.

### Bước 3: Tạo fixture có ý nghĩa nghiệp vụ

Mock nằm ở provider/adapter hoặc seed trong profile `dev1-demo`; service vẫn chạy BR thật. Bộ fixture tối thiểu:

| Nhóm | Dữ liệu cần có |
| --- | --- |
| Tenant/scope | Hai tenant hoặc hai class scope; actor đúng scope/sai scope; thiếu permission |
| Program version | ACTIVE, DRAFT, ARCHIVED, không tồn tại; cùng và khác scope |
| Class | PLANNING, ONGOING, COMPLETED, CANCELLED, inactive; mã trùng và mã khác |
| Request nếu bắt buộc | APPROVED, UNDER_REVIEW, REJECTED; sai program; không tồn tại |
| Nguồn lực | Class Admin active/inactive, topic thiếu trainer, thiếu course, calendar chưa active |
| Dependency | Roster có người chiếm chỗ; session nằm ngoài khoảng ngày mới; hai editor dùng cùng version |

Giữ ID Class nhất quán giữa Class, Calendar, Session, Roster; không mock mỗi màn một tập ID không liên kết. Fixture trạng thái và scope phải có dữ liệu kiểm chứng, không chỉ vài ID đặc biệt.

### Bước 4: Hoàn thiện UI theo policy đã chốt

- List: Class Code mở Class Info; thêm filter trạng thái; program hiển thị tên + version.
- Form Create: chọn program ACTIVE từ API; nếu bắt buộc request thì chọn request APPROVED và derive program từ request. Backend luôn xác thực lại.
- Form Edit: dựng field editable/readonly theo status và quyền. Hiển thị lý do bị khóa; Completed có thông tin readonly.
- Ongoing: chỉ expose field/lệnh đã có checker; không dùng lại nguyên Create/Edit chung cho mọi trạng thái.
- Lỗi field giữ nguyên dữ liệu; 409 hiển thị reload/conflict; các action state có confirmation phù hợp.

### Bước 5: Nối lifecycle và các module theo phạm vi sprint

Đề xuất action contract riêng `start`, `complete`, `cancel` với permission, expectedVersion và reason khi policy yêu cầu. Đây là thiết kế đề xuất, SRS không ấn định tên endpoint. Start gọi checker tài nguyên/lịch; Complete gọi checker khóa attendance/grade. Không triển khai lại dữ liệu của module khác bên trong Class.

## 7. AC và ca kiểm thử cần có khi bàn giao

| ID đề xuất | Tình huống | Kết quả mong đợi |
| --- | --- | --- |
| TC-UFR-PEO-009-01 | Tạo lớp hợp lệ, program ACTIVE | Một Class PLANNING, dữ liệu/audit đúng |
| TC-UFR-PEO-009-02 | Program DRAFT/ARCHIVED hoặc sai scope | Từ chối ở backend |
| TC-UFR-PEO-009-03 | Trùng Class Code trong cùng tenant, kể cả concurrent create | Conflict; không có 2 lớp trùng |
| TC-UFR-PEO-009-04 | Cùng code ở tenant khác | Theo unique-per-tenant và scope đã chốt |
| TC-UFR-PEO-009-05 | Mất permission hoặc đổi classId sang lớp ngoài scope | Không truy cập/cập nhật được |
| TC-UFR-PEO-009-06 | Click Class Code bằng chuột hoặc Enter | Mở Class Info của đúng lớp |
| TC-UFR-PEO-009-07 | Click Class Name, ô trống, checkbox hoặc action | Không điều hướng Class Info ngoài ý muốn |
| TC-UFR-PEO-009-08 | Completed gửi PUT hợp lệ trực tiếp | 409; dữ liệu giữ nguyên |
| TC-UFR-PEO-009-09 | Ongoing sửa name và cố sửa program/code/ngày bắt đầu | Chấp nhận/từ chối từng field theo ma trận đã chốt; không bypass bằng API |
| TC-UFR-PEO-009-10 | Rút endDate làm session ra ngoài range | Từ chối hoặc đổi lịch trong luồng riêng; không lưu trạng thái dở dang |
| TC-UFR-PEO-009-11 | Giảm capacity thấp hơn roster đang chiếm chỗ | Từ chối theo policy roster |
| TC-UFR-PEO-009-12 | Hai người cùng sửa một version | Người sau nhận 409/currentVersion, không ghi đè im lặng |
| TC-UFR-PEO-009-13 | Start thiếu admin/trainer/course/calendar active | Từ chối và chỉ rõ điều kiện thiếu |
| TC-UFR-PEO-009-14 | Complete khi attendance/grade chưa khóa | Từ chối |
| TC-UFR-PEO-009-15 | Cancel/deactivate có dữ liệu liên quan | Theo policy đã chốt; không hard-delete lịch sử |
| TC-UFR-PEO-009-16 | Retry create/import, double-submit | Không tạo bản ghi lặp; thông báo kết quả rõ |
| TC-UFR-PEO-009-17 | Lỗi validation, provider unavailable, empty, denied | Trạng thái UI đúng, giữ dữ liệu/filter, retry an toàn |

Những ca này là checklist/backlog kiểm thử. Chỉ các kiểm tra được ghi trong kết quả bàn giao chat mới được xem là đã chạy.

## 8. Các thay đổi đã thực hiện trong phiên phân tích

1. Chỉ Class Code điều hướng tới Class Info, có link thật để dùng bàn phím và mở tab mới; hỗ trợ chế độ table và card. Loại bỏ onRowClick của trang Training Class.
2. Backend từ chối edit COMPLETED theo yêu cầu leader, trước khi thay đổi entity. Không thay policy ONGOING khi chưa chốt ma trận field.
3. Bổ sung regression test cho Completed bị khóa và Planning vẫn cập nhật được.

Các thay đổi backend/DTO/frontend chưa commit vốn có của người dùng được giữ lại. Không tự động refactor role/tenant, lifecycle, request bắt buộc, danh mục hoặc import/export trong phiên này.

## 9. Kết quả kiểm tra đã chạy

- Frontend: `npm run build` thành công, gồm TypeScript và Vite production build.
- Backend: Java 21, `mvn -o -f backend/pom.xml -Dtest=TrainingClassServiceImplTest test`: 2 test, 0 failure, 0 error. Kiểm tra Completed không cập nhật entity/save; Planning vẫn cập nhật hợp lệ.
- Browser headless trên production build, API mock: Class Code mở đúng `/training-classes/42?tab=info` ở table và card; click tên lớp không điều hướng; checkbox và quick-view giữ trang list; Enter trên link điều hướng; không có page error.
- `git diff --check` không báo lỗi whitespace.

Chưa chạy toàn bộ test suite hay kiểm thử tích hợp với hệ thống program/roster/calendar thật. Các policy ONGOING, tenant/scope và lifecycle trong bản phân tích là việc còn lại, không được xem là đã triển khai qua các kiểm tra trên.
