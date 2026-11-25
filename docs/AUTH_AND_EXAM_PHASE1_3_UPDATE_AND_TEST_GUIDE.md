# Cập nhật Triển khai Phase 1 – 3 (Auth/Session Security & Exam Management) & Hướng dẫn Kiểm thử

> **Phạm vi:** Các cập nhật đồng bộ theo `SRS_FAMS_LMS_MockProject_Hub_ThucTe_v2.0_With_UI.md` trên nhánh `exam_clone` (đã merge đầy đủ từ `origin/dev`).
> **Ngày cập nhật:** 2026-11-23

---

## 1. Tổng quan các Phase đã hoàn thành

### Phase 1 – Bảo mật Login / Logout, Khôi phục phiên & Phân quyền câu hỏi (`UFR-SYS-001`, `003`, `014`)
- **Multi-session Refresh Token & JWT `sid`:**
  - Mỗi phiên đăng nhập có `sessionId` riêng (`sid` claim gắn trong Access Token), lưu `rememberMe`, `ipAddress`, `userAgent`, `lastUsedAt`, `revokedReason` trên `refresh_tokens`.
  - Giới hạn số phiên hoạt động đồng thời qua `app.auth.max-active-sessions` (mặc định `5`), tự thu hồi phiên cũ nhất khi vượt ngưỡng.
  - Refresh token sai/hết hạn/đã bị thu hồi trả HTTP **`401 Unauthorized`** (qua `UnauthorizedException`) thay vì `500`.
  - `JwtAuthenticationFilter` kiểm tra trạng thái `sid` còn hoạt động (`401` JSON nếu phiên đã bị thu hồi) và kiểm tra `Tenant.active` (`403` JSON nếu tenant bị khóa).
- **Chặn tài khoản & Tenant bị khóa đồng nhất:**
  - Chặn `user.isActive == false` và `tenant.active == false` ở cả đăng nhập thường, Google SSO, refresh token và JWT filter.
  - Dừng hành vi Google SSO tự mở khóa tài khoản đã bị vô hiệu hóa; hỗ trợ bật/tắt JIT provisioning qua `app.auth.sso.jit-provisioning-enabled` (mặc định `true`).
  - Ghi nhận `users.last_login_at` sau mỗi lần đăng nhập thành công.
- **Cookie & OAuth2 Redirect an toàn:**
  - `CookieUtil` dùng `ResponseCookie` với `HttpOnly`, `Secure` (theo cấu hình), `SameSite=Lax`.
  - `rememberMe = false`: session cookie (`Max-Age` không đặt, refresh token tồn tại `jwt.refresh-token.short-duration=86400` giây = 1 ngày).
  - `rememberMe = true`: persistent cookie (`jwt.refresh-token.duration=604800` giây = 7 ngày).
  - `OAuth2AuthenticationSuccessHandler` đặt HttpOnly refresh cookie và redirect sạch về `/oauth2/redirect` (không còn truyền `?token=` trên URL); `OAuth2RedirectHandler` gọi `POST /api/auth/refresh` để nhận Access Token.
- **Thu hẹp `SecurityConfig` & Bảo vệ Question Import/Export:**
  - Bỏ permitAll mở rộng `/api/auth/**`; chỉ mở đúng các endpoint công khai (`/api/auth/login`, `/api/auth/register`, `/api/auth/refresh`, `/api/auth/logout`, `/api/auth/forgot-password`, `/api/auth/reset-password`, `/api/auth/verify-reset-token`, `/api/auth/google`).
  - Gắn `@PreAuthorize("hasAuthority('QUESTION_CREATE')")` cho `QuestionImportController` và `@PreAuthorize("hasAuthority('QUESTION_READ')")` cho `QuestionExportController`.
