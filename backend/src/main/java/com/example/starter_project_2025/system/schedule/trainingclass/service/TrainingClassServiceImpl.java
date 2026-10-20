package com.example.starter_project_2025.system.schedule.trainingclass.service;

import com.example.starter_project_2025.exception.BadRequestException;
import com.example.starter_project_2025.exception.ConflictException;
import com.example.starter_project_2025.exception.ResourceNotFoundException;
import com.example.starter_project_2025.system.schedule.trainingclass.*;
import com.example.starter_project_2025.system.schedule.trainingclass.dto.CreateTrainingClassRequest;
import com.example.starter_project_2025.system.schedule.trainingclass.dto.TrainingClassResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.server.ResponseStatusException;

@Service
@Validated
@RequiredArgsConstructor
public class TrainingClassServiceImpl implements TrainingClassService {

    private final TrainingClassRepository repository;
    private final TrainingClassMapper mapper;
    private final ObjectProvider<ProgramVersionChecker> checkerProvider;

    @Override
    @Transactional(readOnly = true)
    @PreAuthorize("hasRole('ADMIN') and hasAuthority('TRAINING_CLASS_READ')")
    public TrainingClassResponse getById(Long classId) {
        TrainingClass trainingClass = repository.findById(classId)
                .orElseThrow(() ->
                        new ResourceNotFoundException("Class not found"));

        return mapper.toResponse(trainingClass);
    }

    @Override
    @Transactional(readOnly = true)
    @PreAuthorize("hasRole('ADMIN') and hasAuthority('TRAINING_CLASS_READ')")
    public Page<TrainingClassResponse> getClasses(
            String search,
            ClassStatus status,
            String site,
            Pageable pageable) {

        String keyword = search == null ? "" : search.trim();
        String selectedSite = site == null ? "" : site.trim();

        return repository.searchClasses(
                keyword,
                status,
                selectedSite,
                pageable
        ).map(mapper::toResponse);
    }

    @Override
    @Transactional
    @PreAuthorize("hasRole('ADMIN') and hasAuthority('TRAINING_CLASS_CREATE')")
    public TrainingClassResponse create(CreateTrainingClassRequest request) {
        validateDates(request);

        String code = request.getCode().trim();

        if (repository.existsByCode(code)) {
            throw new ConflictException("Class code already exists");
        }

        validateProgramVersion(request.getProgramVersionId());

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

        return mapper.toResponse(repository.saveAndFlush(trainingClass));
    }

    @Override
    @Transactional
    @PreAuthorize("hasRole('ADMIN') and hasAuthority('TRAINING_CLASS_UPDATE')")
    public TrainingClassResponse update(
            Long classId,
            CreateTrainingClassRequest request) {

        TrainingClass trainingClass = repository.findById(classId)
                .orElseThrow(() ->
                        new ResourceNotFoundException("Class not found"));

        validateDates(request);

        String code = request.getCode().trim();

        if (repository.existsByCodeAndIdNot(code, classId)) {
            throw new ConflictException("Class code already exists");
        }

        validateProgramVersion(request.getProgramVersionId());

        trainingClass.setCode(code);
        trainingClass.setName(request.getName().trim());
        trainingClass.setTraineeType(request.getTraineeType().trim());
        trainingClass.setDeliveryFormat(request.getDeliveryFormat().trim());
        trainingClass.setSite(request.getSite().trim());
        trainingClass.setLocation(request.getLocation().trim());
        trainingClass.setProgramVersionId(request.getProgramVersionId());
        trainingClass.setStartDate(request.getStartDate());
        trainingClass.setEndDate(request.getEndDate());
        trainingClass.setCapacity(request.getCapacity());

        return mapper.toResponse(repository.saveAndFlush(trainingClass));
    }

    private void validateDates(CreateTrainingClassRequest request) {
        if (request.getEndDate().isBefore(request.getStartDate())) {
            throw new BadRequestException(
                    "End date must not be before start date"
            );
        }
    }

    private void validateProgramVersion(Long programVersionId) {
        ProgramVersionChecker checker = checkerProvider.getIfAvailable();

        if (checker == null) {
            throw new ResponseStatusException(
                    HttpStatus.SERVICE_UNAVAILABLE,
                    "Program version validation is unavailable"
            );
        }

        checker.validateForClass(programVersionId);
    }
    @Override
    @Transactional
    @PreAuthorize("hasRole('ADMIN') and hasAuthority('TRAINING_CLASS_DELETE')")
    public void deactivate(Long classId) {
        TrainingClass trainingClass = repository.findById(classId)
                .orElseThrow(() ->
                        new ResourceNotFoundException("Class not found"));

        if (Boolean.FALSE.equals(trainingClass.getIsActive())) {
            return;
        }

        trainingClass.setIsActive(false);
        repository.saveAndFlush(trainingClass);
    }
}