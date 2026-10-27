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
import org.mockito.ArgumentCaptor;
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
        essayQuestion.setContent("Explain Polymorphism in Java with examples.");
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
        assertScore("28", attempt.getFinalScore());
        verify(attemptRepository).save(attempt);
    }

    @Test
    void submitOfficialGradeRejectsScoreExceedingMaxPoints() {
        when(examRepository.findById(10L)).thenReturn(Optional.of(exam));
        when(attemptRepository.findById(100L)).thenReturn(Optional.of(attempt));

        EssayGradingDTO.QuestionGrade grade = new EssayGradingDTO.QuestionGrade();
        grade.setQuestionId(101L);
        grade.setScore(new BigDecimal(15));
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
        request.setConfirmOverwrite(false);

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
    void requestAiGradingPassesCustomRubricAndReferenceAnswerToAiClient() {
        when(examRepository.findById(10L)).thenReturn(Optional.of(exam));
        when(attemptRepository.findById(100L)).thenReturn(Optional.of(attempt));

        EssayGradingDTO.AiGradingRequest req = new EssayGradingDTO.AiGradingRequest();
        EssayGradingDTO.QuestionContext ctx = new EssayGradingDTO.QuestionContext();
        ctx.setReferenceAnswer("Polymorphism is the ability of an object to take on many forms...");
        ctx.setRubric("Definition: 4 pts; Code Example: 4 pts; Clarity: 2 pts");
        req.setQuestions(Map.of(101L, ctx));

        EssayGradingDTO.AiGradingResponse mockResponse = new EssayGradingDTO.AiGradingResponse();
        mockResponse.setModel("gemini-3.5-flash-lite");
        EssayGradingDTO.AiQuestionProposal prop = new EssayGradingDTO.AiQuestionProposal();
        prop.setQuestionId(101L);
        prop.setProposedScore(BigDecimal.valueOf(9));
        prop.setFeedback("Good answer.");
        mockResponse.setProposals(List.of(prop));

        @SuppressWarnings("unchecked")
        ArgumentCaptor<List<AiEssayGradingClient.EssayQuestionPayload>> captor = ArgumentCaptor.forClass(List.class);
        when(aiClient.requestProposal(captor.capture())).thenReturn(mockResponse);

        EssayGradingDTO.AiGradingResponse result = gradingService.requestAiGrading(10L, 100L, req);

        assertNotNull(result);
        assertEquals("gemini-3.5-flash-lite", result.getModel());
        assertEquals(1, result.getProposals().size());

        List<AiEssayGradingClient.EssayQuestionPayload> captured = captor.getValue();
        assertEquals(1, captured.size());
        assertEquals("Polymorphism is the ability of an object to take on many forms...", captured.get(0).referenceAnswer());
        assertEquals("Definition: 4 pts; Code Example: 4 pts; Clarity: 2 pts", captured.get(0).rubric());
    }

    @Test
    void requestAiGradingWithoutContextLeavesRubricAndReferenceNull() {
        when(examRepository.findById(10L)).thenReturn(Optional.of(exam));
        when(attemptRepository.findById(100L)).thenReturn(Optional.of(attempt));

        EssayGradingDTO.AiGradingResponse mockResponse = new EssayGradingDTO.AiGradingResponse();
        mockResponse.setModel("gemini-3.5-flash-lite");
        mockResponse.setProposals(List.of());

        @SuppressWarnings("unchecked")
        ArgumentCaptor<List<AiEssayGradingClient.EssayQuestionPayload>> captor = ArgumentCaptor.forClass(List.class);
        when(aiClient.requestProposal(captor.capture())).thenReturn(mockResponse);

        EssayGradingDTO.AiGradingResponse result = gradingService.requestAiGrading(10L, 100L, null);

        assertNotNull(result);
        List<AiEssayGradingClient.EssayQuestionPayload> captured = captor.getValue();
        assertEquals(1, captured.size());
        assertNull(captured.get(0).referenceAnswer(), "Must not invent reference answer when none provided");
        assertNull(captured.get(0).rubric(), "Must not invent rubric when none provided");
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

        assertTrue(ex.getMessage().contains("Google Gemini API key is not configured"));
        assertTrue(ex.getMessage().contains("GEMINI_API_KEY"));
    }

    @Test
    void aiGradingClientParsesGeminiNativeResponseWithRubricAndStepAnalysis() throws Exception {
        AiGradingProperties props = new AiGradingProperties();
        props.setEnabled(true);
        props.setApiKey("test-dummy-key");
        props.setModel("gemini-3.5-flash-lite");
        props.setEndpoint("https://generativelanguage.googleapis.com/v1beta/models");

        ObjectMapper mapper = new ObjectMapper();
        AiEssayGradingClient realAiClient = new AiEssayGradingClient(props, mapper);

        String geminiJson = """
        {
          "candidates": [
            {
              "content": {
                "parts": [
                  {
                    "text": "{\\"proposals\\": [{\\"questionId\\": 101, \\"proposedScore\\": 9, \\"analysis\\": \\"Student explains runtime polymorphism using method overriding and dynamic method dispatch accurately. Demonstrates correct interface implementation.\\", \\"reasoning\\": \\"Comprehensive answer with working code illustration.\\", \\"feedback\\": \\"Well done. Consider mentioning covariance for bonus depth.\\", \\"criterionScores\\": [{\\"criterion\\": \\"Conceptual explanation\\", \\"maxPoints\\": 5, \\"awardedPoints\\": 5, \\"comment\\": \\"Full points for clear concepts\\"}, {\\"criterion\\": \\"Code syntax & examples\\", \\"maxPoints\\": 5, \\"awardedPoints\\": 4, \\"comment\\": \\"Minor indentation defect\\"}], \\"flagAmbiguous\\": false}]}"
                  }
                ]
              }
            }
          ]
        }
        """;

        List<AiEssayGradingClient.EssayQuestionPayload> payloads = List.of(
                new AiEssayGradingClient.EssayQuestionPayload(101L, 1, "Explain Polymorphism", BigDecimal.valueOf(10), "Student answer text")
        );

        EssayGradingDTO.AiGradingResponse response = realAiClient.parseAiResponse(geminiJson, payloads, true);

        assertNotNull(response);
        assertEquals(1, response.getProposals().size());

        EssayGradingDTO.AiQuestionProposal p = response.getProposals().get(0);
        assertEquals(101L, p.getQuestionId());
        assertScore("9", p.getProposedScore());
        assertTrue(p.getAnalysis().contains("runtime polymorphism"));
        assertTrue(p.getFeedback().contains("Well done"));
        assertFalse(Boolean.TRUE.equals(p.getFlagAmbiguous()));
        assertNull(p.getFlagReason());

        assertNotNull(p.getCriterionScores());
        assertEquals(2, p.getCriterionScores().size());
        assertEquals("Conceptual explanation", p.getCriterionScores().get(0).getCriterion());
        assertEquals(5, p.getCriterionScores().get(0).getAwardedPoints());
        assertEquals(5, p.getCriterionScores().get(0).getMaxPoints());
        assertEquals(4, p.getCriterionScores().get(1).getAwardedPoints());
    }

    @Test
    void aiGradingClientParsesMathAlternativeSolutionAndFlagsAmbiguity() throws Exception {
        AiGradingProperties props = new AiGradingProperties();
        props.setEnabled(true);
        props.setApiKey("test-dummy-key");
        props.setModel("gemini-3.5-flash-lite");

        ObjectMapper mapper = new ObjectMapper();
        AiEssayGradingClient realAiClient = new AiEssayGradingClient(props, mapper);

        String geminiJson = """
        {
          "candidates": [
            {
              "content": {
                "parts": [
                  {
                    "text": "```json\\n{\\"proposals\\": [{\\"questionId\\": 101, \\"proposedScore\\": 8, \\"analysis\\": \\"Student solved the quadratic optimization using coordinate geometry instead of calculus derivative. Approach is mathematically sound.\\", \\"reasoning\\": \\"Alternative valid mathematical method identified.\\", \\"feedback\\": \\"Creative alternative solution; valid end result obtained.\\", \\"flagAmbiguous\\": true, \\"flagReason\\": \\"Alternative non-standard method used. Teacher verification recommended.\\"}]}\\n```"
                  }
                ]
              }
            }
          ]
        }
        """;

        List<AiEssayGradingClient.EssayQuestionPayload> payloads = List.of(
                new AiEssayGradingClient.EssayQuestionPayload(101L, 1, "Solve optimization", BigDecimal.valueOf(10), "My alternative method")
        );

        EssayGradingDTO.AiGradingResponse response = realAiClient.parseAiResponse(geminiJson, payloads, true);

        assertNotNull(response);
        assertEquals(1, response.getProposals().size());

        EssayGradingDTO.AiQuestionProposal p = response.getProposals().get(0);
        assertEquals(101L, p.getQuestionId());
        assertScore("8", p.getProposedScore());
        assertTrue(Boolean.TRUE.equals(p.getFlagAmbiguous()), "Must preserve flagAmbiguous flag");
        assertEquals("Alternative non-standard method used. Teacher verification recommended.", p.getFlagReason());
        assertTrue(p.getAnalysis().contains("coordinate geometry instead of calculus"));
    }

    @Test
    void aiGradingClientClampsOutOfRangeScores() throws Exception {
        AiGradingProperties props = new AiGradingProperties();
        props.setEnabled(true);
        props.setApiKey("test-dummy-key");

        ObjectMapper mapper = new ObjectMapper();
        AiEssayGradingClient realAiClient = new AiEssayGradingClient(props, mapper);

        String geminiJson = """
        {
          "candidates": [
            {
              "content": {
                "parts": [
                  {
                    "text": "{\\"proposals\\": [{\\"questionId\\": 101, \\"proposedScore\\": 25, \\"analysis\\": \\"Over-enthusiastic AI\\", \\"feedback\\": \\"Good\\", \\"criterionScores\\": [{\\"criterion\\": \\"Accuracy\\", \\"maxPoints\\": 5, \\"awardedPoints\\": 99, \\"comment\\": \\"Over max\\"}]}, {\\"questionId\\": 102, \\"proposedScore\\": -10, \\"analysis\\": \\"Negative score\\", \\"feedback\\": \\"Poor\\"}]}"
                  }
                ]
              }
            }
          ]
        }
        """;

        List<AiEssayGradingClient.EssayQuestionPayload> payloads = List.of(
                new AiEssayGradingClient.EssayQuestionPayload(101L, 1, "Q1", BigDecimal.valueOf(10), "Ans 1"),
                new AiEssayGradingClient.EssayQuestionPayload(102L, 2, "Q2", BigDecimal.valueOf(5), "Ans 2")
        );

        EssayGradingDTO.AiGradingResponse response = realAiClient.parseAiResponse(geminiJson, payloads, true);

        assertNotNull(response);
        assertEquals(2, response.getProposals().size());

        EssayGradingDTO.AiQuestionProposal p1 = response.getProposals().stream().filter(p -> p.getQuestionId().equals(101L)).findFirst().orElseThrow();
        assertScore("10", p1.getProposedScore());
        assertEquals(5, p1.getCriterionScores().get(0).getAwardedPoints(), "Must clamp 99 down to criterion maxPoints (5)");

        EssayGradingDTO.AiQuestionProposal p2 = response.getProposals().stream().filter(p -> p.getQuestionId().equals(102L)).findFirst().orElseThrow();
        assertScore("0", p2.getProposedScore());
    }

    @Test
    void aiGradingClientThrowsExceptionOnMissingCandidates() {
        AiGradingProperties props = new AiGradingProperties();
        props.setEnabled(true);
        props.setApiKey("test-dummy-key");

        ObjectMapper mapper = new ObjectMapper();
        AiEssayGradingClient realAiClient = new AiEssayGradingClient(props, mapper);

        String invalidGeminiJson = "{\"candidates\": []}";

        List<AiEssayGradingClient.EssayQuestionPayload> payloads = List.of(
                new AiEssayGradingClient.EssayQuestionPayload(101L, 1, "Q1", BigDecimal.valueOf(10), "Ans")
        );

        assertThrows(BadRequestException.class, () -> realAiClient.parseAiResponse(invalidGeminiJson, payloads, true));
    }

    private static void assertScore(String expected, BigDecimal actual) {
        assertNotNull(actual);
        assertEquals(0, new BigDecimal(expected).compareTo(actual), "expected " + expected + " but was " + actual);
    }
}