- **Frontend Auth & Logout đồng nhất:**
  - Tự khôi phục phiên qua `POST /api/auth/refresh` khi F5 hoặc mở tab mới (`main.tsx`, `authTabSession.ts`).
  - Gom toàn bộ luồng logout (`Logout.tsx`, `AuthContext.tsx`, `Sidebar.tsx`, `StudentNavbar.tsx`) về `performAppLogout` trong `frontend/src/utils/auth-logout.ts`: gọi `/api/auth/logout`, xóa sạch Redux state, `TanStack Query` cache, `RoleSwitchContext` và phát sự kiện đồng bộ logout sang các tab khác.
  - Sửa `Login.tsx`: không `.trim()` password, nối `rememberMe`, thêm link `Forgot password?`, chỉ hiển thị khối `(Dev Test Only)` khi `import.meta.env.DEV === true`.

---

### Phase 2 – Quản lý Phiên đăng nhập, Đổi mật khẩu & Auth Audit Log (`UFR-SYS-003`, `006`, `014`)
- **Backend API mới (đều yêu cầu đăng nhập):**
  - `POST /api/auth/change-password` – đổi mật khẩu, xác thực mật khẩu cũ và thu hồi các phiên đăng nhập khác.
  - `GET /api/auth/sessions` – liệt kê các phiên đang hoạt động của người dùng hiện tại (đánh dấu phiên hiện tại `current: true`).
  - `DELETE /api/auth/sessions/{sessionId}` – thu hồi 1 phiên cụ thể của chính mình.
  - `POST /api/auth/sessions/revoke-others` – đăng xuất toàn bộ thiết bị/trình duyệt khác, giữ nguyên phiên hiện tại.
  - `GET /api/auth/audit-logs` – xem lịch sử nhật ký bảo mật đăng nhập.
  - `POST /api/users/{id}/revoke-sessions` – Admin cưỡng chế thu hồi toàn bộ phiên của 1 user.
- **Bảng Audit Log (`auth_audit_logs`):**
  - Ghi nhận các sự kiện: `LOGIN_SUCCESS`, `LOGIN_FAILED`, `LOGIN_GOOGLE_SUCCESS`, `REFRESH_SUCCESS`, `REFRESH_FAILED`, `LOGOUT`, `SESSION_REVOKED`, `ALL_SESSIONS_REVOKED`, `PASSWORD_CHANGED`, `FORCED_LOGOUT_BY_ADMIN` kèm IP, User-Agent, `sessionId`, `detail`, `createdAt`.
- **Frontend UI (`/account/security`):**
  - Tạo mới `frontend/src/pages/auth/AccountSecurityPage.tsx` theo hệ giao diện **Monochrome** (`bg-slate-900 text-white` / `dark:bg-slate-100 dark:text-slate-900`).
  - Gắn nút điều hướng nhanh **Security & Sessions** trên `Sidebar.tsx` và `StudentNavbar.tsx`.

---

### Phase 3 – Hoàn thiện Nghiệp vụ Exam Management theo SRS (`UFR-EXM-001`..`013`, `BR-UNI-14`, `BR-UNI-19`)
- **Vòng đời đề thi & Khung giờ thi (`BR-UNI-14`):**
  - Bổ sung `ExamStatus`: `DRAFT`, `PUBLISHED`, `CLOSED`, `ARCHIVED` (mặc định `PUBLISHED` để tương thích 100% đề thi cũ).
  - Bổ sung `startTime`, `endTime` (tùy chọn – để trống thì đề mở tự do; nếu có giá trị thì `ExamConfigValidator` bắt buộc `startTime < endTime` và `durationMinutes <= số phút giữa startTime và endTime`).
  - Bổ sung `@Version` (Optimistic Locking) cho `Exam` và `Question`, trả **`409 Conflict`** nếu có xung đột sửa đồng thời.
  - Bổ sung API:
    - `POST /api/exams/{id}/publish` (yêu cầu có ít nhất 1 câu hỏi active hoặc question pool; không cho publish đề đã `ARCHIVED`).
    - `POST /api/exams/{id}/close` (chuyển sang `CLOSED`, ngừng nhận lượt làm mới).
    - `POST /api/exams/{id}/archive` (chặn archive nếu còn lượt làm `NOT_STARTED`/`IN_PROGRESS`).
    - `POST /api/exams/{id}/duplicate` (nhân bản đề thi, có `@PreAuthorize("hasAnyRole('ADMIN', 'TEACHER') and hasAuthority('EXAM_CREATE')")`).
  - `ExamAttemptService` kiểm soát trạng thái `PUBLISHED` và khung giờ `startTime`/`endTime` khi bắt đầu lượt làm mới.
  - `ExamResultAccessService` áp dụng `AFTER_EXAM_CLOSED` theo trạng thái `CLOSED`/`ARCHIVED` và mốc `endTime` (giữ fallback tương thích nếu `endTime == null`).
