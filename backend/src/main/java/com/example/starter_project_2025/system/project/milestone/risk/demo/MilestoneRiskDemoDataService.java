package com.example.starter_project_2025.system.project.milestone.risk.demo;
import com.example.starter_project_2025.system.project.milestone.domain.*;
import com.example.starter_project_2025.system.project.milestone.repository.MilestoneRepository;
import com.example.starter_project_2025.system.project.milestone.integration.mock.MockMilestoneData;
import com.example.starter_project_2025.system.project.milestone.risk.MilestoneRiskIdentity;
import com.example.starter_project_2025.system.project.ProjectMember;
import com.example.starter_project_2025.system.project.ProjectMemberRepository;
import com.example.starter_project_2025.system.project.ProjectTeam;
import com.example.starter_project_2025.system.project.ProjectTeamRepository;
import com.example.starter_project_2025.system.project.ProjectTeamStatus;
import com.example.starter_project_2025.system.project.trainingclass.ClassMemberStatus;
import com.example.starter_project_2025.system.project.task.*;
import com.example.starter_project_2025.system.project.task.alert.demo.TaskAlertDemoDatasetRepository;
import com.example.starter_project_2025.system.rbac.user.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.*;
import java.util.UUID;
@Service @RequiredArgsConstructor @Slf4j
public class MilestoneRiskDemoDataService {
    private final TaskAlertDemoDatasetRepository taskDatasets;
    private final MilestoneRiskDemoDatasetRepository datasets;
    private final MilestoneRepository milestones;
    private final TaskRepository tasks;
    private final ProjectTeamRepository projectTeams;
    private final ProjectMemberRepository projectMembers;
    private final UserRepository users;
    private final Clock milestoneClock;
    @Value("${app.seed.admin.email:admin@example.com}") private String adminEmail;
    @Transactional public void seed() {
        var admin = users.findByEmail(adminEmail).orElseThrow();
        if (admin.getTenant() == null) return;
        Long tenantId = admin.getTenant().getId();
        var source = taskDatasets.findById(admin.getTenant().getId()).orElse(null);
        if (source == null) return;
        ProjectTeam team = projectTeams.findAllByTrainingClass_TenantIdOrderByIdAsc(admin.getTenant().getId()).stream()
                .filter(candidate -> Boolean.TRUE.equals(candidate.getIsActive())
                        && candidate.getStatus() == ProjectTeamStatus.ACTIVE
                        && candidate.getProjectId() != null
                        && candidate.getTrainingClass() != null
                        && Boolean.TRUE.equals(candidate.getTrainingClass().getIsActive()))
                .filter(candidate -> projectMembers.findAllByTeam_IdOrderByIdAsc(candidate.getId()).stream()
                        .anyMatch(member -> activeStudent(member, candidate)
                                && "hier.ready.busy.pm@example.com".equals(member.getClassMember().getUser().getEmail())))
                .findFirst().orElse(null);
        if (team == null) {
            log.info("Milestone notification demo seed skipped: no active project team with an active student roster.");
            return;
        }
        if (milestones.existsByTenantIdAndProjectIdAndTitle(tenantId, team.getProjectId(),
                "Notification demo - deadline soon")
                && milestones.existsByTenantIdAndProjectIdAndTitle(tenantId, team.getProjectId(),
                "Notification demo - overdue milestone")
                && milestones.existsByTenantIdAndProjectIdAndTitle(tenantId, team.getProjectId(),
                "Notification demo - overdue linked task")) return;
        Instant now = milestoneClock.instant();
        UUID actor = MilestoneRiskIdentity.actor(admin.getId());
        Long projectId = team.getProjectId();
        sample(tenantId, projectId, team.getId(), actor, admin.getId(), "Notification demo - deadline soon",
                now.plus(Duration.ofHours(24)), true, 0, 1, now, false);
        sample(tenantId, projectId, team.getId(), actor, admin.getId(), "Notification demo - overdue milestone",
                now.minus(Duration.ofHours(2)), true, 0, 1, now, false);
        sample(tenantId, projectId, team.getId(), actor, admin.getId(), "Notification demo - overdue linked task",
                now.plus(Duration.ofDays(7)), true, 0, 1, now, true);
        datasets.findById(tenantId).orElseGet(() -> {
            var marker = new MilestoneRiskDemoDataset();
            marker.setTenantId(tenantId);
            return datasets.save(marker);
        });
        log.info("Milestone notification demo data ready for team {} (project {}); login as hier.ready.busy.pm@example.com.",
                team.getTeamName(), projectId);
    }
    private void sample(Long tenant, Long project, Long teamId, UUID actor, Long actorId, String title,
            Instant deadline, boolean open, int done, int total, Instant now, boolean overdueTask) {
        if (milestones.existsByTenantIdAndProjectIdAndTitle(tenant, project, title)) return;
        Milestone milestone = Milestone.create(tenant, project, teamId, title, "Local in-app notification demo: " + title,
                deadline, true, MockMilestoneData.RUBRIC_ID, null, LatePolicyType.NO_LATE, null, null, actor, now);
        if (open) milestone.openForWork(actor, now);
        milestones.saveAndFlush(milestone);
        UUID legacyProject = UUID.nameUUIDFromBytes(("milestone:project:" + project).getBytes(java.nio.charset.StandardCharsets.UTF_8));
        for (int i=0; i<total; i++) tasks.save(Task.builder().projectId(legacyProject).milestoneId(milestone.getId())
                .title(title + " - task " + (i+1))
                .deadline(overdueTask && i >= done ? now.minus(Duration.ofHours(3)) : null)
                .status(i<done ? TaskStatus.DONE : TaskStatus.TODO).createdBy(actorId).updatedBy(actorId).build());
    }

    private boolean activeStudent(ProjectMember member, ProjectTeam team) {
        var classMember = member.getClassMember();
        var user = classMember.getUser();
        return Boolean.TRUE.equals(member.getIsActive())
                && classMember.getTrainingClass() != null
                && classMember.getTrainingClass().getId().equals(team.getTrainingClass().getId())
                && Boolean.TRUE.equals(classMember.getIsActive())
                && classMember.getStatus() == ClassMemberStatus.ACTIVE
                && Boolean.TRUE.equals(user.getIsActive())
                && !Boolean.TRUE.equals(user.getLocked())
                && user.getTenant() != null
                && user.getTenant().getId().equals(team.getTrainingClass().getTenantId())
                && user.getRoles().stream().anyMatch(role -> Boolean.TRUE.equals(role.getIsActive())
                        && "STUDENT".equals(role.getName()));
    }

}
