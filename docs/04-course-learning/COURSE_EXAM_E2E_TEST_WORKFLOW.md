# Workflow kiểm thử E2E Course – Exam (FE + BE)

Hướng dẫn này dành cho thành viên tự kiểm thử luồng từ tạo khóa học, liên kết bài thi, học viên làm bài, giảng viên công bố kết quả đến điểm tổng kết khóa học. Thực hiện trên môi trường local/test với dữ liệu riêng; không dùng production.

Đặc tả nghiệp vụ liên quan: [Course Management ↔ Assessment Management](../03-exam-assessment/course-assessment-integration-v1.md). Tài liệu này tập trung vào một luồng E2E có thể lặp lại và cách ghi nhận kết quả trên cả giao diện lẫn API.

## 1. Kết quả cần xác minh

- Bài Quiz/Exam được tạo hoặc liên kết đúng Course, Section và Lesson; Course hiển thị đúng bài thi và trọng số.
- Kế hoạch đánh giá chỉ sẵn sàng khi tổng trọng số là 100%, bài có trạng thái active và có câu hỏi active; mỗi assessment lesson active có bài đánh giá phù hợp.
- Học viên chỉ làm bài theo điều kiện truy cập của khóa học. Kết quả chưa chấm hoặc chưa công bố chưa được tính vào điểm cuối khóa.
- Điểm tổng kết được tính đúng và hiển thị nhất quán ở trang học viên và trang kết quả của giảng viên.
- Course chỉ đủ điều kiện hoàn thành/chứng chỉ khi học viên hoàn thành các lesson active và đạt yêu cầu điểm khóa học.

## 2. Chuẩn bị môi trường

### Chạy ứng dụng

Yêu cầu JDK 21 và Node.js 20 trở lên. Mở hai terminal tại thư mục repo:

```powershell
# Terminal 1 — backend
cd backend
.\mvnw.cmd spring-boot:run
```

```powershell
# Terminal 2 — frontend
cd frontend
npm install
npm run dev
```

Đợi backend báo ứng dụng đã khởi động, sau đó mở `http://localhost:5173`. Backend mặc định chạy ở `http://localhost:8080`; API mặc định của frontend là `http://localhost:8080/api`. Nếu dự án đang dùng cấu hình khác, ghi lại URL thực tế trong kết quả test.

### Tài khoản và dữ liệu

Tài khoản demo phụ thuộc dữ liệu seed trên máy. Bộ tài khoản thường dùng:

| Vai trò | Tài khoản tham khảo |
|---|---|
| Admin | `admin@example.com` / `password123` |
| Giảng viên | `teacher@example.com` / `password123` |
| Học viên | `student01@example.com` / `Student123!` |

Xác nhận tài khoản đăng nhập được trước khi test; không ghi mật khẩu, token hoặc cookie vào evidence. Dùng hai profile trình duyệt riêng cho giảng viên và học viên để không dùng chung session.

Tạo hoặc chọn fixture riêng gồm:

- Một Course có thể chỉnh sửa/xuất bản, một Section active.
- Một lesson nội dung thường đứng trước bài đánh giá; một Quiz lesson; một Exam lesson. Đảm bảo thứ tự lesson dùng được để kiểm tra prerequisite.
- Một Quiz active có ít nhất một câu hỏi active và một Exam active có ít nhất một câu hỏi active.
- Một học viên đã ghi danh Course. Nếu kiểm tra truy cập trái phép, chuẩn bị thêm một tài khoản chưa ghi danh.

Tránh tái sử dụng enrollment đã hoàn thành: tiến độ lesson và attempt có thể được lưu lại, và UI hiện không nhất thiết hỗ trợ hoàn tác. Không reset trực tiếp database hoặc sửa dữ liệu production để làm lại test.

## 3. Luồng kiểm thử chính trên giao diện

### A. Giảng viên tạo Course và liên kết assessment

1. Đăng nhập bằng giảng viên sở hữu Course (hoặc admin), mở trang quản lý Course và tạo/chọn Course test.
2. Tạo Section active, lesson nội dung thường, Quiz lesson và Exam lesson. Có thể đặt tên dễ nhận biết, ví dụ `E2E Course`, `Intro`, `Quiz lesson`, `Exam lesson`.
3. Từ Course/Curriculum Mapping, dùng thao tác tạo hoặc thêm assessment cho từng assessment lesson. Với luồng tạo mới từ Course, hoàn tất form assessment và thêm câu hỏi; không tạo một assessment riêng rồi bỏ quên liên kết lesson.
4. Mở cấu hình assessment và đặt trọng số Quiz là **20%**, Exam là **80%**. Đảm bảo cả hai active, có câu hỏi active, và Exam lesson dùng category phù hợp (Midterm hoặc Final Test).
5. Trở lại Course Details hoặc Curriculum Mapping, làm mới phần **Assessments and course grading**. Đối chiếu tên, vị trí lesson, category, trọng số và tổng trọng số.
6. Xác nhận kế hoạch báo `Ready` khi tổng là 100% và không có vấn đề. Trong một lần kiểm tra riêng, thử tổng dưới/trên 100% hoặc một bài thiếu câu hỏi active; kế hoạch phải báo vấn đề tương ứng và không cho bắt đầu assessment/course theo chính sách hiện hành.
7. Xuất bản Course nếu đang ở trạng thái draft. Xác nhận validator không bỏ qua lỗi của assessment plan.

