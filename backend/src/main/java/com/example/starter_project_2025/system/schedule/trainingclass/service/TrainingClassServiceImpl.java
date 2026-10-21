package com.example.starter_project_2025.system.schedule.trainingclass.service;

import com.example.starter_project_2025.exception.BadRequestException;
import com.example.starter_project_2025.exception.ConflictException;
import com.example.starter_project_2025.exception.BusinessValidationException;
import com.example.starter_project_2025.exception.ResourceNotFoundException;
import com.example.starter_project_2025.security.AuditorProvider;
import com.example.starter_project_2025.system.schedule.trainingclass.*;
import com.example.starter_project_2025.system.schedule.trainingclass.dto.*;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Objects;

@Service
@Validated
@RequiredArgsConstructor
public class TrainingClassServiceImpl implements TrainingClassService {
    private final TrainingClassRepository repository;
    private final TrainingClassRevisionRepository revisions;
    private final TrainingClassMapper mapper;
    private final ObjectProvider<ProgramVersionChecker> checkerProvider;
    private final ObjectProvider<OpenClassRequestChecker> requestCheckerProvider;
    private final ObjectProvider<TrainingClassChangeChecker> changeCheckerProvider;
    private final AuditorProvider auditor;

    @Override
    @Transactional(readOnly = true)
    @PreAuthorize("hasAuthority('TRAINING_CLASS_READ')")
    public TrainingClassResponse getById(Long classId) {
        TrainingClass trainingClass = find(classId);
        if (trainingClass.getCurrentRevision() == null && !canManageDrafts()) {
            throw new ResourceNotFoundException("Published class not found");
        }
        return mapper.toResponse(trainingClass);
    }

    @Override
    @Transactional(readOnly = true)
    @PreAuthorize("hasAuthority('TRAINING_CLASS_READ')")
    public TrainingClassResponse getPublished(Long classId) {
        TrainingClass trainingClass = find(classId);
        if (!Boolean.TRUE.equals(trainingClass.getIsActive()) || trainingClass.getCurrentRevision() == null) {
            throw new ResourceNotFoundException("Published class not found");
        }
        return mapper.toResponse(trainingClass);
    }

    @Override
    @Transactional(readOnly = true)
    @PreAuthorize("hasAuthority('TRAINING_CLASS_READ')")
    public Page<TrainingClassResponse> getClasses(String search, ClassStatus status, String site,
            Long programVersionId, LocalDate startDateFrom, LocalDate startDateTo, Pageable pageable) {
        if (programVersionId != null && programVersionId <= 0) {
            throw new BadRequestException("Program version ID must be greater than 0");
        }
        if (startDateFrom != null && startDateTo != null && startDateFrom.isAfter(startDateTo)) {
            throw new BadRequestException("Start date From must not be after To");
        }
        return repository.searchClasses(canManageDrafts(), search == null ? "" : search.trim(), status,
                site == null ? "" : site.trim(), programVersionId, startDateFrom, startDateTo, pageable)
                .map(mapper::toResponse);
    }

    @Override
    @Transactional
    @PreAuthorize("hasAuthority('TRAINING_CLASS_CREATE')")
    public TrainingClassResponse create(CreateTrainingClassRequest request) {
        validateDates(request.getStartDate(), request.getEndDate());
        validateCapacity(request.getCapacity());
        String code = request.getCode().trim();
        if (repository.existsByCode(code)) throw TrainingClassConflictException.duplicateCode();
        validateReferences(request.getOpenClassRequestId(), request.getProgramVersionId());
        TrainingClass trainingClass = TrainingClass.builder()
                .code(code).openClassRequestId(request.getOpenClassRequestId())
                .programVersionId(request.getProgramVersionId()).status(ClassStatus.PLANNING)
                .name(request.getName().trim()).description(description(request.getDescription()))
                .traineeType(TrainingClassCatalog.requireTraineeType(request.getTraineeType()))
                .deliveryFormat(TrainingClassCatalog.requireDeliveryFormat(request.getDeliveryFormat()))
                .site(TrainingClassCatalog.requireSite(request.getSite()))
                .location(TrainingClassCatalog.requireLocation(request.getLocation(), request.getSite()))
                .startDate(request.getStartDate()).endDate(request.getEndDate()).capacity(request.getCapacity()).build();
        repository.saveAndFlush(trainingClass);
        newDraft(trainingClass);
        return persist(trainingClass);
    }

