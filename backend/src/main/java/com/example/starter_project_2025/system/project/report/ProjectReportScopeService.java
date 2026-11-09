package com.example.starter_project_2025.system.project.report;

import com.example.starter_project_2025.security.UserPrincipal;
import com.example.starter_project_2025.system.project.ProjectTeam;
import com.example.starter_project_2025.system.project.trainingclass.ClassStaffRoleType;
import com.example.starter_project_2025.system.project.trainingclass.UserScopeType;
import com.example.starter_project_2025.system.project.tenant.TenantRepository;
import com.example.starter_project_2025.system.rbac.user.User;
import com.example.starter_project_2025.system.rbac.user.UserRepository;
import jakarta.persistence.EntityManager;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.AuthenticationCredentialsNotFoundException;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class ProjectReportScopeService {
    public static final String READ = "PROJECT_REPORT_READ";
    public static final String EXPORT = "PROJECT_REPORT_EXPORT";
    public record Actor(Long id, Long tenantId, boolean tenantAdmin, boolean manager, boolean canExport) { }
    private final UserRepository users;
    private final TenantRepository tenants;
    private final EntityManager em;

    public Actor current(String permission) {
        var authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !authentication.isAuthenticated()
                || !(authentication.getPrincipal() instanceof UserPrincipal principal))
            throw new AuthenticationCredentialsNotFoundException("Please sign in");
        return actor(principal.getUser().getId(), permission);
    }

    public Actor actor(Long id, String permission) {
        User user = users.findById(id).orElseThrow(() -> new AccessDeniedException("Account is unavailable"));
        if (!Boolean.TRUE.equals(user.getIsActive()) || Boolean.TRUE.equals(user.getLocked()) || user.getTenantId() == null)
            throw new AccessDeniedException("Report access is unavailable");
        var tenant = tenants.findById(user.getTenantId()).orElseThrow(() -> new AccessDeniedException("Tenant is unavailable"));
        if (!Boolean.TRUE.equals(tenant.getActive()) || !Boolean.TRUE.equals(tenant.getIsActive()))
            throw new AccessDeniedException("Tenant is inactive");
        Set<String> granted = user.getRoles().stream().filter(role -> Boolean.TRUE.equals(role.getIsActive()))
                .flatMap(role -> role.getPermissions().stream()).filter(p -> Boolean.TRUE.equals(p.getIsActive()))
                .map(p -> p.getName()).collect(Collectors.toSet());
        if (!granted.contains(READ) || !granted.contains(permission)) throw new AccessDeniedException("Report permission is required");
        Set<String> names = user.getRoles().stream().filter(role -> Boolean.TRUE.equals(role.getIsActive()))
                .map(role -> role.getName()).collect(Collectors.toSet());
        boolean admin = names.stream().anyMatch(Set.of("ADMIN","ADMINISTRATOR","SYSTEM_ADMIN","SUPER_ADMIN","SCHOOL_ADMIN")::contains);
        boolean mentor = names.stream().anyMatch(Set.of("MENTOR","TEACHER","TRAINER")::contains);
        boolean manager = admin || !mentor || names.contains("PROGRAM_MANAGER") || names.contains("CLASS_ADMIN");
        return new Actor(user.getId(), user.getTenantId(), admin, manager, granted.contains(EXPORT));
    }

    public List<ProjectTeam> teams(Actor actor) {
        // A Mentor's class-wide assignment does not grant access to other teams in that class.
        return em.createQuery("select distinct t from ProjectTeam t join fetch t.trainingClass c join fetch t.project p "
                + "left join fetch t.projectTemplate tpl where t.isActive=true "
                + "and c.isActive=true and p.isActive=true and c.tenantId=:tenant and p.tenantId=:tenant "
                + "and t.allocationSession.status<>com.example.starter_project_2025.system.project.TeamAllocationSessionStatus.CANCELLED "
                + "and (tpl.id is null or tpl.tenantId is null or tpl.tenantId=:tenant) "
                + "and (:admin=true or t.assignedMentorId=:actor or (:manager=true and ("
                + "exists(select s.id from UserDataScope s where s.user.id=:actor and s.tenantId=:tenant and s.isActive=true and ("
                + "(s.scopeType=:tenantScope and s.targetId=:tenant) or (s.scopeType=:programScope and s.targetId=c.programId) "
                + "or (s.scopeType=:cohortScope and s.targetId=c.cohortId) or (s.scopeType=:classScope and s.targetId=c.id))) "
                + "or exists(select a.id from ClassStaffAssignment a where a.trainingClass.id=c.id and a.user.id=:actor "
                + "and a.isActive=true and a.roleType in :staffRoles)))) order by c.name,t.id", ProjectTeam.class)
                .setParameter("tenant",actor.tenantId()).setParameter("actor",actor.id()).setParameter("admin",actor.tenantAdmin())
                .setParameter("manager",actor.manager()).setParameter("tenantScope",UserScopeType.TENANT)
                .setParameter("programScope",UserScopeType.PROGRAM).setParameter("cohortScope",UserScopeType.COHORT)
                .setParameter("classScope",UserScopeType.CLASS)
                .setParameter("staffRoles",Set.of(ClassStaffRoleType.PROGRAM_MANAGER,ClassStaffRoleType.CLASS_ADMIN)).getResultList();
    }
}
