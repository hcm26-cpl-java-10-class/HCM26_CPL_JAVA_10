package com.example.trainingprogram.controller;

import com.example.trainingprogram.dto.*;
import com.example.trainingprogram.entity.ProgramStatus;
import com.example.trainingprogram.service.TrainingProgramService;
import jakarta.validation.Valid;
import org.springframework.data.domain.*;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import java.util.Map;

@RestController
@RequestMapping("/api/programs")
public class TrainingProgramController {
    private final TrainingProgramService service;

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
        Sort.Direction direction = sortParts.length > 1 && "asc".equalsIgnoreCase(sortParts[1])
            ? Sort.Direction.ASC : Sort.Direction.DESC;
        Pageable pageable = PageRequest.of(Math.max(0, page), Math.min(Math.max(size, 1), 100),
            Sort.by(direction, sortParts[0]));
        return service.list(search, region, status, pageable);
    }

    @GetMapping("/{id}")
    public TrainingProgramResponse get(@PathVariable Long id) {
        return service.get(id);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public TrainingProgramResponse create(@Valid @RequestBody TrainingProgramRequest request) {
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
        @RequestBody Map<String, String> request
    ) {
        return service.cloneProgram(id, request.get("newVersion"));
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable Long id) {
        service.delete(id);
    }
}
