package com.example.starter_project_2025.system.project.task.backlog;

import com.example.starter_project_2025.system.project.task.TaskAccessService;
import com.example.starter_project_2025.system.project.task.TaskRepository;
import com.example.starter_project_2025.system.project.task.workflow.TaskWorkflowDTO;
import com.example.starter_project_2025.system.project.task.workflow.TaskWorkflowService;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/sprint-backlogs/{backlogId}/subtasks")
@RequiredArgsConstructor
public class BacklogSubtaskController {
    private final TaskAccessService access;
    private final TaskBacklogContextService contexts;
    private final TaskRepository tasks;
    private final TaskWorkflowService workflows;

    public record Response(UUID projectId, List<TaskBacklogContextService.Assignee> assignees,
                           List<TaskWorkflowDTO> items) { }

    @GetMapping
    @Transactional(readOnly = true)
    public Response list(@PathVariable Long backlogId) {
        Long actorId = access.requirePermission("TASK_READ");
        var context = contexts.require(backlogId, actorId, false);
        return new Response(context.projectAlias(), contexts.assignees(context),
                tasks.findAllByBacklogItem_IdAndIsActiveTrueOrderByCreatedAtAscIdAsc(backlogId).stream()
                        .map(task -> workflows.getWorkflow(task.getId())).toList());
    }
}
