package com.example.starter_project_2025.system.rbac.user;

import com.example.starter_project_2025.base.crud.domain.BaseCrudRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface UserRepository extends BaseCrudRepository<User, Long> {

    Optional<User> findByEmail(String email);

    Optional<User> findByEmailIgnoreCase(String email);

    /** Used by the import: the accounts of many emails (given in lower case) in one query. */
    @Query("select u from User u where lower(u.email) in :emails")
    List<User> findAllByEmailLowerIn(@Param("emails") Collection<String> emails);

    boolean existsByEmail(String email);

    boolean existsByEmailIgnoreCase(String email);

    boolean existsByDepartmentsId(Long departmentId);

    Long countByIsActive(Boolean isActive);

    /** Number of ACTIVE accounts: active and not locked. */
    Long countByIsActiveAndLocked(Boolean isActive, Boolean locked);

    long countByRolesId(Long roleId);
}
