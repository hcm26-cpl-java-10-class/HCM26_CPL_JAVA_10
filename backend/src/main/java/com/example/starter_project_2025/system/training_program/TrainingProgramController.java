package com.example.starter_project_2025.system.training_program;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.*;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;

@RestController("academicTrainingProgramController")
@RequestMapping("/api/training-programs")
@RequiredArgsConstructor
public class TrainingProgramController {
    private final TrainingProgramService service;

    @GetMapping
    public Page<TrainingProgramResponse> search(
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) ProgramStatus status,
            @PageableDefault(size = 10) Pageable pageable) {
        return service.search(keyword, status, pageable);
    }

    @GetMapping("/{id}")
    public TrainingProgramResponse get(@PathVariable Long id) {
        return service.get(id);
    }

    @PostMapping
    public ResponseEntity<TrainingProgramResponse> create(@Valid @RequestBody TrainingProgramRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(service.create(request));
    }

    @PutMapping("/{id}")
    public TrainingProgramResponse update(@PathVariable Long id, @Valid @RequestBody TrainingProgramRequest request) {
        return service.update(id, request);
    }

    @PostMapping("/{id}/clone")
    public ResponseEntity<TrainingProgramResponse> cloneVersion(@PathVariable Long id) {
        return ResponseEntity.status(HttpStatus.CREATED).body(service.cloneVersion(id));
    }

    @PatchMapping("/{id}/status")
    public TrainingProgramResponse changeStatus(@PathVariable Long id, @RequestParam ProgramStatus status) {
        return service.changeStatus(id, status);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deactivate(@PathVariable Long id) {
        service.deactivate(id);
        return ResponseEntity.noContent().build();
    }
}
