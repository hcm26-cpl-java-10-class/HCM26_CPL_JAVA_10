package com.example.starter_project_2025.system.project.task.alert;

import com.example.starter_project_2025.system.project.task.TaskRequestContext;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.*;
import static com.example.starter_project_2025.system.project.task.alert.TaskAlertDtos.*;

@RestController @RequiredArgsConstructor @RequestMapping("/api/task-alerts")
public class TaskAlertController {
    private final TaskAlertService service;
    private final TaskAlertAccess access;
    @GetMapping("/projects")
    public List<ProjectOption> projects() { return access.projectOptions(); }
    @GetMapping("/overdue")
    public OverduePage overdue(@RequestParam UUID projectId, @RequestParam(defaultValue = "0") int page,
                                @RequestParam(defaultValue = "20") int size) {
        return service.overdue(projectId, page, size);
    }
    @PostMapping
    public ResponseEntity<Result> send(@RequestBody Send request,
            @RequestHeader(value = "Idempotency-Key", required = false) UUID key,
            @RequestHeader(value = "X-Correlation-ID", required = false) String correlation) {
        // Bean Validation runs in the service after authentication and scope checks.
        var result = service.send(request, key, correlation);
        return ResponseEntity.accepted().header("X-Correlation-ID", TaskRequestContext.currentCorrelationId()).body(result);
    }
    @GetMapping("/tasks/{taskId}/history")
    public List<History> history(@PathVariable UUID taskId) { return service.history(taskId); }
    @GetMapping("/bridge-options")
    public List<BridgeOption> options() { return access.options(); }
    @GetMapping("/assignees")
    public List<AssigneeOption> assignees(@RequestParam UUID projectId) { return access.assignees(projectId); }
    @PutMapping("/project-links/{alias}")
    public void projectLink(@PathVariable UUID alias, @RequestBody ProjectBinding request) { access.bindProject(alias, request); }
    @PutMapping("/member-links/{alias}")
    public void memberLink(@PathVariable UUID alias, @RequestBody MemberBinding request) { access.bindMember(alias, request); }
}
