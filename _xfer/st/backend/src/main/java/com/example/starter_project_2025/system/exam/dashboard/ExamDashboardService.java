package com.example.starter_project_2025.system.exam.dashboard;

import com.example.starter_project_2025.security.UserPrincipal;
import com.example.starter_project_2025.system.exam.appeal.domain.ScoreAppealRepository;
import com.example.starter_project_2025.system.exam.appeal.domain.ScoreAppealStatus;
import com.example.starter_project_2025.system.exam.attempt.domain.ExamAttemptRepository;
import com.example.starter_project_2025.system.exam.attempt.domain.ExamAttemptStatus;
import com.example.starter_project_2025.system.exam.core.domain.Exam;
import com.example.starter_project_2025.system.exam.core.domain.ExamRepository;
import com.example.starter_project_2025.system.exam.core.service.ExamAccessGuard;
import com.example.starter_project_2025.system.exam.integrity.domain.ExamIntegrityEventRepository;
import com.example.starter_project_2025.system.exam.invitation.domain.Invitation;
import com.example.starter_project_2025.system.exam.invitation.domain.InvitationRepository;
import com.example.starter_project_2025.system.exam.invitation.domain.InvitationStatus;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.Comparator;
import java.util.EnumSet;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class ExamDashboardService {

    /** Invitations expiring inside this window count as "closing soon". */
    static final Duration CLOSING_WINDOW = Duration.ofHours(72);

    private final ExamRepository examRepository;
    private final ExamAttemptRepository attemptRepository;
    private final ExamIntegrityEventRepository integrityEventRepository;
    private final ScoreAppealRepository appealRepository;
    private final InvitationRepository invitationRepository;
    private final ExamAccessGuard accessGuard;

    @Transactional(readOnly = true)
    public ExamDashboardDTO build(UserPrincipal principal) {
        return build(principal, LocalDateTime.now());
    }

    ExamDashboardDTO build(UserPrincipal principal, LocalDateTime now) {
        List<Exam> exams = examRepository.findAll().stream()
                .filter(e -> Boolean.TRUE.equals(e.getIsActive()))
                .filter(e -> accessGuard.canManage(e, principal))
                .toList();
        if (exams.isEmpty()) {
            return new ExamDashboardDTO(new ExamDashboardDTO.Summary(0, 0, 0, 0, 0, 0), List.of());
        }
        Set<Long> ids = exams.stream().map(Exam::getId).collect(Collectors.toSet());

        Map<Long, Long> grading = toMap(attemptRepository.countByExamAndStatuses(
                ids, EnumSet.of(ExamAttemptStatus.PENDING_REVIEW, ExamAttemptStatus.EXPIRED)));
        Map<Long, Long> flagged = toMap(integrityEventRepository.countFlaggedAttemptsByExam(ids));
        Map<Long, Long> appeals = toMap(appealRepository.countByExamAndStatus(ids, ScoreAppealStatus.PENDING));

        Map<Long, List<Invitation>> closing = invitationRepository
                .findClosingSoon(ids, EnumSet.of(InvitationStatus.SENT, InvitationStatus.ACCEPTED),
                        now, now.plus(CLOSING_WINDOW))
                .stream().collect(Collectors.groupingBy(i -> i.getExam().getId()));

        List<ExamDashboardDTO.Item> items = exams.stream()
                .map(e -> {
                    List<Invitation> expiring = closing.getOrDefault(e.getId(), List.of());
                    LocalDateTime next = expiring.stream().map(Invitation::getExpiresAt).filter(Objects::nonNull)
                            .min(Comparator.naturalOrder()).orElse(null);
                    return new ExamDashboardDTO.Item(e.getId(), e.getTitle(),
                            e.getCategory() == null ? null : e.getCategory().name(),
                            grading.getOrDefault(e.getId(), 0L), flagged.getOrDefault(e.getId(), 0L),
                            appeals.getOrDefault(e.getId(), 0L), expiring.size(), next);
                })
                .filter(i -> i.total() > 0)
                .sorted(Comparator.comparingLong(ExamDashboardDTO.Item::total).reversed()
                        .thenComparing(ExamDashboardDTO.Item::title, Comparator.nullsLast(Comparator.naturalOrder())))
                .toList();

        ExamDashboardDTO.Summary summary = new ExamDashboardDTO.Summary(
                items.stream().mapToLong(ExamDashboardDTO.Item::pendingGrading).sum(),
                items.stream().mapToLong(ExamDashboardDTO.Item::flaggedAttempts).sum(),
                items.stream().mapToLong(ExamDashboardDTO.Item::pendingAppeals).sum(),
                items.stream().mapToLong(ExamDashboardDTO.Item::closingSoonInvitations).sum(),
                items.size(), exams.size());
        return new ExamDashboardDTO(summary, items);
    }

    private static Map<Long, Long> toMap(List<Object[]> rows) {
        Map<Long, Long> map = new HashMap<>();
        for (Object[] row : rows) {
            map.put(((Number) row[0]).longValue(), ((Number) row[1]).longValue());
        }
        return map;
    }
}
