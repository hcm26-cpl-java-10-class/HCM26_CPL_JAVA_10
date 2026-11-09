package com.example.starter_project_2025.system.project.task.alert.demo;

import jakarta.persistence.*;
import lombok.*;
import java.util.UUID;

/** Marks a completed local seed, including after its tasks are edited or deleted. */
@Entity @Table(name = "task_alert_demo_datasets")
@Getter @Setter @NoArgsConstructor
public class TaskAlertDemoDataset {
    @Id private Long tenantId;
    @Column(nullable = false) private UUID taskProjectId;
}
