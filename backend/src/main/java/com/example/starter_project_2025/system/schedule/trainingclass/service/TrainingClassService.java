package com.example.starter_project_2025.system.schedule.trainingclass.service;

import com.example.starter_project_2025.system.schedule.trainingclass.dto.CreateTrainingClassRequest;
import com.example.starter_project_2025.system.schedule.trainingclass.dto.TrainingClassResponse;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

public interface TrainingClassService {

    TrainingClassResponse create(
            @NotNull @Valid CreateTrainingClassRequest request);

    TrainingClassResponse getById(Long classId);
    Page<TrainingClassResponse> getClasses(String search, Pageable pageable);
}