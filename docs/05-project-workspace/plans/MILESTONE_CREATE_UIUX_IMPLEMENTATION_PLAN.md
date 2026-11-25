# Implement plan: Create và View milestone

## 1. Mục tiêu

- Giảm lượng cuộn cần thiết khi tạo hoặc sửa milestone `PLANNED`; người dùng chỉ thấy nội dung của bước đang làm.
- Giúp người xem nhận ra ngay milestone đang ở trạng thái nào, hạn nộp khi nào và cần làm gì tiếp theo.
- Dùng màu có ý nghĩa, nhất quán giữa danh sách Workspace và hai trang chi tiết. Giao diện vẫn sáng, dễ đọc; màu chỉ nhấn vào trạng thái, hành động và thông tin cần chú ý.
- Giữ nguyên API, payload, các quy tắc nghiệp vụ, quyền truy cập, `Idempotency-Key` và nội dung giao diện tiếng Anh của module.

Phạm vi: tạo milestone theo Project/Team, sửa milestone `PLANNED`, xem chi tiết milestone theo Project/Team. Form sửa `IN_PROGRESS`/`CHANGES_REQUESTED` hiện dùng `MilestoneActiveEditForm`; không chuyển form đó sang wizard vì số trường ít, nhưng cần bảo đảm màu/trạng thái và điều hướng quay lại chi tiết thống nhất.

## 2. Hiện trạng trong code

| Vị trí | Vấn đề cần giải quyết |
| --- | --- |
| `components/MilestoneForm.tsx` | Năm khối nhập và cột Review cùng xuất hiện; checklist/rubric làm trang dài dù người dùng chưa đến bước đó. |
| `pages/MilestoneCreatePage.tsx` | Đã có xử lý tạo/sửa, mất kết nối, hủy khi có thay đổi; wizard phải tái sử dụng các hành vi này. |
| `pages/MilestoneDetailPage.tsx`, `pages/TeamMilestoneDetailPage.tsx` | Thông tin, checklist, rubric, chính sách và lịch sử xếp nối tiếp; khó quét nhanh hoặc tìm đúng phần. Hai trang còn khác nhau về cấu trúc. |
| `WorkspaceArtifactsPanel.tsx` | Khi được gọi với một milestone, panel vẫn hiển thị tìm kiếm, lọc, tổng quan và bảng sáu cột cho đúng một hàng. |
| `components/MilestoneStatusBadge.tsx` | Badge chỉ là chữ đơn sắc. `WorkspaceMilestonesPanel.tsx` đã có bảng màu cho sáu trạng thái nhưng đang định nghĩa riêng trong file. |
| `frontend/src/index.css` | `primary`, `secondary` và bề mặt mặc định là thang trắng/đen. Nên thêm màu trong phạm vi milestone trước khi cân nhắc đổi theme toàn ứng dụng. |

## 3. Thiết kế luồng Create/Edit `PLANNED`

### 3.1. Bốn bước

| Bước | Tên trên UI | Nội dung | Điều kiện trước khi tiếp tục |
| --- | --- | --- | --- |
| 1 | Basics | Tên, mô tả, Mandatory milestone | Tên hợp lệ; mô tả trong giới hạn. |
| 2 | Schedule & rules | Start date, Deadline, late submission, resubmission | Lịch hợp lệ theo múi giờ tenant; nếu cho nộp trễ thì `Accept until` và penalty hợp lệ; số lần nộp hợp lệ. |
| 3 | Acceptance & rubric | Checklist và chọn rubric | Ít nhất một checklist hợp lệ; rubric được chọn và còn đủ điều kiện. |
| 4 | Review | Tóm tắt các giá trị sẽ gửi, nút Create milestone/Save changes | Kiểm tra toàn form lần cuối; nếu có lỗi, đưa về đúng bước và trường lỗi. |

Desktop: stepper nằm trên vùng nội dung, một cột nhập rộng tối đa khoảng 760–880 px; không giữ cột Review bên cạnh mọi bước. Mobile: nhãn `Step n of 4` và tên bước; các bước không ép thành một hàng gây tràn ngang. Footer cố định ở đáy gồm **Cancel**, **Back** và **Continue** hoặc **Create milestone / Save changes** ở bước cuối. Footer không che trường cuối, kể cả khi bàn phím mobile mở.

