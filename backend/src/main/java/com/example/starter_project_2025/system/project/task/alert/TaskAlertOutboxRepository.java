package com.example.starter_project_2025.system.project.task.alert;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.*;
public interface TaskAlertOutboxRepository extends JpaRepository<TaskAlertData.Outbox, UUID> {
    Optional<TaskAlertData.Outbox> findByBatchId(UUID batchId);
}
