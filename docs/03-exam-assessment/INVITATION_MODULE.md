# MODULE INVITATION — TÀI LIỆU KỸ THUẬT

> Tài liệu mô tả chi tiết toàn bộ module **Invitation** trong dự án HCM26_CPL_JAVA_10.
> Bao gồm: cấu trúc class, mục đích, flow hoạt động, bảng endpoint, và các điểm cần lưu ý.
> Cập nhật lần cuối: October 21, 2026.

---

## 1. MỤC ĐÍCH TỔNG THỂ

Module Invitation giải quyết bài toán: **làm sao đưa đề thi đến tay người thi một cách an toàn, có kiểm soát, và theo dõi được vòng đời?**

Cụ thể hệ thống hỗ trợ **2 kênh mời song song**:

| Kênh | Dành cho | Cơ chế xác thực | Vòng đời trạng thái |
|------|----------|-------------------|----------------------|
| **Invitation có tài khoản** (authenticated) | Sinh viên đã có user trong hệ thống RBAC | Email + JWT token | `PENDING → SENT → ACCEPTED/REJECTED → COMPLETED` |
| **Invitation ẩn danh** (anonymous) | Người thi không có tài khoản (khách, ứng viên ngoài) | Mã truy cập 8 ký tự + QR code | `SENT → (dùng mã) → EXPIRED/REVOKED` |

Cả hai kênh dùng chung **một entity duy nhất** (`Invitation`), phân biệt bằng cờ `anonymous` và sự hiện diện/không hiện diện của `user_id`. Thiết kế này giúp tránh phân mảnh dữ liệu và dễ thống kê.

---

## 2. CÁC CLASS ĐÃ TẠO / CHỈNH SỬA

### 2.1 Backend — Domain Layer (Entity + Enum + Repository)

#### `Invitation.java` — entity chính
- **Vị trí:** `backend/src/main/java/com/example/starter_project_2025/system/exam/domain/Invitation.java`
- **Bảng:** `exam_invitation`
- **Annotation đặc biệt:**
  - `@ResourcePermission("INVITATION")` → tự sinh 4 permission `INVITATION_CREATE/READ/UPDATE/DELETE` khi app boot, không cần khai báo tay.
  - `@ResourceMenu(title="Invitations", group="Exam Management", icon="mail", url="/invitations", order=2, permission="INVITATION_READ")` → tự sinh menu admin trỏ tới `/invitations`.

**Cấu trúc cột theo nhóm nghiệp vụ:**

| Nhóm | Cột | Ý nghĩa |
|------|------|---------|
| Liên kết | `exam`, `user` | Liên kết đề thi & người nhận (`user` nullable → cho phép anonymous) |
| Token | `token` | UUID 36 ký tự, unique toàn hệ thống |
| Vòng đời | `status`, `sentAt`, `expiresAt`, `acceptedAt`, `rejectedAt`, `revokedAt`, `revokedReason` | Theo dõi toàn bộ vòng đời |
| Metadata | `note`, `resendCount` | Ghi chú, đếm số lần gửi lại |
| **Anonymous** | `anonymous`, `guestName`, `guestEmail`, `accessCode`, `oneTimeToken`, `maxAccessTime`, `maxAccessAttempts`, `accessAttemptCount` | Trạng thái riêng cho kênh ẩn danh |

**Mục đích:** Đây là "trái tim" dữ liệu của module. Bảng `exam_invitation` được seed tự động bởi Hibernate (`ddl-auto=update` trong dev) — không cần tạo Flyway/Liquibase migration.

#### `InvitationStatus.java` — enum 7 trạng thái
- **Vị trí:** `backend/src/main/java/com/example/starter_project_2025/system/exam/domain/InvitationStatus.java`
- **Các giá trị:** `PENDING`, `SENT`, `ACCEPTED`, `REJECTED`, `EXPIRED`, `REVOKED`, `COMPLETED`

**Sơ đồ chuyển trạng thái (state machine):**

```
                    ┌──────────┐
   create() ───────►│ PENDING  │──send email──►┌───────┐
                    └──────────┘                │  SENT │
                            │                    └───────┘
                            │ student accept              student reject
                            ▼                              ▼
                      ┌───────────┐                ┌───────────┐
                      │ ACCEPTED  │                │ REJECTED  │
                      └─────┬─────┘                └───────────┘
                            │ (thi xong)
                            ▼
                      ┌───────────┐
                      │ COMPLETED │
                      └───────────┘

  ┌──────────┐  revoke()  ┌──────────┐
  │ (mọi)    ├───────────►│ REVOKED  │  (terminal)
  └──────────┘            └──────────┘

  ┌──────────┐  quá hạn   ┌──────────┐
  │ (chưa XL)├───────────►│ EXPIRED  │  (terminal)
  └──────────┘            └──────────┘
```

**Mục đích:** Enum đảm bảo status luôn nằm trong tập giá trị hữu hạn — không thể lưu string bậy vào DB. Dùng `@Enumerated(EnumType.STRING)` để DB lưu text dễ đọc.

#### `InvitationRepository.java` — tầng truy vấn
- **Vị trí:** `backend/src/main/java/com/example/starter_project_2025/system/exam/domain/InvitationRepository.java`
- **Extends:** `BaseCrudRepository<Invitation, Long>` (đã có sẵn CRUD cơ bản)
- **11 method query:**

| Query | Dùng ở đâu | Mục đích |
|-------|-----------|----------|
| `findByExamId` | `getInvitationsByExam` (fallback) | Lấy tất cả lời mời của 1 đề thi |
| `findByExamIdAndStatus` | `getInvitationsByExam` (filter status) | Lọc theo trạng thái |
| `findByUserId` | — (chưa dùng) | Lấy lời mời của 1 SV |
| `findByToken` | — (chưa dùng) | Tra cứu bằng token email |
| `findByAccessCode` | `verifyAccessCode`, `createAnonymousSession` | Tra cứu bằng mã ẩn danh |
| `findByExamIdAndUserId` | `getInvitationsByExam` (filter theo SV) | Tìm 1 cặp SV-đề thi |
| `findExpiredPendingInvitations` | — (chưa dùng) | Lời mời PENDING hết hạn của 1 exam |
| `findAllExpiredPendingInvitations` | `InvitationExpiryJob` | Quét hết hạn toàn hệ thống |
| `findAnonymousByExamId` | `getInvitationsByExam` (filter anonymous) | Lọc lời mời ẩn danh |
| `findByUserIdWithExamAndUser` | `getMyInvitations` | `JOIN FETCH` tránh N+1 |
| `existsByExamIdAndUserId` | `createInvitation` | Chống tạo trùng |

**Vì sao `JOIN FETCH` quan trọng?** Khi SV xem `/student/invitations`, cần cả tên đề thi lẫn tên/email người dùng. Nếu dùng `findByUserId`, mỗi dòng sẽ là 1 lazy-load riêng → N+1 query. `JOIN FETCH` gộp hết vào 1 câu.

#### `AnonymousSession.java` — entity phiên thi ẩn danh
- **Vị trí:** `backend/src/main/java/com/example/starter_project_2025/system/exam/domain/AnonymousSession.java`
- **Bảng:** `anonymous_session`
- **Cột:** `invitation_id` (FK), `sessionToken` (unique), `fingerprint`, `accessedAt`, `completedAt`, `ipAddress`, `userAgent`, `isValid`

**Mục đích:** Mỗi lần SV ẩn danh vào thi = 1 dòng mới. Giúp audit "ai vào từ thiết bị nào, lúc nào". Cờ `isValid` cho phép soft-invalidate khi session idle.

#### `AnonymousSessionRepository.java` — truy vấn phiên
- **Vị trí:** `backend/src/main/java/com/example/starter_project_2025/system/exam/domain/AnonymousSessionRepository.java`
- **6 method:** `findBySessionToken`, `findByInvitationId`, `findValidByInvitationId`, `countByInvitationId`, `findStaleSessions`, `findByInvitationIdAndFingerprint`

**Mục đích:** `findStaleSessions` là trọng tâm — dùng trong `AnonymousSessionCleanupJob` để quét session idle quá TTL. `findByInvitationIdAndFingerprint` là cơ chế chống copy link sang máy khác.

---

### 2.2 Backend — DTO Layer (9 file)

