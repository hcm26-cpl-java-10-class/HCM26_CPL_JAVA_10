package com.example.starter_project_2025.system.project.template.assignment.hierarchy;

import com.example.starter_project_2025.system.project.ProjectRepository;
import com.example.starter_project_2025.system.project.domain.Project;
import com.example.starter_project_2025.system.project.trainingclass.ScopeAuthorizationService;
import com.example.starter_project_2025.system.project.trainingclass.TrainingClassRepository;
import com.example.starter_project_2025.system.project.workspace.service.WorkspaceAccessService;
import com.example.starter_project_2025.system.project.milestone.submission.domain.MilestoneSubmission;
import lombok.RequiredArgsConstructor;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashSet;
import java.util.Objects;
import java.util.Set;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class MasterProjectAccess {
    private final ProjectRepository projects;
    private final ProjectAssignmentRepository assignments;
    private final TrainingClassRepository classes;
    private final ScopeAuthorizationService classScope;
    private final WorkspaceAccessService access;

    public Project requireManagement(Long projectId) {
        var user = access.requireUser(false);
        access.requireTenant(user, false);
        var project = projects.findById(projectId).filter(value -> Boolean.TRUE.equals(value.getIsActive())
                && Objects.equals(value.getTenantId(), user.getTenantId()) && value.getParentProject() == null
                && value.getAssignmentId() != null).orElseThrow(this::denied);
        var assignment = assignments.findById(project.getAssignmentId())
                .filter(value -> value.getMode() == AssignmentDtos.Mode.SPLIT
                        && Objects.equals(value.getTenantId(), user.getTenantId())
                        && Objects.equals(value.getMasterProjectId(), projectId)
                        && Objects.equals(value.getClassId(), project.getClassId()))
                .orElseThrow(this::denied);
        var trainingClass = classes.findById(assignment.getClassId())
                .filter(value -> Boolean.TRUE.equals(value.getIsActive())
                        && Objects.equals(value.getTenantId(), user.getTenantId())).orElseThrow(this::denied);
        boolean staff = user.getRoles().stream().anyMatch(role -> Boolean.TRUE.equals(role.getIsActive())
                && Set.of("SUPER_ADMIN", "ADMIN", "PROGRAM_MANAGER", "MENTOR", "TEACHER", "TRAINER").contains(role.getName()));
        if (!staff || !access.permitted(user, "MILESTONE_WRITE") && !access.permitted(user, "PRJ_WORKSPACE_MANAGE")
                || !classScope.canManageClass(SecurityContextHolder.getContext().getAuthentication(), trainingClass,
                "MILESTONE_WRITE", "PRJ_WORKSPACE_MANAGE")) throw denied();
        return project;
    }

    public Project requireClassMaster(Long projectId) {
        var project = requireManagement(projectId);
        if (project.getTeamId() != null) throw denied();
        return project;
    }

    public boolean canManage(Long projectId) {
        try { requireManagement(projectId); return true; }
        catch (AccessDeniedException denied) { return false; }
    }

    public Specification<MilestoneSubmission> submissionVisibility() {
        Set<Long> allowed = new HashSet<>();
        try {
            var user = access.requireUser(false);
            projects.findByTenantIdAndIsActiveTrue(user.getTenantId()).stream()
                    .filter(value -> value.getTeamId() == null && value.getParentProject() == null
                            && value.getAssignmentId() != null && canManage(value.getId()))
                    .forEach(value -> allowed.add(value.getId()));
        } catch (AccessDeniedException | org.springframework.web.server.ResponseStatusException denied) { }
        return (root, query, cb) -> cb.or(cb.isNotNull(root.get("teamId")),
                allowed.isEmpty() ? cb.disjunction() : root.get("projectId").in(allowed));
    }

    private AccessDeniedException denied() {
        return new AccessDeniedException("Only authorized class staff can manage shared master milestones");
    }
}
