package com.example.starter_project_2025.system.exam.invitation.service;

import com.example.starter_project_2025.exception.BadRequestException;
import com.example.starter_project_2025.exception.ResourceNotFoundException;
import com.example.starter_project_2025.security.UserPrincipal;
import com.example.starter_project_2025.system.exam.invitation.audit.InvitationAuditAction;
import com.example.starter_project_2025.system.exam.invitation.audit.InvitationAuditService;
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
import com.example.starter_project_2025.system.exam.core.domain.Exam;
import com.example.starter_project_2025.system.exam.core.domain.ExamRepository;
import com.example.starter_project_2025.system.exam.core.service.ExamAccessGuard;
import com.example.starter_project_2025.system.exam.invitation.domain.AnonymousSession;
import com.example.starter_project_2025.system.exam.invitation.domain.AnonymousSessionRepository;
import com.example.starter_project_2025.system.exam.invitation.domain.Invitation;
import com.example.starter_project_2025.system.exam.invitation.domain.InvitationRepository;
import com.example.starter_project_2025.system.exam.invitation.domain.InvitationStatus;
import com.example.starter_project_2025.system.exam.invitation.dto.AnonymousAccessResponse;
import com.example.starter_project_2025.system.exam.invitation.dto.AnonymousInvitationRequest;
import com.example.starter_project_2025.system.exam.invitation.dto.AnonymousSessionResponse;
import com.example.starter_project_2025.system.exam.invitation.dto.BatchInvitationRequest;
import com.example.starter_project_2025.system.exam.invitation.dto.BatchInvitationResponse;
import com.example.starter_project_2025.system.exam.invitation.dto.GroupInvitationRequest;
import com.example.starter_project_2025.system.exam.invitation.dto.InvitationBulkItemResult;
import com.example.starter_project_2025.system.exam.invitation.dto.InvitationCreateRequest;
import com.example.starter_project_2025.system.exam.invitation.dto.InvitationDTO;
import com.example.starter_project_2025.system.exam.invitation.dto.InvitationFilter;
import com.example.starter_project_2025.system.exam.reminder.domain.ExamReminder;
import com.example.starter_project_2025.system.exam.reminder.domain.ExamReminderRepository;
import com.example.starter_project_2025.system.exam.reminder.domain.ReminderStatus;

/** Tach tu InvitationService: giu nguyen hanh vi, chi chuyen cac phuong thuc cung trach nhiem ra file rieng. */
class AnonymousInvitationFlow {

    private final InvitationService s;

    AnonymousInvitationFlow(InvitationService s) {
        this.s = s;
    }

    public InvitationDTO createAnonymousInvitation(Long examId, AnonymousInvitationRequest request, UserPrincipal principal) {
        boolean isAdminOrTeacher = principal.getUser().getRoles().stream()
                .anyMatch(r -> "ADMIN".equals(r.getName()) || "TEACHER".equals(r.getName()));
        if (!isAdminOrTeacher) {
            throw new BadRequestException("Chỉ ADMIN hoặc TEACHER được tạo lời mời ẩn danh");
        }

        Exam exam = s.examRepository.findById(examId)
                .filter(e -> Boolean.TRUE.equals(e.getIsActive()))
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy đề thi với id: " + examId));

        s.examAccessGuard.checkCanManage(exam, principal);


        LocalDateTime expiresAt = resolveExpiresAt(
                request.getExpiresAt() != null ? request.getExpiresAt() : null, exam);

        String accessCode = s.generateAccessCode();

        String guestName = blankToNull(request.getStudentName());
        String guestEmail = blankToNull(request.getStudentEmail());

        Invitation invitation = Invitation.builder()
                .exam(exam)
                .user(null)
                .token(s.generateToken())
                .status(InvitationStatus.SENT)
                .sentAt(LocalDateTime.now())
                .expiresAt(expiresAt)
                .note(request.getNote())
                .anonymous(true)
                .guestName(guestName)
                .guestEmail(guestEmail)
                .accessCode(accessCode)
                .availableFrom(s.parseDateTime(request.getAvailableFrom()))
                .maxAccessTime(request.getMaxAccessTime() != null ?
                        s.parseDateTime(request.getMaxAccessTime())
                        : null)
                .maxAccessAttempts(request.getMaxAccessAttempts() != null ?
                        request.getMaxAccessAttempts() : 1)
                .build();

        invitation = s.invitationRepository.save(invitation);

        s.invitationAuditService.record(invitation, InvitationAuditAction.CREATE, principal,
                "Tạo lời mời ẩn danh" + (guestEmail != null ? " cho " + guestEmail : ""));

        if (guestEmail != null) {
            s.emailService.sendAnonymousAccessLink(invitation, guestEmail);
        }

        return s.toDTO(invitation, s.canSeeAccessCode(invitation, principal));
    }