| File | Mục đích |
|------|--------|
| `InvitationDTO.java` | Response chính, extends `BaseDTO` (id, isActive, createdAt…) |
| `InvitationCreateRequest.java` | Input tạo 1 lời mời có tài khoản: `{userId, note, expiresAt}` |
| `BatchInvitationRequest.java` | Input tạo nhiều: `{invitations[], sendEmail}` |
| `BatchInvitationResponse.java` | Kết quả batch: `{totalRequested, successCount, failureCount, successfulInvitations[], errors[]}` |
| `AnonymousInvitationRequest.java` | Input tạo lời mỏi ẩn danh: `{studentName, studentEmail, note, expiresAt, maxAccessTime, maxAccessAttempts}` |
| `AnonymousAccessResponse.java` | Kết quả verify mã: `{valid, accessCode, examTitle, studentName, accessAttemptsRemaining, message}` |
| `AnonymousSessionRequest.java` | Input tạo session: `{accessCode, fingerprint}` |
| `AnonymousSessionResponse.java` | Kết quả tạo session: `{valid, sessionToken, examTitle, durationMinutes, message}` |
| `InvitationFilter.java` | Bộ lọc query: `{status, anonymous, userId, userIds[]}` |

**Điểm thiết kế quan trọng — `@JsonProperty(access = READ_ONLY)`:**
```java
@JsonProperty(access = READ_ONLY)
private String token;

@JsonProperty(access = READ_ONLY)
private String accessCode;

@JsonProperty(access = READ_ONLY)
private String oneTimeToken;

@JsonProperty(access = READ_ONLY)
private Integer accessAttemptCount;
```
Các field `token`, `accessCode`, `oneTimeToken`, `accessAttemptCount`… được đánh dấu **READ_ONLY** → Jackson sẽ serialize ra response nhưng **không deserialize** vào request. Ý nghĩa: client có thể đọc mã truy cập để hiển thị/copy, nhưng **không thể giả mạo token/accessCode** từ phía client khi POST/PATCH lên server. Đây là lớp chống giả mạo ở tầng DTO.

**`sendEmail` trong BatchInvitationRequest là dead-field**: Service `createBatchInvitations` **không hề đọc** field này — mỗi lời mời luôn gửi email qua `createInvitation`.

---

### 2.3 Backend — Service Layer

#### `InvitationService.java` — trái tim module (~500 dòng)
- **Vị trí:** `backend/src/main/java/com/example/starter_project_2025/system/exam/service/InvitationService.java`

**Dependency inject (constructor injection qua Lombok `@RequiredArgsConstructor`):**
```java
private final InvitationRepository invitationRepository;
private final AnonymousSessionRepository anonymousSessionRepository;
private final ExamRepository examRepository;
private final UserRepository userRepository;
private final EmailService emailService;

@Value("${app.frontend-domain}")
private String frontendUrl;

private static final String ACCESS_CODE_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
private static final int ACCESS_CODE_LENGTH = 8;
private static final SecureRandom random = new SecureRandom();
```

**Hằng số sinh mã truy cập:** 36 ký tự (26 chữ cái + 10 số), dài 8 → tránh chữ `0/O`, `1/I/L` gây nhầm khi đọc/copy tay từ QR. `SecureRandom` thay vì `Random` vì đây là **bí mật bảo mật**.

---

##### Method: `parseDateTime(String)` — private helper

**Mục đích:** Frontend gửi `new Date(input).toISOString()` → luôn có `Z` suffix (UTC). Nếu parse thẳng bằng `LocalDateTime.parse` sẽ fail vì chuỗi có timezone. Service fallback sang `ZonedDateTime.parse` rồi quy về system timezone.

```java
private LocalDateTime parseDateTime(String value) {
    if (value == null || value.isBlank()) return null;
    try {
        return LocalDateTime.parse(value, DateTimeFormatter.ISO_LOCAL_DATE_TIME);
    } catch (DateTimeParseException e1) {
        try {
            ZonedDateTime zdt = ZonedDateTime.parse(value, DateTimeFormatter.ISO_ZONED_DATE_TIME);
            return zdt.withZoneSameInstant(ZoneId.systemDefault()).toLocalDateTime();
        } catch (DateTimeParseException e2) {
            throw new BadRequestException("Invalid datetime format: " + value + ...);
        }
    }
}
```
3 tầng fallback: rỗng → local → zoned → báo lỗi có message rõ ràng.

---

##### Method: `createInvitation()` — tạo lời mời có tài khoản

```java
@Transactional
public InvitationDTO createInvitation(Long examId, InvitationCreateRequest request, UserPrincipal principal) {
    // 1. Chặn role không phù hợp
    boolean isAdminOrTeacher = principal.getUser().getRoles().stream()
            .anyMatch(r -> "ADMIN".equals(r.getName()) || "TEACHER".equals(r.getName()));
    if (!isAdminOrTeacher) throw new BadRequestException("...");

    // 2. Exam phải tồn tại + active
    Exam exam = examRepository.findById(examId)
            .filter(e -> Boolean.TRUE.equals(e.getIsActive()))
            .orElseThrow(() -> new ResourceNotFoundException("..."));

    // 3. User phải tồn tại + active
    User user = userRepository.findById(request.getUserId())
            .filter(u -> Boolean.TRUE.equals(u.getIsActive()))
            .orElseThrow(() -> new ResourceNotFoundException("..."));

    // 4. Chống trùng
    if (invitationRepository.existsByExamIdAndUserId(examId, user.getId()))
        throw new BadRequestException("Invitation already exists for this user and exam");

    // 5. Tạo entity
    Invitation invitation = Invitation.builder()
            .exam(exam).user(user)
            .token(generateToken())
            .status(InvitationStatus.PENDING)
            .expiresAt(...)        // business rule 3 tầng
            .note(request.getNote())
            .anonymous(false)
            .build();

    invitation = invitationRepository.save(invitation);

    // 6. Gửi email
    emailService.sendExamInvitation(invitation, user);

    // 7. Chuyển PENDING → SENT
    invitation.setStatus(InvitationStatus.SENT);
    invitation.setSentAt(LocalDateTime.now());
    return toDTO(invitationRepository.save(invitation));
}
```

**Mục đích từng bước:**

| Bước | Mục đích |
|------|---------|
| 1 | `@PreAuthorize("hasAuthority('INVITATION_CREATE')")` ở controller chỉ kiểm tra **permission**. Service kiểm tra thêm **role thật** → defense in depth (2 tầng) |
| 2 | Dùng `.filter(...)` thay `if` → gọn, throw tự động nếu không active |
| 3 | Chống mời user đã bị disabled |
| 4 | 1 user chỉ có 1 lời mời / đề thi |
| 5 | **Business rule hạn chót 3 tầng**: user chỉ định → `exam.endTime` → mặc định +30 ngày |
| 6 | Gửi email chứa token |
| 7 | PENDING là trạng thái "đã tạo chưa gửi". Sau khi gửi thành công mới SENT. Nếu email fail, transaction rollback → vẫn PENDING |

**Lưu ý:** `save()` được gọi 2 lần — lần 1 để có `id` gửi email, lần 2 để persist status SENT. Không phải code thừa, là chủ ý.

---

##### Method: `createBatchInvitations()` — tạo hàng loạt

```java
@Transactional
public BatchInvitationResponse createBatchInvitations(Long examId, BatchInvitationRequest request, UserPrincipal principal) {
    boolean isAdminOrTeacher = ... // check role
    Exam exam = examRepository.findById(examId).filter(active)...;

    List<InvitationDTO> successful = new ArrayList<>();
    List<String> errors = new ArrayList<>();

    for (InvitationCreateRequest invRequest : request.getInvitations()) {
        try {
            InvitationDTO dto = createInvitation(examId, invRequest, principal);
            successful.add(dto);
        } catch (Exception e) {
            errors.add("User ID " + invRequest.getUserId() + ": " + e.getMessage());
        }
    }

    return BatchInvitationResponse.builder()...build();
}
```

**Mục đích:** **Partial success** — 1 SV lỗi không làm hỏng cả batch. Mỗi lỗi được thu thập vào `errors[]` với prefix "User ID X: " để admin biết chính xác dòng nào fail. Exception bị catch trong loop nên transaction **vẫn commit** phần thành công.

---

##### Method: `getInvitationsByExam()` — lọc có điều kiện

