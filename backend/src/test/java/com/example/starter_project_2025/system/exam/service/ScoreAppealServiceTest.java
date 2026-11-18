package com.example.starter_project_2025.system.exam.service;

import com.example.starter_project_2025.exception.BadRequestException;
import com.example.starter_project_2025.exception.ResourceNotFoundException;
import com.example.starter_project_2025.security.UserPrincipal;
import com.example.starter_project_2025.system.exam.domain.Exam;
import com.example.starter_project_2025.system.exam.domain.ExamAttempt;
import com.example.starter_project_2025.system.exam.domain.ExamAttemptRepository;
import com.example.starter_project_2025.system.exam.domain.ExamResultPublication;
import com.example.starter_project_2025.system.exam.domain.ExamResultPublicationRepository;
import com.example.starter_project_2025.system.exam.domain.ScoreAdjustmentAction;
import com.example.starter_project_2025.system.exam.domain.ScoreAppeal;
import com.example.starter_project_2025.system.exam.domain.ScoreAppealAdjustment;
import com.example.starter_project_2025.system.exam.domain.ScoreAppealAdjustmentRepository;
import com.example.starter_project_2025.system.exam.domain.ScoreAppealRepository;
import com.example.starter_project_2025.system.exam.domain.ScoreAppealStatus;
import com.example.starter_project_2025.system.exam.domain.ScoreReleasePolicy;
import com.example.starter_project_2025.system.exam.dto.ScoreAppealDTO;
import com.example.starter_project_2025.system.exam.dto.ScoreAppealDecision;
import com.example.starter_project_2025.system.notification.service.EmailService;
import com.example.starter_project_2025.system.rbac.user.User;
import com.example.starter_project_2025.system.rbac.user.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.core.authority.SimpleGrantedAuthority;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ScoreAppealServiceTest {

    @Mock
    private ScoreAppealRepository appealRepository;

    @Mock
    private ScoreAppealAdjustmentRepository adjustmentRepository;

    @Mock
    private ExamAttemptRepository attemptRepository;

    @Mock
    private ExamResultPublicationRepository publicationRepository;

    @Mock
    private UserRepository userRepository;

    @Mock
    private EmailService emailService;

    @InjectMocks
    private ScoreAppealService service;

    private Exam exam;
    private ExamAttempt attempt;
    private User student;
    private User reviewer;

    @BeforeEach
    void setUp() {
        exam = new Exam();
        exam.setId(10L);
        exam.setTitle("Midterm Exam");
        exam.setMaxScore(BigDecimal.TEN);

        student = new User();
        student.setId(100L);
        student.setEmail("student@example.com");
        student.setFirstName("Nguyen");
        student.setLastName("An");

        reviewer = new User();
        reviewer.setId(200L);
        reviewer.setEmail("teacher@example.com");
        reviewer.setFirstName("Tran");
        reviewer.setLastName("Binh");

        attempt = new ExamAttempt();
        attempt.setId(1L);
        attempt.setExam(exam);
        attempt.setStudent(student);
        attempt.setAttemptNumber(1);
        attempt.setFinalScore(new BigDecimal("6.00"));
        attempt.setMaxScore(BigDecimal.TEN);
    }

    private ExamResultPublication publishedPublication() {
        ExamResultPublication publication = new ExamResultPublication();
        publication.setExam(exam);
        publication.setPublished(true);
        publication.setReleasePolicy(ScoreReleasePolicy.MY_SCORES_AND_EMAIL);
        return publication;
    }

    private ScoreAppeal pendingAppeal() {
        ScoreAppeal appeal = new ScoreAppeal();
        appeal.setId(500L);
        appeal.setAttempt(attempt);
        appeal.setExam(exam);
        appeal.setStudent(student);
        appeal.setReason("Cau 5 cham sai");
        appeal.setOldScore(new BigDecimal("6.00"));
        appeal.setStatus(ScoreAppealStatus.PENDING);
        appeal.setAdjustmentApplied(false);
        return appeal;
    }

    @Test
    void createAppealSucceedsWhenResultPublished() {
        lenient().when(attemptRepository.findByIdAndStudent_Id(1L, 100L)).thenReturn(Optional.of(attempt));
        lenient().when(publicationRepository.findByExam_Id(10L)).thenReturn(Optional.of(publishedPublication()));
        lenient().when(appealRepository.existsByAttempt_Id(1L)).thenReturn(false);
        lenient().when(appealRepository.save(any(ScoreAppeal.class))).thenAnswer(inv -> inv.getArgument(0));
        lenient().when(userRepository.findActiveUsersByRoleName(anyString())).thenReturn(List.of());

        ScoreAppealDTO result = service.createAppeal(100L, 1L, "Cau 5 cham sai", new BigDecimal("8.00"));

        assertEquals(ScoreAppealStatus.PENDING, result.status());
        assertEquals(100L, result.studentId());
        assertEquals("Nguyen An", result.studentName());
        assertEquals(new BigDecimal("6.00"), result.oldScore());
        verify(appealRepository).save(any(ScoreAppeal.class));
    }

    @Test
    void createAppealFailsWhenNotPublished() {
        ExamResultPublication publication = new ExamResultPublication();
        publication.setExam(exam);
        publication.setPublished(false);
        publication.setReleasePolicy(ScoreReleasePolicy.MY_SCORES_AND_EMAIL);

        lenient().when(attemptRepository.findByIdAndStudent_Id(1L, 100L)).thenReturn(Optional.of(attempt));
        lenient().when(publicationRepository.findByExam_Id(10L)).thenReturn(Optional.of(publication));

        BadRequestException ex = assertThrows(BadRequestException.class,
                () -> service.createAppeal(100L, 1L, "Ly do", null));

        assertTrue(ex.getMessage().contains("not been published"));
        verify(appealRepository, never()).save(any(ScoreAppeal.class));
    }

    @Test
    void createAppealFailsWhenReleasePolicyHidden() {
        ExamResultPublication publication = publishedPublication();
        publication.setReleasePolicy(ScoreReleasePolicy.HIDDEN);

        lenient().when(attemptRepository.findByIdAndStudent_Id(1L, 100L)).thenReturn(Optional.of(attempt));
        lenient().when(publicationRepository.findByExam_Id(10L)).thenReturn(Optional.of(publication));

        BadRequestException ex = assertThrows(BadRequestException.class,
                () -> service.createAppeal(100L, 1L, "Ly do", null));

        assertTrue(ex.getMessage().contains("hidden"));
    }

    @Test
    void createAppealFailsWhenAttemptNotGraded() {
        attempt.setFinalScore(null);
        lenient().when(attemptRepository.findByIdAndStudent_Id(1L, 100L)).thenReturn(Optional.of(attempt));

        BadRequestException ex = assertThrows(BadRequestException.class,
                () -> service.createAppeal(100L, 1L, "Ly do", null));

        assertTrue(ex.getMessage().contains("graded"));
    }

    @Test
    void createAppealFailsWhenDuplicate() {
        lenient().when(attemptRepository.findByIdAndStudent_Id(1L, 100L)).thenReturn(Optional.of(attempt));
        lenient().when(publicationRepository.findByExam_Id(10L)).thenReturn(Optional.of(publishedPublication()));
        lenient().when(appealRepository.existsByAttempt_Id(1L)).thenReturn(true);

        BadRequestException ex = assertThrows(BadRequestException.class,
                () -> service.createAppeal(100L, 1L, "Ly do", null));

        assertTrue(ex.getMessage().contains("already exists"));
    }

    @Test
    void createAppealFailsWhenAttemptBelongsToOtherStudent() {
        lenient().when(attemptRepository.findByIdAndStudent_Id(1L, 100L)).thenReturn(Optional.empty());

        assertThrows(ResourceNotFoundException.class,
                () -> service.createAppeal(100L, 1L, "Ly do", null));
    }

    @Test
    void approveUpdatesFinalScoreAndRecordsAdjustment() {
        ScoreAppeal appeal = pendingAppeal();
        lenient().when(appealRepository.findById(500L)).thenReturn(Optional.of(appeal));
        lenient().when(attemptRepository.lockById(1L)).thenReturn(Optional.of(attempt));
        lenient().when(appealRepository.save(any(ScoreAppeal.class))).thenAnswer(inv -> inv.getArgument(0));
        lenient().when(adjustmentRepository.save(any(ScoreAppealAdjustment.class)))
                .thenAnswer(inv -> inv.getArgument(0));

        ScoreAppealDTO result = service.review(500L, ScoreAppealDecision.APPROVE,
                new BigDecimal("8.50"), "Cham lai cau 5", reviewerPrincipal());

        assertEquals(ScoreAppealStatus.APPROVED, result.status());
        assertEquals(0, result.newScore().compareTo(new BigDecimal("8.50")));
        assertEquals(0, result.oldScore().compareTo(new BigDecimal("6.00")));
        assertTrue(result.adjustmentApplied());
        assertEquals(0, attempt.getFinalScore().compareTo(new BigDecimal("8.50")));

        ArgumentCaptor<ScoreAppealAdjustment> captor = ArgumentCaptor.forClass(ScoreAppealAdjustment.class);
        verify(adjustmentRepository).save(captor.capture());
        assertEquals(ScoreAdjustmentAction.SCORE_ADJUSTED, captor.getValue().getAction());
        assertEquals(0, captor.getValue().getOldScore().compareTo(new BigDecimal("6.00")));
        assertEquals(0, captor.getValue().getNewScore().compareTo(new BigDecimal("8.50")));

        verify(emailService).sendScoreAppealApproved(eq("student@example.com"), anyString(),
                eq("Midterm Exam"), any(), any(), anyString());
    }

    @Test
    void approveWithoutNewScoreKeepsFinalScoreAndMarksNoChange() {
        ScoreAppeal appeal = pendingAppeal();
        lenient().when(appealRepository.findById(500L)).thenReturn(Optional.of(appeal));
        lenient().when(attemptRepository.lockById(1L)).thenReturn(Optional.of(attempt));
        lenient().when(appealRepository.save(any(ScoreAppeal.class))).thenAnswer(inv -> inv.getArgument(0));
        lenient().when(adjustmentRepository.save(any(ScoreAppealAdjustment.class)))
                .thenAnswer(inv -> inv.getArgument(0));

        ScoreAppealDTO result = service.review(500L, ScoreAppealDecision.APPROVE,
                null, "Diem dung roi", reviewerPrincipal());

        assertEquals(ScoreAppealStatus.APPROVED, result.status());
        assertFalse(result.adjustmentApplied());
        assertEquals(0, attempt.getFinalScore().compareTo(new BigDecimal("6.00")));

        ArgumentCaptor<ScoreAppealAdjustment> captor = ArgumentCaptor.forClass(ScoreAppealAdjustment.class);
        verify(adjustmentRepository).save(captor.capture());
        assertEquals(ScoreAdjustmentAction.APPEAL_APPROVED_NO_CHANGE, captor.getValue().getAction());
    }

    @Test
    void approveRejectsScoreAboveMaxScore() {
        ScoreAppeal appeal = pendingAppeal();
        lenient().when(appealRepository.findById(500L)).thenReturn(Optional.of(appeal));
        lenient().when(attemptRepository.lockById(1L)).thenReturn(Optional.of(attempt));

        BadRequestException ex = assertThrows(BadRequestException.class,
                () -> service.review(500L, ScoreAppealDecision.APPROVE, new BigDecimal("15"), "Note", reviewerPrincipal()));

        assertTrue(ex.getMessage().contains("between 0 and"));
    }

    @Test
    void rejectRequiresResolutionNote() {
        ScoreAppeal appeal = pendingAppeal();
        lenient().when(appealRepository.findById(500L)).thenReturn(Optional.of(appeal));

        BadRequestException ex = assertThrows(BadRequestException.class,
                () -> service.review(500L, ScoreAppealDecision.REJECT, null, "  ", reviewerPrincipal()));

        assertTrue(ex.getMessage().contains("resolution note"));
    }

    @Test
    void rejectKeepsScoreUnchanged() {
        ScoreAppeal appeal = pendingAppeal();
        lenient().when(appealRepository.findById(500L)).thenReturn(Optional.of(appeal));
        lenient().when(appealRepository.save(any(ScoreAppeal.class))).thenAnswer(inv -> inv.getArgument(0));

        ScoreAppealDTO result = service.review(500L, ScoreAppealDecision.REJECT,
                null, "Diem dung roi", reviewerPrincipal());

        assertEquals(ScoreAppealStatus.REJECTED, result.status());
        assertFalse(result.adjustmentApplied());
        assertEquals(0, attempt.getFinalScore().compareTo(new BigDecimal("6.00")));
        verify(adjustmentRepository, never()).save(any(ScoreAppealAdjustment.class));
        verify(emailService).sendScoreAppealRejected(eq("student@example.com"), anyString(),
                eq("Midterm Exam"), eq("Diem dung roi"));
    }

    @Test
    void reviewFailsWhenAppealAlreadyResolved() {
        ScoreAppeal appeal = pendingAppeal();
        appeal.setStatus(ScoreAppealStatus.APPROVED);
        lenient().when(appealRepository.findById(500L)).thenReturn(Optional.of(appeal));

        BadRequestException ex = assertThrows(BadRequestException.class,
                () -> service.review(500L, ScoreAppealDecision.APPROVE, null, "Note", reviewerPrincipal()));

        assertTrue(ex.getMessage().contains("pending"));
    }

    @Test
    void studentCannotViewOtherStudentsAppeal() {
        ScoreAppeal appeal = pendingAppeal();
        appeal.setStudent(otherStudent());
        lenient().when(appealRepository.findById(500L)).thenReturn(Optional.of(appeal));

        assertThrows(BadRequestException.class, () -> service.getById(500L, studentPrincipal()));
    }

    @Test
    void reviewerCanViewAnyAppeal() {
        ScoreAppeal appeal = pendingAppeal();
        appeal.setStudent(otherStudent());
        lenient().when(appealRepository.findById(500L)).thenReturn(Optional.of(appeal));

        ScoreAppealDTO result = service.getById(500L, reviewerPrincipal());

        assertEquals(500L, result.id());
    }

    @Test
    void studentCanViewOwnAppeal() {
        ScoreAppeal appeal = pendingAppeal();
        lenient().when(appealRepository.findById(500L)).thenReturn(Optional.of(appeal));

        ScoreAppealDTO result = service.getById(500L, studentPrincipal());

        assertEquals(500L, result.id());
    }

    private User otherStudent() {
        User other = new User();
        other.setId(999L);
        other.setEmail("other@example.com");
        other.setFirstName("Le");
        other.setLastName("C");
        return other;
    }

    private UserPrincipal reviewerPrincipal() {
        return new UserPrincipal(reviewer,
                List.of(new SimpleGrantedAuthority("SCORE_APPEAL_REVIEW")));
    }

    private UserPrincipal studentPrincipal() {
        return new UserPrincipal(student,
                List.of(new SimpleGrantedAuthority("SCORE_APPEAL_VIEW_OWN")));
    }
}