- **Duyệt cờ gian lận – Integrity Review Disposition (`BR-UNI-19`):**
  - Tạo bảng `exam_attempt_integrity_reviews` với trạng thái `UNREVIEWED`, `CLEARED`, `CONFIRMED_VIOLATION`, ghi chú `note`, `reviewedBy`, `reviewedAt`.
  - API `PUT /api/exams/{examId}/integrity-report/attempts/{attemptId}/review` và làm giàu dữ liệu trả về từ `GET /api/exams/{examId}/integrity-report`.
  - Giao diện **Reviewer Disposition** trong `IntegrityReportSection.tsx` (Monochrome badge).
- **Trả bài yêu cầu sửa (`RETURNED_FOR_REVISION`) & Override điểm thủ công:**
  - Bổ sung trạng thái `ExamAttemptStatus.RETURNED_FOR_REVISION` cùng `revisionNote`, `revisionDeadline` (hiển thị xuyên suốt qua `ExamAttemptDTO`, `ExamAttemptSummaryDTO`, `ExamAttemptReviewDTO` trong `ExamAttemptMappingFlow` & `ExamAttemptReviewFlow`).
  - API `POST /api/exams/{examId}/grading/attempts/{attemptId}/return-for-revision` + nút & modal **Return for Revision** trong `EssayAttemptDetailPage.tsx`.
  - Mở rộng `ExamAttemptStatisticsService.lockReason` cho phép override điểm thủ công có lý do bắt buộc & audit cho mọi bài `SUBMITTED` đã chấm.
- **Trải nghiệm Học viên & Guest:**
  - `StudentExamList.tsx`: bổ sung tab lọc **All / Open / Upcoming / Completed & Closed** và hiển thị trạng thái `RETURNED_FOR_REVISION`.
  - `AnonymousExamTakingPage.tsx`: tự động lưu bài định kỳ mỗi **15 giây**.

---

### Thay đổi Database & Cấu hình mới
- **Bảng mới (tự tạo qua `spring.jpa.hibernate.ddl-auto=update`):** `auth_audit_logs`, `exam_attempt_integrity_reviews`.
- **Cột thêm mới (additive, tương thích ngược):**
  - `users`: `last_login_at`
  - `refresh_tokens`: `session_id`, `remember_me`, `ip_address`, `user_agent`, `last_used_at`, `revoked_reason`
  - `exams`: `status` (default `PUBLISHED`), `start_time`, `end_time`, `version`
  - `questions`: `version`
  - `exam_attempts`: `revision_note`, `revision_deadline`, enum thêm `RETURNED_FOR_REVISION`
- **Biến cấu hình mới trong `backend/src/main/resources/application.properties`:**
  - `jwt.refresh-token.short-duration=86400`
  - `app.cookie-same-site=Lax`
  - `app.auth.sso.jit-provisioning-enabled=true`
  - `app.auth.max-active-sessions=5`

> **Ngoài phạm vi (Phase 4 – tùy chọn):** Gán đề theo `TrainingClass`, bài thi coding đa ngôn ngữ, câu hỏi `FILE_UPLOAD`/`URL`, tenant isolation riêng cho `Exam`/`Question`, chống brute-force/khóa tài khoản tự động và MFA.

