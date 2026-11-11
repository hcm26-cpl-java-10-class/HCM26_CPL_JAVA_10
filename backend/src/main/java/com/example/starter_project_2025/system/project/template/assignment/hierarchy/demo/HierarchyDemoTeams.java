package com.example.starter_project_2025.system.project.template.assignment.hierarchy.demo;

import com.example.starter_project_2025.system.project.*;
import com.example.starter_project_2025.system.project.tenant.Tenant;
import com.example.starter_project_2025.system.project.trainingclass.*;
import com.example.starter_project_2025.system.rbac.role.RoleRepository;
import com.example.starter_project_2025.system.rbac.user.User;
import com.example.starter_project_2025.system.rbac.user.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;

@Component
@RequiredArgsConstructor
public class HierarchyDemoTeams {
    public record Classroom(TrainingClass trainingClass, TeamAllocationSession session, List<ProjectTeam> teams) { }

    private static final List<String> DEMO_ROLES = List.of("PM", "BA", "DEV", "QA");
    private static final Map<String, List<String>> DEMO_STUDENT_NAMES = Map.of(
            "Auth", List.of("Nguyễn Minh Anh", "Trần Gia Bảo", "Lê Quang Huy", "Phạm Thu Hà"),
            "Payment", List.of("Võ Hoàng Nam", "Đặng Ngọc Linh", "Phan Đức Anh", "Bùi Thảo Vy"),
            "Catalog", List.of("Đỗ Hải Đăng", "Hồ Khánh Linh", "Ngô Tuấn Kiệt", "Dương Yến Nhi"),
            "Whole", List.of("Vũ Minh Khang", "Lý Bảo Trân", "Cao Nhật Minh", "Đinh Phương Thảo"),
            "Busy", List.of("Trương Gia Hưng", "Nguyễn Ngọc Mai", "Trần Quốc Bảo", "Lê Hải Yến"));

    private final UserRepository users;
    private final RoleRepository roles;
    private final PasswordEncoder passwords;
    private final TrainingClassRepository classes;
    private final ClassStaffAssignmentRepository staff;
    private final UserDataScopeRepository scopes;
    private final TeamAllocationSessionRepository sessions;
    private final ProjectTeamRepository teams;
    private final ClassMemberRepository classMembers;
    private final ProjectMemberRepository projectMembers;

    public User admin(Tenant tenant) {
        return user(tenant, "hier.admin@example.com", "Hierarchy", "Admin", List.of("ADMIN"), passwords.encode("Demo@123"));
    }

    public User mentor(Tenant tenant) {
        User mentor = user(tenant, "hier.mentor@example.com", "Hierarchy", "Mentor", List.of("TEACHER", "MENTOR"), passwords.encode("Demo@123"));
        if (!scopes.existsByUser_IdAndTenantIdAndScopeTypeAndTargetId(mentor.getId(), tenant.getId(), UserScopeType.TENANT, tenant.getId()))
            scopes.save(UserDataScope.builder().user(mentor).tenantId(tenant.getId()).scopeType(UserScopeType.TENANT).targetId(tenant.getId()).build());
        return mentor;
    }

    public Classroom classroom(Tenant tenant, User mentor, ProjectTemplate master, String code, String name,
                               String prefix, List<String> labels) {
        boolean ready = "ready".equals(prefix);
        TrainingClass trainingClass = classes.saveAndFlush(TrainingClass.builder()
                .tenantId(tenant.getId()).code(code).name(name)
                .programId(tenant.getId()).programName("Project Hierarchy Demo")
                .mentorId(mentor.getId()).status(TrainingClassStatus.ONGOING).build());
        staff.saveAndFlush(ClassStaffAssignment.builder().trainingClass(trainingClass).user(mentor).roleType(ClassStaffRoleType.MENTOR).build());
        TeamAllocationSession session = sessions.saveAndFlush(TeamAllocationSession.builder().trainingClass(trainingClass)
                .projectTemplate(master).maxMembers(8).status(TeamAllocationSessionStatus.OPEN).build());
        String password = passwords.encode("Demo@123");
        List<ProjectTeam> roster = new java.util.ArrayList<>();
        for (int index = 0; index < labels.size(); index++) {
            String label = labels.get(index);
            ProjectTeam team = teams.saveAndFlush(ProjectTeam.builder().trainingClass(trainingClass).allocationSession(session)
                    .teamName("Team 0" + (index + 1) + " - " + label + (ready ? " (ready)" : " (assigned)"))
                    .status(ProjectTeamStatus.DRAFT).assignedMentorId(mentor.getId()).maxMembers(8).build());
            List<String> studentNames = DEMO_STUDENT_NAMES.get(label);
            for (int roleIndex = 0; roleIndex < DEMO_ROLES.size(); roleIndex++) {
                String role = DEMO_ROLES.get(roleIndex);
                String studentName = studentNames.get(roleIndex);
                int separator = studentName.indexOf(' ');
                String email = "hier." + prefix + "." + label.toLowerCase(Locale.ROOT) + "." + role.toLowerCase(Locale.ROOT) + "@example.com";
                User student = user(tenant, email, studentName.substring(0, separator), studentName.substring(separator + 1),
                        List.of("STUDENT"), password);
                ClassMember member = classMembers.saveAndFlush(ClassMember.builder().trainingClass(trainingClass).user(student)
                        .status(ClassMemberStatus.ACTIVE).joinedAt(LocalDateTime.now()).build());
                projectMembers.saveAndFlush(ProjectMember.builder().team(team).classMember(member).role(role).build());
                if ("DEV".equals(role)) team.setLeaderMemberId(member.getId());
            }
            roster.add(teams.saveAndFlush(team));
        }
        return new Classroom(trainingClass, session, List.copyOf(roster));
    }

    private User user(Tenant tenant, String email, String first, String last, List<String> roleNames, String password) {
        var existing = users.findByEmail(email);
        if (existing.isPresent()) {
            if (!tenant.getId().equals(existing.get().getTenantId()))
                throw new IllegalStateException("The reserved hierarchy demo email belongs to another tenant: " + email);
            return existing.get();
        }
        return users.saveAndFlush(User.builder().email(email).firstName(first).lastName(last).tenant(tenant)
                .userCode(email.substring(0, email.indexOf('@')).replace('.', '-').toUpperCase(Locale.ROOT))
                .passwordHash(password).roles(new HashSet<>(roleNames.stream().map(name -> roles.findByName(name).orElseThrow()).toList())).build());
    }
}
