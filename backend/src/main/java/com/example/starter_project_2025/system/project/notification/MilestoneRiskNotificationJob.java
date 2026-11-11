package com.example.starter_project_2025.system.project.notification;

import com.example.starter_project_2025.system.notification.NotificationService;
import com.example.starter_project_2025.system.project.ProjectMember;
import com.example.starter_project_2025.system.project.ProjectMemberRepository;
import com.example.starter_project_2025.system.project.ProjectTeamStatus;
import com.example.starter_project_2025.system.project.milestone.domain.Milestone;
import com.example.starter_project_2025.system.project.milestone.repository.MilestoneRepository;
import com.example.starter_project_2025.system.project.milestone.submission.repository.MilestoneSubmissionRepository;
import com.example.starter_project_2025.system.project.milestone.submission.repository.MilestoneWaiverRepository;
import com.example.starter_project_2025.system.project.sprint_backlog.SprintBacklogRepository;
import com.example.starter_project_2025.system.project.sprint_backlog.SprintBacklogStatus;
import com.example.starter_project_2025.system.project.task.TaskRepository;
import com.example.starter_project_2025.system.project.task.TaskStatus;
import com.example.starter_project_2025.system.project.trainingclass.ClassMemberStatus;
import com.example.starter_project_2025.system.rbac.user.User;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.time.Duration;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.List;
import java.util.Objects;
import java.util.UUID;

@Component
public class MilestoneRiskNotificationJob {
    private static final List<TaskStatus> UNFINISHED_TASK_STATUSES =
            List.of(TaskStatus.TODO, TaskStatus.IN_PROGRESS, TaskStatus.REVIEW);

    private final MilestoneRepository milestones;
    private final TaskRepository tasks;
    private final SprintBacklogRepository backlogItems;
    private final MilestoneSubmissionRepository submissions;
    private final MilestoneWaiverRepository waivers;
    private final ProjectMemberRepository projectMembers;
    private final NotificationService notifications;
    private final Clock clock;
    private final ZoneId backlogDeadlineZone;
    private final MilestoneRiskNotificationPolicy policy;
    @Value("${app.notification.milestone-warning-hours:48}")
    private long warningHours;

    public MilestoneRiskNotificationJob(MilestoneRepository milestones, TaskRepository tasks,
                                        SprintBacklogRepository backlogItems,
                                        MilestoneSubmissionRepository submissions,
                                        MilestoneWaiverRepository waivers,
                                        ProjectMemberRepository projectMembers,
                                        NotificationService notifications,
                                        @Qualifier("milestoneClock") Clock clock,
                                        @Qualifier("backlogDeadlineZone") ZoneId backlogDeadlineZone,
                                        MilestoneRiskNotificationPolicy policy) {
        this.milestones = milestones;
        this.tasks = tasks;
        this.backlogItems = backlogItems;
        this.submissions = submissions;
        this.waivers = waivers;
        this.projectMembers = projectMembers;
        this.notifications = notifications;
        this.clock = clock;
        this.backlogDeadlineZone = backlogDeadlineZone;
        this.policy = policy;
    }

    @Scheduled(fixedDelayString = "${app.notification.deadline-check-ms:60000}")
    @Transactional
    public void notifyTeamsOfAtRiskMilestones() {
        var now = clock.instant();
        var backlogNow = LocalDateTime.ofInstant(now, backlogDeadlineZone);
        if (warningHours < 1) throw new IllegalStateException("Milestone warning window must be at least one hour");

        for (Milestone milestone : milestones.findByActiveTrue()) {
            if (milestone.getDeadline() == null || milestone.getTeamId() == null) continue;

            var submission = submissions.findByMilestoneIdAndTeamId(milestone.getId(), milestone.getTeamId());
            boolean waived = waivers.existsByMilestoneIdAndTeamId(milestone.getId(), milestone.getTeamId());

            long overdueTasks = milestone.getProjectId() == null ? 0
                    : tasks.countByProjectIdAndMilestoneIdAndIsActiveTrueAndStatusInAndDeadlineBefore(
                    projectIdAlias(milestone.getProjectId()), milestone.getId(), UNFINISHED_TASK_STATUSES, now);
            long overdueBacklogs = backlogItems.countByMilestone_IdAndIsActiveTrueAndStatusNotAndEndDateBefore(
                    milestone.getId(), SprintBacklogStatus.DONE, backlogNow);
            List<String> reasons = policy.reasons(new MilestoneRiskNotificationPolicy.Facts(
                    milestone.getDeadline(), milestone.isMandatory(), waived, milestone.lifecycleStatus(),
                    submission.map(value -> value.getStatus()).orElse(null), overdueTasks + overdueBacklogs),
                    now, Duration.ofHours(warningHours));
            if (reasons.isEmpty()) continue;

            for (Long userId : activeTeamMemberUserIds(milestone)) {
                String eventKey = eventKey(milestone.getId(), milestone.getDeadline().toEpochMilli(), userId);
                String title = milestone.isMandatory()
                        ? "Priority risk: mandatory milestone"
                        : "Milestone at risk";
                String message = "Milestone \"" + milestone.getTitle() + "\": "
                        + String.join("; ", reasons) + ".";
                notifications.createOnce(userId, eventKey, title, message,
                        "/teams/" + milestone.getTeamId() + "/milestones/" + milestone.getId());
            }
        }
    }

    private List<Long> activeTeamMemberUserIds(Milestone milestone) {
        return projectMembers.findAllByTeam_IdOrderByIdAsc(milestone.getTeamId()).stream()
                .filter(member -> activeForMilestone(member, milestone))
                .map(member -> member.getClassMember().getUser().getId())
                .distinct()
                .toList();
    }

    private boolean activeForMilestone(ProjectMember member, Milestone milestone) {
        var team = member.getTeam();
        var classMember = member.getClassMember();
        User user = classMember.getUser();
        return Boolean.TRUE.equals(member.getIsActive())
                && team != null && Boolean.TRUE.equals(team.getIsActive())
                && team.getStatus() == ProjectTeamStatus.ACTIVE
                && team.getTrainingClass() != null
                && Boolean.TRUE.equals(team.getTrainingClass().getIsActive())
                && Objects.equals(team.getTrainingClass().getTenantId(), milestone.getTenantId())
                && classMember.getTrainingClass() != null
                && Objects.equals(classMember.getTrainingClass().getId(), team.getTrainingClass().getId())
                && Boolean.TRUE.equals(classMember.getIsActive())
                && classMember.getStatus() == ClassMemberStatus.ACTIVE
                && Boolean.TRUE.equals(user.getIsActive())
                && !Boolean.TRUE.equals(user.getLocked())
                && user.getTenant() != null
                && Objects.equals(user.getTenant().getId(), milestone.getTenantId())
                && Boolean.TRUE.equals(user.getTenant().getActive())
                && Boolean.TRUE.equals(user.getTenant().getIsActive())
                && user.getRoles().stream().anyMatch(role -> Boolean.TRUE.equals(role.getIsActive())
                        && ("STUDENT".equals(role.getName()) || "TRAINEE".equals(role.getName())));
    }

    private UUID projectIdAlias(Long projectId) {
        return UUID.nameUUIDFromBytes(("milestone:project:" + projectId)
                .getBytes(StandardCharsets.UTF_8));
    }

    private String eventKey(UUID milestoneId, long deadlineEpochMillis, Long userId) {
        return "milestone-risk:" + milestoneId + ":" + deadlineEpochMillis + ":" + userId;
    }
}
