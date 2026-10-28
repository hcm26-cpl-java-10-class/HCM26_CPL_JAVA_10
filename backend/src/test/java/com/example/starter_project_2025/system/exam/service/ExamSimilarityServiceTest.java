package com.example.starter_project_2025.system.exam.service;

import com.example.starter_project_2025.system.exam.domain.*;
import com.example.starter_project_2025.system.exam.dto.ExamSimilarityDTO;
import com.example.starter_project_2025.system.exam.service.ai.AiEssayGradingClient;
import com.example.starter_project_2025.system.question.domain.QuestionType;
import com.example.starter_project_2025.system.rbac.user.User;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ExamSimilarityServiceTest {

    @Mock
    private ExamRepository examRepository;

    @Mock
    private ExamAttemptRepository attemptRepository;

    @Mock
    private AiEssayGradingClient aiClient;

    @InjectMocks
    private ExamSimilarityService similarityService;

    private Exam exam;
    private User student1;
    private User student2;

    @BeforeEach
    void setUp() {
        exam = new Exam();
        exam.setId(10L);
        exam.setTitle("OOP Midterm Exam");

        student1 = new User();
        student1.setId(1L);
        student1.setFirstName("Alice");
        student1.setLastName("Nguyen");
        student1.setEmail("alice@fams.edu.vn");

        student2 = new User();
        student2.setId(2L);
        student2.setFirstName("Bob");
        student2.setLastName("Tran");
        student2.setEmail("bob@fams.edu.vn");
    }

    @Test
    void calculateLexicalSimilarity_identicalTexts_returns100Percent() {
        String text = "Polymorphism in object-oriented programming allows objects of different types to be treated through a unified interface.";
        double similarity = similarityService.calculateLexicalSimilarity(text, text);
        assertEquals(100.0, similarity, 0.01);
    }

    @Test
    void calculateLexicalSimilarity_completelyDifferent_returnsLowOrZero() {
        String textA = "Encapsulation bundles data and the methods that operate on that data within a single class unit.";
        String textB = "Database indexing builds B-trees on disk blocks to minimize input output seek time during queries.";
        double similarity = similarityService.calculateLexicalSimilarity(textA, textB);
        assertTrue(similarity < 20.0, "Similarity should be low for completely distinct topics");
    }

    @Test
    void calculateLexicalSimilarity_shortTrivialAnswers_returnsZero() {
        double similarity = similarityService.calculateLexicalSimilarity("I do not know", "I do not know");
        assertEquals(0.0, similarity, "Trivial answers with < 5 words should return 0 to prevent false positives");
    }

    @Test
    void scanExamSimilarity_withLessThan2Attempts_returnsZeroFlagged() {
        when(examRepository.findById(10L)).thenReturn(Optional.of(exam));
        when(attemptRepository.findFinishedWithQuestionType(eq(10L), any(), eq(QuestionType.ESSAY)))
                .thenReturn(List.of(new ExamAttempt()));

        ExamSimilarityDTO.SimilarityReport report = similarityService.scanExamSimilarity(10L);

        assertNotNull(report);
        assertEquals(1, report.getScannedAttemptsCount());
        assertEquals(0, report.getScannedQuestionsCount());
        assertEquals(0, report.getFlaggedPairsCount());
        assertTrue(report.getPairs().isEmpty());
    }

    @Test
    void scanExamSimilarity_detectsSimilarPairs_lexicalFallbackWhenAiNotConfigured() {
        when(examRepository.findById(10L)).thenReturn(Optional.of(exam));

        ExamAttemptQuestion q1 = new ExamAttemptQuestion();
        q1.setId(201L);
        q1.setSourceQuestionId(501L);
        q1.setDisplayOrder(1);
        q1.setType(QuestionType.ESSAY);
        q1.setContent("Explain polymorphism in Java with examples.");

        // Attempt 1
        ExamAttempt attempt1 = new ExamAttempt();
        attempt1.setId(101L);
        attempt1.setExam(exam);
        attempt1.setStudent(student1);
        attempt1.setStatus(ExamAttemptStatus.SUBMITTED);
        attempt1.setQuestions(List.of(q1));

        ExamAttemptAnswer ans1 = new ExamAttemptAnswer();
        ans1.setId(301L);
        ans1.setQuestion(q1);
        ans1.setTextAnswer("Polymorphism is a core concept in Java where an object can take many forms. Compile time polymorphism uses method overloading and runtime polymorphism uses method overriding.");
        attempt1.setAnswers(Set.of(ans1));

        // Attempt 2 (Suspiciously similar phrasing)
        ExamAttempt attempt2 = new ExamAttempt();
        attempt2.setId(102L);
        attempt2.setExam(exam);
        attempt2.setStudent(student2);
        attempt2.setStatus(ExamAttemptStatus.SUBMITTED);
        attempt2.setQuestions(List.of(q1));

        ExamAttemptAnswer ans2 = new ExamAttemptAnswer();
        ans2.setId(302L);
        ans2.setQuestion(q1);
        ans2.setTextAnswer("Polymorphism is a primary concept in Java where an object takes many forms. Compile time polymorphism is method overloading and runtime polymorphism is method overriding.");
        attempt2.setAnswers(Set.of(ans2));

        when(attemptRepository.findFinishedWithQuestionType(eq(10L), any(), eq(QuestionType.ESSAY)))
                .thenReturn(List.of(attempt1, attempt2));
        when(aiClient.isConfigured()).thenReturn(false);

        ExamSimilarityDTO.SimilarityReport report = similarityService.scanExamSimilarity(10L);

        assertNotNull(report);
        assertEquals(2, report.getScannedAttemptsCount());
        assertEquals(1, report.getScannedQuestionsCount());
        assertEquals(1, report.getTotalPairsCompared());
        assertEquals(1, report.getFlaggedPairsCount());
        assertFalse(report.isAiEvaluated());
        assertTrue(report.getAiMessage().contains("not configured"));

        ExamSimilarityDTO.SimilarPair pair = report.getPairs().get(0);
        assertEquals(501L, pair.getQuestionId());
        assertEquals("Alice Nguyen", pair.getStudentName1());
        assertEquals("Bob Tran", pair.getStudentName2());
        assertTrue(pair.getLexicalSimilarity() >= 60.0);
        assertNull(pair.getSemanticSimilarity());
        assertFalse(pair.isAiAnalyzed());
    }

    @Test
    void scanExamSimilarity_callsAiWhenConfigured_updatesSemanticSimilarity() {
        when(examRepository.findById(10L)).thenReturn(Optional.of(exam));

        ExamAttemptQuestion q1 = new ExamAttemptQuestion();
        q1.setId(201L);
        q1.setSourceQuestionId(501L);
        q1.setDisplayOrder(1);
        q1.setType(QuestionType.ESSAY);
        q1.setContent("Explain polymorphism in Java with examples.");

        ExamAttempt attempt1 = new ExamAttempt();
        attempt1.setId(101L);
        attempt1.setExam(exam);
        attempt1.setStudent(student1);
        attempt1.setStatus(ExamAttemptStatus.SUBMITTED);
        attempt1.setQuestions(List.of(q1));
        ExamAttemptAnswer ans1 = new ExamAttemptAnswer();
        ans1.setId(301L);
        ans1.setQuestion(q1);
        ans1.setTextAnswer("Polymorphism is the core mechanism in Java where a parent class reference refers to a child object.");
        attempt1.setAnswers(Set.of(ans1));

        ExamAttempt attempt2 = new ExamAttempt();
        attempt2.setId(102L);
        attempt2.setExam(exam);
        attempt2.setStudent(student2);
        attempt2.setStatus(ExamAttemptStatus.SUBMITTED);
        attempt2.setQuestions(List.of(q1));
        ExamAttemptAnswer ans2 = new ExamAttemptAnswer();
        ans2.setId(302L);
        ans2.setQuestion(q1);
        ans2.setTextAnswer("Polymorphism is the core principle in Java where a superclass reference refers to a child object.");
        attempt2.setAnswers(Set.of(ans2));

        when(attemptRepository.findFinishedWithQuestionType(eq(10L), any(), eq(QuestionType.ESSAY)))
                .thenReturn(List.of(attempt1, attempt2));
        when(aiClient.isConfigured()).thenReturn(true);
        when(aiClient.getModel()).thenReturn("gemini-3.5-flash-lite");

        AiEssayGradingClient.SimilarityEvaluationResult mockAiResult =
                new AiEssayGradingClient.SimilarityEvaluationResult(
                        "q501-att101-att102",
                        88.5,
                        "SUSPICIOUS_PARAPHRASE",
                        "Both students use identical grammatical sentence structure with direct synonym replacement ('mechanism' vs 'principle', 'parent/child' vs 'superclass/subclass')."
                );
        when(aiClient.evaluateSimilarityBatch(any())).thenReturn(List.of(mockAiResult));

        ExamSimilarityDTO.SimilarityReport report = similarityService.scanExamSimilarity(10L);

        assertNotNull(report);
        assertEquals(1, report.getFlaggedPairsCount());
        assertTrue(report.isAiEvaluated());
        assertTrue(report.getAiMessage().contains("gemini-3.5-flash-lite"));

        ExamSimilarityDTO.SimilarPair pair = report.getPairs().get(0);
        assertEquals(88.5, pair.getSemanticSimilarity());
        assertEquals("SUSPICIOUS_PARAPHRASE", pair.getMatchType());
        assertTrue(pair.getExplanation().contains("synonym replacement"));
        assertTrue(pair.isAiAnalyzed());
    }

    @Test
    void scanExamSimilarity_aiFailureFallsBackToLexicalWithoutCrashing() {
        when(examRepository.findById(10L)).thenReturn(Optional.of(exam));

        ExamAttemptQuestion q1 = new ExamAttemptQuestion();
        q1.setId(201L);
        q1.setSourceQuestionId(501L);
        q1.setDisplayOrder(1);
        q1.setType(QuestionType.ESSAY);
        q1.setContent("Explain polymorphism in Java with examples.");

        ExamAttempt attempt1 = new ExamAttempt();
        attempt1.setId(101L);
        attempt1.setExam(exam);
        attempt1.setStudent(student1);
        attempt1.setStatus(ExamAttemptStatus.SUBMITTED);
        attempt1.setQuestions(List.of(q1));
        ExamAttemptAnswer ans1 = new ExamAttemptAnswer();
        ans1.setId(301L);
        ans1.setQuestion(q1);
        ans1.setTextAnswer("Polymorphism is the mechanism where a parent class reference refers to a child object.");
        attempt1.setAnswers(Set.of(ans1));

        ExamAttempt attempt2 = new ExamAttempt();
        attempt2.setId(102L);
        attempt2.setExam(exam);
        attempt2.setStudent(student2);
        attempt2.setStatus(ExamAttemptStatus.SUBMITTED);
        attempt2.setQuestions(List.of(q1));
        ExamAttemptAnswer ans2 = new ExamAttemptAnswer();
        ans2.setId(302L);
        ans2.setQuestion(q1);
        ans2.setTextAnswer("Polymorphism is the mechanism where a parent class reference refers to a child object.");
        attempt2.setAnswers(Set.of(ans2));

        when(attemptRepository.findFinishedWithQuestionType(eq(10L), any(), eq(QuestionType.ESSAY)))
                .thenReturn(List.of(attempt1, attempt2));
        when(aiClient.isConfigured()).thenReturn(true);
        when(aiClient.evaluateSimilarityBatch(any())).thenThrow(new RuntimeException("API quota exceeded"));

        ExamSimilarityDTO.SimilarityReport report = similarityService.scanExamSimilarity(10L);

        assertNotNull(report);
        assertEquals(1, report.getFlaggedPairsCount());
        assertFalse(report.isAiEvaluated());
        assertTrue(report.getAiMessage().contains("API quota exceeded"));
        ExamSimilarityDTO.SimilarPair pair = report.getPairs().get(0);
        assertEquals(100.0, pair.getOverallSimilarity());
        assertFalse(pair.isAiAnalyzed());
    }
}
