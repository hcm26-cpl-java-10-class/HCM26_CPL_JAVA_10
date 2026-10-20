package com.example.starter_project_2025.system.exam.service;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.Set;

import org.junit.jupiter.api.AfterEach;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotSame;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import static org.mockito.ArgumentMatchers.any;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;

import com.example.starter_project_2025.exception.BadRequestException;
import com.example.starter_project_2025.exception.BusinessValidationException;
import com.example.starter_project_2025.system.exam.domain.Exam;
import com.example.starter_project_2025.system.exam.domain.ExamAttemptRepository;
import com.example.starter_project_2025.system.exam.domain.ExamAttemptStatus;
import com.example.starter_project_2025.system.exam.domain.ExamReminder;
import com.example.starter_project_2025.system.exam.domain.ExamReminderRepository;
import com.example.starter_project_2025.system.exam.domain.ExamRepository;
import com.example.starter_project_2025.system.exam.domain.Invitation;
import com.example.starter_project_2025.system.exam.domain.InvitationRepository;
import com.example.starter_project_2025.system.exam.domain.InvitationStatus;
import com.example.starter_project_2025.system.exam.dto.ExamDTO;
import com.example.starter_project_2025.system.exam.mapper.ExamMapper;
import com.example.starter_project_2025.system.question.domain.Difficulty;
import com.example.starter_project_2025.system.question.domain.Question;
import com.example.starter_project_2025.system.question.domain.QuestionRepository;
import com.example.starter_project_2025.system.question.domain.QuestionType;
import com.example.starter_project_2025.system.question.dto.QuestionDTO;
import com.example.starter_project_2025.system.question.mapper.QuestionMapper;
import com.example.starter_project_2025.system.question.service.QuestionValidator;

@ExtendWith(MockitoExtension.class)
class ExamServiceImplTest {

    @Mock
    private ExamRepository examRepository;

    @Mock
    private QuestionRepository questionRepository;

    @Mock
    private ExamMapper examMapper;

    @Mock
    private ExamAttemptRepository examAttemptRepository;

    @Mock
    private InvitationRepository invitationRepository;

    @Mock
    private ExamReminderRepository examReminderRepository;

    @Mock
    private QuestionMapper questionMapper;

    @Mock
    private QuestionValidator questionValidator;

    @InjectMocks
    private ExamServiceImpl examService;

    private Exam exam;
    private Question question;

    @BeforeEach
    void setUp() {
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(
                        "teacher@example.com",
                        "password",
                        List.of(new SimpleGrantedAuthority("EXAM_UPDATE"))
                )
        );

        exam = new Exam();
        exam.setId(1L);

