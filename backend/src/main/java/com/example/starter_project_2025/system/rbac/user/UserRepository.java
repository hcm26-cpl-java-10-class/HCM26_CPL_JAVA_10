package com.example.starter_project_2025.system.rbac.user;

import com.example.starter_project_2025.base.crud.domain.BaseCrudRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface UserRepository extends BaseCrudRepository<User, Long> {

    Optional<User> findByEmail(String email);

    boolean existsByEmail(String email);

    Optional<User> findByUsernameIgnoreCase(String username);

    Optional<User> findByEmployeeCodeIgnoreCase(String employeeCode);

    boolean existsByDepartmentsId(Long departmentId);

    Long countByIsActive(Boolean isActive);

    /** Số tài khoản ACTIVE: đang hoạt động và không bị khóa. */
    Long countByIsActiveAndLocked(Boolean isActive, Boolean locked);
}
