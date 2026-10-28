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

    
    Long countByIsActiveAndLocked(Boolean isActive, Boolean locked);

    long countByRolesId(Long roleId);

    @Query("""
            select distinct u from User u
            join u.roles r
            where r.name = :roleName
              and u.isActive = true
            order by u.email asc
            """)
    List<User> findActiveUsersByRoleName(@Param("roleName") String roleName);
}
