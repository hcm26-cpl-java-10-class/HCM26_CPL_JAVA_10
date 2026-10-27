package com.example.starter_project_2025.system.project;

import com.example.starter_project_2025.exception.ResourceNotFoundException;
import com.example.starter_project_2025.security.UserPrincipal;
import com.example.starter_project_2025.system.project.trainingclass.ScopeAuthorizationService;
import com.example.starter_project_2025.system.project.trainingclass.ClassMember;
import com.example.starter_project_2025.system.project.trainingclass.TrainingClass;
import com.example.starter_project_2025.system.project.trainingclass.TrainingClassRepository;
import com.example.starter_project_2025.system.rbac.user.User;
import java.util.List;
import java.util.Objects;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ProjectTeamMemberHistoryService {

    private static final int MAX_PAGE_SIZE = 100;
    private static final String[] HISTORY_PERMISSIONS = {
            "PEO_TEAM_ALLOCATE", "PRJ_WORKSPACE_MANAGE"
    };

    private final ProjectTeamMemberHistoryRepository historyRepository;
    private final TrainingClassRepository trainingClassRepository;
    private final ScopeAuthorizationService scopeAuthorizationService;

    public ProjectTeamMemberHistoryService(
            ProjectTeamMemberHistoryRepository historyRepository,
            TrainingClassRepository trainingClassRepository,
            ScopeAuthorizationService scopeAuthorizationService
    ) {
        this.historyRepository = historyRepository;
        this.trainingClassRepository = trainingClassRepository;
        this.scopeAuthorizationService = scopeAuthorizationService;
    }

    @Transactional
    public void record(
            TeamAllocationSession session,
            ClassMember member,
            ProjectTeam fromTeam,
            ProjectTeam toTeam,
            String fromRole,
            String toRole,
            String action,
            String reason,
            Authentication authentication
    ) {
        boolean activeEvent = (fromTeam != null
                && fromTeam.getStatus() == ProjectTeamStatus.ACTIVE)
                || (toTeam != null
                && toTeam.getStatus() == ProjectTeamStatus.ACTIVE);
        if (!activeEvent) {
            return;
        }
        User actor = ((UserPrincipal) authentication.getPrincipal()).getUser();
        TrainingClass trainingClass = session.getTrainingClass();
        historyRepository.save(ProjectTeamMemberHistory.builder()
                .classId(trainingClass.getId())
                .cohortId(trainingClass.getCohortId())
                .allocationSessionId(session.getId())
                .activeAtEvent(true)
                .memberId(member.getId())
                .memberName(member.getUser().getFullName())
                .fromTeamId(fromTeam == null ? null : fromTeam.getId())
                .fromTeamName(fromTeam == null ? null : fromTeam.getTeamName())
                .toTeamId(toTeam == null ? null : toTeam.getId())
                .toTeamName(toTeam == null ? null : toTeam.getTeamName())
                .fromRole(fromRole)
                .toRole(toRole)
                .action(action)
                .reason(reason)
                .actorId(actor.getId())
                .actorName(actor.getFullName())
                .build());
    }

    @Transactional(readOnly = true)
    public ProjectTeamMemberHistoryPageResponse getHistory(
            Long classId,
            Long cohortId,
            Long memberId,
            Long teamId,
            int page,
            int size,
            Authentication authentication
    ) {
        if ((classId == null) == (cohortId == null)) {
            throw new IllegalArgumentException("Provide exactly one of classId or cohortId");
        }
        if (memberId != null && memberId <= 0 || teamId != null && teamId <= 0) {
            throw new IllegalArgumentException("History filters must be positive IDs");
        }
        if (page < 0 || size < 1) {
            throw new IllegalArgumentException("Page must be non-negative and size positive");
        }

        List<Long> authorizedClassIds;
        if (classId != null) {
            TrainingClass trainingClass = trainingClassRepository.findById(classId)
                    .filter(value -> Boolean.TRUE.equals(value.getIsActive()))
                    .orElseThrow(() -> new ResourceNotFoundException(
                            "TrainingClass", "id", classId));
            scopeAuthorizationService.assertCanManageTeamMentor(
                    authentication, trainingClass);
            authorizedClassIds = List.of(classId);
        } else {
            authorizedClassIds = trainingClassRepository.findAll().stream()
                    .filter(trainingClass -> Boolean.TRUE.equals(trainingClass.getIsActive()))
                    .filter(trainingClass -> Objects.equals(
                            trainingClass.getCohortId(), cohortId))
                    .filter(trainingClass -> scopeAuthorizationService.canManageClass(
                            authentication, trainingClass, HISTORY_PERMISSIONS))
                    .map(TrainingClass::getId)
                    .toList();
        }

        if (authorizedClassIds.isEmpty()) {
            return new ProjectTeamMemberHistoryPageResponse(List.of(), page, size, 0, 0);
        }

        Page<ProjectTeamMemberHistory> result = historyRepository.findHistory(
                authorizedClassIds,
                memberId,
                teamId,
                PageRequest.of(page, Math.min(size, MAX_PAGE_SIZE),
                        Sort.unsorted()));
        return new ProjectTeamMemberHistoryPageResponse(
                result.getContent().stream()
                        .map(ProjectTeamMemberHistoryResponse::from)
                        .toList(),
                result.getNumber(),
                result.getSize(),
                result.getTotalElements(),
                result.getTotalPages());
    }

}
