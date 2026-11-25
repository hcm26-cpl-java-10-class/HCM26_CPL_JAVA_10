# Phương án liên kết Master Trainer — 16/11/2026

Tham chiếu: [báo cáo đối chiếu nguồn](MASTER_TRAINER_SOURCE_AUDIT_2026-11-16.md). Đây là phương án chờ xác minh danh tính và phê duyệt; không phải migration đã áp dụng.

## Danh tính chắc chắn và chưa xác minh

- Chắc chắn ở cấp dữ liệu: `COURSES.id=1,2,3,4` liên kết bằng khóa ngoại `instructor_id` tới `USERS.id=3`. Không cần tạo lại tài khoản để bảo toàn các liên kết này.
- Có sẵn hai tài khoản TEACHER active, không khóa: User 3 (`teacher@example.com`) và User 300 (`hier.mentor@example.com`, user code `HIER-MENTOR`). Source có initializer seed/demo cho hai tài khoản này. Chúng chưa phải danh tính người thật được phê duyệt để đồng bộ.
- Chưa có cặp `USERS ↔ TRAINERS` nào khớp bằng mã/email: TRAINERS hiện có 0 hàng.
- `NgaTTT45`: sáu lớp giữ tên legacy, ID Trainer nội bộ NULL; chưa nhận được mã giảng viên/email chính thức hoặc chứng cứ nối với một User cụ thể. Không dùng tên hoặc ID 1 của Mock API 9090 để ghép.

Kết quả chắc chắn không đồng nghĩa xác minh danh tính ngoài đời: khóa ngoại của khóa học chứng minh quan hệ giữa các bản ghi, không chứng minh User 3 là NgaTTT45.

## Cơ chế phù hợp API/schema hiện tại

Giữ USERS làm tài khoản đăng nhập và giữ nguyên role, quyền, trạng thái, tenant, course instructor, Class Staff. TRAINERS tiếp tục là hồ sơ giảng viên nghề nghiệp trong namespace riêng. `masterTrainerId` chỉ mang giá trị TRAINERS.id; không đổi thành User ID hoặc external ID. Hai User được rà soát đều có tenant_id=1; TRAINERS không có tenant_id, nên không tự suy ra hoặc mở rộng phạm vi tổ chức từ phép khớp email.

Schema hiện không có `trainers.user_id` hay liên kết nguồn cũ. Vì yêu cầu giữ nguyên schema/API, phương án khả thi là đồng bộ một chiều có kiểm soát, kèm hồ sơ đối chiếu được duyệt ngoài database: nguồn + phạm vi tổ chức + mã nguồn đã xác minh + email chính thức + User ID cục bộ + Trainer ID cục bộ + bằng chứng + người duyệt + trạng thái + before/after. Đây là đối chiếu được quản lý, không phải khóa ngoại đã tồn tại hay đồng bộ hai chiều tự động.

Tài khoản TEACHER có sẵn được tái sử dụng nếu định danh được xác minh; không tạo tài khoản User mới. Nếu cần đăng ký một profile TRAINERS cho cùng người, đó là bước nghiệp vụ riêng chỉ sau khi đã đối chiếu trùng và được duyệt, không phải tự tạo ra một giảng viên mới. Chưa được thực hiện bước này với bất kỳ danh tính nào đang chưa xác minh.

Muốn có liên kết User–Trainer bền vững tự động khi email/mã thay đổi sẽ cần thiết kế migration/schema riêng. Lượt này không tự thêm cột, endpoint, fallback hoặc thay nghĩa ID để giả lập liên kết đó.

## Các bước để Master Trainer hoạt động

1. Nhận hồ sơ từ nguồn quản lý được xác nhận: mã giảng viên và/hoặc email chính thức, bằng chứng cùng người, trạng thái được phép sử dụng, mã lớp mục tiêu. Với NgaTTT45, thiếu bước này thì dừng việc liên kết.
2. Tìm ứng viên bằng email trim/lowercase hoặc mã trim/uppercase; không dùng tên, gần giống tên, thứ tự hàng hay ID giữa các hệ thống. Mã User không tự được coi là mã Trainer nếu đơn vị quản lý chưa xác nhận.
3. Kiểm tra cả hồ sơ inactive/đã archive và các khóa đang được người khác sử dụng. Email khớp một người nhưng mã khớp người khác, nhiều ứng viên, hồ sơ thiếu bằng chứng hoặc trạng thái chưa được duyệt đều phải chặn và chuyển đối chiếu thủ công.
4. Với hồ sơ khớp duy nhất đã duyệt: tái sử dụng Trainer hiện có. Nếu chưa có profile, người có TRAINER_CREATE mới đăng ký qua UI/API hiện tại sau phê duyệt. TRAINER_UPDATE chỉ dùng cho sửa hồ sơ đã xác minh; không tự cấp quyền, đổi role hay chuyển User/Trainer sang ACTIVE.
5. Khi dùng Import Trainers, bắt buộc nhập Status rõ ràng theo hồ sơ được duyệt. Không để Status trống vì logic import hiện tại mặc định ACTIVE. Preview/commit hiện có vẫn phải chạy đầy đủ; không bỏ qua kiểm tra code/email trùng, topic hợp lệ hoặc rollback toàn bộ file khi một hàng lỗi.
6. Ghi lại Trainer ID từ response của API, không tự đặt bằng User ID. Chỉ Trainer `is_active=true`, `status=ACTIVE`, nguồn nội bộ hợp lệ mới được đưa vào lựa chọn Class.
7. Đối chiếu lớp qua mã lớp đã duyệt trong đúng database. Đọc lại dữ liệu mới nhất ngay trước khi sửa, dừng nếu khác bản đã duyệt; dùng payload mới nhất để giữ các trường khác. Thực hiện trong cửa sổ kiểm soát chỉnh sửa vì API hiện tại không có ETag/revision cho thao tác này.
8. Người có CLASS_UPDATE chọn rõ giảng viên ở Edit Class và lưu qua API hiện tại. Create Class vẫn yêu cầu CLASS_CREATE. GET lại chi tiết và danh sách, mở lại form, xác nhận ID/tên, Class Admin, dates, capacity và các trường còn lại. Không tự sửa các lớp còn lại, sessions, course instructor, lịch hoặc assignment.

