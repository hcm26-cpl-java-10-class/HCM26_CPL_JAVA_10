package com.example.starter_project_2025.system.schedule.trainingclass;

import com.example.starter_project_2025.system.schedule.trainingclass.dto.CreateTrainingClassRequest;
import com.example.starter_project_2025.system.schedule.trainingclass.dto.TrainingClassResponse;
import com.example.starter_project_2025.system.schedule.trainingclass.service.TrainingClassService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/classes")
public class TrainingClassController {

    private final TrainingClassService service;

    @PostMapping
    public ResponseEntity<TrainingClassResponse> create(
            @Valid @RequestBody CreateTrainingClassRequest request) {

        TrainingClassResponse response = service.create(request);

        return ResponseEntity
                .status(HttpStatus.CREATED)
                .body(response);
    }
}