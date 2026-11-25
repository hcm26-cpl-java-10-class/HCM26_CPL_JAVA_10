package com.example.starter_project_2025.system.exam.dashboard;

import com.example.starter_project_2025.security.UserPrincipal;
import com.example.starter_project_2025.system.exam.appeal.domain.ScoreAppealRepository;
import com.example.starter_project_2025.system.exam.appeal.domain.ScoreAppealStatus;
import com.example.starter_project_2025.system.exam.attempt.domain.ExamAttemptRepository;
import com.example.starter_project_2025.system.exam.core.domain.Exam;
import com.example.starter_project_2025.system.exam.core.domain.ExamRepository;
import com.example.starter_project_2025.system.exam.core.service.ExamAccessGuard;
import com.example.starter_project_2025.system.exam.integrity.domain.ExamIntegrityEventRepository;
import com.example.starter_project_2025.system.exam.invitation.domain.Invitation;
import com.example.starter_project_2025.system.exam.invitation.domain.InvitationRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.LocalDateTime;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class ExamDashboardServiceTest {

    private static final LocalDateTime NOW = LocalDateTime.of(2026, 11, 23, 10, 0);

    private final ExamRepository exams = mock(ExamRepository.class);
    private final ExamAttemptRepository attempts = mock(ExamAttemptRepository.class);
    private final ExamIntegrityEventRepository integrity = mock(ExamIntegrityEventRepository.class);
    private final ScoreAppealRepository appeals = mock(ScoreAppealRepository.class);
    private final InvitationRepository invitations = mock(InvitationRepository.class);
    private final ExamAccessGuard guard = mock(ExamAccessGuard.class);
    private final UserPrincipal principal = mock(UserPrincipal.class);
    private ExamDashboardService service;

    private static Exam exam(long id, String title) {
        Exam e = new Exam();
        e.setId(id);
        e.setTitle(title);
        e.setIsActive(true);
        return e;
    }

    @BeforeEach
    void setUp() {
        service = new ExamDashboardService(exams, attempts, integrity, appeals, invitations, guard);
        when(guard.canManage(any(Exam.class), eq(principal))).thenReturn(true);
        when(attempts.countByExamAndStatuses(any(), any())).thenReturn(List.of());
        when(integrity.countFlaggedAttemptsByExam(any())).thenReturn(List.of());
        when(appeals.countByExamAndStatus(any(), eq(ScoreAppealStatus.PENDING))).thenReturn(List.of());
        when(invitations.findClosingSoon(any(), any(), any(), any())).thenReturn(List.of());
    }

    @Test
    void emptyWhenTeacherHasNoExams() {
        when(exams.findAll()).thenReturn(List.of());

        ExamDashboardDTO dto = service.build(principal, NOW);

        assertEquals(0, dto.summary().totalExams());
        assertTrue(dto.items().isEmpty());
    }

    @Test
    void onlyExamsNeedingAttentionAreListedBusiestFirst() {
        when(exams.findAll()).thenReturn(List.of(exam(1, "Quiet"), exam(2, "Busy"), exam(3, "Some")));
        when(attempts.countByExamAndStatuses(any(), any())).thenReturn(List.<Object[]>of(
                new Object[]{2L, 5L}, new Object[]{3L, 1L}));
        when(integrity.countFlaggedAttemptsByExam(any())).thenReturn(List.<Object[]>of(new Object[]{2L, 2L}));
        when(appeals.countByExamAndStatus(any(), eq(ScoreAppealStatus.PENDING)))
                .thenReturn(List.<Object[]>of(new Object[]{3L, 1L}));

        ExamDashboardDTO dto = service.build(principal, NOW);

        assertEquals(List.of(2L, 3L), dto.items().stream().map(ExamDashboardDTO.Item::examId).toList());
        assertEquals(7L, dto.items().get(0).total());
        assertEquals(6, dto.summary().pendingGrading());
        assertEquals(2, dto.summary().flaggedAttempts());
        assertEquals(1, dto.summary().pendingAppeals());
        assertEquals(2, dto.summary().examsNeedingAttention());
        assertEquals(3, dto.summary().totalExams());
    }

    @Test
    void closingSoonCountsInvitationsAndPicksEarliestExpiry() {
        Exam e = exam(4, "Closing");
        when(exams.findAll()).thenReturn(List.of(e));
        Invitation a = Invitation.builder().exam(e).expiresAt(NOW.plusHours(30)).build();
        Invitation b = Invitation.builder().exam(e).expiresAt(NOW.plusHours(5)).build();
        when(invitations.findClosingSoon(any(), any(), any(), any())).thenReturn(List.of(a, b));

        ExamDashboardDTO dto = service.build(principal, NOW);

        assertEquals(2, dto.items().get(0).closingSoonInvitations());
        assertEquals(NOW.plusHours(5), dto.items().get(0).nextClosingAt());
    }

    @Test
    void examsTheUserCannotManageOrInactiveOnesAreIgnored() {
        Exam mine = exam(5, "Mine");
        Exam others = exam(6, "Others");
        Exam inactive = exam(7, "Inactive");
        inactive.setIsActive(false);
        when(exams.findAll()).thenReturn(List.of(mine, others, inactive));
        when(guard.canManage(any(Exam.class), eq(principal))).thenAnswer(i -> ((Exam) i.getArgument(0)).getId() == 5L);
        when(attempts.countByExamAndStatuses(any(), any())).thenReturn(List.<Object[]>of(
                new Object[]{5L, 1L}, new Object[]{6L, 9L}, new Object[]{7L, 9L}));

        ExamDashboardDTO dto = service.build(principal, NOW);

        assertEquals(1, dto.items().size());
        assertEquals(5L, dto.items().get(0).examId());
        assertEquals(1, dto.summary().totalExams());
    }
}