**Kỳ vọng:** assessment xuất hiện đúng vị trí trong Course; trọng số hiển thị đúng; hai bài có tổng 100%; plan hợp lệ chỉ khi đủ điều kiện. Nếu tạo assessment từ Course thất bại giữa chừng, kiểm tra không có dữ liệu Course/assessment bị tạo dở không nhất quán.

### B. Học viên truy cập và làm bài

1. Đăng nhập bằng học viên đã ghi danh. Mở Course Details, kiểm tra assessment được hiển thị cùng category/trọng số/thời lượng phù hợp; nội dung câu hỏi và đáp án không xuất hiện trước khi được phép làm bài.
2. Vào Course learning. Khi lesson nội dung thường chưa hoàn thành, xác nhận Quiz lesson bị chặn theo prerequisite. Thử mở assessment bằng UI và ghi nhận thông báo/điều hướng.
3. Hoàn thành lesson nội dung thường. Mở lại Course learning và xác nhận Quiz có thể truy cập theo luồng học hiện tại. Không đánh dấu Quiz lesson hoàn thành thủ công nếu assessment chưa được chấm và công bố.
4. Bắt đầu Quiz, hoàn tất và nộp bài. Ghi lại attempt ID nếu UI hiển thị. Việc bắt đầu bài có thể tiêu thụ lượt thi; chỉ thực hiện một lần cho mỗi fixture.
5. Thực hiện tương tự với Exam khi đã thỏa prerequisite. Nếu cần kiểm tra Exam bị chặn trước đó, làm điều đó trước khi bắt đầu attempt hợp lệ.

**Kỳ vọng:** Course learning phản ánh đúng tiến độ; assessment bị chặn khi prerequisite chưa đủ và có thể mở khi đủ điều kiện; câu hỏi/attempt thuộc đúng học viên và assessment.

### C. Giảng viên chấm, công bố và đối chiếu điểm

1. Quay lại profile giảng viên, mở kết quả/attempt của Quiz. Chấm hoàn tất nếu bài có phần chấm thủ công, sau đó công bố kết quả theo thao tác của giao diện.
2. Lặp lại với Exam. Nếu có câu tự luận cần chấm thủ công, không coi attempt pending review là kết quả cuối.
3. Trong khi còn thiếu một kết quả hoặc kết quả chưa publish, mở trang học viên/My Scores và trang **View learner grades** của Course.
4. Sau khi cả hai kết quả đã được chấm và công bố, dùng Refresh trên panel điểm Course. Đối chiếu điểm ở My Scores, course grade details và trang kết quả giảng viên.

**Kỳ vọng tính điểm mẫu:** nếu Quiz đạt `10/10` và có trọng số 20%, Exam đạt `50/100` và có trọng số 80%, điểm cuối khóa là:

`(10 / 10 × 10 × 20%) + (50 / 100 × 10 × 80%) = 6.00/10`

Trước khi mọi assessment có trọng số dương đều có kết quả cuối đã công bố, điểm cuối khóa không được hiển thị như điểm hoàn chỉnh hoặc trạng thái Passed/Failed. Sau khi đủ kết quả, điểm hiển thị phải là `6.00/10` và đạt ngưỡng khóa học hiện hành là `5.00/10`.

### D. Hoàn tất Course và chứng chỉ

1. Xác nhận assessment lesson hoàn thành sau khi bài tương ứng được chấm đầy đủ và kết quả được công bố.
2. Hoàn thành mọi lesson active còn lại trong Course.
3. Kiểm tra trạng thái Course completed và chứng chỉ ở trang Course/enrollment của học viên.
4. Nếu chạy biến thể điểm dưới 5.00/10, không kỳ vọng chứng chỉ đủ điều kiện. Nếu thu hồi/ẩn một kết quả đang được tính, xác nhận eligibility được cập nhật theo trạng thái kết quả mới.

## 4. Kiểm tra backend bổ sung

UI test không thay thế kiểm tra authorization/backend. Dùng Postman hoặc API client trên local/test, đăng nhập với đúng vai trò và gọi endpoint với token tương ứng. Không dán token vào tài liệu, screenshot hoặc log chia sẻ.

| Mục đích | Request | Kỳ vọng cần đối chiếu |
|---|---|---|
| Đọc kế hoạch đánh giá | `GET /api/courses/{courseId}/assessment-plan` | Tổng trọng số, readiness và các issue tương ứng với cấu hình UI. |
| Đọc điểm học viên | `GET /api/courses/{courseId}/assessment-results` | Chỉ instructor/admin được phép; trạng thái điểm phù hợp với kết quả đã chấm/công bố. |
| Xem bài của Course | `GET /api/courses/{courseId}/exams` | Cần quyền truy cập Course; không trả câu hỏi/đáp án cho catalog/listing. |
| Xem tiến độ của học viên hiện tại | API learning progress hiện dùng bởi UI | Chỉ trả tiến độ của chính learner; đối chiếu lesson và trạng thái khóa/mở với UI. |
| Bắt đầu/tiếp tục assessment | `POST /api/exams/{examId}/attempt` | Yêu cầu quyền `EXAM_TAKE`; chỉ bắt đầu khi enrollment, prerequisite, plan và trạng thái bài cho phép. |