    @Override
    @Transactional
    @PreAuthorize("hasAuthority('TRAINING_CLASS_UPDATE')")
    public TrainingClassResponse createDraft(Long classId, CreateClassDraftRequest request) {
        TrainingClass trainingClass = locked(classId, request.getVersion());
        if (trainingClass.getPendingRevision() != null) {
            throw new ConflictException("This class already has a Draft or Under review revision");
        }
        newDraft(trainingClass);
        return persist(trainingClass);
    }

    @Override
    @Transactional
    @PreAuthorize("hasAuthority('TRAINING_CLASS_UPDATE')")
    public TrainingClassResponse update(Long classId, UpdateTrainingClassRequest request) {
        TrainingClass trainingClass = locked(classId, request.getVersion());
        TrainingClassRevision draft = pending(trainingClass, request.getRevisionId(), request.getRevisionVersion());
        requireStatus(draft, ClassRevisionStatus.DRAFT);
        if (!Objects.equals(trainingClass.getCode(), request.getCode().trim())
                || !Objects.equals(trainingClass.getProgramVersionId(), request.getProgramVersionId())) {
            throw new ConflictException("Class code and training program remain fixed after creation");
        }
        validateDates(request.getStartDate(), request.getEndDate());
        validateOngoingStartDate(trainingClass, request.getStartDate());
        validateCapacity(request.getCapacity());
        String location = TrainingClassCatalog.requireLocation(request.getLocation(), request.getSite());
        draft.setName(request.getName().trim());
        draft.setDescription(description(request.getDescription()));
        draft.setTraineeType(TrainingClassCatalog.requireTraineeType(request.getTraineeType()));
        draft.setDeliveryFormat(TrainingClassCatalog.requireDeliveryFormat(request.getDeliveryFormat()));
        draft.setSite(TrainingClassCatalog.requireSite(request.getSite()));
        draft.setLocation(location);
        draft.setStartDate(request.getStartDate());
        draft.setEndDate(request.getEndDate());
        draft.setCapacity(request.getCapacity());
        revisions.saveAndFlush(draft);
        // Approved snapshots remain in the root projection; unapproved data is only a management preview.
        if (trainingClass.getCurrentRevision() == null) applySnapshot(trainingClass, draft);
        return persist(trainingClass);
    }

    @Override
    @Transactional(readOnly = true)
    @PreAuthorize("hasAuthority('TRAINING_CLASS_READ') and "
            + "hasAnyAuthority('TRAINING_CLASS_CREATE','TRAINING_CLASS_UPDATE','TRAINING_CLASS_SUBMIT','TRAINING_CLASS_APPROVE')")
    public List<TrainingClassRevisionResponse> getRevisions(Long classId) {
        TrainingClass trainingClass = find(classId);
        return revisions.findByTrainingClass_IdOrderByRevisionNoDesc(classId).stream().map(revision -> {
            TrainingClassRevisionResponse response = mapper.toRevisionResponse(revision);
            response.setDependencyValidationRequired(trainingClass.getCurrentRevision() != null
                    && (revision.getStatus() == ClassRevisionStatus.DRAFT || revision.getStatus() == ClassRevisionStatus.UNDER_REVIEW)
                    && operationalChanges(trainingClass, revision));
            return response;
        }).toList();
    }

    @Override
    @Transactional
    @PreAuthorize("hasAuthority('TRAINING_CLASS_SUBMIT')")
    public TrainingClassResponse submit(Long classId, Long revisionId, ClassRevisionActionRequest request) {
        TrainingClass trainingClass = locked(classId, request.getVersion());
        TrainingClassRevision draft = pending(trainingClass, revisionId, request.getRevisionVersion());
        requireStatus(draft, ClassRevisionStatus.DRAFT);
        validateDates(draft.getStartDate(), draft.getEndDate());
        validateReviewSnapshot(trainingClass, draft);
        draft.setStatus(ClassRevisionStatus.UNDER_REVIEW);
        draft.setSubmittedBy(actorId());
        draft.setSubmittedAt(LocalDateTime.now());
        revisions.saveAndFlush(draft);
        return persist(trainingClass);
    }

