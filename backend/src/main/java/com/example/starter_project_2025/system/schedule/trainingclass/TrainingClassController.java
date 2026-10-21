package com.example.starter_project_2025.system.schedule.trainingclass;

import com.example.starter_project_2025.system.schedule.trainingclass.dto.CreateTrainingClassRequest;
import com.example.starter_project_2025.system.schedule.trainingclass.dto.TrainingClassResponse;
import com.example.starter_project_2025.system.schedule.trainingclass.dto.UpdateTrainingClassRequest;
import com.example.starter_project_2025.system.schedule.trainingclass.dto.*;
import com.example.starter_project_2025.system.schedule.trainingclass.service.TrainingClassService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.web.bind.annotation.RequestParam;
import java.time.LocalDate;
import org.springframework.format.annotation.DateTimeFormat;
import java.util.List;
import java.util.Map;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.web.server.ResponseStatusException;


@RestController
@RequiredArgsConstructor
@RequestMapping("/api/classes")
public class TrainingClassController {


    private final TrainingClassService service;
    private final ObjectProvider<OpenClassRequestChecker>
            requestCheckerProvider;
    @GetMapping("/request-options")
    @PreAuthorize("hasAuthority('TRAINING_CLASS_CREATE')")
    public ResponseEntity<List<OpenClassRequestChecker.CreateOption>>
    getRequestOptions() {
        OpenClassRequestChecker checker =
                requestCheckerProvider.getIfAvailable();

        if (checker == null) {
            throw new ResponseStatusException(
                    HttpStatus.SERVICE_UNAVAILABLE,
                    "Open class request validation is unavailable"
            );
        }

        return ResponseEntity.ok(checker.getCreateOptions());
    }
    @GetMapping
    public ResponseEntity<Page<TrainingClassResponse>> getClasses(
            @RequestParam(name = "search", defaultValue = "") String search,
            @RequestParam(name = "status", required = false) ClassStatus status,
            @RequestParam(name = "site", defaultValue = "") String site,
            @RequestParam(name = "programVersionId", required = false)
            Long programVersionId,
            @RequestParam(name = "startDateFrom", required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
            LocalDate startDateFrom,
            @RequestParam(name = "startDateTo", required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
            LocalDate startDateTo,
            @PageableDefault(sort = "id") Pageable pageable) {

        return ResponseEntity.ok(service.getClasses(
                search,
                status,
                site,
                programVersionId,
                startDateFrom,
                startDateTo,
                pageable
        ));
    }
    @GetMapping("/create-options")
    @PreAuthorize(
            "hasAnyAuthority('TRAINING_CLASS_CREATE', 'TRAINING_CLASS_UPDATE')"
    )
    public ResponseEntity<Map<String, Object>>
    getCreateOptions() {
        return ResponseEntity.ok(Map.of(
                "sites", TrainingClassCatalog.sites(),
                "locations", TrainingClassCatalog.locations(),
                "traineeTypes", TrainingClassCatalog.traineeTypes(),
                "deliveryFormats", TrainingClassCatalog.deliveryFormats()
        ));
    }

    @PostMapping
    public ResponseEntity<TrainingClassResponse> create(
            @Valid @RequestBody CreateTrainingClassRequest request) {

        TrainingClassResponse response = service.create(request);

        return ResponseEntity
                .status(HttpStatus.CREATED)
                .body(response);
    }
    @GetMapping("/{classId}")
    public ResponseEntity<TrainingClassResponse> getById(
            @PathVariable("classId") Long classId) {
        return ResponseEntity.ok(service.getById(classId));
    }
    @PutMapping("/{classId}")
    public ResponseEntity<TrainingClassResponse> update(
            @PathVariable("classId") Long classId,
            @Valid @RequestBody UpdateTrainingClassRequest request) {

        return ResponseEntity.ok(service.update(classId, request));
    }

    @DeleteMapping("/{classId}")
    public ResponseEntity<Void> deactivate(
            @PathVariable("classId") Long classId) {

        service.deactivate(classId);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/{classId}/published")
    public TrainingClassResponse getPublished(@PathVariable Long classId) {
        return service.getPublished(classId);
    }

    @GetMapping("/{classId}/revisions")
    public List<TrainingClassRevisionResponse> getRevisions(@PathVariable Long classId) {
        return service.getRevisions(classId);
    }

    @PostMapping("/{classId}/revisions")
    public ResponseEntity<TrainingClassResponse> createDraft(@PathVariable Long classId,
            @Valid @RequestBody CreateClassDraftRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(service.createDraft(classId, request));
    }

    @PostMapping("/{classId}/revisions/{revisionId}/submit")
    public TrainingClassResponse submit(@PathVariable Long classId, @PathVariable Long revisionId,
            @Valid @RequestBody ClassRevisionActionRequest request) {
        return service.submit(classId, revisionId, request);
    }

    @PostMapping("/{classId}/revisions/{revisionId}/approve")
    public TrainingClassResponse approve(@PathVariable Long classId, @PathVariable Long revisionId,
            @Valid @RequestBody ClassRevisionActionRequest request) {
        return service.approve(classId, revisionId, request);
    }

    @PostMapping("/{classId}/revisions/{revisionId}/reject")
    public TrainingClassResponse reject(@PathVariable Long classId, @PathVariable Long revisionId,
            @Valid @RequestBody RejectClassRevisionRequest request) {
        return service.reject(classId, revisionId, request);
    }
}
