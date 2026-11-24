# Đối chiếu nguồn Master Trainer — 16/11/2026

## Kết luận

Hệ thống **có tài khoản giáo viên trong USERS**. Việc `/trainers` trả 0 không chứng minh toàn hệ thống không có giáo viên. Nguyên nhân dropdown bị BLOCKED là danh mục Trainer nội bộ và danh tính giáo viên/User/legacy đang tách rời, chưa có liên kết hoặc đồng bộ được xác minh.

Chưa tìm thấy hồ sơ nội bộ khớp `NgaTTT45` qua tên, username, user code, employee code hoặc email. Tuy nhiên, tên này tồn tại trong dữ liệu lớp cũ và service mẫu. Không được suy ra người đó không tồn tại ngoài các nguồn đã kiểm tra; cũng không được tự ghép người đó với một User hoặc tạo lại tài khoản.

## Dữ liệu đang được backend sử dụng

Nguồn đang chạy: `training-management/data/fams_lms_after_merge.mv.db`. Kiểm tra bằng SELECT qua H2 console của chính backend; không kết nối một database rỗng thay thế.

- `USERS`: 336 bản ghi. Qua `USER_ROLES` và `ROLES`, có hai User mang vai trò TEACHER:
  - ID **3**, `Teacher User`, `teacher@example.com`, `is_active=true`, `locked=false`.
  - ID **300**, `Hierarchy Mentor`, `hier.mentor@example.com`, `user_code=HIER-MENTOR`, vai trò TEACHER và MENTOR, `is_active=true`, `locked=false`.
- `COURSES`: bốn khóa học ID **1–4** có `instructor_id=3`, tên instructor `Teacher User`. Có khóa ngoại thật từ `COURSES.instructor_id` tới `USERS.id`.
- `CLASS_STAFF_ASSIGNMENTS`: 14 bản ghi MENTOR, không có bản ghi ROLE_TYPE=TRAINER. `user_id` liên kết `USERS.id`.
- `TRAINERS`: 0 bản ghi. Không có cột `user_id`, `external_id`, `legacy_id` hoặc `source_id` để tự liên kết với các nguồn trên.
- `TEACHING_ASSIGNMENTS`: 0 bản ghi.
- `SESSIONS`: 27 bản ghi active, mang trainer_id **1** (16), **2** (9), **5** (2). Đây là trường ID rời; không có khóa ngoại tới USERS hoặc TRAINERS. Không được coi các ID này là User ID.
- `TRAINING_OPERATION_CLASSES`: sáu lớp ID **3–8**, mã `HCM26_FR_JAVA_01`, `HCM26_FR_JAVA_02`, `HCM26_FR_REACT_01`, `HCM26_FR_DOTNET_01`, `HCM26_IN_JAVA_01`, `HCM26_CA_JAVA_01` lưu `master_trainer=NgaTTT45`, tất cả `master_trainer_id=NULL`.

Hai User TEACHER nói trên là bản ghi hiện hữu, không phải bằng chứng về danh tính NgaTTT45. Source cũng có initializer cho `teacher@example.com` và dữ liệu demo cho `hier.mentor@example.com`; vì thế không tự coi chúng là người thật đã được xác minh để migration.

## Nguồn cũ và các bản H2 khác

Ba file H2 ở thư mục ngoài repo được sao chép rồi mở bản sao bằng `IFEXISTS=TRUE;ACCESS_MODE_DATA=r`. SHA-256 của từng file gốc không thay đổi sau kiểm tra.

- `backend/data/class-management.mv.db` ở thư mục workspace ngoài: 3 User, có giáo viên ID 3; bảng **TRAINING_CLASSES.MASTER_TRAINER** chứa `NgaTTT45` trên sáu mã lớp trên, nhưng ID lớp là **33–38**, không phải 3–8. Không có hồ sơ User khớp NgaTTT45 trong các trường đã kiểm tra.
- `data/fams_lms_after_merge.mv.db` ở thư mục ngoài: 247 User, có User TEACHER ID 3; chưa có bảng TRAINERS. Không có User khớp NgaTTT45 theo các trường định danh/tên đã kiểm tra.
- `data/class-management.mv.db` ở thư mục ngoài: không có bảng ứng dụng PUBLIC thuộc nhóm User/Trainer/Class.

Không khẳng định job nào đã chuyển sáu lớp giữa các database: cùng code/tên chưa đủ chứng minh lịch sử migration. ID từ các database khác nhau không được sử dụng thay thế trực tiếp.

## NgaTTT45 được hiển thị và được lấy từ đâu?

1. Class Management hiện tại: `useClasses` gọi `/api/classes`; `TrainingClassService.dto` chép trường `masterTrainer` đã lưu từ `training_operation_classes`; `ClassListPage` hiển thị trực tiếp `item.masterTrainer`. Không join USERS để xác nhận danh tính khi hiển thị tên.
2. Service mẫu cổng **9090**: GET `/api/trainers` trả `id=1`, `name=NgaTTT45`, `status=active`. Header **X-Data-Source=sample**. Dữ liệu tương ứng nằm trong `mock-server.js`; đây không phải chứng cứ định danh từ một hệ thống tổng đã được xác minh.
3. Backend hiện tại: GET `/api/external/data-source` trả **sampleData=true**. GET `/api/external/trainers?status=all` trả năm trainer mẫu của `LocalExternalApiService`, khác danh mục cổng 9090 và không có NgaTTT45. Profile `local` dùng service này; service HTTP upstream chỉ dùng ngoài profile local.
4. Chỉ đổi URL cổng 9090 hoặc lấy tên từ lớp sẽ không tạo được liên kết Trainer hợp lệ và không được dùng để bỏ qua kiểm tra nguồn mẫu.

