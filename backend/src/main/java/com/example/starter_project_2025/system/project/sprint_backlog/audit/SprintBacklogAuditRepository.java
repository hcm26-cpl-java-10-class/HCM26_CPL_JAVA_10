package com.example.starter_project_2025.system.project.sprint_backlog.audit;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface SprintBacklogAuditRepository extends JpaRepository<SprintBacklogAuditLog, Long> {

    List<SprintBacklogAuditLog> findBySprintBacklogIdOrderByCreatedAtDesc(Long sprintBacklogId);
}
