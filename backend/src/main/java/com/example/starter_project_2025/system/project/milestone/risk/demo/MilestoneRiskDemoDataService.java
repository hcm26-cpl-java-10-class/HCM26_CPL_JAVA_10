package com.example.starter_project_2025.system.project.milestone.risk.demo;
import com.example.starter_project_2025.system.project.milestone.domain.*;
import com.example.starter_project_2025.system.project.milestone.repository.MilestoneRepository;
import com.example.starter_project_2025.system.project.milestone.integration.mock.MockMilestoneData;
import com.example.starter_project_2025.system.project.milestone.risk.MilestoneRiskIdentity;
import com.example.starter_project_2025.system.project.task.*;
import com.example.starter_project_2025.system.project.task.alert.*;
import com.example.starter_project_2025.system.project.task.alert.demo.TaskAlertDemoDatasetRepository;
import com.example.starter_project_2025.system.rbac.user.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.*;
import java.util.UUID;
@Service @RequiredArgsConstructor
public class MilestoneRiskDemoDataService {
    private final TaskAlertDemoDatasetRepository taskDatasets;
    private final MilestoneRiskDemoDatasetRepository datasets;
    private final MilestoneRepository milestones;
    private final TaskRepository tasks;
    private final TaskAlertMemberLinkRepository memberLinks;
    private final UserRepository users;
    private final Clock milestoneClock;
    @Value("${app.seed.admin.email:admin@example.com}") private String adminEmail;
    @Transactional public void seed() {
        var admin = users.findByEmail(adminEmail).orElseThrow();
        if (admin.getTenant() == null || datasets.existsById(admin.getTenant().getId())) return;
        var source = taskDatasets.findById(admin.getTenant().getId()).orElse(null);
        if (source == null) return;
        UUID projectId = source.getTaskProjectId();
        var assignee = memberLinks.findByProjectId(projectId).stream().findFirst().orElseThrow();
        Instant now = milestoneClock.instant();
        UUID tenant = MilestoneRiskIdentity.tenant(admin.getTenant().getId()), actor = MilestoneRiskIdentity.actor(admin.getId());
        sample(tenant, projectId, actor, admin.getId(), assignee.getId(), "MVP delivery at risk", now.plus(Duration.ofHours(24)), true, 1, 2, now);
        sample(tenant, projectId, actor, admin.getId(), assignee.getId(), "No tasks planned", now.plus(Duration.ofHours(12)), true, 0, 0, now);
        sample(tenant, projectId, actor, admin.getId(), assignee.getId(), "Completion target met", now.plus(Duration.ofHours(24)), true, 4, 5, now);
        sample(tenant, projectId, actor, admin.getId(), assignee.getId(), "Outside warning window", now.plus(Duration.ofHours(72)), true, 0, 1, now);
        sample(tenant, projectId, actor, admin.getId(), assignee.getId(), "Deadline already passed", now.minus(Duration.ofHours(2)), true, 0, 1, now);
        sample(tenant, projectId, actor, admin.getId(), assignee.getId(), "Awaiting kickoff", now.plus(Duration.ofHours(24)), false, 0, 1, now);
        var marker = new MilestoneRiskDemoDataset(); marker.setTenantId(admin.getTenant().getId()); datasets.save(marker);
    }
    private void sample(UUID tenant, UUID project, UUID actor, Long actorId, UUID assignee, String title,
            Instant deadline, boolean open, int done, int total, Instant now) {
        Milestone milestone = Milestone.create(tenant, project, title, "Local milestone risk scenario: " + title,
                deadline, true, MockMilestoneData.RUBRIC_ID, null, LatePolicyType.NO_LATE, null, null, actor, now);
        if (open) milestone.openForWork(actor, now);
        milestones.saveAndFlush(milestone);
        for (int i=0; i<total; i++) tasks.save(Task.builder().projectId(project).milestoneId(milestone.getId())
                .title(title + " - task " + (i+1)).assigneeProjectMemberId(assignee)
                .status(i<done ? TaskStatus.DONE : TaskStatus.TODO).createdBy(actorId).updatedBy(actorId).build());
    }
}
