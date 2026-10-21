package com.example.starter_project_2025.system.schedule.session;

import com.example.starter_project_2025.base.dataio.importer.result.ImportResult;
import org.springframework.http.HttpStatus;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import com.example.starter_project_2025.base.crud.controller.BaseCrudDataIoController;
import com.example.starter_project_2025.base.crud.domain.BaseCrudRepository;
import com.example.starter_project_2025.base.crud.dto.OnCreate;
import com.example.starter_project_2025.base.crud.service.BaseCrudService;
import com.example.starter_project_2025.system.schedule.session.dto.ConflictCheckResponse;
import com.example.starter_project_2025.system.schedule.session.dto.SessionDTO;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import java.net.URI;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/sessions")
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
@Tag(name = "Schedule / Session", description = "APIs for managing class schedules and conflict detection")
public class SessionController
        extends BaseCrudDataIoController<Session, Long, SessionDTO, SessionFilter> {

    SessionService sessionService;
    SessionRepository sessionRepository;

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

    @Override
    @PostMapping("/import")
    public ImportResult importFile(
            @RequestParam(value = "file", required = false) MultipartFile file) {
        // Direct repository imports bypass calendar locks, publication rules and conflict checks.
        throw new ResponseStatusException(
                HttpStatus.METHOD_NOT_ALLOWED,
                "Create sessions through the scheduling service.");
    }

    @Override
    @PostMapping
    public ResponseEntity<SessionDTO> create(@Validated(OnCreate.class) @RequestBody SessionDTO request) {
        SessionDTO response = sessionService.create(request);
        return ResponseEntity.created(URI.create("/api/sessions/" + response.getId())).body(response);
    }

    @Override
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        sessionService.delete(id);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/check-conflict")
    @Operation(summary = "Check schedule conflict before saving")
    public ResponseEntity<ConflictCheckResponse> checkConflict(
            @RequestBody SessionDTO request,
            @RequestParam(required = false) Long excludeId
    ) {
        return ResponseEntity.ok(sessionService.checkConflict(request, excludeId));
    }

}
