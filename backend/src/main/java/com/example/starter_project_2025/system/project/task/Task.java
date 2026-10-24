package com.example.starter_project_2025.system.project.task;

import com.example.starter_project_2025.init.annotation.ResourceMenu;
import com.example.starter_project_2025.init.annotation.ResourcePermission;
import com.example.starter_project_2025.system.project.task.tag.Tag;
import com.example.starter_project_2025.system.project.task.dependency.TaskDependency;
import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.FieldDefaults;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;
import java.util.LinkedHashSet;
import java.util.Set;
import java.util.UUID;

@Entity
@Table(name = "task", indexes = @Index(name = "idx_task_project", columnList = "project_id"))
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
@ResourcePermission("TASK")
@ResourceMenu(title = "Tasks", group = "Project Management", icon = "clipboard-check",
        url = "/tasks", order = 2, permission = "TASK_READ")
public class Task {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "task_id")
    UUID id;

    @Column(name = "project_id", nullable = false, updatable = false)
    UUID projectId;

    @Column(name = "sprint_id")
    UUID sprintId;

    @Column(name = "milestone_id")
    UUID milestoneId;

    @Column(name = "assignee_project_member_id")
    UUID assigneeProjectMemberId;

    @Column(nullable = false, length = 250)
    String title;

    @Column(columnDefinition = "TEXT")
    String description;

    @Column(name = "estimated_hours")
    Double estimatedHours;

    @Builder.Default
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    TaskPriority priority = TaskPriority.MEDIUM;

    @Builder.Default
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    TaskStatus status = TaskStatus.TODO;

    @Builder.Default
    @ManyToMany
    @JoinTable(name = "task_tag", joinColumns = @JoinColumn(name = "task_id"),
            inverseJoinColumns = @JoinColumn(name = "tag_id"))
    Set<Tag> tags = new LinkedHashSet<>();

    @Builder.Default
    @OneToMany(mappedBy = "successorTask")
    Set<TaskDependency> incomingDependencies = new LinkedHashSet<>();

    @Version
    @Column(nullable = false)
    Long version;

    @Builder.Default
    @Column(name = "is_active", nullable = false)
    Boolean isActive = true;

    @Column(name = "created_by", nullable = false, updatable = false)
    Long createdBy;

    @Column(name = "updated_by", nullable = false)
    Long updatedBy;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    LocalDateTime updatedAt;
}
