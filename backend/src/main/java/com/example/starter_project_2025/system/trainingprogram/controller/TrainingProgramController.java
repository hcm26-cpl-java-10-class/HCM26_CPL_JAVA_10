
package com.example.trainingprogram.controller;

import com.example.trainingprogram.dto.*;
import com.example.trainingprogram.entity.ProgramStatus;
import com.example.trainingprogram.service.TrainingProgramService;
import jakarta.validation.Valid;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.Set;

@RestController
@RequestMapping("/api/programs")
public class TrainingProgramController {

    private final TrainingProgramService service;

    private static final Set<String> ALLOWED_SORT_FIELDS = Set.of(
        "id",
        "code",
        "name",
        "version",
        "region",
        "status",
        "createdAt",
        "updatedAt"
    );

    public TrainingProgramController(TrainingProgramService service) {
        this.service = service;
    }

    @GetMapping
    public Page<TrainingProgramResponse> list(
        @RequestParam(required = false) String search,
        @RequestParam(required = false) String region,
        @RequestParam(required = false) ProgramStatus status,
        @RequestParam(defaultValue = "0") int page,
        @RequestParam(defaultValue = "10") int size,
        @RequestParam(defaultValue = "updatedAt,desc") String sort
    ) {
        String[] sortParts = sort.split(",", 2);

        String sortField = sortParts[0].trim();
        if (!ALLOWED_SORT_FIELDS.contains(sortField)) {
            sortField = "updatedAt";
        }

        Sort.Direction direction =
            sortParts.length > 1
                && "asc".equalsIgnoreCase(sortParts[1].trim())
                ? Sort.Direction.ASC
                : Sort.Direction.DESC;

        Pageable pageable = PageRequest.of(
            Math.max(0, page),
            Math.min(Math.max(size, 1), 100),
            Sort.by(direction, sortField)
        );

        return service.list(search, region, status, pageable);
    }

    @GetMapping("/{id}")
    public TrainingProgramResponse get(@PathVariable Long id) {
        return service.get(id);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public TrainingProgramResponse create(
        @Valid @RequestBody TrainingProgramRequest request
    ) {
        return service.create(request);
    }

    @PutMapping("/{id}")
    public TrainingProgramResponse update(
        @PathVariable Long id,
        @Valid @RequestBody TrainingProgramRequest request
    ) {
        return service.update(id, request);
    }

    @PatchMapping("/{id}/status")
    public TrainingProgramResponse changeStatus(
        @PathVariable Long id,
        @Valid @RequestBody ProgramStatusRequest request
    ) {
        return service.changeStatus(id, request.status());
    }

    @PostMapping("/{id}/clone")
    @ResponseStatus(HttpStatus.CREATED)
    public TrainingProgramResponse cloneProgram(
        @PathVariable Long id,
        @Valid @RequestBody CloneProgramRequest request
    ) {
        return service.cloneProgram(id, request.newVersion());
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable Long id) {
        service.delete(id);
    }
}
