package com.example.starter_project_2025.system.project.task.alert;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.*;
public interface TaskAlertItemRepository extends JpaRepository<TaskAlertData.Item, UUID> {
    List<TaskAlertData.Item> findByTaskIdOrderByBatchCreatedAtDesc(UUID taskId);
}
