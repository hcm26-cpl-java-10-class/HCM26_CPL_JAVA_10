package com.example.starter_project_2025.system.project.task.workflow;

import com.example.starter_project_2025.system.project.task.TaskDTO;
import com.example.starter_project_2025.system.project.task.TaskRequestContext;
import com.example.starter_project_2025.system.project.task.audit.TaskActivityDTO;
import com.example.starter_project_2025.system.project.task.dependency.TaskDependencyRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/tasks/{taskId}")
@RequiredArgsConstructor
public class TaskWorkflowController {
    private final TaskWorkflowService workflowService;

    @GetMapping("/workflow")
    public ResponseEntity<TaskWorkflowDTO> getWorkflow(@PathVariable UUID taskId) {
        return ResponseEntity.ok(workflowService.getWorkflow(taskId));
    }

    @GetMapping("/activity")
    public ResponseEntity<List<TaskActivityDTO>> getActivity(@PathVariable UUID taskId) {
        return ResponseEntity.ok(workflowService.getActivity(taskId));
    }

    @PatchMapping("/status")
    public ResponseEntity<TaskDTO> changeStatus(@PathVariable UUID taskId, @RequestBody TaskStatusRequest request,
            @RequestHeader(value = "Idempotency-Key", required = false) UUID requestId,
            @RequestHeader(value = "X-Correlation-ID", required = false) String correlationId) {
        TaskRequestContext context = TaskRequestContext.create(requestId, correlationId);
        return response(workflowService.changeStatus(taskId, request, context), context);
    }

    @PostMapping("/dependencies")
    public ResponseEntity<TaskDTO> addDependency(@PathVariable UUID taskId, @RequestBody TaskDependencyRequest request,
            @RequestHeader(value = "Idempotency-Key", required = false) UUID requestId,
            @RequestHeader(value = "X-Correlation-ID", required = false) String correlationId) {
        TaskRequestContext context = TaskRequestContext.create(requestId, correlationId);
        return response(workflowService.addDependency(taskId, request, context), context);
    }

    @DeleteMapping("/dependencies/{predecessorId}")
    public ResponseEntity<TaskDTO> removeDependency(@PathVariable UUID taskId, @PathVariable UUID predecessorId,
            @RequestParam Long version,
            @RequestHeader(value = "Idempotency-Key", required = false) UUID requestId,
            @RequestHeader(value = "X-Correlation-ID", required = false) String correlationId) {
        TaskRequestContext context = TaskRequestContext.create(requestId, correlationId);
        return response(workflowService.removeDependency(taskId, predecessorId, version, context), context);
    }

    private ResponseEntity<TaskDTO> response(TaskDTO task, TaskRequestContext context) {
        return ResponseEntity.ok().header("X-Correlation-ID", context.correlationId())
                .header("Idempotency-Key", context.requestId().toString()).body(task);
    }
}
