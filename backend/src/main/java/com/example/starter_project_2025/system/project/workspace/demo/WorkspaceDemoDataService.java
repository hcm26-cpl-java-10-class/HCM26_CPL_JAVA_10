package com.example.starter_project_2025.system.project.workspace.demo;

import com.example.starter_project_2025.system.project.ProjectRepository;
import com.example.starter_project_2025.system.project.ProjectMemberRepository;
import com.example.starter_project_2025.system.project.ProjectMember;
import com.example.starter_project_2025.system.project.ProjectTeam;
import com.example.starter_project_2025.system.project.ProjectTeamRepository;
import com.example.starter_project_2025.system.project.TeamAllocationSession;
import com.example.starter_project_2025.system.project.TeamAllocationSessionRepository;
import com.example.starter_project_2025.system.project.TeamAllocationSessionStatus;
import com.example.starter_project_2025.system.project.ProjectTeamStatus;

import com.example.starter_project_2025.system.project.cohort.Cohort;
import com.example.starter_project_2025.system.project.cohort.CohortRepository;
import com.example.starter_project_2025.system.project.cohort.CohortStatus;
import com.example.starter_project_2025.system.project.domain.Project;
import com.example.starter_project_2025.system.project.domain.ProjectStatus;
import com.example.starter_project_2025.system.project.domain.ProjectTopicSnapshot;
import com.example.starter_project_2025.system.project.team.ParticipationStatus;
import com.example.starter_project_2025.system.project.team.Team;
import com.example.starter_project_2025.system.project.team.TeamMember;
import com.example.starter_project_2025.system.project.team.TeamMemberRepository;
import com.example.starter_project_2025.system.project.team.TeamRepository;
import com.example.starter_project_2025.system.project.tenant.Tenant;
import com.example.starter_project_2025.system.project.workspace.dto.WorkspaceCreateRequest;
import com.example.starter_project_2025.system.project.workspace.repository.ProjectTopicSnapshotRepository;
import com.example.starter_project_2025.system.project.workspace.repository.WorkspaceRepository;
import com.example.starter_project_2025.system.project.workspace.service.WorkspaceCreationTransaction;

import com.example.starter_project_2025.security.UserPrincipal;
import com.example.starter_project_2025.system.project.trainingclass.ClassMember;
import com.example.starter_project_2025.system.project.trainingclass.ClassMemberRepository;
import com.example.starter_project_2025.system.project.trainingclass.ClassMemberStatus;
import com.example.starter_project_2025.system.project.trainingclass.ClassStaffAssignment;
import com.example.starter_project_2025.system.project.trainingclass.ClassStaffAssignmentRepository;
import com.example.starter_project_2025.system.project.trainingclass.ClassStaffRoleType;
import com.example.starter_project_2025.system.project.trainingclass.TrainingClass;
import com.example.starter_project_2025.system.project.trainingclass.TrainingClassRepository;
import com.example.starter_project_2025.system.project.trainingclass.TrainingClassStatus;
import com.example.starter_project_2025.system.rbac.user.User;
import com.example.starter_project_2025.system.rbac.user.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

/** Local Workspace fixtures are built from the same ProjectTeam records as team allocation. */
@Service
@RequiredArgsConstructor
public class WorkspaceDemoDataService {
    private static final String CLASS_CODE = "WS-DEMO-CLASS";

    private final UserRepository users;
    private final CohortRepository cohorts;
    private final ProjectRepository projects;
    private final ProjectTeamRepository projectTeams;
    private final ProjectMemberRepository projectMembers;
    private final TeamAllocationSessionRepository sessions;
    private final ClassMemberRepository classMembers;
    private final ClassStaffAssignmentRepository classStaff;
    private final TrainingClassRepository trainingClasses;
    private final WorkspaceRepository workspaces;
    private final ProjectTopicSnapshotRepository snapshots;
    private final WorkspaceCreationTransaction creation;
    private final WorkspaceDemoResetService reset;
    @Value("${app.seed.admin.email:admin@example.com}") private String adminEmail;

