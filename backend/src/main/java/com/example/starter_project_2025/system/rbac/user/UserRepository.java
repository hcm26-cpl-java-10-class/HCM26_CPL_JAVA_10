package com.example.starter_project_2025.system.rbac.user;

import com.example.starter_project_2025.base.crud.domain.BaseCrudRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface UserRepository extends BaseCrudRepository<User, Long> {

    Optional<User> findByEmail(String email);

    Optional<User> findByEmailIgnoreCase(String email);

    boolean existsByEmail(String email);

    boolean existsByEmailIgnoreCase(String email);

    boolean existsByDepartmentsId(Long departmentId);

    Long countByIsActive(Boolean isActive);

    /** Number of ACTIVE accounts: active and not locked. */
    Long countByIsActiveAndLocked(Boolean isActive, Boolean locked);

    long countByRolesId(Long roleId);

    @Query("""
    SELECT u.id
    FROM User u
    WHERE LOWER(CONCAT(
        COALESCE(u.firstName, ''), ' ',
        COALESCE(u.lastName, '')
    )) LIKE LOWER(CONCAT('%', :keyword, '%'))
       OR LOWER(COALESCE(u.firstName, '')) LIKE LOWER(CONCAT('%', :keyword, '%'))
       OR LOWER(COALESCE(u.lastName, '')) LIKE LOWER(CONCAT('%', :keyword, '%'))
       OR LOWER(COALESCE(u.email, '')) LIKE LOWER(CONCAT('%', :keyword, '%'))
    """)
    List<Long> findIdsByActorName(@Param("keyword") String keyword);
}
