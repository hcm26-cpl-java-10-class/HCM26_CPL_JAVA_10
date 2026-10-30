package com.example.starter_project_2025.system.exam.service;

import java.math.BigDecimal;
import com.example.starter_project_2025.exception.BadRequestException;
import com.example.starter_project_2025.exception.ResourceNotFoundException;
import com.example.starter_project_2025.system.exam.domain.AnonymousSession;
import com.example.starter_project_2025.system.exam.domain.AnonymousSessionRepository;
import com.example.starter_project_2025.system.exam.domain.ExamAttempt;
import com.example.starter_project_2025.system.exam.domain.ExamAttemptRepository;
import com.example.starter_project_2025.system.exam.domain.ExamAttemptStatus;
import com.example.starter_project_2025.system.exam.dto.CodeRunRequest;
import com.example.starter_project_2025.system.exam.dto.CodeRunResponse;
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
    private final ExamCodeService examCodeService;

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

    @Transactional(readOnly = true)
    public CodeRunResponse runCode(String sessionToken, Long attemptId, CodeRunRequest request) {
        AnonymousSession session = requireSession(sessionToken);
        assertAttemptBelongsToSession(session, attemptId);
        return examCodeService.run(attemptId, session.getGuestUserId(), request);
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
            return;
        }

        boolean finished = attempt.getStatus() == ExamAttemptStatus.SUBMITTED
                || attempt.getStatus() == ExamAttemptStatus.PENDING_REVIEW
                || attempt.getStatus() == ExamAttemptStatus.EXPIRED;

        if (!finished) {
            return;
        }

        if (session.getCompletedAt() != null) {
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
            emailService.sendAnonymousExamResult(
                    session.getGuestEmail(),
                    session.getGuestName(),
                    attempt.getExam().getTitle(),
                    score,
                    ExamScoring.effectiveMax(attempt.getMaxScore()),
                    submittedAt,
                    pendingReview
            );
        } catch (Exception e) {
            log.error("Failed to send anonymous exam result email for session {}: {}",
                    session.getId(), e.getMessage());
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

    @Transactional(readOnly = true)
    public void sendFinalResultToGuest(Long attemptId) {
        ExamAttempt attempt = attemptRepository.findById(attemptId).orElse(null);
        if (attempt == null || attempt.getFinalScore() == null || attempt.getStudent() == null) {
            return;
        }

        if (!Boolean.TRUE.equals(attempt.getStudent().getIsGuest())) {
            return;
        }

        String submittedAt = attempt.getSubmittedAt() == null
                ? ""
                : SUBMITTED_AT_FORMAT.format(
                LocalDateTime.ofInstant(attempt.getSubmittedAt(), ZoneId.systemDefault()));

        emailService.sendAnonymousExamResult(
                attempt.getStudent().getEmail(),
                attempt.getStudent().getFullName(),
                attempt.getExam().getTitle(),
                attempt.getFinalScore(),
                ExamScoring.effectiveMax(attempt.getMaxScore()),
                submittedAt,
                false
        );
    }
}