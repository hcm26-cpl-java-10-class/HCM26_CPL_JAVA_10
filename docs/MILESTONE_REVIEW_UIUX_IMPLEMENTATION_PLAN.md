# Implement plan: tối ưu UI/UX trang Review milestone submission

## 1. Mục tiêu và phạm vi

Giảm cuộn trang khi Teacher/Mentor/Admin xem bằng chứng, chấm rubric, xác nhận checklist và đưa ra quyết định cho một bản nộp milestone. Người review phải biết mình đang chấm **version nào**, đã chấm bao nhiêu tiêu chí, còn lỗi gì và quyết định cuối sẽ tác động ra sao.

Màn chính là `/milestone-submissions/:submissionId/review` trong `SubmissionReviewPage.tsx` và `SubmissionReviewForm.tsx`. Hai điểm vào cần kiểm tra hồi quy là review queue `SubmissionListPage.tsx` và trang danh sách version theo team `TeamMilestoneSubmissionsPage.tsx`. Kế hoạch này không thay API, payload, nghiệp vụ chấm điểm, phân quyền hoặc lịch sử version bất biến. Nội dung UI tiếp tục bằng tiếng Anh theo module hiện tại.

## 2. Phân tích hiện trạng

| Vị trí | Vấn đề người dùng gặp phải | Bằng chứng trong code |
| --- | --- | --- |
| Header và submission information | Title/status, thông tin team/student/date/rubric trải thành hai vùng cao; thông tin quyết định quan trọng bị đẩy xuống. | `SubmissionReviewPage.tsx` render hero card, rồi một card lớn gồm metadata và artifact trước form. |
| Product evidence | Repository, deployment, release notes và attachments đều mở hết; release notes và danh sách file dài làm người review phải cuộn nhiều mới tới rubric. | `SubmissionReviewPage.tsx` render toàn bộ `item.product`, hoặc toàn bộ `currentVersion.artifacts` nếu không có product. |
| Rubric | Mỗi criterion là một card mở sẵn với rating select và textarea 3 dòng; số criterion tăng thì chiều dài trang tăng tuyến tính. | `SubmissionReviewForm.tsx` map toàn bộ `rubric.criteria`, render mọi textarea. |
| Checklist và quyết định | Checklist và overall feedback nằm sau toàn bộ rubric. Người review phải đi qua mọi criterion để biết còn điều kiện Accept/Request Changes nào. | `SubmissionReviewForm.tsx` đặt checklist và `overall-feedback` sau vòng lặp criterion. |
| Lịch sử | Review cũ được nối cuối trang; bản đầu tự mở, có thể gồm nhiều evaluation và feedback. | `ReviewHistory.tsx` dùng `<details open={index === 0}>`. |
| Lỗi nhập | Khi lỗi checklist hoặc overall feedback, code tìm `criterion-checklist`/`criterion-overallFeedback` không tồn tại nên không đưa người dùng tới đúng trường. Lỗi server mới hiển thị một phần ở criterion feedback. | `requestDecision()` lấy key lỗi đầu rồi luôn ghép thành `criterion-{key}`; form chỉ đọc `criteria[i].feedback`, `checklist`, `overallFeedback`, `decision`. |
| An toàn quyết định | Accept gửi ngay sau validation, còn Reject/Request Changes có confirm dialog. Nếu retry sau lỗi nhưng người dùng đổi payload, `retryKey.current` vẫn giữ key cũ. | `requestDecision("ACCEPT")` gọi `onReview` trực tiếp; `SubmissionReviewPage.tsx` chỉ reset key khi thành công. |
| Màn danh sách version | Có bảng bảy cột và dialog xem bản nộp rất dài trước khi tới nút Review; với một version hiện tại, đường vào review chưa đủ nổi bật. | `TeamMilestoneSubmissionsPage.tsx` dài gần 800 dòng, dialog hiển thị nhiều card liên tiếp. |

## 3. Bố cục đích

### 3.1. Một review workspace, ba giai đoạn

| Giai đoạn | Nội dung chính | Hành động |
| --- | --- | --- |
| 1. Submission | Header gọn: milestone, version, team/student, submitted at, status và late penalty. Evidence: repo/demo, release notes và attachments theo nhóm gọn. | **Start evaluation**. Nếu chỉ xem kết quả cũ, hiện thông báo read-only và đường đến History. |
| 2. Evaluate | Một criterion rubric đang chọn tại một thời điểm, navigator `1 / N`, rating, guidance và feedback; sau criterion cuối là Acceptance checklist. | **Previous / Next**, chọn trực tiếp criterion đã mở; cho phép quay lại Evidence mà không mất dữ liệu. |
| 3. Decision | Tóm tắt rating theo criterion, checklist, late penalty và overall feedback; chọn Accept / Request changes / Reject theo `availableActions`. | Mở xác nhận với quyết định và version, rồi mới gọi API. |

