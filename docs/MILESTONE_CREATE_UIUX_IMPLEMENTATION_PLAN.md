# Implement plan: tối ưu UI/UX màn hình Create milestone

## 1. Mục tiêu và phạm vi

Giúp Teacher/Mentor tạo milestone đúng ngay lần đầu, hiểu rõ thời điểm milestone tự bắt đầu, tìm và sửa lỗi nhanh, đồng thời giảm chiều dài và độ phức tạp cảm nhận của form.

Phạm vi là màn hình tạo mới và form dùng chung khi sửa milestone `PLANNED`. Giữ nguyên API, payload, quy tắc nghiệp vụ và cơ chế `Idempotency-Key`; backend tiếp tục là nguồn xác thực cuối cùng. Nội dung giao diện tiếp tục dùng tiếng Anh để nhất quán với phần còn lại của module.

Các file chính:

| File | Vai trò |
| --- | --- |
| `frontend/src/pages/management/project/milestone/components/MilestoneForm.tsx` | Bố cục form, trạng thái, lỗi, tóm tắt và nút hành động |
| `frontend/src/pages/management/project/milestone/milestone-form.schema.ts` | Validation ngày giờ và các trường liên quan |
| `frontend/src/pages/management/project/milestone/components/MilestoneChecklistEditor.tsx` | Danh sách điều kiện hoàn thành |
| `frontend/src/pages/management/project/milestone/components/MilestoneRubricSelector.tsx` | Lựa chọn rubric, preview và empty state |
| `frontend/src/pages/management/project/milestone/pages/MilestoneCreatePage.tsx` | Tải options, xử lý tạo/sửa, lỗi API và điều hướng |
| `frontend/src/pages/management/project/milestone/milestone.utils.ts` | Hàm đổi/hiển thị thời gian nếu cần dùng chung |

## 2. Bố cục đích

Trên desktop, giữ vùng nhập chính và cột tóm tắt. Trên mobile, hiển thị tóm tắt ngay trước thanh hành động. Thứ tự nội dung trong vùng nhập:

1. **General information**: tên, mô tả, milestone bắt buộc hay tùy chọn.
2. **Schedule**: ngày bắt đầu trước, deadline sau. Một dòng giải thích milestone tự bắt đầu lúc 00:00 theo múi giờ tenant.
3. **Acceptance checklist**: nhập điều kiện hoàn thành.
4. **Evaluation rubric**: chọn và xem rubric.
5. **Submission settings**: một khối gọn hiển thị `Late: No / Resubmissions: 3 attempts` theo giá trị hiện tại; mở ra để chỉnh hai chính sách. Khi mục đang có lỗi, tự mở nó.

Thanh hành động cố định phía dưới tiếp tục có **Cancel** và **Create milestone / Save changes**. Summary chỉ hiển thị các thông tin giúp quyết định trước khi lưu: tên, lịch bắt đầu và deadline có kèm múi giờ, số checklist hợp lệ, rubric, late policy và số lần nộp. Dùng cùng một cách định dạng ngày giờ ở form và summary.

## 3. Các bước triển khai

### Bước 1 — Sửa luồng lịch và validation (ưu tiên cao)

- Tách Start date và Deadline thành một section Schedule; đặt Start date trước Deadline.
- Hiển thị rõ hai khái niệm: `Start date` được hiểu là 00:00 theo `tenantTimeZone`; `Deadline` nhập theo múi giờ thiết bị. Trong summary, đổi cả hai thành thời điểm dễ so sánh và ghi rõ múi giờ.
- Bổ sung validation client: `startDate` phải sau ngày hiện tại của tenant và thời điểm 00:00 của ngày đó phải **trước** deadline. Giữ validation deadline trong tương lai và `lateUntil > deadline`.
- Tạo một helper chuyển `startDate` thành instant tại đầu ngày theo IANA tenant time zone; không dùng `Date.parse("YYYY-MM-DDT00:00:00Z")` làm thời điểm bắt đầu của tenant. Dùng cùng helper cho validation và summary để tránh hai kết quả khác nhau. Kiểm tra cả múi giờ có DST.
- Nếu thay đổi deadline khiến `lateUntil` không còn hợp lệ, hiện lỗi ngay tại `Accept until`; không tự sửa giá trị người dùng đã nhập.

**Hoàn thành khi:** không thể gửi một form mà start của tenant bằng/sau deadline; lỗi xuất hiện cạnh Start date hoặc Deadline trước khi gọi API. Summary thể hiện cùng một lịch với payload sẽ gửi.

### Bước 2 — Sắp xếp lại form, giảm chiều dài cảm nhận (ưu tiên cao)

- Di chuyển Mandatory milestone vào General information; đưa Resubmission policy xuống cùng Late submission policy trong Submission settings.
- Dùng `Collapsible` hiện có trong frontend cho Submission settings. Header luôn hiện tóm tắt chính sách; khi mở, giữ nguyên các control và mô tả đang có.
- Khi sửa milestone `PLANNED`, điền đúng giá trị đang lưu; nếu có lỗi trong phần thu gọn thì tự mở phần đó và đưa người dùng đến trường lỗi.
- Rút gọn chiều cao mỗi checklist item: một hàng gồm số thứ tự, ô nội dung, Mandatory và các action; trên màn hình hẹp cho phép xuống dòng nhưng không làm chật ô nhập. Giữ thứ tự, giới hạn 100 mục, phím Enter để thêm, focus mục mới và không cho xóa mục cuối cùng.
- Giữ rubric preview và các chỉ số hiện có; tránh lặp lại các chỉ số chi tiết trong Summary.

