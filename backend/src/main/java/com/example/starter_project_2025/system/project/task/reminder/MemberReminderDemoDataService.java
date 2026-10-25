package com.example.starter_project_2025.system.project.task.reminder;
import com.example.starter_project_2025.system.project.*;
import com.example.starter_project_2025.system.project.task.*;
import com.example.starter_project_2025.system.project.task.alert.*;
import com.example.starter_project_2025.system.rbac.user.*;
import org.springframework.beans.factory.annotation.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.*;
import java.util.*;
@Service
public class MemberReminderDemoDataService {
    public static final String PROJECT_CODE="MEMBER-REMINDER-DEMO";
    private final UserRepository users;
    private final ProjectRepository projects;
    private final TeamRepository teams;
    private final TeamMemberRepository members;
    private final TaskRepository tasks;
    private final TaskAlertProjectLinkRepository projectLinks;
    private final TaskAlertMemberLinkRepository memberLinks;
    private final MemberReminderDemoDatasetRepository datasets;
    private final Clock clock;
    private final String adminEmail;
    public MemberReminderDemoDataService(UserRepository users,ProjectRepository projects,TeamRepository teams,TeamMemberRepository members,
            TaskRepository tasks,TaskAlertProjectLinkRepository projectLinks,TaskAlertMemberLinkRepository memberLinks,
            MemberReminderDemoDatasetRepository datasets,@Qualifier("memberReminderClock") Clock clock,
            @Value("${app.seed.admin.email:admin@example.com}") String adminEmail){
        this.users=users;this.projects=projects;this.teams=teams;this.members=members;this.tasks=tasks;this.projectLinks=projectLinks;
        this.memberLinks=memberLinks;this.datasets=datasets;this.clock=clock;this.adminEmail=adminEmail;
    }
    @Transactional public void seed(){
        User admin=users.findByEmail(adminEmail).orElseThrow(()->new IllegalStateException("An existing admin account is required"));
        var tenant=admin.getTenant();
        if(tenant==null||datasets.existsById(tenant.getId())||!Boolean.TRUE.equals(tenant.getActive())||!Boolean.TRUE.equals(tenant.getIsActive()))return;
        User teacher=account("teacher@example.com",tenant),student=account("student@example.com",tenant);
        if(projects.findByCodeAndTenantId(PROJECT_CODE,tenant.getId()).isPresent())
            throw new IllegalStateException("An unmarked reminder demo project already exists; it will not be reset");
        Project project=new Project();project.setCode(PROJECT_CODE);project.setName("Member Reminder Demo");
        project.setDescription("Local inactivity and cooldown scenario using the existing teacher/student accounts.");
        project.setStatus(ProjectStatus.ACTIVE);project.setTenant(tenant);projects.saveAndFlush(project);
        Team team=new Team();team.setCode("MEMBER-REMINDER-DEMO-TEAM");team.setName("Member Reminder Team");
        team.setProject(project);team.setTenant(tenant);team.setMentor(teacher);teams.saveAndFlush(team);
        TeamMember member=new TeamMember();member.setTeam(team);member.setUser(student);member.setProjectRole(ProjectRole.DEV);
        member.setJoinedAt(clock.instant().minus(Duration.ofDays(8)));members.saveAndFlush(member);
        UUID projectId=UUID.randomUUID(),memberId=UUID.randomUUID();
        var link=new TaskAlertData.ProjectLink();link.setId(projectId);link.setProjectId(project.getId());link.setTenantId(tenant.getId());projectLinks.saveAndFlush(link);
        var ml=new TaskAlertData.MemberLink();ml.setId(memberId);ml.setProjectId(projectId);ml.setSource(TaskAlertData.MemberSource.TEAM_MEMBER);
        ml.setSourceMemberId(member.getId());memberLinks.saveAndFlush(ml);
        tasks.save(Task.builder().projectId(projectId).assigneeProjectMemberId(memberId).title("Resume the integration task")
                .description("The student joined this demo team eight days ago. Change this task status as the student to record a contribution.")
                .status(TaskStatus.TODO).createdBy(admin.getId()).updatedBy(admin.getId()).build());
        var marker=new MemberReminderData.DemoDataset();marker.setTenantId(tenant.getId());marker.setProjectId(projectId);datasets.save(marker);
    }
    private User account(String email,Tenant tenant){
        var user=users.findByEmail(email).orElseThrow(()->new IllegalStateException("Existing student/teacher accounts are required"));
        if(user.getTenant()==null||!tenant.getId().equals(user.getTenant().getId())||!Boolean.TRUE.equals(user.getIsActive())||Boolean.TRUE.equals(user.getLocked()))
            throw new IllegalStateException("Existing demo accounts must be active in the same tenant");
        return user;
    }
}
