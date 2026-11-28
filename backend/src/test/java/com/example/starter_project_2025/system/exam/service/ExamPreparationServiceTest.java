package com.example.starter_project_2025.system.exam.service;

import com.example.starter_project_2025.system.exam.attempt.domain.*;
import com.example.starter_project_2025.system.exam.attempt.service.ExamAttemptService;
import com.example.starter_project_2025.system.exam.core.domain.*;
import com.example.starter_project_2025.system.exam.courselink.service.ExamProgressLockService;
import com.example.starter_project_2025.system.exam.integrity.domain.ExamProctorImageRepository;
import com.example.starter_project_2025.system.exam.invitation.domain.*;
import com.example.starter_project_2025.system.exam.pool.domain.ExamQuestionPoolVersionRepository;
import com.example.starter_project_2025.system.exam.pool.service.ExamPoolAttemptSnapshotService;
import com.example.starter_project_2025.system.exam.pool.service.ExamPoolRandomSelectionService;
import com.example.starter_project_2025.system.exam.result.service.ExamResultAccessService;
import com.example.starter_project_2025.system.question.core.domain.*;
import com.example.starter_project_2025.system.question.core.mapper.QuestionTakerMapper;
import com.example.starter_project_2025.system.rbac.user.*;
import com.example.starter_project_2025.exception.ResourceNotFoundException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.*;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.access.AccessDeniedException;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ExamPreparationServiceTest {
    @Mock ExamRepository exams;
    @Mock ExamAttemptRepository attempts;
    @Mock UserRepository users;
    @Mock QuestionTakerMapper mapper;
    @Mock InvitationRepository invitations;
    @Mock ExamResultAccessService results;
    @Mock ExamProctorImageRepository images;
    @Mock ExamProgressLockService progress;
    @Mock ExamQuestionPoolVersionRepository pools;
    @Mock ExamPoolRandomSelectionService selection;
    @Mock ExamPoolAttemptSnapshotService snapshots;
    @InjectMocks ExamAttemptService service;
    Exam exam;
    @BeforeEach void setup() {
        exam=new Exam();exam.setId(1L);exam.setTitle("Java");exam.setIsActive(true);
        exam.setDurationMinutes(60);exam.setMaxAttempts(2);exam.setPassScore(new BigDecimal("6"));exam.setAccessCode("PRIVATE_PASSWORD");
        Question question=new Question();question.setId(9L);question.setIsActive(true);question.setPoints(1);
        question.setContent("PRIVATE_QUESTION");question.setType(QuestionType.ESSAY);
        exam.setQuestions(Set.of(question));
        lenient().when(exams.findById(1L)).thenReturn(Optional.of(exam));
    }
    ExamAttempt attempt(ExamAttemptStatus status) {
        var a=new ExamAttempt();a.setId(5L);a.setExam(exam);a.setStudent(User.builder().id(7L).build());
        a.setAttemptNumber(1);a.setStatus(status);a.setDurationMinutes(60);a.setStartedAt(Instant.now());
        a.setDeadlineAt(Instant.now().plusSeconds(3600));a.setFinalScore(BigDecimal.TEN);return a;
    }
    @Test void readingRepeatedlyNeverAllocatesAttemptOrRevealsSecrets() throws Exception {
        var metadata=service.preparation(1L,7L);service.preparation(1L,7L);
        assertTrue(metadata.canStart());assertEquals(0,metadata.attemptsUsed());assertEquals(2,metadata.attemptsRemaining());assertEquals(1,metadata.questionCount());
        assertEquals(new BigDecimal("6"),metadata.passScore());
        String json=new ObjectMapper().writeValueAsString(metadata);
        assertFalse(json.contains("PRIVATE_QUESTION"));assertFalse(json.contains("PRIVATE_PASSWORD"));assertFalse(json.contains("questions\":"));
        verify(attempts,never()).save(any());verify(exams,never()).lockForAttemptStart(any());verifyNoInteractions(selection,snapshots,users);
    }
    @Test
    void latestActiveAttemptRetainsDeadlineAndDoesNotExpireDuringOverview() {
        var a = attempt(ExamAttemptStatus.IN_PROGRESS);
        a.setDeadlineAt(Instant.now().minusSeconds(10));
        when(attempts.findAllByExam_IdAndStudent_IdOrderByAttemptNumberAsc(1L, 7L)).thenReturn(List.of(a));
        var data = service.preparation(1L, 7L);
        assertTrue(data.canResume());
        assertFalse(data.canStart());
        assertEquals(a.getDeadlineAt(), data.attempts().getFirst().summary().getDeadlineAt());
        assertEquals(ExamAttemptStatus.IN_PROGRESS, a.getStatus());
        assertNotNull(data.unavailableReason());
        verify(attempts, never()).save(any());
        verify(attempts, never()).lockByIdAndStudentId(any(), any());
    }

    @Test
    void exhaustedAttemptHasNoRetryAndUnpublishedScoresStayPrivate() {
        exam.setMaxAttempts(1);
        var a = attempt(ExamAttemptStatus.SUBMITTED);
        when(attempts.findAllByExam_IdAndStudent_IdOrderByAttemptNumberAsc(1L, 7L)).thenReturn(List.of(a));
        var data = service.preparation(1L, 7L);
        assertFalse(data.canStart());
        assertFalse(data.canResume());
        assertEquals(0, data.attemptsRemaining());
        var summary = data.attempts().getFirst().summary();
        assertFalse(summary.isResultPublished());
        assertNull(summary.getFinalScore());
        assertNull(summary.getPassed());
        assertFalse(data.attempts().getFirst().canReview());
    }

    @Test
    void publishedScoresAndPermittedReviewAreExposedOnlyForOwnAttempt() {
        var a = attempt(ExamAttemptStatus.SUBMITTED);
        when(attempts.findAllByExam_IdAndStudent_IdOrderByAttemptNumberAsc(1L, 7L)).thenReturn(List.of(a));
        when(results.isResultPublished(exam)).thenReturn(true);
        when(results.canStudentViewOwnSubmission(exam, a.getStatus())).thenReturn(true);
        var data = service.preparation(1L, 7L);
        assertEquals(BigDecimal.TEN, data.attempts().getFirst().summary().getFinalScore());
        assertTrue(data.attempts().getFirst().canReview());
        verify(attempts, atLeastOnce()).findAllByExam_IdAndStudent_IdOrderByAttemptNumberAsc(1L, 7L);
        verify(attempts, never()).findAllByExam_IdAndStudent_IdOrderByAttemptNumberAsc(1L, 8L);
    }

    @Test
    void inactiveAndUnenrolledAreDeniedAndProgressLocksAreReported() {
        doThrow(new AccessDeniedException("Enrollment required")).when(progress).assertCanViewAssessment(exam, 7L);
        assertThrows(AccessDeniedException.class, () -> service.preparation(1L, 7L));
        reset(progress);
        doThrow(new AccessDeniedException("Complete lessons")).when(progress).assertUnlocked(exam, 7L);
        var data = service.preparation(1L, 7L);
        assertFalse(data.canStart());
        assertEquals("Complete lessons", data.unavailableReason());
        assertEquals(1, data.questionCount());
        exam.setIsActive(false);
        assertThrows(ResourceNotFoundException.class, () -> service.preparation(1L, 7L));
    }

    @Test
    void invitationAndEmptyQuestionPoolBlockStart() {
        Invitation invitation = Invitation.builder().id(3L).exam(exam).user(User.builder().id(7L).build())
                .status(InvitationStatus.PENDING).build();
        when(invitations.findByExamId(1L)).thenReturn(List.of(invitation));
        assertFalse(service.preparation(1L, 7L).canStart());
        when(invitations.findByExamId(1L)).thenReturn(List.of());
        exam.setQuestions(Set.of());
        assertFalse(service.preparation(1L, 7L).canStart());
    }

    @Test
    void currentTakingPageReadCannotCreateAnAttempt() {
        assertThrows(ResourceNotFoundException.class, () -> service.currentAttempt(1L, 7L));
        verify(exams, never()).lockForAttemptStart(any());
        verify(attempts, never()).save(any());
    }
}
