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
        if (exam == null) {
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
        // De thi "Manually released by teacher": giao vien tu cham va cong bo,
        // nen sau khi cong bo hoc sinh xem duoc diem + cau dung/sai.
        if (isManualRelease(exam.getResultVisibility())) {
            return true;
        }
        if (!Boolean.TRUE.equals(exam.getShowAnswersAfterExam())) {
            return false;
        }
        return attemptsRemaining <= 0;
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

    /**
     * Ket qua chi duoc hien thi tren "My Scores" khi giao vien da cong bo (Publish Results).
     * Truoc do hoc sinh chi thay trang thai "cho cong bo", khong thay diem.
     */
    @Transactional(readOnly = true)
    public boolean canStudentSeeScoreOnMyScores(Exam exam) {
        if (exam == null || exam.getId() == null) {
            return false;
        }

        return publicationRepository.findByExam_Id(exam.getId())
                .map(publication ->
                        publication.isPublished()
                                && publication.getReleasePolicy() != ScoreReleasePolicy.HIDDEN)
                .orElse(false);
    }

    /**
     * Diem co duoc goc cong bo cho hoc sinh xem chua.
     * Dung cho API tra diem cua attempt (submit / my-attempts) de an diem chua cong bo.
     */
    @Transactional(readOnly = true)
    public boolean isResultPublished(Exam exam) {
        if (exam == null || exam.getId() == null) {
            return false;
        }

        return publicationRepository.findByExam_Id(exam.getId())
                .map(publication ->
                        publication.isPublished()
                                && publication.getReleasePolicy() != ScoreReleasePolicy.HIDDEN)
                .orElse(false);
    }

    /**
     * Hoc sinh duoc xem bai lam cua chinh minh ngay sau khi nop (chi cau da lam),
     * du chua cong bo ket qua. Chi ap dung khi teacher chon "Manually released".
     */
    @Transactional(readOnly = true)
    public boolean canStudentViewOwnSubmission(Exam exam, ExamAttemptStatus attemptStatus) {
        if (exam == null || exam.getId() == null) {
            return false;
        }
        if (attemptStatus == null
                || attemptStatus == ExamAttemptStatus.NOT_STARTED
                || attemptStatus == ExamAttemptStatus.IN_PROGRESS) {
            return false;
        }
        // De thi teacher tu cham va cong bo sau: cho xem bai lam ngay khi nop.
        if (exam.getResultVisibility() == ResultVisibility.MANUAL_RELEASE) {
            return true;
        }
        // Cac che do khac: van dung quy tac cua "Show Answers After Exam".
        return Boolean.TRUE.equals(exam.getShowAnswersAfterExam());
    }

    private boolean isVisibilitySatisfied(Exam exam) {
        ResultVisibility visibility = exam.getResultVisibility();

        if (visibility == null) {
            return false;
        }

        return switch (visibility) {
            case IMMEDIATE -> true;

            // AFTER_EXAM_CLOSED la gia tri cu (khong con gio dong de): coi nhu MANUAL_RELEASE.
            case AFTER_EXAM_CLOSED, MANUAL_RELEASE -> true;
        };
    }

    /** MANUAL_RELEASE, kem gia tri cu AFTER_EXAM_CLOSED (khong con gio dong de) duoc coi nhu MANUAL_RELEASE. */
    private static boolean isManualRelease(ResultVisibility visibility) {
        return visibility == ResultVisibility.MANUAL_RELEASE || visibility == ResultVisibility.AFTER_EXAM_CLOSED;
    }
}