    @Override
    @Transactional
    @PreAuthorize("hasAuthority('TRAINING_CLASS_APPROVE')")
    public TrainingClassResponse approve(Long classId, Long revisionId, ClassRevisionActionRequest request) {
        TrainingClass trainingClass = locked(classId, request.getVersion());
        TrainingClassRevision proposed = pending(trainingClass, revisionId, request.getRevisionVersion());
        requireStatus(proposed, ClassRevisionStatus.UNDER_REVIEW);
        TrainingClassRevision current = trainingClass.getCurrentRevision();
        if (!Objects.equals(proposed.getBaseRevisionId(), current == null ? null : current.getId())) {
            throw new ConflictException("The active revision has changed. Create a draft from the latest revision.");
        }
        validateDates(proposed.getStartDate(), proposed.getEndDate());
        validateReviewSnapshot(trainingClass, proposed);
        if (current == null) {
            validateReferences(trainingClass.getOpenClassRequestId(), trainingClass.getProgramVersionId());
        } else if (operationalChanges(trainingClass, proposed)) {
            TrainingClassChangeChecker checker = changeCheckerProvider.getIfAvailable();
            if (checker == null) throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,
                    "Approval requires schedule, enrollment and resource validation. The active revision has been kept unchanged.");
            checker.validateForApproval(trainingClass, proposed);
        }
        // Self-approval is allowed when the user holds the dedicated approval permission.
        proposed.setReviewedBy(actorId());
        proposed.setReviewedAt(LocalDateTime.now());
        if (current != null) current.setStatus(ClassRevisionStatus.ARCHIVED);
        proposed.setStatus(ClassRevisionStatus.ACTIVE);
        trainingClass.setCurrentRevision(proposed);
        trainingClass.setPendingRevision(null);
        applySnapshot(trainingClass, proposed);
        revisions.flush();
        return persist(trainingClass);
    }

    @Override
    @Transactional
    @PreAuthorize("hasAuthority('TRAINING_CLASS_APPROVE')")
    public TrainingClassResponse reject(Long classId, Long revisionId, RejectClassRevisionRequest request) {
        TrainingClass trainingClass = locked(classId, request.getVersion());
        TrainingClassRevision proposed = pending(trainingClass, revisionId, request.getRevisionVersion());
        requireStatus(proposed, ClassRevisionStatus.UNDER_REVIEW);
        proposed.setStatus(ClassRevisionStatus.REJECTED);
        proposed.setRejectionReason(request.getReason().trim());
        proposed.setReviewedBy(actorId());
        proposed.setReviewedAt(LocalDateTime.now());
        trainingClass.setPendingRevision(null);
        revisions.saveAndFlush(proposed);
        return persist(trainingClass);
    }

    @Override
    @Transactional
    @PreAuthorize("hasAuthority('TRAINING_CLASS_DELETE')")
    public void deactivate(Long classId) {
        TrainingClass trainingClass = repository.findForRevisionUpdate(classId)
                .orElseThrow(() -> new ResourceNotFoundException("Class not found"));
        if (Boolean.FALSE.equals(trainingClass.getIsActive())) return;
        trainingClass.setIsActive(false);
        repository.saveAndFlush(trainingClass);
    }

    private TrainingClass find(Long id) {
        return repository.findById(id).orElseThrow(() -> new ResourceNotFoundException("Class not found"));
    }

    private TrainingClass locked(Long id, Long expectedVersion) {
        TrainingClass trainingClass = repository.findForRevisionUpdate(id)
                .orElseThrow(() -> new ResourceNotFoundException("Class not found"));
        if (!Boolean.TRUE.equals(trainingClass.getIsActive())) throw new ConflictException("Inactive classes cannot be edited");
        if (trainingClass.getStatus() == ClassStatus.COMPLETED) throw new ConflictException("Completed classes cannot be edited");
        if (trainingClass.getStatus() == ClassStatus.CANCELLED) throw new ConflictException("Cancelled classes cannot be edited");
        if (expectedVersion == null || !Objects.equals(trainingClass.getVersion(), expectedVersion)) stale(trainingClass);
        return trainingClass;
    }

    private TrainingClassRevision pending(TrainingClass trainingClass, Long revisionId, Long expectedVersion) {
        TrainingClassRevision pending = trainingClass.getPendingRevision();
        if (pending == null || !Objects.equals(pending.getId(), revisionId)) {
            throw new ConflictException("The requested revision is not the current draft/review revision of this class");
        }
        if (!Objects.equals(pending.getVersion(), expectedVersion)) stale(trainingClass);
        return pending;
    }

    private void requireStatus(TrainingClassRevision revision, ClassRevisionStatus expected) {
        if (revision.getStatus() != expected) throw new ConflictException("This action requires a " + expected + " revision");
    }

    private void stale(TrainingClass trainingClass) {
        String message = "This class or revision was changed by another user. Reload before saving.";
        throw new TrainingClassConflictException(message, Map.of("version", List.of(message)), trainingClass.getVersion());
    }

    private void newDraft(TrainingClass trainingClass) {
        int number = trainingClass.getLastIssuedRevisionNo() + 1;
        TrainingClassRevision draft = TrainingClassRevision.builder().trainingClass(trainingClass)
                .revisionNo(number).status(ClassRevisionStatus.DRAFT)
                .baseRevisionId(trainingClass.getCurrentRevision() == null ? null : trainingClass.getCurrentRevision().getId())
                .name(trainingClass.getName()).description(trainingClass.getDescription())
                .traineeType(trainingClass.getTraineeType()).deliveryFormat(trainingClass.getDeliveryFormat())
                .site(trainingClass.getSite()).location(trainingClass.getLocation())
                .startDate(trainingClass.getStartDate()).endDate(trainingClass.getEndDate()).capacity(trainingClass.getCapacity()).build();
        revisions.saveAndFlush(draft);
        trainingClass.setPendingRevision(draft);
        trainingClass.setLastIssuedRevisionNo(number);
    }

    private TrainingClassResponse persist(TrainingClass trainingClass) {
        trainingClass.setLastRevisionActivityAt(LocalDateTime.now());
        return mapper.toResponse(repository.saveAndFlush(trainingClass));
    }

    private void applySnapshot(TrainingClass target, TrainingClassRevision source) {
        target.setName(source.getName()); target.setDescription(source.getDescription());
        target.setTraineeType(source.getTraineeType()); target.setDeliveryFormat(source.getDeliveryFormat());
        target.setSite(source.getSite()); target.setLocation(source.getLocation());
        target.setStartDate(source.getStartDate()); target.setEndDate(source.getEndDate()); target.setCapacity(source.getCapacity());
    }

    private boolean operationalChanges(TrainingClass current, TrainingClassRevision proposed) {
        return !Objects.equals(current.getTraineeType(), proposed.getTraineeType())
                || !Objects.equals(current.getDeliveryFormat(), proposed.getDeliveryFormat())
                || !Objects.equals(current.getSite(), proposed.getSite())
                || !Objects.equals(current.getLocation(), proposed.getLocation())
                || !Objects.equals(current.getStartDate(), proposed.getStartDate())
                || !Objects.equals(current.getEndDate(), proposed.getEndDate())
                || !Objects.equals(current.getCapacity(), proposed.getCapacity());
    }

    private boolean canManageDrafts() {
        var authentication = SecurityContextHolder.getContext().getAuthentication();
        return authentication != null && authentication.getAuthorities().stream().anyMatch(authority ->
                List.of("TRAINING_CLASS_CREATE", "TRAINING_CLASS_UPDATE", "TRAINING_CLASS_SUBMIT", "TRAINING_CLASS_APPROVE")
                        .contains(authority.getAuthority()));
    }

    private Long actorId() {
        return auditor.getCurrentAuditor().orElseThrow(() -> new AccessDeniedException("An authenticated reviewer is required"));
    }

    private String description(String value) { return value == null || value.isBlank() ? null : value.trim(); }

    private void validateDates(LocalDate start, LocalDate end) {
        if (start == null || end == null) throw new BadRequestException("Start date and end date are required");
        if (end.isBefore(start)) throw new BadRequestException("End date must not be before start date");
    }

    private void validateOngoingStartDate(TrainingClass trainingClass, LocalDate proposed) {
        if (trainingClass.getStatus() == ClassStatus.ONGOING && !Objects.equals(trainingClass.getStartDate(), proposed)) {
            throw new BusinessValidationException(Map.of("startDate", List.of("Start date cannot be changed after a class is Ongoing")));
        }
    }

    private void validateCapacity(Integer capacity) {
        if (capacity == null || capacity < TrainingClassRules.MIN_CAPACITY || capacity > TrainingClassRules.MAX_CAPACITY) {
            throw new BusinessValidationException(Map.of("capacity", List.of("Capacity must be a whole number from 1 to 50")));
        }
    }

    private void validateReviewSnapshot(TrainingClass trainingClass, TrainingClassRevision snapshot) {
        validateOngoingStartDate(trainingClass, snapshot.getStartDate());
        validateCapacity(snapshot.getCapacity());
        TrainingClassCatalog.requireLocation(snapshot.getLocation(), snapshot.getSite());
    }

    private void validateReferences(Long requestId, Long programVersionId) {
        ProgramVersionChecker program = checkerProvider.getIfAvailable();
        OpenClassRequestChecker request = requestCheckerProvider.getIfAvailable();
        if (program == null || request == null) throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,
                "Program/open class request validation is unavailable");
        request.validateForCreate(requestId, programVersionId);
        program.validateForClass(programVersionId);
    }
}