    @Transactional
    public void seed() {
        User admin = users.findByEmail(adminEmail).orElseThrow();
        Tenant tenant = admin.getTenant();
        if (tenant == null || !Boolean.TRUE.equals(tenant.getActive()) || !Boolean.TRUE.equals(tenant.getIsActive())) {
            return;
        }
        reset.resetIfOutdated(tenant.getId());
        admin = users.findByEmail(adminEmail).orElseThrow();
        tenant = admin.getTenant();
        User teacher = existingUser("teacher@example.com", tenant);
        User student = existingUser("student@example.com", tenant);

        Cohort cohort = cohort(tenant);
        TrainingClass trainingClass = trainingClass(tenant, cohort, teacher);
        ensureClassMentor(trainingClass, teacher);
        TeamAllocationSession session = allocationSession(trainingClass);
        ClassMember adminMember = classMember(trainingClass, admin);
        ClassMember teacherMember = classMember(trainingClass, teacher);
        ClassMember studentMember = classMember(trainingClass, student);

        Project planning = project("WS-DEMO-PLANNING", "Campus Service Portal", ProjectStatus.PLANNING, tenant, cohort);
        Project active = project("WS-DEMO-ACTIVE", "Learning Resource Hub", ProjectStatus.ACTIVE, tenant, cohort);
        Project existing = project("WS-DEMO-EXISTING", "Student Support Portal", ProjectStatus.ACTIVE, tenant, cohort);
        Project completed = project("WS-DEMO-COMPLETED", "Completed Project", ProjectStatus.COMPLETED, tenant, cohort);
        snapshot(active);
        snapshot(existing);

        ensureTeam(session, trainingClass, "Team Atlas", null, teacher.getId(), List.of(studentMember));
        ensureTeam(session, trainingClass, "Team Nova", active, teacher.getId(), List.of(adminMember));
        ProjectTeam existingTeam = ensureTeam(
                session, trainingClass, "Team Pixel", existing, teacher.getId(), List.of(studentMember));
        ensureTeam(session, trainingClass, "Team Completed", completed, null, List.of(adminMember));
        ensureTeam(session, trainingClass, "Team Horizon", null, teacher.getId(), List.of());
        ensureWorkspace(admin, existingTeam, existing);
        reset.markCurrent(tenant.getId());
    }

    private User existingUser(String email, Tenant tenant) {
        User user = users.findByEmail(email).orElseThrow(() ->
                new IllegalStateException("The existing student/teacher account is required for workspace fixtures."));
        if (user.getTenant() == null || !user.getTenant().getId().equals(tenant.getId())) {
            throw new IllegalStateException("The existing student/teacher account belongs to another tenant.");
        }
        return user;
    }

    private Cohort cohort(Tenant tenant) {
        return cohorts.findByCodeAndTenantId("WS-DEMO-COHORT-A", tenant.getId()).orElseGet(() -> {
            Cohort cohort = new Cohort();
            cohort.setCode("WS-DEMO-COHORT-A");
            cohort.setName("SE18A - Fall 2026");
            cohort.setTenant(tenant);
            cohort.setStatus(CohortStatus.ACTIVE);
            return cohorts.save(cohort);
        });
    }

    private TrainingClass trainingClass(Tenant tenant, Cohort cohort, User mentor) {
        TrainingClass trainingClass = trainingClasses.findByCodeAndTenantId(CLASS_CODE, tenant.getId())
                .orElseGet(() -> trainingClasses.saveAndFlush(TrainingClass.builder()
                        .code(CLASS_CODE)
                        .name("Workspace Demo Class")
                        .tenantId(tenant.getId())
                        .programId(tenant.getId())
                        .programName("Workspace Demo Program")
                        .cohortId(cohort.getId())
                        .cohortName(cohort.getName())
                        .status(TrainingClassStatus.ONGOING)
                        .build()));
        if (trainingClass.getMentorId() == null) {
            trainingClass.setMentorId(mentor.getId());
            trainingClass = trainingClasses.saveAndFlush(trainingClass);
        }
        return trainingClass;
    }

