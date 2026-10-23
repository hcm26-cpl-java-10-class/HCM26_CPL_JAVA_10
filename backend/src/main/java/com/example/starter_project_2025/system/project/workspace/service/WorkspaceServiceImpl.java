package com.example.starter_project_2025.system.project;

import com.example.starter_project_2025.system.rbac.user.User;
import com.example.starter_project_2025.system.rbac.user.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.Page;
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
    private final TeamRepository teamRepository;
    private final UserRepository userRepository;
    private final WorkspaceActivityRepository activities;
    private final WorkspaceAccessService access;
    private final WorkspaceCreationTransaction creation;
    private final WorkspaceProjectSelection selection;

    @Override
    @Transactional(readOnly = true)
    public List<WorkspaceProjectSelection.Option> getProjectOptions(Long teamId) {
        return selection.options(access.requireUser(true), teamId);
    }

    private Specification<Team> candidateScope(WorkspaceCandidateFilter filter, User user) {
        access.requireTenant(user, false);
        return WorkspaceCandidateSpec.forTeamList(filter).and(WorkspaceCandidateSpec.forScope(user.getId(), user.getTenant().getId()));
    }

    @Override
    @Transactional(readOnly = true)
    public List<WorkspaceCandidateItem> getCandidateItems(WorkspaceCandidateFilter filter) {
        User user = access.requireUser(false);
        return teamRepository.findAll(candidateScope(filter, user)).stream().map(this::toCandidateItem)
                .sorted(Comparator.comparing(WorkspaceCandidateItem::getProjectName, Comparator.nullsLast(String::compareTo))
                        .thenComparing(WorkspaceCandidateItem::getTeamName)).toList();
    }

    @Override
    @Transactional(readOnly = true)
    public Page<WorkspaceCandidateItem> getCandidatePage(WorkspaceCandidateFilter filter, Pageable pageable) {
        User user = access.requireUser(false);
        return teamRepository.findAll(candidateScope(filter, user), pageable).map(this::toCandidateItem);
    }

    private WorkspaceCandidateItem toCandidateItem(Team team) {
        Project project = team.getProject();
        Cohort cohort = project != null ? project.getCohort() : null;
        Workspace existing = workspaceRepository.findFirstByTeamIdOrderByIdAsc(team.getId()).orElse(null);
        boolean eligible = Boolean.TRUE.equals(team.getIsActive()) && existing == null
                && access.hasMembers(team)
                && (project == null || (Boolean.TRUE.equals(project.getIsActive()) && access.projectCanStart(project)));
        String reason = eligible ? null : existing != null ? "This team already has a workspace."
                : !access.hasMembers(team) ? "Add at least one active member to this team before creating a workspace."
                : "The assigned project must be Planning or Active.";
        return WorkspaceCandidateItem.builder().projectId(project != null ? project.getId() : null)
                .projectName(project != null ? project.getName() : null).projectCode(project != null ? project.getCode() : null)
                .projectStatus(project != null ? project.getStatus() : null).teamId(team.getId()).teamName(team.getName()).teamCode(team.getCode())
                .memberCount(team.getMembers().stream().filter(member -> Boolean.TRUE.equals(member.getIsActive())).count())
                .cohortId(cohort != null ? cohort.getId() : null).cohortName(cohort != null ? cohort.getName() : null)
                .workspaceId(existing != null ? existing.getId() : null).workspaceStatus(existing != null ? existing.getStatus() : null)
                .eligibleForWorkspace(eligible).ineligibleReason(reason).build();
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
        result.setCohortId(project == null || project.getCohort() == null ? null : project.getCohort().getId());
        result.setCohortName(project == null || project.getCohort() == null ? null : project.getCohort().getName());
        result.setEligibleForWorkspace(true);
        result.setIneligibleReason(null);
        return result;
    }

    @Override
    @Transactional(readOnly = true)
    public WorkspaceDetailResponse getWorkspace(Long id) {
        User user = access.requireUser(false);
        access.requireTenant(user, false);
        Workspace workspace = workspaceRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Không tìm thấy workspace"));
        if (!Boolean.TRUE.equals(workspace.getIsActive())) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Không tìm thấy workspace");
        if (!workspace.getTenant().getId().equals(user.getTenant().getId())) throw new org.springframework.security.access.AccessDeniedException("Workspace is outside the current tenant");
        Team team = access.requirePair(user, workspace.getProject().getId(), workspace.getTeam().getId(), false);
        Project project = team.getProject();
        Cohort cohort = project.getCohort();
        List<WorkspaceDetailResponse.Member> members = team.getMembers().stream()
                .filter(member -> Boolean.TRUE.equals(member.getIsActive())).map(TeamMember::getUser)
                .map(member -> new WorkspaceDetailResponse.Member(member.getId(), member.getFullName(), member.getEmail()))
                .sorted(Comparator.comparing(WorkspaceDetailResponse.Member::name)).toList();
        List<WorkspaceDetailResponse.ActivityItem> activity = activities.findByWorkspaceIdOrderByOccurredAtDesc(id).stream()
                .map(item -> new WorkspaceDetailResponse.ActivityItem(item.getEventId(), item.getAction(), item.getActorId(),
                        userRepository.findById(item.getActorId()).map(User::getFullName).orElse("Tài khoản đã ẩn danh"),
                        item.getOccurredAt(), item.getCorrelationId())).toList();
        return WorkspaceDetailResponse.builder().id(id).code(workspace.getCode()).name(workspace.getName()).status(workspace.getStatus())
                .projectId(project.getId()).projectCode(project.getCode()).projectName(project.getName()).projectDescription(project.getDescription())
                .projectStatus(project.getStatus()).teamId(team.getId()).teamCode(team.getCode()).teamName(team.getName())
                .mentorName(team.getMentor() != null ? team.getMentor().getFullName() : null).charter(ProjectHubDtos.Charter.from(team))
                .cohortId(cohort != null ? cohort.getId() : null).cohortName(cohort != null ? cohort.getName() : null)
                .createdAt(workspace.getCreatedAt()).createdByName(workspace.getCreatedBy() == null ? null : userRepository.findById(workspace.getCreatedBy()).map(User::getFullName).orElse(null))
                .members(members).sections(workspace.getSections().stream().map(WorkspaceSection::getKey).toList()).activities(activity).build();
    }

    @Override
    public WorkspaceResponse createWorkspace(String key, WorkspaceCreateRequest request) {
        try { return creation.create(key, request, WorkspaceCorrelation.current()); }
        catch (DataIntegrityViolationException exception) {
            String message = exception.getMostSpecificCause().getMessage().toLowerCase(java.util.Locale.ROOT);
            if (message.contains("uk_team_project")) throw new WorkspaceRelationshipException("Project/team relationship is invalid.");
            if (message.contains("uk_workspace_request_key")) throw new WorkspaceConflictException("Idempotency key đã được dùng với dữ liệu khác", null);
            if (message.contains("uk_workspace_tenant_project_team") || message.contains("uk_workspace_project_team")) {
                throw new WorkspaceConflictException("Project/team đã có workspace", null);
            }
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Không thể hoàn tất khởi tạo workspace. Vui lòng thử lại.", exception);
        }
    }
}
