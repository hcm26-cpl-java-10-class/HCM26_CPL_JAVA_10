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

    Optional<User> findByEmailIgnoreCase(String email);

    boolean existsByEmail(String email);

    boolean existsByEmailIgnoreCase(String email);

    /** Profile affiliations are scalar values; accept a department code or display name. */
    @Query("""
            select (count(u) > 0) from User u
            where lower(trim(u.department)) = lower(trim(:code))
               or lower(trim(u.department)) = lower(trim(:name))
            """)
    boolean existsByDepartmentCodeOrName(@Param("code") String code, @Param("name") String name);

    Long countByIsActive(Boolean isActive);

    
    Long countByIsActiveAndLocked(Boolean isActive, Boolean locked);

    long countByRolesId(Long roleId);
}