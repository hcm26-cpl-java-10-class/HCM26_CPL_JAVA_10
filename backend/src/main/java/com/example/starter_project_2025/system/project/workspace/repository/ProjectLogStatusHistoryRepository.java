package com.example.starter_project_2025.system.project.workspace.repository;

import com.example.starter_project_2025.system.project.workspace.domain.ProjectLogStatusHistory;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ProjectLogStatusHistoryRepository extends JpaRepository<ProjectLogStatusHistory, Long> {
    List<ProjectLogStatusHistory> findByLogIdOrderByChangedAtDesc(Long logId);
}