```java
@Transactional(readOnly = true)
public List<InvitationDTO> getInvitationsByExam(Long examId, InvitationFilter filter) {
    if (filter != null && filter.getUserIds() != null && !filter.getUserIds().isEmpty()) {
        // join theo userIds[]
    } else if (filter != null && filter.getStatus() != null) {
        invitations = invitationRepository.findByExamIdAndStatus(examId, filter.getStatus());
    } else if (filter != null && Boolean.TRUE.equals(filter.getAnonymous())) {
        invitations = invitationRepository.findAnonymousByExamId(examId);
    } else {
        invitations = invitationRepository.findByExamId(examId);
    }
    return invitations.stream().map(this::toDTO).toList();
}
```

**Mục đích:** if-else-if phân nhánh theo thứ tự ưu tiên `userIds` > `status` > `anonymous` > tất cả. Chỉ 1 query được fire mỗi lần gọi. `readOnly = true` vì chỉ đọc → Hibernate bỏ qua dirty-checking.

**Lưu ý:** Filter `userId` (singular) trong `InvitationFilter` **không được dùng** — service chỉ check `userIds` (plural).

---

##### Method: `getMyInvitations()` — SV xem lời mời của mình

```java
@Transactional(readOnly = true)
public List<InvitationDTO> getMyInvitations(@AuthenticationPrincipal UserPrincipal currentUser) {
    List<Invitation> invitations = invitationRepository.findByUserIdWithExamAndUser(currentUser.getUser().getId());
    return invitations.stream().map(this::toDTO).toList();
}
```

**Mục đích:** Lấy lời mời của chính SV đang đăng nhập. `@AuthenticationPrincipal` inject thẳng vào service param — rút gọn so với viết `Authentication authentication` rồi `getPrincipal()` thủ công.

---

##### Method: `acceptInvitation()` / `rejectInvitation()`

```java
@Transactional
public InvitationDTO acceptInvitation(Long id, UserPrincipal currentUser) {
    Invitation invitation = invitationRepository.findById(id)
            .orElseThrow(() -> new ResourceNotFoundException("..."));

    // Verify ownership
    if (invitation.getUser() == null || !invitation.getUser().getId().equals(currentUser.getUser().getId()))
        throw new BadRequestException("You are not authorized to accept this invitation");

    validateInvitationForAction(invitation);

    invitation.setStatus(InvitationStatus.ACCEPTED);
    invitation.setAcceptedAt(LocalDateTime.now());
    emailService.sendExamAcceptance(invitation);
    return toDTO(invitationRepository.save(invitation));
}
```

**Mục đích & bảo mật:**
1. **Ownership check** — SV A không thể accept lời mời của SV B, dù đoán đúng `id`. Đây là **IDOR protection**.
2. `validateInvitationForAction` — chặn thao tác trên lời mời đã hết hạn/đã xử lý.
3. `accept` gửi email xác nhận **ngược lại** cho giáo viên; `reject` **không gửi** (giảm spam).

---

##### Method: `revokeInvitation()` — thu hồi

```java
@Transactional
public InvitationDTO revokeInvitation(Long id, String reason) {
    Invitation invitation = invitationRepository.findById(id).orElseThrow(...);

    if (invitation.getStatus() == InvitationStatus.REVOKED ||
        invitation.getStatus() == InvitationStatus.COMPLETED)
        throw new BadRequestException("Cannot revoke invitation with status: " + invitation.getStatus());

    invitation.setStatus(InvitationStatus.REVOKED);
    invitation.setRevokedAt(LocalDateTime.now());
    invitation.setRevokedReason(reason);

    if (invitation.getUser() != null)      // chỉ gửi email nếu có user
        emailService.sendExamRevoked(invitation);

    return toDTO(invitationRepository.save(invitation));
}
```

**Mục đích:** Giáo viên thu hồi lời mời (đề thi sai, SV không đủ điều kiện…). Có guard chống revoke 2 lần. `if (getUser() != null)` — anonymous không có email hệ thống nên skip.

---

##### Method: `resendInvitation()` — gửi lại

```java
public InvitationDTO resendInvitation(Long id) {
    Invitation invitation = invitationRepository.findById(id).orElseThrow(...);
    if (invitation.getUser() == null) throw new BadRequestException("Cannot resend anonymous invitation");
    if (status == REVOKED || COMPLETED) throw ...;

    invitation.setToken(generateToken());          // ← rotate token
    invitation.setResendCount(invitation.getResendCount() + 1);
    emailService.sendExamInvitation(invitation, invitation.getUser());
    invitation.setSentAt(LocalDateTime.now());
    invitation.setStatus(InvitationStatus.SENT);
    return toDTO(invitationRepository.save(invitation));
}
```

**Điểm bảo mật quan trọng:** `generateToken()` mới → **token cũ vô hiệu**. Nếu email đầu bị lộ, gửi lại làm link cũ chết. Đây là **token rotation** chống link leakage.

---

##### Method: `generateQRCode()` — sinh QR PNG

```java
@Transactional(readOnly = true)
public byte[] generateQRCode(Long invitationId) {
    Invitation invitation = invitationRepository.findById(invitationId).orElseThrow(...);
    if (!Boolean.TRUE.equals(invitation.getAnonymous()))
        throw new BadRequestException("QR code can only be generated for anonymous invitations");

    String url = buildAnonymousAccessUrl(invitation);
    return generateQRCodeImage(url, 300, 300);
}
```

**Mục đích:** Chỉ lời mời ẩn danh mới có QR (lời mời có tài khoản thì có account đăng nhập rồi). Nội dung QR là URL frontend `/anonymous-exam?code=X&token=Y`.

---

##### Method: `createAnonymousInvitation()` — tạo lời mời ẩn danh

```java
@Transactional
public InvitationDTO createAnonymousInvitation(Long examId, AnonymousInvitationRequest request, UserPrincipal principal) {
    boolean isAdminOrTeacher = ... // check role
    Exam exam = examRepository.findById(examId).filter(active).orElseThrow(...);

    String accessCode = generateAccessCode();       // 8 ký tự random
    String oneTimeToken = UUID.randomUUID().toString();

    Invitation invitation = Invitation.builder()
            .exam(exam)
            .user(null)                             // ← anonymous = không có RBAC account
            .token(generateToken())
            .status(InvitationStatus.SENT)          // ← thẳng SENT, không qua PENDING
            .sentAt(LocalDateTime.now())
            .expiresAt(...)
            .note(request.getNote())
            .anonymous(true)
            .guestName(request.getStudentName())
            .guestEmail(request.getStudentEmail())
            .accessCode(accessCode)
            .oneTimeToken(oneTimeToken)
            .maxAccessTime(...)
            .maxAccessAttempts(...)
            .build();

    invitation = invitationRepository.save(invitation);
    emailService.sendAnonymousAccessLink(invitation, request.getStudentEmail());
    return toDTO(invitation);
}
```

**Khác biệt then chốt so với `createInvitation`:**

| | Có tài khoản | Ẩn danh |
|---|---|---|
| `user` | Bắt buộc | `null` |
| `status` khởi tạo | `PENDING` → `SENT` | `SENT` luôn |
| Định danh người thi | `userId` | `guestName` + `guestEmail` + `accessCode` |
| Email chứa | Link có JWT token | Link có mã truy cập |
| Cơ chế chống gian lận | JWT + account | `maxAccessAttempts` + `fingerprint` |

---

##### Method: `verifyAccessCode()` — kiểm tra mã (public)

```java
@Transactional(readOnly = true)
public AnonymousAccessResponse verifyAccessCode(String accessCode) {
    Invitation invitation = invitationRepository.findByAccessCode(accessCode)
            .orElseThrow(() -> new ResourceNotFoundException("Invalid access code"));

    if (!Boolean.TRUE.equals(invitation.getAnonymous()))
        throw new BadRequestException("Invalid access code");

    if (status == REVOKED || status == EXPIRED)
        return AnonymousAccessResponse.builder().valid(false)
                .message("This invitation has been revoked or expired").build();

    if (invitation.getExpiresAt() != null && LocalDateTime.now().isAfter(invitation.getExpiresAt())) {
        invitation.setStatus(InvitationStatus.EXPIRED);
        invitationRepository.save(invitation);   // ← GHI trong readOnly=true
        return ...valid(false).message("This invitation has expired").build();
    }

    int remaining = invitation.getMaxAccessAttempts() - invitation.getAccessAttemptCount();
    return AnonymousAccessResponse.builder().valid(true)...build();
}
```

**Mục đích:** Bước kiểm tra mã trước khi tạo session. Trả về `valid: true/false` + thông tin để UI hiển thị.

