package com.example.starter_project_2025.system.exam.service;

import java.math.BigDecimal;
import com.example.starter_project_2025.exception.BadRequestException;
import com.example.starter_project_2025.exception.ResourceNotFoundException;
import com.example.starter_project_2025.system.exam.domain.AnonymousSession;
import com.example.starter_project_2025.system.exam.domain.AnonymousSessionRepository;
import com.example.starter_project_2025.system.exam.domain.ExamAttempt;
import com.example.starter_project_2025.system.exam.domain.ExamAttemptRepository;
import com.example.starter_project_2025.system.exam.domain.ExamAttemptStatus;
import com.example.starter_project_2025.system.exam.dto.ExamAttemptDTO;
import com.example.starter_project_2025.system.exam.dto.IntegrityEventRequest;
import com.example.starter_project_2025.system.exam.dto.SaveExamAnswerRequest;
import com.example.starter_project_2025.system.notification.service.EmailService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class AnonymousExamService {

    private static final DateTimeFormatter SUBMITTED_AT_FORMAT =
            DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm");

    private final AnonymousSessionRepository sessionRepository;
    private final ExamAttemptService attemptService;
    private final ExamAttemptRepository attemptRepository;
    private final EmailService emailService;
    private final ExamIntegrityService integrityService; // NEW (anti-cheat)
    private final GuestEmailResolver guestEmailResolver;

    @Transactional(readOnly = true)
    private AnonymousSession requireSession(String sessionToken) {
        if (sessionToken == null || sessionToken.isBlank()) {
            throw new BadRequestException("Phiên thi không hợp lệ, vui lòng mở lại link");
        }

        AnonymousSession session = sessionRepository.findBySessionToken(sessionToken)
                .orElseThrow(() -> new BadRequestException("Phiên thi không hợp lệ, vui lòng mở lại link"));

        if (!Boolean.TRUE.equals(session.getIsValid())) {
            throw new BadRequestException("Phiên thi đã hết hạn, vui lòng mở lại link");
        }

        if (session.getGuestUserId() == null) {
            throw new BadRequestException("Phiên thi chưa gắn được thông tin học sinh");
        }

        return session;
    }

    @Transactional
    public ExamAttemptDTO startOrResume(String sessionToken, String password) {
        AnonymousSession session = requireSession(sessionToken);

        return attemptService.startOrResumeForGuest(
                session.getInvitation().getExam().getId(),
                session.getGuestUserId(),
                password
        );
    }

    @Transactional
    public ExamAttemptDTO saveAnswers(String sessionToken, Long attemptId, List<SaveExamAnswerRequest> requests) {
        AnonymousSession session = requireSession(sessionToken);
        assertAttemptBelongsToSession(session, attemptId);

        return attemptService.saveAnswers(attemptId, session.getGuestUserId(), requests);
    }

    /** NEW (anti-cheat): ghi vi pham cua thi sinh an danh. */
    @Transactional
    public void recordIntegrity(String sessionToken, Long attemptId, IntegrityEventRequest request,
                                String userAgent, String ip) {
        AnonymousSession session = requireSession(sessionToken);
        assertAttemptBelongsToSession(session, attemptId);
        integrityService.record(attemptId, session.getGuestUserId(), request, userAgent, ip);
    }

    @Transactional
    public ExamAttemptDTO submit(String sessionToken, Long attemptId, List<SaveExamAnswerRequest> requests) {
        AnonymousSession session = requireSession(sessionToken);
        assertAttemptBelongsToSession(session, attemptId);

        ExamAttemptDTO result = attemptService.submit(attemptId, session.getGuestUserId(), requests);

        sendResultEmailIfJustSubmitted(session, attemptId);

        return result;
    }

    private void sendResultEmailIfJustSubmitted(AnonymousSession session, Long attemptId) {
        ExamAttempt attempt = attemptRepository.findById(attemptId).orElse(null);
        if (attempt == null) {
            log.warn("Skip anonymous result email: attempt {} not found (session {})",
                    attemptId, session.getId());
            return;
        }

        boolean finished = attempt.getStatus() == ExamAttemptStatus.SUBMITTED
                || attempt.getStatus() == ExamAttemptStatus.PENDING_REVIEW
                || attempt.getStatus() == ExamAttemptStatus.EXPIRED;

        if (!finished) {
            log.warn("Skip anonymous result email: attempt {} status {} not finished (session {})",
                    attemptId, attempt.getStatus(), session.getId());
            return;
        }

        if (session.getCompletedAt() != null) {
            log.warn("Skip anonymous result email: session {} already completed (attempt {})",
                    session.getId(), attemptId);
            return;
        }

        if (session.getGuestEmail() == null || session.getGuestEmail().isBlank()) {
            log.warn("Skip anonymous result email: session {} has no guest email (attempt {}, examId {})",
                    session.getId(), attemptId,
                    attempt.getExam() != null ? attempt.getExam().getId() : null);
            return;
        }

        session.setCompletedAt(LocalDateTime.now());
        session.setIsValid(false);
        sessionRepository.save(session);

        boolean pendingReview = attempt.getFinalScore() == null;

        BigDecimal score = attempt.getFinalScore() != null
                ? attempt.getFinalScore()
                : attempt.getObjectiveScore();

        String submittedAt = attempt.getSubmittedAt() == null
                ? ""
                : SUBMITTED_AT_FORMAT.format(
                LocalDateTime.ofInstant(attempt.getSubmittedAt(), ZoneId.systemDefault()));

        try {
            boolean sent = emailService.sendAnonymousExamResult(
                    session.getGuestEmail(),
                    session.getGuestName(),
                    attempt.getExam().getTitle(),
                    score,
                    ExamScoring.effectiveMax(attempt.getMaxScore()),
                    submittedAt,
                    pendingReview
            );
            if (sent) {
                log.info("Anonymous result email dispatched to {} for examId {} attempt {} (pendingReview={})",
                        session.getGuestEmail(),
                        attempt.getExam() != null ? attempt.getExam().getId() : null,
                        attemptId, pendingReview);
            } else {
                log.error("Anonymous result email FAILED for examId {} attempt {} (session {}). "
                                + "Check SMTP config: spring.mail.username / MAIL_APP_PASSWORD (Gmail app password).",
                        attempt.getExam() != null ? attempt.getExam().getId() : null,
                        attemptId, session.getId());
            }
        } catch (Exception e) {
            log.error("Failed to send anonymous exam result email to {} for examId {} attempt {} session {}: {}",
                    session.getGuestEmail(),
                    attempt.getExam() != null ? attempt.getExam().getId() : null,
                    attemptId, session.getId(), e.getMessage());
        }
    }

    private void assertAttemptBelongsToSession(AnonymousSession session, Long attemptId) {
        ExamAttempt attempt = attemptRepository.findById(attemptId)
                .orElseThrow(() -> new ResourceNotFoundException("Exam attempt not found"));

        boolean sameExam = attempt.getExam().getId().equals(session.getInvitation().getExam().getId());

        if (!sameExam || attempt.getStudent() == null
                || !attempt.getStudent().getId().equals(session.getGuestUserId())) {
            throw new BadRequestException("Bài thi không thuộc phiên của bạn");
        }
    }

    /**
     * Gui lai email ket qua cho thi sinh tu do (guest).
     * emailOverride cho phep giao vien gui vao dia chi khac khi thieu sinh nhieu tai khoang.
     */
    @Transactional(readOnly = true)
    public boolean resendResultEmailToGuest(Long attemptId, String emailOverride) {
        ExamAttempt attempt = attemptRepository.findById(attemptId).orElse(null);
        if (attempt == null) {
            log.warn("Resend guest result email failed: attempt {} not found", attemptId);
            return false;
        }

        if (attempt.getStudent() == null
                || !Boolean.TRUE.equals(attempt.getStudent().getIsGuest())) {
            log.warn("Resend guest result email failed: attempt {} is not a guest attempt", attemptId);
            return false;
        }

        String recipientEmail = emailOverride != null && !emailOverride.isBlank()
                ? emailOverride.trim()
                : guestEmailResolver.resolveGuestEmail(attempt);

        if (recipientEmail == null || recipientEmail.isBlank()) {
            log.warn("Resend guest result email failed: attempt {} has no recipient email", attemptId);
            return false;
        }

        BigDecimal score = attempt.getFinalScore() != null
                ? attempt.getFinalScore()
                : attempt.getObjectiveScore();
        boolean pendingReview = attempt.getFinalScore() == null;

        String submittedAt = attempt.getSubmittedAt() == null
                ? ""
                : SUBMITTED_AT_FORMAT.format(
                LocalDateTime.ofInstant(attempt.getSubmittedAt(), ZoneId.systemDefault()));

        boolean sent = emailService.sendAnonymousExamResult(
                recipientEmail,
                attempt.getStudent().getFullName(),
                attempt.getExam().getTitle(),
                score,
                ExamScoring.effectiveMax(attempt.getMaxScore()),
                submittedAt,
                pendingReview
        );

        log.info("Resend guest result email for attempt {} to {} -> sent={}",
                attemptId, recipientEmail, sent);
        return sent;
    }

    /**
     * Gui mail ket qua chinh thuc cho thi sinh tu do (guest).
     * Called sau khi giao vien cham xong cau tu luan, vi luc submit bai finalScore con null.
     */
    @Transactional(readOnly = true)
    public void sendFinalResultToGuest(Long attemptId) {
        ExamAttempt attempt = attemptRepository.findById(attemptId).orElse(null);
        if (attempt == null || attempt.getFinalScore() == null || attempt.getStudent() == null) {
            log.warn("Skip final guest result email: attempt {} missing or not graded yet", attemptId);
            return;
        }

        if (!Boolean.TRUE.equals(attempt.getStudent().getIsGuest())) {
            return;
        }

        String recipientEmail = guestEmailResolver.resolveGuestEmail(attempt);
        if (recipientEmail == null || recipientEmail.isBlank()) {
            log.warn("Skip final guest result email: attempt {} guest has no email", attemptId);
            return;
        }

        String submittedAt = attempt.getSubmittedAt() == null
                ? ""
                : SUBMITTED_AT_FORMAT.format(
                LocalDateTime.ofInstant(attempt.getSubmittedAt(), ZoneId.systemDefault()));

        try {
            boolean sent = emailService.sendAnonymousExamResult(
                    recipientEmail,
                    attempt.getStudent().getFullName(),
                    attempt.getExam().getTitle(),
                    attempt.getFinalScore(),
                    ExamScoring.effectiveMax(attempt.getMaxScore()),
                    submittedAt,
                    false
            );
            if (sent) {
                log.info("Final guest result email dispatched to {} for examId {} attempt {}",
                        recipientEmail,
                        attempt.getExam() != null ? attempt.getExam().getId() : null,
                        attemptId);
            } else {
                log.error("Final guest result email FAILED for attempt {} (examId {}). "
                                + "Check SMTP config: spring.mail.username / MAIL_APP_PASSWORD (Gmail app password).",
                        attemptId,
                        attempt.getExam() != null ? attempt.getExam().getId() : null);
            }
        } catch (Exception e) {
            log.error("Failed to send final guest result email to {} for attempt {}: {}",
                    recipientEmail, attemptId, e.getMessage());
        }
    }
}