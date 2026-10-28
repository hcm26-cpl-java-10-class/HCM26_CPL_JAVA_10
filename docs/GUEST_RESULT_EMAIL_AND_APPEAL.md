# Gửi email kết quả cho học sinh tự do (guest) & khiếu nại điểm

Tài liệu này ghi lại 3 nhóm sửa đã triển khai:
mail kết quả cho học sinh không có account, lỗi `400` khi khiếu nại điểm,
và việc dọn trang Invitations trùng.

---

## 1. Mail kết quả cho học sinh tự do (guest)

### 1.1 Luồng đầy đủ

```
Giáo viên tạo link chia sẻ (invitation anonymous)
  → Học sinh nhập tên + email, hệ thống tạo AnonymousSession + guest User
  → Học sinh làm bài, nộp
      → AnonymousExamService.submit()
          → gửi mail kết quả tạm (điểm trắc nghiệm) nếu có câu tự luận
  → Giáo viên chấm câu tự luận
      → ExamEssayGradingService.submitOfficialGrade()
          → AnonymousExamService.sendFinalResultToGuest()
              → gửi mail điểm chính thức
```

### 1.2 Điểm mấu chốt: email thật của guest nằm ở đâu

Khi email học sinh trùng với một account đã tồn tại, `GuestUserService` lưu email
giả cho user đó (`guest-xxxx@anon.invalid`) để không đụng unique constraint.
Email **thật** chỉ nằm ở `anonymous_session.guest_email`.

Vì vậy mọi chỗ gửi mail cho guest đều phải đi qua `GuestEmailResolver`:

```java
String recipientEmail = guestEmailResolver.resolveGuestEmail(attempt);
```

`GuestEmailResolver` đọc `anonymous_session` theo `guestUserId` + `examId`,
lấy `guest_email` mới nhất. Nếu không tìm thấy thì mới fallback về email trên
`User` (chỉ dùng được khi email không bị trùng account).

### 1.3 Endpoint hỗ trợ chẩn đoán

| Endpoint | Quyền | Mô tả |
|---|---|---|
| `POST /api/exams/attempts/{attemptId}/resend-result-email?email=` | `EXAM_UPDATE` | Gửi lại mail kết quả cho 1 attempt guest. Có thể truyền `email` để gửi vào địa chỉ khác. |
| `POST /api/exams/mail/test?email=` | `EXAM_UPDATE` | Gửi mail test để kiểm tra cấu hình SMTP. |

Response luôn có trường `sent` (boolean) kèm message tiếng Việt/Anh rõ ràng.

Trên UI, nút **"Resend Result Email"** nằm trong trang
`Exam Management → Grading → Submission Review` (chỉ hiện khi attempt có email).

### 1.4 ⚠️ Nguyên nhân thật: Gmail App Password sai

Log lỗi thật khi chạy thử:

```
jakarta.mail.AuthenticationFailedException: 535-5.7.8 Username and Password not accepted.
```

Nghĩa là **code đúng, cấu hình sai**. Gmail không cho dùng mật khẩu tài khoản
thường cho SMTP; phải dùng *App Password* (mật khẩu ứng dụng).

Cách sửa:

1. Vào <https://myaccount.google.com/apppasswords>.
2. Bật 2-Step Verification (bắt buộc) nếu chưa bật.
3. Tạo App Password cho "Mail" → copy mã 16 ký tự (dạng `xxxx xxxx xxxx xxxx`).
4. Đặt vào biến môi trường, KHÔNG commit giá trị thật:

```properties
spring.mail.username=<gmail của bạn>
spring.mail.password=${MAIL_APP_PASSWORD:xxxx xxxx xxxx xxxx}
```

5. Kiểm tra lại bằng:

```bash
curl -X POST "http://localhost:8080/api/exams/mail/test?email=<email của bạn>" \
  -H "Authorization: Bearer <token teacher/admin>"
```

Kết quả mong đợi: `{"sent": true, "message": "Test email sent. ..."}`.

Lưu ý: giá trị `MAIL_APP_PASSWORD` mặc định đang hardcode trong
`application.properties` và `backend.env.example` — cần thay bằng app password
thật của bạn, hoặc bỏ default để bắt buộc cấu hình qua env.

---

## 2. Lỗi `400 Bad Request` khi khiếu nại điểm

### 2.1 Nguyên nhân