> **Lưu ý:** `readOnly = true` nhưng lại **ghi** status EXPIRED → đây là **lỗi thiết kế nhỏ**: annotation readOnly khiến Hibernate bỏ qua dirty-checking, thay đổi có thể không được flush.

---

##### Method: `createAnonymousSession()` — tạo phiên thi ẩn danh

```java
@Transactional
public AnonymousSessionResponse createAnonymousSession(String accessCode, String fingerprint) {
    Invitation invitation = invitationRepository.findByAccessCode(accessCode).orElseThrow(...);

    if (!Boolean.TRUE.equals(invitation.getAnonymous()))
        throw new BadRequestException("Invalid access code");

    validateInvitationForAction(invitation);

    // Layer 2: Check access attempts
    if (invitation.getAccessAttemptCount() >= invitation.getMaxAccessAttempts())
        throw new BadRequestException("Maximum access attempts reached for this invitation");

    // Layer 3: Check for duplicate fingerprint
    if (fingerprint != null) {
        anonymousSessionRepository.findByInvitationIdAndFingerprint(invitation.getId(), fingerprint)
                .ifPresent(session -> { throw new BadRequestException("This device has already accessed this exam"); });
    }

    // Increment access count
    invitation.setAccessAttemptCount(invitation.getAccessAttemptCount() + 1);
    invitationRepository.save(invitation);

    // Create session
    String sessionToken = generateToken();
    AnonymousSession session = AnonymousSession.builder()
            .invitation(invitation).sessionToken(sessionToken)
            .fingerprint(fingerprint).accessedAt(LocalDateTime.now()).isValid(true).build();
    anonymousSessionRepository.save(session);

    return AnonymousSessionResponse.builder().valid(true).sessionToken(sessionToken)...build();
}
```

**4 lớp chống gian lận — đây là phần giá trị nhất của module:**

| Lớp | Cơ chế | Chặn trường hợp |
|------|--------|------------------|
| 1 | `validateInvitationForAction` | Lời mời revoked/expired/đã dùng |
| 2 | `accessAttemptCount >= maxAccessAttempts` | Chia sẻ mã cho nhiều người → hết lượt |
| 3 | `findByInvitationIdAndFingerprint` | Copy link sang máy/người khác trên cùng thiết bị |
| 4 | `generateToken()` random mới | Đoán session token |

> **Lưu ý:** Frontend hiện gọi `createAnonymousSession({ accessCode: code })` **không truyền fingerprint** → lớp bảo mật #3 **hiện không kích hoạt**.

---

##### Helper: `validateInvitationForAction()` — cổng kiểm tra trạng thái

```java
private void validateInvitationForAction(Invitation invitation) {
    if (status == REVOKED) throw new BadRequestException("Invitation has been revoked");
    if (status == EXPIRED || (expiresAt != null && now.isAfter(expiresAt))) {
        invitation.setStatus(InvitationStatus.EXPIRED);
        invitationRepository.save(invitation);
        throw new BadRequestException("Invitation has expired");
    }
    if (status == ACCEPTED) throw new BadRequestException("Invitation has already been accepted");
    if (status == REJECTED) throw new BadRequestException("Invitation has already been rejected");
}
```

**Mục đích:** Cổng kiểm tra duy nhất, tái sử dụng cho `accept`, `reject`, `createAnonymousSession`. **Lazy expiration** — phát hiện quá hạn thì set status luôn rồi mới throw, giúp dữ liệu luôn nhất quán ngay cả chưa đến lúc job chạy.

> **Lưu ý:** method này **không chặn `COMPLETED`**.

---

##### Helpers: sinh token / mã / QR / URL

```java
private String generateToken() {
    return UUID.randomUUID().toString();          // 36 ký tự
}

private String generateAccessCode() {
    StringBuilder sb = new StringBuilder(ACCESS_CODE_LENGTH);
    for (int i = 0; i < ACCESS_CODE_LENGTH; i++)
        sb.append(ACCESS_CODE_CHARS.charAt(random.nextInt(ACCESS_CODE_CHARS.length())));
    return sb.toString();                          // 8 ký tự
}

private String buildAnonymousAccessUrl(Invitation invitation) {
    return frontendUrl + "/anonymous-exam?code=" + invitation.getAccessCode()
            + "&token=" + invitation.getOneTimeToken();
}

private byte[] generateQRCodeImage(String content, int width, int height) {
    QRCodeWriter qrCodeWriter = new QRCodeWriter();
    BitMatrix bitMatrix = qrCodeWriter.encode(content, BarcodeFormat.QR_CODE, width, height);
    ByteArrayOutputStream outputStream = new ByteArrayOutputStream();
    MatrixToImageWriter.writeToStream(bitMatrix, "PNG", outputStream);
    return outputStream.toByteArray();
}
```

**Mục đích từng thứ:**
- `generateToken()` — token email & session token, dùng UUID vì không cần gõ tay, độ dài không quan trọng.
- `generateAccessCode()` — 8 ký tự vì **người dùng phải nhập tay**, không quá dài, không quá ngắn (36^8 ≈ 2.8 nghìn tỷ khả năng).
- `buildAnonymousAccessUrl` — dùng `@Value("${app.frontend-domain}")` thay vì hardcode → deploy được nhiều môi trường.
- `generateQRCodeImage` — dùng **Google ZXing**, trả `byte[]` để controller set content-type `image/png`.

---

##### Helper: `toDTO()` — mapper thủ công

```java
private InvitationDTO toDTO(Invitation invitation) {
    ...
    dto.setUserFullName(invitation.getUser() != null
        ? invitation.getUser().getFullName() : invitation.getGuestName());   // ← fallback
    dto.setUserEmail(invitation.getUser() != null
        ? invitation.getUser().getEmail() : invitation.getGuestEmail());
    ...
}
```

**Điểm hay:** Field `userFullName`/`userEmail` được **fallback** từ `user` sang `guest` → frontend chỉ cần 1 cột hiển thị, không cần rẽ nhánh có/không account.

**Vì sao map thủ công, không dùng MapStruct?** Có fallback logic → MapStruct xử lý được nhưng cần viết `@Mapping(expression=...)` phức tạp hơn viết tay. Với 25 field, map tay rõ và nhanh hơn.

---

### 2.4 Backend — Controller Layer (2 controller)

#### `InvitationController.java` — 10 endpoint quản lý + SV
- **Vị trí:** `backend/src/main/java/com/example/starter_project_2025/system/exam/controller/InvitationController.java`

| Method | Endpoint | Permission | Công dụng |
|--------|----------|-----------|----------|
| POST | `/api/exams/{examId}/invitations` | `INVITATION_CREATE` | Tạo 1 lời mời có tài khoản |
| POST | `/api/exams/{examId}/invitations/batch` | `INVITATION_CREATE` | Tạo hàng loạt |
| GET | `/api/exams/{examId}/invitations` | `INVITATION_READ` | Danh sách + filter |
| GET | `/api/invitations/{id}` | `INVITATION_READ` | Chi tiết 1 lời mời |
| PATCH | `/api/invitations/{id}/revoke` | `INVITATION_DELETE` | Thu hồi |
| POST | `/api/invitations/{id}/resend` | `INVITATION_UPDATE` | Gửi lại email |
| GET | `/api/invitations/{id}/qr` | `INVITATION_READ` | QR PNG (`image/png`) |
| GET | `/api/invitations/my` | `INVITATION_READ`/`EXAM_TAKE` | SV xem lời mời của mình |
| PATCH | `/api/invitations/{id}/accept` | `isAuthenticated()` | SV chấp nhận |
| PATCH | `/api/invitations/{id}/reject` | `isAuthenticated()` | SV từ chối |

**Điểm thiết kế — 3 tầng bảo mật:**
```java
@PostMapping("/exams/{examId}/invitations")
@PreAuthorize("hasAuthority('INVITATION_CREATE')")
public ResponseEntity<InvitationDTO> create(...) {
    return ResponseEntity.ok(service.createInvitation(examId, request, principal));
}
```
- `@PreAuthorize` chặn **permission** (tầng 1)
- Service check **role thật** (tầng 2)
- Service check **ownership** (tầng 3, cho endpoint của SV)

