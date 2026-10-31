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
    com.example.starter_project_2025.base.dataio.importer.parser.ParserFactory parserFactory;
    com.example.starter_project_2025.base.dataio.importer.mapper.GenericImportMapper importMapper;
    SessionMapper sessionMapper;

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
        var result = new com.example.starter_project_2025.base.dataio.importer.result.ImportResult();
        try (var input = file.getInputStream()) {
            var rows = parserFactory.getParser(file.getOriginalFilename()).parse(input);
            var requests = new java.util.ArrayList<SessionDTO>();
            for (int i = 0; i < rows.size(); i++) {
                try {
                    requests.add(sessionMapper.toDto(importMapper.map(rows.get(i), Session.class)));
                } catch (RuntimeException ex) {
                    result.getErrors().add(new com.example.starter_project_2025.base.dataio.importer.result.RowError(i + 2, ex.getMessage()));
                }
            }
            if (!result.getErrors().isEmpty()) {
                result.setFailureCount(rows.size());
                return result;
            }
            try {
                sessionService.createValidatedBatch(requests);
                result.setSuccessCount(requests.size());
            } catch (com.example.starter_project_2025.system.schedule.ScheduleValidationException ex) {
                result.setFailureCount(rows.size());
                ex.getResult().issues().forEach(issue -> result.getErrors().add(
                        new com.example.starter_project_2025.base.dataio.importer.result.RowError(
                                issue.candidateIndex() < 0 ? 1 : issue.candidateIndex() + 2,
                                issue.message() + (issue.relatedSessionId() == null ? "" : " (session #" + issue.relatedSessionId() + ")")
                                + (issue.relatedCandidateIndex() == null ? "" : " (row " + (issue.relatedCandidateIndex() + 2) + ")"))));
            }
            return result;
        } catch (java.io.IOException ex) {
            throw new IllegalArgumentException("The import file could not be read. Verify the file format and try again.", ex);
        }
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
