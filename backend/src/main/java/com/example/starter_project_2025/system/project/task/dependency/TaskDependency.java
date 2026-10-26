package com.example.starter_project_2025.system.project.task.dependency;

import com.example.starter_project_2025.system.project.task.Task;
import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.FieldDefaults;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;

@Entity
@Table(name = "task_dependency", indexes = @Index(name = "idx_task_dependency_successor", columnList = "successor_task_id"))
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class TaskDependency {
    @EmbeddedId
    TaskDependencyId id;

    @MapsId("predecessorTaskId")
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "predecessor_task_id", nullable = false, updatable = false)
    Task predecessorTask;

    @MapsId("successorTaskId")
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "successor_task_id", nullable = false, updatable = false)
    Task successorTask;

    @Builder.Default
    @Column(name = "dependency_type", nullable = false, length = 30)
    String dependencyType = "BLOCKS";

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    LocalDateTime createdAt;
}
