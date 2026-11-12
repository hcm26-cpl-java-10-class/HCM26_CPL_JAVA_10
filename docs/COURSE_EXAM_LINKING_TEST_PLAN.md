# Hướng dẫn tự kiểm thử liên kết Course – Quiz – Exam (UI-first)

Tài liệu này hướng dẫn kiểm thử thủ công theo thao tác trên giao diện, từ chuẩn bị dữ liệu, gắn exam đến đăng nhập student và xác minh khóa/mở. Các test case bên dưới **chưa được chạy thủ công**; cập nhật trạng thái và bằng chứng sau khi thực hiện.

> **Phân biệt phạm vi:** CE-01–06 và CE-11–14, CE-16 kiểm thử được trên giao diện nếu đã có fixture phù hợp. CE-07–10 cần Postman/API client; CE-15 cần chế độ staff preview hiện có. Chỉ nhìn thấy exam bị khóa trên UI **không** đủ để kết luận backend enforcement PASS.

## 1. Phạm vi

- Giáo viên/admin gắn Quiz vào Lesson để mở ngay sau khi hoàn thành lesson; có thể gắn assessment vào Section cho bài kiểm tra module.
- Giáo viên/admin gắn Final Test trực tiếp vào Course.
- Học viên đã ghi danh xem bài thi trong trang học course.
- Quiz gắn Lesson chỉ mở khi lesson đó hoàn thành; assessment gắn Section mở khi hoàn thành các lesson đang hoạt động trong Section.
- Final chỉ mở khi hoàn thành các lesson đang hoạt động trong toàn Course.
- Backend từ chối bắt đầu bài đang khóa hoặc bài course-assessment của học viên chưa ghi danh.
- Không làm thay đổi hành vi exam gắn trực tiếp với lesson/Section khác.

## 2. Chuẩn bị môi trường và dữ liệu

### Môi trường

1. Dùng môi trường local/test, **không chạy các bước làm thay đổi dữ liệu trên production**.
2. Khởi động backend và frontend theo hướng dẫn trong README của project.
3. Dùng tài khoản teacher/admin và student có quyền tương ứng. README có tài khoản demo `teacher@example.com` hoặc `admin@example.com` với mật khẩu mặc định `password123`; tài khoản student demo thường là `student@example.com` / `password123`. Các tài khoản có thể khác theo database, hãy xác nhận trên môi trường đang test trước khi dùng.
4. Mở hai profile/cửa sổ trình duyệt riêng: một đăng nhập teacher/admin, một đăng nhập student. Không chỉ mở tab mới vì tab mới thường dùng chung session.
5. Đăng nhập thành công và giữ URL frontend (thường là `http://localhost:5173`). Khi chụp evidence, che email cá nhân/token/cookie.

### Dữ liệu cần có

Tạo mới hoặc chọn dữ liệu test dùng riêng:

- Một Course đang hoạt động, có ít nhất hai Section đang hoạt động:
  - **Module A:** hai lesson đang hoạt động (A1, A2).
  - **Module B:** một lesson đang hoạt động (B1).
- Ba exam đang hoạt động, mỗi exam có ít nhất một câu hỏi đang hoạt động:
  - `QUIZ_LESSON_A1`: category `QUIZ`, gắn với lesson A1.
  - `QUIZ_LESSON_B1`: category `QUIZ`, gắn với lesson B1.
  - `FINAL_COURSE`: category `FINAL_TEST`, gắn trực tiếp với Course, không gắn Section/lesson.
- Một học viên student đã ghi danh Course.
- Nếu kiểm tra không ghi danh: thêm/chọn một student khác không ghi danh Course.

> **Quan trọng:** Chỉ dùng dữ liệu test. Nút `Mark lesson complete` cập nhật tiến độ thật của enrollment và màn hình hiện không có nút hoàn tác hoàn thành; nên dùng enrollment/student riêng cho mỗi lượt chạy từ đầu. Bấm bắt đầu exam có thể tạo attempt và tiêu thụ số lượt thi; chỉ bấm khi test case yêu cầu.

## 3. Thao tác tự kiểm thử trên giao diện