    /** Sample class-level mentor so the allocation screens have a default mentor option. */
    private void ensureClassMentor(TrainingClass trainingClass, User mentor) {
        ClassStaffAssignment assignment = classStaff
                .findByTrainingClass_IdAndUser_IdAndRoleType(
                        trainingClass.getId(), mentor.getId(), ClassStaffRoleType.MENTOR)
                .orElseGet(() -> ClassStaffAssignment.builder()
                        .trainingClass(trainingClass)
                        .user(mentor)
                        .roleType(ClassStaffRoleType.MENTOR)
                        .build());
        assignment.setIsActive(true);
        classStaff.save(assignment);
    }

    private TeamAllocationSession allocationSession(TrainingClass trainingClass) {
        return sessions.findFirstByTrainingClass_IdOrderByIdAsc(trainingClass.getId()).orElseGet(() ->
                sessions.save(TeamAllocationSession.builder()
                        .trainingClass(trainingClass)
                        .maxMembers(5)
                        .status(TeamAllocationSessionStatus.OPEN)
                        .build()));
    }

    private ClassMember classMember(TrainingClass trainingClass, User user) {
        return classMembers.findByTrainingClass_IdAndUser_Id(trainingClass.getId(), user.getId())
                .orElseGet(() -> classMembers.save(ClassMember.builder()
                        .trainingClass(trainingClass)
                        .user(user)
                        .status(ClassMemberStatus.ACTIVE)
                        .joinedAt(LocalDateTime.now())
                        .build()));
    }

    private ProjectTeam ensureTeam(
            TeamAllocationSession session,
            TrainingClass trainingClass,
            String name,
            Project project,
            Long mentorId,
            List<ClassMember> roster
    ) {
        ProjectTeam team = projectTeams.findByTrainingClass_IdAndTeamName(
                        trainingClass.getId(), name)
                .orElseGet(() -> projectTeams.save(ProjectTeam.builder()
                        .trainingClass(trainingClass)
                        .allocationSession(session)
                        .teamName(name)
                        .maxMembers(session.getMaxMembers())
                        .status(ProjectTeamStatus.ACTIVE)
                        .build()));
        team.setAssignedMentorId(mentorId);
        if (team.getProject() == null && project != null) {
            team.setProject(project);
        }
        for (ClassMember member : roster) {
            if (!projectMembers.existsByTeam_IdAndClassMember_Id(team.getId(), member.getId())) {
                projectMembers.save(ProjectMember.builder()
                        .team(team)
                        .classMember(member)
                        .role("UNASSIGNED")
                        .build());
            }
        }
        return projectTeams.save(team);
    }

    private Project project(String code, String name, ProjectStatus status, Tenant tenant, Cohort cohort) {
        return projects.findByCodeAndTenantId(code, tenant.getId()).orElseGet(() -> {
            Project project = new Project();
            project.setCode(code);
            project.setName(name);
            project.setStatus(status);
            project.setTenant(tenant);
            project.setCohort(cohort);
            project.setDescription("Project for workspace acceptance: " + name + ".");
            return projects.save(project);
        });
    }

    private void snapshot(Project project) {
        if (snapshots.findByProjectId(project.getId()).isPresent()) {
            return;
        }
        snapshots.save(ProjectTopicSnapshot.builder()
                .project(project)
                .topicCode("TOPIC-" + project.getCode())
                .topicTitle(project.getName())
                .version("v1.0.0")
                .description(project.getDescription())
                .objectives("Deliver a working project through shared planning, implementation and review.")
                .requirementsJson("[\"Implement the agreed core user journeys.\",\"Include test evidence and setup documentation.\"]")
                .attachmentsJson("[]")
                .build());
    }

    private void ensureWorkspace(User admin, ProjectTeam team, Project project) {
        if (workspaces.findFirstByTeamIdOrderByIdAsc(team.getId()).isPresent()) {
            return;
        }
        var previous = SecurityContextHolder.getContext();
        var context = SecurityContextHolder.createEmptyContext();
        var principal = UserPrincipal.fromUser(admin);
        context.setAuthentication(new UsernamePasswordAuthenticationToken(
                principal, null, principal.getAuthorities()));
        try {
            SecurityContextHolder.setContext(context);
            creation.create("workspace-demo-existing-" + team.getId(),
                    new WorkspaceCreateRequest(project.getId(), team.getId()), "workspace-demo-seed");
        } finally {
            SecurityContextHolder.setContext(previous);
        }
    }
}