---

## 2. Chuẩn bị môi trường chạy & kiểm thử

### 2.1. Khởi động Backend & Frontend
Mở 2 cửa sổ terminal tại thư mục gốc `HCM26_CPL_JAVA_10`:

**Terminal 1 – Backend (cổng `8080`):**
```powershell
cd backend
.\mvnw.cmd spring-boot:run
```
- Swagger UI: `http://localhost:8080/swagger-ui/index.html`
- H2 Console: `http://localhost:8080/h2-console`
  - JDBC URL: `jdbc:h2:file:./data/fams_lms_after_merge_fresh`
  - Username: `sa`, Password: *(để trống)*

**Terminal 2 – Frontend (cổng `5173`):**
```powershell
cd frontend
npm run dev
```
- Truy cập giao diện tại: `http://localhost:5173/login`

### 2.2. Chạy bộ kiểm thử tự động trước khi test tay
```powershell
# Backend – 12 bộ unit test Auth & Exam (103 test)
cd backend
.\mvnw.cmd -o test "-Dtest=AuthFlowSecurityTest,ExamPhase3UnitTest,RefreshTokenServiceImplTest,ExamResultAccessServiceTest,ExamIntegrityServiceTest,ExamConfigValidatorTest,SourcePackageStructureTest,ExamServiceImplTest,ExamAttemptServiceTest,ExamEssayGradingServiceTest,LearnerExamAuthorizationTest,ExamPreparationServiceTest"

# Frontend – TypeScript & Router test
cd ..\frontend
npx tsc --noEmit -p tsconfig.app.json
npx vitest run src/router/AppMenuRouting.test.tsx
npm run build
```

---

## 3. Hướng dẫn Test trên Giao diện (UI / Browser Checklist)

### Nhóm A – Login, Remember Me, Session Restore & Logout (Phase 1)

| # | Kịch bản test | Các bước thao tác trên trình duyệt | Kết quả mong đợi |
|---|---|---|---|
| A1 | **Password có khoảng trắng đầu/cuối** | Vào `/login`, nhập email đúng và mật khẩu sai có dấu cách thừa ở cuối → bấm **Sign in**. | Đăng nhập thất bại (`Invalid email or password`), password **không** bị `.trim()` âm thầm. |
| A2 | **Link Forgot password & Dev Test block** | Ở `/login`, kiểm tra link **Forgot password?**. | Bấm link điều hướng sang `/forgot-password`. Khối `(Dev Test Only)` chỉ hiện ở `npm run dev` (không xuất hiện ở bản build production `npm run preview`). |
| A3 | **Remember Me = OFF vs ON** | Đăng nhập lần 1 **không tick** Remember Me → mở DevTools → Application → Cookies → kiểm tra `refreshToken`. Đăng xuất, đăng nhập lần 2 **có tick** Remember Me → kiểm tra lại cookie. | Cả 2 lần cookie đều có `HttpOnly=true`, `SameSite=Lax`. Khi **không tick**: `Expires/Max-Age = Session`. Khi **có tick**: `Expires` kéo dài ~7 ngày. |
| A4 | **Khôi phục phiên khi F5 & mở tab mới** | Sau khi đăng nhập thành công, nhấn **F5** tải lại trang, hoặc copy URL trang hiện tại mở ở **tab mới** cùng trình duyệt. | Ứng dụng tự gọi `POST /api/auth/refresh`, giữ nguyên trạng thái đăng nhập (không bị đá về `/login`). |
| A5 | **Logout đồng bộ liên tab & xóa cache** | Mở 2 tab đang đăng nhập cùng tài khoản. Ở Tab 1 bấm **Logout** (từ Sidebar hoặc StudentNavbar). Quan sát Tab 2. | Tab 1 gọi `POST /api/auth/logout`, xóa cookie `refreshToken` và chuyển về `/login`. Tab 2 tự động logout về `/login` ngay sau đó; đăng nhập tài khoản khác không thấy dữ liệu cache cũ của tài khoản trước. |
| A6 | **Google OAuth2 Redirect sạch URL** *(nếu có `GOOGLE_CLIENT_ID/SECRET`)* | Bấm **Sign in with Google**, hoàn tất xác thực Google. Quan sát thanh địa chỉ lúc chuyển hướng về `/oauth2/redirect`. | URL không chứa `?token=...`; trình duyệt nhận cookie `refreshToken` và tự trao đổi sang Access Token rồi vào trang chính. |

