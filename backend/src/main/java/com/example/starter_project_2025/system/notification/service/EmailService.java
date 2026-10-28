package com.example.starter_project_2025.system.notification.service;

import java.math.BigDecimal;
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
    private static final String SCORE_APPEAL_APPROVED_EMAIL = "email/score_appeal_approved";
    private static final String SCORE_APPEAL_REJECTED_EMAIL = "email/score_appeal_rejected";

    private static final DateTimeFormatter DATE_TIME_FORMATTER =
            DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm");

    private final MailUtil mailUtil;

    @Value("${app.frontend-domain}")
    private String frontendUrl;

    @Value("${spring.mail.username}")
    private String hostEmail;

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

    public void sendAnonymousAccessLink(Invitation invitation, String email) {
        String examTitle = invitation.getExam().getTitle();
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

    public boolean sendAnonymousExamResult(
            String recipientEmail,
            String studentName,
            String examTitle,
            BigDecimal score,
            BigDecimal totalPoints,
            String submittedAt,
            boolean pendingReview
    ) {
        if (recipientEmail == null || recipientEmail.isBlank()) {
            log.warn("Skip anonymous exam result email: recipient email is empty (exam {})", examTitle);
            return false;
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

        return send("[Kết quả] " + examTitle, recipientEmail, EXAM_RESULT_EMAIL, vars);
    }

    public void sendScoreAppealApproved(
            String recipientEmail,
            String studentName,
            String examTitle,
            BigDecimal oldScore,
            BigDecimal newScore,
            String note) {
        if (recipientEmail == null || recipientEmail.isBlank()) {
            return;
        }
        List<Map.Entry<String, Object>> vars = new ArrayList<>();
        vars.add(Map.entry("username", studentName == null || studentName.isBlank() ? "Student" : studentName));
        vars.add(Map.entry("examTitle", examTitle == null ? "" : examTitle));
        vars.add(Map.entry("oldScore", formatScore(oldScore)));
        vars.add(Map.entry("newScore", newScore == null ? "Unchanged" : formatScore(newScore)));
        vars.add(Map.entry("note", note == null ? "" : note));

        send("[Score Appeal Approved] " + examTitle, recipientEmail, SCORE_APPEAL_APPROVED_EMAIL, vars);
    }

    public void sendScoreAppealRejected(
            String recipientEmail,
            String studentName,
            String examTitle,
            String note) {
        if (recipientEmail == null || recipientEmail.isBlank()) {
            return;
        }
        List<Map.Entry<String, Object>> vars = new ArrayList<>();
        vars.add(Map.entry("username", studentName == null || studentName.isBlank() ? "Student" : studentName));
        vars.add(Map.entry("examTitle", examTitle == null ? "" : examTitle));
        vars.add(Map.entry("note", note == null ? "" : note));

        send("[Score Appeal Rejected] " + examTitle, recipientEmail, SCORE_APPEAL_REJECTED_EMAIL, vars);
    }

    /**
     * Gui email test de kiem tra cau hinh SMTP. Tra ve true neu gui thanh cong.
     */
    public boolean sendTestEmail(String recipientEmail) {
        if (recipientEmail == null || recipientEmail.isBlank()) {
            log.warn("Skip test email: recipient is empty");
            return false;
        }

        List<Map.Entry<String, Object>> vars = new ArrayList<>();
        vars.add(Map.entry("username", "Thí sinh"));
        vars.add(Map.entry("examTitle", "Email test"));
        vars.add(Map.entry("score", "8.5"));
        vars.add(Map.entry("totalPoints", "10"));
        vars.add(Map.entry("submittedAt", formatDateTime(LocalDateTime.now())));
        vars.add(Map.entry("pendingReview", "false"));
        vars.add(Map.entry("resultMessage",
                "Đây là email kiểm tra cấu hình SMTP. Nếu bạn nhận được email này thì hệ thống đã gửi được kết quả thi thành công."));

        return send("[Test] Kiểm tra cấu hình email", recipientEmail.trim(), EXAM_RESULT_EMAIL, vars);
    }

    private String formatScore(BigDecimal score) {
        if (score == null) {
            return "-";
        }
        return score.setScale(2, java.math.RoundingMode.HALF_UP).stripTrailingZeros().toPlainString();
    }

    /**
     * Gui email. Tra ve true neu gui thanh cong, false neu that bai.
     * Log day du stack trace de canh copy console backend khi canh tim loi gui mail.
     */
    private boolean send(String subject, String to, String template, List<Map.Entry<String, Object>> vars) {
        if (to == null || to.isBlank()) {
            log.warn("Skip email '{}' because recipient is empty (template {})", subject, template);
            return false;
        }
        try {
            mailUtil.buildAndSendMail(subject, hostEmail, to, template, vars);
            log.info("Email sent to {} with template {}", to, template);
            return true;
        } catch (Exception e) {
            log.error("Failed to send email to {} with template {} subject='{}': {}",
                    to, template, subject, e.getMessage(), e);
            return false;
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