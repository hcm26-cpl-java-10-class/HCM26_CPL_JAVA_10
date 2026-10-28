package com.example.starter_project_2025.system.exam.service;

import com.example.starter_project_2025.system.exam.domain.Exam;
import com.example.starter_project_2025.system.exam.domain.ExamResultEmailLog;
import com.example.starter_project_2025.system.exam.domain.ExamResultEmailLogRepository;
import com.example.starter_project_2025.system.exam.domain.ExamResultPublication;
import com.example.starter_project_2025.system.exam.domain.ExamResultPublicationRepository;
import com.example.starter_project_2025.system.exam.domain.ScoreEmailDeliveryStatus;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.LocalDateTime;
import com.example.starter_project_2025.system.exam.dto.ScoreEmailRecipient;
import java.util.List;

@Service
@RequiredArgsConstructor
public class ExamResultEmailService {

    // Bien "log" cua @Slf4j bi che boi bien ExamResultEmailLog trong method, nen dung rieng.
    private static final Logger LOGGER = LoggerFactory.getLogger(ExamResultEmailService.class);

    private final JavaMailSender mailSender;
    private final ExamResultEmailLogRepository emailLogRepository;
    private final ExamResultPublicationRepository publicationRepository;
    private final ExamResultAccessService resultAccessService;

    @Transactional
    public void sendScoreEmail(
            Exam exam,
            Long studentId,
            String recipientEmail,
            String scoreSummary
    ) {
        if (exam == null || exam.getId() == null
                || studentId == null
                || recipientEmail == null
                || recipientEmail.isBlank()) {
            throw new IllegalArgumentException(
                    "Exam, student ID and recipient email are required"
            );
        }

        if (!resultAccessService.shouldEmailScore(exam)) {
            return;
        }

        ExamResultPublication publication = publicationRepository
                .findByExam_Id(exam.getId())
                .orElseThrow(() ->
                        new IllegalStateException(
                                "Exam result publication was not found"
                        )
                );

        LocalDateTime publicationVersion = publication.getPublishedAt();

        if (publicationVersion == null || !publication.isPublished()) {
            return;
        }

        var existingLog = emailLogRepository
                .findByExam_IdAndStudentIdAndPublicationVersion(
                        exam.getId(),
                        studentId,
                        publicationVersion
                );

        if (existingLog.isPresent()) {
            ExamResultEmailLog existing = existingLog.get();

            if (existing.getStatus() == ScoreEmailDeliveryStatus.SENT
                    || existing.getStatus() == ScoreEmailDeliveryStatus.PENDING) {
                return;
            }
        }

        ExamResultEmailLog log = existingLog.orElseGet(() -> {
            ExamResultEmailLog created = new ExamResultEmailLog();
            created.setExam(exam);
            created.setStudentId(studentId);
            created.setRecipientEmail(recipientEmail);
            created.setPublicationVersion(publicationVersion);
            created.setStatus(ScoreEmailDeliveryStatus.PENDING);
            created.setAttemptCount(0);
            return created;
        });

        log.setRecipientEmail(recipientEmail);
        log.setStatus(ScoreEmailDeliveryStatus.PENDING);
        log.setLastError(null);
        emailLogRepository.save(log);

        try {
            SimpleMailMessage message = new SimpleMailMessage();
            message.setTo(recipientEmail);
            message.setSubject("Exam result: " + exam.getTitle());
            message.setText(
                    "Your exam result is available.\n\n"
                            + scoreSummary
                            + "\n\nThis is an automated message."
            );

            mailSender.send(message);

            log.setStatus(ScoreEmailDeliveryStatus.SENT);
            log.setSentAt(LocalDateTime.now());
            log.setLastError(null);
            LOGGER.info("Score email sent to {} for examId {} studentId {}",
                    recipientEmail, exam.getId(), studentId);
        } catch (Exception exception) {
            log.setStatus(ScoreEmailDeliveryStatus.FAILED);
            log.setLastError(truncate(exception.getMessage(), 1000));
            LOGGER.error("Failed to send score email to {} for examId {} studentId {}: {}",
                    recipientEmail, exam.getId(), studentId, exception.getMessage());
        } finally {
            log.setAttemptCount(log.getAttemptCount() + 1);
            emailLogRepository.save(log);
        }
    }

    private String truncate(String value, int maxLength) {
        if (value == null) {
            return "Unknown email delivery error";
        }

        return value.length() <= maxLength
                ? value
                : value.substring(0, maxLength);
    }

    public void sendScoreEmails(
            Exam exam,
            List<ScoreEmailRecipient> recipients
    ) {
        if (recipients == null || recipients.isEmpty()) {
            return;
        }

        for (ScoreEmailRecipient recipient : recipients) {
            if (recipient == null) {
                continue;
            }

            sendScoreEmail(
                    exam,
                    recipient.studentId(),
                    recipient.email(),
                    recipient.scoreSummary()
            );
        }
    }
}