---

### Nhóm B – Account Security & Quản lý Phiên (Phase 2)

| # | Kịch bản test | Các bước thao tác trên trình duyệt | Kết quả mong đợi |
|---|---|---|---|
| B1 | **Mở trang Security & Sessions** | Sau khi đăng nhập (Admin / Teacher / Student), bấm nút **Security** trên `Sidebar` (hoặc `StudentNavbar`) hoặc truy cập `/account/security`. | Hiển thị giao diện Monochrome gồm 2 phần: **Change Password** và **Active Sessions**. |
| B2 | **Xem danh sách phiên đa thiết bị** | Đăng nhập cùng 1 tài khoản ở 2 trình duyệt khác nhau (VD: Chrome thường + Chrome Incognito). Vào `/account/security`. | Thấy 2 phiên hoạt động (kèm IP, thiết bị/User-Agent, thời gian hoạt động gần nhất) và 1 phiên gắn nhãn **Current session**. |
| B3 | **Thu hồi 1 phiên cụ thể** | Ở Trình duyệt 1, bấm **Revoke** trên phiên của Trình duyệt 2. Quay lại Trình duyệt 2 và thao tác gọi API hoặc bấm F5. | Phiên Trình duyệt 2 biến mất khỏi danh sách. Trình duyệt 2 lập tức nhận `401` (vì `sid` bị revoke) và bị đẩy ra `/login`. |
| B4 | **Revoke Other Sessions** | Đăng nhập ở 2–3 cửa sổ khác nhau, vào `/account/security` ở Trình duyệt 1 → bấm **Sign out other devices**. | Chỉ còn lại phiên hiện tại của Trình duyệt 1; các trình duyệt khác đều mất hiệu lực ngay. |
| B5 | **Đổi mật khẩu (`Change Password`)** | Nhập mật khẩu cũ sai → bấm lưu (phải báo lỗi). Nhập mật khẩu cũ đúng + mật khẩu mới hợp lệ → bấm **Update Password**. | Báo thành công; các phiên trên thiết bị khác bị thu hồi tự động; thử đăng xuất và đăng nhập lại bằng mật khẩu mới thành công. |

---

### Nhóm C – Exam Lifecycle, Schedule, Integrity Review & Revision (Phase 3)

