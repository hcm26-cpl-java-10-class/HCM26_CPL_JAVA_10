package com.example.starter_project_2025.system.schedule.trainingclass.service;

import com.example.starter_project_2025.exception.BadRequestException;
import com.example.starter_project_2025.exception.ConflictException;
import com.example.starter_project_2025.system.schedule.trainingclass.*;
import com.example.starter_project_2025.system.schedule.trainingclass.dto.CreateTrainingClassRequest;
import com.example.starter_project_2025.system.schedule.trainingclass.dto.TrainingClassResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.server.ResponseStatusException;
import com.example.starter_project_2025.exception.ResourceNotFoundException;

@Service
@Validated
@RequiredArgsConstructor

public class TrainingClassServiceImpl implements TrainingClassService {

    @Override
    @Transactional(readOnly = true)
    @PreAuthorize("hasRole('ADMIN') and hasAuthority('TRAINING_CLASS_READ')")
    public TrainingClassResponse getById(Long classId) {
        TrainingClass trainingClass = repository.findById(classId)
                .orElseThrow(() ->
                        new ResourceNotFoundException("Class not found"));

        return mapper.toResponse(trainingClass);
    }

    private final TrainingClassRepository repository;
    private final TrainingClassMapper mapper;
    private final ObjectProvider<ProgramVersionChecker> checkerProvider;

    @Override
    @Transactional
    @PreAuthorize(
            "hasRole('ADMIN') and hasAuthority('TRAINING_CLASS_CREATE')"
    )
    public TrainingClassResponse create(CreateTrainingClassRequest request) {

        if (request.getEndDate().isBefore(request.getStartDate())) {
            throw new BadRequestException(
                    "End date must not be before start date"
            );
        }

        String code = request.getCode().trim();

        if (repository.existsByCode(code)) {
            throw new ConflictException("Class code already exists");
        }

        ProgramVersionChecker checker = checkerProvider.getIfAvailable();

        if (checker == null) {
            throw new ResponseStatusException(
                    HttpStatus.SERVICE_UNAVAILABLE,
                    "Program version validation is unavailable"
            );
        }

        checker.validateForClass(request.getProgramVersionId());

        TrainingClass trainingClass = TrainingClass.builder()
                .code(code)
                .name(request.getName().trim())
                .traineeType(request.getTraineeType().trim())
                .deliveryFormat(request.getDeliveryFormat().trim())
                .site(request.getSite().trim())
                .location(request.getLocation().trim())
                .programVersionId(request.getProgramVersionId())
                .startDate(request.getStartDate())
                .endDate(request.getEndDate())
                .capacity(request.getCapacity())
                .status(ClassStatus.PLANNING)
                .build();

        TrainingClass savedClass = repository.saveAndFlush(trainingClass);

        return mapper.toResponse(savedClass);
    }
}