**QR response với `produces = MediaType.IMAGE_PNG_VALUE`:**
```java
@GetMapping(value = "/invitations/{id}/qr", produces = MediaType.IMAGE_PNG_VALUE)
@PreAuthorize("hasAuthority('INVITATION_READ')")
public ResponseEntity<byte[]> generateQR(@PathVariable Long id) {
    byte[] png = service.generateQRCode(id);
    return ResponseEntity.ok()
            .contentType(MediaType.IMAGE_PNG)
            .header(HttpHeaders.CONTENT_DISPOSITION, "inline; filename=\"invitation-" + id + ".png\"")
            .body(png);
}
```
Swagger hiển thị đúng type, và `Content-Disposition: inline` để browser hiển thị trực tiếp thay vì tải về.

---

#### `AnonymousAccessController.java` — 3 endpoint public
- **Vị trí:** `backend/src/main/java/com/example/starter_project_2025/system/exam/controller/AnonymousAccessController.java`

| Method | Endpoint | Công dụng |
|--------|----------|----------|
| POST | `/api/exams/{examId}/invitations/anonymous` | GV tạo link ẩn danh (`INVITATION_CREATE`) |
| GET | `/api/exams/verify-access/{code}` | Public: kiểm tra mã |
| POST | `/api/exams/anonymous-session` | Public: đổi mã lấy session token |

**Vì sao tách controller riêng?** Phản ánh đúng **security boundary**: controller này nằm ngoài authenticated zone. 2 endpoint public phải được thêm vào `PUBLIC_ENDPOINTS` trong `SecurityConfig`.

---

### 2.5 Backend — Security Config

```java
public static final String[] PUBLIC_ENDPOINTS = {
    "/",
    "/index.html",
    "/actuator/health",
    "/swagger-ui.html",
    "/swagger-ui/**",
    "/v3/api-docs/**",
    "/ws/**",
    "/public/**",
    "/login",
    "/oauth2/**",
    "/login/oauth2/**",
    "/verify/**",
    "/api/auth/**",
    "/h2-console/**",
    // Anonymous exam access - students without a platform account
    "/api/exams/verify-access/**",
    "/api/exams/anonymous-session",
    "/api/exams/anonymous/**",
    "/h2-console/**"   // ← duplicate
};
```

- **Vị trí:** `backend/src/main/java/com/example/starter_project_2025/security/SecurityConfig.java`

**Mục đích:** Cho phép người không có tài khoản truy cập 2 endpoint mà không cần JWT. Điều kiện **tiên quyết** để anonymous flow hoạt động.

> **Lưu ý:** `"/h2-console/**"` bị **duplicate 2 lần**. Vô hại về mặt chức năng nhưng là code redundancy.

---

### 2.6 Backend — Scheduled Jobs (2 file)

#### `InvitationExpiryJob.java` — tự động đánh dấu hết hạn
- **Vị trí:** `backend/src/main/java/com/example/starter_project_2025/system/exam/job/InvitationExpiryJob.java`

```java
@Scheduled(fixedRateString = "${app.invitation.expiry-interval-ms:300000}")   // mặc định 5 phút
@Transactional
public void expireInvitations() {
    try {
        LocalDateTime now = LocalDateTime.now();
        List<Invitation> expired = invitationRepository.findAllExpiredPendingInvitations(now);
        if (expired.isEmpty()) return;

        for (Invitation invitation : expired)
            invitation.setStatus(InvitationStatus.EXPIRED);
        invitationRepository.saveAll(expired);

        log.info("InvitationExpiryJob expired {} invitation(s)", expired.size());
    } catch (Exception e) {
        log.error("InvitationExpiryJob failed: {}", e.getMessage(), e);
    }
}
```

**Mục đích & thiết kế:**
- `fixedRateString` với giá trị mặc định → **configurable qua `application.yml`, không cần sửa code**.
- `try/catch` bọc toàn bộ → **job lỗi không làm chết app** (Spring đã handle, nhưng catch để log đầy đủ stack).
- Query chỉ lấy `status = PENDING` → **không đụng lời mời SENT** (lời mời đã gửi có thể chưa hết hạn cũng vậy).
- `if (expired.isEmpty()) return;` → tránh log rác.

> **Vấn đề:** Query chỉ quét `PENDING`, nhưng `createInvitation` set `SENT` ngay sau khi gửi email. Nghĩa là **lời mời đã gửi cho SV sẽ không bao giờ bị job đánh EXPIRED** → SV có thể accept lời mời đã quá hạn. May mắn là `validateInvitationForAction()` còn chặn bằng so sánh `expiresAt` → vẫn an toàn, nhưng status trong DB sai.

---

#### `AnonymousSessionCleanupJob.java` — dọn session ẩn danh
- **Vị trí:** `backend/src/main/java/com/example/starter_project_2025/system/exam/job/AnonymousSessionCleanupJob.java`

```java
@Scheduled(cron = "${app.anonymous.cleanup-cron:0 0 3 * * *}")     // 3:00 AM hàng ngày
@Transactional
public void cleanup() {
    try {
        LocalDateTime now = LocalDateTime.now();

        // 1. Vô hiệu session idle quá TTL
        LocalDateTime staleBefore = now.minusHours(sessionTtlHours);      // default 24h
        List<AnonymousSession> stale = anonymousSessionRepository.findStaleSessions(staleBefore);
        for (AnonymousSession session : stale) session.setIsValid(false);
        if (!stale.isEmpty()) {
            anonymousSessionRepository.saveAll(stale);
            log.info("... invalidated {} stale session(s)", stale.size());
        }

        // 2. Xóa hẳn session quá hạn lưu trữ
        List<AnonymousSession> expired = anonymousSessionRepository
                .findStaleSessions(now.minusDays(retentionDays)); // default 30 ngày
        if (!expired.isEmpty()) {
            anonymousSessionRepository.deleteAll(expired);
            log.info("... purged {} session(s) older than {} days", expired.size(), retentionDays);
        }
    } catch (Exception e) {
        log.error("AnonymousSessionCleanupJob failed: {}", e.getMessage(), e);
    }
}
```

**Mục đích:** 2 tầng dọn dẹp:
1. **Invalidate** (soft) — session idle > 24h → `isValid = false`, vẫn giữ để audit.
2. **Purge** (hard delete) — > 30 ngày → xóa hẳn, giữ DB nhỏ.

**Về `@Value` + `cron`:** 3 biến config (`session-ttl-hours`, `retention-days`, `cleanup-cron`) → dev có thể chỉnh TTL mà không cần build lại.

> **Lưu ý:** Bước 2 dùng lại `findStaleSessions()` — cùng hàm với bước 1 nhưng khác tham số. Tái sử dụng hợp lý, nhưng **tên hàm không còn mô tả đúng** cho bước 2.

---

### 2.7 Frontend — 4 page + 1 component + API layer + Types

#### API Layer: `invitation.api.ts`
- **Vị trí:** `frontend/src/api/features/invitation.api.ts`

**12 method gọi backend, theo 4 nhóm có comment phân tách rõ:**

```typescript
export const invitationApi = {
    // ---------- Management ----------
    create, createBatch, getByExam, getById, revoke, resend, getQrDataUrl,
    // ---------- Student ----------
    getMyInvitations, accept, reject,
    // ---------- Anonymous ----------
    createAnonymous, verifyAccessCode, createAnonymousSession,
    // ---------- Reminders ----------
    scheduleReminder, getReminders, cancelReminder,
};
```

**Điểm hay — `getQrDataUrl` với helper `toDataUrl`:**
```typescript
const toDataUrl = (blob: Blob) =>
    new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(blob);
    });
```

**Mục đích:** Backend trả `image/png` (binary). Frontend muốn dùng trong `<img src={...}>` **mà không cần auth token** → convert blob → base64 data URL (`data:image/png;base64,...`) → gán thẳng vào `src`. Nhờ vậy không cần `<img>` fetch kèm header, và **download QR** chỉ cần `a.href = qrDataUrl`.

---

#### Page 1: `InvitationsLandingPage`
- **Đường dẫn:** `/invitations`
- **File:** `frontend/src/pages/management/exam/invitations/index.tsx`

```tsx
export default function InvitationsLandingPage() {
    const navigate = useNavigate();
    const [search, setSearch] = useState("");
    const examsQuery = useQuery({
        queryKey: ["invitations-landing-exams", search],
        queryFn: () => examApi.getPage({ page: 0, size: 100, sort: "createdAt,desc" }, search),
    });
    const exams = examsQuery.data?.content ?? [];
    ...
}
```