Ví dụ xung đột ID: external/mock trainer **1** là NgaTTT45, nhưng **USERS.id=1 là Admin User**; USERS.id=2 và 5 là STUDENT. Trùng số không có nghĩa cùng người.

## API, DTO, Mapper, Repository và ACTIVE

- `TrainerController`: `/api/trainers` đọc danh mục với TRAINER_READ; `/options` đọc với TRAINER_READ hoặc CLASS_READ và gọi `service.list(null, "ACTIVE", ...)`.
- `TrainerRepository` quản lý entity `Trainer` ánh xạ bảng **trainers**, không phải User. `TrainerServiceImpl.list` lọc `is_active=true` và status ACTIVE cho options; không có query join, đồng bộ hoặc import từ USERS, COURSES hay hệ thống cũ.
- `TrainerMapper` chép đúng `id`, `trainerCode`, `fullName`, `email`, `status` và topics từ Trainer. Không thấy nhầm `fullName/name`, sai enum chữ hoa/thường hoặc mất ID trong mapper.
- Frontend `trainerApi.verifiedOptions` đọc hết các trang `/trainers/options`, kiểm tra `/trainers/data-source`, giữ nguồn INTERNAL, status ACTIVE, ID số nguyên dương và tên không rỗng. `classSetupApi.verifiedTrainers` đổi `fullName` thành `name` đúng DTO giao diện.
- Khi đổi Master Trainer, `TrainingClassService` kiểm tra ID trong chính TRAINERS, trạng thái ACTIVE và tên khớp. Trộn User ID hoặc external ID vào dropdown sẽ vẫn bị từ chối, hoặc có nguy cơ gán nhầm nếu trùng ID một Trainer khác.
- Quyền admin đã được đối chiếu có TRAINER_READ/CREATE/UPDATE và CLASS_READ/CREATE/UPDATE. Không có lý do thay đổi quyền để giải quyết khoảng trống liên kết dữ liệu.

Đây là khoảng trống liên kết/cutover giữa các danh mục, không phải bằng chứng API làm mất các hàng TRAINERS có sẵn. Không sửa dropdown bằng fallback sang USERS hay sample API khi chưa có quy tắc định danh được phê duyệt.

## Phương án không mất dữ liệu — chỉ đề xuất, chưa thực hiện

1. Lập danh sách đối chiếu chỉ đọc: nguồn, ID nguồn, user code/employee code, email chuẩn hóa, tên, vai trò, trạng thái, class code và bằng chứng xác minh. Với NgaTTT45 cần hồ sơ từ hệ thống quản lý cũ thực sự hoặc xác nhận của người quản lý; không dùng mặc định ID 1 của mock.
2. Phân loại khớp duy nhất, xung đột và chưa xác minh. Kiểm tra cả hồ sơ inactive/đã archive; không ghép theo tên hoặc số ID. Giữ User và các liên kết COURSES/Class Staff hiện hữu.
3. Quyết định nguồn danh mục chính và duyệt bảng đối chiếu `source + sourceId -> userId/trainerId`. Với contract hiện tại, `masterTrainerId` vẫn phải là TRAINERS.id. Chưa có liên kết User↔Trainer bền vững trong schema; không tự thêm cột hoặc thay ngữ nghĩa ID trong API.
4. Nếu duyệt cutover sang danh mục nội bộ, tái sử dụng Trainer đã khớp duy nhất. Chỉ khi xác minh chưa có profile tương ứng mới đăng ký profile nghề nghiệp cho cùng người qua giao diện/API Trainer được cấp quyền, bằng mã/email chính thức; không tạo lại User hoặc cấp/kích hoạt tài khoản tự động. Kiểm thử toàn bộ trên bản sao trước, kèm snapshot và kế hoạch rollback được duyệt.
5. Sau khi có Trainer ACTIVE đã xác minh: tải lại danh mục trong Class Info, chọn rõ người, lưu ID nội bộ/tên qua API lớp và GET lại chi tiết/danh sách. Không đổi các lớp khác, course instructor, session trainer hoặc assignment bằng phép ghép ID tự động.
6. Lưu ý rollback: API lớp hiện không cho xóa một `masterTrainerId` đã gán về NULL. Vì vậy phải duyệt phương án rollback trên bản sao trước cutover; không hứa có thể đảo migration về tên legacy bằng form hiện tại.

## Phạm vi an toàn và bằng chứng

Lượt điều tra này không thay mã nghiệp vụ, API contract, schema, quyền hay validation; không build/restart backend, không ghi dữ liệu ứng dụng trên H2 gốc, không xóa code và không Git push. Các thay đổi source/test còn trong working tree là từ lượt sửa trước, được giữ nguyên.

Log SELECT và kết quả đọc các bản sao nằm ngoài repo, ở workspace `verification/master-trainer-source-audit/`: `schema.log`, `identities.log`, `links.log`, `legacy-outer-fams.log`, `legacy-root-class.log`, `legacy-backend-class.log`. Các câu SELECT mô tả nguồn hiện tại; không phải script migration được phép thực thi.
