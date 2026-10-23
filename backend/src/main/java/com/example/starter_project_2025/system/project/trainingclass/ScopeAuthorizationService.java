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
        if (authentication == null || !(authentication.getPrincipal() instanceof UserPrincipal principal)) {
            return false;
        }

        boolean hasPermission = authentication.getAuthorities().stream()
                .anyMatch(authority ->
                        "PEO_TEAM_ALLOCATE".equals(authority.getAuthority()));

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
                classStaffAssignmentRepository.existsByTrainingClass_IdAndUser_IdAndRoleType(
                        trainingClass.getId(), userId, ClassStaffRoleType.PROGRAM_MANAGER)
                        || classStaffAssignmentRepository.existsByTrainingClass_IdAndUser_IdAndRoleType(
                        trainingClass.getId(), userId, ClassStaffRoleType.CLASS_ADMIN)
                        || classStaffAssignmentRepository.existsByTrainingClass_IdAndUser_IdAndRoleType(
                        trainingClass.getId(), userId, ClassStaffRoleType.MENTOR);

        return hasDataScope || assignedToClass;
    }

    private boolean hasScope(
            Long userId,
            Long tenantId,
            UserScopeType scopeType,
            Long targetId
    ) {
        return userDataScopeRepository.existsByUser_IdAndTenantIdAndScopeTypeAndTargetId(
                userId, tenantId, scopeType, targetId);
    }
}