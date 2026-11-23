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
class InvitationBatchFlow {

    private final InvitationService s;

    InvitationBatchFlow(InvitationService s) {
        this.s = s;
    }

    public BatchInvitationResponse createBatchInvitations(Long examId, BatchInvitationRequest request, UserPrincipal principal) {
        boolean isAdminOrTeacher = principal.getUser().getRoles().stream()
                .anyMatch(r -> "ADMIN".equals(r.getName()) || "TEACHER".equals(r.getName()));
        if (!isAdminOrTeacher) {
            throw new BadRequestException("Chỉ ADMIN hoặc TEACHER được tạo lời mời hàng loạt");
        }

        Exam exam = s.examRepository.findById(examId)
                .filter(e -> Boolean.TRUE.equals(e.getIsActive()))
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy đề thi với id: " + examId));

        s.examAccessGuard.checkCanManage(exam, principal);


        List<InvitationDTO> successful = new ArrayList<>();
        List<String> errors = new ArrayList<>();

        for (InvitationCreateRequest invRequest : request.getInvitations()) {
            try {
                InvitationDTO dto = s.createInvitation(examId, invRequest, principal, request.isSendEmail());
                successful.add(dto);
            } catch (Exception e) {
                errors.add("User ID " + invRequest.getUserId() + ": " + e.getMessage());
            }
        }

        s.invitationAuditService.record(
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

        Exam exam = s.examRepository.findById(examId)
                .filter(e -> Boolean.TRUE.equals(e.getIsActive()))
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy đề thi với id: " + examId));

        s.examAccessGuard.checkCanManage(exam, principal);


        Course course = s.courseRepository.findById(request.getCourseId())
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Không tìm thấy lớp với id: " + request.getCourseId()));

        List<User> classStudents = s.courseEnrollmentService.getActiveStudentsByCourse(course.getId());
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

        LocalDateTime expiresAt = s.anonymousInvitationFlow.resolveExpiresAt(request.getExpiresAt(), exam);
        LocalDateTime availableFrom = s.parseDateTime(request.getAvailableFrom());

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

            if (s.invitationRepository.existsByExamIdAndUserId(examId, student.getId())) {
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
                        .token(s.generateToken())
                        .status(InvitationStatus.PENDING)
                        .expiresAt(expiresAt)
                        .availableFrom(availableFrom)
                        .note(request.getNote())
                        .anonymous(false)
                        .sourceType("COURSE")
                        .sourceCourseId(course.getId())
                        .build();

                invitation = s.invitationRepository.save(invitation);

                s.invitationAuditService.record(invitation, InvitationAuditAction.CREATE, principal, null);

                if (request.isSendEmail()) {
                    s.emailService.sendExamInvitation(invitation, student);
                    invitation.setStatus(InvitationStatus.SENT);
                    invitation.setSentAt(LocalDateTime.now());
                    invitation = s.invitationRepository.save(invitation);
                }

                InvitationDTO dto = s.toDTO(invitation);
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

        s.invitationAuditService.record(
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
}