**Mục đích & flow:** Trang trung gian — vì menu `@ResourceMenu(url="/invitations")` cần 1 URL cụ thể, nhưng API lại là `/exams/{examId}/invitations`. Landing page liệt kê đề thi, click vào → điều hướng `/exams/{id}/invitations`.

- `queryKey` chứa `search` → mỗi từ khoá khác là 1 cache entry riêng.
- `page: 0, size: 100` → giới hạn 100 đề thi là đủ cho dropdown chọn.
- Row click **và** nút chevron đều điều hướng, `e.stopPropagation()` trong nút để **tránh navigate 2 lần**.
- 4 trạng thái render đầy đủ: loading / error / empty / data.

---

#### Page 2: `InvitationsPage` — trang lõi (~460 dòng)
- **Đường dẫn:** `/exams/:examId/invitations`
- **File:** `frontend/src/pages/management/exam/invitation/index.tsx`

**a) Query + filter:**
```tsx
const queryKey = ["exam-invitations", numericExamId, statusFilter, typeFilter] as const;
const invitationsQuery = useQuery({
    queryKey,
    queryFn: () => {
        if (!isValidExamId) throw new Error("Invalid exam ID");
        return invitationApi.getByExam(numericExamId, {
            status: statusFilter === "ALL" ? undefined : statusFilter,
            anonymous: typeFilter === "ALL" ? undefined : typeFilter === "anonymous",
        });
    },
    enabled: isValidExamId,
    retry: false,
});
```

- `isValidExamId = !isNaN(numericExamId) && numericExamId > 0` → chặn NaN **trước khi** gọi API.
- `enabled: isValidExamId` → React Query **không gọi** nếu invalid.
- `retry: false` → URL nhập sai không nên spam retry 3 lần.
- `typeFilter === "ALL" ? undefined` → **undefined** khiến axios **không gửi** param (thay vì gửi `null`).

**b) Dynamic import tải tên đề thi:**
```tsx
useEffect(() => {
    const loadExamTitle = async () => {
        if (!isValidExamId) return;
        try {
            const { examApi } = await import("@/api");
            const exam = await examApi.getById(String(numericExamId));
            if (exam.title) setExamTitle(exam.title);
        } catch { /* ignore */ }
    };
    loadExamTitle();
}, [numericExamId, isValidExamId]);
```
Trang này chỉ nhận `examId` từ URL, không có tên đề thi. Dynamic `import()` để **code-split** `examApi` → giảm bundle initial load.

**c) Render table:**
- Cột "Loại" hiển thị `<Users/> Không account` vs `<Mail/> Có account` — phân biệt trực quan 2 kênh.
- Cột "Mã truy cập" có nút copy inline (chỉ hiện khi `inv.accessCode` có giá trị).
- Dropdown menu **động theo loại**: anonymous không có "Gửi lại email" (không có email hệ thống), có "Xem QR Code"; authenticated thì ngược lại.
- Nút "Thu hồi" disabled khi status `REVOKED` hoặc `COMPLETED` → mirror guard phía server.

**d) 2 Dialog (revoke + QR):** Dialog revoke nhận lý do → `revoke(id, reason)`. Dialog QR: `<img src={`${VITE_API_URL}/invitations/${id}/qr`}>` — dùng URL trực tiếp (không qua api layer) vì `INVITATION_READ` check chỉ cần cookie/token của browser.

---

#### Component: `CreateInvitationModal`
- **File:** `frontend/src/components/features/invitation/CreateInvitationModal.tsx`

Modal 2 tab, giải quyết 2 kênh mời bằng 1 UI:

| Tab | Nội dung | API gọi |
|-----|----------|---------|
| **"Tài khoản có sẵn"** | `UserPicker` + note + hạn chót + nhắc nhở | `invitationApi.create` + `scheduleReminder` |
| **"Link chia sẻ"** | chỉ input "Số lần thi tối đa" | `invitationApi.createAnonymous` + `getQrDataUrl` |

**`UserPicker` tách component:**
```tsx
function UserPicker({ value, onChange }) {
    const [search, setSearch] = useState("");
    const { data: users, isLoading } = useQuery({
        queryKey: ["user-picker", search],
        queryFn: async () => {
            const { userApi } = await import("@/api");
            return userApi.getPage({ page: 0, size: 20, sort: "firstName,asc" }, search);
        },
        enabled: search.length >= 2,      // ← chỉ tìm khi ≥ 2 ký tự
    });
    ...
}
```
`enabled: search.length >= 2` tránh gọi API mỗi lần gõ 1 ký tự (1 ký tự → trả về gần như toàn bộ DB). Dynamic import `userApi` → code-split.

**Hiển thị kết quả ngay trong modal:**
```tsx
{authInvitations.length > 0 && (
    <div className="border-t pt-4 mt-4">
        <h4 className="font-medium mb-3">Lời mời đã tạo</h4>
        ...
        {authInvitations.map((inv) => (
            <div className="rounded-md border bg-green-50 px-3 py-2 text-sm">
                <span className="text-green-800">✓ {inv.userFullName ?? inv.userEmail}</span>
                <Badge variant="secondary">{inv.status}</Badge>
            </div>
        ))}
    </div>
)}
```
GV tạo 5 SV liên tiếp → thấy ngay 5 dòng "✓ Nguyễn Văn A [SENT]" mà không cần đóng modal. UX tốt cho thao tác lặp.

**`ShareLinkCard` tách component:**
```tsx
function ShareLinkCard({ invitation, qrDataUrl }) {
    const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8080";
    const shareableUrl = invitation.accessCode
        ? `${API_BASE}/anonymous-exam?code=${invitation.accessCode}`
        : null;
    ...
}
```
Mỗi link chia sẻ là 1 "thẻ" gồm 3 phần: mã truy cập (copy), link đầy đủ (copy), QR (tải PNG).

---

#### Page 3: `AnonymousAccessPage` (public)
- **Đường dẫn:** `/anonymous-exam`
- **File:** `frontend/src/pages/exam/AnonymousAccessPage.tsx`

```tsx
export default function AnonymousAccessPage() {
    const [accessCode, setAccessCode] = useState("");
    const [sessionToken, setSessionToken] = useState<string | null>(null);

    // Đọc mã từ URL
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const code = params.get("code");
        if (code) setAccessCode(code.toUpperCase());
    }, []);

    const verifyMutation = useMutation({
        mutationFn: (code: string) => invitationApi.verifyAccessCode(code),
        ...
    });

    const enterMutation = useMutation({
        mutationFn: (code: string) =>
            invitationApi.createAnonymousSession({ accessCode: code }),  // ← thiếu fingerprint
        onSuccess: (data) => {
            ...
            sessionStorage.setItem("anonymous_session_token", data.sessionToken ?? "");
            sessionStorage.setItem("anonymous_exam_title", data.examTitle ?? "");
        },
        ...
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const code = accessCode.trim().toUpperCase();
        if (!code) { toast.error("Vui lòng nhập mã truy cập."); return; }
        verifyMutation.mutate(code);
        enterMutation.mutate(code);       // ← auto-enter luôn
    };
}
```

**Mục đích từng phần:**

| Phần | Mục đích |
|------|---------|
| `useEffect` đọc `?code=` | Cho phép QR/link mở thẳng trang, tự động điền mã → UX 1 chạm |
| `verifyMutation` | Kiểm tra mã trước, hiện alert xanh/đỏ |
| `enterMutation` | Tạo session, lưu token vào `sessionStorage` |
| Gọi cả 2 mutation | Verify chỉ để hiện thông báo; **enter là hành động thật**. Gọi song song → tiết kiệm 1 round-trip |
| `sessionStorage` không phải `localStorage` | Token tự xóa khi đóng tab → giảm rủi ro token sống dai |
| `uppercase()` ở 3 chỗ | Chuẩn hoá mã về uppercase trước khi gửi, khớp với `findByAccessCode` |
| Input `maxLength={10}` | Chặn nhập quá dài (mã chỉ 8 ký tự) |

**Phần QR Scanner là placeholder:**
```tsx
<div className="aspect-square w-full overflow-hidden rounded-md border bg-muted flex items-center justify-center">
    {/* Placeholder — wire to html5-qrcode if needed */}
    <div className="text-center text-muted-foreground">
        <Scan className="mx-auto size-10 opacity-30" />
        <p className="mt-2 text-sm">Camera sẽ hiển thị ở đây</p>
        <p className="text-xs">(Cần cài thư viện html5-qrcode)</p>
    </div>
</div>
```
UI đã sẵn sàng nhưng chưa nối camera thật. Cần thêm `html5-qrcode`. Tính năng **chưa hoàn thành**.

