package com.example.starter_project_2025.system.project.sprint;

import com.example.starter_project_2025.base.crud.domain.BaseEntity;
import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.FieldDefaults;
import lombok.experimental.SuperBuilder;

@Entity
@Getter
@Setter
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
@Table(
        name = "task",
        uniqueConstraints = @UniqueConstraint(
                name = "uk_task_project_code",
                columnNames = {"project_id", "task_code"}
        )
)
@FieldDefaults(level = AccessLevel.PRIVATE)
@AttributeOverride(name = "id", column = @Column(name = "task_id"))
public class Task extends BaseEntity {

    @Column(name = "project_id", nullable = false)
    Long projectId;

    @Column(name = "sprint_id")
    Long sprintId;

    @Column(name = "milestone_id")
    Long milestoneId;

    @Column(name = "assignee_project_member_id")
    Long assigneeProjectMemberId;

    @Column(nullable = false, length = 255)
    String title;

    @Column(name = "task_code", nullable = false, length = 50)
    String code;

    @Column(length = 1000)
    String description;

    @Column(name = "estimated_hours")
    Double estimatedHours;

    @Enumerated(EnumType.STRING)
    TaskPriority priority;

    @Enumerated(EnumType.STRING)
    @Builder.Default
    @Column(nullable = false, length = 50)
    TaskStatus status = TaskStatus.TODO;

    @Builder.Default
    @Column(name = "order_index")
    Integer orderIndex = 0;

    @Version
    @Builder.Default
    @Column(name = "version", nullable = false)
    Long version = 0L;

    public Long getTaskId() {
        return getId();
    }

    public void setTaskId(Long taskId) {
        setId(taskId);
    }
}