### 3.1. Kiểm tra fixture trước khi chạy

1. Ở cửa sổ teacher/admin, mở `/exams` và tìm ba exam theo title. Xác nhận chúng đang active; mỗi exam phải có ít nhất một câu hỏi active để có thể vào luồng làm bài.
2. Ở `/exams/curriculum`, chọn Course test. Danh sách lessons mở sẵn bên trong từng Section; kiểm tra số lesson và ghi lại title. Dùng dữ liệu tương ứng Module A có A1/A2 và Module B có B1.
3. Xác nhận student test đã ghi danh Course: ở cửa sổ student mở `/enrollments`; Course phải hiện thành một thẻ có nút `Continue learning`. Nếu không có thẻ này, dừng test dành cho enrolled student và chuẩn bị enrollment test hợp lệ trước.
4. Ghi lại course name, section/lesson title, exam title và enrollment ID vào bảng ghi nhận kết quả ở cuối tài liệu. Không cần ghi password/token.

Nếu thiếu Course/Section/lesson/exam/question/enrollment cần thiết, trạng thái test liên quan là `BLOCKED` cho đến khi có fixture phù hợp. Hướng dẫn này không giả định project có nút tạo enrollment hoặc dữ liệu seed cụ thể trên mọi môi trường.

### 3.2. Gắn Quiz sau từng Lesson bằng UI

1. Đăng nhập teacher/admin có quyền `EXAM_UPDATE`, mở `/exams/curriculum`.
2. Tìm thẻ Course theo tên/mã rồi click thẻ. Header phía trên phải hiện tên Course.
3. Mở danh sách Lesson của Module A. Tại đúng dòng A1, bấm `Add quiz`.
4. Trong cửa sổ `Add Quiz to Lesson`, tìm `QUIZ_LESSON_A1`, chọn đúng exam rồi bấm `Add Quiz`. Chỉ exam category `QUIZ` được liệt kê.
5. Xác nhận exam xuất hiện ngay trên dòng A1 và có ghi chú `Quiz unlocks after this lesson is completed`.
6. Lặp lại trên B1 với `QUIZ_LESSON_B1`. Quiz gắn vào lesson sẽ mở sau khi student hoàn tất lesson đó; không chọn `Add section assessment` nếu muốn quiz mở ngay sau một lesson.

### 3.3. Gắn Final ở cuối Course bằng UI

1. Cuộn xuống cuối danh sách các Section đến khung `Final exam`.
2. Bấm `Add final exam`. Cửa sổ chỉ liệt kê exam category `FINAL_TEST`.
3. Tìm `FINAL_COURSE`, chọn đúng exam rồi bấm `Add Final Exam`. Xác nhận exam xuất hiện trong khung cuối Course.

Nếu chưa có quiz/final phù hợp, bấm `Go to Assessments` trong cửa sổ chọn để mở trang quản lý exam ở tab mới, tạo exam đúng category, thêm câu hỏi active, rồi quay lại mapping và chọn lại.

Các assessment gắn ở cấp Section vẫn dùng nút `Add section assessment`; chúng chỉ mở theo điều kiện hoàn thành các lesson của cả Section. Dùng chức năng này cho bài kiểm tra cuối module, không phải quiz sau một lesson riêng.

### 3.4. Mở trang học và kiểm tra trạng thái khóa/mở

1. Ở cửa sổ student mở `/enrollments`, tìm thẻ Course test rồi bấm `Continue learning`. URL sẽ có dạng `/enrollments/{id}/learn`.
2. Quan sát sidebar bên trái: `Course progress`, phần trăm và số lesson hoàn thành; các Section cùng lesson nằm bên dưới. Quiz gắn Lesson xuất hiện ngay dưới lesson tương ứng; quiz gắn Section nằm cuối Section; Final course-level hiển thị ở phần cuối `Final exam`.
3. Khi exam đang khóa, kiểm tra icon khóa và dòng lock reason. Không bấm exam đang khóa để chứng minh backend enforcement; dùng CE-07/08/10 nếu cần kiểm tra request trực tiếp.
4. Chọn một lesson chưa hoàn thành trong sidebar. Ở nội dung lesson, bấm `Mark lesson complete`. Chờ toast `Progress updated.` và kiểm tra lesson có dấu hoàn thành, tiến độ tăng, trạng thái exam được cập nhật.
5. Làm lần lượt A1 rồi A2; để B1 chưa hoàn thành để kiểm tra điều kiện từng Section và Final. Sau khi xác minh, hoàn thành B1 để kiểm tra Final.
6. Khi exam được mở, click hàng exam ở sidebar để đi vào trang làm bài; exam gắn trực tiếp lesson có nút `Start exam` trong nội dung lesson. Việc mở bài có thể tạo attempt; không gửi/nộp bài nếu không nằm trong scope test.

