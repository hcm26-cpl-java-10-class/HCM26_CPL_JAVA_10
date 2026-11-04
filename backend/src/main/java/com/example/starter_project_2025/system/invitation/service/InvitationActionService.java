package com.example.starter_project_2025.system.invitation.service;

import com.example.starter_project_2025.base.crud.validation.ValidationContext;
import com.example.starter_project_2025.exception.BusinessValidationException;
import com.example.starter_project_2025.exception.ResourceNotFoundException;
import com.example.starter_project_2025.security.UserPrincipal;
import com.example.starter_project_2025.system.exam.domain.Exam;
import com.example.starter_project_2025.system.exam.domain.ExamRepository;
import com.example.starter_project_2025.system.invitation.audit.InvitationAuditService;
import com.example.starter_project_2025.system.invitation.domain.Invitation;
import com.example.starter_project_2025.system.invitation.domain.InvitationRepository;
import com.example.starter_project_2025.system.invitation.domain.InvitationStatus;
import com.example.starter_project_2025.system.invitation.dto.*;
import com.example.starter_project_2025.system.invitation.mapper.InvitationMapper;
import com.example.starter_project_2025.system.rbac.user.User;
import com.example.starter_project_2025.system.rbac.user.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.*;

@Slf4j
@Service
@RequiredArgsConstructor
public class InvitationActionService {

    private final ExamRepository examRepository;
    private final UserRepository userRepository;
    private final InvitationRepository invitationRepository;
    private final InvitationMapper invitationMapper;
    private final InvitationValidator invitationValidator;
    private final InvitationAuditService auditService;
    private final InvitationBatchItemProcessor batchItemProcessor;

    @Transactional
    public InvitationDTO inviteSingle(InvitationDTO request) {
        checkPermission("INVITATION_CREATE");

        ValidationContext ctx = new ValidationContext();
        invitationValidator.validateForCreate(request, ctx);
        ctx.throwIfErrors();

        Exam exam = examRepository.findById(request.getExamId())
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy kỳ thi với ID: " + request.getExamId()));
        User user = userRepository.findById(request.getUserId())
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy người dùng với ID: " + request.getUserId()));

        Invitation invitation = Invitation.builder()
                .exam(exam)
                .user(user)
                .status(InvitationStatus.PENDING)
                .sentAt(LocalDateTime.now())
                .resendCount(0)
                .note(request.getNote())
                .expiresAt(request.getExpiresAt())
                .isActive(true)
                .build();

        Invitation saved;
        try {
            saved = invitationRepository.saveAndFlush(invitation);
        } catch (DataIntegrityViolationException ex) {
            ctx.add("invitation", "Lời mời cho người dùng này đã tồn tại trong kỳ thi");
            ctx.throwIfErrors();
            throw ex;
        }

        batchItemProcessor.sendEmailNotificationSafely(user, exam);
        auditService.log(saved.getId(), exam.getId(), user.getId(), "CREATE", "Mời một người dùng tham gia kỳ thi");

        return invitationMapper.toResponse(saved);
    }