## Trùng lặp, tính lặp lại và trạng thái lỗi

- Một khóa chuẩn hóa chỉ được dẫn tới một danh tính trong phạm vi nguồn đã xác minh. Nếu email và mã đều có, chúng phải nhất quán, không lấy một khóa để bỏ qua xung đột của khóa kia.
- Lần chạy lại phải nhận ra Trainer đã đối chiếu và tái sử dụng ID; không POST lại mỗi lần. Hồ sơ đối chiếu phải được đọc lại cùng dữ liệu hiện tại trước khi thực hiện hành động.
- Unique constraints và kiểm tra ignore-case của TrainerService/Import bảo vệ lần ghi cuối cùng, kể cả archived records. Không xem HTTP 409 là lý do xóa, đổi mã tùy ý hoặc kích hoạt hồ sơ cũ.
- Các request tạo profile và cập nhật Class là các transaction riêng. Chúng không tạo thành một migration nguyên tử. Nếu một bước thất bại thì dừng, giữ audit trước/sau, không tự xóa/rollback bằng các quyền chưa được cấp.

## Rollback và điều kiện cho phép triển khai

1. Tạo snapshot nhất quán, khôi phục vào môi trường tách biệt và đối chiếu dữ liệu trước triển khai. Không sao chép thô file H2 đang khóa.
2. Chốt cửa sổ không có ghi đồng thời trước cutover. Rollback toàn database ngoài cửa sổ này có thể làm mất các thay đổi hợp lệ sau snapshot; không dùng phương án đó nếu chưa có kế hoạch xử lý delta được duyệt.
3. API Class hiện cấm đổi `masterTrainerId` đã gán về NULL. Không thể hứa khôi phục lớp legacy chỉ bằng thao tác ngược qua form. Cần duyệt phương án khôi phục offline hoặc migration bù riêng trước lần gán ID đầu tiên.
4. Không tự gọi DELETE/Archive Trainer để rollback. Các quyền đó không suy ra từ TRAINER_CREATE/UPDATE và có thể bị chặn khi profile được tham chiếu.
5. Chưa áp dụng trên dữ liệu gốc khi thiếu xác minh danh tính, thiếu diễn tập thành công hoặc chưa có phê duyệt kế hoạch ghi và rollback.

## Kiểm thử trên bản sao H2

Snapshot nhất quán được tạo bằng H2 BACKUP TO, chỉ xuất file ngoài database. SHA-256 file ZIP: `3E0534984C366216C136DCC482A47D201B39CCF8757AB8A04CF80883CED944DA`.

- Giải nén thành hai bản độc lập: working và restore-check. File DB có SHA-256 giống nhau; cả hai mở được ở chế độ chỉ đọc, IFEXISTS=true.
- Dry-run bằng mã/email: 2 User TEACHER đủ điều kiện tài khoản; 0 Trainer; 0 ứng viên khớp User–Trainer; 0 nhóm email User trùng sau chuẩn hóa; 0 nhóm mã/email Trainer trùng.
- Hồ sơ chứng thực danh tính chưa được cung cấp. Số liên kết được duyệt và số hành động ghi được đề xuất đều **0**. Không tạo Trainer, không chuyển trạng thái và không gán NgaTTT45, kể cả trên bản sao.
- Khôi phục và so sánh fingerprint nội dung 14 bảng nghiệp vụ: **PASS**. Bao gồm Users/roles/quyền, Courses, Class Staff, Trainers/topics, Classes, assignments, sessions, operation info, calendars và enrollments.
- Khởi động backend tách biệt trên clone với ddl-auto=validate, tắt startup mutation/seed/scheduling: **BLOCKED**. Hibernate báo `milestone_artifact_drafts.release_notes` trong DB là CLOB, entity kỳ vọng TEXT/VARCHAR. Đây là rào cản schema ngoài Trainer; không sửa schema hoặc đổi validate thành none/update để coi thử nghiệm là đạt.
- Sau lần khởi động không thành công, fingerprint cả 14 bảng nghiệp vụ vẫn giống baseline: **PASS**. Không có thay đổi dữ liệu nghiệp vụ do diễn tập.
- Chưa chạy được kiểm thử HTTP trên clone và chưa thực hiện happy path đổi sang Trainer thật: backend clone chưa qua schema validation và chưa có danh tính/profile được xác minh. Không báo thành công chọn/lưu trên dữ liệu thật trong trạng thái này.

Artefact ngoài repo: `verification/master-trainer-source-audit/link-rehearsal/`, gồm `source-snapshot.zip`, `identity-review.json`, `dry-run-before.log`, `dry-run-after.log`, `restore-baseline.log`, `clone.out.log`, `clone.err.log` và script chẩn đoán chỉ đọc. Các file này không phải lệnh đồng bộ đã được phê duyệt để chạy trên dữ liệu gốc.

## Thay đổi trong lượt này

Chỉ bổ sung tài liệu phương án và artefact diễn tập. Không sửa mã nghiệp vụ vì chưa xác định lỗi mapping/Trainer API cần sửa; không đổi API, schema, validation, role/quyền, seed hoặc source thật. Không commit, push, reset, xóa code hoặc thay các chức năng Create/Edit Class, Trainee List, Calendar, Import/Export.