**Không reset bằng cách bỏ đánh dấu:** UI hiện chỉ có thao tác đánh dấu hoàn thành, không có thao tác chuyển lesson về chưa hoàn thành. Muốn chạy lại từ trạng thái khóa, dùng enrollment/student test mới hoặc khôi phục fixture bằng cách được project cho phép; không sửa trực tiếp dữ liệu production.

### 3.5. Ghi nhận kết quả test UI

Với mỗi test case, ghi `PASS` chỉ khi đã quan sát đúng kết quả trên UI. Evidence tối thiểu: tên Course, tên exam/lesson, trạng thái trên trang học và ảnh chụp đã che thông tin nhạy cảm. Nếu lỗi, ghi chính xác URL, thao tác cuối cùng, thông báo lỗi và screenshot. Không đưa password, token hoặc cookie vào evidence.

## 4. Kiểm tra backend bổ sung (không phải UI-only)

Các request sau dành cho Postman/API client trong môi trường local/test, đăng nhập bằng token của đúng vai trò. Không dùng token teacher/admin để kết luận hành vi của student. Mỗi request bắt đầu exam có khả năng tạo attempt; request bị từ chối không được tạo attempt mới.

Đặt `{API_BASE}` là backend origin, ví dụ `http://localhost:8080`; thay `{COURSE_ID}`, `{EXAM_ID}`, `{SECTION_ID}` bằng ID fixture đã ghi nhận. Nếu cần lấy token trong Postman, gửi `POST {API_BASE}/api/auth/login` với body JSON gồm email/password của student test, rồi dùng `accessToken` trả về để cấu hình xác thực cho các request bên dưới. Thêm header `Accept: application/json`. Không lưu thông tin xác thực vào tài liệu hoặc evidence.

```http
PUT {API_BASE}/api/courses/{COURSE_ID}/exams/{EXAM_ID}/link?sectionId={SECTION_ID}
```

Gắn Final trực tiếp với Course bằng request không có `sectionId`/`lessonId`:

```http
PUT {API_BASE}/api/courses/{COURSE_ID}/exams/{FINAL_EXAM_ID}/link
```

Kiểm tra liên kết:

```http
GET {API_BASE}/api/courses/{COURSE_ID}/exams
```

Trong kết quả, đối chiếu `id`, `category`, `courseId`, `sectionId`, `lessonId`, `locked`, `lockReason`. Student không cần và không nên nhận dữ liệu câu hỏi/đáp án từ endpoint này.

## 5. Test case

Ghi kết quả cho từng test case bằng một trong các trạng thái: `PASS`, `FAIL`, `BLOCKED`, `NOT RUN`.