    public BatchInvitationResponse inviteBatch(BatchInvitationRequest request) {
        checkPermission("INVITATION_CREATE");

        if (request.getExamId() == null) {
            ValidationContext ctx = new ValidationContext();
            ctx.add("examId", "examId không được để trống");
            ctx.throwIfErrors();
        }

        Exam exam = examRepository.findById(request.getExamId())
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy kỳ thi với ID: " + request.getExamId()));

        if (!Boolean.TRUE.equals(exam.getIsActive())) {
            ValidationContext ctx = new ValidationContext();
            ctx.add("examId", "Kỳ thi đã bị vô hiệu hóa, không thể tạo lời mời");
            ctx.throwIfErrors();
        }

        List<Long> userIds = request.getUserIds();
        if (userIds == null || userIds.isEmpty()) {
            return BatchInvitationResponse.builder()
                    .examId(exam.getId())
                    .totalRequested(0)
                    .successCount(0)
                    .skippedCount(0)
                    .failedCount(0)
                    .items(Collections.emptyList())
                    .build();
        }

        int totalRequested = userIds.size();
        int successCount = 0;
        int skippedCount = 0;
        int failedCount = 0;
        List<BatchInvitationItemResult> itemResults = new ArrayList<>();
        Set<Long> seenIdsInRequest = new HashSet<>();

        for (Long userId : userIds) {
            if (userId != null && !seenIdsInRequest.add(userId)) {
                // Trùng ID trong request
                itemResults.add(BatchInvitationItemResult.builder()
                        .userId(userId)
                        .status("SKIPPED")
                        .reason("Trùng ID trong yêu cầu")
                        .build());
                skippedCount++;
                continue;
            }

            BatchInvitationItemResult itemResult = batchItemProcessor.processItem(
                    exam,
                    userId,
                    request.getNote(),
                    request.getExpiresAt()
            );

            itemResults.add(itemResult);

            if ("SUCCESS".equals(itemResult.getStatus())) {
                successCount++;
            } else if ("SKIPPED".equals(itemResult.getStatus())) {
                skippedCount++;
            } else {
                failedCount++;
            }
        }

        auditService.log(
                null,
                exam.getId(),
                null,
                "BATCH_CREATE",
                String.format("Xử lý mời hàng loạt: tổng=%d, thành công=%d, bỏ qua=%d, thất bại=%d",
                        totalRequested, successCount, skippedCount, failedCount)
        );

        return BatchInvitationResponse.builder()
                .examId(exam.getId())
                .totalRequested(totalRequested)
                .successCount(successCount)
                .skippedCount(skippedCount)
                .failedCount(failedCount)
                .items(itemResults)
                .build();
    }

    @Transactional
    public InvitationDTO resend(Long invitationId) {
        checkPermission("INVITATION_UPDATE");

        Invitation invitation = invitationRepository.findById(invitationId)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy lời mời với ID: " + invitationId));

        if (invitation.getStatus() != InvitationStatus.PENDING) {
            ValidationContext ctx = new ValidationContext();
            ctx.add("status", "Chỉ có thể gửi lại lời mời ở trạng thái PENDING. Trạng thái hiện tại: " + invitation.getStatus());
            ctx.throwIfErrors();
        }

        invitation.setResendCount(invitation.getResendCount() + 1);
        invitation.setSentAt(LocalDateTime.now());
        Invitation saved = invitationRepository.save(invitation);

        batchItemProcessor.sendEmailNotificationSafely(saved.getUser(), saved.getExam());
        auditService.log(saved.getId(), saved.getExam().getId(), saved.getUser().getId(), "RESEND",
                "Gửi lại lời mời lần thứ " + saved.getResendCount());

        return invitationMapper.toResponse(saved);
    }

    @Transactional
    public InvitationDTO revoke(Long invitationId, RevokeInvitationRequest request) {
        checkPermission("INVITATION_UPDATE");

        Invitation invitation = invitationRepository.findById(invitationId)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy lời mời với ID: " + invitationId));

        ValidationContext ctx = new ValidationContext();
        if (invitation.getStatus() == InvitationStatus.REVOKED) {
            ctx.add("status", "Lời mời đã được thu hồi trước đó");
            ctx.throwIfErrors();
        }

        if (invitation.getStatus() != InvitationStatus.PENDING) {
            ctx.add("status", "Không thể thu hồi lời mời ở trạng thái " + invitation.getStatus() + ". Chỉ có thể thu hồi lời mời đang ở trạng thái PENDING");
            ctx.throwIfErrors();
        }

        String reason = (request != null && request.getReason() != null && !request.getReason().isBlank())
                ? request.getReason().trim()
                : "Thu hồi bởi giáo viên/quản trị viên";

        invitation.setStatus(InvitationStatus.REVOKED);
        invitation.setRevokedAt(LocalDateTime.now());
        invitation.setRevokedReason(reason);
        Invitation saved = invitationRepository.save(invitation);

        auditService.log(saved.getId(), saved.getExam().getId(), saved.getUser().getId(), "REVOKE",
                "Thu hồi lời mời. Lý do: " + reason);

        return invitationMapper.toResponse(saved);
    }

    private void checkPermission(String permission) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated() || "anonymousUser".equals(auth.getPrincipal())) {
            throw new AccessDeniedException("Unauthorized");
        }

        boolean allowed = auth.getAuthorities().stream()
                .anyMatch(a -> a.getAuthority().equals(permission));

        if (!allowed) {
            String username = auth.getName();
            if (auth.getPrincipal() instanceof UserPrincipal up) {
                username = up.getUsername();
            }
            throw new AccessDeniedException(username + " không có quyền: " + permission);
        }
    }
}
