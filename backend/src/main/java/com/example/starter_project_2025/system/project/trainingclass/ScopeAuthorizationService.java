package com.example.starter_project_2025.system.project.trainingclass;

import com.example.starter_project_2025.exception.ResourceNotFoundException;
import com.example.starter_project_2025.security.UserPrincipal;
import com.example.starter_project_2025.system.project.trainingclass.TrainingClass;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class ScopeAuthorizationService {

    private final UserDataScopeRepository userDataScopeRepository;
    private final ClassStaffAssignmentRepository classStaffAssignmentRepository;

    @Transactional(readOnly = true)
    public void assertCanManageClass(Authentication authentication, TrainingClass trainingClass) {
        if (!canManageClass(authentication, trainingClass)) {
            throw new AccessDeniedException("User is outside the class data scope");
        }
    }

    @Transactional(readOnly = true)
    public boolean canManageClass(
            Authentication authentication,
            TrainingClass trainingClass
    ) {
        return canManageClass(authentication, trainingClass, "PEO_TEAM_ALLOCATE");
    }

    @Transactional(readOnly = true)
    public void assertCanManageTeamMentor(
            Authentication authentication,
            TrainingClass trainingClass
    ) {
        if (!canManageClass(authentication, trainingClass,
                "PEO_TEAM_ALLOCATE", "PRJ_WORKSPACE_MANAGE")) {
            throw new AccessDeniedException("User is outside the class data scope");
        }
    }

    /** ADMIN is the legacy Program Manager persona and is limited to its tenant. */
    @Transactional(readOnly = true)
    public void assertCanSearchProjectTemplates(Authentication authentication, TrainingClass trainingClass) {
        if (authentication == null || !(authentication.getPrincipal() instanceof UserPrincipal principal)) {
            throw new AccessDeniedException("Template search is outside the class data scope");
        }
        boolean hasPermission = authentication.getAuthorities().stream().anyMatch(authority ->
                "PEO_TEAM_ALLOCATE".equals(authority.getAuthority())
                        || "PRJ_WORKSPACE_MANAGE".equals(authority.getAuthority()));
        Long tenantId = principal.getUser().getTenantId();
        Long userId = principal.getUser().getId();
        if (!hasPermission || tenantId == null || !tenantId.equals(trainingClass.getTenantId())) {
            throw new AccessDeniedException("Template search is outside the class data scope");
        }
        boolean tenantAdmin = authentication.getAuthorities().stream()
                .anyMatch(authority -> "ROLE_ADMIN".equals(authority.getAuthority()));
        if (tenantAdmin) return;
        boolean inScope = hasScope(userId, tenantId, UserScopeType.TENANT, tenantId)
                || hasScope(userId, tenantId, UserScopeType.PROGRAM, trainingClass.getProgramId())
                || (trainingClass.getCohortId() != null
                        && hasScope(userId, tenantId, UserScopeType.COHORT, trainingClass.getCohortId()))
                || hasScope(userId, tenantId, UserScopeType.CLASS, trainingClass.getId())
                || classStaffAssignmentRepository.existsByTrainingClass_IdAndUser_IdAndRoleTypeAndIsActiveTrue(
                        trainingClass.getId(), userId, ClassStaffRoleType.MENTOR)
                || classStaffAssignmentRepository.existsByTrainingClass_IdAndUser_IdAndRoleTypeAndIsActiveTrue(
                        trainingClass.getId(), userId, ClassStaffRoleType.PROGRAM_MANAGER);
        if (!inScope) throw new AccessDeniedException("Template search is outside the class data scope");
    }

    @Transactional(readOnly = true)
    public boolean canManageClass(
            Authentication authentication,
            TrainingClass trainingClass,
            String... acceptedPermissions
    ) {
        if (authentication == null || !(authentication.getPrincipal() instanceof UserPrincipal principal)) {
            return false;
        }

        boolean hasPermission = authentication.getAuthorities().stream()
                .anyMatch(authority ->
                        java.util.Arrays.asList(acceptedPermissions)
                                .contains(authority.getAuthority()));

        if (!hasPermission) {
            return false;
        }

        boolean isSystemAdmin = authentication.getAuthorities().stream()
                .anyMatch(authority ->
                        "ROLE_SUPER_ADMIN".equals(authority.getAuthority())
                                || "ROLE_ADMIN".equals(authority.getAuthority()));

        if (isSystemAdmin) {
            return true;
        }

        Long userId = principal.getUser().getId();
        Long tenantId = trainingClass.getTenantId();

        boolean hasDataScope =
                hasScope(userId, tenantId, UserScopeType.TENANT, tenantId)
                        || hasScope(userId, tenantId, UserScopeType.PROGRAM, trainingClass.getProgramId())
                        || (trainingClass.getCohortId() != null
                        && hasScope(userId, tenantId, UserScopeType.COHORT, trainingClass.getCohortId()))
                        || hasScope(userId, tenantId, UserScopeType.CLASS, trainingClass.getId());

        boolean assignedToClass =
                classStaffAssignmentRepository.existsByTrainingClass_IdAndUser_IdAndRoleTypeAndIsActiveTrue(
                        trainingClass.getId(), userId, ClassStaffRoleType.PROGRAM_MANAGER)
                        || classStaffAssignmentRepository.existsByTrainingClass_IdAndUser_IdAndRoleTypeAndIsActiveTrue(
                        trainingClass.getId(), userId, ClassStaffRoleType.CLASS_ADMIN)
                        || classStaffAssignmentRepository.existsByTrainingClass_IdAndUser_IdAndRoleTypeAndIsActiveTrue(
                        trainingClass.getId(), userId, ClassStaffRoleType.MENTOR);

        return hasDataScope || assignedToClass;
    }

    private boolean hasScope(
            Long userId,
            Long tenantId,
            UserScopeType scopeType,
            Long targetId
    ) {
        return userDataScopeRepository.existsByUser_IdAndTenantIdAndScopeTypeAndTargetIdAndIsActiveTrue(
                userId, tenantId, scopeType, targetId);
    }
}
