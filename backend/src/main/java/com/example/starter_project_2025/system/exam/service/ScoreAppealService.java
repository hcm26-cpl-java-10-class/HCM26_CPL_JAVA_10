package com.example.starter_project_2025.system.exam.service;

import com.example.starter_project_2025.exception.BadRequestException;
import com.example.starter_project_2025.exception.ResourceNotFoundException;
import com.example.starter_project_2025.security.UserPrincipal;
import com.example.starter_project_2025.system.exam.domain.ExamAttempt;
import com.example.starter_project_2025.system.exam.domain.ExamAttemptRepository;
import com.example.starter_project_2025.system.exam.domain.ExamResultPublication;
import com.example.starter_project_2025.system.exam.domain.ExamResultPublicationRepository;
import com.example.starter_project_2025.system.exam.domain.ScoreAdjustmentAction;
import com.example.starter_project_2025.system.exam.domain.ScoreAppeal;
import com.example.starter_project_2025.system.exam.domain.ScoreAppealAdjustment;
import com.example.starter_project_2025.system.exam.domain.ScoreAppealAdjustmentRepository;
import com.example.starter_project_2025.system.exam.domain.ScoreAppealRepository;
import com.example.starter_project_2025.system.exam.domain.ScoreAppealStatus;
import com.example.starter_project_2025.system.exam.domain.ScoreReleasePolicy;
import com.example.starter_project_2025.system.exam.dto.ScoreAppealAdjustmentDTO;
import com.example.starter_project_2025.system.exam.dto.ScoreAppealDTO;
import com.example.starter_project_2025.system.exam.dto.ScoreAppealDecision;
import com.example.starter_project_2025.system.notification.service.EmailService;
import com.example.starter_project_2025.system.rbac.user.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

@Service
@RequiredArgsConstructor
public class ScoreAppealService {

    private final ScoreAppealRepository appealRepository;
    private final ScoreAppealAdjustmentRepository adjustmentRepository;
    private final ExamAttemptRepository attemptRepository;
    private final ExamResultPublicationRepository publicationRepository;
    private final UserRepository userRepository;
    private final EmailService emailService;

    @Transactional
    public ScoreAppealDTO createAppeal(Long studentId, Long attemptId, String reason, BigDecimal requestedScore) {
        if (reason == null || reason.isBlank()) {
            throw new BadRequestException("Appeal reason is required");
        }
        ExamAttempt attempt = attemptRepository.findByIdAndStudent_Id(attemptId, studentId)
                .orElseThrow(() -> new ResourceNotFoundException("Exam attempt not found"));
        if (attempt.getFinalScore() == null) {
            throw new BadRequestException("Only graded attempts can be appealed");
        }
        if (attempt.getExam() == null || attempt.getExam().getId() == null) {
            throw new BadRequestException("Exam attempt has no linked exam");
        }
        ExamResultPublication publication = publicationRepository.findByExam_Id(attempt.getExam().getId())
                .orElse(null);
        if (publication == null || !publication.isPublished()
                || publication.getReleasePolicy() == null
                || publication.getReleasePolicy() == ScoreReleasePolicy.HIDDEN) {
            throw new BadRequestException(buildNotPublishedMessage(attempt, publication));
        }
        if (appealRepository.existsByAttempt_Id(attemptId)) {
            throw new BadRequestException("An appeal already exists for this attempt");
        }

        ScoreAppeal appeal = ScoreAppeal.builder()
                .attempt(attempt)
                .exam(attempt.getExam())
                .student(attempt.getStudent())
                .reason(reason.trim())
                .requestedScore(requestedScore)
                .status(ScoreAppealStatus.PENDING)
                .oldScore(attempt.getFinalScore())
                .adjustmentApplied(false)
                .build();
        return toDTO(appealRepository.save(appeal));
    }

