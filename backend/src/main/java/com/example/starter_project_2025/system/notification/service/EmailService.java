package com.example.starter_project_2025.system.notification.service;

import java.math.BigDecimal; // NEW
import com.example.starter_project_2025.system.auth.util.MailUtil;
import com.example.starter_project_2025.system.exam.domain.Invitation;
import com.example.starter_project_2025.system.rbac.user.User;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@Slf4j
@Service
@RequiredArgsConstructor
public class EmailService {

    private static final String EXAM_INVITATION_EMAIL = "email/exam_invitation";
    private static final String EXAM_REMINDER_EMAIL = "email/exam_reminder";
    private static final String EXAM_ACCESS_EMAIL = "email/exam_access";
    private static final String EXAM_REVOKED_EMAIL = "email/exam_revoked";
    private static final String EXAM_ACCEPTED_EMAIL = "email/exam_accepted";
    private static final String EXAM_RESULT_EMAIL = "email/exam_result";

    private static final DateTimeFormatter DATE_TIME_FORMATTER =
            DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm");

    private final MailUtil mailUtil;

    @Value("${app.frontend-domain}")
    private String frontendUrl;

    @Value("${spring.mail.username}")
    private String hostEmail;

    // ==================== INVITATION ====================

    public void sendExamInvitation(Invitation invitation, User recipient) {
        String examTitle = invitation.getExam().getTitle();
        String acceptLink = String.format("%s/student/invitations", frontendUrl);

        List<Map.Entry<String, Object>> vars = new ArrayList<>();
        vars.add(Map.entry("username", recipient.getFullName()));
        vars.add(Map.entry("examTitle", examTitle));
        vars.add(Map.entry("durationMinutes", invitation.getExam().getDurationMinutes()));
        vars.add(Map.entry("startTime", formatDateTime(invitation.getExam().getStartTime())));
        vars.add(Map.entry("endTime", formatDateTime(invitation.getExam().getEndTime())));
        vars.add(Map.entry("acceptLink", acceptLink));
        vars.add(Map.entry("expiresAt", formatDateTime(invitation.getExpiresAt())));
        vars.add(Map.entry("note", invitation.getNote() == null ? "" : invitation.getNote()));

        send("[Lời mời] " + examTitle, recipient.getEmail(), EXAM_INVITATION_EMAIL, vars);
    }

    public void sendBatchExamInvitations(List<Invitation> invitations) {
        for (Invitation invitation : invitations) {
            if (invitation.getUser() != null) {
                try {
                    sendExamInvitation(invitation, invitation.getUser());
                } catch (Exception e) {
                    log.error("Failed to send batch invitation email to userId={}: {}",
                            invitation.getUser().getId(), e.getMessage());
                }
            }
        }
    }

    public void sendExamAcceptance(Invitation invitation) {
        if (invitation.getUser() == null) {
            return;
        }
        String examTitle = invitation.getExam().getTitle();
        List<Map.Entry<String, Object>> vars = new ArrayList<>();
        vars.add(Map.entry("username", invitation.getUser().getFullName()));
        vars.add(Map.entry("examTitle", examTitle));
        vars.add(Map.entry("startTime", formatDateTime(invitation.getExam().getStartTime())));
        vars.add(Map.entry("examLink", String.format("%s/student/exams", frontendUrl)));

        send("[Đã xác nhận] " + examTitle, invitation.getUser().getEmail(), EXAM_ACCEPTED_EMAIL, vars);
    }

    // ==================== REMINDER ====================

    public void sendExamReminder(Invitation invitation, LocalDateTime now) {
        if (invitation.getUser() == null || invitation.getExam() == null) {
            return;
        }

        String examTitle = invitation.getExam().getTitle();
        LocalDateTime startTime = invitation.getExam().getStartTime();
        String countdown = buildCountdown(startTime, now);
        String examLink = String.format("%s/student/exams/%d", frontendUrl, invitation.getExam().getId());

        List<Map.Entry<String, Object>> vars = new ArrayList<>();
        vars.add(Map.entry("username", invitation.getUser().getFullName()));
        vars.add(Map.entry("examTitle", examTitle));
        vars.add(Map.entry("startTime", formatDateTime(startTime)));
        vars.add(Map.entry("endTime", formatDateTime(invitation.getExam().getEndTime())));
        vars.add(Map.entry("durationMinutes", invitation.getExam().getDurationMinutes()));
        vars.add(Map.entry("countdown", countdown));
        vars.add(Map.entry("examLink", examLink));

        send("[Nhắc nhở] " + examTitle + " sắp bắt đầu", invitation.getUser().getEmail(),
                EXAM_REMINDER_EMAIL, vars);
    }

    public void sendExamReminderWithAccessCode(Invitation invitation, LocalDateTime now) {
        if (invitation.getExam() == null) {
            return;
        }

        String examTitle = invitation.getExam().getTitle();
        LocalDateTime startTime = invitation.getExam().getStartTime();
        String countdown = buildCountdown(startTime, now);
        String examLink = String.format("%s/anonymous-exam?code=%s", frontendUrl, invitation.getAccessCode());

        List<Map.Entry<String, Object>> vars = new ArrayList<>();
        vars.add(Map.entry("username", invitation.getGuestName() == null ? "Học sinh" : invitation.getGuestName()));
        vars.add(Map.entry("examTitle", examTitle));
        vars.add(Map.entry("startTime", formatDateTime(startTime)));
        vars.add(Map.entry("endTime", formatDateTime(invitation.getExam().getEndTime())));
        vars.add(Map.entry("durationMinutes", invitation.getExam().getDurationMinutes()));
        vars.add(Map.entry("countdown", countdown));
        vars.add(Map.entry("accessCode", invitation.getAccessCode()));
        vars.add(Map.entry("examLink", examLink));

        send("[Nhắc nhở] " + examTitle + " sắp bắt đầu", invitation.getGuestEmail(), EXAM_REMINDER_EMAIL, vars);
    }

