package com.example.starter_project_2025.system.exam.service;

import com.example.starter_project_2025.exception.BadRequestException;
import com.example.starter_project_2025.system.exam.domain.*;
import com.example.starter_project_2025.system.exam.dto.EssayGradingDTO;
import com.example.starter_project_2025.system.exam.service.ai.AiEssayGradingClient;
import com.example.starter_project_2025.system.exam.service.ai.AiGradingProperties;
import com.example.starter_project_2025.system.question.domain.QuestionType;
import com.example.starter_project_2025.system.rbac.user.User;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ExamEssayGradingServiceTest {

    @Mock
    private ExamRepository examRepository;

    @Mock
    private ExamAttemptRepository attemptRepository;

    @Mock
    private AiEssayGradingClient aiClient;

    @InjectMocks
    private ExamEssayGradingService gradingService;

    private Exam exam;
    private ExamAttempt attempt;
    private ExamAttemptQuestion essayQuestion;
    private ExamAttemptAnswer essayAnswer;

    @BeforeEach
    void setUp() {
        exam = new Exam();
        exam.setId(10L);
        exam.setTitle("Midterm Java Exam");

        attempt = new ExamAttempt();
        attempt.setId(100L);
        attempt.setExam(exam);
        attempt.setStatus(ExamAttemptStatus.PENDING_REVIEW);
        attempt.setObjectiveScore(new BigDecimal(20));
        attempt.setTotalPoints(30);
        // thang điểm 30 = tổng tỉ lệ điểm, nên câu tự luận (tỉ lệ 10) được tối đa 10 điểm
        attempt.setMaxScore(new BigDecimal(30));
        attempt.setStartedAt(Instant.now().minusSeconds(3600));
        attempt.setSubmittedAt(Instant.now().minusSeconds(100));

        User student = new User();
        student.setId(5L);
        student.setFirstName("Alice");
        student.setLastName("Smith");
        student.setEmail("alice@example.com");
        attempt.setStudent(student);

        essayQuestion = new ExamAttemptQuestion();
        essayQuestion.setId(1L);
        essayQuestion.setSourceQuestionId(101L);
        essayQuestion.setContent("Explain Polymorphism in Java.");
        essayQuestion.setType(QuestionType.ESSAY);
        essayQuestion.setPoints(10);
        essayQuestion.setDisplayOrder(1);
        essayQuestion.setAttempt(attempt);

        essayAnswer = new ExamAttemptAnswer();
        essayAnswer.setId(50L);
        essayAnswer.setAttempt(attempt);
        essayAnswer.setQuestion(essayQuestion);
        essayAnswer.setTextAnswer("Polymorphism allows objects to take multiple forms...");

        attempt.setQuestions(List.of(essayQuestion));
        attempt.setAnswers(new HashSet<>(Set.of(essayAnswer)));
    }

    @Test
    void submitOfficialGradeSuccessfullyUpdatesScoreAndStatus() {
        when(examRepository.findById(10L)).thenReturn(Optional.of(exam));
        when(attemptRepository.findById(100L)).thenReturn(Optional.of(attempt));
        when(attemptRepository.save(any(ExamAttempt.class))).thenReturn(attempt);

        EssayGradingDTO.QuestionGrade grade = new EssayGradingDTO.QuestionGrade();
        grade.setQuestionId(101L);
        grade.setScore(new BigDecimal(8));
        grade.setFeedback("Clear explanation of runtime polymorphism.");

        EssayGradingDTO.GradeSubmissionRequest request = new EssayGradingDTO.GradeSubmissionRequest();
        request.setGrades(List.of(grade));

        EssayGradingDTO.Detail result = gradingService.submitOfficialGrade(10L, 100L, request);

        assertNotNull(result);
        assertScore("8", essayAnswer.getScore());
        assertEquals("Clear explanation of runtime polymorphism.", essayAnswer.getFeedback());
        assertEquals(ExamAttemptStatus.SUBMITTED, attempt.getStatus());
        assertScore("28", attempt.getFinalScore()); // 20 objective + 8 essay
        verify(attemptRepository).save(attempt);
    }

    @Test
    void submitOfficialGradeRejectsScoreExceedingMaxPoints() {
        when(examRepository.findById(10L)).thenReturn(Optional.of(exam));
        when(attemptRepository.findById(100L)).thenReturn(Optional.of(attempt));

        EssayGradingDTO.QuestionGrade grade = new EssayGradingDTO.QuestionGrade();
        grade.setQuestionId(101L);
        grade.setScore(new BigDecimal(15)); // max is 10
        grade.setFeedback("Too high");

        EssayGradingDTO.GradeSubmissionRequest request = new EssayGradingDTO.GradeSubmissionRequest();
        request.setGrades(List.of(grade));

        BadRequestException ex = assertThrows(
                BadRequestException.class,
                () -> gradingService.submitOfficialGrade(10L, 100L, request)
        );

        assertTrue(ex.getMessage().contains("exceeds maximum points"));
        verify(attemptRepository, never()).save(any());
    }

    @Test
    void submitOfficialGradeRejectsNegativeScore() {
        when(examRepository.findById(10L)).thenReturn(Optional.of(exam));
        when(attemptRepository.findById(100L)).thenReturn(Optional.of(attempt));

        EssayGradingDTO.QuestionGrade grade = new EssayGradingDTO.QuestionGrade();
        grade.setQuestionId(101L);
        grade.setScore(new BigDecimal(-1));

        EssayGradingDTO.GradeSubmissionRequest request = new EssayGradingDTO.GradeSubmissionRequest();
        request.setGrades(List.of(grade));

        BadRequestException ex = assertThrows(
                BadRequestException.class,
                () -> gradingService.submitOfficialGrade(10L, 100L, request)
        );

        assertTrue(ex.getMessage().contains("Score cannot be negative"));
        verify(attemptRepository, never()).save(any());
    }

    @Test
    void submitOfficialGradeRejectsSilentOverwriteWhenAlreadyGraded() {
        attempt.setFinalScore(new BigDecimal(25));
        attempt.setStatus(ExamAttemptStatus.SUBMITTED);

        when(examRepository.findById(10L)).thenReturn(Optional.of(exam));
        when(attemptRepository.findById(100L)).thenReturn(Optional.of(attempt));

        EssayGradingDTO.QuestionGrade grade = new EssayGradingDTO.QuestionGrade();
        grade.setQuestionId(101L);
        grade.setScore(new BigDecimal(7));

        EssayGradingDTO.GradeSubmissionRequest request = new EssayGradingDTO.GradeSubmissionRequest();
        request.setGrades(List.of(grade));
        request.setConfirmOverwrite(false); // not confirmed

        BadRequestException ex = assertThrows(
                BadRequestException.class,
                () -> gradingService.submitOfficialGrade(10L, 100L, request)
        );

        assertTrue(ex.getMessage().contains("Explicit confirmation is required to overwrite official grade"));
        verify(attemptRepository, never()).save(any());
    }

    @Test
    void submitOfficialGradeAllowsOverwriteWhenConfirmed() {
        attempt.setFinalScore(new BigDecimal(25));
        attempt.setStatus(ExamAttemptStatus.SUBMITTED);

        when(examRepository.findById(10L)).thenReturn(Optional.of(exam));
        when(attemptRepository.findById(100L)).thenReturn(Optional.of(attempt));
        when(attemptRepository.save(any(ExamAttempt.class))).thenReturn(attempt);

        EssayGradingDTO.QuestionGrade grade = new EssayGradingDTO.QuestionGrade();
        grade.setQuestionId(101L);
        grade.setScore(new BigDecimal(9));
        grade.setFeedback("Regraded with full credit on design patterns.");

        EssayGradingDTO.GradeSubmissionRequest request = new EssayGradingDTO.GradeSubmissionRequest();
        request.setGrades(List.of(grade));
        request.setConfirmOverwrite(true);

        EssayGradingDTO.Detail result = gradingService.submitOfficialGrade(10L, 100L, request);

        assertNotNull(result);
        assertScore("29", attempt.getFinalScore());
        verify(attemptRepository).save(attempt);
    }

    @Test
    void aiGradingClientFailsFastWhenNoApiKeyConfigured() {
        AiGradingProperties props = new AiGradingProperties();
        props.setEnabled(false);
        props.setApiKey(null);

        AiEssayGradingClient realAiClient = new AiEssayGradingClient(props, new ObjectMapper());

        BadRequestException ex = assertThrows(
                BadRequestException.class,
                () -> realAiClient.requestProposal(List.of(new AiEssayGradingClient.EssayQuestionPayload(
                        101L, 1, "Explain OOP", BigDecimal.TEN, "OOP is..."
                )))
        );

        assertTrue(ex.getMessage().contains("AI grading provider is not configured"));
        assertTrue(ex.getMessage().contains("app.ai.api-key"));
    }

    private static void assertScore(String expected, BigDecimal actual) {
        assertNotNull(actual);
        assertEquals(0, new BigDecimal(expected).compareTo(actual), "expected " + expected + " but was " + actual);
    }
}
