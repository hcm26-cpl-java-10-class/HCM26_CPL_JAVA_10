package com.example.starter_project_2025.system.project.task.alert;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.*;
public interface TaskAlertBatchRepository extends JpaRepository<TaskAlertData.Batch, UUID> {
    Optional<TaskAlertData.Batch> findByActorIdAndRequestId(Long actorId, UUID requestId);
}