Người dùng có thể quay lại bước trước hoặc chọn bước đã hoàn tất. Chỉ bước Review mới gửi API. Chuyển bước không làm mất dữ liệu, vị trí checklist, lựa chọn rubric hoặc trạng thái policy. Khi đổi bước, cuộn tới tiêu đề bước thay vì giữ vị trí cuộn sâu của bước trước. Checklist dài vẫn cuộn theo trang; không tạo thêm vùng cuộn lồng nhau. `Cancel`, browser unload và hộp xác nhận bỏ thay đổi giữ hành vi hiện tại.

### 3.2. Nội dung từng bước

- **Basics:** giữ tên, mô tả và Mandatory trong một card gọn. Dùng một dải màu xanh rất nhạt ở tiêu đề trang/stepper làm điểm nhấn thị giác; trường nhập và văn bản vẫn trên nền trung tính.
- **Schedule & rules:** đặt Start date trước Deadline. Dòng giải thích ngắn: milestone bắt đầu lúc 00:00 theo `tenantTimeZone`, Deadline nhập theo múi giờ thiết bị; hiện cùng một cặp thời điểm đã quy đổi để kiểm tra. Late/Resubmission dùng các control hiện có, chỉ mở trường phụ khi policy tương ứng được bật. Có thể dùng một card "Submission rules" với hai nhóm ngắn; không cần thêm lớp accordion vào trong wizard.
- **Acceptance & rubric:** mỗi checklist item là một hàng gọn gồm thứ tự, nội dung, Mandatory và các action; mobile cho xuống dòng có kiểm soát. Giữ tối đa 100 mục, Enter để thêm, focus mục mới, sắp xếp/xóa và không xóa mục cuối cùng. Rubric chỉ hiện tên/version và vài số liệu chính; chi tiết criterion/rating mở trong dialog hiện có, tránh kéo dài bước này.
- **Review:** tóm tắt theo thứ tự Basics → Schedule → Acceptance → Rubric → Rules. Mỗi nhóm có nút **Edit** quay về bước liên quan. Hiển thị `startDate` dưới dạng thời điểm bắt đầu theo múi giờ tenant, Deadline/Accept until cùng cách định dạng; nêu rõ Mandatory, số checklist hợp lệ, rubric version, late policy và attempts. Không thêm modal xác nhận khác.

### 3.3. Trạng thái, validation và lỗi

- Giữ một `useForm` trong `MilestoneForm`, bảo đảm field của bước chưa hiển thị vẫn giữ giá trị. Chia validation theo nhóm trường của từng bước; các ràng buộc liên trường (`startDate < deadline`, `lateUntil > deadline`) phải chạy khi người dùng bấm Continue ở bước 2. Full schema vẫn là chốt kiểm tra trước khi gửi API; không dựa vào việc `trigger` các field con sẽ luôn chạy `superRefine` khi các bước khác còn trống.
- Stepper thể hiện `current`, `complete` và `needs attention` bằng nhãn/icon kèm màu; không dùng màu đơn độc. Khi Continue lỗi, hiện summary ngắn đầu bước và focus trường lỗi đầu tiên. Khi API trả lỗi trường, map path về bước, chuyển tới bước đó, mở control liên quan và focus sau khi DOM đã render.
- Nếu không có rubric hợp lệ, thông báo tại bước 3 với **Manage rubrics** và **Reload options**; nút Continue/Create bị khóa cùng lời giải thích. Giữ mapping lỗi `create-options`, xử lý `networkUncertain` và retry cùng `Idempotency-Key` của `MilestoneCreatePage`.
- Khi sửa `PLANNED`, các giá trị cũ phải được điền đúng; nhãn cuối là **Save changes**. Form sửa active vẫn theo luồng hiện tại.

## 4. Thiết kế trang View milestone

### 4.1. Header và tab

