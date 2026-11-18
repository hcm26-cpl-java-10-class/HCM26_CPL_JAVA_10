package com.example.starter_project_2025.system.project.team;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import jakarta.persistence.LockModeType;
import java.util.Optional;
import org.springframework.stereotype.Repository;

@Repository
public interface TeamRepository extends JpaRepository<Team, Long>, JpaSpecificationExecutor<Team> {
    Optional<Team> findByCodeAndTenantId(String code, Long tenantId);
    Optional<Team> findFirstByProjectIdOrderByIdAsc(Long projectId);
    boolean existsByProjectIdAndIdNot(Long projectId, Long teamId);
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select t from Team t where t.id = :id")
    Optional<Team> findForWorkspaceCreation(Long id);
}
