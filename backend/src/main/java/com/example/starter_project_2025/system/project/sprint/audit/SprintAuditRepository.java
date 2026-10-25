package com.example.starter_project_2025.system.project.sprint.audit;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface SprintAuditRepository extends JpaRepository<SprintAuditLog, Long> {

    List<SprintAuditLog> findBySprintIdOrderByCreatedAtDesc(Long sprintId);
}