    private String buildNotPublishedMessage(ExamAttempt attempt, ExamResultPublication publication) {
        String examTitle = attempt.getExam() != null ? attempt.getExam().getTitle() : "this exam";

        if (publication == null) {
            return "Scores for \"" + examTitle + "\" have not been published yet. "
                    + "Your teacher must publish the results (Result Statistics -> Publish Results) "
                    + "before you can appeal.";
        }

        if (publication.getReleasePolicy() == ScoreReleasePolicy.HIDDEN) {
            return "Scores for \"" + examTitle + "\" are hidden by your teacher. "
                    + "Appeal is not available while the release policy is HIDDEN.";
        }

        return "Scores for \"" + examTitle + "\" have not been published yet. "
                + "Your teacher must publish the results (Result Statistics -> Publish Results) "
                + "before you can appeal.";
    }

    @Transactional(readOnly = true)
    public List<ScoreAppealDTO> listMyAppeals(Long studentId) {
        return appealRepository.findByStudent_IdOrderByCreatedAtDesc(studentId).stream()
                .map(this::toDTO)
                .toList();
    }

    @Transactional(readOnly = true)
    public List<ScoreAppealDTO> listByExam(Long examId) {
        return appealRepository.findByExam_IdOrderByCreatedAtDesc(examId).stream()
                .map(this::toDTO)
                .toList();
    }

    @Transactional(readOnly = true)
    public List<ScoreAppealDTO> listPending() {
        return appealRepository.findByStatusOrderByCreatedAtAsc(ScoreAppealStatus.PENDING).stream()
                .map(this::toDTO)
                .toList();
    }

    @Transactional(readOnly = true)
    public ScoreAppealDTO getById(Long appealId, UserPrincipal principal) {
        ScoreAppeal appeal = appealRepository.findById(appealId)
                .orElseThrow(() -> new ResourceNotFoundException("Score appeal not found"));
        boolean isReviewer = principal.getAuthorities().stream()
                .anyMatch(a -> "SCORE_APPEAL_REVIEW".equals(a.getAuthority()));
        if (!isReviewer && !appeal.getStudent().getId().equals(principal.getUser().getId())) {
            throw new BadRequestException("You are not allowed to view this appeal");
        }
        return toDTO(appeal);
    }

