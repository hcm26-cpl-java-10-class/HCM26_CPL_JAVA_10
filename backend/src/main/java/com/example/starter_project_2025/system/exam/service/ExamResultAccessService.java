package com.example.starter_project_2025.system.exam.service;

import com.example.starter_project_2025.system.exam.domain.Exam;
import com.example.starter_project_2025.system.exam.domain.ExamAttemptStatus;
import com.example.starter_project_2025.system.exam.domain.ExamResultPublication;
import com.example.starter_project_2025.system.exam.domain.ExamResultPublicationRepository;
import com.example.starter_project_2025.system.exam.domain.ResultVisibility;
import com.example.starter_project_2025.system.exam.domain.ScoreReleasePolicy;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.LocalDateTime;

@Service
@RequiredArgsConstructor
public class ExamResultAccessService {

    private final ExamResultPublicationRepository publicationRepository;

    @Transactional(readOnly = true)
    public boolean canStudentViewScore(Exam exam) {
        if (exam == null || exam.getId() == null) {
            return false;
        }

        ExamResultPublication publication = publicationRepository
                .findByExam_Id(exam.getId())
                .orElse(null);

        if (publication == null || !publication.isPublished()) {
            return false;
        }

        ScoreReleasePolicy policy = publication.getReleasePolicy();

        if (policy == null || policy == ScoreReleasePolicy.HIDDEN) {
            return false;
        }

        return isVisibilitySatisfied(exam);
    }

    @Transactional(readOnly = true)
    public boolean canStudentViewAnswers(Exam exam, ExamAttemptStatus attemptStatus, int attemptsRemaining) {
        if (exam == null || !Boolean.TRUE.equals(exam.getShowAnswersAfterExam())) {
            return false;
        }
        if (attemptStatus == null
                || attemptStatus == ExamAttemptStatus.NOT_STARTED
                || attemptStatus == ExamAttemptStatus.IN_PROGRESS) {
            return false;
        }
        if (!canStudentViewScore(exam)) {
            return false;
        }
        boolean examClosed = exam.getEndTime() != null && !LocalDateTime.now().isBefore(exam.getEndTime());
        return attemptsRemaining <= 0 || examClosed;
    }

    @Transactional(readOnly = true)
    public boolean shouldEmailScore(Exam exam) {
        if (!canStudentViewScore(exam)) {
            return false;
        }

        return publicationRepository.findByExam_Id(exam.getId())
                .map(publication ->
                        publication.getReleasePolicy()
                                == ScoreReleasePolicy.MY_SCORES_AND_EMAIL)
                .orElse(false);
    }

    @Transactional(readOnly = true)
    public boolean canStudentSeeScoreOnMyScores(Exam exam) {
        if (exam == null || exam.getId() == null) {
            return false;
        }

        return publicationRepository.findByExam_Id(exam.getId())
                .map(publication ->
                        publication.getReleasePolicy() != ScoreReleasePolicy.HIDDEN)
                .orElse(true);
    }

    /**
     * Diem chi duoc appeal khi giao vien da cong bo ket qua (published + policy khong HIDDEN).
     * Dung chung cho frontend de disable nut Appeal truoc khi submit va nhin 400.
     */
    @Transactional(readOnly = true)
    public boolean isScorePublished(Exam exam) {
        if (exam == null || exam.getId() == null) {
            return false;
        }

        return publicationRepository.findByExam_Id(exam.getId())
                .map(publication ->
                        publication.isPublished()
                                && publication.getReleasePolicy() != null
                                && publication.getReleasePolicy() != ScoreReleasePolicy.HIDDEN)
                .orElse(false);
    }

    private boolean isVisibilitySatisfied(Exam exam) {
        ResultVisibility visibility = exam.getResultVisibility();

        if (visibility == null) {
            return false;
        }

        return switch (visibility) {
            case IMMEDIATE -> true;

            case AFTER_EXAM_CLOSED ->
                    exam.getEndTime() != null
                            && !LocalDateTime.now()
                            .isBefore(exam.getEndTime());

            case MANUAL_RELEASE -> true;
        };
    }
}
