package com.example.starter_project_2025.system.demo.session;

import com.example.starter_project_2025.base.crud.controller.BaseCrudDataIoController;
import com.example.starter_project_2025.base.crud.domain.BaseCrudRepository;
import com.example.starter_project_2025.base.crud.service.BaseCrudService;
import com.example.starter_project_2025.system.demo.session.SessionService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;


@RestController
@RequiredArgsConstructor
@RequestMapping("/api/sessions")
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
@Tag(name = "Class Schedule & Session", description = "APIs for managing class training sessions")
public class SessionController
        extends BaseCrudDataIoController<Session, Long, SessionDTO, SessionFilter> {

    SessionService sessionService;
    SessionRepository sessionRepository;
    SessionImportService sessionImportService;

    @Override
    @org.springframework.web.bind.annotation.GetMapping("/export")
    @org.springframework.security.access.prepost.PreAuthorize("hasAuthority('SESSION_READ')")
    public void exportFile(
            @org.springframework.web.bind.annotation.RequestParam(defaultValue = "EXCEL") com.example.starter_project_2025.base.dataio.common.FileFormat format,
            jakarta.servlet.http.HttpServletResponse response) throws java.io.IOException {
        super.exportFile(format, response);
    }

    /** Prevent the generic importer from bypassing schedule validation. No partial writes. */
    @Override
    @org.springframework.web.bind.annotation.PostMapping(value = "/import", consumes = "multipart/form-data")
    @org.springframework.security.access.prepost.PreAuthorize("hasAuthority('SESSION_CREATE') and hasAuthority('SESSION_READ')")
    public com.example.starter_project_2025.base.dataio.importer.result.ImportResult importFile(
            @org.springframework.web.bind.annotation.RequestParam("file") org.springframework.web.multipart.MultipartFile file) {
        return sessionImportService.importFile(file);
    }

    @org.springframework.web.bind.annotation.PostMapping(value = "/import/preview", consumes = "multipart/form-data")
    @org.springframework.security.access.prepost.PreAuthorize("hasAuthority('SESSION_CREATE') and hasAuthority('SESSION_READ')")
    public SessionImportPreview previewImport(
            @org.springframework.web.bind.annotation.RequestParam("file") org.springframework.web.multipart.MultipartFile file) {
        return sessionImportService.preview(file);
    }

    @org.springframework.web.bind.annotation.PostMapping("/import/preview-rows")
    @org.springframework.security.access.prepost.PreAuthorize("hasAuthority('SESSION_CREATE') and hasAuthority('SESSION_READ')")
    public SessionImportPreview previewImportRows(@Valid @RequestBody SessionImportRowsRequest request) {
        return sessionImportService.previewRows(request);
    }

    @org.springframework.web.bind.annotation.PostMapping("/import/rows")
    @org.springframework.security.access.prepost.PreAuthorize("hasAuthority('SESSION_CREATE') and hasAuthority('SESSION_READ')")
    public com.example.starter_project_2025.base.dataio.importer.result.ImportResult importEditedRows(
            @Valid @RequestBody SessionImportRowsRequest request) {
        return sessionImportService.importRows(request);
    }

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
}
