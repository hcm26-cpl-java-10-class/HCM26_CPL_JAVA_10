package com.example.starter_project_2025.system.schedule.trainingclass;

import com.example.starter_project_2025.system.schedule.trainingclass.dto.CreateTrainingClassRequest;
import com.example.starter_project_2025.system.schedule.trainingclass.dto.TrainingClassResponse;
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

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/classes")
public class TrainingClassController {


    private final TrainingClassService service;
    @GetMapping
    public ResponseEntity<Page<TrainingClassResponse>> getClasses(
            @RequestParam(name = "search", defaultValue = "") String search,
            @PageableDefault(sort = "id") Pageable pageable) {

        return ResponseEntity.ok(service.getClasses(search, pageable));
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
}