| ID | Ưu tiên | Kịch bản | Các bước | Kết quả mong đợi | Trạng thái / bằng chứng |
|---|---|---|---|---|---|
| CE-01 | P1 | Student đã ghi danh mở đúng trang học | Theo 3.4: `/enrollments` → Course test → `Continue learning`. | Mở đúng Course; sidebar hiển thị Section/lesson, `Course progress` và tiến độ. | NOT RUN — URL/screenshot |
| CE-02 | P1 | Exam gắn đúng chỗ | Teacher: theo 3.2 kiểm tra Quiz trên đúng lesson A1/B1; theo 3.3 kiểm tra Final trong khung cuối Course. | Quiz xuất hiện dưới đúng lesson; Final là course-level, không có Section/Lesson. | NOT RUN — screenshot hai màn hình |
| CE-03 | P1 | Quiz và Final hiển thị khi chưa hoàn thành lesson | Dùng enrollment chưa hoàn thành lesson; theo 3.4 kiểm tra sidebar. | Quiz A nằm ngay dưới A1, Quiz B dưới B1, Final trong `Final exam`; các bài đều có icon khóa và lock reason. | NOT RUN — screenshot |
| CE-04 | P1 | Quiz chỉ mở sau khi hoàn thành lesson gắn với nó | Student: giữ A1 chưa hoàn thành và kiểm tra Quiz A; sau đó bấm `Mark lesson complete` cho A1. | Quiz A khóa trước khi A1 hoàn tất và mở sau đó; Quiz B vẫn khóa khi B1 chưa hoàn thành; Final vẫn khóa. | NOT RUN — screenshots trước/sau + progress |
| CE-05 | P1 | Final chờ toàn bộ course dù quiz lesson đã mở | Hoàn thành A1, A2 nhưng để B1 chưa hoàn thành. | Quiz A mở; Quiz B và Final vẫn khóa vì B1 chưa hoàn thành. | NOT RUN — screenshot |
| CE-06 | P1 | Final chỉ mở sau khi hoàn thành toàn Course | Hoàn thành B1, đợi tiến độ/exam cập nhật; kiểm tra sidebar. | Quiz B và Final mở. Click exam chỉ để xác nhận điều hướng vào luồng làm bài; lưu ý thao tác có thể tạo attempt. | NOT RUN — screenshot; attempt ID nếu đã bắt đầu |
| CE-07 | P1 | Backend chặn bắt đầu Quiz đang khóa | Trước khi hoàn thành A1, gửi request bắt đầu `QUIZ_LESSON_A1` bằng student đã ghi danh: `POST /api/exams/{QUIZ_LESSON_A1_ID}/attempt`. | Request bị từ chối (thông thường HTTP 403) và không tạo attempt mới. Response không được báo thành công. | NOT RUN — lưu status/response đã che thông tin nhạy cảm |
| CE-08 | P1 | Backend chặn bắt đầu Final khi Course chưa hoàn tất | Chỉ hoàn thành một phần lesson; gửi `POST /api/exams/{FINAL_COURSE_ID}/attempt` bằng student đã ghi danh. | Request bị từ chối (thông thường HTTP 403); không tạo attempt. Sau khi hoàn tất toàn Course, request hợp lệ đi vào luồng bắt đầu exam. | NOT RUN — lưu status/response và trạng thái attempt |
| CE-09 | P1 | Student chưa ghi danh không xem/dự thi exam của Course | Đăng nhập student chưa ghi danh; gọi `GET /api/courses/{COURSE_ID}/exams`, sau đó thử `POST /api/exams/{FINAL_COURSE_ID}/attempt`. | Backend từ chối truy cập; không trả danh sách exam của Course và không tạo attempt. | NOT RUN — lưu status/response |
| CE-10 | P1 | Exam khóa không bị bỏ qua khi gọi API trực tiếp | Dùng student đã ghi danh, giữ tiến độ chưa đủ; gọi trực tiếp endpoint bắt đầu cho Quiz/Final thay vì bấm trên UI. | Backend vẫn từ chối; ẩn/khóa nút ở UI không phải là lớp bảo vệ duy nhất. | NOT RUN — lưu request/response |
| CE-11 | P2 | Chỉ lesson/Section đang hoạt động được tính vào điều kiện | Cần fixture inactive được tạo sẵn; hoàn thành các lesson active còn lại trên UI. | Lesson/Section inactive không giữ Quiz/Final ở trạng thái khóa. | NOT RUN — ghi fixture + screenshot/API |
| CE-12 | P2 | Course không có lesson | Cần enrollment hợp lệ của Course rỗng và Final course-level; mở `Continue learning`. | Trang không lỗi; Final hiển thị, không khóa vì thiếu lesson active. | NOT RUN — screenshot |
| CE-13 | P2 | Exam gắn trực tiếp với lesson giữ hành vi cũ | Teacher: `/exams` chỉnh sửa exam test, chọn Course → Section → Lesson. Student: kiểm tra dưới lesson đó trước/sau `Mark lesson complete`. | Exam nằm ở lesson; khóa trước khi lesson hoàn tất, mở sau đó; không thành Section Quiz/Final. | NOT RUN — screenshots |
| CE-14 | P2 | `FINAL_TEST` gắn Section không biến thành Final Course | Teacher: chỉnh exam category `FINAL_TEST`, chọn Course và Section, để Lesson là `Whole section`; student kiểm tra sidebar. | Exam nằm dưới Section, không nằm trong vùng `Final exam` course-level. Đối chiếu riêng lock rule, không suy luận chỉ từ category. | NOT RUN — screenshot |
| CE-15 | P2 | Staff preview không bị khóa như learner chưa ghi danh | Chỉ chạy nếu môi trường có staff preview: chuyển active role sang Student/preview theo UI hiện có, mở enrollment/course test và kiểm tra exam course-level. Nếu không có luồng preview, đánh dấu `BLOCKED` thay vì dùng session student thông thường. | Teacher/admin đang ở preview vẫn xem/mở được exam theo quyền staff, không bị báo user chưa ghi danh. | NOT RUN — screenshot hoặc BLOCKED + lý do |
| CE-16 | P2 | Tiếp tục attempt đang làm không bị gián đoạn | Chỉ chạy khi đã chấp nhận tạo attempt: bắt đầu bài đã mở, quay lại trang học rồi vào lại exam đang `IN_PROGRESS`. | Tiếp tục đúng attempt hiện tại; không tạo attempt mới/khóa lại chỉ vì reload hoặc tiến độ đổi. | NOT RUN — attempt ID/status |

