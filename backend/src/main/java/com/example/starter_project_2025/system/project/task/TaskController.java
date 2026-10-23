package com.example.starter_project_2025.system.project.task;

import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/tasks")
@RequiredArgsConstructor
public class TaskController {
    private final TaskService taskService;

    @GetMapping
    public ResponseEntity<Page<TaskDTO>> getAll(
            @PageableDefault(size = 20, sort = "createdAt", direction = Sort.Direction.DESC) Pageable pageable,
            @RequestParam(required = false) String search, @ModelAttribute TaskFilter filter) {
        return ResponseEntity.ok(taskService.getAll(pageable, search, filter));
    }

    @GetMapping("/tags")
    public ResponseEntity<List<String>> getTags(@RequestParam UUID projectId,
                                               @RequestParam(required = false) String search) {
        return ResponseEntity.ok(taskService.getTags(projectId, search));
    }

    @GetMapping("/{id}")
    public ResponseEntity<TaskDTO> getById(@PathVariable UUID id) {
        return ResponseEntity.ok(taskService.getById(id));
    }

    @PostMapping
    public ResponseEntity<TaskDTO> create(@RequestBody TaskDTO request,
            @RequestHeader(value = "Idempotency-Key", required = false) UUID requestId,
            @RequestHeader(value = "X-Correlation-ID", required = false) String correlationId) {
        TaskRequestContext context = TaskRequestContext.create(requestId, correlationId);
        return response(taskService.create(request, context), context);
    }

    @PutMapping("/{id}")
    public ResponseEntity<TaskDTO> update(@PathVariable UUID id, @RequestBody TaskDTO request,
            @RequestHeader(value = "Idempotency-Key", required = false) UUID requestId,
            @RequestHeader(value = "X-Correlation-ID", required = false) String correlationId) {
        TaskRequestContext context = TaskRequestContext.create(requestId, correlationId);
        return response(taskService.update(id, request, context), context);
    }

    private ResponseEntity<TaskDTO> response(TaskDTO task, TaskRequestContext context) {
        return ResponseEntity.ok().header("X-Correlation-ID", context.correlationId())
                .header("Idempotency-Key", context.requestId().toString()).body(task);
    }
}
