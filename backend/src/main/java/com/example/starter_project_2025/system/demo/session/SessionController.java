package com.example.starter_project_2025.system.demo.session;

import java.util.List;
import org.springframework.web.bind.annotation.DeleteMapping;

import com.example.starter_project_2025.base.crud.controller.BaseCrudDataIoController;
import com.example.starter_project_2025.base.crud.domain.BaseCrudRepository;
import com.example.starter_project_2025.base.crud.service.BaseCrudService;
import com.example.starter_project_2025.base.dataio.common.FileFormat;
import com.example.starter_project_2025.base.dataio.importer.result.ImportResult;
import com.example.starter_project_2025.system.demo.session.SessionService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/sessions")
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
@Tag(name = "Class Schedule & Session", description = "APIs for managing class training sessions")
public class SessionController
        extends BaseCrudDataIoController<Session, Long, SessionDTO, SessionFilter> {

    SessionService sessionService;
    SessionRepository sessionRepository;
    SessionImportGuard sessionImportGuard;

    @Override
    protected BaseCrudService<Long, SessionDTO, SessionFilter> getService() {
        return sessionService;
    }

    @Override
    protected BaseCrudRepository<Session, Long> getRepository() {
        return sessionRepository;
    }

    @Override
    protected Class<Session> getEntityClass() {
        return Session.class;
    }

    @PatchMapping("/{id}/cancel")
    @Operation(summary = "Cancel a scheduled session with a reason")
    public ResponseEntity<SessionDTO> cancelSession(
            @PathVariable Long id,
            @Valid @RequestBody SessionCancelDTO cancelDTO) {
        SessionDTO updatedSession = sessionService.cancelSession(id, cancelDTO);
        return ResponseEntity.ok(updatedSession);
    }

    @PatchMapping("/{id}/complete")
    @Operation(summary = "Mark a scheduled session as completed")
    public ResponseEntity<SessionDTO> completeSession(@PathVariable Long id) {
        return ResponseEntity.ok(sessionService.completeSession(id));
    }

    @PatchMapping("/{id}/reschedule")
    @Operation(summary = "Move a scheduled session to a new time slot (and optionally another room)")
    public ResponseEntity<SessionDTO> rescheduleSession(
            @PathVariable Long id,
            @Valid @RequestBody SessionRescheduleDTO rescheduleDTO) {
        return ResponseEntity.ok(sessionService.rescheduleSession(id, rescheduleDTO));
    }

    @PostMapping("/{id}/duplicate")
    @Operation(summary = "Create a new scheduled session from an existing one, on a new time slot")
    public ResponseEntity<SessionDTO> duplicateSession(
            @PathVariable Long id,
            @Valid @RequestBody SessionDuplicateDTO duplicateDTO) {
        return ResponseEntity.ok(sessionService.duplicateSession(id, duplicateDTO));
    }

    // The generic import/export endpoints do no permission check of their own, so they are guarded here
    // exactly like the other data-io controllers (see CourseController).
    @Override
    @GetMapping("/export")
    @PreAuthorize("hasAuthority('SESSION_READ')")
    public void exportFile(
            @RequestParam(defaultValue = "EXCEL") FileFormat format,
            HttpServletResponse response
    ) throws IOException {
        super.exportFile(format, response);
    }

    @Override
    @PostMapping(value = "/import", consumes = "multipart/form-data")
    @PreAuthorize("hasAuthority('SESSION_CREATE')")
    public ImportResult importFile(@RequestParam("file") MultipartFile file) {
        // Same importer as every other entity, but each row is validated like a created session (see SessionImportGuard)
        return importService.importFile(file, Session.class, sessionImportGuard.guard(sessionRepository));
    }

    @PostMapping("/batch")
    @PreAuthorize("hasAuthority('SESSION_CREATE')")
    @Operation(summary = "Batch create scheduled sessions for a class schedule version")
    public ResponseEntity<List<SessionDTO>> createBatch(@Valid @RequestBody List<SessionDTO> dtos) {
        return ResponseEntity.ok(sessionService.createValidatedBatch(dtos));
    }

    @DeleteMapping("/class/{classId}")
    @PreAuthorize("hasAuthority('SESSION_DELETE')")
    @Operation(summary = "Clear all sessions of a class to allow rescheduling")
    public ResponseEntity<Void> deleteByClassId(@PathVariable Long classId) {
        List<Session> sessions = sessionRepository.findByClassId(classId);
        if (!sessions.isEmpty()) {
            sessionRepository.deleteAll(sessions);
        }
        return ResponseEntity.noContent().build();
    }
}