    /**
     * Tính thời điểm hết hạn của lời mời và kiểm tra tính hợp lệ.
     */
    LocalDateTime resolveExpiresAt(String rawExpiresAt, Exam exam) {
        LocalDateTime expiresAt;
        if (rawExpiresAt != null && !rawExpiresAt.isBlank()) {
            expiresAt = s.parseDateTime(rawExpiresAt);
        } else {
            expiresAt = LocalDateTime.now().plusDays(30);
        }

        if (expiresAt != null && LocalDateTime.now().isAfter(expiresAt)) {
            throw new BadRequestException("Thời hạn lời mời không được nằm trong quá khứ");
        }
        return expiresAt;
    }

    private String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    public AnonymousAccessResponse verifyAccessCode(String accessCode) {
        Invitation invitation = s.invitationRepository.findByAccessCode(accessCode)
                .orElseThrow(() -> new ResourceNotFoundException("Mã truy cập không hợp lệ"));

        if (!Boolean.TRUE.equals(invitation.getAnonymous())) {
            throw new BadRequestException("Mã truy cập không hợp lệ");
        }

        if (invitation.getAvailableFrom() != null && LocalDateTime.now().isBefore(invitation.getAvailableFrom())) {
            return AnonymousAccessResponse.builder()
                    .valid(false)
                    .message("Ca thi chưa bắt đầu. Vui lòng quay lại vào lúc " + invitation.getAvailableFrom())
                    .build();
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
            s.invitationRepository.save(invitation);
            s.invitationAuditService.record(invitation, InvitationAuditAction.EXPIRE, null,
                    "Hết hạn khi xác minh mã truy cập");
            return AnonymousAccessResponse.builder()
                    .valid(false)
                    .message("Lời mời đã hết hạn")
                    .build();
        }

        if (invitation.getMaxAccessTime() != null
            && LocalDateTime.now().isAfter(invitation.getMaxAccessTime())) {
            invitation.setStatus(InvitationStatus.EXPIRED);
            s.invitationRepository.save(invitation);
            s.invitationAuditService.record(invitation, InvitationAuditAction.EXPIRE, null,
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

    public AnonymousSessionResponse createAnonymousSession(
            String accessCode,
            String fingerprint,
            String studentName,
            String studentEmail
    ) {
        Invitation invitation = s.invitationRepository.lockByAccessCode(accessCode)
                .orElseThrow(() -> new ResourceNotFoundException("Mã truy cập không hợp lệ"));

        if (!Boolean.TRUE.equals(invitation.getAnonymous())) {
            throw new BadRequestException("Mã truy cập không hợp lệ");
        }

        s.validateInvitationForAction(invitation);

        User guestUser = s.guestUserService.findOrCreateGuest(studentEmail, studentName);

        Optional<AnonymousSession> reusable = reusableSessionFor(invitation, guestUser);
        if (reusable.isPresent()) {
            AnonymousSession session = reusable.get();
            session.setGuestName(studentName);
            session.setGuestEmail(studentEmail);
            session.setIsValid(true);
            if (fingerprint != null && !fingerprint.equals(session.getFingerprint())) {
                session.setFingerprint(fingerprint);
            }
            s.anonymousSessionRepository.save(session);

            invitation.setGuestName(studentName);
            invitation.setGuestEmail(studentEmail);
            invitation.setGuestUserId(guestUser.getId());
            s.invitationRepository.save(invitation);

            return buildSessionResponse(session, invitation, "Bạn đã xác nhận thông tin. Có thể vào phòng thi.");
        }

        if (invitation.getAccessAttemptCount() >= invitation.getMaxAccessAttempts()) {
            throw new BadRequestException("Đã hết số lần truy cập cho lời mời này");
        }

        if (fingerprint != null) {
            s.anonymousSessionRepository.findByInvitationIdAndFingerprint(invitation.getId(), fingerprint)
                    .ifPresent(session -> {
                        throw new BadRequestException("Thiết bị này đã truy cập kỳ thi này");
                    });
        }

        invitation.setAccessAttemptCount(invitation.getAccessAttemptCount() + 1);

        invitation.setGuestName(studentName);
        invitation.setGuestEmail(studentEmail);
        invitation.setGuestUserId(guestUser.getId());
        s.invitationRepository.save(invitation);

        String sessionToken = s.generateToken();
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

        s.anonymousSessionRepository.save(session);

        return buildSessionResponse(session, invitation, "Tạo phiên thi thành công");
    }

    private Optional<AnonymousSession> reusableSessionFor(Invitation invitation, User guestUser) {
        List<AnonymousSession> sessions = s.anonymousSessionRepository
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
}
