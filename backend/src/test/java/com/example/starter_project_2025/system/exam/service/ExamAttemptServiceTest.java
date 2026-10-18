package com.example.starter_project_2025.system.exam.service;

import com.example.starter_project_2025.system.exam.domain.*;
import com.example.starter_project_2025.system.question.domain.QuestionType;
import com.example.starter_project_2025.system.question.mapper.QuestionTakerMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ExamAttemptServiceTest {

    @Mock
    private ExamRepository examRepository;

    @Mock
    private ExamAttemptRepository attemptRepository;

    @Mock
    private com.example.starter_project_2025.system.rbac.user.UserRepository userRepository;

    @Mock
    private QuestionTakerMapper questionTakerMapper;

    @InjectMocks
    private ExamAttemptService service;

    private ExamAttempt attempt;

    @BeforeEach
    void setUp() {
        Exam exam = new Exam();
        exam.setId(20L);
        exam.setTitle("Algorithms");

        attempt = new ExamAttempt();
        attempt.setId(30L);
        attempt.setExam(exam);
        attempt.setStartedAt(Instant.now());
        attempt.setDurationMinutes(60);
        attempt.setTotalPoints(5);
        attempt.setStatus(ExamAttemptStatus.IN_PROGRESS);

        when(attemptRepository.lockByIdAndStudentId(30L, 40L)).thenReturn(Optional.of(attempt));
        when(attemptRepository.save(attempt)).thenReturn(attempt);
    }

    @Test
    void submitAwardsPointsOnlyWhenEveryCorrectOptionIsSelected() {
        ExamAttemptQuestion question = snapshotQuestion(1L, QuestionType.MULTI_CHOICE, 5);
        ExamAttemptOption firstCorrect = snapshotOption(11L, question, true);
        ExamAttemptOption secondCorrect = snapshotOption(12L, question, true);
        snapshotOption(13L, question, false);
        attempt.setAnswers(new HashSet<>(List.of(answer(question, firstCorrect, secondCorrect))));

        var result = service.submit(30L, 40L, List.of());

        assertEquals(5, result.getObjectiveScore());
        assertEquals(5, result.getFinalScore());
        assertEquals(ExamAttemptStatus.SUBMITTED, result.getStatus());
    }

    @Test
    void submitDoesNotAwardPartialPointsForMultiChoiceAnswers() {
        ExamAttemptQuestion question = snapshotQuestion(1L, QuestionType.MULTI_CHOICE, 5);
        ExamAttemptOption firstCorrect = snapshotOption(11L, question, true);
        snapshotOption(12L, question, true);
        attempt.setAnswers(new HashSet<>(List.of(answer(question, firstCorrect))));

        var result = service.submit(30L, 40L, List.of());

        assertEquals(0, result.getObjectiveScore());
        assertEquals(0, result.getFinalScore());
    }

    @Test
    void submitLeavesFinalScorePendingWhenExamContainsEssayQuestions() {
        ExamAttemptQuestion essay = snapshotQuestion(1L, QuestionType.ESSAY, 5);
        ExamAttemptAnswer answer = new ExamAttemptAnswer();
        answer.setAttempt(attempt);
        answer.setQuestion(essay);
        answer.setTextAnswer("A student's written response");
        attempt.setAnswers(new HashSet<>(List.of(answer)));

        var result = service.submit(30L, 40L, List.of());

        assertEquals(0, result.getObjectiveScore());
        assertNull(result.getFinalScore());
        assertEquals(ExamAttemptStatus.PENDING_REVIEW, result.getStatus());
    }

    private ExamAttemptQuestion snapshotQuestion(Long id, QuestionType type, int points) {
        ExamAttemptQuestion question = new ExamAttemptQuestion();
        question.setId(id);
        question.setSourceQuestionId(id);
        question.setAttempt(attempt);
        question.setType(type);
        question.setPoints(points);
        question.setDisplayOrder(0);
        question.setOptions(new ArrayList<>());
        attempt.getQuestions().add(question);
        return question;
    }

    private ExamAttemptOption snapshotOption(Long id, ExamAttemptQuestion question, boolean correct) {
        ExamAttemptOption option = new ExamAttemptOption();
        option.setId(id);
        option.setSourceOptionId(id);
        option.setQuestion(question);
        option.setCorrect(correct);
        option.setDisplayOrder(question.getOptions().size());
        question.getOptions().add(option);
        return option;
    }

    private ExamAttemptAnswer answer(ExamAttemptQuestion question, ExamAttemptOption... selectedOptions) {
        ExamAttemptAnswer answer = new ExamAttemptAnswer();
        answer.setAttempt(attempt);
        answer.setQuestion(question);
        answer.setSelectedOptions(new HashSet<>(List.of(selectedOptions)));
        return answer;
    }
}