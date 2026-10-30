package com.example.starter_project_2025.system.study_session;

import com.example.starter_project_2025.base.crud.controller.BaseCrudDataIoController;
import com.example.starter_project_2025.base.crud.domain.BaseCrudRepository;
import com.example.starter_project_2025.base.crud.service.BaseCrudService;
import com.example.starter_project_2025.base.crud.validation.ValidationContext;
import com.example.starter_project_2025.base.dataio.importer.result.ImportResult;
import com.example.starter_project_2025.base.dataio.importer.service.GenericImportService;
import com.example.starter_project_2025.system.academic.subject.SubjectRepository;
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
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.multipart.MultipartFile;

import java.util.Map;
import java.util.stream.Collectors;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/study-sessions")
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
@Tag(name = "Study Session", description = "APIs for managing study sessions")
public class StudySessionController
        extends BaseCrudDataIoController<StudySession, Long, StudySessionDTO, StudySessionFilter> {

    StudySessionService studySessionService;
    StudySessionRepository studySessionRepository;
    GenericImportService studySessionImportService;
    SubjectRepository subjectRepository;
    StudySessionValidator studySessionValidator;

    @Override
    @PostMapping(value = "/import", consumes = "multipart/form-data")
    public ImportResult importFile(@RequestParam("file") MultipartFile file) {
        return studySessionImportService.importFile(file, StudySession.class, studySessionRepository, session -> {
            ValidationContext ctx = new ValidationContext();
            studySessionValidator.validateImport(session, ctx);
            if (session.getSubjectId() == null || !subjectRepository.existsById(session.getSubjectId())) {
                ctx.add("subjectId", "Subject ID " + session.getSubjectId()
                        + " does not exist. Select an existing Subject ID from Subjects before importing.");
            }
            if (ctx.hasErrors()) {
                throw new IllegalArgumentException(ctx.getErrors().entrySet().stream()
                        .sorted(Map.Entry.comparingByKey())
                        .flatMap(entry -> entry.getValue().stream().map(message -> entry.getKey() + ": " + message))
                        .collect(Collectors.joining("; ")));
            }
        });
    }

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
