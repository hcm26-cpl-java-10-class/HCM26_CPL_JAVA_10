package com.example.starter_project_2025.system.study_session;

import com.example.starter_project_2025.base.crud.controller.BaseCrudDataIoController;
import com.example.starter_project_2025.base.crud.domain.BaseCrudRepository;
import com.example.starter_project_2025.base.crud.service.BaseCrudService;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;

import java.util.Map;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/study-sessions")
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
@Tag(name = "Study Session", description = "APIs for managing study sessions")
public class StudySessionController
        extends BaseCrudDataIoController<StudySession, Long, StudySessionDTO, StudySessionFilter> {

    StudySessionService studySessionService;
    StudySessionRepository studySessionRepository;

    @Override
    protected BaseCrudService<Long, StudySessionDTO, StudySessionFilter> getService() {
        return studySessionService;
    }

    @Override
    protected BaseCrudRepository<StudySession, Long> getRepository() {
        return studySessionRepository;
    }

    @Override
    protected Class<StudySession> getEntityClass() {
        return StudySession.class;
    }

    @PatchMapping("/{id}/status")
    public StudySessionDTO updateStatus(
            @PathVariable Long id,
            @RequestBody Map<String, Boolean> request
    ) {
        return studySessionService.updateStatus(id, request.get("isActive"));
    }

    @PatchMapping("/{id}/cancel")
    public StudySessionDTO cancel(
            @PathVariable Long id,
            @Valid @RequestBody CancelSessionRequest request
    ) {
        return studySessionService.cancel(id, request);
    }

    @PatchMapping("/{id}/complete")
    public StudySessionDTO complete(
            @PathVariable Long id,
            @Valid
            @RequestBody(required = false)
            CompleteSessionRequest request
    ) {
        return studySessionService.complete(id, request);
    }
}