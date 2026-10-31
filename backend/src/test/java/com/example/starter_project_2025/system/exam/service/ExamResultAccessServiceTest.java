package com.example.starter_project_2025.system.exam.service;

import com.example.starter_project_2025.system.exam.domain.Exam;
import com.example.starter_project_2025.system.exam.domain.ExamAttemptStatus;
import com.example.starter_project_2025.system.exam.domain.ExamResultPublication;
import com.example.starter_project_2025.system.exam.domain.ExamResultPublicationRepository;
import com.example.starter_project_2025.system.exam.domain.ResultVisibility;
import com.example.starter_project_2025.system.exam.domain.ScoreReleasePolicy;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDateTime;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ExamResultAccessServiceTest {

    @Mock
    private ExamResultPublicationRepository publicationRepository;

    @InjectMocks
    private ExamResultAccessService service;

    private Exam exam;
    private ExamResultPublication publication;

    @BeforeEach
    void setUp() {
        exam = new Exam();
        exam.setId(1L);
        exam.setShowAnswersAfterExam(true);
        exam.setResultVisibility(ResultVisibility.IMMEDIATE);

        publication = new ExamResultPublication();
        publication.setExam(exam);
        publication.setPublished(true);
        lenient().when(publicationRepository.findByExam_Id(1L)).thenReturn(Optional.of(publication));
    }

    @Test
    void allowsWhenFlagOnPublishedAndNoAttemptsLeft() {
        assertTrue(service.canStudentViewAnswers(exam, ExamAttemptStatus.SUBMITTED, 0));
    }

    @Test
    void deniesWhenFlagIsOff() {
        exam.setShowAnswersAfterExam(false);
        assertFalse(service.canStudentViewAnswers(exam, ExamAttemptStatus.SUBMITTED, 0));
    }

    @Test
    void deniesWhenAttemptNotFinished() {
        assertFalse(service.canStudentViewAnswers(exam, ExamAttemptStatus.IN_PROGRESS, 0));
    }

    @Test
    void deniesWhenScoreNotPublished() {
        publication.setPublished(false);
        assertFalse(service.canStudentViewAnswers(exam, ExamAttemptStatus.SUBMITTED, 0));
    }

    @Test
    void deniesWhenAttemptsRemainAndExamStillOpen() {
        exam.setEndTime(LocalDateTime.now().plusDays(1));
        assertFalse(service.canStudentViewAnswers(exam, ExamAttemptStatus.SUBMITTED, 1));
    }

    @Test
    void deniesWhenAttemptsRemainAndExamHasNoEndTime() {
        assertFalse(service.canStudentViewAnswers(exam, ExamAttemptStatus.SUBMITTED, 1));
    }

    @Test
    void allowsWhenAttemptsRemainButExamClosed() {
        exam.setEndTime(LocalDateTime.now().minusMinutes(1));
        assertTrue(service.canStudentViewAnswers(exam, ExamAttemptStatus.SUBMITTED, 2));
    }

    @Test
    void myScoresDeniesWhenNotPublished() {
        publication.setPublished(false);
        assertFalse(service.canStudentSeeScoreOnMyScores(exam));
    }

    @Test
    void myScoresDeniesWhenNoPublicationConfigured() {
        when(publicationRepository.findByExam_Id(1L)).thenReturn(Optional.empty());
        assertFalse(service.canStudentSeeScoreOnMyScores(exam));
    }

    @Test
    void myScoresDeniesWhenPolicyHidden() {
        publication.setReleasePolicy(ScoreReleasePolicy.HIDDEN);
        assertFalse(service.canStudentSeeScoreOnMyScores(exam));
    }

    @Test
    void myScoresAllowsForBothVisiblePolicies() {
        publication.setReleasePolicy(ScoreReleasePolicy.MY_SCORES_ONLY);
        assertTrue(service.canStudentSeeScoreOnMyScores(exam));

        publication.setReleasePolicy(ScoreReleasePolicy.MY_SCORES_AND_EMAIL);
        assertTrue(service.canStudentSeeScoreOnMyScores(exam));
    }

    @Test
    void myScoresDeniesWhenExamIsNull() {
        assertFalse(service.canStudentSeeScoreOnMyScores(null));
    }

    @Test
    void isResultPublishedOnlyWhenPublishedAndVisible() {
        publication.setPublished(true);
        publication.setReleasePolicy(ScoreReleasePolicy.MY_SCORES_ONLY);
        assertTrue(service.isResultPublished(exam));

        publication.setPublished(false);
        assertFalse(service.isResultPublished(exam));

        publication.setPublished(true);
        publication.setReleasePolicy(ScoreReleasePolicy.HIDDEN);
        assertFalse(service.isResultPublished(exam));
    }

    @Test
    void isResultPublishedDeniesWhenExamIsNull() {
        assertFalse(service.isResultPublished(null));
    }
}