Phần đầu trang nằm gọn trong một card: breadcrumb/quay lại, title, badge lifecycle, Mandatory/Optional, Deadline, thời điểm bắt đầu, tiến độ checklist `completed/total` khi có dữ liệu và hành động chính theo quyền/trạng thái. Mô tả dài hiển thị đoạn đầu với nút mở rộng. Deadline quá hạn hoặc sắp đến hạn có nhãn chữ rõ nghĩa, không chỉ đổi màu. Không suy luận trạng thái nộp bài từ tiến độ checklist.

Bên dưới dùng `Tabs` hiện có với bốn mục:

| Tab | Nội dung ưu tiên |
| --- | --- |
| Overview | Mô tả đầy đủ, checklist, deadline/start, tóm tắt late/resubmission policy. Thông tin hệ thống như created at/version nằm trong disclosure "More details". |
| Deliverables | Bài nộp của milestone hiện tại, version/trạng thái review mới nhất và hành động Submit/Resubmit/View history theo quyền. |
| Rubric | `MilestoneRubricCard` hiện có, chỉ render ở tab này để bảng tiêu chí không kéo dài Overview. |
| History | Lịch sử chỉnh sửa milestone (`MilestoneDraftHistory`) theo quyền; lịch sử các phiên bản bài nộp vẫn ở Deliverables. Khi chưa có revision, hiển thị trạng thái trống dễ hiểu. |

Tab mặc định là Overview sau khi mở từ danh sách hoặc tạo xong. Lưu tab đang chọn trong query param `section`; giữ nguyên `teamId`/`workspaceId` và các query param khác khi đổi tab. `section` không hợp lệ quay về Overview. Trên mobile, tab list cuộn ngang hoặc dùng layout tương đương có nhãn đầy đủ, có focus và điều hướng bằng bàn phím. Chỉ ẩn tab khi người xem không có quyền hoặc tính năng không áp dụng; trường hợp có quyền nhưng chưa có dữ liệu phải có empty state rõ ràng.

Tách phần hiển thị chung của hai trang chi tiết thành component dùng lại. Các khác biệt Project/Team chỉ nằm ở nguồn query, đường quay lại, quyền và hành động. `WorkspaceArtifactsPanel` ở Workspace vẫn giữ chức năng danh sách nhiều milestone; trang chi tiết dùng chế độ một milestone gọn hoặc component riêng dùng chung query/action logic, bỏ thanh search/filter và bảng sáu cột. Không làm mất khả năng xem version, review outcome và submit/resubmit.

### 4.2. Hệ màu theo ý nghĩa

Tạo một mapping dùng chung cho badge, chấm trạng thái và nhấn cạnh card. Lấy màu hiện có ở `WorkspaceMilestonesPanel` làm điểm xuất phát, rồi dùng lại tại `MilestoneStatusBadge`, list và detail:

| Lifecycle | Màu đề xuất | Cách diễn đạt |
| --- | --- | --- |
| `PLANNED` | Slate dịu | Planned, chưa bắt đầu |
| `IN_PROGRESS` | Amber dịu | In progress, đang thực hiện |
| `SUBMITTED` | Blue dịu | Submitted, chờ đánh giá |
| `CHANGES_REQUESTED` | Orange dịu | Changes requested, cần chỉnh sửa |
| `ACCEPTED` | Emerald dịu | Accepted, hoàn thành đánh giá |
| `REJECTED` | Red dịu | Rejected, kết quả từ chối |

Màu điều hướng của wizard và nút hành động chính dùng một accent xanh/indigo nhẹ trong phạm vi module; không dùng màu trạng thái để tô nút Continue/Create. Bề mặt card vẫn trung tính. Mỗi vùng nhìn thấy chỉ nên có một mảng tint nhẹ ở header và các badge/trạng thái nhỏ; tránh tô cả card hoặc nhiều gradient. Dùng màu nhấn cho thanh tiến độ, đường viền trái của thông báo quan trọng, trạng thái step; lỗi form vẫn dùng `destructive` hiện có.