Không tạo ba route mới. Giai đoạn là state của cùng trang và cùng bản nộp. Chỉ render vùng nhập của giai đoạn hiện tại; giữ draft form trong một state keyed bằng `submissionId` và `currentVersion.id` để chuyển giai đoạn không làm mất rating, feedback hoặc checklist. Khi backend trả version mới, không dùng draft của version cũ cho version mới.

Desktop: vùng chính rộng khoảng 65–70% và một **evidence rail gọn** bên phải khi ở Evaluate/Decision. Rail chỉ hiện link repo/demo, số file, vài dòng release notes, version và nút **View all evidence**. Rail có thể sticky nhưng không tạo vùng cuộn lồng nhau. Toàn bộ evidence nằm trong dialog/drawer có chiều cao giới hạn và cuộn riêng khi người dùng chủ động mở. Mobile: một cột, nút **View evidence** luôn có ở Evaluate/Decision; mở drawer/dialog đủ rộng để đọc URL, notes và tệp.

Header luôn giữ version, trạng thái và cảnh báo late trong tầm nhìn trước khi chấm. Step indicator cho biết `Submission → Evaluate → Decision`; trên mobile dùng `Step n of 3`. Thanh hành động cố định ở đáy có Back/Next hoặc Submit review và không che trường cuối khi bàn phím mở. Không dùng nhiều màu nền: bề mặt trung tính, một accent xanh dịu cho điều hướng; badge trạng thái theo bảng màu đã dùng ở milestone (Submitted xanh, Changes requested cam, Accepted xanh lá, Rejected đỏ), late có nhãn và màu amber.

### 3.2. Evidence

- Ưu tiên thông tin phục vụ chấm: repo/deployment là link rõ tên và có icon mở tab mới; file có tên, loại, dung lượng. URL dài tự ngắt dòng, không gây tràn ngang.
- Release notes chỉ hiện đoạn đầu trong summary và có **Read full notes**; không cắt nội dung mà không có cách xem đủ.
- Hỗ trợ cả `item.product` lẫn `item.currentVersion.artifacts`; khi không có bằng chứng, hiện trạng thái trống rõ ràng. Không lặp metadata version/submitted at trong từng card.
- Checklist self-attestation của student là dữ liệu tham khảo; reviewer checklist là đánh giá riêng. Không tự coi tick của student là tick của reviewer.

### 3.3. Rubric và checklist

- Navigator hiện danh sách tên criterion ngắn, trạng thái `Not rated / Rated / Needs feedback / Error`. Chỉ criterion được chọn mới mở rating, mô tả và textarea. Cho phép nhảy tới bất kỳ criterion nào; trước khi qua Decision chỉ yêu cầu các rating bắt buộc, còn feedback/checklist được kiểm theo decision đã chọn.
- Rating select chỉ hiện level và percentage ngắn; guidance của lựa chọn hiện ngay dưới select. Feedback textarea mở đúng criterion đang chấm, giữ giới hạn 500 ký tự. Không tự tính/hiển thị final score nếu công thức backend và quy tắc làm tròn chưa được dùng chung.
- Acceptance checklist là mục cuối của Evaluate với count `x/y` và Required rõ ràng. Khi chọn một decision, kiểm tra các điều kiện tương ứng rồi trả về criterion, checklist hoặc overall feedback đầu tiên còn thiếu. Khi Accept, mọi item Required phải được reviewer tick; việc checklist chưa đủ không chặn người dùng xem Decision nếu họ muốn Request Changes hoặc Reject.
- Không ép mọi feedback khi mới vào màn. Điều kiện validation theo quyết định: mọi decision cần rating; Reject/Request Changes cần feedback từng criterion; Request Changes cần overall feedback; Accept cần mọi checklist Required. Giữ backend là nguồn xác thực cuối cùng.

### 3.4. Decision, lỗi và an toàn dữ liệu

- Decision summary cho reviewer đọc lại từng criterion đã chọn, số checklist checked/required, late penalty đã lưu, overall feedback và version sẽ review. Accept, Reject và Request Changes đều qua **một bước xác nhận cuối**; nút xác nhận ghi rõ hành động. Confirm dialog không thay đổi payload.
- Chỉ hiển thị decision được `availableActions` cho phép. Nếu Request Changes bị khóa vì late window, giải thích ngay cạnh action; đừng để người dùng đi hết form mới thấy alert ở cuối trang. Với `teamId == null` hoặc status khác `SUBMITTED`, hiện chế độ xem và History, không render action giả.
- Có error summary ở đầu vùng đang làm, nêu trường lỗi và nút nhảy đến đúng criterion/checklist/overall feedback. Focus vào control sau khi vùng đó đã render. Map cả lỗi local và API (`criteria[i].ratingLevel`, `criteria[i].feedback`, `checklist`, `overallFeedback`, `decision`, version conflict). Không xây ID `criterion-*` cho field không phải criterion.
- Khi request lỗi mạng không chắc chắn, retry cùng `Idempotency-Key` **chỉ khi payload không đổi**. Nếu người dùng sửa rating/feedback/checklist/decision sau lỗi, tạo key mới. Nếu backend trả conflict/version mới, giữ nội dung đang nhập trong màn hình nhưng chặn gửi lại cho tới khi người dùng tải bản mới và xác nhận xử lý draft cũ.
- Nếu có thay đổi chưa gửi, Back/đổi route/browser unload cần cảnh báo mất nội dung. Không tự lưu nhận xét vào `localStorage` vì đây là dữ liệu đánh giá; draft chỉ giữ trong bộ nhớ của phiên xem.