**Hoàn thành khi:** các trường bắt buộc vẫn nhìn thấy theo thứ tự công việc; chính sách có thể đọc nhanh ở trạng thái thu gọn; form dùng được ở độ rộng mobile mà không bị tràn ngang.

### Bước 3 — Điều hướng lỗi và trạng thái bị chặn (ưu tiên trung bình)

- Thêm callback lỗi cho `handleSubmit` của React Hook Form. Sau submit không hợp lệ, hiện một error summary ở đầu form, nêu **trường nào** cần sửa và cho phép bấm để tới trường đó. Chỉ hiện sau lần submit lỗi; lỗi cạnh trường tiếp tục hiển thị.
- Mỗi trường có `aria-invalid`, `aria-describedby` gắn với thông báo lỗi. Với rubric dùng component `Select`, chuyển ref/focus tới `SelectTrigger`; không dựa vào `setFocus("rubricSnapshotId")` nếu trigger chưa được đăng ký với React Hook Form.
- Khi nhận lỗi API, giữ mapping về trường tương ứng. Mở Submission settings nếu lỗi thuộc late/resubmission policy; cuộn tới trường hoặc section liên quan. Giữ cảnh báo `networkUncertain` và retry an toàn hiện tại.
- Nếu không có rubric hợp lệ, thông báo ngay đầu form kèm **Manage rubrics** (mở tab mới) và **Reload options**. Giải thích vì sao nút tạo đang bị khóa. Các lỗi quyền/project từ `create-options` vẫn dùng trang lỗi riêng hiện tại.

**Hoàn thành khi:** từ một submit lỗi, người dùng tìm được trường cần sửa bằng tối đa một lần bấm; không có lỗi nằm trong section đang đóng; trạng thái thiếu rubric có cách khắc phục rõ ràng.

### Bước 4 — Tóm tắt và xác nhận (ưu tiên trung bình)

- Thay Summary lặp lại dữ liệu bằng bản tóm tắt ngắn theo thứ tự: milestone, lịch, checklist, rubric, chính sách. Không tính checklist trống là một mục đã hoàn thành.
- Ngày giờ hiển thị theo tenant time zone hoặc ghi rõ múi giờ khi dùng thời gian thiết bị; tránh chuỗi ngày thuần như `YYYY-MM-DD` trong phần xác nhận.
- Dùng nhãn **Review changes** khi sửa `PLANNED`, **Review milestone** khi tạo mới. Sau khi lưu thành công, giữ điều hướng hiện tại; không thêm bước xác nhận riêng nếu Summary đã đủ rõ.

**Hoàn thành khi:** Summary phản ánh đúng giá trị sẽ gửi, kể cả khi đổi chính sách hoặc rubric, và không gây thêm một màn hình/bước không cần thiết.

## 4. Kiểm thử và nghiệm thu

Frontend hiện không có script test tự động trong `package.json`. Trước khi merge, chạy `npm run build` và lint cho các file đã sửa; kiểm tra thủ công trên trình duyệt ở desktop và mobile.

| Tình huống | Kết quả mong đợi |
| --- | --- |
| Form trống, bấm Create | Summary lỗi chỉ rõ tên, ngày, checklist, rubric; focus/đường dẫn tới đúng trường |
| Start date là hôm nay theo tenant | Báo lỗi tại Start date trước khi gửi |
| Start date hợp lệ nhưng tenant midnight bằng/sau deadline | Báo lỗi tại lịch trước khi gửi |
| Thiết bị và tenant khác múi giờ; tenant có DST | Giờ hiển thị, validation và payload nhất quán |
| Chọn Allow late rồi đặt Accept until trước deadline | Báo lỗi tại Accept until; section chính sách tự mở |
| Không có rubric hợp lệ | Nút tạo bị khóa, có Manage rubrics và Reload options |
| Checklist nhiều mục, đổi thứ tự, xóa, thêm bằng Enter | Dữ liệu và focus đúng; không tràn ngang trên mobile |
| Tạo mới thành công hoặc retry sau mất kết nối | Không tạo bản ghi trùng; điều hướng như hiện tại |
| Sửa milestone `PLANNED` với giá trị chính sách khác mặc định | Form và Summary khớp dữ liệu cũ; lưu đúng payload |
| Cancel khi có thay đổi | Vẫn hiện hộp xác nhận bỏ thay đổi |

## 5. Thứ tự giao việc

1. Lịch và validation: `milestone-form.schema.ts`, helper thời gian, `MilestoneForm.tsx`.
2. Bố cục form và checklist: `MilestoneForm.tsx`, `MilestoneChecklistEditor.tsx`.
3. Error summary, focus và empty state rubric: `MilestoneForm.tsx`, `MilestoneRubricSelector.tsx`, `MilestoneCreatePage.tsx`.
4. Summary, responsive và kiểm thử toàn luồng tạo/sửa.

Không cần migration database hoặc thay đổi backend cho kế hoạch này. Nếu kiểm thử phát hiện backend diễn giải `startDate` khác 00:00 theo tenant time zone, dừng phần hiển thị lịch và đồng bộ lại contract trước khi merge.
