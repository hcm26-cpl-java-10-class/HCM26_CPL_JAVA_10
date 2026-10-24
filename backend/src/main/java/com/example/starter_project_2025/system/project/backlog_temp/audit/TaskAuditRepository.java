package com.example.starter_project_2025.system.project.backlog_temp.audit;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository("backlogItemAuditRepository")
public interface TaskAuditRepository extends JpaRepository<TaskAuditLog, Long> {

    List<TaskAuditLog> findByTaskIdOrderByCreatedAtDesc(Long taskId);
}