`ScoreAppealService.createAppeal()` yêu cầu kỳ thi đã được **công bố kết quả**
(`ExamResultPublication.isPublished() == true` và `releasePolicy != HIDDEN`).
Trong khi đó `My Scores` hiển thị điểm ngay khi giáo viên chấm xong.
Học sinh bấm "Appeal this score" → bị backend từ chối.

### 2.2 Cách sửa

**Backend:**

- `PublishedExamScoreDTO` thêm cờ `resultPublished` để frontend biết trạng thái.
- `ExamResultAccessService.isScorePublished(exam)` là nguồn sự thật duy nhất.
- Message lỗi cụ thể thay vì chung chung:

```json
{
  "status": 400,
  "message": "Scores for \"Test E2E Mail Exam\" have not been published yet. Your teacher must publish the results (Result Statistics -> Publish Results) before you can appeal."
}
```

Riêng trường hợp `releasePolicy = HIDDEN` sẽ báo:
`Scores for "..." are hidden by your teacher. Appeal is not available while the release policy is HIDDEN.`

**Frontend:**

- `MyScoresPage`: nút "Appeal this score" bị disable + hiện cảnh báo vàng
  "Awaiting result publication" khi chưa công bố.
- `MyAppealsPage`: nút submit bị disable, hiện cảnh báo, và danh sách attempt
  hiển thị nhãn `(not published yet)`.

### 2.3 Cách publish kết quả

`Exam Management → Result Statistics` → nút **Publish Results** với policy:

| Policy | Ý nghĩa |
|---|---|
| `MY_SCORES_AND_EMAIL` | Học sinh xem điểm + nhận mail kết quả. |
| `MY_SCORES_ONLY` | Học sinh xem điểm, không gửi mail. |
| `HIDDEN` | Ẩn kết quả, không appeal được. |

---

## 3. Dọn trang Invitations trùng

Có 3 đường dẫn liên quan tới invitation trước đây:

| Đường dẫn | Trạng thái | Ghi chú |
|---|---|---|
| `frontend/src/pages/management/exam/invitation/index.tsx` | **Giữ** | Trang quản lý chi tiết theo exam (`/exams/:examId/invitations`), dùng API thật. |
| `frontend/src/pages/management/exam/invitations/index.tsx` | **Đã xoá** | File mock, chỉ chứa mảng rỗng `invitations: any[] = []`. |
| `frontend/src/pages/invitations/InvitationsPage.tsx` | **Giữ (đã viết lại)** | Route `/invitations`: tự điều hướng theo role. |

`InvitationsPage` hiện tại:

- Role `STUDENT` → `StudentInvitationList` (danh sách lời mời của học sinh).
- Teacher/Admin → `InvitationsLandingPage` (trang mới): chọn kỳ thi ở cột trái,
  xem danh sách lời mời ở cột phải, có nút "Quản lý chi tiết" sang trang theo exam.

Route `/student/invitations` redirect về `/invitations` qua `StudentInvitationsRedirect`.

---

## 4. Kiểm thử nhanh (E2E tay)

```bash
# 1. Đăng nhập giáo viên
curl -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"teacher@example.com","password":"password123"}'

# 2. Tạo link chia sẻ cho học sinh tự do
curl -X POST http://localhost:8080/api/exams/1/invitations/anonymous \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"studentName":"Guest E2E","studentEmail":"guest.e2e@example.com","maxAccessAttempts":1}'

# 3. Học sinh tự do vào thi
curl -X POST http://localhost:8080/api/exams/anonymous-session \
  -H "Content-Type: application/json" \
  -d '{"accessCode":"<CODE>","fingerprint":"e2e-fp-1","studentName":"Guest E2E","studentEmail":"guest.e2e@example.com"}'

curl -X POST http://localhost:8080/api/exams/anonymous/attempt \
  -H "Content-Type: application/json" -d '{"sessionToken":"<TOKEN>"}'

curl -X POST http://localhost:8080/api/exams/anonymous/attempts/1/submit \
  -H "X-Anonymous-Session: <TOKEN>" -H "Content-Type: application/json" \
  -d '[{"questionId":30,"selectedOptionIds":[1]}]'

# 4. Kiểm tra mail đã gửi (trong log backend)
#    Anonymous result email dispatched to guest.e2e@example.com for examId 1 attempt 1

# 5. Publish kết quả rồi appeal
curl -X POST http://localhost:8080/api/exams/1/result-publication/publish \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"releasePolicy":"MY_SCORES_AND_EMAIL"}'
```

Tài khoản seed: `admin@example.com`, `teacher@example.com`, `student@example.com`,
`student1..30@example.com` — mật khẩu `password123`.
