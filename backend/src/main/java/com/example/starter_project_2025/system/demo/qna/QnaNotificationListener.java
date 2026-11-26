package com.example.starter_project_2025.system.demo.qna;

import com.example.starter_project_2025.system.auth.util.MailUtil;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

import java.util.List;
import java.util.Map;

/**
 * Gửi email thông báo Q&A. Chạy bất đồng bộ và chỉ sau khi transaction đã commit, nên:
 * <ul>
 *   <li>không làm chậm request đặt câu hỏi / trả lời;</li>
 *   <li>không gửi mail cho câu hỏi / câu trả lời bị rollback;</li>
 *   <li>lỗi SMTP chỉ được log, không bao giờ làm hỏng luồng Q&A.</li>
 * </ul>
 * Tắt bằng {@code app.qna.email-notifications-enabled=false}.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class QnaNotificationListener {

    private static final String NEW_QUESTION_TEMPLATE = "email/new_question_email";
    private static final String ANSWERED_TEMPLATE = "email/question_answered_email";
    private static final int EXCERPT_LENGTH = 300;
    private static final int SUBJECT_LENGTH = 150;

    private final MailUtil mailUtil;

    @Value("${spring.mail.username}")
    private String fromEmail;

    @Value("${app.frontend-domain}")
    private String frontendUrl;

    @Value("${app.qna.email-notifications-enabled:true}")
    private boolean enabled;

    @Async
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT, fallbackExecution = true)
    public void onQuestionPosted(QnaNotificationEvents.QuestionPosted event) {
        if (!enabled) {
            return;
        }
        String link = frontendUrl + "/curriculum?courseId=" + event.courseId()
                + "&sectionId=" + event.sectionId()
                + "&lessonId=" + event.lessonId()
                + "&questionId=" + event.questionId();

        send(event.recipientEmail(),
                subject("New question in " + event.courseName() + " – " + event.lessonTitle()),
                NEW_QUESTION_TEMPLATE,
                List.of(
                        var("recipientName", event.recipientName()),
                        var("askerName", event.askerName()),
                        var("courseName", event.courseName()),
                        var("lessonTitle", event.lessonTitle()),
                        var("questionContent", excerpt(event.questionContent())),
                        var("link", link),
                        var("inboxLink", frontendUrl + "/unanswered-questions")
                ));
    }

    @Async
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT, fallbackExecution = true)
    public void onQuestionAnswered(QnaNotificationEvents.QuestionAnswered event) {
        if (!enabled) {
            return;
        }
        // Người hỏi có ghi danh -> mở đúng bài trong trang học; nếu không (admin/giảng viên tự hỏi) -> trang chủ.
        String link = event.enrollmentId() == null
                ? frontendUrl
                : frontendUrl + "/enrollments/" + event.enrollmentId() + "/learn"
                  + "?lessonId=" + event.lessonId() + "&questionId=" + event.questionId();

        send(event.recipientEmail(),
                subject("Your question in " + event.courseName() + " was answered"),
                ANSWERED_TEMPLATE,
                List.of(
                        var("recipientName", event.recipientName()),
                        var("answererName", event.answererName()),
                        var("courseName", event.courseName()),
                        var("lessonTitle", event.lessonTitle()),
                        var("questionContent", excerpt(event.questionContent())),
                        var("answerContent", excerpt(event.answerContent())),
                        var("link", link)
                ));
    }

    private void send(String to, String subject, String template, List<Map.Entry<String, Object>> variables) {
        try {
            mailUtil.buildAndSendMail(subject, fromEmail, to, template, variables);
        } catch (Exception exception) {
            // Thông báo là "best effort": không để lỗi SMTP lan ra ngoài.
            log.warn("Could not send Q&A notification email (template={}): {}", template, exception.getMessage());
        }
    }

    /** {@link Map#entry} không chấp nhận null nên luôn quy về chuỗi rỗng. */
    private static Map.Entry<String, Object> var(String name, String value) {
        return Map.entry(name, value == null ? "" : value);
    }

    private static String excerpt(String text) {
        String flat = text == null ? "" : text.strip().replaceAll("\\s+", " ");
        return flat.length() <= EXCERPT_LENGTH ? flat : flat.substring(0, EXCERPT_LENGTH).stripTrailing() + "…";
    }

    /** Bỏ xuống dòng (chống header injection) và giới hạn độ dài tiêu đề. */
    private static String subject(String raw) {
        String flat = raw.replaceAll("[\\r\\n]+", " ").strip();
        return flat.length() <= SUBJECT_LENGTH ? flat : flat.substring(0, SUBJECT_LENGTH - 1).stripTrailing() + "…";
    }
}
