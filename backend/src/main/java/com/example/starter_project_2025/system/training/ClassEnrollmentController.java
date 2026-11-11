package com.example.starter_project_2025.system.training;

import jakarta.validation.constraints.Positive;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;
import java.util.List;
import static com.example.starter_project_2025.system.training.TraineeImportContract.*;

@RestController
@RequestMapping("/api/classes/{classId}/trainees")
@RequiredArgsConstructor
@Validated
public class ClassEnrollmentController {
    private final ClassEnrollmentService service;
    @GetMapping
    @PreAuthorize("(hasAuthority('CLASS_READ') and hasAuthority('ENROLLMENT_READ')) or hasAuthority('INVITATION_CREATE')")
    public List<TraineeView> list(@PathVariable @Positive Long classId, Authentication auth) { return service.list(classId, sensitive(auth)); }
    @PostMapping("/preview")
    @PreAuthorize("hasAuthority('CLASS_READ') and hasAuthority('ENROLLMENT_READ') and hasAuthority('ENROLLMENT_CREATE')")
    public Preview preview(@PathVariable @Positive Long classId, @RequestBody List<Row> rows, Authentication auth) {
        return service.preview(classId, rows, sensitive(auth));
    }
    @PostMapping("/import")
    @PreAuthorize("hasAuthority('CLASS_READ') and hasAuthority('ENROLLMENT_READ') and hasAuthority('ENROLLMENT_CREATE')")
    public Imported importRows(@PathVariable @Positive Long classId, @RequestBody List<Row> rows, Authentication auth) {
        return service.importRows(classId, rows, sensitive(auth));
    }
    @PutMapping("/batch")
    @PreAuthorize("hasAuthority('CLASS_READ') and hasAuthority('ENROLLMENT_READ') and hasAuthority('ENROLLMENT_UPDATE')"
        + " and (#batch == null or #batch.created() == null or #batch.created().isEmpty() or hasAuthority('ENROLLMENT_CREATE'))"
        + " and (#batch == null or #batch.deletedIds() == null or #batch.deletedIds().isEmpty() or hasAuthority('ENROLLMENT_DELETE'))")
    public BatchResult batch(@PathVariable @Positive Long classId, @RequestBody Batch batch, Authentication auth) {
        return service.batch(classId, batch, sensitive(auth));
    }
    private boolean sensitive(Authentication auth) { return auth.getAuthorities().stream().anyMatch(a -> a.getAuthority().equals("USER_READ")); }
}
