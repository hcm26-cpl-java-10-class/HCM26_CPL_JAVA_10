package com.example.starter_project_2025.system.rbac.user;

import com.example.starter_project_2025.base.crud.domain.BaseCrudRepository;
import com.example.starter_project_2025.system.demo.department.DepartmentMemberDTO;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface UserRepository extends BaseCrudRepository<User, Long> {
    @org.springframework.data.jpa.repository.Lock(jakarta.persistence.LockModeType.PESSIMISTIC_WRITE)
    @Query("select u from User u where u.id in :ids order by u.id")
    List<User> lockForContribution(@Param("ids") java.util.Collection<Long> ids);

    Optional<User> findByEmail(String email);

    List<User> findByEmailEndingWithIgnoreCase(String emailSuffix);

    List<User> findByTenantIdAndIsActiveTrue(Long tenantId);

    Optional<User> findByIdAndIsActiveTrue(Long id);

    boolean existsByEmail(String email);

    boolean existsByUserCode(String userCode);

    Optional<User> findByUsernameIgnoreCase(String username);

    Optional<User> findByEmployeeCodeIgnoreCase(String employeeCode);

    Long countByIsActive(Boolean isActive);

    /** Number of ACTIVE accounts: active and not locked. */
    Long countByIsActiveAndLocked(Boolean isActive, Boolean locked);

    long countByRolesId(Long roleId);
}
