package com.example.starter_project_2025.system.project.charter;

import org.springframework.data.jpa.repository.JpaRepository;

public interface TeamCharterRevisionRepository extends JpaRepository<TeamCharterRevision, Long> {
    long countByTeam_Id(Long teamId);
    org.springframework.data.domain.Page<TeamCharterRevision> findByTeam_IdOrderByRevisionNumberDesc(
            Long teamId, org.springframework.data.domain.Pageable pageable);
}
