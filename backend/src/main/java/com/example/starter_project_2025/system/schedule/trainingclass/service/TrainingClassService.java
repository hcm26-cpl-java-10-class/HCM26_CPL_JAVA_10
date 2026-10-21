package com.example.starter_project_2025.system.schedule.trainingclass.service;

import com.example.starter_project_2025.system.schedule.trainingclass.ClassStatus;
import com.example.starter_project_2025.system.schedule.trainingclass.dto.CreateTrainingClassRequest;
import com.example.starter_project_2025.system.schedule.trainingclass.dto.TrainingClassResponse;
import com.example.starter_project_2025.system.schedule.trainingclass.dto.UpdateTrainingClassRequest;
import com.example.starter_project_2025.system.schedule.trainingclass.dto.*;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import java.time.LocalDate;
import java.util.List;

public interface TrainingClassService {

    TrainingClassResponse create(
            @NotNull @Valid CreateTrainingClassRequest request);

    TrainingClassResponse getById(Long classId);

    Page<TrainingClassResponse> getClasses(
            String search,
            ClassStatus status,
            String site,
            Long programVersionId,
            LocalDate startDateFrom,
            LocalDate startDateTo,
            Pageable pageable);

    TrainingClassResponse update(
            Long classId,
            @NotNull @Valid UpdateTrainingClassRequest request);
    void deactivate(Long classId);
    TrainingClassResponse getPublished(Long classId);
    List<TrainingClassRevisionResponse> getRevisions(Long classId);
    TrainingClassResponse createDraft(Long classId, @NotNull @Valid CreateClassDraftRequest request);
    TrainingClassResponse submit(Long classId, Long revisionId, @NotNull @Valid ClassRevisionActionRequest request);
    TrainingClassResponse approve(Long classId, Long revisionId, @NotNull @Valid ClassRevisionActionRequest request);
    TrainingClassResponse reject(Long classId, Long revisionId, @NotNull @Valid RejectClassRevisionRequest request);
}
