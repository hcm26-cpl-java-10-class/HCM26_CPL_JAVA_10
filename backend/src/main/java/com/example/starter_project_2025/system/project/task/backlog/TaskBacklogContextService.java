package com.example.starter_project_2025.system.project.task.backlog;

import com.example.starter_project_2025.exception.ResourceNotFoundException;
import com.example.starter_project_2025.system.project.ProjectMember;
import com.example.starter_project_2025.system.project.ProjectMemberRepository;
import com.example.starter_project_2025.system.project.ProjectTeam;
import com.example.starter_project_2025.system.project.ProjectTeamRepository;
import com.example.starter_project_2025.system.project.domain.Project;
import com.example.starter_project_2025.system.project.sprint_backlog.SprintBacklog;
import com.example.starter_project_2025.system.project.sprint_backlog.SprintBacklogRepository;
import com.example.starter_project_2025.system.project.task.TaskDTO;
import com.example.starter_project_2025.system.project.task.TaskValidationException;
import com.example.starter_project_2025.system.project.task.alert.TaskAlertData;
import com.example.starter_project_2025.system.project.task.alert.TaskAlertMemberLinkRepository;
import com.example.starter_project_2025.system.project.task.alert.TaskAlertProjectLinkRepository;
import com.example.starter_project_2025.system.project.trainingclass.ClassMemberStatus;
import com.example.starter_project_2025.system.project.workspace.service.WorkspaceAccessService;
import com.example.starter_project_2025.system.rbac.user.UserRepository;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Objects;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class TaskBacklogContextService {
    private final SprintBacklogRepository backlogs;
    private final ProjectTeamRepository teams;
    private final ProjectMemberRepository members;
    private final UserRepository users;
    private final WorkspaceAccessService workspaceAccess;
    private final TaskAlertProjectLinkRepository projectLinks;
    private final TaskAlertMemberLinkRepository memberLinks;

    public record Context(SprintBacklog backlog, Project project, ProjectTeam team, UUID projectAlias) { }
    public record Assignee(UUID id, String displayName) { }

    public Context require(Long backlogId, Long actorId, boolean lock) {
        if (backlogId == null || backlogId <= 0) {
            throw new TaskValidationException("backlogItemId", "Select a backlog item for this subtask");
        }
        var actor = users.findById(actorId).orElseThrow(() -> new AccessDeniedException("User is unavailable"));
        if (!Boolean.TRUE.equals(actor.getIsActive()) || Boolean.TRUE.equals(actor.getLocked()) || actor.getTenant() == null) {
            throw new AccessDeniedException("User is unavailable");
        }
        workspaceAccess.requireTenant(actor, false);
        var backlog = (lock ? backlogs.findForSubtaskUpdate(backlogId) : backlogs.findById(backlogId))
                .filter(item -> Boolean.TRUE.equals(item.getIsActive()))
                .orElseThrow(() -> new ResourceNotFoundException("Backlog item does not exist or has been deleted"));
        Long projectId = backlog.getProjectId();
        if (projectId == null && backlog.getSprint() != null) projectId = backlog.getSprint().getProjectId();
        if (projectId == null) {
            throw new TaskValidationException("backlogItemId", "Assign a project to this backlog item before adding subtasks");
        }
        Project project = workspaceAccess.requireProject(actor, projectId, lock);
        var team = teams.findAllByProject_IdInOrderByIdDesc(List.of(projectId)).stream().findFirst()
                .orElseThrow(() -> new TaskValidationException("backlogItemId", "This project has no active team"));
        workspaceAccess.requirePair(actor, projectId, team.getId(), false);
        UUID alias = projectLinks.findByProjectId(projectId).map(TaskAlertData.ProjectLink::getId)
                .orElseGet(() -> alias("subtask-project:", project.getId()));
        return new Context(backlog, project, team, alias);
    }

    public SprintBacklog prepare(TaskDTO request, Long actorId) {
        Context context = require(request.getBacklogItemId(), actorId, true);
        if (request.getProjectId() != null && !context.projectAlias().equals(request.getProjectId())) {
            throw new TaskValidationException("projectId", "The subtask must belong to its backlog item's project");
        }
        if (!projectLinks.existsById(context.projectAlias())) {
            var link = new TaskAlertData.ProjectLink();
            link.setId(context.projectAlias());
            link.setProjectId(context.project().getId());
            link.setTenantId(context.project().getTenantId());
            projectLinks.saveAndFlush(link);
        }
        for (ProjectMember member : roster(context)) {
            UUID id = memberAlias(context, member);
            if (!memberLinks.existsById(id)) {
                var link = new TaskAlertData.MemberLink();
                link.setId(id);
                link.setProjectId(context.projectAlias());
                link.setSource(TaskAlertData.MemberSource.PROJECT_MEMBER);
                link.setSourceMemberId(member.getId());
                memberLinks.saveAndFlush(link);
            }
        }
        request.setProjectId(context.projectAlias());
        request.setSprintId(null);
        request.setMilestoneId(null);
        return context.backlog();
    }

    public List<Assignee> assignees(Context context) {
        return roster(context).stream().map(member -> new Assignee(memberAlias(context, member),
                member.getClassMember().getUser().getFullName())).toList();
    }

    private List<ProjectMember> roster(Context context) {
        return members.findAllByTeam_IdAndClassMember_StatusOrderByIdAsc(context.team().getId(), ClassMemberStatus.ACTIVE)
                .stream().filter(member -> Boolean.TRUE.equals(member.getIsActive())
                        && Boolean.TRUE.equals(member.getClassMember().getIsActive())
                        && Boolean.TRUE.equals(member.getClassMember().getUser().getIsActive())
                        && !Boolean.TRUE.equals(member.getClassMember().getUser().getLocked())
                        && Objects.equals(member.getClassMember().getUser().getTenantId(), context.project().getTenantId()))
                .toList();
    }

    private UUID memberAlias(Context context, ProjectMember member) {
        return memberLinks.findByProjectId(context.projectAlias()).stream()
                .filter(link -> link.getSource() == TaskAlertData.MemberSource.PROJECT_MEMBER
                        && Objects.equals(link.getSourceMemberId(), member.getId()))
                .map(TaskAlertData.MemberLink::getId).findFirst()
                .orElseGet(() -> alias("subtask-member:", member.getId()));
    }

    private UUID alias(String prefix, Long id) {
        return UUID.nameUUIDFromBytes((prefix + id).getBytes(StandardCharsets.UTF_8));
    }
}
