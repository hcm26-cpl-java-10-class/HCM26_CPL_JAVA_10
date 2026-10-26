package com.example.starter_project_2025.system.project.milestone.risk;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.*;
@RestController @RequiredArgsConstructor
@RequestMapping("/api/projects/{projectId}/milestone-risks")
public class MilestoneRiskController {
    private final MilestoneRiskService service;
    @GetMapping public MilestoneRiskDtos.Page list(@PathVariable UUID projectId,
            @RequestParam(defaultValue = "true") boolean atRiskOnly) { return service.list(projectId, atRiskOnly); }
    @PostMapping("/{milestoneId}/alerts")
    public ResponseEntity<MilestoneRiskDtos.Result> send(@PathVariable UUID projectId, @PathVariable UUID milestoneId,
            @RequestHeader(value = "Idempotency-Key", required = false) UUID key, @RequestBody MilestoneRiskDtos.Send request) {
        var result = service.send(projectId, milestoneId, key, request);
        return ResponseEntity.accepted().header("X-Correlation-ID", result.correlationId()).body(result);
    }
    @GetMapping("/{milestoneId}/alerts")
    public List<MilestoneRiskDtos.History> history(@PathVariable UUID projectId, @PathVariable UUID milestoneId) {
        return service.history(projectId, milestoneId);
    }
}
