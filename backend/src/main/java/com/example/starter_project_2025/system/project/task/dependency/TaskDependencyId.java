package com.example.starter_project_2025.system.project.task.dependency;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.io.Serializable;
import java.util.UUID;

@Embeddable
@Data
@NoArgsConstructor
@AllArgsConstructor
public class TaskDependencyId implements Serializable {
    @Column(name = "predecessor_task_id")
    private UUID predecessorTaskId;

    @Column(name = "successor_task_id")
    private UUID successorTaskId;
}
