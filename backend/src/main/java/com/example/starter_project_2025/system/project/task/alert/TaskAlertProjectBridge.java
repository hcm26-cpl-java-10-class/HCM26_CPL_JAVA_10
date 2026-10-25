package com.example.starter_project_2025.system.project.task.alert;

import com.example.starter_project_2025.system.project.*;
import com.example.starter_project_2025.system.project.task.*;
import com.example.starter_project_2025.system.project.trainingclass.ClassMemberStatus;
import com.example.starter_project_2025.system.rbac.user.*;
import org.springframework.security.access.AccessDeniedException;
import java.util.*;

/**
 * TaskProjectAccess adapter for explicitly mapped UUID projects. The supports()
 * contract lets legacy task projects keep their existing creator-based access.
 */
public class TaskAlertProjectBridge implements TaskProjectAccess {
    @Override public boolean supports(UUID projectId) { return projectLinks.existsById(projectId); }
    public record Member(UUID alias, User user, TaskAlertData.MemberSource source, Long teamId) { }
    private final UserRepository users;
    private final ProjectRepository projects;
    private final TeamRepository teams;
    private final TeamMemberRepository teamMembers;
    private final ProjectTeamRepository projectTeams;
    private final ProjectMemberRepository projectMembers;
    private final TaskAlertProjectLinkRepository projectLinks;
    private final TaskAlertMemberLinkRepository memberLinks;

