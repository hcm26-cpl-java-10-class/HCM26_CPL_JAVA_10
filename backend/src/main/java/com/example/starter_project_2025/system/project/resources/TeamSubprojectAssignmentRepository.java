package com.example.starter_project_2025.system.project.resources;

import java.util.List;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

public interface TeamSubprojectAssignmentRepository extends JpaRepository<TeamSubprojectAssignment, Long> {
    @EntityGraph(attributePaths = {"project", "project.parentProject"})
    List<TeamSubprojectAssignment> findAllByTeam_IdAndIsActiveTrueOrderByIdAsc(Long teamId);
}
