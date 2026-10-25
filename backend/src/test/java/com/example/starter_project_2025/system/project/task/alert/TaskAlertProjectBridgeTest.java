package com.example.starter_project_2025.system.project.task.alert;

import com.example.starter_project_2025.system.project.domain.Project;
import com.example.starter_project_2025.system.project.team.TeamMemberRepository;
import com.example.starter_project_2025.system.project.team.TeamRepository;
import com.example.starter_project_2025.system.project.tenant.Tenant;

import com.example.starter_project_2025.system.project.*;
import com.example.starter_project_2025.system.project.task.Task;
import com.example.starter_project_2025.system.project.trainingclass.*;
import com.example.starter_project_2025.system.rbac.user.*;
import org.junit.jupiter.api.Test;
import java.util.*;
import static org.mockito.Mockito.*;
import static org.assertj.core.api.Assertions.*;

class TaskAlertProjectBridgeTest {
    @Test void projectMemberSourceUsesRealRosterAndOnlyItsOwnTeamLeader() {
        var users = mock(UserRepository.class); var projects = mock(ProjectRepository.class);
        var teams = mock(TeamRepository.class); var teamMembers = mock(TeamMemberRepository.class);
        var projectTeams = mock(ProjectTeamRepository.class); var projectMembers = mock(ProjectMemberRepository.class);
        var projectLinks = mock(TaskAlertProjectLinkRepository.class); var memberLinks = mock(TaskAlertMemberLinkRepository.class);
        var bridge = new TaskAlertProjectBridge(users, projects, teams, teamMembers, projectTeams, projectMembers, projectLinks, memberLinks);
        var tenant = new Tenant(); tenant.setId(1L); tenant.setActive(true);
        var project = new Project(); project.setId(10L); project.setTenant(tenant);
        UUID projectAlias = UUID.randomUUID(), memberAlias = UUID.randomUUID();
        var link = new TaskAlertData.ProjectLink(); link.setId(projectAlias); link.setProjectId(10L); link.setTenantId(1L);
        when(projectLinks.findById(projectAlias)).thenReturn(Optional.of(link));
        when(projects.findById(10L)).thenReturn(Optional.of(project));
        var actor = new User(); actor.setId(20L); actor.setTenant(tenant); actor.setRoles(new HashSet<>());
        var target = new User(); target.setId(21L); target.setTenant(tenant);
        var training = new TrainingClass(); training.setId(30L); training.setTenantId(1L);
        var team = new ProjectTeam(); team.setId(40L); team.setProjectId(10L); team.setStatus(ProjectTeamStatus.ACTIVE); team.setTrainingClass(training);
        var targetClass = new ClassMember(); targetClass.setId(50L); targetClass.setUser(target); targetClass.setTrainingClass(training); targetClass.setStatus(ClassMemberStatus.ACTIVE);
        var actorClass = new ClassMember(); actorClass.setId(51L); actorClass.setUser(actor); actorClass.setTrainingClass(training); actorClass.setStatus(ClassMemberStatus.ACTIVE);
        var member = new ProjectMember(); member.setId(60L); member.setTeam(team); member.setClassMember(targetClass);
        var leader = new ProjectMember(); leader.setId(61L); leader.setTeam(team); leader.setClassMember(actorClass); leader.setRole("TEAM_LEADER");
        var memberLink = new TaskAlertData.MemberLink(); memberLink.setId(memberAlias); memberLink.setProjectId(projectAlias);
        memberLink.setSource(TaskAlertData.MemberSource.PROJECT_MEMBER); memberLink.setSourceMemberId(60L);
        when(memberLinks.findById(memberAlias)).thenReturn(Optional.of(memberLink));
        when(projectMembers.findById(60L)).thenReturn(Optional.of(member));
        when(projectMembers.findAllByTeam_IdOrderByIdAsc(40L)).thenReturn(List.of(member, leader));
        Task task = Task.builder().projectId(projectAlias).assigneeProjectMemberId(memberAlias).build();
        assertThat(bridge.findMemberUserId(projectAlias, memberAlias)).contains(21L);
        assertThat(bridge.canSend(actor, task)).isTrue();
        leader.setRole("DEV");
        assertThat(bridge.canSend(actor, task)).isFalse();
        leader.setRole("TEAM_LEADER");
        targetClass.setStatus(ClassMemberStatus.INACTIVE);
        assertThat(bridge.findMemberUserId(projectAlias, memberAlias)).isEmpty();
        // The current leader retains scope, so send() can return a batch conflict
        // for the inactive recipient rather than misreporting a permission failure.
        assertThat(bridge.canRead(actor, task)).isTrue();
        assertThat(bridge.canSend(actor, task)).isTrue();
        leader.setRole("DEV");
        assertThat(bridge.canSend(actor, task)).isFalse();
    }
}