## 6. API tham chiếu

Các endpoint dưới đây được khai báo trong backend hiện tại:

| Mục đích | Request |
|---|---|
| Liệt kê exam của Course | `GET /api/courses/{courseId}/exams` |
| Liệt kê exam của Section | `GET /api/sections/{sectionId}/exams` |
| Liệt kê exam của lesson | `GET /api/lessons/{lessonId}/exams` |
| Gắn exam vào Course/Section/lesson | `PUT /api/courses/{courseId}/exams/{examId}/link` (query tùy chọn `sectionId`, `lessonId`) |
| Bắt đầu/tiếp tục attempt | `POST /api/exams/{examId}/attempt` |
| Xem ghi danh của student hiện tại | `GET /api/enrollments/my-courses` |

API list exam yêu cầu đăng nhập và quyền truy cập Course. API bắt đầu exam yêu cầu quyền `EXAM_TAKE`. Dùng Postman/API client với token của đúng vai trò khi kiểm tra; không dùng token teacher/admin để kết luận hành vi của student.

## 7. Ghi nhận kết quả

| Thông tin | Giá trị |
|---|---|
| Người kiểm thử | |
| Ngày/giờ | |
| Branch/commit | |
| Môi trường/API base | |
| Course ID | |
| Enrollment ID | |
| Student test account (không ghi mật khẩu/token) | |
| Quiz A1 / Quiz B1 / Final exam ID | |

| Thống kê | Số lượng |
|---|---:|
| Tổng test case | 16 |
| PASS | |
| FAIL | |
| BLOCKED | |
| NOT RUN | |

Với test `FAIL`, ghi bước tái hiện, response/screenshot/log và ID dữ liệu liên quan. Che token, cookie, email/số điện thoại cá nhân và thông tin nhạy cảm trước khi lưu evidence. Không đánh dấu `PASS` nếu chưa thực hiện và xác minh kết quả.

## 8. Bằng chứng tự động hiện có

Tài liệu trước đó ghi nhận các test backend mục tiêu: **53 tests, 0 failures, 0 errors** (`ExamProgressLockServiceTest`, `ExamAttemptServiceTest`, `ExamCourseLinkServiceTest`). Kết quả này không được chạy lại trong lần cập nhật hướng dẫn UI và không thay thế các ca kiểm thử UI/API thủ công ở tài liệu này.
