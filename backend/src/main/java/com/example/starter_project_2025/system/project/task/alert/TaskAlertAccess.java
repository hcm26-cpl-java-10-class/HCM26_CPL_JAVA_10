package com.example.starter_project_2025.system.project.task.alert;

import com.example.starter_project_2025.security.UserPrincipal;
import com.example.starter_project_2025.system.project.*;
import com.example.starter_project_2025.system.project.task.*;
import com.example.starter_project_2025.system.rbac.user.*;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.AuthenticationCredentialsNotFoundException;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.*;
import static com.example.starter_project_2025.system.project.task.alert.TaskAlertDtos.*;

@Service @Transactional(readOnly = true)
public class TaskAlertAccess {
    private final UserRepository users;
    private final ProjectRepository projects;
    private final TeamMemberRepository teamMembers;
    private final ProjectMemberRepository projectMembers;
    private final TaskAlertProjectLinkRepository projectLinks;
    private final TaskAlertMemberLinkRepository memberLinks;
    private final TaskAlertProjectBridge bridge;
    public TaskAlertAccess(UserRepository users, ProjectRepository projects, TeamRepository teams,
            TeamMemberRepository teamMembers, ProjectTeamRepository projectTeams, ProjectMemberRepository projectMembers,
            TaskAlertProjectLinkRepository projectLinks, TaskAlertMemberLinkRepository memberLinks) {
        this.users = users; this.projects = projects; this.teamMembers = teamMembers;
        this.projectMembers = projectMembers;
        this.projectLinks = projectLinks; this.memberLinks = memberLinks;
        this.bridge = new TaskAlertProjectBridge(users, projects, teams, teamMembers, projectTeams, projectMembers, projectLinks, memberLinks);
    }
    public User actor(String permission) {
        var auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !(auth.getPrincipal() instanceof UserPrincipal principal))
            throw new AuthenticationCredentialsNotFoundException("Please sign in");
        User user = users.findById(principal.getUser().getId()).orElseThrow(() -> new AuthenticationCredentialsNotFoundException("Please sign in"));
        boolean permitted = user.getRoles().stream().filter(role -> Boolean.TRUE.equals(role.getIsActive()))
                .flatMap(role -> role.getPermissions().stream()).anyMatch(value ->
                        Boolean.TRUE.equals(value.getIsActive()) && permission.equals(value.getName()));
        if (!permitted || !bridge.active(user) || user.getTenant() == null
                || !Boolean.TRUE.equals(user.getTenant().getActive()) || !Boolean.TRUE.equals(user.getTenant().getIsActive())) throw denied();
        return user;
    }
    public void project(User user, UUID id, boolean manage) {
        if (!bridge.findProjectIds(user.getId()).contains(id)
                || manage && !bridge.isManager(id, user.getId())) throw denied();
    }
    public void read(User user, Task task) {
        project(user, task.getProjectId(), false);
        if (!bridge.canRead(user, task)) throw denied();
    }
    public void send(User user, Task task) {
        if (!bridge.canSend(user, task)) throw denied();
    }
    public void admin(User actor) { if (!bridge.admin(actor)) throw denied(); }
    public TaskAlertProjectBridge directory() { return bridge; }
    public boolean permitted(User user, String permission) {
        return user.getRoles().stream().filter(role -> Boolean.TRUE.equals(role.getIsActive()))
                .flatMap(role -> role.getPermissions().stream()).anyMatch(value ->
                        Boolean.TRUE.equals(value.getIsActive()) && permission.equals(value.getName()));
    }
    @Transactional public void bindProject(UUID id, ProjectBinding request) {
        User actor = actor("TASK_ALERT_SEND"); admin(actor);
        if (request == null || request.projectId() == null) throw new TaskValidationException("projectId", "Select a project");
        var project = projects.findById(request.projectId()).orElseThrow(this::denied);
        if (!bridge.sameTenant(actor, project) || !Boolean.TRUE.equals(project.getIsActive())) throw denied();
        var link = projectLinks.findById(id).orElse(new TaskAlertData.ProjectLink());
        if (link.getProjectId() != null && !link.getProjectId().equals(project.getId()))
            throw new TaskConflictException("An existing project alias cannot be reassigned");
        link.setId(id); link.setProjectId(project.getId()); link.setTenantId(project.getTenant().getId());
        projectLinks.saveAndFlush(link);
    }
    @Transactional public void bindMember(UUID id, MemberBinding request) {
        User actor = actor("TASK_ALERT_SEND"); admin(actor);
        if (request == null || request.projectId() == null || request.source() == null || request.sourceMemberId() == null)
            throw new TaskValidationException("member", "Select a project member");
        project(actor, request.projectId(), false);
        var link = memberLinks.findById(id).orElse(new TaskAlertData.MemberLink());
        if (link.getId() != null && (!link.getProjectId().equals(request.projectId())
                || link.getSource() != request.source() || !link.getSourceMemberId().equals(request.sourceMemberId())))
            throw new TaskConflictException("An existing member alias cannot be reassigned");
        link.setId(id); link.setProjectId(request.projectId()); link.setSource(request.source()); link.setSourceMemberId(request.sourceMemberId());
        if (bridge.resolve(link).isEmpty()) throw new TaskValidationException("member", "The active member must belong to this project");
        memberLinks.saveAndFlush(link);
    }
    public List<BridgeOption> options() {
        // Setup is explicit: reading options never creates aliases or business records.
        User actor = actor("TASK_ALERT_SEND"); admin(actor);
        return projects.findAll().stream().filter(project -> Boolean.TRUE.equals(project.getIsActive()) && bridge.sameTenant(actor, project))
                .map(project -> {
                    List<MemberOption> values = new ArrayList<>();
                    for (var row : teamMembers.findAll())
                        if (bridge.current(row) && bridge.matches(row.getTeam(), project) && bridge.sameTenant(row.getUser(), project))
                            values.add(new MemberOption(row.getId(), TaskAlertData.MemberSource.TEAM_MEMBER, row.getUser().getId(),
                                    row.getUser().getFullName(), row.getTeam().getName()));
                    for (var row : projectMembers.findAll())
                        if (bridge.current(row) && bridge.matches(row.getTeam(), project) && bridge.sameTenant(row.getClassMember().getUser(), project))
                            values.add(new MemberOption(row.getId(), TaskAlertData.MemberSource.PROJECT_MEMBER,
                                    row.getClassMember().getUser().getId(), row.getClassMember().getUser().getFullName(), row.getTeam().getTeamName()));
                    return new BridgeOption(project.getId(), project.getName(), projectLinks.findByProjectId(project.getId())
                            .map(TaskAlertData.ProjectLink::getId).orElse(null), values);
                }).toList();
    }
    private AccessDeniedException denied() { return new AccessDeniedException("You do not have access to these tasks"); }
    public List<ProjectOption> projectOptions() {
        User actor = actor("TASK_READ");
        return bridge.findProjectIds(actor.getId()).stream().map(id -> {
            var project = bridge.project(id);
            return new ProjectOption(id, project.getName(), project.getCode(), bridge.isManager(id,actor.getId()));
        }).sorted(Comparator.comparing(ProjectOption::name).thenComparing(ProjectOption::id)).toList();
    }
    public List<AssigneeOption> assignees(UUID projectId) {
        User actor = actor("TASK_READ"); project(actor, projectId, false);
        var sourceProject = bridge.project(projectId);
        return memberLinks.findByProjectId(projectId).stream().map(bridge::resolve).flatMap(Optional::stream)
                .filter(member -> bridge.admin(actor) || bridge.mentor(sourceProject, actor.getId()) || bridge.inTeam(actor, member, false))
                .map(member -> new AssigneeOption(member.alias(), member.user().getFullName())).toList();
    }
}
