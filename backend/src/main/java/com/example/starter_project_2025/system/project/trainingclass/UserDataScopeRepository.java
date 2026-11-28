package com.example.starter_project_2025.system.project.trainingclass;

import com.example.starter_project_2025.base.crud.domain.BaseCrudRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface UserDataScopeRepository
        extends BaseCrudRepository<UserDataScope, Long> {

    boolean existsByUser_IdAndTenantIdAndScopeTypeAndTargetIdAndIsActiveTrue(
            Long userId, Long tenantId, UserScopeType scopeType, Long targetId);

    boolean existsByUser_IdAndTenantIdAndScopeTypeAndTargetId(
            Long userId,
            Long tenantId,
            UserScopeType scopeType,
            Long targetId
    );
}
