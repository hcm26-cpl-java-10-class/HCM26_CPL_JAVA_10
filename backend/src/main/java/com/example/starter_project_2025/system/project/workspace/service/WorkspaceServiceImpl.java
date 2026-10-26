package com.example.starter_project_2025.system.project.workspace.service;

import com.example.starter_project_2025.system.project.cohort.Cohort;
import com.example.starter_project_2025.system.project.domain.Project;
import com.example.starter_project_2025.system.project.team.Team;
import com.example.starter_project_2025.system.project.team.TeamMember;
import com.example.starter_project_2025.system.project.team.TeamRepository;
import com.example.starter_project_2025.system.project.workspace.controller.WorkspaceCorrelation;
import com.example.starter_project_2025.system.project.workspace.domain.Workspace;
import com.example.starter_project_2025.system.project.workspace.dto.WorkspaceCandidateFilter;
import com.example.starter_project_2025.system.project.workspace.dto.WorkspaceCandidateItem;
import com.example.starter_project_2025.system.project.workspace.dto.WorkspaceCreateRequest;
import com.example.starter_project_2025.system.project.workspace.dto.WorkspaceDetailResponse;
import com.example.starter_project_2025.system.project.workspace.dto.WorkspaceMemberResponse;
import com.example.starter_project_2025.system.project.workspace.dto.WorkspaceResponse;
import com.example.starter_project_2025.system.project.workspace.repository.WorkspaceRepository;
import com.example.starter_project_2025.system.project.workspace.spec.WorkspaceCandidateSpec;

import com.example.starter_project_2025.system.project.trainingclass.TrainingClass;
import com.example.starter_project_2025.system.rbac.user.User;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.Comparator;
import java.util.List;

@Service
@RequiredArgsConstructor
public class WorkspaceServiceImpl implements WorkspaceService {
    private final WorkspaceRepository workspaceRepository;
    private final ProjectTeamRepository teamRepository;
    private final ProjectMemberRepository memberRepository;
    private final WorkspaceReadService reads;
    private final WorkspaceAccessService access;
    private final WorkspaceCreationTransaction creation;
    private final WorkspaceProjectSelection selection;

    @Override
    @Transactional(readOnly = true)
    public List<WorkspaceProjectSelection.Option> getProjectOptions(Long teamId) {
        return selection.options(access.requireUser(true), teamId);
    }

    private Specification<ProjectTeam> candidateScope(WorkspaceCandidateFilter filter, User user) {
        access.requireTenant(user, false);
        return WorkspaceCandidateSpec.forTeamList(filter)
                .and((root, query, cb) ->
                        cb.equal(root.get("trainingClass").get("tenantId"),
                                user.getTenant().getId()));
    }

    @Override
    @Transactional(readOnly = true)
    public List<WorkspaceCandidateItem> getCandidateItems(WorkspaceCandidateFilter filter) {
        User user = access.requireUser(false);
        return teamRepository.findAll(candidateScope(filter, user)).stream()
                .map(this::toCandidateItem)
                .sorted(Comparator.comparing(WorkspaceCandidateItem::getProjectName,
                                Comparator.nullsLast(String::compareTo))
                        .thenComparing(WorkspaceCandidateItem::getTeamName))
                .toList();
    }

    @Override
    @Transactional(readOnly = true)
    public Page<WorkspaceCandidateItem> getCandidatePage(WorkspaceCandidateFilter filter, Pageable pageable) {
        User user = access.requireUser(false);
        Page<ProjectTeam> teams = teamRepository.findAll(candidateScope(filter, user), pageable);
        return teams.map(this::toCandidateItem);
    }

    private WorkspaceCandidateItem toCandidateItem(ProjectTeam team) {
        TrainingClass trainingClass = team.getTrainingClass();
        Project project = team.getProject();
        Workspace existing = workspaceRepository.findFirstByTeamIdOrderByIdAsc(team.getId()).orElse(null);
        long memberCount = memberRepository.findAllByTeam_IdAndClassMember_StatusOrderByIdAsc(
                team.getId(), com.example.starter_project_2025.system.project.trainingclass.ClassMemberStatus.ACTIVE).size();
        boolean eligible = Boolean.TRUE.equals(team.getIsActive()) && team.getStatus() == ProjectTeamStatus.ACTIVE
                && existing == null && memberCount > 0
                && (project == null || (Boolean.TRUE.equals(project.getIsActive()) && access.projectCanStart(project)));
        String reason = eligible ? null : existing != null ? "This team already has a workspace."
                : memberCount == 0 ? "Add at least one active member to this team before creating a workspace."
                : "The assigned project must be Planning or Active.";

        return WorkspaceCandidateItem.builder()
                .projectId(project != null ? project.getId() : null)
                .projectName(project != null ? project.getName() : null)
                .projectCode(project != null ? project.getCode() : null)
                .projectStatus(project != null ? project.getStatus() : null)
                .teamId(team.getId())
                .teamName(team.getTeamName())
                .teamCode(trainingClass.getCode() + "-T" + team.getId())
                .memberCount(memberCount)
                .cohortId(trainingClass.getCohortId())
                .cohortName(trainingClass.getCohortName())
                .classId(trainingClass.getId())
                .classCode(trainingClass.getCode())
                .className(trainingClass.getName())
                .workspaceId(existing != null ? existing.getId() : null)
                .workspaceStatus(existing != null ? existing.getStatus() : null)
                .eligibleForWorkspace(eligible)
                .ineligibleReason(reason)
                .build();
    }

    @Override
    @Transactional(readOnly = true)
    public WorkspaceCandidateItem confirmWorkspace(WorkspaceCreateRequest request) {
        User user = access.requireUser(true);
        access.requireTenant(user, false);
        var chosen = selection.resolve(user, request, false);
        var result = toCandidateItem(chosen.team());
        Project project = chosen.project();
        result.setProjectId(project.getId());
        result.setProjectName(project.getName());
        result.setProjectCode(project.getCode());
        result.setProjectStatus(project.getStatus());
        result.setEligibleForWorkspace(true);
        result.setIneligibleReason(null);
        return result;
    }

    @Override
    @Transactional(readOnly = true)
    public WorkspaceDetailResponse getWorkspace(Long id) {
        return reads.overview(id);
    }

    @Override
    @Transactional(readOnly = true)
    public List<WorkspaceMemberResponse> getMembers(Long id) {
        return reads.members(id);
    }

    @Override
    public WorkspaceResponse createWorkspace(String key, WorkspaceCreateRequest request) {
        try {
            return creation.create(key, request, WorkspaceCorrelation.current());
        } catch (DataIntegrityViolationException exception) {
            String message = exception.getMostSpecificCause().getMessage().toLowerCase(java.util.Locale.ROOT);
            if (message.contains("uk_team_project") || message.contains("uk_project_team_project")) {
                throw new WorkspaceRelationshipException("Project/team relationship is invalid.");
            }
            if (message.contains("uk_workspace_request_key")) {
                throw new WorkspaceConflictException("Idempotency key đã được dùng với dữ liệu khác", null);
            }
            if (message.contains("uk_workspace_tenant_project_team") || message.contains("uk_workspace_project_team")) {
                throw new WorkspaceConflictException("Project/team đã có workspace", null);
            }
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR,
                    "Không thể hoàn tất khởi tạo workspace. Vui lòng thử lại.", exception);
        }
    }
}
