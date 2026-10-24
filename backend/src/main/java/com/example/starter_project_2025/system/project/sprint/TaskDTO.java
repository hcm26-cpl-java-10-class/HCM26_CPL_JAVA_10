package com.example.starter_project_2025.system.project.sprint;

import com.example.starter_project_2025.base.crud.dto.BaseDTO;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.experimental.FieldDefaults;

import java.time.LocalDateTime;

@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class TaskDTO extends BaseDTO {

    Long projectId;

    Long sprintId;

    Long milestoneId;

    Long assigneeProjectMemberId;

    String assigneeName;

    String title;

    String code;

    String description;

    Double estimatedHours;

    TaskPriority priority;

    TaskStatus status;

    Integer orderIndex;

    LocalDateTime createdAt;

    LocalDateTime updatedAt;

    @JsonProperty(access = JsonProperty.Access.READ_ONLY)
    Long version;
}