package com.example.starter_project_2025.system.exam.service;

import com.example.starter_project_2025.exception.BadRequestException;
import com.example.starter_project_2025.exception.ResourceNotFoundException;
import com.example.starter_project_2025.security.UserPrincipal;
import com.example.starter_project_2025.system.exam.audit.InvitationAuditAction;
import com.example.starter_project_2025.system.exam.audit.InvitationAuditService;
import com.example.starter_project_2025.system.exam.domain.*;
import com.example.starter_project_2025.system.exam.dto.*;
import com.example.starter_project_2025.system.notification.service.EmailService;
import com.example.starter_project_2025.system.demo.course.Course;
import com.example.starter_project_2025.system.demo.course.CourseRepository;
import com.example.starter_project_2025.system.demo.enrollment.CourseEnrollmentService;
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
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
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
    private final ExamAccessGuard examAccessGuard;
    private final InvitationAuditService invitationAuditService;
    private final ExamReminderRepository examReminderRepository;
    private final CourseRepository courseRepository;
    private final CourseEnrollmentService courseEnrollmentService;

    @Value("${app.frontend-domain}")
    private String frontendUrl;

    private static final String ACCESS_CODE_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    private static final int ACCESS_CODE_LENGTH = 8;
    private static final SecureRandom random = new SecureRandom();

    private LocalDateTime parseDateTime(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        try {
            return LocalDateTime.parse(value, DateTimeFormatter.ISO_LOCAL_DATE_TIME);
        } catch (DateTimeParseException e1) {
            try {
                ZonedDateTime zdt = ZonedDateTime.parse(value, DateTimeFormatter.ISO_ZONED_DATE_TIME);
                return zdt.withZoneSameInstant(ZoneId.systemDefault()).toLocalDateTime();
            } catch (DateTimeParseException e2) {
                throw new BadRequestException("Định dạng thời gian không hợp lệ: " + value + ". Cần định dạng ISO ví dụ '2024-12-31T23:59'");
            }
        }
    }

    @Transactional
    public InvitationDTO createInvitation(Long examId, InvitationCreateRequest request, UserPrincipal principal) {
        return createInvitation(examId, request, principal, true);
    }

    /**
     * @param sendEmail khi false thì lời mời được tạo ở trạng thái PENDING và không gửi mail
     *                   (dùng cho import lịch thi tự động hoặc khi muốn gửi thủ công sau).
     */
    @Transactional
    public InvitationDTO createInvitation(Long examId, InvitationCreateRequest request,
                                          UserPrincipal principal, boolean sendEmail) {
        boolean isAdminOrTeacher = principal.getUser().getRoles().stream()
                .anyMatch(r -> "ADMIN".equals(r.getName()) || "TEACHER".equals(r.getName()));
        if (!isAdminOrTeacher) {
            throw new BadRequestException("Chỉ ADMIN hoặc TEACHER được tạo lời mời");
        }

        Exam exam = examRepository.findById(examId)
                .filter(e -> Boolean.TRUE.equals(e.getIsActive()))
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy đề thi với id: " + examId));

        examAccessGuard.checkCanManage(exam, principal);

        validateExamInvitable(exam);

        User user = userRepository.findById(request.getUserId())
                .filter(u -> Boolean.TRUE.equals(u.getIsActive()))
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy người dùng với id: " + request.getUserId()));

        if (invitationRepository.existsByExamIdAndUserId(examId, user.getId())) {
            throw new BadRequestException("Lời mời cho người dùng này và đề thi này đã tồn tại");
        }

        LocalDateTime expiresAt = resolveExpiresAt(request.getExpiresAt(), exam);

        Invitation invitation = Invitation.builder()
                .exam(exam)
                .user(user)
                .token(generateToken())
                .status(InvitationStatus.PENDING)
                .expiresAt(expiresAt)
                .note(request.getNote())
                .anonymous(false)
                .build();

        invitation = invitationRepository.save(invitation);

        invitationAuditService.record(invitation, InvitationAuditAction.CREATE, principal, null);

        if (sendEmail) {
            emailService.sendExamInvitation(invitation, user);

            invitation.setStatus(InvitationStatus.SENT);
            invitation.setSentAt(LocalDateTime.now());
            return toDTO(invitationRepository.save(invitation));
        }

        return toDTO(invitation);
    }

    @Transactional
    public BatchInvitationResponse createBatchInvitations(Long examId, BatchInvitationRequest request, UserPrincipal principal) {
        boolean isAdminOrTeacher = principal.getUser().getRoles().stream()
                .anyMatch(r -> "ADMIN".equals(r.getName()) || "TEACHER".equals(r.getName()));
        if (!isAdminOrTeacher) {
            throw new BadRequestException("Chỉ ADMIN hoặc TEACHER được tạo lời mời hàng loạt");
        }

        Exam exam = examRepository.findById(examId)
                .filter(e -> Boolean.TRUE.equals(e.getIsActive()))
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy đề thi với id: " + examId));

        examAccessGuard.checkCanManage(exam, principal);

        validateExamInvitable(exam);

        List<InvitationDTO> successful = new ArrayList<>();
        List<String> errors = new ArrayList<>();

        for (InvitationCreateRequest invRequest : request.getInvitations()) {
            try {
                InvitationDTO dto = createInvitation(examId, invRequest, principal, request.isSendEmail());
                successful.add(dto);
            } catch (Exception e) {
                errors.add("User ID " + invRequest.getUserId() + ": " + e.getMessage());
            }
        }

        invitationAuditService.record(
                exam.getId(),
                null,
                null,
                InvitationAuditAction.BATCH_CREATE,
                principal.getUser().getId(),
                "Tạo " + successful.size() + "/" + request.getInvitations().size()
                        + " lời mời (sendEmail=" + request.isSendEmail() + ")");

        return BatchInvitationResponse.builder()
                .totalRequested(request.getInvitations().size())
                .successCount(successful.size())
                .failureCount(errors.size())
                .successfulInvitations(successful)
                .errors(errors)
                .build();
    }

    /**
     * Mời dự thi hàng loạt theo lớp (course).
     *
     * <p>Quy tắc:
     * <ul>
     *   <li>Học viên nguồn = học viên đang active, có role STUDENT và đã đăng ký lớp.</li>
     *   <li>Nếu {@code userIds} rỗng thì lấy toàn bộ học viên của lớp.</li>
     *   <li>Idempotent: học viên đã có lời mời cho đề này bị bỏ qua (SKIPPED), không làm hỏng cả lô.</li>
     *   <li>Lỗi của một học viên không ảnh hưởng các học viên còn lại; kết quả trả về chi tiết từng người.</li>
     * </ul>
     */
    @Transactional
    public BatchInvitationResponse createInvitationsByCourse(
            Long examId,
            GroupInvitationRequest request,
            UserPrincipal principal) {

        boolean isAdminOrTeacher = principal.getUser().getRoles().stream()
                .anyMatch(r -> "ADMIN".equals(r.getName()) || "TEACHER".equals(r.getName()));
        if (!isAdminOrTeacher) {
            throw new BadRequestException("Chỉ ADMIN hoặc TEACHER được tạo lời mời hàng loạt theo lớp");
        }

        if (request.getCourseId() == null) {
            throw new BadRequestException("Thiếu thông tin lớp để mời dự thi");
        }

        Exam exam = examRepository.findById(examId)
                .filter(e -> Boolean.TRUE.equals(e.getIsActive()))
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy đề thi với id: " + examId));

        examAccessGuard.checkCanManage(exam, principal);

        validateExamInvitable(exam);

        Course course = courseRepository.findById(request.getCourseId())
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Không tìm thấy lớp với id: " + request.getCourseId()));

        List<User> classStudents = courseEnrollmentService.getActiveStudentsByCourse(course.getId());
        Map<Long, User> enrolledById = new LinkedHashMap<>();
        for (User student : classStudents) {
            enrolledById.put(student.getId(), student);
        }

        Set<Long> selectedUserIds = request.getUserIds() == null || request.getUserIds().isEmpty()
                ? null
                : new HashSet<>(request.getUserIds());

        List<InvitationBulkItemResult> items = new ArrayList<>();
        List<InvitationDTO> successful = new ArrayList<>();
        List<String> errors = new ArrayList<>();
        int skippedCount = 0;
        int failureCount = 0;

        LocalDateTime expiresAt = resolveExpiresAt(request.getExpiresAt(), exam);

        for (Long userId : resolveTargetUserIds(selectedUserIds, enrolledById.keySet())) {
            User student = enrolledById.get(userId);

            if (student == null) {
                failureCount++;
                items.add(InvitationBulkItemResult.builder()
                        .userId(userId)
                        .status(InvitationBulkItemResult.Status.FAILED)
                        .reason("Học viên không thuộc lớp " + course.getName())
                        .build());
                errors.add("User ID " + userId + ": Học viên không thuộc lớp " + course.getName());
                continue;
            }

            if (!Boolean.TRUE.equals(student.getIsActive())) {
                failureCount++;
                items.add(InvitationBulkItemResult.builder()
                        .userId(userId)
                        .userEmail(student.getEmail())
                        .userFullName(student.getFullName())
                        .status(InvitationBulkItemResult.Status.FAILED)
                        .reason("Tài khoản học viên đã bị vô hiệu hóa")
                        .build());
                errors.add(student.getEmail() + ": Tài khoản học viên đã bị vô hiệu hóa");
                continue;
            }

            if (!isStudentRole(student)) {
                failureCount++;
                items.add(InvitationBulkItemResult.builder()
                        .userId(userId)
                        .userEmail(student.getEmail())
                        .userFullName(student.getFullName())
                        .status(InvitationBulkItemResult.Status.FAILED)
                        .reason("Tài khoản không có vai trò học viên")
                        .build());
                errors.add(student.getEmail() + ": Tài khoản không có vai trò học viên");
                continue;
            }

            if (invitationRepository.existsByExamIdAndUserId(examId, student.getId())) {
                skippedCount++;
                items.add(InvitationBulkItemResult.builder()
                        .userId(student.getId())
                        .userEmail(student.getEmail())
                        .userFullName(student.getFullName())
                        .status(InvitationBulkItemResult.Status.SKIPPED)
                        .reason("Học viên đã có lời mời cho đề thi này")
                        .build());
                continue;
            }

            try {
                Invitation invitation = Invitation.builder()
                        .exam(exam)
                        .user(student)
                        .token(generateToken())
                        .status(InvitationStatus.PENDING)
                        .expiresAt(expiresAt)
                        .note(request.getNote())
                        .anonymous(false)
                        .sourceType("COURSE")
                        .sourceCourseId(course.getId())
                        .build();

                invitation = invitationRepository.save(invitation);

                invitationAuditService.record(invitation, InvitationAuditAction.CREATE, principal, null);

                if (request.isSendEmail()) {
                    emailService.sendExamInvitation(invitation, student);
                    invitation.setStatus(InvitationStatus.SENT);
                    invitation.setSentAt(LocalDateTime.now());
                    invitation = invitationRepository.save(invitation);
                }

                InvitationDTO dto = toDTO(invitation);
                successful.add(dto);
                items.add(InvitationBulkItemResult.builder()
                        .userId(student.getId())
                        .userEmail(student.getEmail())
                        .userFullName(student.getFullName())
                        .invitationId(invitation.getId())
                        .status(InvitationBulkItemResult.Status.SUCCESS)
                        .reason(request.isSendEmail() ? "Đã tạo lời mời và gửi email" : "Đã tạo lời mời")
                        .build());
            } catch (Exception e) {
                failureCount++;
                items.add(InvitationBulkItemResult.builder()
                        .userId(student.getId())
                        .userEmail(student.getEmail())
                        .userFullName(student.getFullName())
                        .status(InvitationBulkItemResult.Status.FAILED)
                        .reason(e.getMessage())
                        .build());
                errors.add(student.getEmail() + ": " + e.getMessage());
            }
        }

        invitationAuditService.record(
                exam.getId(),
                null,
                null,
                InvitationAuditAction.BATCH_CREATE,
                principal.getUser().getId(),
                "Mời theo lớp " + course.getName() + " (courseId=" + course.getId() + "): "
                        + successful.size() + " thành công, "
                        + skippedCount + " bỏ qua, "
                        + failureCount + " lỗi");

        return BatchInvitationResponse.builder()
                .totalRequested(items.size())
                .successCount(successful.size())
                .skippedCount(skippedCount)
                .failureCount(failureCount)
                .successfulInvitations(successful)
                .errors(errors)
                .items(items)
                .build();
    }

    /**
     * Danh sách user id cần xử lý: toàn bộ học viên của lớp nếu không chọn cụ thể,
     * hoặc đúng các id đã chọn (kể cả id không thuộc lớp để báo lỗi rõ ràng).
     */
    private List<Long> resolveTargetUserIds(Set<Long> selectedUserIds, Set<Long> classUserIds) {
        if (selectedUserIds == null) {
            return new ArrayList<>(classUserIds);
        }
        return new ArrayList<>(selectedUserIds);
    }

    private boolean isStudentRole(User user) {
        return user.getRoles() != null && user.getRoles().stream()
                .anyMatch(r -> "STUDENT".equalsIgnoreCase(r.getName()));
    }

    @Transactional(readOnly = true)
    public List<InvitationDTO> getInvitationsByExam(Long examId, InvitationFilter filter, UserPrincipal principal) {
        Exam exam = examRepository.findById(examId)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy đề thi với id: " + examId));

        examAccessGuard.checkCanManage(exam, principal);

        List<Invitation> invitations;

        if (filter != null && filter.getStatus() != null) {
            invitations = invitationRepository.findByExamIdAndStatus(examId, filter.getStatus());
        } else if (filter != null && Boolean.TRUE.equals(filter.getAnonymous())) {
            invitations = invitationRepository.findAnonymousByExamId(examId);
        } else {
            invitations = invitationRepository.findByExamId(examId);
        }

        return invitations.stream()
                .map(i -> toDTO(i, canSeeAccessCode(i, principal)))
                .toList();
    }

    /**
     * Kiểm tra quyền quản lý đề thi (dùng cho các endpoint chỉ đọc như audit log).
     */
    @Transactional(readOnly = true)
    public void checkExamManagePermission(Long examId, UserPrincipal principal) {
        Exam exam = examRepository.findById(examId)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy đề thi với id: " + examId));
        examAccessGuard.checkCanManage(exam, principal);
    }

    /**
     * Admin xem được mọi mã truy cập; giáo viên chỉ xem được mã của lời mời do chính mình tạo.
     */
    private boolean canSeeAccessCode(Invitation invitation, UserPrincipal principal) {
        if (examAccessGuard.isAdmin(principal)) {
            return true;
        }
        Long currentUserId = principal != null && principal.getUser() != null
                ? principal.getUser().getId() : null;
        return currentUserId != null && currentUserId.equals(invitation.getCreatedBy());
    }

    @Transactional(readOnly = true)
    public List<InvitationDTO> getMyInvitations(@AuthenticationPrincipal UserPrincipal currentUser) {
        List<Invitation> invitations = invitationRepository.findByUserIdWithExamAndUser(currentUser.getUser().getId());
        return invitations.stream()
                .map(i -> toDTO(i, canSeeAccessCode(i, currentUser)))
                .toList();
    }

    @Transactional
    public InvitationDTO acceptInvitation(Long id, @AuthenticationPrincipal UserPrincipal currentUser) {
        Invitation invitation = invitationRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy lời mời với id: " + id));

        if (invitation.getUser() == null || !invitation.getUser().getId().equals(currentUser.getUser().getId())) {
            throw new BadRequestException("Bạn không được phép chấp nhận lời mời này");
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
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy lời mời với id: " + id));

        if (invitation.getUser() == null || !invitation.getUser().getId().equals(currentUser.getUser().getId())) {
            throw new BadRequestException("Bạn không được phép từ chối lời mời này");
        }

        validateInvitationForAction(invitation);

        invitation.setStatus(InvitationStatus.REJECTED);
        invitation.setRejectedAt(LocalDateTime.now());

        return toDTO(invitationRepository.save(invitation));
    }

    @Transactional
    public InvitationDTO revokeInvitation(Long id, String reason, UserPrincipal principal) {
        Invitation invitation = invitationRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy lời mời với id: " + id));

        examAccessGuard.checkCanManage(invitation.getExam(), principal);

        if (invitation.getStatus() == InvitationStatus.REVOKED ||
            invitation.getStatus() == InvitationStatus.COMPLETED) {
            throw new BadRequestException("Không thể thu hồi lời mời đang ở trạng thái: " + invitation.getStatus());
        }

        invitation.setStatus(InvitationStatus.REVOKED);
        invitation.setRevokedAt(LocalDateTime.now());
        invitation.setRevokedReason(reason);

        if (invitation.getUser() != null) {
            emailService.sendExamRevoked(invitation);
        }

        InvitationDTO dto = toDTO(invitationRepository.save(invitation));

        invitationAuditService.record(invitation, InvitationAuditAction.REVOKE, principal, reason);

        return dto;
    }

    @Transactional
    public InvitationDTO resendInvitation(Long id, UserPrincipal principal) {
        Invitation invitation = invitationRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy lời mời với id: " + id));

        examAccessGuard.checkCanManage(invitation.getExam(), principal);

        if (invitation.getUser() == null) {
            throw new BadRequestException("Không thể gửi lại lời mời ẩn danh");
        }

        if (invitation.getStatus() == InvitationStatus.REVOKED ||
            invitation.getStatus() == InvitationStatus.COMPLETED) {
            throw new BadRequestException("Không thể gửi lại lời mời đang ở trạng thái: " + invitation.getStatus());
        }

        invitation.setToken(generateToken());
        invitation.setResendCount(invitation.getResendCount() + 1);

        emailService.sendExamInvitation(invitation, invitation.getUser());

        invitation.setSentAt(LocalDateTime.now());
        // Không reset trạng thái ACCEPTED: sinh viên đã xác nhận tham dự thì vẫn được vào phòng thi.
        if (invitation.getStatus() != InvitationStatus.ACCEPTED) {
            invitation.setStatus(InvitationStatus.SENT);
        }

        InvitationDTO dto = toDTO(invitationRepository.save(invitation));

        invitationAuditService.record(invitation, InvitationAuditAction.RESEND, principal,
                "Gửi lại lời mời (lần " + invitation.getResendCount() + ")");

        return dto;
    }

    @Transactional
    public void deleteInvitation(Long id, UserPrincipal principal) {
        Invitation invitation = invitationRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy lời mời với id: " + id));

        examAccessGuard.checkCanManage(invitation.getExam(), principal);

        if (invitation.getStatus() == InvitationStatus.ACCEPTED
                || invitation.getStatus() == InvitationStatus.COMPLETED) {
            throw new BadRequestException(
                    "Không thể xoá lời mời đã " + (invitation.getStatus() == InvitationStatus.ACCEPTED
                            ? "được chấp nhận" : "hoàn thành") + " để giữ lịch sử thi");
        }

        // Dọn toàn bộ reminder đang gắn với lời mời này.
        List<ExamReminder> reminders = examReminderRepository.findByInvitationId(id);
        if (!reminders.isEmpty()) {
            for (ExamReminder reminder : reminders) {
                reminder.setIsActive(false);
                if (reminder.getStatus() == ReminderStatus.PENDING) {
                    reminder.setStatus(ReminderStatus.CANCELLED);
                }
                reminder.setLastError("Lời mời đã bị xoá");
                examReminderRepository.save(reminder);
            }
        }

        invitationAuditService.record(invitation, InvitationAuditAction.DELETE, principal,
                "Xoá lời mời, đã huỷ " + reminders.size() + " nhắc nhở");

        invitationRepository.delete(invitation);
    }

    @Transactional(readOnly = true)
    public byte[] generateQRCode(Long invitationId, UserPrincipal principal) {
        Invitation invitation = invitationRepository.findById(invitationId)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy lời mời với id: " + invitationId));

        examAccessGuard.checkCanManage(invitation.getExam(), principal);

        if (!Boolean.TRUE.equals(invitation.getAnonymous())) {
            throw new BadRequestException("Chỉ tạo được mã QR cho lời mời ẩn danh");
        }

        String url = buildAnonymousAccessUrl(invitation);
        return generateQRCodeImage(url, 300, 300);
    }

    @Transactional
    public InvitationDTO createAnonymousInvitation(Long examId, AnonymousInvitationRequest request, UserPrincipal principal) {
        boolean isAdminOrTeacher = principal.getUser().getRoles().stream()
                .anyMatch(r -> "ADMIN".equals(r.getName()) || "TEACHER".equals(r.getName()));
        if (!isAdminOrTeacher) {
            throw new BadRequestException("Chỉ ADMIN hoặc TEACHER được tạo lời mời ẩn danh");
        }

        Exam exam = examRepository.findById(examId)
                .filter(e -> Boolean.TRUE.equals(e.getIsActive()))
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy đề thi với id: " + examId));

        examAccessGuard.checkCanManage(exam, principal);

        validateExamInvitable(exam);

        LocalDateTime expiresAt = resolveExpiresAt(
                request.getExpiresAt() != null ? request.getExpiresAt() : null, exam);

        String accessCode = generateAccessCode();

        String guestName = blankToNull(request.getStudentName());
        String guestEmail = blankToNull(request.getStudentEmail());

        Invitation invitation = Invitation.builder()
                .exam(exam)
                .user(null)
                .token(generateToken())
                .status(InvitationStatus.SENT)
                .sentAt(LocalDateTime.now())
                .expiresAt(expiresAt)
                .note(request.getNote())
                .anonymous(true)
                .guestName(guestName)
                .guestEmail(guestEmail)
                .accessCode(accessCode)
                .maxAccessTime(request.getMaxAccessTime() != null ?
                        parseDateTime(request.getMaxAccessTime())
                        : defaultMaxAccessTime(exam))
                .maxAccessAttempts(request.getMaxAccessAttempts() != null ?
                        request.getMaxAccessAttempts() : 1)
                .build();

        invitation = invitationRepository.save(invitation);

        invitationAuditService.record(invitation, InvitationAuditAction.CREATE, principal,
                "Tạo lời mời ẩn danh" + (guestEmail != null ? " cho " + guestEmail : ""));

        if (guestEmail != null) {
            emailService.sendAnonymousAccessLink(invitation, guestEmail);
        }

        return toDTO(invitation, canSeeAccessCode(invitation, principal));
    }

    /**
     * Mặc định cửa sổ truy cập = thời gian bắt đầu đề + thời lượng thi.
     */
    private LocalDateTime defaultMaxAccessTime(Exam exam) {
        if (exam.getStartTime() != null && exam.getDurationMinutes() > 0) {
            return exam.getStartTime().plusMinutes(exam.getDurationMinutes());
        }
        return exam.getEndTime();
    }

    /**
     * Chặn mời tham dự khi kỳ thi đã kết thúc.
     */
    private void validateExamInvitable(Exam exam) {
        if (exam.getEndTime() != null && LocalDateTime.now().isAfter(exam.getEndTime())) {
            throw new BadRequestException("Kỳ thi đã kết thúc, không thể mời tham dự");
        }
    }

    /**
     * Tính thời điểm hết hạn của lời mời và kiểm tra tính hợp lệ.
     */
    private LocalDateTime resolveExpiresAt(String rawExpiresAt, Exam exam) {
        LocalDateTime expiresAt;
        if (rawExpiresAt != null && !rawExpiresAt.isBlank()) {
            expiresAt = parseDateTime(rawExpiresAt);
        } else {
            expiresAt = exam.getEndTime() != null ? exam.getEndTime() : LocalDateTime.now().plusDays(30);
        }

        if (expiresAt != null && LocalDateTime.now().isAfter(expiresAt)) {
            throw new BadRequestException("Thời hạn lời mời không được nằm trong quá khứ");
        }
        if (exam.getEndTime() != null && expiresAt != null && expiresAt.isAfter(exam.getEndTime())) {
            throw new BadRequestException("Thời hạn lời mời không được vượt quá thời gian kết thúc kỳ thi");
        }
        return expiresAt;
    }

    private String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    @Transactional
    public AnonymousAccessResponse verifyAccessCode(String accessCode) {
        Invitation invitation = invitationRepository.findByAccessCode(accessCode)
                .orElseThrow(() -> new ResourceNotFoundException("Mã truy cập không hợp lệ"));

        if (!Boolean.TRUE.equals(invitation.getAnonymous())) {
            throw new BadRequestException("Mã truy cập không hợp lệ");
        }

        if (invitation.getStatus() == InvitationStatus.REVOKED ||
            invitation.getStatus() == InvitationStatus.EXPIRED) {
            return AnonymousAccessResponse.builder()
                    .valid(false)
                    .message("Lời mời đã bị thu hồi hoặc đã hết hạn")
                    .build();
        }

        if (invitation.getExpiresAt() != null && LocalDateTime.now().isAfter(invitation.getExpiresAt())) {
            invitation.setStatus(InvitationStatus.EXPIRED);
            invitationRepository.save(invitation);
            invitationAuditService.record(invitation, InvitationAuditAction.EXPIRE, null,
                    "Hết hạn khi xác minh mã truy cập");
            return AnonymousAccessResponse.builder()
                    .valid(false)
                    .message("Lời mời đã hết hạn")
                    .build();
        }

        if (invitation.getMaxAccessTime() != null
            && LocalDateTime.now().isAfter(invitation.getMaxAccessTime())) {
            invitation.setStatus(InvitationStatus.EXPIRED);
            invitationRepository.save(invitation);
            invitationAuditService.record(invitation, InvitationAuditAction.EXPIRE, null,
                    "Hết hạn khi xác minh mã truy cập");
            return AnonymousAccessResponse.builder()
                    .valid(false)
                    .message("Cửa sổ truy cập của lời mời đã đóng")
                    .build();
        }

        int remaining = invitation.getMaxAccessAttempts() - invitation.getAccessAttemptCount();

        // Không trả về examTitle/studentName ở endpoint public để tránh lộ thông tin kỳ thi.
        return AnonymousAccessResponse.builder()
                .valid(true)
                .accessAttemptsRemaining(Math.max(0, remaining))
                .message("Mã truy cập hợp lệ")
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
                .orElseThrow(() -> new ResourceNotFoundException("Mã truy cập không hợp lệ"));

        if (!Boolean.TRUE.equals(invitation.getAnonymous())) {
            throw new BadRequestException("Mã truy cập không hợp lệ");
        }

        validateInvitationForAction(invitation);

        User guestUser = guestUserService.findOrCreateGuest(studentEmail, studentName);

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

            invitation.setGuestName(studentName);
            invitation.setGuestEmail(studentEmail);
            invitation.setGuestUserId(guestUser.getId());
            invitationRepository.save(invitation);

            return buildSessionResponse(session, invitation, "Bạn đã xác nhận thông tin. Có thể vào phòng thi.");
        }

        if (invitation.getAccessAttemptCount() >= invitation.getMaxAccessAttempts()) {
            throw new BadRequestException("Đã hết số lần truy cập cho lời mời này");
        }

        if (fingerprint != null) {
            anonymousSessionRepository.findByInvitationIdAndFingerprint(invitation.getId(), fingerprint)
                    .ifPresent(session -> {
                        throw new BadRequestException("Thiết bị này đã truy cập kỳ thi này");
                    });
        }

        invitation.setAccessAttemptCount(invitation.getAccessAttemptCount() + 1);

        invitation.setGuestName(studentName);
        invitation.setGuestEmail(studentEmail);
        invitation.setGuestUserId(guestUser.getId());
        invitationRepository.save(invitation);

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

        return buildSessionResponse(session, invitation, "Tạo phiên thi thành công");
    }

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
    public InvitationDTO getById(Long id, UserPrincipal principal) {
        Invitation invitation = invitationRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy lời mời với id: " + id));

        examAccessGuard.checkCanManage(invitation.getExam(), principal);

        return toDTO(invitation, canSeeAccessCode(invitation, principal));
    }

    private void validateInvitationForAction(Invitation invitation) {
        if (invitation.getStatus() == InvitationStatus.REVOKED) {
            throw new BadRequestException("Lời mời đã bị thu hồi");
        }
        if (invitation.getStatus() == InvitationStatus.EXPIRED ||
            (invitation.getExpiresAt() != null && LocalDateTime.now().isAfter(invitation.getExpiresAt()))) {
            invitation.setStatus(InvitationStatus.EXPIRED);
            invitationRepository.save(invitation);
            throw new BadRequestException("Lời mời đã hết hạn");
        }
        if (invitation.getStatus() == InvitationStatus.ACCEPTED) {
            throw new BadRequestException("Lời mời đã được chấp nhận");
        }
        if (invitation.getStatus() == InvitationStatus.REJECTED) {
            throw new BadRequestException("Lời mời đã bị từ chối");
        }
        if (invitation.getMaxAccessTime() != null
            && LocalDateTime.now().isAfter(invitation.getMaxAccessTime())) {
            invitation.setStatus(InvitationStatus.EXPIRED);
            invitationRepository.save(invitation);
            throw new BadRequestException("Cửa sổ truy cập của lời mời đã đóng");
        }
    }

    private String generateToken() {
        return UUID.randomUUID().toString();
    }

    private String generateAccessCode() {
        String code;
        do {
            StringBuilder sb = new StringBuilder(ACCESS_CODE_LENGTH);
            for (int i = 0; i < ACCESS_CODE_LENGTH; i++) {
                sb.append(ACCESS_CODE_CHARS.charAt(random.nextInt(ACCESS_CODE_CHARS.length())));
            }
            code = sb.toString();
        } while (invitationRepository.existsByAccessCode(code));
        return code;
    }

    private String buildAnonymousAccessUrl(Invitation invitation) {
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
            throw new RuntimeException("Không thể tạo mã QR", e);
        }
    }

    private InvitationDTO toDTO(Invitation invitation) {
        return toDTO(invitation, true);
    }

    /**
     * @param canSeeAccessCode khi false, accessCode được mask (null) để không lộ mã truy cập
     *                         cho giáo viên không phải người tạo lời mời.
     */
    private InvitationDTO toDTO(Invitation invitation, boolean canSeeAccessCode) {
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
        dto.setAccessCode(canSeeAccessCode ? invitation.getAccessCode() : null);
        dto.setMaxAccessTime(invitation.getMaxAccessTime());
        dto.setMaxAccessAttempts(invitation.getMaxAccessAttempts());
        dto.setAccessAttemptCount(invitation.getAccessAttemptCount());
        dto.setSourceType(invitation.getSourceType());
        dto.setSourceCourseId(invitation.getSourceCourseId());

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
