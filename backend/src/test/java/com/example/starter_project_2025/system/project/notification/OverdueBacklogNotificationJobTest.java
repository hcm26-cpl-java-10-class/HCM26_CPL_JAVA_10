package com.example.starter_project_2025.system.project.notification;

import com.example.starter_project_2025.system.notification.NotificationService;
import com.example.starter_project_2025.system.project.ProjectMember;
import com.example.starter_project_2025.system.project.ProjectMemberRepository;
import com.example.starter_project_2025.system.project.ProjectTeam;
import com.example.starter_project_2025.system.project.ProjectTeamStatus;
import com.example.starter_project_2025.system.project.sprint_backlog.SprintBacklog;
import com.example.starter_project_2025.system.project.sprint_backlog.SprintBacklogRepository;
import com.example.starter_project_2025.system.project.sprint_backlog.SprintBacklogStatus;
import com.example.starter_project_2025.system.project.workspace.domain.Workspace;
import com.example.starter_project_2025.system.project.workspace.repository.WorkspaceRepository;
import com.example.starter_project_2025.system.project.trainingclass.ClassMember;
import com.example.starter_project_2025.system.project.trainingclass.ClassMemberStatus;
import com.example.starter_project_2025.system.project.trainingclass.TrainingClass;
import com.example.starter_project_2025.system.project.tenant.Tenant;
import com.example.starter_project_2025.system.rbac.user.User;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.List;

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class OverdueBacklogNotificationJobTest {
    @Mock private SprintBacklogRepository backlogItems;
    @Mock private ProjectMemberRepository projectMembers;
    @Mock private WorkspaceRepository workspaces;
    @Mock private NotificationService notifications;

    @Test
    void notifiesTheActiveAssigneeOfOverdueOpenBacklogItem() {
        Instant instant = Instant.parse("2026-11-06T22:00:00Z");
        LocalDateTime now = LocalDateTime.ofInstant(instant, ZoneId.of("Asia/Ho_Chi_Minh"));
        LocalDateTime due = now.minusDays(1);
        SprintBacklog item = backlogItem(17L, 3L, due);
        ProjectMember assignee = activeMember(3L, 17L, 91L);
        Workspace workspace = mock(Workspace.class);
        when(workspace.getId()).thenReturn(27L);
        when(backlogItems.findAllByIsActiveTrueAndStatusInAndEndDateBeforeAndAssigneeProjectMemberIdIsNotNull(
                anyCollection(), eq(now))).thenReturn(List.of(item));
        when(projectMembers.findAllByIdIn(anyCollection())).thenReturn(List.of(assignee));
        when(workspaces.findCurrentByTeamId(6L)).thenReturn(java.util.Optional.of(workspace));

        job(instant).notifyAssigneesOfOverdueBacklogItems();

        verify(backlogItems).findAllByIsActiveTrueAndStatusInAndEndDateBeforeAndAssigneeProjectMemberIdIsNotNull(
                eq(List.of(SprintBacklogStatus.TODO, SprintBacklogStatus.IN_PROGRESS, SprintBacklogStatus.REVIEW)),
                eq(now));
        verify(notifications).createOnce(91L, "backlog-overdue:17:" + due + ":91",
                "Overdue backlog item",
                "Backlog item \"Prepare project report\" is overdue (due " + due + "). Please update its progress.",
                "/management/workspaces/27?tab=backlog&itemId=17&project=17");
    }

    @Test
    void skipsBacklogItemsWhoseAssigneeIsNoLongerEligible() {
        Instant instant = Instant.parse("2026-11-06T22:00:00Z");
        LocalDateTime now = LocalDateTime.ofInstant(instant, ZoneId.of("Asia/Ho_Chi_Minh"));
        when(backlogItems.findAllByIsActiveTrueAndStatusInAndEndDateBeforeAndAssigneeProjectMemberIdIsNotNull(
                anyCollection(), eq(now))).thenReturn(List.of(backlogItem(17L, 3L, now.minusDays(1))));
        when(projectMembers.findAllByIdIn(anyCollection())).thenReturn(List.of());

        job(instant).notifyAssigneesOfOverdueBacklogItems();

        verifyNoInteractions(notifications);
    }

    @Test
    void avoidsMemberLookupWhenThereAreNoOverdueAssignedBacklogItems() {
        Instant instant = Instant.parse("2026-11-06T22:00:00Z");
        LocalDateTime now = LocalDateTime.ofInstant(instant, ZoneId.of("Asia/Ho_Chi_Minh"));
        when(backlogItems.findAllByIsActiveTrueAndStatusInAndEndDateBeforeAndAssigneeProjectMemberIdIsNotNull(
                anyCollection(), eq(now))).thenReturn(List.of());

        job(instant).notifyAssigneesOfOverdueBacklogItems();

        verifyNoInteractions(projectMembers, workspaces, notifications);
    }

    private OverdueBacklogNotificationJob job(Instant instant) {
        return new OverdueBacklogNotificationJob(backlogItems, projectMembers, workspaces, notifications,
                Clock.fixed(instant, ZoneId.of("UTC")), ZoneId.of("Asia/Ho_Chi_Minh"));
    }

    private SprintBacklog backlogItem(Long id, Long assigneeId, LocalDateTime due) {
        return SprintBacklog.builder().id(id).projectId(17L).assigneeProjectMemberId(assigneeId)
                .title("Prepare project report").endDate(due).status(SprintBacklogStatus.IN_PROGRESS)
                .isActive(true).build();
    }

    private ProjectMember activeMember(Long id, Long projectId, Long userId) {
        TrainingClass trainingClass = mock(TrainingClass.class);
        when(trainingClass.getId()).thenReturn(5L);
        when(trainingClass.getTenantId()).thenReturn(8L);
        when(trainingClass.getIsActive()).thenReturn(true);

        User user = mock(User.class);
        when(user.getId()).thenReturn(userId);
        when(user.getTenantId()).thenReturn(8L);
        when(user.getIsActive()).thenReturn(true);
        when(user.getLocked()).thenReturn(false);
        Tenant tenant = mock(Tenant.class);
        when(tenant.getActive()).thenReturn(true);
        when(tenant.getIsActive()).thenReturn(true);
        when(user.getTenant()).thenReturn(tenant);

        ClassMember classMember = mock(ClassMember.class);
        when(classMember.getTrainingClass()).thenReturn(trainingClass);
        when(classMember.getUser()).thenReturn(user);
        when(classMember.getIsActive()).thenReturn(true);
        when(classMember.getStatus()).thenReturn(ClassMemberStatus.ACTIVE);

        ProjectTeam team = mock(ProjectTeam.class);
        when(team.getId()).thenReturn(6L);
        when(team.getProjectId()).thenReturn(projectId);
        when(team.getTrainingClass()).thenReturn(trainingClass);
        when(team.getIsActive()).thenReturn(true);
        when(team.getStatus()).thenReturn(ProjectTeamStatus.ACTIVE);

        ProjectMember member = mock(ProjectMember.class);
        when(member.getId()).thenReturn(id);
        when(member.getTeam()).thenReturn(team);
        when(member.getClassMember()).thenReturn(classMember);
        when(member.getIsActive()).thenReturn(true);
        return member;
    }
}
