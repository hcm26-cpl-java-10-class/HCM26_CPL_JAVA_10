package com.example.starter_project_2025.system.exam.service;

import com.example.starter_project_2025.system.exam.domain.*;
import com.example.starter_project_2025.exception.BadRequestException;
import com.example.starter_project_2025.system.invitation.domain.InvitationRepository;
import com.example.starter_project_2025.system.invitation.domain.Invitation;
import com.example.starter_project_2025.system.invitation.domain.InvitationStatus;
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
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.HashSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ExamAttemptServiceTest {

    @Mock
    private ExamRepository examRepository;

    @Mock
    private ExamAttemptRepository attemptRepository;

    @Mock
    private InvitationRepository invitationRepository;

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
        exam.setIsActive(true);

        attempt = new ExamAttempt();
        attempt.setId(30L);
        attempt.setExam(exam);
        attempt.setStartedAt(Instant.now());
        attempt.setDurationMinutes(60);
        attempt.setTotalPoints(5);
        attempt.setStatus(ExamAttemptStatus.IN_PROGRESS);
        com.example.starter_project_2025.system.rbac.user.User student =
            new com.example.starter_project_2025.system.rbac.user.User();
        student.setId(40L);
        attempt.setStudent(student);

        lenient().when(attemptRepository.lockByIdAndStudentId(30L, 40L)).thenReturn(Optional.of(attempt));
        lenient().when(attemptRepository.save(attempt)).thenReturn(attempt);
        lenient().when(attemptRepository.save(any(ExamAttempt.class)))
            .thenAnswer(invocation -> invocation.getArgument(0));
        lenient().when(attemptRepository.findAllByExam_IdAndStudent_IdOrderByAttemptNumberAsc(20L, 40L))
            .thenReturn(List.of(attempt));
    }

    @Test
    void startOrResumeRejectsStudentWithoutAcceptedInvitation() {
        Exam exam = attempt.getExam();
        exam.setIsActive(true);
        exam.setQuestions(Set.of(question(1L, QuestionType.SINGLE_CHOICE, 5)));
        when(examRepository.lockForAttemptStart(20L)).thenReturn(Optional.of(exam));

        assertThrows(BadRequestException.class, () -> service.startOrResume(20L, 40L));
    }

    @Test
    void startOrResumeRejectsBeforeExamOpens() {
        Exam exam = attempt.getExam();
        exam.setStartTime(LocalDateTime.now().plusMinutes(5));
        attempt.setStatus(ExamAttemptStatus.SUBMITTED);
        when(examRepository.lockForAttemptStart(20L)).thenReturn(Optional.of(exam));
        when(invitationRepository.findByExamIdAndUserId(20L, 40L)).thenReturn(Optional.of(acceptedInvitation()));

        assertThrows(BadRequestException.class, () -> service.startOrResume(20L, 40L));
    }

    @Test
    void startOrResumeRejectsWhenAllAttemptsAreUsed() {
        Exam exam = attempt.getExam();
        exam.setMaxAttempts(1);
        attempt.setStatus(ExamAttemptStatus.SUBMITTED);
        when(examRepository.lockForAttemptStart(20L)).thenReturn(Optional.of(exam));
        when(invitationRepository.findByExamIdAndUserId(20L, 40L)).thenReturn(Optional.of(acceptedInvitation()));

        assertThrows(BadRequestException.class, () -> service.startOrResume(20L, 40L));
    }

    @Test
    void startOrResumeSnapshotsGraceWhenDurationRunsPastExamClose() {
        Exam exam = attempt.getExam();
        exam.setDurationMinutes(60);
        exam.setMaxAttempts(2);
        exam.setLatePolicy(LatePolicy.ALLOWED_WITH_PENALTY);
        exam.setLatePenaltyPercent(20);
        exam.setLateGraceMinutes(15);
        exam.setEndTime(LocalDateTime.now().plusMinutes(10));
        exam.setQuestions(Set.of(question(1L, QuestionType.SINGLE_CHOICE, 5)));
        when(examRepository.lockForAttemptStart(20L)).thenReturn(Optional.of(exam));
        when(invitationRepository.findByExamIdAndUserId(20L, 40L)).thenReturn(Optional.of(acceptedInvitation()));
        when(attemptRepository.findAllByExam_IdAndStudent_IdOrderByAttemptNumberAsc(20L, 40L))
                .thenReturn(List.of());
        when(userRepository.findById(40L)).thenReturn(Optional.of(attempt.getStudent()));

        var result = service.startOrResume(20L, 40L);

        Instant officialDeadline = exam.getEndTime().atZone(ZoneId.systemDefault()).toInstant();
        assertEquals(officialDeadline, result.getOfficialDeadlineAt());
        assertEquals(officialDeadline.plusSeconds(15 * 60L), result.getDeadlineAt());
        assertEquals(1, result.getAttemptsRemaining());
    }

    private Invitation acceptedInvitation() {
        return Invitation.builder()
                .exam(attempt.getExam())
                .user(attempt.getStudent())
                .status(InvitationStatus.ACCEPTED)
                .isActive(true)
                .build();
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
    void submitAppliesPenaltyWhenSubmittedDuringGracePeriod() {
        Question question = question(1L, QuestionType.SINGLE_CHOICE, 5);
        QuestionOption correct = option(11L, question, true);
        attempt.getExam().setQuestions(Set.of(question));
        attempt.setAnswers(new HashSet<>(Set.of(answer(question, correct))));
        attempt.setOfficialDeadlineAt(Instant.now().minusSeconds(60));
        attempt.setDeadlineAt(Instant.now().plusSeconds(60));
        attempt.setLateGraceEligible(true);
        attempt.setLatePolicy(LatePolicy.ALLOWED_WITH_PENALTY);
        attempt.setLatePenaltyPercent(20);

        var result = service.submit(30L, 40L, List.of());

        assertEquals(4, result.getFinalScore());
        assertEquals(20, result.getLatePenaltyPercentApplied());
        assertEquals(true, result.isLate());
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
