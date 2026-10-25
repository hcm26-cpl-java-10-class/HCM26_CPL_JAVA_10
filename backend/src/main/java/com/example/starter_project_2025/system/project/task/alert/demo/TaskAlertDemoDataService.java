package com.example.starter_project_2025.system.project.task.alert.demo;

import com.example.starter_project_2025.system.project.*;
import com.example.starter_project_2025.system.project.task.*;
import com.example.starter_project_2025.system.project.task.alert.*;
import com.example.starter_project_2025.system.rbac.user.*;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.UUID;

/** Small local fixtures using the existing accounts; never resets an edited task or roster. */
@Service @RequiredArgsConstructor
public class TaskAlertDemoDataService {
    public static final String PROJECT_CODE = "TASK-ALERT-DEMO";
    public static final String TEAM_CODE = "TASK-ALERT-DEMO-TEAM";
    private final UserRepository users;
    private final ProjectRepository projects;
    private final TeamRepository teams;
    private final TeamMemberRepository members;
    private final TaskRepository tasks;
    private final TaskAlertProjectLinkRepository projectLinks;
    private final TaskAlertMemberLinkRepository memberLinks;
    private final TaskAlertDemoDatasetRepository datasets;
    @Value("${app.seed.admin.email:admin@example.com}") private String adminEmail;

    @Transactional
    public void seed() {
        User admin = users.findByEmail(adminEmail).orElseThrow(() -> new IllegalStateException("The existing admin account is required"));
        Tenant tenant = admin.getTenant();
        if (tenant == null || !Boolean.TRUE.equals(tenant.getActive()) || !Boolean.TRUE.equals(tenant.getIsActive())
                || datasets.existsById(tenant.getId())) return;
        User teacher = account("teacher@example.com", tenant);
        User student = account("student@example.com", tenant);
        Project project = projects.findByCodeAndTenantId(PROJECT_CODE, tenant.getId()).orElseGet(() -> {
            Project row = new Project(); row.setCode(PROJECT_CODE); row.setName("Task Alert Demo");
            row.setDescription("Local overdue task scenarios for warning notes, conflicts and access checks.");
            row.setTenant(tenant); row.setStatus(ProjectStatus.ACTIVE); return projects.saveAndFlush(row);
        });
        Team team = teams.findByCodeAndTenantId(TEAM_CODE, tenant.getId()).orElseGet(() -> {
            Team row = new Team(); row.setCode(TEAM_CODE); row.setName("Task Alert Team");
            row.setProject(project); row.setTenant(tenant); row.setMentor(teacher); return teams.saveAndFlush(row);
        });
        if (!Boolean.TRUE.equals(project.getIsActive()) || !Boolean.TRUE.equals(team.getIsActive())
                || team.getProject() == null || !project.getId().equals(team.getProject().getId())
                || team.getMentor() == null || !teacher.getId().equals(team.getMentor().getId()))
            throw new IllegalStateException("Existing demo project/team assignments were changed; they will not be reset");
        TeamMember member = members.findByTeamIdAndUserId(team.getId(), student.getId()).orElseGet(() -> {
            TeamMember row = new TeamMember(); row.setTeam(team); row.setUser(student); row.setProjectRole(ProjectRole.DEV);
            return members.saveAndFlush(row);
        });
        if (!member.isCurrentParticipant()) throw new IllegalStateException("The demo assignee is no longer an active team member");
        var projectLink = projectLinks.findByProjectId(project.getId()).orElseGet(() -> {
            var row = new TaskAlertData.ProjectLink(); row.setId(UUID.randomUUID()); row.setProjectId(project.getId());
            row.setTenantId(tenant.getId()); return projectLinks.saveAndFlush(row);
        });
        var memberLink = memberLinks.findByProjectId(projectLink.getId()).stream()
                .filter(row -> row.getSource() == TaskAlertData.MemberSource.TEAM_MEMBER && row.getSourceMemberId().equals(member.getId()))
                .findFirst().orElseGet(() -> {
                    var row = new TaskAlertData.MemberLink(); row.setId(UUID.randomUUID()); row.setProjectId(projectLink.getId());
                    row.setSource(TaskAlertData.MemberSource.TEAM_MEMBER); row.setSourceMemberId(member.getId());
                    return memberLinks.saveAndFlush(row);
                });
        Instant now = Instant.now(), past = now.minus(2, ChronoUnit.DAYS), future = now.plus(30, ChronoUnit.DAYS);
        UUID projectId = projectLink.getId(), assigneeId = memberLink.getId();
        task(projectId, assigneeId, admin.getId(), "Implement booking API", TaskStatus.TODO, past,
                "Overdue To Do task. Select with Fix booking validation to verify one recipient for two tasks.");
        task(projectId, assigneeId, admin.getId(), "Fix booking validation", TaskStatus.IN_PROGRESS, past.plusSeconds(3600),
                "Overdue In Progress task with the same assignee. Also use it for the Done/conflict scenario.");
        task(projectId, assigneeId, admin.getId(), "Prepare next release", TaskStatus.TODO, future,
                "A future deadline: excluded from the overdue list.");
        task(projectId, assigneeId, admin.getId(), "Complete database setup", TaskStatus.DONE, past,
                "Done task with a past deadline: excluded from the overdue list.");
        task(projectId, assigneeId, admin.getId(), "Review UI changes", TaskStatus.REVIEW, past,
                "Review task with a past deadline: excluded from the overdue list.");
        task(projectId, null, admin.getId(), "Assign an owner to deployment", TaskStatus.TODO, past,
                "Overdue task without an assignee: including it in a batch must return 409 and create no alerts.");
        task(projectId, assigneeId, admin.getId(), "Plan monitoring work", TaskStatus.TODO, null,
                "Task without a deadline: excluded from the overdue list.");
        var dataset = new TaskAlertDemoDataset(); dataset.setTenantId(tenant.getId()); dataset.setTaskProjectId(projectId);
        datasets.saveAndFlush(dataset);
    }
    private User account(String email, Tenant tenant) {
        User user = users.findByEmail(email).orElseThrow(() -> new IllegalStateException("The existing student/teacher account is required"));
        if (user.getTenant() == null || !tenant.getId().equals(user.getTenant().getId())
                || !Boolean.TRUE.equals(user.getIsActive()) || Boolean.TRUE.equals(user.getLocked()))
            throw new IllegalStateException("The existing student/teacher account must be active in the same tenant");
        return user;
    }
    private void task(UUID projectId, UUID assigneeId, Long actorId, String title, TaskStatus status, Instant deadline, String description) {
        tasks.save(Task.builder().projectId(projectId).assigneeProjectMemberId(assigneeId).title(title)
                .description(description).status(status).deadline(deadline).createdBy(actorId).updatedBy(actorId).build());
    }
}
