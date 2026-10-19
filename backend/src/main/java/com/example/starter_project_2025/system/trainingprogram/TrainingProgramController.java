package com.example.starter_project_2025.system.trainingprogram;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/programs")
@RequiredArgsConstructor
public class TrainingProgramController {
    private final TrainingProgramService service;

    @GetMapping
    public ResponseEntity<List<TrainingProgramResponse>> findAll(
            @RequestParam(required = false) String search,
            @RequestParam(required = false) ProgramStatus status,
            @RequestParam(required = false) String region) {
        return ResponseEntity.ok(service.findAll(search, status, region));
    }

    @PostMapping
    public ResponseEntity<TrainingProgramResponse> create(@Valid @RequestBody TrainingProgramRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(service.create(request));
    }

    @GetMapping("/{id}")
    public ResponseEntity<TrainingProgramResponse> findById(@PathVariable Long id) {
        return ResponseEntity.ok(service.findById(id));
    }

    @PutMapping("/{id}")
    public ResponseEntity<TrainingProgramResponse> update(@PathVariable Long id,
            @Valid @RequestBody TrainingProgramRequest request) {
        return ResponseEntity.ok(service.update(id, request));
    }

    @GetMapping("/{id}/subjects")
    public ResponseEntity<List<TrainingProgramResponse.ProgramSubjectResponse>> subjects(@PathVariable Long id) {
        return ResponseEntity.ok(service.findById(id).subjects());
    }

    @PutMapping("/{id}/subjects")
    public ResponseEntity<TrainingProgramResponse> updateSubjects(@PathVariable Long id,
            @Valid @RequestBody List<@Valid ProgramSubjectRequest> subjects) {
        return ResponseEntity.ok(service.updateSubjects(id, subjects));
    }

    @PostMapping("/{id}/clone")
    public ResponseEntity<TrainingProgramResponse> cloneVersion(@PathVariable Long id,
            @RequestParam String newVersion) {
        return ResponseEntity.status(HttpStatus.CREATED).body(service.cloneVersion(id, newVersion));
    }

    @PostMapping("/{id}/activate")
    public ResponseEntity<TrainingProgramResponse> activate(@PathVariable Long id) {
        return ResponseEntity.ok(service.activate(id));
    }

    @PatchMapping("/{id}/status")
    public ResponseEntity<TrainingProgramResponse> changeStatus(@PathVariable Long id,
            @RequestParam ProgramStatus status) {
        return ResponseEntity.ok(service.changeStatus(id, status));
    }

    @GetMapping("/export")
    public ResponseEntity<String> export(@RequestParam(required = false) String search) {
        StringBuilder csv = new StringBuilder("id,code,name,version,region,status,totalDurationHours\n");
        for (TrainingProgramResponse p : service.findAll(search, null, null)) {
            csv.append(p.id()).append(",").append(csv(p.code())).append(",").append(csv(p.name())).append(",")
                    .append(csv(p.version())).append(",").append(csv(p.region())).append(",")
                    .append(p.status()).append(",").append(p.totalDurationHours()).append("\n");
        }
        return ResponseEntity.ok()
                .header("Content-Disposition", "attachment; filename=training-programs.csv")
                .header("Content-Type", "text/csv; charset=UTF-8")
                .body("\uFEFF" + csv);
    }

    private String csv(String value) {
        if (value == null) return "";
        return "\"" + value.replace("\"", "\"\"") + "\"";
    }
}
