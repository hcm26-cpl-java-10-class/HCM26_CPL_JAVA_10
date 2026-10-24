package com.example.starter_project_2025.system.project.task;

import com.example.starter_project_2025.base.crud.spec.FilterField;
import lombok.Getter;
import lombok.Setter;

import java.util.UUID;
import java.util.Set;

@Getter
@Setter
public class TaskFilter {

    @FilterField
    private UUID projectId;

    @FilterField
    private UUID sprintId;

    @FilterField
    private UUID milestoneId;

    @FilterField
    private UUID assigneeProjectMemberId;

    @FilterField
    private TaskPriority priority;

    @FilterField
    private TaskStatus status;

    private Set<UUID> excludeIds;
}