---

#### Page 4: `StudentInvitationsPage`
- **Đường dẫn:** `/student/invitations`
- **File:** `frontend/src/pages/student/StudentInvitationsPage.tsx`

```tsx
export default function StudentInvitationsPage() {
    const queryClient = useQueryClient();
    const navigate = useNavigate();
    const [now] = useState(() => Date.now());    // ← snapshot thời gian 1 lần

    const invitationsQuery = useQuery({
        queryKey: invitationsQueryKey,
        queryFn: invitationApi.getMyInvitations,
    });

    const acceptMutation = useMutation({
        mutationFn: invitationApi.accept,
        onSuccess: (updated: InvitationDTO) => {
            queryClient.setQueryData<InvitationDTO[]>(invitationsQueryKey, (current) =>
                current?.map((invitation) => invitation.id === updated.id ? updated : invitation),
            );
            toast.success('Đã chấp nhận lời mời.');
        },
    });
}
```

**Mục đích & điểm hay:**
- `[now] = useState(() => Date.now())` → **snapshot 1 lần**, không dùng `new Date()` mỗi render (tránh re-render loop).
- `setQueryData` thay vì `invalidateQueries` → **update cache tại chỗ, không refetch**. UX mượt: bấm "Chấp nhận" → badge đổi ngay, không loading.
- `canAccept = status === 'PENDING' && !expired` → điều kiện nút hiện/ẩn mirror server.
- `getStatus()` helper map status → `{label, variant}` cho badge.

> **Lưu ý:** Không có nút "Từ chối" dù backend có endpoint `reject` — chưa nối UI.

---

#### Router config
- **File:** `frontend/src/router/component-registry.ts`

```typescript
export const routes: RouteConfig[] = [
    ...
    { path: "/invitations", component: InvitationsLandingPage, requiredPermission: "EXAM_READ" },
    { path: "/exams/:examId/invitations", component: InvitationsPage, requiredPermission: "INVITATION_READ" },
    { path: "/anonymous-exam", component: AnonymousAccessPage, isPublic: true },
    { path: "/student/invitations", component: StudentInvitationsPage, requiredPermission: "INVITATION_READ" },
    ...
];
```
- `requiredPermission` → frontend check permission trước khi cho vào
- `isPublic: true` → bypass cả check login + permission (cho trang anonymous)

---

### 2.8 Types Layer

- **File:** `frontend/src/types/features/invitation.ts`

```typescript
export type InvitationStatus = "PENDING" | "SENT" | "ACCEPTED" | "REJECTED" | "EXPIRED" | "REVOKED" | "COMPLETED";

export interface InvitationDTO extends BaseDTO { ... }
export interface InvitationCreateRequest { userId, note?, expiresAt? }
export interface BatchInvitationRequest { invitations[], sendEmail? }
export interface AnonymousInvitationRequest { studentName, studentEmail, ... }
export interface AnonymousAccessResponse { valid, accessCode?, examTitle?, ... }
export interface AnonymousSessionRequest { accessCode, fingerprint? }
export interface AnonymousSessionResponse { valid, sessionToken?, examTitle?, durationMinutes?, message? }
export interface ReminderRequest { reminderType, scheduledAt?, invitationId? }
```

**Về `StudentInvitationDTO`:** có `durationMinutes`, `startTime`, `endTime`, `totalPoints`, `hasPassword` — **không được dùng ở đâu** và backend không trả các field này. Đây là **interface thừa**.

---

## 3. FLOW HOẠT ĐỘNG

### Flow A: Mời sinh viên có tài khoản

```
┌─────────────────────────────────────────────────────────────────┐
│ GV: /invitations → chọn đề thi → /exams/{id}/invitations        │
│      → "Tạo lời mời" → Tab "Tài khoản có sẵn"                  │
└──────────────────────────┬──────────────────────────────────────┘
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│ UserPicker tìm SV (≥2 ký tự) → chọn → nhập note/hạn chót      │
│ → chọn nhắc nhở (NONE/1h/1ngày/custom) → Submit               │
└──────────────────────────┬──────────────────────────────────────┘
                           ▼ POST /api/exams/{id}/invitations
┌─────────────────────────────────────────────────────────────────┐
│ @PreAuthorize INVITATION_CREATE ✓                              │
│ Service: role ADMIN/TEACHER ✓ → exam active ✓ → user active ✓  │
│ → !existsByExamIdAndUserId ✓ → build Invitation(PENDING)        │
│ → save() → sendExamInvitation(token) → set SENT + sentAt        │
└──────────────────────────┬──────────────────────────────────────┘
                           ▼
                    ✉️ Email SV (chứa token)
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│ SV: /student/invitations → getMyInvitations() → JOIN FETCH      │
│ → thấy lời mời + tên đề thi → bấm "Chấp nhận"                 │
└──────────────────────────┬──────────────────────────────────────┘
                           ▼ PATCH /api/invitations/{id}/accept
┌─────────────────────────────────────────────────────────────────┐
│ ownership check (chính SV) ✓ → validateInvitationForAction ✓   │
│ → set ACCEPTED + acceptedAt → sendExamAcceptance (báo GV)      │
│ → frontend setQueryData → badge đổi ngay, không refetch         │
└─────────────────────────────────────────────────────────────────┘
```

### Flow B: Mời người thi không tài khoản (ẩn danh)

```
┌─────────────────────────────────────────────────────────────────┐
│ GV: /exams/{id}/invitations → "Tạo lời mời" → Tab "Link chia sẻ"│
│      → nhập "Số lần thi tối đa" (mặc định 1) → Submit          │
└──────────────────────────┬──────────────────────────────────────┘
                           ▼ POST /api/exams/{id}/invitations/anonymous
┌─────────────────────────────────────────────────────────────────┐
│ @PreAuthorize INVITATION_CREATE ✓ → role check ✓ → exam active ✓│
│ → generateAccessCode() = 8 ký tự random                        │
│ → generateToken() + oneTimeToken = UUID                        │
│ → build Invitation(user=null, anonymous=true, status=SENT)      │
│ → save() → sendAnonymousAccessLink(guestEmail)                  │
│ → frontend gọi getQrDataUrl(id) → nhận data URL                │
│ → hiện ShareLinkCard: mã + link + QR (3 nút copy/tải)          │
└──────────────────────────┬──────────────────────────────────────┘
                           ▼
 ┌──────────────┴──────────────┐
        ▼ ▼
   📧 Email link 🖼️ GV in QR / share link
        │                             │
        └──────────────┬──────────────┘
                       ▼
┌─────────────────────────────────────────────────────────────────┐
│ Người thi mở /anonymous-exam?code=XXXXXXXX                    │
│ → useEffect đọc ?code= → tự điền input                       │
│ → nhấn "Xác minh & Vào thi"                                    │
└──────────────────────────┬──────────────────────────────────────┘
                           ▼ GET /api/exams/verify-access/{code}  (PUBLIC)
┌─────────────────────────────────────────────────────────────────┐
│ findByAccessCode ✓ → anonymous? ✓ → REVOKED/EXPIRED? ✗         │
│ → check expiresAt → valid=true + examTitle + số lượt còn lại   │
└──────────────────────────┬──────────────────────────────────────┘
                           ▼ POST /api/exams/anonymous-session    (PUBLIC)
┌─────────────────────────────────────────────────────────────────┐
│ validateInvitationForAction ✓                                   │
│ → accessAttemptCount < maxAccessAttempts ✓                      │
│ → fingerprint chưa từng dùng ✓ (nếu frontend gửi)              │
│ → ++accessAttemptCount → generateToken() → save AnonymousSession │
│ → trả sessionToken + examTitle + durationMinutes                │
│ → sessionStorage.setItem("anonymous_session_token", token)      │
└──────────────────────────┬──────────────────────────────────────┘
                           ▼
              Nút "Vào phòng thi" → /anonymous-exam
```

### Flow C: Thu hồi & Hết hạn