Để kiểm tra learner chưa ghi danh, gọi `GET /api/courses/{courseId}/exams` và thử bắt đầu attempt bằng token learner chưa ghi danh. Backend phải từ chối theo quyền/trạng thái truy cập; việc nút bị ẩn trên UI chưa đủ để kết luận PASS. Không gửi request tạo attempt nhiều lần vì có thể tạo attempt hoặc tiêu thụ lượt thi.

Các API lập kế hoạch/kết quả course yêu cầu course access phù hợp (instructor/admin) và quyền như `COURSE_UPDATE`, `EXAM_READ` hoặc `COURSE_REPORT_READ` theo endpoint. Nếu API trả `401/403`, trước hết xác nhận token, vai trò, permission và quyền sở hữu/được gán Course; không ghi đó là lỗi nghiệp vụ nếu dùng sai tài khoản.

## 5. Checklist và ghi nhận kết quả

Đánh dấu `PASS`, `FAIL`, `BLOCKED` hoặc `NOT RUN`. Chỉ ghi `PASS` sau khi quan sát kết quả thực tế; nếu thiếu fixture, quyền hoặc dữ liệu, ghi `BLOCKED` kèm lý do.

| ID | Kiểm tra | PASS khi |
|---|---|---|
| E2E-01 | Tạo/link Quiz và Exam từ Course | Assessment được lưu và hiện tại đúng Course/Section/Lesson. |
| E2E-02 | Trọng số và plan | Quiz 20% + Exam 80% hiển thị đúng; plan `Ready`; biến thể không hợp lệ có issue. |
| E2E-03 | Phát hành Course | Course chỉ publish được khi các kiểm tra publish và assessment plan đều hợp lệ. |
| E2E-04 | Quyền truy cập learner | Learner đã ghi danh và đủ prerequisite mới làm được bài; learner chưa ghi danh bị backend từ chối. |
| E2E-05 | Chấm và công bố kết quả | Pending/chưa publish chưa được tính là kết quả cuối; published result xuất hiện ở đúng learner. |
| E2E-06 | Tính điểm và parity | Ví dụ 10/10, 50/100 cho ra 6.00/10; My Scores và trang giảng viên khớp nhau. |
| E2E-07 | Hoàn thành/chứng chỉ | Đủ lesson active và đạt điểm thì eligible; điểm dưới ngưỡng không eligible. |
| E2E-08 | Quyền và dữ liệu nhạy cảm | API kết quả chỉ cho role phù hợp; câu hỏi/đáp án không lộ ở catalog/listing. |

| Thông tin chạy test | Giá trị |
|---|---|
| Người kiểm thử / ngày giờ | |
| Branch / commit | |
| Frontend URL / API base | |
| Vai trò và tài khoản test (không ghi mật khẩu/token) | |
| Course ID / Enrollment ID | |
| Quiz ID / Exam ID / attempt ID | |
| E2E-01 … E2E-08 | |
| Evidence (ảnh đã che thông tin nhạy cảm / response đã ẩn token) | |

Khi báo `FAIL`, ghi rõ bước tái hiện, trạng thái Course/enrollment, URL hoặc endpoint, kết quả mong đợi/thực tế và screenshot/response đã loại bỏ token, cookie, email/số điện thoại cá nhân. Ghi chú mọi thay đổi cấu hình hoặc attempt đã tạo để người khác tránh chạy lặp trên cùng fixture.

## 6. Xử lý sự cố nhanh

- **Không đăng nhập được:** xác nhận backend đang chạy, seed user hiện có và dùng đúng mật khẩu từ cấu hình môi trường; tài khoản demo có thể khác giữa các database.
- **Không thấy Course hoặc không thao tác được:** xác nhận trạng thái Course, instructor được gán, role/permission và enrollment của tài khoản đang kiểm tra.
- **Plan chưa Ready:** kiểm tra tổng trọng số đúng 100%, các assessment trọng số dương đang active/có câu hỏi active, và assessment lesson active đã được liên kết đúng category.
- **Điểm chưa xuất hiện:** xác nhận attempt đã chấm hoàn tất và kết quả đã được publish; sau đó Refresh panel Course.
- **API trả lỗi nhưng UI dùng được (hoặc ngược lại):** xác nhận môi trường/port/token giống nhau; so sánh request thực tế trong Network tab với API base ghi ở đầu phiếu test.

Không xóa database để “làm sạch” nếu chưa xác nhận database là bản test riêng và không chứa dữ liệu cần giữ. Ưu tiên tạo Course/enrollment/assessment mới cho mỗi lượt kiểm thử.
