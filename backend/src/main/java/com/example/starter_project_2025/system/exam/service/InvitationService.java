package com.example.starter_project_2025.system.exam.service;

import com.example.starter_project_2025.exception.BadRequestException;
import com.example.starter_project_2025.exception.ResourceNotFoundException;
import com.example.starter_project_2025.security.UserPrincipal;
import com.example.starter_project_2025.system.exam.domain.*;
import com.example.starter_project_2025.system.exam.dto.*;
import com.example.starter_project_2025.system.notification.service.EmailService;
import com.example.starter_project_2025.system.rbac.user.User;
import com.example.starter_project_2025.system.rbac.user.UserRepository;
import com.google.zxing.BarcodeFormat;
import com.google.zxing.WriterException;
import com.google.zxing.client.j2se.MatrixToImageWriter;
import com.google.zxing.common.BitMatrix;
import com.google.zxing.qrcode.QRCodeWriter;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.ByteArrayOutputStream;
import java.security.SecureRandom;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class InvitationService {

    private final InvitationRepository invitationRepository;
    private final AnonymousSessionRepository anonymousSessionRepository;
    private final ExamRepository examRepository;
    private final UserRepository userRepository;
    private final EmailService emailService;
    private final GuestUserService guestUserService;

    @Value("${app.frontend-domain}")
    private String frontendUrl;

    private static final String ACCESS_CODE_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    private static final int ACCESS_CODE_LENGTH = 8;
    private static final SecureRandom random = new SecureRandom();

    /**
     * Parse datetime string to LocalDateTime.
     * Handles: "2024-12-31T23:59", "2024-12-31T23:59:00", "2024-12-31T23:59:00Z", "2024-12-31T23:59:00+07:00"
     */
    private LocalDateTime parseDateTime(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        try {
            // Try standard LocalDateTime parsing first
            return LocalDateTime.parse(value, DateTimeFormatter.ISO_LOCAL_DATE_TIME);
        } catch (DateTimeParseException e1) {
            try {
                // Try with ZonedDateTime (handles "Z" or "+07:00" suffix)
                ZonedDateTime zdt = ZonedDateTime.parse(value, DateTimeFormatter.ISO_ZONED_DATE_TIME);
                return zdt.withZoneSameInstant(ZoneId.systemDefault()).toLocalDateTime();
            } catch (DateTimeParseException e2) {
                throw new BadRequestException("Invalid datetime format: " + value + ". Expected ISO format like '2024-12-31T23:59'");
            }
        }
    }

    @Transactional
    public InvitationDTO createInvitation(Long examId, InvitationCreateRequest request, UserPrincipal principal) {
        // Verify caller is ADMIN or TEACHER (not just by permission, but by actual role)
        boolean isAdminOrTeacher = principal.getUser().getRoles().stream()
                .anyMatch(r -> "ADMIN".equals(r.getName()) || "TEACHER".equals(r.getName()));
        if (!isAdminOrTeacher) {
            throw new BadRequestException("Only ADMIN or TEACHER can create invitations");
        }

        Exam exam = examRepository.findById(examId)
                .filter(e -> Boolean.TRUE.equals(e.getIsActive()))
                .orElseThrow(() -> new ResourceNotFoundException("Exam not found with id: " + examId));

        User user = userRepository.findById(request.getUserId())
                .filter(u -> Boolean.TRUE.equals(u.getIsActive()))
                .orElseThrow(() -> new ResourceNotFoundException("User not found with id: " + request.getUserId()));

        // Check if invitation already exists
        if (invitationRepository.existsByExamIdAndUserId(examId, user.getId())) {
            throw new BadRequestException("Invitation already exists for this user and exam");
        }

        Invitation invitation = Invitation.builder()
                .exam(exam)
                .user(user)
                .token(generateToken())
                .status(InvitationStatus.PENDING)
                .expiresAt(request.getExpiresAt() != null ?
                        parseDateTime(request.getExpiresAt()) :
                        exam.getEndTime() != null ? exam.getEndTime() : LocalDateTime.now().plusDays(30))
                .note(request.getNote())
                .anonymous(false)
                .build();

        invitation = invitationRepository.save(invitation);

        // Send email
        emailService.sendExamInvitation(invitation, user);

        invitation.setStatus(InvitationStatus.SENT);
        invitation.setSentAt(LocalDateTime.now());
        return toDTO(invitationRepository.save(invitation));
    }

    @Transactional
    public BatchInvitationResponse createBatchInvitations(Long examId, BatchInvitationRequest request, UserPrincipal principal) {
        // Verify caller is ADMIN or TEACHER
        boolean isAdminOrTeacher = principal.getUser().getRoles().stream()
                .anyMatch(r -> "ADMIN".equals(r.getName()) || "TEACHER".equals(r.getName()));
        if (!isAdminOrTeacher) {
            throw new BadRequestException("Only ADMIN or TEACHER can create batch invitations");
        }

        Exam exam = examRepository.findById(examId)
                .filter(e -> Boolean.TRUE.equals(e.getIsActive()))
                .orElseThrow(() -> new ResourceNotFoundException("Exam not found with id: " + examId));

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

        return BatchInvitationResponse.builder()
                .totalRequested(request.getInvitations().size())
                .successCount(successful.size())
                .failureCount(errors.size())
                .successfulInvitations(successful)
                .errors(errors)
                .build();
    }

    @Transactional(readOnly = true)
    public List<InvitationDTO> getInvitationsByExam(Long examId, InvitationFilter filter) {
        List<Invitation> invitations;

        if (filter != null && filter.getUserIds() != null && !filter.getUserIds().isEmpty()) {
            invitations = new ArrayList<>();
            for (Long userId : filter.getUserIds()) {
                invitationRepository.findByExamIdAndUserId(examId, userId)
                        .ifPresent(invitations::add);
            }
        } else if (filter != null && filter.getStatus() != null) {
            invitations = invitationRepository.findByExamIdAndStatus(examId, filter.getStatus());
        } else if (filter != null && Boolean.TRUE.equals(filter.getAnonymous())) {
            invitations = invitationRepository.findAnonymousByExamId(examId);
        } else {
            invitations = invitationRepository.findByExamId(examId);
        }

        return invitations.stream().map(this::toDTO).toList();
    }

    @Transactional(readOnly = true)
    public List<InvitationDTO> getMyInvitations(@AuthenticationPrincipal UserPrincipal currentUser) {
        List<Invitation> invitations = invitationRepository.findByUserIdWithExamAndUser(currentUser.getUser().getId());
        return invitations.stream().map(this::toDTO).toList();
    }

    @Transactional
    public InvitationDTO acceptInvitation(Long id, @AuthenticationPrincipal UserPrincipal currentUser) {
        Invitation invitation = invitationRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Invitation not found with id: " + id));

        // Verify ownership
        if (invitation.getUser() == null || !invitation.getUser().getId().equals(currentUser.getUser().getId())) {
            throw new BadRequestException("You are not authorized to accept this invitation");
        }

        validateInvitationForAction(invitation);

        invitation.setStatus(InvitationStatus.ACCEPTED);
        invitation.setAcceptedAt(LocalDateTime.now());

        emailService.sendExamAcceptance(invitation);

        return toDTO(invitationRepository.save(invitation));
    }

    @Transactional
    public InvitationDTO rejectInvitation(Long id, @AuthenticationPrincipal UserPrincipal currentUser) {
        Invitation invitation = invitationRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Invitation not found with id: " + id));

        // Verify ownership
        if (invitation.getUser() == null || !invitation.getUser().getId().equals(currentUser.getUser().getId())) {
            throw new BadRequestException("You are not authorized to reject this invitation");
        }

        validateInvitationForAction(invitation);

        invitation.setStatus(InvitationStatus.REJECTED);
        invitation.setRejectedAt(LocalDateTime.now());

        return toDTO(invitationRepository.save(invitation));
    }

    @Transactional
    public InvitationDTO revokeInvitation(Long id, String reason) {
        Invitation invitation = invitationRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Invitation not found with id: " + id));

        if (invitation.getStatus() == InvitationStatus.REVOKED ||
            invitation.getStatus() == InvitationStatus.COMPLETED) {
            throw new BadRequestException("Cannot revoke invitation with status: " + invitation.getStatus());
        }

        invitation.setStatus(InvitationStatus.REVOKED);
        invitation.setRevokedAt(LocalDateTime.now());
        invitation.setRevokedReason(reason);

        if (invitation.getUser() != null) {
            emailService.sendExamRevoked(invitation);
        }

        return toDTO(invitationRepository.save(invitation));
    }

    @Transactional
    public InvitationDTO resendInvitation(Long id) {
        Invitation invitation = invitationRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Invitation not found with id: " + id));

        if (invitation.getUser() == null) {
            throw new BadRequestException("Cannot resend anonymous invitation");
        }

        if (invitation.getStatus() == InvitationStatus.REVOKED ||
            invitation.getStatus() == InvitationStatus.COMPLETED) {
            throw new BadRequestException("Cannot resend invitation with status: " + invitation.getStatus());
        }

        invitation.setToken(generateToken());
        invitation.setResendCount(invitation.getResendCount() + 1);

        emailService.sendExamInvitation(invitation, invitation.getUser());

        invitation.setSentAt(LocalDateTime.now());
        invitation.setStatus(InvitationStatus.SENT);

        return toDTO(invitationRepository.save(invitation));
    }

    @Transactional(readOnly = true)
    public byte[] generateQRCode(Long invitationId) {
        Invitation invitation = invitationRepository.findById(invitationId)
                .orElseThrow(() -> new ResourceNotFoundException("Invitation not found with id: " + invitationId));

        if (!Boolean.TRUE.equals(invitation.getAnonymous())) {
            throw new BadRequestException("QR code can only be generated for anonymous invitations");
        }

        String url = buildAnonymousAccessUrl(invitation);
        return generateQRCodeImage(url, 300, 300);
    }

    // ============ ANONYMOUS METHODS ============

    @Transactional
    public InvitationDTO createAnonymousInvitation(Long examId, AnonymousInvitationRequest request, UserPrincipal principal) {
        // Verify caller is ADMIN or TEACHER (not just by permission, but by actual role)
        boolean isAdminOrTeacher = principal.getUser().getRoles().stream()
                .anyMatch(r -> "ADMIN".equals(r.getName()) || "TEACHER".equals(r.getName()));
        if (!isAdminOrTeacher) {
            throw new BadRequestException("Only ADMIN or TEACHER can create anonymous invitations");
        }

        Exam exam = examRepository.findById(examId)
                .filter(e -> Boolean.TRUE.equals(e.getIsActive()))
                .orElseThrow(() -> new ResourceNotFoundException("Exam not found with id: " + examId));

        String accessCode = generateAccessCode();

        // Tên/email học sinh là tuỳ chọn ở phía giáo viên. Nếu không nhập,
        // học sinh sẽ tự khai báo khi mở link (AnonymousSessionRequest).
        String guestName = blankToNull(request.getStudentName());
        String guestEmail = blankToNull(request.getStudentEmail());

        Invitation invitation = Invitation.builder()
                .exam(exam)
                .user(null) // Anonymous - no RBAC account
                .token(generateToken())
                .status(InvitationStatus.SENT)
                .sentAt(LocalDateTime.now())
                .expiresAt(request.getExpiresAt() != null ?
                        parseDateTime(request.getExpiresAt()) :
                        exam.getEndTime() != null ? exam.getEndTime() : LocalDateTime.now().plusDays(30))
                .note(request.getNote())
                .anonymous(true)
                .guestName(guestName)
                .guestEmail(guestEmail)
                .accessCode(accessCode)
                .maxAccessTime(request.getMaxAccessTime() != null ?
                        parseDateTime(request.getMaxAccessTime()) : null)
                .maxAccessAttempts(request.getMaxAccessAttempts() != null ?
                        request.getMaxAccessAttempts() : 1)
                .build();

        invitation = invitationRepository.save(invitation);

        // Chỉ gửi email khi giáo viên có nhập email học sinh. Nếu không có email
        // thì giáo viên copy link / QR để chia sẻ trực tiếp.
        if (guestEmail != null) {
            emailService.sendAnonymousAccessLink(invitation, guestEmail);
        }

        return toDTO(invitation);
    }

    private String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    /**
     * Xác minh mã truy cập. Không dùng {@code readOnly} vì khi phát hiện lời
     * mời đã quá hạn, hàm này cập nhật status sang EXPIRED — đó là side-effect
     * nên transaction phải cho phép ghi.
     */
    @Transactional
    public AnonymousAccessResponse verifyAccessCode(String accessCode) {
        Invitation invitation = invitationRepository.findByAccessCode(accessCode)
                .orElseThrow(() -> new ResourceNotFoundException("Invalid access code"));

        if (!Boolean.TRUE.equals(invitation.getAnonymous())) {
            throw new BadRequestException("Invalid access code");
        }

        if (invitation.getStatus() == InvitationStatus.REVOKED ||
            invitation.getStatus() == InvitationStatus.EXPIRED) {
            return AnonymousAccessResponse.builder()
                    .valid(false)
                    .message("This invitation has been revoked or expired")
                    .build();
        }

        if (invitation.getExpiresAt() != null && LocalDateTime.now().isAfter(invitation.getExpiresAt())) {
            invitation.setStatus(InvitationStatus.EXPIRED);
            invitationRepository.save(invitation);
            return AnonymousAccessResponse.builder()
                    .valid(false)
                    .message("This invitation has expired")
                    .build();
        }

        if (invitation.getMaxAccessTime() != null
            && LocalDateTime.now().isAfter(invitation.getMaxAccessTime())) {
            invitation.setStatus(InvitationStatus.EXPIRED);
            invitationRepository.save(invitation);
            return AnonymousAccessResponse.builder()
                    .valid(false)
                    .message("The access window for this link has closed")
                    .build();
        }

        int remaining = invitation.getMaxAccessAttempts() - invitation.getAccessAttemptCount();

        return AnonymousAccessResponse.builder()
                .valid(true)
                .accessCode(accessCode)
                .examTitle(invitation.getExam().getTitle())
                .studentName(invitation.getGuestName())
                .accessAttemptsRemaining(Math.max(0, remaining))
                .message("Access code is valid")
                .build();
    }

    @Transactional
    public AnonymousSessionResponse createAnonymousSession(
            String accessCode,
            String fingerprint,
            String studentName,
            String studentEmail
    ) {
        Invitation invitation = invitationRepository.lockByAccessCode(accessCode)
                .orElseThrow(() -> new ResourceNotFoundException("Invalid access code"));

        if (!Boolean.TRUE.equals(invitation.getAnonymous())) {
            throw new BadRequestException("Invalid access code");
        }

        validateInvitationForAction(invitation);

        // Tạo (hoặc tái sử dụng) user khách để gắn kết quả bài thi.
        User guestUser = guestUserService.findOrCreateGuest(studentEmail, studentName);

        // === QUAY LẠI LINK ĐÃ TỪNG NHẬP THÔNG TIN ===
        // Học sinh có thể mở link, nhập tên/email, rồi quay lại trang truy cập
        // (đóng tab, refresh, ...) mà chưa hề bắt đầu làm bài. Lúc đó KHÔNG
        // được chặn, vì họ vẫn chưa dùng lượt thi nào.
        // Ta tái sử dụng phiên gần nhất của chính học sinh đó (cùng email)
        // nếu phiên đó còn dùng được.
        Optional<AnonymousSession> reusable = reusableSessionFor(invitation, guestUser);
        if (reusable.isPresent()) {
            AnonymousSession session = reusable.get();
            session.setGuestName(studentName);
            session.setGuestEmail(studentEmail);
            session.setIsValid(true);
            if (fingerprint != null && !fingerprint.equals(session.getFingerprint())) {
                session.setFingerprint(fingerprint);
            }
            anonymousSessionRepository.save(session);

            // Ghi lại thông tin người thực sự làm bài (giống lần đầu).
            invitation.setGuestName(studentName);
            invitation.setGuestEmail(studentEmail);
            invitation.setGuestUserId(guestUser.getId());
            invitationRepository.save(invitation);

            return buildSessionResponse(session, invitation, "Bạn đã xác nhận thông tin. Có thể vào phòng thi.");
        }

        // === HỌC SINH MỚI (chưa từng nhập thông tin trên link này) ===
        // Check access attempts
        if (invitation.getAccessAttemptCount() >= invitation.getMaxAccessAttempts()) {
            throw new BadRequestException("Maximum access attempts reached for this invitation");
        }

        // Check for duplicate fingerprint
        if (fingerprint != null) {
            anonymousSessionRepository.findByInvitationIdAndFingerprint(invitation.getId(), fingerprint)
                    .ifPresent(session -> {
                        throw new BadRequestException("This device has already accessed this exam");
                    });
        }

        // Increment access count
        invitation.setAccessAttemptCount(invitation.getAccessAttemptCount() + 1);

        // Ghi lại thông tin người thực sự làm bài. Nếu giáo viên không nhập sẵn
        // khi tạo link thì đây là nơi duy nhất lưu lại tên/email của học sinh.
        invitation.setGuestName(studentName);
        invitation.setGuestEmail(studentEmail);
        invitation.setGuestUserId(guestUser.getId());
        invitationRepository.save(invitation);

        // Create session
        String sessionToken = generateToken();
        AnonymousSession session = AnonymousSession.builder()
                .invitation(invitation)
                .sessionToken(sessionToken)
                .fingerprint(fingerprint)
                .guestName(studentName)
                .guestEmail(studentEmail)
                .guestUserId(guestUser.getId())
                .accessedAt(LocalDateTime.now())
                .isValid(true)
                .build();

        anonymousSessionRepository.save(session);

        return buildSessionResponse(session, invitation, "Session created successfully");
    }

    /**
     * Tìm phiên có thể tái sử dụng cho học sinh đã quay lại link.
     * <p>
     * Chỉ dùng lại phiên của CHÍNH học sinh đó (khớp guest user) và phiên đó
     * chưa bị hủy/hoàn tất. Nếu học sinh đã nộp bài xong thì không tái sử dụng
     * (để lời mời vẫn giữ đúng số lượt thi).
     */
    private Optional<AnonymousSession> reusableSessionFor(Invitation invitation, User guestUser) {
        List<AnonymousSession> sessions = anonymousSessionRepository
                .findByInvitationIdAndGuestUserIdOrderByAccessedAtDesc(invitation.getId(), guestUser.getId());

        return sessions.stream()
                .filter(session -> Boolean.TRUE.equals(session.getIsValid()))
                .filter(session -> session.getCompletedAt() == null)
                .findFirst();
    }

    private AnonymousSessionResponse buildSessionResponse(
            AnonymousSession session,
            Invitation invitation,
            String message
    ) {
        return AnonymousSessionResponse.builder()
                .valid(true)
                .sessionToken(session.getSessionToken())
                .examTitle(invitation.getExam().getTitle())
                .examId(invitation.getExam().getId())
                .durationMinutes(invitation.getExam().getDurationMinutes())
                .studentName(session.getGuestName())
                .studentEmail(session.getGuestEmail())
                .message(message)
                .build();
    }

    @Transactional(readOnly = true)
    public InvitationDTO getById(Long id) {
        return toDTO(invitationRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Invitation not found with id: " + id)));
    }

    // ============ PRIVATE HELPERS ============

    private void validateInvitationForAction(Invitation invitation) {
        if (invitation.getStatus() == InvitationStatus.REVOKED) {
            throw new BadRequestException("Invitation has been revoked");
        }
        if (invitation.getStatus() == InvitationStatus.EXPIRED ||
            (invitation.getExpiresAt() != null && LocalDateTime.now().isAfter(invitation.getExpiresAt()))) {
            invitation.setStatus(InvitationStatus.EXPIRED);
            invitationRepository.save(invitation);
            throw new BadRequestException("Invitation has expired");
        }
        if (invitation.getStatus() == InvitationStatus.ACCEPTED) {
            throw new BadRequestException("Invitation has already been accepted");
        }
        if (invitation.getStatus() == InvitationStatus.REJECTED) {
            throw new BadRequestException("Invitation has already been rejected");
        }
        // maxAccessTime là mốc cuối để mở link (khác expiresAt là hạn của
        // lời mời). Quá mốc này thì link không dùng được nữa.
        if (invitation.getMaxAccessTime() != null
            && LocalDateTime.now().isAfter(invitation.getMaxAccessTime())) {
            invitation.setStatus(InvitationStatus.EXPIRED);
            invitationRepository.save(invitation);
            throw new BadRequestException("Access window for this invitation has closed");
        }
    }

    private String generateToken() {
        return UUID.randomUUID().toString();
    }

    private String generateAccessCode() {
        StringBuilder sb = new StringBuilder(ACCESS_CODE_LENGTH);
        for (int i = 0; i < ACCESS_CODE_LENGTH; i++) {
            sb.append(ACCESS_CODE_CHARS.charAt(random.nextInt(ACCESS_CODE_CHARS.length())));
        }
        return sb.toString();
    }

    private String buildAnonymousAccessUrl(Invitation invitation) {
        // Khớp với link frontend sinh ra: /anonymous-exam?code=...
        return frontendUrl + "/anonymous-exam?code=" + invitation.getAccessCode();
    }

    private byte[] generateQRCodeImage(String content, int width, int height) {
        try {
            QRCodeWriter qrCodeWriter = new QRCodeWriter();
            BitMatrix bitMatrix = qrCodeWriter.encode(content, BarcodeFormat.QR_CODE, width, height);
            ByteArrayOutputStream outputStream = new ByteArrayOutputStream();
            MatrixToImageWriter.writeToStream(bitMatrix, "PNG", outputStream);
            return outputStream.toByteArray();
        } catch (WriterException | java.io.IOException e) {
            throw new RuntimeException("Failed to generate QR code", e);
        }
    }

    private InvitationDTO toDTO(Invitation invitation) {
        InvitationDTO dto = new InvitationDTO();
        dto.setId(invitation.getId());
        dto.setIsActive(invitation.getIsActive());
        dto.setCreatedAt(invitation.getCreatedAt());
        dto.setUpdatedAt(invitation.getUpdatedAt());
        dto.setCreatedBy(invitation.getCreatedBy());
        dto.setUpdatedBy(invitation.getUpdatedBy());

        Exam exam = invitation.getExam();

        dto.setExamId(exam != null ? exam.getId() : null);
        dto.setExamTitle(exam != null ? exam.getTitle() : null);

        dto.setUserId(invitation.getUser() != null ? invitation.getUser().getId() : null);
        dto.setUserFullName(invitation.getUser() != null ? invitation.getUser().getFullName() : invitation.getGuestName());
        dto.setUserEmail(invitation.getUser() != null ? invitation.getUser().getEmail() : invitation.getGuestEmail());

        dto.setToken(invitation.getToken());
        dto.setStatus(invitation.getStatus());
        dto.setSentAt(invitation.getSentAt());
        dto.setExpiresAt(invitation.getExpiresAt());
        dto.setAcceptedAt(invitation.getAcceptedAt());
        dto.setRejectedAt(invitation.getRejectedAt());
        dto.setRevokedAt(invitation.getRevokedAt());
        dto.setRevokedReason(invitation.getRevokedReason());
        dto.setNote(invitation.getNote());
        dto.setResendCount(invitation.getResendCount());
        dto.setAnonymous(invitation.getAnonymous());
        dto.setGuestName(invitation.getGuestName());
        dto.setGuestEmail(invitation.getGuestEmail());
        dto.setAccessCode(invitation.getAccessCode());
        dto.setMaxAccessTime(invitation.getMaxAccessTime());
        dto.setMaxAccessAttempts(invitation.getMaxAccessAttempts());
        dto.setAccessAttemptCount(invitation.getAccessAttemptCount());

        // Thông tin đề thi cho phía student: dùng để render notification,
        // kiểm tra time window và biết đề có mật khẩu hay không.
        if (exam != null) {
            dto.setExamStartTime(exam.getStartTime());
            dto.setExamEndTime(exam.getEndTime());
            dto.setExamDurationMinutes(exam.getDurationMinutes());
            dto.setExamMaxAttempts(exam.getMaxAttempts());
            dto.setExamHasPassword(
                    exam.getAccessCode() != null && !exam.getAccessCode().trim().isEmpty()
            );
        }

        return dto;
    }
}
