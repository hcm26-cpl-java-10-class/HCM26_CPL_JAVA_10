package com.example.starter_project_2025.system.schedule.session;

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
    @PostMapping
    public ResponseEntity<SessionDTO> create(@Validated(OnCreate.class) @RequestBody SessionDTO request) {
        SessionDTO response = sessionService.create(request);
        return ResponseEntity.created(URI.create("/api/sessions/" + response.getId())).body(response);
    }

    @PostMapping("/check-conflict")
    @Operation(summary = "Check schedule conflict before saving")
    public ResponseEntity<ConflictCheckResponse> checkConflict(
            @RequestBody SessionDTO request,
            @RequestParam(required = false) Long excludeId
    ) {
        return ResponseEntity.ok(sessionService.checkConflict(request, excludeId));
    }

    @PatchMapping("/{id}/status")
    @Operation(summary = "Change the status of session")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<SessionDTO> changeSessionStatus(@PathVariable Long id,  @RequestParam SessionStatus status) {
        return  ResponseEntity.ok(sessionService.changeStatus(id, status));
    }

}
