package com.example.starter_project_2025.system.rbac.role;

import com.example.starter_project_2025.base.crud.domain.BaseCrudRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface RoleRepository extends BaseCrudRepository<Role, Long> {

    Optional<Role> findByName(String name);

    @Query("SELECT r FROM Role r WHERE :keyword IS NULL OR :keyword = '' "
            + "OR UPPER(r.name) LIKE UPPER(CONCAT('%', :keyword, '%'))")
    Page<Role> searchByKeyword(@Param("keyword") String keyword, Pageable pageable);

    Long countByIsActive(Boolean isActive);

    Long countByIdIn(Iterable<Long> ids);
}