Định nghĩa cả light/dark classes hoặc token theo theme. Văn bản phải đạt độ tương phản tối thiểu WCAG AA (4.5:1 cho chữ thường, 3:1 cho chữ lớn/đường biên control quan trọng). Mỗi trạng thái luôn có nhãn chữ, icon hoặc hình dạng phù hợp; không truyền đạt thông tin chỉ bằng màu. Focus ring phải rõ trên nền tint.

## 5. File và thứ tự triển khai

| Giai đoạn | Thay đổi chính | File dự kiến |
| --- | --- | --- |
| 1. Wizard | Stepper, điều hướng, validation theo bước, Review, lỗi và focus | `components/MilestoneForm.tsx`, `pages/MilestoneCreatePage.tsx`, `milestone-form.schema.ts`, `components/MilestoneChecklistEditor.tsx`, `components/MilestoneRubricSelector.tsx` |
| 2. Màu | Mapping lifecycle và accent trong phạm vi milestone; đồng bộ list/detail/Workspace | `components/MilestoneStatusBadge.tsx`, file style helper mới, `WorkspaceMilestonesPanel.tsx`, `milestone-list.schema.tsx` |
| 3. View | Header gọn, tab dùng chung, policy summary, deep link tab | `pages/MilestoneDetailPage.tsx`, `pages/TeamMilestoneDetailPage.tsx`, component detail dùng chung mới |
| 4. Deliverables | Giao diện một milestone, tái sử dụng query/action logic và giữ Workspace list | `WorkspaceArtifactsPanel.tsx` hoặc component single-milestone mới |
| 5. Hoàn thiện | Responsive, dark mode, kiểm thử hồi quy, accessibility | Các file trên và checklist QA |

Không cần migration database hay thay đổi backend theo thiết kế này. Nếu lúc triển khai phát hiện API không cung cấp dữ liệu cần cho header/deliverables, ghi rõ khoảng thiếu và chỉ bổ sung contract sau khi xác nhận từ code backend.

## 6. Nghiệm thu

| Tình huống | Kết quả mong đợi |
| --- | --- |
| Tạo mới trên desktop 1366 px và mobile 360–390 px | Mỗi bước chỉ hiện nội dung liên quan; footer/stepper dùng được, không tràn ngang; không cần cuộn qua rubric và checklist để tới nút lưu. |
| Qua lại các bước, thêm/sắp xếp checklist, chọn rubric, bật late policy | Dữ liệu và thứ tự được giữ, Review khớp payload sẽ gửi. |
| Bước 2 có `startDate` sai, deadline sai hoặc `lateUntil <= deadline` | Không cho qua bước; lỗi hiện tại trường liên quan, tính đúng tenant time zone kể cả DST. |
| Thiếu rubric hoặc submit/API trả lỗi | Có đường xử lý rõ; tự đến đúng bước và focus trường lỗi; retry khi mạng không chắc chắn không tạo trùng milestone. |
| Sửa `PLANNED`, hủy khi có thay đổi | Nạp đúng dữ liệu cũ, lưu đúng payload; hộp xác nhận hủy vẫn hoạt động. |
| Xem Project/Team milestone ở cả sáu trạng thái | Header và list dùng cùng tên/màu trạng thái; có nhãn chữ; hành động đúng quyền. |
| Tab Deliverables của một milestone | Không có search/filter và bảng nhiều cột; vẫn xem/nộp/nộp lại/history được khi được phép. |
| Đổi tab, refresh, quay lại từ Workspace | `section` được giữ; `teamId`/`workspaceId` không mất; tab mặc định và quyền đúng. |
| Dark mode, bàn phím, screen reader | Chữ và focus đủ tương phản; step/tab có nhãn và trạng thái được đọc rõ. |

Frontend hiện không có script test tự động riêng. Chạy `npm run build`, lint cho các file sửa, sau đó kiểm tra thủ công các luồng trên trong trình duyệt. Chỉ mở rộng kiểm thử tự động khi có phần logic có thể tách ra và rủi ro hồi quy cụ thể (ví dụ mapping lỗi sang bước hoặc query param của tab).
