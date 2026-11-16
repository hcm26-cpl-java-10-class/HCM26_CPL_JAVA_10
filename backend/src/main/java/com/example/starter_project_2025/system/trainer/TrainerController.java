package com.example.starter_project_2025.system.trainer;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import java.net.URI;
import java.util.List;

@RestController @RequestMapping("/api/trainers") @RequiredArgsConstructor @Validated
public class TrainerController {
    private final TrainerService service;
    private final TrainerImportService imports;
    @GetMapping @PreAuthorize("hasAuthority('TRAINER_READ')")
    public Page<TrainerDTO> list(@RequestParam(required = false) String search, @RequestParam(required = false) String status,
        @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "20") int size) { return service.list(search, status, page, size); }
    @GetMapping("/{id}") @PreAuthorize("hasAuthority('TRAINER_READ')")
    public TrainerDTO get(@PathVariable @Positive Long id) { return service.get(id); }
    @PostMapping @PreAuthorize("hasAuthority('TRAINER_CREATE')")
    public ResponseEntity<TrainerDTO> create(@Valid @RequestBody CreateTrainerRequest request) {
        var result = service.create(request); return ResponseEntity.created(URI.create("/api/trainers/" + result.id())).body(result);
    }
    @PutMapping("/{id}") @PreAuthorize("hasAuthority('TRAINER_UPDATE')")
    public TrainerDTO update(@PathVariable @Positive Long id, @Valid @RequestBody UpdateTrainerRequest request) { return service.update(id, request); }
    public record StatusRequest(@NotNull TrainerStatus status) {}
    @PatchMapping("/{id}/status") @PreAuthorize("hasAuthority('TRAINER_UPDATE')")
    public TrainerDTO status(@PathVariable @Positive Long id, @Valid @RequestBody StatusRequest request) { return service.changeStatus(id, request.status()); }
    @DeleteMapping("/{id}") @PreAuthorize("hasAuthority('TRAINER_DELETE')")
    public ResponseEntity<Void> delete(@PathVariable @Positive Long id) { service.delete(id); return ResponseEntity.noContent().build(); }
    @GetMapping("/teaching-topics") @PreAuthorize("hasAuthority('TRAINER_READ')")
    public List<TrainerDTO.Topic> topics() { return service.topics(); }
    // Approval is recorded in docs/TRAINER_MANAGEMENT.md. This endpoint describes ONLY this internal catalog.
    public record Source(String source, boolean approved, boolean sampleData) {}
    @GetMapping("/data-source")
    @PreAuthorize("hasAuthority('TRAINER_READ') or hasAuthority('CLASS_READ')")
    public Source source() { return new Source("INTERNAL", true, false); }
    @GetMapping("/options") @PreAuthorize("hasAuthority('TRAINER_READ') or hasAuthority('CLASS_READ')")
    public Page<TrainerDTO> options(@RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "100") int size) {
        return service.list(null, "ACTIVE", page, size);
    }
    @GetMapping("/import/template") @PreAuthorize("hasAuthority('TRAINER_CREATE')")
    public ResponseEntity<byte[]> template() {
        return ResponseEntity.ok().header("Content-Disposition", "attachment; filename=Trainer_Import_Template.xlsx")
            .header("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet").body(imports.template());
    }
    @PostMapping(value = "/import/preview", consumes = "multipart/form-data") @PreAuthorize("hasAuthority('TRAINER_CREATE')")
    public TrainerImportService.Preview preview(@RequestParam("file") MultipartFile file) { return imports.preview(file); }
    @PostMapping(value = "/import", consumes = "multipart/form-data") @PreAuthorize("hasAuthority('TRAINER_CREATE')")
    public TrainerImportService.Result commit(@RequestParam("file") MultipartFile file) { return imports.commit(file); }
}