## 4. History và đường vào review

- Chuyển `ReviewHistory` sang tab hoặc disclosure riêng, mặc định đóng khi đang chấm. Mỗi version có decision, reviewer, thời điểm và final score trong hàng tóm tắt; mở một version mới xem evaluation và feedback. Lịch sử bất biến, không hiển thị như form có thể sửa.
- Từ `SubmissionListPage` giữ bucket/filter hiện có và `returnTo`. Từ `TeamMilestoneSubmissionsPage`, bản mới nhất có action **Review latest submission** rõ nhãn; version cũ chỉ mở chi tiết đọc. Dialog xem version dài có thể thay bằng preview ngắn và link **Open full review**; không nhét thêm rubric form vào dialog.
- Sau review thành công, chuyển sang trạng thái read-only của cùng submission hoặc về queue theo điều hướng có chủ đích; cập nhật cache queue/team/workspace như hiện tại. Không để nút Submit review còn hoạt động với version đã xử lý.

## 5. File và thứ tự triển khai

| Giai đoạn | Việc cần làm | File chính |
| --- | --- | --- |
| 1. Cấu trúc | Tách header/evidence summary; ba giai đoạn và responsive layout; giữ draft khi đổi giai đoạn. | `pages/SubmissionReviewPage.tsx`, component evidence mới nếu cần |
| 2. Chấm điểm | Navigator một criterion, checklist gọn, progress, validation theo decision. | `components/SubmissionReviewForm.tsx`, helper validation/focus mới nếu cần |
| 3. Quyết định | Decision summary, confirm thống nhất, mapping lỗi API, retry key theo payload và conflict. | `SubmissionReviewForm.tsx`, `SubmissionReviewPage.tsx` |
| 4. Lịch sử và đường vào | History tách khỏi vùng chấm; action review bản mới nhất rõ hơn, giữ `returnTo`. | `components/ReviewHistory.tsx`, `pages/SubmissionListPage.tsx`, `pages/TeamMilestoneSubmissionsPage.tsx` |
| 5. Hoàn thiện | Màu trạng thái, dark mode, mobile, bàn phím, kiểm thử hồi quy. | `components/SubmissionStatusBadge.tsx` và các file trên |

Không cần thay backend hoặc migration. Chỉ bổ sung API nếu lúc triển khai phát hiện evidence/version thiếu dữ liệu cần thiết trong `SubmissionDetail`; trước tiên dùng các field `product`, `currentVersion`, `rubric`, `reviews`, `availableActions` hiện có.

## 6. Nghiệm thu

| Tình huống | Kết quả mong đợi |
| --- | --- |
| Bài nộp có nhiều criterion, release notes dài và nhiều file | Màn mở đầu vẫn gọn; Evaluate chỉ mở một criterion; toàn bộ evidence vẫn xem được bằng một thao tác. Không tràn ngang ở 360–390 px. |
| Đổi giai đoạn/criterion rồi quay lại | Rating, feedback, checklist và overall feedback không mất. |
| Bấm Decision khi thiếu rating, feedback hoặc checklist Required | Đưa tới đúng criterion/checklist, focus đúng control, có lỗi cạnh trường và summary. |
| Chọn Accept | Không POST khi mới chọn; dialog xác nhận nêu đúng version/decision; confirm mới gửi một lần. |
| Chọn Reject/Request Changes | Giữ đúng điều kiện feedback và `availableActions`; dialog nêu tác động tương ứng; không cho Request Changes khi late window đóng. |
| Lỗi 422/409/mất kết nối | Có đường sửa/reload/retry rõ; không gửi payload mới với idempotency key cũ; draft không mất do lỗi mạng. |
| Team-only/master hoặc submission đã review | Read-only rõ ràng, không hiện nút quyết định; History vẫn đọc được nếu có quyền. |
| Review từ queue hoặc Team submissions | Quay lại đúng danh sách/bộ lọc; version cũ không dẫn tới review có thể sửa. |
| Dark mode, bàn phím, screen reader | Nhãn trạng thái không chỉ dựa vào màu; focus theo bước và lỗi; dialog trả focus về đúng nút mở. |

Chạy `npm run build`, lint các file sửa và kiểm tra thủ công trên trình duyệt ở desktop/mobile. Nếu tách validation/retry thành helper thuần, thêm test cho ba decision, lỗi checklist/overall feedback và payload đổi sau retry; các test này kiểm tra rủi ro nghiệp vụ thay vì chỉ lặp lại JSX.