```
THU HỒI (thủ công):                   HẾT HẠN (tự động):
GV bấm ⋮ → "Thu hồi lời mời"          @Scheduled mỗi 5 phút
  ↓ (nhập lý do tùy chọn)             InvitationExpiryJob
PATCH /invitations/{id}/revoke ↓
  ↓                                    ↓
Guard: !REVOKED && !COMPLETED          findAllExpiredPendingInvitations
  ↓                                    ↓
set REVOKED + revokedAt + revokedReason  set status = EXPIRED
  ↓                                    ↓ saveAll + log
if (user != null) → sendExamRevoked    (chỉ30 giây, không tốn resource)

SESSION CLEANUP (hằng ngày 3:00 AM):
AnonymousSessionCleanupJob
  ├─ idle > 24h  → isValid = false (soft, giữ để audit)
  └─ > 30 ngày   → deleteAll (hard, giữ DB nhỏ)
```

---

## 4. BẢNG TỔNG HỢP ENDPOINT

| # | Method | Endpoint | Auth | Permission | Dùng bởi |
|---|--------|----------|------|-----------|----------|
| 1 | POST | `/api/exams/{examId}/invitations` | JWT | `INVITATION_CREATE` | CreateInvitationModal |
| 2 | POST | `/api/exams/{examId}/invitations/batch` | JWT | `INVITATION_CREATE` | — (chưa dùng UI) |
| 3 | GET | `/api/exams/{examId}/invitations` | JWT | `INVITATION_READ` | InvitationsPage |
| 4 | GET | `/api/invitations/{id}` | JWT | `INVITATION_READ` | — (chưa dùng UI) |
| 5 | PATCH | `/api/invitations/{id}/revoke` | JWT | `INVITATION_DELETE` | Dialog revoke |
| 6 | POST | `/api/invitations/{id}/resend` | JWT | `INVITATION_UPDATE` | Menu "Gửi lại email" |
| 7 | GET | `/api/invitations/{id}/qr` | JWT | `INVITATION_READ` | Dialog QR + getQrDataUrl |
| 8 | GET | `/api/invitations/my` | JWT | `INVITATION_READ`/`EXAM_TAKE` | StudentInvitationsPage |
| 9 | PATCH | `/api/invitations/{id}/accept` | JWT | `isAuthenticated()` | StudentInvitationsPage |
| 10 | PATCH | `/api/invitations/{id}/reject` | JWT | `isAuthenticated()` | — (chưa dùng UI) |
| 11 | POST | `/api/exams/{examId}/invitations/anonymous` | JWT | `INVITATION_CREATE` | CreateInvitationModal tab 2 |
| 12 | GET | `/api/exams/verify-access/{code}` | **PUBLIC** | — | AnonymousAccessPage |
| 13 | POST | `/api/exams/anonymous-session` | **PUBLIC** | — | AnonymousAccessPage |

---

## 5. CẤU HÌNH (application.yml)

| Key | Default | Dùng ở |
|-----|---------|--------|
| `app.frontend-domain` | (bắt buộc) | `InvitationService.buildAnonymousAccessUrl` |
| `app.invitation.expiry-interval-ms` | `300000` (5 phút) | `InvitationExpiryJob` |
| `app.anonymous.session-ttl-hours` | `24` | `AnonymousSessionCleanupJob` |
| `app.anonymous.retention-days` | `30` | `AnonymousSessionCleanupJob` |
| `app.anonymous.cleanup-cron` | `0 0 3 * * *` | `AnonymousSessionCleanupJob` |

Tất cả job config dùng **default value trong annotation** → thiếu key trong yml vẫn chạy được, không crash.

---

## 6. VẤN ĐỀ CẦN LƯU Ý

### 6.1 `verifyAccessCode()` ghi DB trong method `readOnly = true`

```java
@Transactional(readOnly = true)
public AnonymousAccessResponse verifyAccessCode(String accessCode) {
    ...
    invitation.setStatus(InvitationStatus.EXPIRED);
    invitationRepository.save(invitation);   // ← GHI trong readOnly=true
```
`readOnly = true` khiến Hibernate bỏ qua dirty-checking → `save()` vẫn fire UPDATE nhưng nên đổi thành `@Transactional` không readOnly.

### 6.2 `InvitationExpiryJob` chỉ quét PENDING, nhưng lời mời thực tế là SENT

`createInvitation` set `SENT` ngay sau khi gửi email → job **không bao giờ** đánh EXPIRED lời mời đã gửi. An toàn vì `validateInvitationForAction()` chặn bằng `expiresAt`, nhưng DB lưu status sai.

**Fix đề xuất:** query nên lọc `IN ('PENDING', 'SENT')` ihoá `EXPIRED`/`REVOKED`/`REJECTED`/`COMPLETED`.

### 6.3 `fingerprint` không được frontend gửi

```tsx
mutationFn: (code: string) =>
    invitationApi.createAnonymousSession({ accessCode: code }),
```
Backend có logic chống copy-link-sang-máy-khác qua fingerprint, nhưng frontend không truyền → **1 lớp bảo mật không kích hoạt**.

**Fix đề xuất:** FE sinh fingerprint từ `navigator.userAgent + screen.width + ...` hoặc dùng thư viện FingerprintJS, truyền vào body.

### 6.4 `maxAccessTime` lưu nhưng không dùng

`Invitation.maxAccessTime` được set khi tạo anonymous invitation, expose trong DTO, nhưng **không có logic nào check nó** trong `validateInvitationForAction()` hay `createAnonymousSession()`.

**Fix đề xuất:** thêm check `if (maxAccessTime != null && LocalDateTime.now().isAfter(maxAccessTime)) throw ...` trong `validateInvitationForAction`.

### 6.5 Endpoint & type thừa

| Item | Vấn đề |
|------|--------|
| `BatchInvitationRequest.sendEmail` | Service không đọc → mỗi lời mời luôn gửi email |
| `StudentInvitationDTO` | Interface FE không dùng, BE không trả các field |
| `InvitationFilter.userId` (singular) | Service chỉ check `userIds` (plural) |
| Endpoint #2 (batch), #4 (getById), #10 (reject) | Có API + service method, frontend không gọi |
| `AnonymousAccessResponse` import thừa | Dòng 2-3 của file |
| `"/h2-console/**"` | Duplicate trong `PUBLIC_ENDPOINTS` |

### 6.6 `AnonymousAccessPage` — session chưa dùng

Nút "Vào phòng thi" set `window.location.href = "/anonymous-exam"` — **cùng route với trang hiện tại**. `sessionToken` state được set nhưng **không dùng để authenticate API nào**. Trang thi ẩn danh chưa thực sự được implement (cần page riêng cho student vào thi).

### 6.7 QR Scanner là placeholder

UI sẵn sàng nhưng camera thật chưa được nối. Cần cài `html5-qrcode` và thay placeholder bằng component thật.

---

## 7. KẾT LUẬN

**Module Invitation là một module hoàn chỉnh** với kiến trúc 3 tầng rõ ràng:

- **Domain** — 2 entity (`Invitation`, `AnonymousSession`) phục vụ 2 kênh mời, enum 7 trạng thái, repository 11+6 query tối ưu N+1
- **DTO** — 9 class với `@JsonProperty(READ_ONLY)` chống giả mạo token từ client
- **Service** — 13 method public + 6 private helper, transaction rõ ràng, 4 lớp chống gian lận cho anonymous
- **Controller** — 2 controller tách theo security boundary, 13 endpoint
- **Jobs** — 2 scheduled job, config qua `@Value` default, tự dọn dẹp
- **Frontend** — 4 page + 1 modal component + api layer + types layer, React Query với cache update tối ưu

**Mục đích cốt lõi:** Cho phép tổ chức đưa đề thi đến tay người thi theo **2 kênh khác nhau** — có tài khoản (email + JWT, quản lý vòng đời đầy đủ) và không tài khoản (mã truy cập + QR, giới hạn số lần + fingerprint chống chia sẻ link) — với **cơ chế kiểm soát hạn chót, thu hồi, chống gian lận, và audit trail** ở mọi bước.

**Điểm mạnh cần nhấn mạnh khi thuyết trình:**
- 1 entity duy nhất (`Invitation`) phục vụ 2 nghiệp vụ → đơn giản hoá data model
- 3 tầng bảo mật: DTO `@READ_ONLY` + `@PreAuthorize` + ownership check
- 4 lớp chống gian lận cho kênh anonymous
- Code được chia theo security boundary (2 controller), theo nghiệp vụ (2 scheduled job), theo vai trò (4 trang frontend)

**Điểm cần cải thiện (xem mục 6):** 7 vấn đề đã phân tích, trong đó quan trọng nhất là lớp bảo mật fingerprint chưa hoạt động và expiry job chưa cover status SENT.