    // ==================== ACCESS / REVOKED ====================

    public void sendAnonymousAccessLink(Invitation invitation, String email) {
        String examTitle = invitation.getExam().getTitle();
        // Link phải khớp đúng format mà frontend đọc: /anonymous-exam?code=...
        // Frontend chỉ đọc tham số "code", nên không thêm các tham số khác
        // (ví dụ one-time token) vào link.
        String accessLink = String.format("%s/anonymous-exam?code=%s",
                frontendUrl, invitation.getAccessCode());

        List<Map.Entry<String, Object>> vars = new ArrayList<>();
        vars.add(Map.entry("username", invitation.getGuestName() == null ? "Học sinh" : invitation.getGuestName()));
        vars.add(Map.entry("examTitle", examTitle));
        vars.add(Map.entry("accessCode", invitation.getAccessCode()));
        vars.add(Map.entry("accessLink", accessLink));
        vars.add(Map.entry("startTime", formatDateTime(invitation.getExam().getStartTime())));
        vars.add(Map.entry("durationMinutes", invitation.getExam().getDurationMinutes()));
        vars.add(Map.entry("maxAccessTime", formatDateTime(invitation.getMaxAccessTime())));
        vars.add(Map.entry("maxAccessAttempts", invitation.getMaxAccessAttempts()));

        send("[Link thi] " + examTitle, email, EXAM_ACCESS_EMAIL, vars);
    }

    public void sendExamRevoked(Invitation invitation) {
        if (invitation.getUser() == null) {
            return;
        }
        String examTitle = invitation.getExam().getTitle();

        List<Map.Entry<String, Object>> vars = new ArrayList<>();
        vars.add(Map.entry("username", invitation.getUser().getFullName()));
        vars.add(Map.entry("examTitle", examTitle));
        vars.add(Map.entry("revokedReason",
                invitation.getRevokedReason() == null ? "Không có lý do được cung cấp" : invitation.getRevokedReason()));
        vars.add(Map.entry("revokedAt", formatDateTime(LocalDateTime.now())));

        send("[Hủy] " + examTitle, invitation.getUser().getEmail(), EXAM_REVOKED_EMAIL, vars);
    }

    // ==================== RESULT (KHÔNG CÓ TÀI KHOẢN RBAC) ====================

    /**
     * Gửi kết quả bài thi cho học sinh thi qua link anonymous.
     * <p>
     * Học sinh này không có tài khoản RBAC nên không thể xem điểm trên hệ
     * thống - kết quả được gửi thẳng về email đã khai báo ở lời mời.
     *
     * @param pendingReview true khi còn câu tự luận chờ giáo viên chấm
     */
    public void sendAnonymousExamResult(
            String recipientEmail,
            String studentName,
            String examTitle,
            BigDecimal score, // CHANGED: Integer -> BigDecimal
            BigDecimal totalPoints, // CHANGED: giờ là thang điểm của đề
            String submittedAt,
            boolean pendingReview
    ) {
        if (recipientEmail == null || recipientEmail.isBlank()) {
            return;
        }

        List<Map.Entry<String, Object>> vars = new ArrayList<>();
        vars.add(Map.entry("username", studentName == null || studentName.isBlank() ? "Học sinh" : studentName));
        vars.add(Map.entry("examTitle", examTitle));
        vars.add(Map.entry("score", score == null ? "Chưa chấm" : score.setScale(2, java.math.RoundingMode.HALF_UP).stripTrailingZeros().toPlainString()));
        vars.add(Map.entry("totalPoints", totalPoints == null ? "10" : totalPoints.stripTrailingZeros().toPlainString()));
        vars.add(Map.entry("submittedAt", submittedAt == null ? "" : submittedAt));
        vars.add(Map.entry("pendingReview", pendingReview ? "true" : "false"));
        vars.add(Map.entry("resultMessage", pendingReview
                ? "Bài thi của bạn đã được ghi nhận và đang chờ giáo viên chấm các câu tự luận. "
                + "Chúng tôi sẽ gửi lại điểm chính thức qua email này sau khi chấm xong."
                : "Bài thi của bạn đã được chấm xong. Điểm chi tiết sẽ được thông báo sau khi giáo viên công bố."));

        send("[Kết quả] " + examTitle, recipientEmail, EXAM_RESULT_EMAIL, vars);
    }

    // ==================== HELPERS ====================

    private void send(String subject, String to, String template, List<Map.Entry<String, Object>> vars) {
        try {
            mailUtil.buildAndSendMail(subject, hostEmail, to, template, vars);
            log.info("Email sent to {} with template {}", to, template);
        } catch (Exception e) {
            log.error("Failed to send email to {} with template {}: {}", to, template, e.getMessage());
        }
    }

    private String formatDateTime(LocalDateTime dateTime) {
        return dateTime == null ? "" : dateTime.format(DATE_TIME_FORMATTER);
    }

    private String buildCountdown(LocalDateTime startTime, LocalDateTime now) {
        if (startTime == null) {
            return "Sắp tới";
        }
        Duration duration = Duration.between(now, startTime);
        long totalMinutes = duration.toMinutes();

        if (totalMinutes <= 0) {
            return "Đã bắt đầu";
        }
        long hours = totalMinutes / 60;
        long minutes = totalMinutes % 60;
        if (hours > 24) {
            long days = hours / 24;
            hours = hours % 24;
            return days + " ngày " + hours + " giờ " + minutes + " phút";
        }
        if (hours > 0) {
            return hours + " giờ " + minutes + " phút";
        }
        return minutes + " phút";
    }
}