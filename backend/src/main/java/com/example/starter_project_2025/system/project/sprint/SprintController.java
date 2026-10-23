package com.example.starter_project_2025.system.project.sprint;

import com.example.starter_project_2025.base.crud.controller.BaseCrudDataIoController;
import com.example.starter_project_2025.base.crud.domain.BaseCrudRepository;
import com.example.starter_project_2025.base.crud.service.BaseCrudService;
import com.example.starter_project_2025.base.dataio.common.FileFormat;
import com.example.starter_project_2025.base.dataio.importer.result.ImportResult;
import com.example.starter_project_2025.exception.error.ErrorResponse;
import com.example.starter_project_2025.exception.error.ValidationErrorResponse;
import com.example.starter_project_2025.system.project.sprint.audit.SprintAuditLogDTO;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.persistence.OptimisticLockException;
import jakarta.servlet.http.HttpServletResponse;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import org.springframework.dao.OptimisticLockingFailureException;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.time.LocalDateTime;
import java.util.List;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/sprints")
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
@Tag(name = "Sprint", description = "APIs for managing sprints")
public class SprintController
        extends BaseCrudDataIoController<Sprint, Long, SprintDTO, SprintFilter> {

    SprintService sprintService;
    SprintRepository sprintRepository;

    @Override
    protected BaseCrudService<Long, SprintDTO, SprintFilter> getService() {
        return sprintService;
    }

    @Override
    protected BaseCrudRepository<Sprint, Long> getRepository() {
        return sprintRepository;
    }

    @Override
    protected Class<Sprint> getEntityClass() {
        return Sprint.class;
    }

    /**
     * Audit trail of a sprint (actor, timestamp, before/after state,
     * correlation id) - UFR-PRJ-003-01.
     */
    @GetMapping("/{id}/audit-logs")
    public ResponseEntity<List<SprintAuditLogDTO>> getAuditLogs(@PathVariable Long id) {
        return ResponseEntity.ok(sprintService.getAuditLogs(id));
    }

    /**
     * Export uses flattened rows so the exported headers match the import
     * template of the sprint module.
     */
    @Override
    @GetMapping("/export")
    @PreAuthorize("hasAuthority('SPRINT_READ')")
    public void exportFile(
            @RequestParam(defaultValue = "EXCEL") FileFormat format,
            HttpServletResponse response
    ) throws IOException {
        exportService.export(format, sprintService.getExportRows(), SprintExportRow.class, response);
    }

    /**
     * Import requires the create permission of the resource.
     */
    @Override
    @PostMapping(value = "/import", consumes = "multipart/form-data")
    @PreAuthorize("hasAuthority('SPRINT_CREATE')")
    public ImportResult importFile(@RequestParam("file") MultipartFile file) {
        return super.importFile(file);
    }

    // ---------------------------------------------------------------------
    // Use-case specific error mapping (kept local to the sprint module so the
    // global handler contract used by other modules is untouched).
    // ---------------------------------------------------------------------

    @ExceptionHandler(SprintValidationException.class)
    public ResponseEntity<ValidationErrorResponse> handleSprintValidation(SprintValidationException ex) {
        ValidationErrorResponse body = new ValidationErrorResponse("Dữ liệu không hợp lệ", ex.getErrors());
        return ResponseEntity.status(HttpStatus.UNPROCESSABLE_ENTITY).body(body);
    }

    @ExceptionHandler(SprintConflictException.class)
    public ResponseEntity<ErrorResponse> handleSprintConflict(SprintConflictException ex) {
        ErrorResponse body = new ErrorResponse(
                HttpStatus.CONFLICT.value(),
                ex.getMessage(),
                LocalDateTime.now()
        );
        return ResponseEntity.status(HttpStatus.CONFLICT).body(body);
    }

    @ExceptionHandler({OptimisticLockingFailureException.class, OptimisticLockException.class})
    public ResponseEntity<ErrorResponse> handleOptimisticLock(Exception ex) {
        ErrorResponse body = new ErrorResponse(
                HttpStatus.CONFLICT.value(),
                SprintConflictException.DEFAULT_MESSAGE,
                LocalDateTime.now()
        );
        return ResponseEntity.status(HttpStatus.CONFLICT).body(body);
    }

    /**
     * Last line of defence for the unique (project, name) constraint when two
     * concurrent requests pass the service-level duplicate check.
     */
    @ExceptionHandler(DataIntegrityViolationException.class)
    public ResponseEntity<ErrorResponse> handleDataIntegrityViolation(DataIntegrityViolationException ex) {
        ErrorResponse body = new ErrorResponse(
                HttpStatus.CONFLICT.value(),
                SprintConflictException.DEFAULT_MESSAGE,
                LocalDateTime.now()
        );
        return ResponseEntity.status(HttpStatus.CONFLICT).body(body);
    }
}