    public TaskAlertProjectBridge(UserRepository users, ProjectRepository projects, TeamRepository teams,
            TeamMemberRepository teamMembers, ProjectTeamRepository projectTeams, ProjectMemberRepository projectMembers,
            TaskAlertProjectLinkRepository projectLinks, TaskAlertMemberLinkRepository memberLinks) {
        this.users = users; this.projects = projects; this.teams = teams; this.teamMembers = teamMembers;
        this.projectTeams = projectTeams; this.projectMembers = projectMembers;
        this.projectLinks = projectLinks; this.memberLinks = memberLinks;
    }
    public boolean admin(User user) {
        return user.getRoles().stream().filter(role -> Boolean.TRUE.equals(role.getIsActive()))
                .anyMatch(role -> Set.of("ADMIN", "SYSTEM_ADMIN", "SUPER_ADMIN").contains(role.getName()));
    }
    public Project project(UUID id) {
        var link = projectLinks.findById(id).orElseThrow(this::denied);
        var project = projects.findById(link.getProjectId()).orElseThrow(this::denied);
        if (!Boolean.TRUE.equals(project.getIsActive()) || project.getTenant() == null
                || !Objects.equals(project.getTenant().getId(), link.getTenantId())) throw denied();
        return project;
    }
    public boolean sameTenant(User user, Project project) {
        return user.getTenant() != null && project.getTenant() != null
                && Objects.equals(user.getTenant().getId(), project.getTenant().getId())
                && Boolean.TRUE.equals(project.getTenant().getActive())
                && Boolean.TRUE.equals(project.getTenant().getIsActive());
    }
    public boolean active(User user) {
        return Boolean.TRUE.equals(user.getIsActive()) && !Boolean.TRUE.equals(user.getLocked());
    }
    boolean current(ProjectMember row) {
        return Boolean.TRUE.equals(row.getIsActive()) && Boolean.TRUE.equals(row.getTeam().getIsActive())
                && row.getTeam().getStatus() == ProjectTeamStatus.ACTIVE
                && Boolean.TRUE.equals(row.getClassMember().getIsActive())
                && row.getClassMember().getStatus() == ClassMemberStatus.ACTIVE
                && row.getTeam().getTrainingClass() != null && row.getClassMember().getTrainingClass() != null
                && Boolean.TRUE.equals(row.getTeam().getTrainingClass().getIsActive())
                && Objects.equals(row.getTeam().getTrainingClass().getId(), row.getClassMember().getTrainingClass().getId())
                && active(row.getClassMember().getUser());
    }
    boolean current(TeamMember row) {
        return row.isCurrentParticipant() && Boolean.TRUE.equals(row.getTeam().getIsActive()) && active(row.getUser());
    }
    boolean matches(Team team, Project project) {
        return Boolean.TRUE.equals(team.getIsActive()) && team.getProject() != null
                && Objects.equals(team.getProject().getId(), project.getId())
                && team.getTenant() != null && Objects.equals(team.getTenant().getId(), project.getTenant().getId());
    }
    boolean matches(ProjectTeam team, Project project) {
        return Boolean.TRUE.equals(team.getIsActive()) && team.getStatus() == ProjectTeamStatus.ACTIVE
                && Objects.equals(team.getProjectId(), project.getId()) && team.getTrainingClass() != null
                && Boolean.TRUE.equals(team.getTrainingClass().getIsActive())
                && Objects.equals(team.getTrainingClass().getTenantId(), project.getTenant().getId());
    }
    public boolean mentor(Project project, Long actorId) {
        return teams.findAll().stream().anyMatch(team -> matches(team, project)
                && team.getMentor() != null && Objects.equals(team.getMentor().getId(), actorId))
                || projectTeams.findAll().stream().anyMatch(team -> matches(team, project)
                && Objects.equals(team.getAssignedMentorId(), actorId));
    }
    public boolean leader(Project project, Long actorId) {
        return teamMembers.findAll().stream().anyMatch(row -> current(row) && matches(row.getTeam(), project)
                && Objects.equals(row.getUser().getId(), actorId) && row.getProjectRole() == ProjectRole.TEAM_LEADER)
                || projectMembers.findAll().stream().anyMatch(row -> current(row) && matches(row.getTeam(), project)
                && Objects.equals(row.getClassMember().getUser().getId(), actorId) && "TEAM_LEADER".equals(row.getRole()));
    }
    public boolean memberOf(Project project, Long actorId) {
        return teamMembers.findAll().stream().anyMatch(row -> current(row) && matches(row.getTeam(), project)
                && Objects.equals(row.getUser().getId(), actorId))
                || projectMembers.findAll().stream().anyMatch(row -> current(row) && matches(row.getTeam(), project)
                && Objects.equals(row.getClassMember().getUser().getId(), actorId));
    }
    @Override public Set<UUID> findProjectIds(Long userId) {
        User user = users.findById(userId).orElseThrow(this::denied);
        Set<UUID> ids = new HashSet<>();
        for (var link : projectLinks.findAll()) {
            var project = projects.findById(link.getProjectId()).orElse(null);
            if (project != null && Boolean.TRUE.equals(project.getIsActive()) && sameTenant(user, project)
                    && Objects.equals(link.getTenantId(), project.getTenant().getId())
                    && active(user) && (admin(user) || mentor(project, userId) || memberOf(project, userId)))
                ids.add(link.getId());
        }
        return ids;
    }
    @Override public boolean isManager(UUID projectId, Long userId) {
        if (!findProjectIds(userId).contains(projectId)) return false;
        User user = users.findById(userId).orElseThrow(this::denied);
        Project project = project(projectId);
        return admin(user) || mentor(project, userId) || leader(project, userId);
    }
    @Override public Optional<Long> findMemberUserId(UUID projectId, UUID memberId) {
        return recipient(projectId, memberId).map(row -> row.user().getId());
    }
    public Optional<Member> recipient(UUID projectId, UUID memberId) {
        if (memberId == null) return Optional.empty();
        var link = memberLinks.findById(memberId).orElse(null);
        if (link == null || !projectId.equals(link.getProjectId())) return Optional.empty();
        return resolve(link);
    }
    public Optional<Member> resolve(TaskAlertData.MemberLink link) {
        return resolve(link, true);
    }
    // Retain the task's team context after an assignee leaves. Authorization is
    // still based on the actor's current membership; delivery requires an active recipient.
    private Optional<Member> scopeMember(UUID projectId, UUID memberId) {
        if (memberId == null) return Optional.empty();
        return memberLinks.findById(memberId).filter(link -> projectId.equals(link.getProjectId()))
                .flatMap(link -> resolve(link, false));
    }
    private Optional<Member> resolve(TaskAlertData.MemberLink link, boolean requireCurrent) {
        Project project = project(link.getProjectId());
        if (link.getSource() == TaskAlertData.MemberSource.TEAM_MEMBER) {
            var row = teamMembers.findById(link.getSourceMemberId()).orElse(null);
            if (row == null || (requireCurrent && !current(row)) || !matches(row.getTeam(), project)
                    || !sameTenant(row.getUser(), project)) return Optional.empty();
            return Optional.of(new Member(link.getId(), row.getUser(), link.getSource(), row.getTeam().getId()));
        }
        var row = projectMembers.findById(link.getSourceMemberId()).orElse(null);
        if (row == null || (requireCurrent && !current(row)) || !matches(row.getTeam(), project)
                || !sameTenant(row.getClassMember().getUser(), project)) return Optional.empty();
        return Optional.of(new Member(link.getId(), row.getClassMember().getUser(), link.getSource(), row.getTeam().getId()));
    }
    public boolean inTeam(User actor, Member recipient, boolean requireLeader) {
        if (recipient.source() == TaskAlertData.MemberSource.TEAM_MEMBER)
            return teamMembers.findByTeamIdAndUserId(recipient.teamId(), actor.getId())
                    .filter(this::current).filter(row -> !requireLeader || row.getProjectRole() == ProjectRole.TEAM_LEADER).isPresent();
        return projectMembers.findAllByTeam_IdOrderByIdAsc(recipient.teamId()).stream().anyMatch(row -> current(row)
                && Objects.equals(row.getClassMember().getUser().getId(), actor.getId())
                && (!requireLeader || "TEAM_LEADER".equals(row.getRole())));
    }
    public boolean canRead(User actor, Task task) {
        Project project = project(task.getProjectId());
        if (!sameTenant(actor, project)) return false;
        if (admin(actor) || mentor(project, actor.getId())) return true;
        return scopeMember(task.getProjectId(), task.getAssigneeProjectMemberId())
                .map(member -> inTeam(actor, member, false))
                .orElse(task.getAssigneeProjectMemberId() == null && leader(project, actor.getId()));
    }
    public boolean canSend(User actor, Task task) {
        Project project = project(task.getProjectId());
        return sameTenant(actor, project) && (admin(actor) || mentor(project, actor.getId())
                || scopeMember(task.getProjectId(), task.getAssigneeProjectMemberId())
                .map(member -> inTeam(actor, member, true))
                .orElse(task.getAssigneeProjectMemberId() == null && leader(project, actor.getId())));
    }
    private AccessDeniedException denied() { return new AccessDeniedException("Task project access is not available"); }
}