    @Transactional
    public ScoreAppealDTO review(Long appealId, ScoreAppealDecision decision,
                                 BigDecimal newScore, String resolutionNote, UserPrincipal principal) {
        ScoreAppeal appeal = appealRepository.findById(appealId)
                .orElseThrow(() -> new ResourceNotFoundException("Score appeal not found"));
        if (appeal.getStatus() != ScoreAppealStatus.PENDING) {
            throw new BadRequestException("Only pending appeals can be reviewed");
        }
        if (decision == null) {
            throw new BadRequestException("Review decision is required");
        }

        Long reviewerId = principal.getUser().getId();
        String reviewerName = principal.getUser().getFullName();
        LocalDateTime now = LocalDateTime.now();

        if (decision == ScoreAppealDecision.REJECT) {
            if (resolutionNote == null || resolutionNote.isBlank()) {
                throw new BadRequestException("A resolution note is required when rejecting an appeal");
            }
            appeal.setStatus(ScoreAppealStatus.REJECTED);
            appeal.setOldScore(appeal.getAttempt().getFinalScore());
            appeal.setNewScore(null);
            appeal.setReviewerId(reviewerId);
            appeal.setReviewedAt(now);
            appeal.setResolutionNote(resolutionNote.trim());
            appeal.setAdjustmentApplied(false);
            ScoreAppeal saved = appealRepository.save(appeal);
            emailService.sendScoreAppealRejected(
                    saved.getStudent().getEmail(),
                    saved.getStudent().getFullName(),
                    saved.getExam().getTitle(),
                    saved.getResolutionNote());
            return toDTO(saved);
        }

        // APPROVE path
        ExamAttempt attempt = attemptRepository.lockById(appeal.getAttempt().getId())
                .orElseThrow(() -> new ResourceNotFoundException("Exam attempt not found"));
        BigDecimal oldScore = attempt.getFinalScore();
        BigDecimal resolvedNewScore = null;
        boolean adjusted = false;

        if (newScore != null) {
            BigDecimal max = ExamScoring.effectiveMax(
                    attempt.getMaxScore() != null ? attempt.getMaxScore() : attempt.getExam().getMaxScore());
            if (newScore.signum() < 0 || newScore.compareTo(max) > 0) {
                throw new BadRequestException(
                        "New score must be between 0 and " + max.stripTrailingZeros().toPlainString());
            }
            resolvedNewScore = ExamScoring.clamp(newScore, max);
            if (oldScore == null || resolvedNewScore.compareTo(oldScore) != 0) {
                attempt.setFinalScore(resolvedNewScore);
                attemptRepository.save(attempt);
                adjusted = true;
            }
        }

        ScoreAppealAdjustment adjustment = ScoreAppealAdjustment.builder()
                .appeal(appeal)
                .attempt(attempt)
                .oldScore(oldScore)
                .newScore(adjusted ? resolvedNewScore : oldScore)
                .reason(resolutionNote != null && !resolutionNote.isBlank()
                        ? resolutionNote.trim()
                        : appeal.getReason())
                .actorId(reviewerId)
                .actorName(reviewerName)
                .action(adjusted ? ScoreAdjustmentAction.SCORE_ADJUSTED
                        : ScoreAdjustmentAction.APPEAL_APPROVED_NO_CHANGE)
                .build();
        adjustmentRepository.save(adjustment);

        appeal.setStatus(ScoreAppealStatus.APPROVED);
        appeal.setOldScore(oldScore);
        appeal.setNewScore(adjusted ? resolvedNewScore : null);
        appeal.setReviewerId(reviewerId);
        appeal.setReviewedAt(now);
        appeal.setResolutionNote(resolutionNote != null ? resolutionNote.trim() : null);
        appeal.setAdjustmentApplied(adjusted);
        ScoreAppeal saved = appealRepository.save(appeal);

        emailService.sendScoreAppealApproved(
                saved.getStudent().getEmail(),
                saved.getStudent().getFullName(),
                saved.getExam().getTitle(),
                saved.getOldScore(),
                saved.getNewScore(),
                saved.getResolutionNote());
        return toDTO(saved);
    }

    @Transactional(readOnly = true)
    public List<ScoreAppealAdjustmentDTO> getHistory(Long attemptId) {
        return adjustmentRepository.findByAttempt_IdOrderByCreatedAtAsc(attemptId).stream()
                .map(a -> new ScoreAppealAdjustmentDTO(
                        a.getId(),
                        a.getAppeal() != null ? a.getAppeal().getId() : null,
                        a.getAttempt() != null ? a.getAttempt().getId() : null,
                        a.getOldScore(),
                        a.getNewScore(),
                        a.getReason(),
                        a.getActorId(),
                        a.getActorName(),
                        a.getAction(),
                        a.getCreatedAt()))
                .toList();
    }

    private ScoreAppealDTO toDTO(ScoreAppeal appeal) {
        String reviewerName = null;
        if (appeal.getReviewerId() != null) {
            reviewerName = userRepository.findById(appeal.getReviewerId())
                    .map(u -> u.getFullName())
                    .orElse(null);
        }
        return new ScoreAppealDTO(
                appeal.getId(),
                appeal.getExam() != null ? appeal.getExam().getId() : null,
                appeal.getExam() != null ? appeal.getExam().getTitle() : null,
                appeal.getAttempt() != null ? appeal.getAttempt().getId() : null,
                appeal.getAttempt() != null ? appeal.getAttempt().getAttemptNumber() : 0,
                appeal.getStudent() != null ? appeal.getStudent().getId() : null,
                appeal.getStudent() != null ? appeal.getStudent().getFullName() : null,
                appeal.getReason(),
                appeal.getRequestedScore(),
                appeal.getStatus(),
                appeal.getOldScore(),
                appeal.getNewScore(),
                appeal.getReviewerId(),
                reviewerName,
                appeal.getReviewedAt(),
                appeal.getResolutionNote(),
                appeal.isAdjustmentApplied(),
                appeal.getCreatedAt());
    }
}