| # | Kịch bản test | Các bước thao tác trên trình duyệt | Kết quả mong đợi |
|---|---|---|---|
| C1 | **Validation khung giờ thi (`BR-UNI-14`)** | Đăng nhập Teacher/Admin → `/exams` → tạo hoặc sửa 1 đề thi (tab **Edit**). Nhập `Duration = 60`, đặt `Start Time = 10:00`, `End Time = 10:30` (khung giờ 30 phút < thời lượng 60 phút) → Lưu. | Backend chặn với lỗi validation (`400`), hiển thị thông báo lỗi trên form. Sửa lại `End Time = 11:30` (hoặc xóa trống cả 2 trường) → Lưu thành công. |
| C2 | **Vòng đời đề thi `DRAFT → PUBLISHED → CLOSED → ARCHIVED`** | Vào trang chi tiết đề thi `/exams/{id}/edit`: quan sát badge trạng thái màu đen/trắng (`slate-900`) và các nút **Publish / Close / Archive / Duplicate** trên header. | - Khi `DRAFT`: hiện **Publish**, **Archive**, **Duplicate**. Thử **Publish** đề chưa có câu hỏi → báo lỗi.<br>- Khi `PUBLISHED`: hiện **Close**, **Archive**, **Duplicate**.<br>- Khi `CLOSED`: hiện **Publish** (mở lại), **Archive**, **Duplicate**.<br>- Khi `ARCHIVED`: không còn nút Publish/Close. Nếu có sinh viên đang `IN_PROGRESS`, bấm **Archive** sẽ bị chặn báo lỗi. |
| C3 | **Duplicate đề thi** | Bấm nút **Duplicate** trên header trang chi tiết đề thi. | Tạo đề bản sao mới kèm câu hỏi sao chép, hiện toast 3 giây và chuyển sang đề vừa nhân bản. |
| C4 | **Bộ lọc đề thi phía Học viên** | Đăng nhập Student → vào danh sách đề thi (`/student/exams`). Chuyển lần lượt giữa 4 tab: **All / Open / Upcoming / Completed & Closed**. | - Đề có `startTime` trong tương lai nằm ở **Upcoming**.<br>- Đề `PUBLISHED` đang mở nằm ở **Open**.<br>- Đề đã nộp xong hoặc `CLOSED`/hết hạn nằm ở **Completed & Closed**.<br>- Thử bắt đầu đề `DRAFT`, `CLOSED` hoặc chưa tới `startTime` → bị backend chặn với thông báo rõ ràng. |
| C5 | **Return for Revision (Trả bài sửa lại)** | 1) Student làm & nộp 1 đề có câu Tự luận (Essay).<br>2) Teacher vào `/exams/{examId}/grading` → mở chi tiết bài làm (`EssayAttemptDetailPage`) → bấm **Return for Revision**, nhập ghi chú (`note`) và hạn nộp lại (`deadline`) → xác nhận.<br>3) Quay lại Student `/student/exams`. | Trạng thái bài làm chuyển thành **`RETURNED_FOR_REVISION`** kèm ghi chú & hạn nộp. Student có thể mở lại bài làm để chỉnh sửa và nộp lại. |
| C6 | **Duyệt cờ gian lận (`BR-UNI-19`)** | 1) Trong 1 lượt thi bật Anti-cheat, tạo vài sự kiện chuyển tab/thoát fullscreen.<br>2) Teacher vào tab **Statistics / Integrity Report** của đề thi, mở mục **Reviewer Disposition** của lượt bị gắn cờ.<br>3) Chọn `CLEARED` hoặc `CONFIRMED_VIOLATION`, nhập ghi chú → Lưu. | Trạng thái review cập nhật và hiển thị badge trung tính (Monochrome) kèm người duyệt + thời gian duyệt; tải lại trang vẫn giữ nguyên quyết định. |
| C7 | **Guest Autosave mỗi 15 giây** | Mở link thi ẩn danh `/anonymous-exam/{token}`, điền đáp án rồi chờ ~15–20 giây (quan sát tab **Network** trong DevTools). | Thấy request lưu đáp án tự động được gửi định kỳ mỗi 15 giây khi có thay đổi. |

---

## 4. Hướng dẫn Test Hệ thống, API & Database

### 4.1. Kiểm tra API Auth, Session & Security bằng PowerShell

#### 1) Đăng nhập, lưu Cookie & kiểm tra `/api/auth/sessions`
```powershell
$base = "http://localhost:8080"
$session = New-Object Microsoft.PowerShell.Commands.WebRequestSession

# 1. Login (thay email/password bằng tài khoản thật trong DB local của bạn)
$loginRes = Invoke-RestMethod -Method Post -Uri "$base/api/auth/login" `
  -ContentType "application/json" `
  -Body '{"email":"admin@example.com","password":"password123","rememberMe":true}' `
  -WebSession $session