        question = new Question();
        question.setId(10L);
        question.setIsActive(true);
        question.setContent("Question content");
        question.setType(QuestionType.MULTIPLE_CHOICE);
        question.setDifficulty(Difficulty.EASY);
    }

    @AfterEach
    void clearSecurityContext() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void addQuestionsClonesBankQuestionsAndLeavesOriginalUntouched() {
        ExamDTO response = new ExamDTO();
        when(examRepository.findById(1L)).thenReturn(Optional.of(exam));
        when(questionRepository.findAllById(any())).thenReturn(List.of(question));
        when(questionRepository.save(any(Question.class))).thenAnswer(invocation -> {
            Question saved = invocation.getArgument(0);
            saved.setId(100L);
            return saved;
        });
        when(examRepository.save(exam)).thenReturn(exam);
        when(examMapper.toResponse(exam)).thenReturn(response);

        ExamDTO result = examService.addQuestions(1L, List.of(10L, 10L));

        assertSame(response, result);
        assertEquals(1, exam.getQuestions().size());
        Question copy = exam.getQuestions().iterator().next();
        assertNotSame(question, copy);
        assertEquals(10L, copy.getSourceQuestionId());
        assertEquals("Question content", copy.getContent());
        assertNull(question.getSourceQuestionId());
        verify(examRepository).save(exam);
    }

    @Test
    void sameBankQuestionCanBeAddedToDifferentExams() {
        Exam otherExam = new Exam();
        otherExam.setId(2L);
        when(examRepository.findById(1L)).thenReturn(Optional.of(exam));
        when(examRepository.findById(2L)).thenReturn(Optional.of(otherExam));
        when(questionRepository.findAllById(any())).thenReturn(List.of(question));
        when(questionRepository.save(any(Question.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(examRepository.save(any(Exam.class))).thenAnswer(invocation -> invocation.getArgument(0));

        examService.addQuestions(1L, List.of(10L));
        examService.addQuestions(2L, List.of(10L));

        Question first = exam.getQuestions().iterator().next();
        Question second = otherExam.getQuestions().iterator().next();
        assertNotSame(first, second);
        assertEquals(10L, first.getSourceQuestionId());
        assertEquals(10L, second.getSourceQuestionId());
    }

    @Test
    void addQuestionsRejectsQuestionAlreadyCopiedIntoSameExam() {
        Question copy = new Question();
        copy.setId(100L);
        copy.setSourceQuestionId(10L);
        exam.getQuestions().add(copy);
        when(examRepository.findById(1L)).thenReturn(Optional.of(exam));
        when(questionRepository.findAllById(any())).thenReturn(List.of(question));

        assertThrows(BusinessValidationException.class, () -> examService.addQuestions(1L, List.of(10L)));
        verify(questionRepository, never()).save(any(Question.class));
    }

    @Test
    void removeQuestionDeletesOnlyTheCopy() {
        Question copy = new Question();
        copy.setId(100L);
        copy.setSourceQuestionId(10L);
        exam.getQuestions().add(copy);
        when(examRepository.findById(1L)).thenReturn(Optional.of(exam));
        when(examRepository.save(exam)).thenReturn(exam);

        examService.removeQuestion(1L, 100L);

        assertEquals(Set.of(), exam.getQuestions());
        verify(questionRepository).deleteAll(List.of(copy));
    }

    @Test
    void updateQuestionIsRejectedOnceExamHasStarted() {
        Question copy = new Question();
        copy.setId(100L);
        copy.setSourceQuestionId(10L);
        exam.getQuestions().add(copy);
        exam.setStartTime(LocalDateTime.now().minusMinutes(1));
        when(examRepository.findById(1L)).thenReturn(Optional.of(exam));

        assertThrows(BadRequestException.class, () -> examService.updateQuestion(1L, 100L, new QuestionDTO()));
        verify(questionMapper, never()).update(any(), any());
    }

    @Test
    void updateQuestionEditsCopyBeforeStart() {
        Question copy = new Question();
        copy.setId(100L);
        copy.setSourceQuestionId(10L);
        exam.getQuestions().add(copy);
        exam.setStartTime(LocalDateTime.now().plusDays(1));
        QuestionDTO request = new QuestionDTO();
        when(examRepository.findById(1L)).thenReturn(Optional.of(exam));
        when(examRepository.save(exam)).thenReturn(exam);

        examService.updateQuestion(1L, 100L, request);

        verify(questionMapper).update(copy, request);
        verify(questionRepository).save(copy);
        assertNull(question.getSourceQuestionId());
    }

    @Test
    void addQuestionsRejectsUnknownIdsWithoutSavingPartialChanges() {
        when(examRepository.findById(1L)).thenReturn(Optional.of(exam));
        when(questionRepository.findAllById(any())).thenReturn(List.of(question));

        assertThrows(
                BusinessValidationException.class,
                () -> examService.addQuestions(1L, List.of(10L, 999L))
        );

        assertEquals(Set.of(), exam.getQuestions());
        verify(examRepository, never()).save(any(Exam.class));
    }

    @Test
    void deleteExamSuccessfullyWhenSafe() {
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(
                        "admin@example.com",
                        "password",
                        List.of(new SimpleGrantedAuthority("EXAM_DELETE"))
                )
        );

        when(examRepository.lockForAttemptStart(1L)).thenReturn(Optional.of(exam));
        when(examAttemptRepository.existsByExam_IdAndStatusIn(any(), any())).thenReturn(false);
        when(examAttemptRepository.existsByExam_Id(1L)).thenReturn(false);
        when(invitationRepository.findByExamId(1L)).thenReturn(List.of());
        when(examReminderRepository.findByExamId(1L)).thenReturn(List.of());

        examService.delete(1L);

        verify(examRepository).delete(exam);
    }

    @Test
    void deleteExamCleansUpInactiveInvitationsAndReminders() {
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(
                        "admin@example.com",
                        "password",
                        List.of(new SimpleGrantedAuthority("EXAM_DELETE"))
                )
        );

        Invitation expiredInv = new Invitation();
        expiredInv.setStatus(InvitationStatus.EXPIRED);
        ExamReminder reminder = new ExamReminder();

        when(examRepository.lockForAttemptStart(1L)).thenReturn(Optional.of(exam));
        when(examAttemptRepository.existsByExam_IdAndStatusIn(any(), any())).thenReturn(false);
        when(examAttemptRepository.existsByExam_Id(1L)).thenReturn(false);
        when(invitationRepository.findByExamId(1L)).thenReturn(List.of(expiredInv));
        when(examReminderRepository.findByExamId(1L)).thenReturn(List.of(reminder));

        examService.delete(1L);

        verify(examReminderRepository).deleteAll(List.of(reminder));
        verify(invitationRepository).deleteAll(List.of(expiredInv));
        verify(examRepository).delete(exam);
    }

    @Test
    void deleteExamRejectsWhenActiveInvitationsExist() {
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(
                        "admin@example.com",
                        "password",
                        List.of(new SimpleGrantedAuthority("EXAM_DELETE"))
                )
        );

        Invitation pendingInv = new Invitation();
        pendingInv.setStatus(InvitationStatus.PENDING);

        when(examRepository.lockForAttemptStart(1L)).thenReturn(Optional.of(exam));
        when(examAttemptRepository.existsByExam_IdAndStatusIn(any(), any())).thenReturn(false);
        when(examAttemptRepository.existsByExam_Id(1L)).thenReturn(false);
        when(invitationRepository.findByExamId(1L)).thenReturn(List.of(pendingInv));

        com.example.starter_project_2025.exception.BadRequestException ex = assertThrows(
                com.example.starter_project_2025.exception.BadRequestException.class,
                () -> examService.delete(1L)
        );

        assertEquals("Cannot delete exam with active invitations. Revoke or remove invitations first.", ex.getMessage());
        verify(examRepository, never()).delete(any(Exam.class));
    }

    @Test
    void deleteExamRejectsWhenActiveAttemptsInProgress() {
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(
                        "admin@example.com",
                        "password",
                        List.of(new SimpleGrantedAuthority("EXAM_DELETE"))
                )
        );

        when(examRepository.lockForAttemptStart(1L)).thenReturn(Optional.of(exam));
        when(examAttemptRepository.existsByExam_IdAndStatusIn(any(), any())).thenReturn(true);

        com.example.starter_project_2025.exception.BadRequestException ex = assertThrows(
                com.example.starter_project_2025.exception.BadRequestException.class,
                () -> examService.delete(1L)
        );

        assertEquals("Cannot delete an exam that is currently in progress with active student attempts", ex.getMessage());
        verify(examRepository, never()).delete(any(Exam.class));
    }

    @Test
    void deleteExamRejectsWhenAttemptsExist() {
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(
                        "admin@example.com",
                        "password",
                        List.of(new SimpleGrantedAuthority("EXAM_DELETE"))
                )
        );

        when(examRepository.lockForAttemptStart(1L)).thenReturn(Optional.of(exam));
        when(examAttemptRepository.existsByExam_IdAndStatusIn(any(), any())).thenReturn(false);
        when(examAttemptRepository.existsByExam_Id(1L)).thenReturn(true);

        com.example.starter_project_2025.exception.BadRequestException ex = assertThrows(
                com.example.starter_project_2025.exception.BadRequestException.class,
                () -> examService.delete(1L)
        );

        assertEquals("Cannot delete exam with existing student attempts. Historical records must be preserved.", ex.getMessage());
        verify(examRepository, never()).delete(any(Exam.class));
    }

    @Test
    void deleteExamRejectsWhenInProgress() {
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(
                        "admin@example.com",
                        "password",
                        List.of(new SimpleGrantedAuthority("EXAM_DELETE"))
                )
        );

        exam.setStartTime(java.time.LocalDateTime.now().minusHours(1));
        exam.setEndTime(java.time.LocalDateTime.now().plusHours(1));

        when(examRepository.lockForAttemptStart(1L)).thenReturn(Optional.of(exam));

        com.example.starter_project_2025.exception.BadRequestException ex = assertThrows(
                com.example.starter_project_2025.exception.BadRequestException.class,
                () -> examService.delete(1L)
        );

        assertEquals("Cannot delete an exam that is currently in progress", ex.getMessage());
        verify(examRepository, never()).delete(any(Exam.class));
    }

    @Test
    void deleteExamRejectsWhenUnauthorized() {
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(
                        "student@example.com",
                        "password",
                        List.of(new SimpleGrantedAuthority("EXAM_READ"))
                )
        );

        assertThrows(
                org.springframework.security.access.AccessDeniedException.class,
                () -> examService.delete(1L)
        );

        verify(examRepository, never()).delete(any(Exam.class));
    }
}