package com.example.starter_project_2025.system.project.workspace.repository;

import com.example.starter_project_2025.system.project.domain.ProjectTopicSnapshot;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;

public interface ProjectTopicSnapshotRepository extends JpaRepository<ProjectTopicSnapshot, Long> {
    Optional<ProjectTopicSnapshot> findByProjectId(Long projectId);
}
