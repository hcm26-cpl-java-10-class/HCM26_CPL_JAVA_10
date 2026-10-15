package com.example.starter_project_2025.system.exam.service;

import com.example.starter_project_2025.system.exam.domain.*;
import com.example.starter_project_2025.system.question.domain.Question;
import com.example.starter_project_2025.system.question.domain.QuestionOption;
import com.example.starter_project_2025.system.question.domain.QuestionType;
import com.example.starter_project_2025.system.question.mapper.QuestionTakerMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.util.HashSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;

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
        Question question = question(1L, QuestionType.MULTI_CHOICE, 5);
        QuestionOption firstCorrect = option(11L, question, true);
        QuestionOption secondCorrect = option(12L, question, true);
        option(13L, question, false);
        question.setOptions(List.of(firstCorrect, secondCorrect, question.getOptions().get(2)));
        attempt.getExam().setQuestions(Set.of(question));
        attempt.setAnswers(new HashSet<>(Set.of(answer(question, firstCorrect, secondCorrect))));

        var result = service.submit(30L, 40L, List.of());

        assertEquals(5, result.getObjectiveScore());
        assertEquals(5, result.getFinalScore());
        assertEquals(ExamAttemptStatus.SUBMITTED, result.getStatus());
    }

    @Test
    void submitDoesNotAwardPartialPointsForMultiChoiceAnswers() {
        Question question = question(1L, QuestionType.MULTI_CHOICE, 5);
        QuestionOption firstCorrect = option(11L, question, true);
        option(12L, question, true);
        question.setOptions(List.copyOf(question.getOptions()));
        attempt.getExam().setQuestions(Set.of(question));
        attempt.setAnswers(new HashSet<>(Set.of(answer(question, firstCorrect))));

        var result = service.submit(30L, 40L, List.of());

        assertEquals(0, result.getObjectiveScore());
        assertEquals(0, result.getFinalScore());
    }

    @Test
    void submitLeavesFinalScorePendingWhenExamContainsEssayQuestions() {
        Question essay = question(1L, QuestionType.ESSAY, 5);
        attempt.getExam().setQuestions(Set.of(essay));
        ExamAttemptAnswer answer = new ExamAttemptAnswer();
        answer.setAttempt(attempt);
        answer.setQuestion(essay);
        answer.setTextAnswer("A student's written response");
        attempt.setAnswers(new HashSet<>(Set.of(answer)));

        var result = service.submit(30L, 40L, List.of());

        assertEquals(0, result.getObjectiveScore());
        assertNull(result.getFinalScore());
        assertEquals(ExamAttemptStatus.PENDING_REVIEW, result.getStatus());
    }

    private Question question(Long id, QuestionType type, int points) {
        Question question = new Question();
        question.setId(id);
        question.setIsActive(true);
        question.setType(type);
        question.setPoints(points);
        question.setOptions(new java.util.ArrayList<>());
        return question;
    }

    private QuestionOption option(Long id, Question question, boolean correct) {
        QuestionOption option = new QuestionOption();
        option.setId(id);
        option.setQuestion(question);
        option.setCorrect(correct);
        question.getOptions().add(option);
        return option;
    }

    private ExamAttemptAnswer answer(Question question, QuestionOption... selectedOptions) {
        ExamAttemptAnswer answer = new ExamAttemptAnswer();
        answer.setAttempt(attempt);
        answer.setQuestion(question);
        answer.setSelectedOptions(new HashSet<>(List.of(selectedOptions)));
        return answer;
    }
}
