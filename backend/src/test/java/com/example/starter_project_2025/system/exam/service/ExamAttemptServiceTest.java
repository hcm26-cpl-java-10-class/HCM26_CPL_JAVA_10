package com.example.starter_project_2025.system.exam.service;

import com.example.starter_project_2025.system.exam.domain.*;
import com.example.starter_project_2025.exception.BadRequestException;

import com.example.starter_project_2025.system.question.domain.Question;
import com.example.starter_project_2025.system.question.domain.QuestionOption;
import com.example.starter_project_2025.system.question.domain.QuestionType;
import com.example.starter_project_2025.system.question.mapper.QuestionTakerMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.verify;
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

    @Mock
    private ExamResultAccessService resultAccessService;

    @Mock
    private InvitationRepository invitationRepository;

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
        exam.setQuestions(Set.of(question(1L, QuestionType.MULTIPLE_CHOICE, 5)));
        when(examRepository.lockForAttemptStart(20L)).thenReturn(Optional.of(exam));

        // Không được có attempt IN_PROGRESS sẵn, nếu không service resume
        // attempt cũ và không tới bước kiểm tra lời mời.
        attempt.setStatus(ExamAttemptStatus.SUBMITTED);
        when(attemptRepository.findAllByExam_IdAndStudent_IdOrderByAttemptNumberAsc(20L, 40L))
                .thenReturn(List.of(attempt));

        // Đề CÓ lời mời, nhưng sinh viên này chưa accept lời mời nào -> phải bị chặn.
        Invitation pending = Invitation.builder()
                .id(77L)
                .exam(exam)
                .user(attempt.getStudent())
                .status(InvitationStatus.SENT)
                .build();
        when(invitationRepository.findByExamId(20L)).thenReturn(List.of(pending));

        BadRequestException ex = assertThrows(BadRequestException.class,
                () -> service.startOrResume(20L, 40L));
        assertEquals("Bạn cần chấp nhận lời mời trước khi làm bài", ex.getMessage());
    }


    @Test
    void startOrResumeRejectsBeforeExamOpens() {
        Exam exam = attempt.getExam();
        exam.setStartTime(LocalDateTime.now().plusMinutes(5));
        attempt.setStatus(ExamAttemptStatus.SUBMITTED);
        when(examRepository.lockForAttemptStart(20L)).thenReturn(Optional.of(exam));

        assertThrows(BadRequestException.class, () -> service.startOrResume(20L, 40L));
    }

    @Test
    void startOrResumeRejectsWhenAllAttemptsAreUsed() {
        Exam exam = attempt.getExam();
        exam.setMaxAttempts(1);
        attempt.setStatus(ExamAttemptStatus.SUBMITTED);
        when(examRepository.lockForAttemptStart(20L)).thenReturn(Optional.of(exam));

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
        exam.setQuestions(Set.of(question(1L, QuestionType.MULTIPLE_CHOICE, 5)));
        when(examRepository.lockForAttemptStart(20L)).thenReturn(Optional.of(exam));
        when(attemptRepository.findAllByExam_IdAndStudent_IdOrderByAttemptNumberAsc(20L, 40L))
                .thenReturn(List.of());
        when(userRepository.findById(40L)).thenReturn(Optional.of(attempt.getStudent()));

        var result = service.startOrResume(20L, 40L);

        Instant officialDeadline = exam.getEndTime().atZone(ZoneId.systemDefault()).toInstant();
        assertEquals(officialDeadline, result.getOfficialDeadlineAt());
        assertEquals(officialDeadline.plusSeconds(15 * 60L), result.getDeadlineAt());
        assertEquals(1, result.getAttemptsRemaining());
    }

    @Test
    void startOrResumeSnapshotsQuestionsAndOptionsAtStart() {
        Exam exam = attempt.getExam();
        Question live = question(1L, QuestionType.MULTIPLE_CHOICE, 5);
        live.setContent("Original");
        option(11L, live, true);
        exam.setQuestions(Set.of(live));
        when(examRepository.lockForAttemptStart(20L)).thenReturn(Optional.of(exam));
        when(attemptRepository.findAllByExam_IdAndStudent_IdOrderByAttemptNumberAsc(20L, 40L))
                .thenReturn(List.of());
        when(userRepository.findById(40L)).thenReturn(Optional.of(attempt.getStudent()));

        service.startOrResume(20L, 40L);

        ArgumentCaptor<ExamAttempt> captor = ArgumentCaptor.forClass(ExamAttempt.class);
        verify(attemptRepository).save(captor.capture());
        ExamAttempt started = captor.getValue();

        // Teacher edits the live question after the attempt started.
        live.setContent("Edited");
        live.getOptions().get(0).setCorrect(false);

        assertEquals(1, started.getQuestions().size());
        ExamAttemptQuestion snap = started.getQuestions().get(0);
        assertEquals("Original", snap.getContent());
        assertEquals(1L, snap.getSourceQuestionId());
        assertEquals(5, snap.getPoints());
        assertEquals(1, snap.getOptions().size());
        assertEquals(11L, snap.getOptions().get(0).getSourceOptionId());
        assertTrue(snap.getOptions().get(0).isCorrect());
    }



    @Test
    void submitAwardsPointsOnlyWhenEveryCorrectOptionIsSelected() {
        ExamAttemptQuestion question = snapshotQuestion(1L, QuestionType.MULTIPLE_CHOICE, 5);
        ExamAttemptOption firstCorrect = snapshotOption(11L, question, true);
        ExamAttemptOption secondCorrect = snapshotOption(12L, question, true);
        snapshotOption(13L, question, false);
        attempt.setAnswers(new HashSet<>(List.of(answer(question, firstCorrect, secondCorrect))));

        var result = service.submit(30L, 40L, List.of());

        assertScore("10", result.getObjectiveScore());
        assertScore("10", result.getFinalScore());
        assertEquals(ExamAttemptStatus.SUBMITTED, result.getStatus());
    }

    @Test
    void submitDoesNotAwardPartialPointsForMultiChoiceAnswers() {
        ExamAttemptQuestion question = snapshotQuestion(1L, QuestionType.MULTIPLE_CHOICE, 5);
        ExamAttemptOption firstCorrect = snapshotOption(11L, question, true);
        snapshotOption(12L, question, true);
        attempt.setAnswers(new HashSet<>(List.of(answer(question, firstCorrect))));

        var result = service.submit(30L, 40L, List.of());

        assertScore("0", result.getObjectiveScore());
        assertScore("0", result.getFinalScore());
    }

    @Test
    void submitAppliesPenaltyWhenSubmittedDuringGracePeriod() {
        ExamAttemptQuestion question = snapshotQuestion(1L, QuestionType.MULTIPLE_CHOICE, 5);
        ExamAttemptOption correct = snapshotOption(11L, question, true);
        attempt.setAnswers(new HashSet<>(List.of(answer(question, correct))));
        attempt.setOfficialDeadlineAt(Instant.now().minusSeconds(60));
        attempt.setDeadlineAt(Instant.now().plusSeconds(60));
        attempt.setLateGraceEligible(true);
        attempt.setLatePolicy(LatePolicy.ALLOWED_WITH_PENALTY);
        attempt.setLatePenaltyPercent(20);

        var result = service.submit(30L, 40L, List.of());

        assertScore("8", result.getFinalScore()); // 10 điểm trừ 20%
        assertEquals(20, result.getLatePenaltyPercentApplied());
        assertEquals(true, result.isLate());
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

        assertScore("0", result.getObjectiveScore());
        assertNull(result.getFinalScore());
        assertEquals(ExamAttemptStatus.PENDING_REVIEW, result.getStatus());
    }

    @Test
    void reviewAttemptReturnsCorrectAndSelectedOptionsWhenAllowed() {
        attempt.setStatus(ExamAttemptStatus.SUBMITTED);
        ExamAttemptQuestion question = snapshotQuestion(1L, QuestionType.MULTIPLE_CHOICE, 5);
        ExamAttemptOption correct = snapshotOption(11L, question, true);
        snapshotOption(12L, question, false);
        attempt.setAnswers(new HashSet<>(List.of(answer(question, correct))));
        when(attemptRepository.findByIdAndStudent_Id(30L, 40L)).thenReturn(Optional.of(attempt));
        when(resultAccessService.canStudentViewAnswers(attempt.getExam(), ExamAttemptStatus.SUBMITTED, 0))
                .thenReturn(true);

        var review = service.reviewAttempt(30L, 40L);

        var q = review.getQuestions().get(0);
        assertEquals(true, q.getCorrect());
        assertEquals(2, q.getOptions().size());
        assertTrue(q.getOptions().get(0).isCorrect());
        assertTrue(q.getOptions().get(0).isSelected());
        assertEquals(false, q.getOptions().get(1).isSelected());
    }

    @Test
    void reviewAttemptMarksWrongAnswerAsIncorrect() {
        attempt.setStatus(ExamAttemptStatus.SUBMITTED);
        ExamAttemptQuestion question = snapshotQuestion(1L, QuestionType.MULTIPLE_CHOICE, 5);
        snapshotOption(11L, question, true);
        ExamAttemptOption wrong = snapshotOption(12L, question, false);
        attempt.setAnswers(new HashSet<>(List.of(answer(question, wrong))));
        when(attemptRepository.findByIdAndStudent_Id(30L, 40L)).thenReturn(Optional.of(attempt));
        when(resultAccessService.canStudentViewAnswers(any(), any(), anyInt())).thenReturn(true);

        assertEquals(false, service.reviewAttempt(30L, 40L).getQuestions().get(0).getCorrect());
    }

    @Test
    void reviewAttemptIsForbiddenWhenNotAllowed() {
        attempt.setStatus(ExamAttemptStatus.SUBMITTED);
        when(attemptRepository.findByIdAndStudent_Id(30L, 40L)).thenReturn(Optional.of(attempt));
        when(resultAccessService.canStudentViewAnswers(any(), any(), anyInt())).thenReturn(false);

        assertThrows(org.springframework.security.access.AccessDeniedException.class,
                () -> service.reviewAttempt(30L, 40L));
    }

    @Test
    void reviewAttemptIsNotFoundForAnotherStudent() {
        when(attemptRepository.findByIdAndStudent_Id(30L, 99L)).thenReturn(Optional.empty());

        assertThrows(com.example.starter_project_2025.exception.ResourceNotFoundException.class,
                () -> service.reviewAttempt(30L, 99L));
    }

    // ----- live entities (used by the start-attempt tests) -----
    private static void assertScore(String expected, java.math.BigDecimal actual) {
        assertTrue(actual != null && new java.math.BigDecimal(expected).compareTo(actual) == 0,
                "expected " + expected + " but was " + actual);
    }
    private Question question(Long id, QuestionType type, int points) {
        Question question = new Question();
        question.setId(id);
        question.setIsActive(true);
        question.setType(type);
        question.setPoints(points);
        question.setOptions(new ArrayList<>());
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

    // ----- snapshot entities (used by the grading tests) -----
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