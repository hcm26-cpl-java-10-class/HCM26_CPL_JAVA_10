package com.example.starter_project_2025.system.project.task;

import lombok.*;
import lombok.experimental.FieldDefaults;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class TaskDTO {

    UUID id;

    UUID projectId;
    UUID sprintId;
    UUID milestoneId;
    UUID assigneeProjectMemberId;
    String title;
    String description;
    Double estimatedHours;
    java.time.Instant deadline;
    TaskPriority priority;
    TaskStatus status;
    List<String> tags;
    @Builder.Default
    List<UUID> predecessorTaskIds = List.of();
    Long version;

    Boolean isActive;

    Long createdBy;

    Long updatedBy;

    LocalDateTime createdAt;

    LocalDateTime updatedAt;
}
