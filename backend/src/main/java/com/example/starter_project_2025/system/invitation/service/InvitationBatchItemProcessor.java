package com.example.starter_project_2025.system.invitation.service;

import com.example.starter_project_2025.system.auth.util.MailUtil;
import com.example.starter_project_2025.system.exam.domain.Exam;
import com.example.starter_project_2025.system.invitation.audit.InvitationAuditService;
import com.example.starter_project_2025.system.invitation.domain.Invitation;
import com.example.starter_project_2025.system.invitation.domain.InvitationRepository;
import com.example.starter_project_2025.system.invitation.domain.InvitationStatus;
import com.example.starter_project_2025.system.invitation.dto.BatchInvitationItemResult;
import com.example.starter_project_2025.system.rbac.user.User;
import com.example.starter_project_2025.system.rbac.user.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@Slf4j
@Component
@RequiredArgsConstructor
public class InvitationBatchItemProcessor {

    private final UserRepository userRepository;
    private final InvitationRepository invitationRepository;
    private final InvitationAuditService auditService;

    @Autowired(required = false)
    private MailUtil mailUtil;

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public BatchInvitationItemResult processItem(Exam exam, Long userId, String note, LocalDateTime expiresAt) {
        if (userId == null) {
            return BatchInvitationItemResult.builder()
                    .userId(null)
                    .status("FAILED")
                    .reason("ID người dùng không được để trống")
                    .build();
        }

        User user = userRepository.findById(userId).orElse(null);
        if (user == null) {
            return BatchInvitationItemResult.builder()
                    .userId(userId)
                    .status("FAILED")
                    .reason("Người dùng không tồn tại: ID " + userId)
                    .build();
        }

        if (!Boolean.TRUE.equals(user.getIsActive())) {
            return BatchInvitationItemResult.builder()
                    .userId(userId)
                    .userEmail(user.getEmail())
                    .status("FAILED")
                    .reason("Người dùng đã bị vô hiệu hóa, không đủ điều kiện tham gia")
                    .build();
        }

        boolean isStudent = user.getRoles() != null && user.getRoles().stream()
                .anyMatch(r -> "STUDENT".equalsIgnoreCase(r.getName()));

        if (!isStudent) {
            return BatchInvitationItemResult.builder()
                    .userId(userId)
                    .userEmail(user.getEmail())
                    .status("FAILED")
                    .reason("Người dùng không có vai trò học sinh (STUDENT), không đủ điều kiện tham gia")
                    .build();
        }

        Optional<Invitation> existingOpt = invitationRepository.findByExamIdAndUserId(exam.getId(), user.getId());
        if (existingOpt.isPresent()) {
            return BatchInvitationItemResult.builder()
                    .userId(userId)
                    .userEmail(user.getEmail())
                    .invitationId(existingOpt.get().getId())
                    .status("SKIPPED")
                    .reason("Lời mời cho người dùng này đã tồn tại trong kỳ thi")
                    .build();
        }

        Invitation invitation = Invitation.builder()
                .exam(exam)
                .user(user)
                .status(InvitationStatus.PENDING)
                .sentAt(LocalDateTime.now())
                .resendCount(0)
                .note(note)
                .expiresAt(expiresAt)
                .isActive(true)
                .build();

        try {
            Invitation saved = invitationRepository.saveAndFlush(invitation);
            sendEmailNotificationSafely(user, exam);
            auditService.log(saved.getId(), exam.getId(), user.getId(), "BATCH_CREATE", "Mời học sinh tham gia kỳ thi qua batch");

            return BatchInvitationItemResult.builder()
                    .userId(userId)
                    .userEmail(user.getEmail())
                    .invitationId(saved.getId())
                    .status("SUCCESS")
                    .reason("Tạo lời mời thành công")
                    .build();
        } catch (DataIntegrityViolationException ex) {
            Optional<Invitation> fallback = invitationRepository.findByExamIdAndUserId(exam.getId(), user.getId());
            Long fallbackId = fallback.map(Invitation::getId).orElse(null);
            return BatchInvitationItemResult.builder()
                    .userId(userId)
                    .userEmail(user.getEmail())
                    .invitationId(fallbackId)
                    .status("SKIPPED")
                    .reason("Lời mời cho người dùng này đã tồn tại trong kỳ thi (xung đột đồng thời)")
                    .build();
        } catch (Exception ex) {
            log.error("Lỗi bất ngờ khi lưu lời mời cho userId {}: {}", userId, ex.getMessage());
            return BatchInvitationItemResult.builder()
                    .userId(userId)
                    .userEmail(user.getEmail())
                    .status("FAILED")
                    .reason("Lỗi hệ thống: " + ex.getMessage())
                    .build();
        }
    }

    public void sendEmailNotificationSafely(User user, Exam exam) {
        if (mailUtil == null) {
            return;
        }

        try {
            mailUtil.buildAndSendMail(
                    "Lời mời tham gia kỳ thi: " + exam.getTitle(),
                    "no-reply@exam-system.com",
                    user.getEmail(),
                    "email/exam_invitation",
                    List.of(
                            Map.entry("username", user.getFullName()),
                            Map.entry("examTitle", exam.getTitle()),
                            Map.entry("durationMinutes", exam.getDurationMinutes())
                    )
            );
        } catch (Exception ex) {
            log.warn("Không thể gửi email thông báo tới {}: {}", user.getEmail(), ex.getMessage());
        }
    }
}
