package com.example.starter_project_2025.system.training;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.*;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;
import java.time.LocalDate;
import java.net.URI;
import java.util.List;

@RestController
@RequestMapping("/api/classes")
@RequiredArgsConstructor
@Validated
public class TrainingClassController {
    private final TrainingClassService service;
    private final ClassStatisticsService statistics;
    private final ClassReadinessService readiness;

    @GetMapping("/{id}/readiness")
    @PreAuthorize("hasAuthority('CLASS_READ')")
    public ClassReadinessService.Readiness readiness(@PathVariable @Positive Long id) { return readiness.get(id); }

    @GetMapping("/stats")
    @PreAuthorize("hasAuthority('CLASS_READ')")
    public ClassStatisticsService.Statistics statistics() { return statistics.get(); }

    @GetMapping
    @PreAuthorize("hasAuthority('CLASS_READ')")
    public TrainingClassService.ClassPage list(
        @RequestParam(defaultValue = "0") int page,
        @RequestParam(defaultValue = "10") int size,
        @RequestParam(required = false) String search,
        @RequestParam(required = false) String status,
        @RequestParam(required = false) String program,
        @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
        @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
        @RequestParam(defaultValue = "code") String sort,
        @RequestParam(defaultValue = "asc") String direction) {
        return service.list(page, size, search, status, program, from, to, sort, direction);
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAuthority('CLASS_READ')")
    public TrainingClassDTO get(@PathVariable @Positive Long id) { return service.get(id); }

    @PostMapping
    @PreAuthorize("hasAuthority('CLASS_CREATE')")
    public ResponseEntity<TrainingClassDTO> create(@Valid @RequestBody TrainingClassDTO input) {
        TrainingClassDTO result = service.create(input);
        return ResponseEntity.created(URI.create("/api/classes/" + result.getId())).body(result);
    }

    @PostMapping("/import")
    @PreAuthorize("hasAuthority('CLASS_CREATE')")
    public List<TrainingClassDTO> importClasses(@RequestBody @NotEmpty @Size(max = 500) List<@NotNull @Valid TrainingClassDTO> input) {
        return service.importClasses(input);
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAuthority('CLASS_UPDATE')")
    public TrainingClassDTO update(@PathVariable @Positive Long id, @Valid @RequestBody TrainingClassDTO input) {
        return service.update(id, input);
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAuthority('CLASS_DELETE')")
    public ResponseEntity<Void> deactivate(@PathVariable @Positive Long id) {
        service.deactivate(id);
        return ResponseEntity.noContent().build();
    }
}