$token = $loginRes.accessToken
$headers = @{ Authorization = "Bearer $token" }

# 2. Liệt kê các phiên đang hoạt động (phải trả 200 kèm current=true)
Invoke-RestMethod -Method Get -Uri "$base/api/auth/sessions" -Headers $headers

# 3. Xem auth audit logs (phải trả 200 có bản ghi LOGIN_SUCCESS)
Invoke-RestMethod -Method Get -Uri "$base/api/auth/audit-logs" -Headers $headers
```

#### 2) Kiểm tra Endpoint Private không cho truy cập ẩn danh (`401`)
```powershell
# Không gửi Authorization header -> PHẢI trả 401 (không còn permitAll /api/auth/**)
try {
  Invoke-RestMethod -Method Get -Uri "$base/api/auth/sessions"
} catch {
  $_.Exception.Response.StatusCode.value__   # Mong đợi: 401
}

# Refresh với cookie rỗng/giả -> PHẢI trả 401 (không phải 500)
try {
  Invoke-RestMethod -Method Post -Uri "$base/api/auth/refresh"
} catch {
  $_.Exception.Response.StatusCode.value__   # Mong đợi: 401
}
```

#### 3) Kiểm tra Admin cưỡng chế đăng xuất user (`POST /api/users/{id}/revoke-sessions`)
```powershell
# Dùng token của Admin để thu hồi toàn bộ phiên của user có id = 2
Invoke-RestMethod -Method Post -Uri "$base/api/users/2/revoke-sessions" -Headers $headers
# Sau đó dùng accessToken cũ của user id = 2 gọi bất kỳ API nào -> PHẢI trả 401 (Session revoked)
```

#### 4) Kiểm tra phân quyền Question Import/Export (Student phải bị chặn `403`)
```powershell
# Dùng $studentHeaders (Bearer token của tài khoản role STUDENT)
try {
  Invoke-RestMethod -Method Get -Uri "$base/api/questions/export/template" -Headers $studentHeaders
} catch {
  $_.Exception.Response.StatusCode.value__   # Mong đợi: 403 Forbidden
}
```

#### 5) Kiểm tra Exam Lifecycle, Integrity Review & Return for Revision
```powershell
# Đổi trạng thái đề thi (thay {examId}, {attemptId} bằng ID thực tế)
Invoke-RestMethod -Method Post -Uri "$base/api/exams/1/close" -Headers $headers
Invoke-RestMethod -Method Post -Uri "$base/api/exams/1/publish" -Headers $headers
Invoke-RestMethod -Method Post -Uri "$base/api/exams/1/duplicate" -Headers $headers

# Duyệt cờ gian lận (BR-UNI-19)
Invoke-RestMethod -Method Put -Uri "$base/api/exams/1/integrity-report/attempts/1/review" `
  -Headers $headers -ContentType "application/json" `
  -Body '{"status":"CLEARED","note":"Verified network glitch"}'

# Trả bài yêu cầu sửa
Invoke-RestMethod -Method Post -Uri "$base/api/exams/1/grading/attempts/1/return-for-revision" `
  -Headers $headers -ContentType "application/json" `
  -Body '{"note":"Bo sung giai thich cau 2","deadline":"2026-12-31T23:59:00"}'
```

#### 6) Kiểm tra Optimistic Locking (`409 Conflict`)
1. Gọi `GET /api/exams/1` lấy giá trị `version` hiện tại (VD: `version = 0`).
2. Gửi `PUT /api/exams/1` lần 1 với `version = 0` → thành công (`200`, DB tăng lên `version = 1`).
3. Gửi `PUT /api/exams/1` lần 2 vẫn truyền `version = 0` (giả lập 2 giáo viên sửa cùng lúc) → hệ thống phải trả **`409 Conflict`**.

---

### 4.2. Kiểm tra dữ liệu trực tiếp trong H2 Console (`/h2-console`)

Mở `http://localhost:8080/h2-console`, kết nối DB và chạy các câu SQL kiểm chứng:

```sql
-- 1. Kiểm tra last_login_at được cập nhật trên USERS
SELECT id, email, is_active, last_login_at FROM users ORDER BY last_login_at DESC NULLS LAST LIMIT 10;

-- 2. Kiểm tra thông tin multi-session trên REFRESH_TOKENS
SELECT id, user_id, session_id, remember_me, ip_address, revoked, revoked_reason, last_used_at, expiry_date
FROM refresh_tokens ORDER BY id DESC LIMIT 10;

-- 3. Kiểm tra bảng nhật ký bảo mật AUTH_AUDIT_LOGS
SELECT id, action, user_id, email, session_id, ip_address, detail, created_at
FROM auth_audit_logs ORDER BY id DESC LIMIT 20;

-- 4. Kiểm tra vòng đời, khung giờ và version trên EXAMS
SELECT id, title, status, start_time, end_time, version FROM exams ORDER BY id DESC LIMIT 10;

-- 5. Kiểm tra quyết định duyệt cờ gian lận (BR-UNI-19)
SELECT id, attempt_id, status, note, reviewed_by, reviewed_at
FROM exam_attempt_integrity_reviews ORDER BY id DESC LIMIT 10;

-- 6. Kiểm tra lượt thi trả về sửa lại (RETURNED_FOR_REVISION)
SELECT id, exam_id, student_id, status, revision_note, revision_deadline
FROM exam_attempts WHERE status = 'RETURNED_FOR_REVISION' ORDER BY id DESC LIMIT 10;
```

### 4.3. Kiểm tra kịch bản khóa User & khóa Tenant
1. Trong H2 Console, chạy:
   ```sql
   UPDATE users SET is_active = FALSE WHERE email = '<email_test>';
   ```
   - Thử đăng nhập lại bằng email đó hoặc dùng refresh token cũ → phải nhận **`403`** / **`401`** và không vào được hệ thống. (Nhớ bật lại `is_active = TRUE` sau khi test).
2. Tương tự với Tenant:
   ```sql
   UPDATE tenants SET active = FALSE WHERE id = <tenant_id_test>;
   ```
   - Mọi request có JWT thuộc tenant đó hoặc đăng nhập/refresh của user thuộc tenant đó phải bị chặn **`403`** JSON. (Nhớ bật lại `active = TRUE` sau khi test).

---

## 5. Kết quả kiểm thử tự động đã xác minh

| Hạng mục | Lệnh chạy | Kết quả |
|---|---|---|
| Backend compile + 12 bộ Unit Test Auth & Exam | `.\mvnw.cmd -o test "-Dtest=AuthFlowSecurityTest,ExamPhase3UnitTest,RefreshTokenServiceImplTest,ExamResultAccessServiceTest,ExamIntegrityServiceTest,ExamConfigValidatorTest,SourcePackageStructureTest,ExamServiceImplTest,ExamAttemptServiceTest,ExamEssayGradingServiceTest,LearnerExamAuthorizationTest,ExamPreparationServiceTest"` | **103/103 pass**, 0 fail, 0 error |
| Frontend TypeScript check | `npx tsc --noEmit -p tsconfig.app.json` | **0 lỗi** |
| Frontend Router unit test | `npx vitest run src/router/AppMenuRouting.test.tsx` | **19/19 pass** |
| Frontend Production build | `npm run build` | **Thành công** (3.842 modules) |

> **Lưu ý:** Toàn bộ kịch bản test tương tác trình duyệt (mục 3) và kiểm thử API/H2 thực tế (mục 4) cần được chạy khi Backend (`8080`) và Frontend (`5173`) đang khởi động cục bộ; riêng luồng Google OAuth2 yêu cầu điền `GOOGLE_CLIENT_ID` và `GOOGLE_CLIENT_SECRET` hợp lệ trong biến môi trường hoặc `application.properties`.
