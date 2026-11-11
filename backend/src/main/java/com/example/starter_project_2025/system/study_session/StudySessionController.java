package com.example.starter_project_2025.system.study_session;

import com.example.starter_project_2025.base.crud.domain.BaseCrudRepository;
import com.example.starter_project_2025.base.crud.service.BaseCrudService;
import com.example.starter_project_2025.base.crud.validation.ValidationContext;
import com.example.starter_project_2025.base.dataio.importer.result.ImportResult;
import com.example.starter_project_2025.system.subject.SubjectRepository;
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

import org.springframework.http.ResponseEntity;
import java.util.Map;
import java.util.stream.Collectors;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/study-sessions")
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
@Tag(name = "Study Session", description = "APIs for managing study sessions")
public class StudySessionController
        extends com.example.starter_project_2025.base.crud.controller.BaseCrudController<Long, StudySessionDTO, StudySessionFilter> {

    @org.springframework.beans.factory.annotation.Autowired
    @lombok.experimental.NonFinal
    com.example.starter_project_2025.base.dataio.exporter.service.ExportService exportService;

    @org.springframework.web.bind.annotation.GetMapping("/export")
    public void exportFile(
            @RequestParam(defaultValue = "EXCEL") com.example.starter_project_2025.base.dataio.common.FileFormat format,
            @RequestParam(required = false) String search,
            @org.springframework.web.bind.annotation.ModelAttribute StudySessionFilter filter,
            org.springframework.data.domain.Pageable pageable,
            jakarta.servlet.http.HttpServletResponse response) throws java.io.IOException {
        var sort = pageable.getSort().isUnsorted()
                ? org.springframework.data.domain.Sort.by("sessionDate", "startTime", "id") : pageable.getSort();
        var sessions = studySessionService.getAll(org.springframework.data.domain.Pageable.unpaged(sort), search, filter).getContent();
        exportService.export(format, sessions, StudySessionDTO.class, response);
    }

    StudySessionService studySessionService;
    StudySessionRepository studySessionRepository;
    StudySessionImportService studySessionImportService;
    SubjectRepository subjectRepository;
    StudySessionValidator studySessionValidator;
    StudySessionAssignmentResolver assignmentResolver;

    @org.springframework.web.bind.annotation.GetMapping("/statistics")
    public StudySessionStatistics statistics(
            @RequestParam(required = false) Long subjectId,
            @RequestParam(required = false) @org.springframework.format.annotation.DateTimeFormat(iso = org.springframework.format.annotation.DateTimeFormat.ISO.DATE) java.time.LocalDate sessionDateFrom,
            @RequestParam(required = false) @org.springframework.format.annotation.DateTimeFormat(iso = org.springframework.format.annotation.DateTimeFormat.ISO.DATE) java.time.LocalDate sessionDateTo) {
        return studySessionService.statistics(subjectId, sessionDateFrom, sessionDateTo);
    }

    @PostMapping(value = "/import", consumes = "multipart/form-data")
    @org.springframework.security.access.prepost.PreAuthorize("hasAuthority('STUDY_SESSION_CREATE')")
    public ImportResult importFile(@RequestParam("file") MultipartFile file) {
        return studySessionImportService.importFile(file, studySessionRepository, session -> {
            ValidationContext ctx = new ValidationContext();
            studySessionValidator.validateImport(session, ctx);
            var resolved = assignmentResolver.resolveImport(session, ctx);
            if (resolved != null) {
                session.setProgramSubjectId(resolved.programSubjectId());
                session.setTrainerId(resolved.trainerId());
            }
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

    protected BaseCrudRepository<StudySession, Long> getRepository() {
        return studySessionRepository;
    }

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

    @org.springframework.web.bind.annotation.DeleteMapping("/bulk")
    public ResponseEntity<Map<String, Object>> deleteBulk(@RequestBody java.util.List<Long> ids) {
        if (ids == null || ids.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("message", "Session IDs list cannot be empty"));
        }
        studySessionRepository.deleteAllById(ids);
        return ResponseEntity.ok(Map.of("message", "Deleted " + ids.size() + " sessions successfully", "count", ids.size()));
    }

    @org.springframework.web.bind.annotation.DeleteMapping("/classes/{classId}")
    public ResponseEntity<Map<String, Object>> deleteByClass(@PathVariable Long classId) {
        var sessions = studySessionRepository.findAll().stream()
                .filter(s -> java.util.Objects.equals(s.getClassId(), classId))
                .toList();
        studySessionRepository.deleteAll(sessions);
        return ResponseEntity.ok(Map.of("message", "Deleted " + sessions.size() + " sessions for class " + classId, "count", sessions.size()));
    }
}
