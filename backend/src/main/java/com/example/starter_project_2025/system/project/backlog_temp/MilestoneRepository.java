package com.example.starter_project_2025.system.project.backlog_temp;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface MilestoneRepository extends JpaRepository<Milestone, Long> {

    Optional<Milestone> findByProjectIdAndNameIgnoreCase(Long projectId, String name);

    List<Milestone> findByStatusNotOrderByProjectIdAscNameAsc(MilestoneStatus status);

    List<Milestone> findByProjectIdAndStatusNotOrderByNameAsc(Long projectId, MilestoneStatus status);
}
