package com.example.starter_project_2025.system.project.milestone.service;

import com.example.starter_project_2025.exception.ResourceNotFoundException;
import com.example.starter_project_2025.system.project.milestone.audit.MilestoneAuditWriter;
import com.example.starter_project_2025.system.project.milestone.domain.Milestone;
import com.example.starter_project_2025.system.project.milestone.dto.request.CreateMilestoneRequest;
import com.example.starter_project_2025.system.project.milestone.dto.response.MilestoneResponse;
import com.example.starter_project_2025.system.project.milestone.exception.MilestoneConflictException;
import com.example.starter_project_2025.system.project.milestone.exception.MilestoneValidationException;
import com.example.starter_project_2025.system.project.milestone.idempotency.*;
import com.example.starter_project_2025.system.project.milestone.integration.model.ProjectCreationContext;
import com.example.starter_project_2025.system.project.milestone.integration.model.RubricSnapshotData;
import com.example.starter_project_2025.system.project.milestone.integration.port.*;
import com.example.starter_project_2025.system.project.milestone.outbox.OutboxEventWriter;
import com.example.starter_project_2025.system.project.milestone.repository.MilestoneRepository;
import jakarta.persistence.EntityManager;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.Clock;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class MilestoneCommandService {

    private static final String OPERATION = "CREATE_MILESTONE";
    private static final int LOCK_STRIPES = 256;
    private static final Object[] IDEMPOTENCY_LOCKS = createLocks();

    private final CurrentActorProvider actorProvider;
    private final MilestoneTenantProvider tenantProvider;
    private final ProjectMilestonePort projectPort;
    private final RubricCatalogPort rubricPort;
    private final MilestoneAccessPolicy accessPolicy;
    private final MilestoneValidator validator;
    private final MilestoneRepository milestoneRepository;
    private final WorkspaceMilestoneScopeService scopeService;
    private final EntityManager entityManager;
    private final IdempotencyRepository idempotencyRepository;
    private final RequestHashService requestHashService;
    private final MilestoneAuditWriter auditWriter;
    private final OutboxEventWriter outboxWriter;
    private final MilestoneMapper mapper;
    private final TransactionTemplate transactionTemplate;
    private final Clock milestoneClock;
    private final MilestoneLifecycleService lifecycle;

    public MilestoneResponse create(Long projectId, String idempotencyKey, CreateMilestoneRequest request) {
        validateIdempotencyKey(idempotencyKey);
        UUID actorId = actorProvider.requireCurrentActorId();
        Long tenantId = tenantProvider.requireCurrentTenantId();
        var scope = scopeService.requireTeamScope(projectId, request.teamId(), tenantId);
        Long resolvedProjectId = scope.projectId();
        String normalizedKey = idempotencyKey.trim();
        String requestHash = requestHashService.hash(resolvedProjectId, tenantId, actorId, request);
        Object lock = IDEMPOTENCY_LOCKS[Math.floorMod(
                (tenantId + "|" + actorId + "|" + normalizedKey).hashCode(), LOCK_STRIPES)];

        synchronized (lock) {
            MilestoneResponse response = transactionTemplate.execute(status -> createInTransaction(
                    resolvedProjectId, tenantId, actorId, normalizedKey, requestHash, request
            ));
            if (response == null) {
                throw new IllegalStateException("Milestone transaction returned no response");
            }
            return response;
        }
    }

    private MilestoneResponse createInTransaction(
            Long projectId,
            Long tenantId,
            UUID actorId,
            String idempotencyKey,
            String requestHash,
            CreateMilestoneRequest request
    ) {
        ProjectCreationContext project = projectId == null ? null : projectPort.requireProjectForCreation(projectId, actorId, tenantId);
        if (project != null) {
            accessPolicy.requireAccess(project);
        }
        var existing = idempotencyRepository
                .findByTenantIdAndActorIdAndOperationAndIdempotencyKey(
                        tenantId, actorId, OPERATION, idempotencyKey);
        if (existing.isPresent()) {
            IdempotencyRecord record = existing.get();
            if (!record.getRequestHash().equals(requestHash)) {
                throw new MilestoneConflictException("Idempotency key was already used with a different payload");
            }
            Milestone milestone = milestoneRepository
                    .findByIdAndProjectIdAndTenantId(record.getResourceId(), projectId, tenantId)
                    .orElseThrow(() -> new ResourceNotFoundException("Created milestone not found"));
            return mapper.toResponse(milestone);
        }

        if (project != null) {
            accessPolicy.requireCreatableState(project);
        }
        RubricSnapshotData rubric = rubricPort.requireAllowedSnapshot(
                request.rubricSnapshotId(), projectId, actorId, tenantId);
        Instant now = milestoneClock.instant();
        validator.validate(request, rubric, now);

        Milestone milestone = Milestone.create(
                tenantId,
                projectId,
                request.teamId(),
                request.title().trim(),
                request.description() == null ? null : request.description().trim(),
                request.deadline(),
                request.mandatory(),
                request.rubricSnapshotId(),
                null,
                request.latePolicy().type(),
                request.latePolicy().lateUntil(),
                request.latePolicy().penaltyPercent(),
                actorId,
                now
        );
        milestone.configureAutoStart(request.deadlineOffsetDays(), request.deadlineOffsetDays() != null);
        milestone.startAutomatically(now);
        if (request.resubmissionPolicy() != null) {
            milestone.configureResubmission(
                    request.resubmissionPolicy().allowed(),
                    request.resubmissionPolicy().maxAttempts());
        }
        milestone.configureAssessment(request.weight(), request.latePolicy().penaltyBasis());
        request.checklist().forEach(item -> milestone.addChecklistItem(
                item.content().trim(), item.mandatory(), item.orderIndex()));

        milestoneRepository.saveAndFlush(milestone);
        // Return the database-normalized timestamp/decimal representation so an
        // idempotent replay is byte-for-byte equivalent to the first response.
        entityManager.refresh(milestone);
        lifecycle.recordInitialRevision(milestone, actorId, now);
        auditWriter.writeCreated(milestone, actorId, idempotencyKey, now);
        outboxWriter.writeMilestoneCreated(milestone, now);
        idempotencyRepository.save(IdempotencyRecord.completed(
                tenantId, actorId, OPERATION, idempotencyKey, requestHash,
                milestone.getId(), HttpStatus.CREATED.value(), now
        ));

        return mapper.toResponse(milestone);
    }

    private void validateIdempotencyKey(String key) {
        if (key == null || key.isBlank()) {
            throw new MilestoneValidationException(Map.of(
                    "idempotencyKey", List.of("Idempotency-Key header is required")
            ));
        }
        if (key.trim().length() > 100) {
            throw new MilestoneValidationException(Map.of(
                    "idempotencyKey", List.of("Idempotency-Key must not exceed 100 characters")
            ));
        }
    }

    private static Object[] createLocks() {
        Object[] locks = new Object[LOCK_STRIPES];
        for (int i = 0; i < locks.length; i++) locks[i] = new Object();
        return locks;
    }
}
