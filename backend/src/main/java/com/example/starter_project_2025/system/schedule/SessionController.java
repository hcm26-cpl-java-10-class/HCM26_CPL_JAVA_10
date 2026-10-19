package com.example.starter_project_2025.system.schedule;

import com.example.starter_project_2025.base.crud.controller.BaseCrudDataIoController;
import com.example.starter_project_2025.base.crud.domain.BaseCrudRepository;
import com.example.starter_project_2025.base.crud.service.BaseCrudService;
import com.example.starter_project_2025.system.schedule.dto.ConflictCheckResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/sessions")
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
@Tag(name = "Schedule / Session", description = "APIs for managing class schedules and conflict detection (FR-CAL-03)")
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

    @PostMapping("/check-conflict")
    @Operation(summary = "Check schedule conflict before saving (FR-CAL-03)")
    public ResponseEntity<ConflictCheckResponse> checkConflict(
            @RequestBody SessionDTO request,
            @RequestParam(required = false) Long excludeId
    ) {
        return ResponseEntity.ok(sessionService.checkConflict(request, excludeId));
    }

    @PatchMapping("/{id}/status")
    @Operation(summary = "Change the status of session")
    public ResponseEntity<SessionDTO> changeSessionStatus(@PathVariable Long id,  @RequestParam SessionStatus status) {
        return  ResponseEntity.ok(sessionService.changeStatus(id, status));
    }

}
