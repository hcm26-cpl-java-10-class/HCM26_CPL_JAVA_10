package com.example.starter_project_2025.system.schedule.conflict_resolution;

import com.example.starter_project_2025.exception.BadRequestException;
import com.example.starter_project_2025.exception.ResourceNotFoundException;
import com.example.starter_project_2025.system.schedule.calendar.CalendarVersion;
import com.example.starter_project_2025.system.schedule.calendar.CalendarVersionStatus;
import com.example.starter_project_2025.system.schedule.calendar.repository.CalendarVersionRepository;
import com.example.starter_project_2025.system.schedule.conflict_resolution.dto.ConflictResolutionAuditEventResponse;
import com.example.starter_project_2025.system.schedule.conflict_resolution.dto.ConflictResolutionDecisionRequest;
import com.example.starter_project_2025.system.schedule.conflict_resolution.dto.ConflictResolutionResponse;
import com.example.starter_project_2025.system.schedule.conflict_resolution.dto.CreateConflictResolutionRequest;
import com.example.starter_project_2025.system.schedule.conflict_resolution.repository.ScheduleConflictResolutionAuditRepository;
import com.example.starter_project_2025.system.schedule.conflict_resolution.repository.ScheduleConflictResolutionRepository;
import com.example.starter_project_2025.system.schedule.detection.ConflictDetectionService;
import com.example.starter_project_2025.system.schedule.detection.ConflictType;
import com.example.starter_project_2025.system.schedule.detection.dto.ConflictCheckResult;
import com.example.starter_project_2025.system.schedule.detection.dto.ConflictDTO;
import com.example.starter_project_2025.system.schedule.exception.ConflictException;
import com.example.starter_project_2025.system.schedule.exception.UnprocessableEntityException;
import com.example.starter_project_2025.system.schedule.session.Session;
import com.example.starter_project_2025.system.schedule.session.SessionRepository;
import com.example.starter_project_2025.system.schedule.session.SessionStatus;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.EnumSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class ConflictResolutionServiceImpl implements ConflictResolutionService {

    static final Set<ConflictResolutionStatus> LIVE_STATUSES = EnumSet.of(
            ConflictResolutionStatus.PENDING,
            ConflictResolutionStatus.ACKNOWLEDGED,
            ConflictResolutionStatus.APPROVED
    );

    CalendarVersionRepository calendarVersionRepository;
    SessionRepository sessionRepository;
    ScheduleConflictResolutionRepository resolutionRepository;
    ScheduleConflictResolutionAuditRepository auditRepository;
    ConflictDetectionService conflictDetectionService;
    Clock clock;

    @Override
    @Transactional(readOnly = true)
    public ConflictCheckResult resolve(ConflictCheckResult rawResult) {
        if (rawResult == null || rawResult.getCalendarVersionId() == null) {
            throw new BadRequestException("A conflict check result with a calendar version is required.");
        }

        List<ScheduleConflictResolution> resolutions = resolutionRepository
                .findByCalendarVersion_IdAndStatusInAndIsActiveTrue(
                        rawResult.getCalendarVersionId(),
                        LIVE_STATUSES
                );
        Map<String, List<ScheduleConflictResolution>> byPair = resolutions.stream()
                .collect(Collectors.groupingBy(value -> pairKey(
                        value.getSessionA().getId(),
                        value.getSessionB().getId()
                )));

        int blockingCount = 0;
        int acknowledgedCount = 0;
        Set<Long> applicableIds = new LinkedHashSet<>();

        for (ConflictDTO conflict : safeConflicts(rawResult)) {
            initializeConflictResolutionFields(conflict);
            List<ScheduleConflictResolution> candidates = byPair.getOrDefault(
                    conflict.getConflictKey(),
                    List.of()
            );

            Optional<ScheduleConflictResolution> approved = candidates.stream()
                    .filter(value -> value.getStatus() == ConflictResolutionStatus.APPROVED)
                    .filter(value -> isCurrentAndEligible(value, conflict.getConflictTypes()))
                    .max(Comparator.comparing(ScheduleConflictResolution::getApprovedAt));

            if (approved.isPresent()) {
                ScheduleConflictResolution resolution = approved.get();
                Set<ConflictType> waived = waivedTypes(resolution, conflict.getConflictTypes());
                Set<ConflictType> blocking = copyTypes(conflict.getConflictTypes());
                blocking.removeAll(waived);
                conflict.setWaivedConflictTypes(waived);
                conflict.setBlockingConflictTypes(blocking);
                conflict.setBlocking(!blocking.isEmpty());
                applyResolutionMetadata(conflict, resolution, ConflictResolutionStatus.APPROVED);
                applicableIds.add(resolution.getId());
            } else {
                ScheduleConflictResolution display = selectDisplayResolution(candidates);
                if (display != null) {
                    ConflictResolutionStatus effectiveStatus = isCurrent(display)
                            ? display.getStatus()
                            : ConflictResolutionStatus.STALE;
                    applyResolutionMetadata(conflict, display, effectiveStatus);
                    if (effectiveStatus == ConflictResolutionStatus.ACKNOWLEDGED) {
                        acknowledgedCount++;
                    }
                }
            }

            if (conflict.isBlocking()) {
                blockingCount++;
            }
        }

        rawResult.setHasConflict(!safeConflicts(rawResult).isEmpty());
        rawResult.setConflictCount(safeConflicts(rawResult).size());
        rawResult.setBlockingConflictCount(blockingCount);
        rawResult.setHasBlockingConflict(blockingCount > 0);
        rawResult.setApprovedOverrideCount(applicableIds.size());
        rawResult.setAcknowledgedCount(acknowledgedCount);
        rawResult.setApplicableResolutionIds(applicableIds);
        rawResult.setCanActivate(
                blockingCount == 0
                        && rawResult.getValidationErrors() != null
                        && rawResult.getValidationErrors().isEmpty()
        );
        return rawResult;
    }

    @Override
    @Transactional
    public ConflictResolutionResponse create(
            Long calendarVersionId,
            CreateConflictResolutionRequest request,
            Long actorId
    ) {
        requirePositive(calendarVersionId, "Calendar version ID");
        requirePositive(actorId, "Authenticated user ID");
        if (request == null || request.getReasonCode() == null) {
            throw new BadRequestException("Conflict resolution request and reason code are required.");
        }
        if (Objects.equals(request.getSessionId(), request.getConflictingSessionId())) {
            throw UnprocessableEntityException.of(
                    "CONFLICT_RESOLUTION_INVALID",
                    "conflictingSessionId",
                    "A session cannot conflict with itself."
            );
        }

        CalendarVersion draft = requireDraftForUpdate(calendarVersionId);
        ConflictDTO conflict = requireCurrentConflict(
                calendarVersionId,
                request.getSessionId(),
                request.getConflictingSessionId()
        );
        Session requestedSession = requireSession(request.getSessionId());
        Session requestedConflictingSession = requireSession(request.getConflictingSessionId());
        requireExpectedVersion(requestedSession, request.getSessionVersion(), "sessionVersion");
        requireExpectedVersion(
                requestedConflictingSession,
                request.getConflictingSessionVersion(),
                "conflictingSessionVersion"
        );

        Session sessionA = requestedSession.getId() < requestedConflictingSession.getId()
                ? requestedSession : requestedConflictingSession;
        Session sessionB = sessionA == requestedSession
                ? requestedConflictingSession : requestedSession;

        validateEligibility(request, sessionA, sessionB, conflict.getConflictTypes());
        boolean hasCurrentDuplicate = resolutionRepository
                .findByCalendarVersion_IdAndSessionA_IdAndSessionB_IdAndReasonCodeAndStatusInAndIsActiveTrue(
                        calendarVersionId,
                        sessionA.getId(),
                        sessionB.getId(),
                        request.getReasonCode(),
                        LIVE_STATUSES
                )
                .stream()
                .anyMatch(this::isCurrent);
        if (hasCurrentDuplicate) {
            throw new ConflictException(
                    "CONFLICT_RESOLUTION_ALREADY_OPEN",
                    "An open resolution already exists for this conflict pair and reason."
            );
        }

        LocalDateTime now = LocalDateTime.now(clock);
        ConflictResolutionStatus initialStatus = request.getReasonCode()
                == ConflictResolutionReason.ACKNOWLEDGED_PENDING_RESOLUTION
                ? ConflictResolutionStatus.ACKNOWLEDGED
                : ConflictResolutionStatus.PENDING;

        ScheduleConflictResolution resolution = ScheduleConflictResolution.builder()
                .calendarVersion(draft)
                .sessionA(sessionA)
                .sessionB(sessionB)
                .reasonCode(request.getReasonCode())
                .status(initialStatus)
                .trainerConflictDetected(conflict.getConflictTypes().contains(ConflictType.TRAINER_CONFLICT))
                .roomConflictDetected(conflict.getConflictTypes().contains(ConflictType.ROOM_CONFLICT))
                .trainerConflictWaived(false)
                .roomConflictWaived(false)
                .justification(request.getJustification().trim())
                .referenceCode(trimToNull(request.getReferenceCode()))
                .sessionArea(trimToNull(request.getSessionArea()))
                .conflictingSessionArea(trimToNull(request.getConflictingSessionArea()))
                .expectedResolutionAt(request.getExpectedResolutionAt())
                .sessionAVersion(sessionA.getVersion())
                .sessionBVersion(sessionB.getVersion())
                .requestedBy(actorId)
                .requestedAt(now)
                .sessionAStart(sessionA.getStartTime())
                .sessionAEnd(sessionA.getEndTime())
                .sessionATrainerId(sessionA.getTrainerId())
                .sessionARoom(sessionA.getRoom())
                .sessionAClassId(classId(sessionA))
                .sessionBStart(sessionB.getStartTime())
                .sessionBEnd(sessionB.getEndTime())
                .sessionBTrainerId(sessionB.getTrainerId())
                .sessionBRoom(sessionB.getRoom())
                .sessionBClassId(classId(sessionB))
                .isActive(true)
                .build();
        resolution = resolutionRepository.saveAndFlush(resolution);
        appendAudit(
                resolution,
                initialStatus == ConflictResolutionStatus.ACKNOWLEDGED
                        ? ConflictResolutionAuditAction.ACKNOWLEDGED
                        : ConflictResolutionAuditAction.REQUESTED,
                actorId,
                resolution.getJustification()
        );
        return toResponse(resolution, true);
    }

    @Override
    @Transactional(readOnly = true)
    public List<ConflictResolutionResponse> list(Long calendarVersionId) {
        requireVersionExists(calendarVersionId);
        return resolutionRepository
                .findByCalendarVersion_IdAndIsActiveTrueOrderByCreatedAtDesc(calendarVersionId)
                .stream()
                .map(value -> toResponse(value, false))
                .toList();
    }

    @Override
    @Transactional(readOnly = true)
    public ConflictResolutionResponse get(Long calendarVersionId, Long resolutionId) {
        ScheduleConflictResolution resolution = resolutionRepository
                .findByIdAndCalendarVersion_IdAndIsActiveTrue(resolutionId, calendarVersionId)
                .orElseThrow(() -> new ResourceNotFoundException("Conflict resolution not found."));
        return toResponse(resolution, true);
    }

    @Override
    @Transactional
    public ConflictResolutionResponse approve(Long calendarVersionId, Long resolutionId, Long actorId) {
        requirePositive(actorId, "Authenticated user ID");
        requireDraftForUpdate(calendarVersionId);
        ScheduleConflictResolution resolution = requireForUpdate(calendarVersionId, resolutionId);
        requireStatus(resolution, ConflictResolutionStatus.PENDING, "approve");
        if (Objects.equals(resolution.getRequestedBy(), actorId)) {
            throw new ConflictException(
                    "CONFLICT_RESOLUTION_SELF_APPROVAL",
                    "The requester cannot approve their own conflict resolution."
            );
        }

        ConflictDTO conflict = requireCurrentConflict(
                calendarVersionId,
                resolution.getSessionA().getId(),
                resolution.getSessionB().getId()
        );
        if (!isCurrent(resolution)) {
            throw new ConflictException(
                    "CONFLICT_RESOLUTION_STALE",
                    "The sessions changed after this request was created. Create a new request."
            );
        }
        validateEligibility(resolution, conflict.getConflictTypes());

        resolution.setStatus(ConflictResolutionStatus.APPROVED);
        resolution.setApprovedBy(actorId);
        resolution.setApprovedAt(LocalDateTime.now(clock));
        if (resolution.getReasonCode() == ConflictResolutionReason.SHARED_CLASS_SESSION) {
            resolution.setTrainerConflictWaived(
                    conflict.getConflictTypes().contains(ConflictType.TRAINER_CONFLICT)
            );
            resolution.setRoomConflictWaived(
                    conflict.getConflictTypes().contains(ConflictType.ROOM_CONFLICT)
            );
        } else if (resolution.getReasonCode() == ConflictResolutionReason.ROOM_PARTITIONED) {
            resolution.setRoomConflictWaived(true);
        }
        resolutionRepository.save(resolution);
        appendAudit(
                resolution,
                ConflictResolutionAuditAction.APPROVED,
                actorId,
                "Conflict resolution approved."
        );
        return toResponse(resolution, true);
    }

    @Override
    @Transactional
    public ConflictResolutionResponse reject(
            Long calendarVersionId,
            Long resolutionId,
            ConflictResolutionDecisionRequest request,
            Long actorId
    ) {
        requirePositive(actorId, "Authenticated user ID");
        requireDraftForUpdate(calendarVersionId);
        ScheduleConflictResolution resolution = requireForUpdate(calendarVersionId, resolutionId);
        requireStatus(resolution, ConflictResolutionStatus.PENDING, "reject");
        String reason = requireDecisionReason(request);
        resolution.setStatus(ConflictResolutionStatus.REJECTED);
        resolution.setRejectedBy(actorId);
        resolution.setRejectedAt(LocalDateTime.now(clock));
        resolution.setRejectionReason(reason);
        resolutionRepository.save(resolution);
        appendAudit(resolution, ConflictResolutionAuditAction.REJECTED, actorId, reason);
        return toResponse(resolution, true);
    }

    @Override
    @Transactional
    public ConflictResolutionResponse revoke(
            Long calendarVersionId,
            Long resolutionId,
            ConflictResolutionDecisionRequest request,
            Long actorId
    ) {
        requirePositive(actorId, "Authenticated user ID");
        requireDraftForUpdate(calendarVersionId);
        ScheduleConflictResolution resolution = requireForUpdate(calendarVersionId, resolutionId);
        requireStatus(resolution, ConflictResolutionStatus.APPROVED, "revoke");
        String reason = requireDecisionReason(request);
        resolution.setStatus(ConflictResolutionStatus.REVOKED);
        resolution.setRevokedBy(actorId);
        resolution.setRevokedAt(LocalDateTime.now(clock));
        resolution.setRevocationReason(reason);
        resolution.setTrainerConflictWaived(false);
        resolution.setRoomConflictWaived(false);
        resolutionRepository.save(resolution);
        appendAudit(resolution, ConflictResolutionAuditAction.REVOKED, actorId, reason);
        return toResponse(resolution, true);
    }

    @Override
    @Transactional
    public void markApplied(ConflictCheckResult resolvedResult, Long actorId) {
        if (resolvedResult == null || resolvedResult.getApplicableResolutionIds() == null) {
            return;
        }
        for (Long resolutionId : resolvedResult.getApplicableResolutionIds()) {
            ScheduleConflictResolution resolution = resolutionRepository
                    .findForUpdate(resolvedResult.getCalendarVersionId(), resolutionId)
                    .orElseThrow(() -> new ConflictException(
                            "CONFLICT_RESOLUTION_CHANGED",
                            "An approved conflict resolution is no longer available."
                    ));
            if (resolution.getStatus() != ConflictResolutionStatus.APPROVED
                    || !isCurrent(resolution)) {
                throw new ConflictException(
                        "CONFLICT_RESOLUTION_CHANGED",
                        "An approved conflict resolution changed during activation."
                );
            }
            resolution.setStatus(ConflictResolutionStatus.APPLIED);
            resolution.setAppliedBy(actorId);
            resolution.setAppliedAt(LocalDateTime.now(clock));
            resolutionRepository.save(resolution);
            appendAudit(
                    resolution,
                    ConflictResolutionAuditAction.APPLIED_ON_ACTIVATION,
                    actorId,
                    "Approved resolution applied during calendar activation."
            );
        }
    }

    private void initializeConflictResolutionFields(ConflictDTO conflict) {
        if (conflict == null || conflict.getSession() == null
                || conflict.getConflictingSession() == null) {
            return;
        }
        conflict.setConflictKey(pairKey(
                conflict.getSession().getId(),
                conflict.getConflictingSession().getId()
        ));
        conflict.setBlockingConflictTypes(copyTypes(conflict.getConflictTypes()));
        conflict.setWaivedConflictTypes(EnumSet.noneOf(ConflictType.class));
        conflict.setBlocking(!conflict.getConflictTypes().isEmpty());
    }

    private void applyResolutionMetadata(
            ConflictDTO conflict,
            ScheduleConflictResolution resolution,
            ConflictResolutionStatus effectiveStatus
    ) {
        conflict.setResolutionId(resolution.getId());
        conflict.setResolutionStatus(effectiveStatus);
        conflict.setResolutionReason(resolution.getReasonCode());
    }

    private ScheduleConflictResolution selectDisplayResolution(
            List<ScheduleConflictResolution> candidates
    ) {
        return candidates.stream()
                .max(Comparator
                        .comparingInt((ScheduleConflictResolution value) -> isCurrent(value) ? 1 : 0)
                        .thenComparingInt(value -> switch (value.getStatus()) {
                            case APPROVED -> 3;
                            case PENDING -> 2;
                            case ACKNOWLEDGED -> 1;
                            default -> 0;
                        }))
                .orElse(null);
    }

    private boolean isCurrentAndEligible(
            ScheduleConflictResolution resolution,
            Set<ConflictType> conflictTypes
    ) {
        if (!isCurrent(resolution)) {
            return false;
        }
        try {
            validateEligibility(resolution, conflictTypes);
            return true;
        } catch (RuntimeException ignored) {
            return false;
        }
    }

    private boolean isCurrent(ScheduleConflictResolution resolution) {
        Session sessionA = resolution.getSessionA();
        Session sessionB = resolution.getSessionB();
        return sessionA != null
                && sessionB != null
                && Boolean.TRUE.equals(sessionA.getIsActive())
                && Boolean.TRUE.equals(sessionB.getIsActive())
                && sessionA.getStatus() != SessionStatus.CANCELLED
                && sessionB.getStatus() != SessionStatus.CANCELLED
                && Objects.equals(sessionA.getVersion(), resolution.getSessionAVersion())
                && Objects.equals(sessionB.getVersion(), resolution.getSessionBVersion());
    }

    private Set<ConflictType> waivedTypes(
            ScheduleConflictResolution resolution,
            Set<ConflictType> currentTypes
    ) {
        EnumSet<ConflictType> waived = EnumSet.noneOf(ConflictType.class);
        if (resolution.isTrainerConflictWaived()
                && currentTypes.contains(ConflictType.TRAINER_CONFLICT)) {
            waived.add(ConflictType.TRAINER_CONFLICT);
        }
        if (resolution.isRoomConflictWaived()
                && currentTypes.contains(ConflictType.ROOM_CONFLICT)) {
            waived.add(ConflictType.ROOM_CONFLICT);
        }
        return waived;
    }

    private void validateEligibility(
            CreateConflictResolutionRequest request,
            Session sessionA,
            Session sessionB,
            Set<ConflictType> conflictTypes
    ) {
        if (request.getJustification() == null || request.getJustification().isBlank()) {
            throw UnprocessableEntityException.of(
                    "CONFLICT_RESOLUTION_INVALID",
                    "justification",
                    "A business justification is required."
            );
        }
        switch (request.getReasonCode()) {
            case ACKNOWLEDGED_PENDING_RESOLUTION -> {
                // Any real schedule conflict may be acknowledged, but never waived.
            }
            case SHARED_CLASS_SESSION -> validateSharedClassSession(
                    sessionA,
                    sessionB,
                    conflictTypes,
                    request.getReferenceCode()
            );
            case ROOM_PARTITIONED -> validateRoomPartitioned(
                    sessionA,
                    sessionB,
                    conflictTypes,
                    request.getReferenceCode(),
                    request.getSessionArea(),
                    request.getConflictingSessionArea()
            );
        }
    }

    private void validateEligibility(
            ScheduleConflictResolution resolution,
            Set<ConflictType> conflictTypes
    ) {
        switch (resolution.getReasonCode()) {
            case ACKNOWLEDGED_PENDING_RESOLUTION -> throw new ConflictException(
                    "CONFLICT_RESOLUTION_NOT_APPROVABLE",
                    "Acknowledgements cannot be approved as overrides."
            );
            case SHARED_CLASS_SESSION -> validateSharedClassSession(
                    resolution.getSessionA(),
                    resolution.getSessionB(),
                    conflictTypes,
                    resolution.getReferenceCode()
            );
            case ROOM_PARTITIONED -> validateRoomPartitioned(
                    resolution.getSessionA(),
                    resolution.getSessionB(),
                    conflictTypes,
                    resolution.getReferenceCode(),
                    resolution.getSessionArea(),
                    resolution.getConflictingSessionArea()
            );
        }
    }

    private void validateSharedClassSession(
            Session sessionA,
            Session sessionB,
            Set<ConflictType> conflictTypes,
            String referenceCode
    ) {
        requireDifferentClasses(sessionA, sessionB);
        if (!Objects.equals(sessionA.getStartTime(), sessionB.getStartTime())
                || !Objects.equals(sessionA.getEndTime(), sessionB.getEndTime())) {
            throw UnprocessableEntityException.of(
                    "CONFLICT_RESOLUTION_NOT_ELIGIBLE",
                    "sessions",
                    "Shared class sessions must have exactly the same start and end time."
            );
        }
        requireReferenceCode(referenceCode);
        if (conflictTypes == null || conflictTypes.isEmpty()) {
            throw new ConflictException(
                    "SCHEDULE_CONFLICT_NOT_FOUND",
                    "The selected sessions no longer conflict."
            );
        }
    }

    private void validateRoomPartitioned(
            Session sessionA,
            Session sessionB,
            Set<ConflictType> conflictTypes,
            String referenceCode,
            String sessionArea,
            String conflictingSessionArea
    ) {
        requireDifferentClasses(sessionA, sessionB);
        requireReferenceCode(referenceCode);
        if (!conflictTypes.equals(EnumSet.of(ConflictType.ROOM_CONFLICT))) {
            throw UnprocessableEntityException.of(
                    "CONFLICT_RESOLUTION_NOT_ELIGIBLE",
                    "reasonCode",
                    "ROOM_PARTITIONED is allowed only when room is the sole conflict."
            );
        }
        if (Objects.equals(sessionA.getTrainerId(), sessionB.getTrainerId())) {
            throw UnprocessableEntityException.of(
                    "CONFLICT_RESOLUTION_NOT_ELIGIBLE",
                    "reasonCode",
                    "ROOM_PARTITIONED cannot waive a trainer conflict."
            );
        }
        if (!sameNonBlankRoom(sessionA.getRoom(), sessionB.getRoom())) {
            throw UnprocessableEntityException.of(
                    "CONFLICT_RESOLUTION_NOT_ELIGIBLE",
                    "sessions",
                    "The sessions must use the same non-blank room."
            );
        }
        if (isBlank(sessionArea) || isBlank(conflictingSessionArea)
                || sessionArea.trim().equalsIgnoreCase(conflictingSessionArea.trim())) {
            throw UnprocessableEntityException.of(
                    "CONFLICT_RESOLUTION_INVALID",
                    "sessionArea",
                    "Two different room-area descriptions are required."
            );
        }
    }

    private void requireDifferentClasses(Session first, Session second) {
        Long firstClassId = classId(first);
        Long secondClassId = classId(second);
        if (firstClassId == null || secondClassId == null
                || Objects.equals(firstClassId, secondClassId)) {
            throw UnprocessableEntityException.of(
                    "CONFLICT_RESOLUTION_NOT_ELIGIBLE",
                    "sessions",
                    "This resolution reason requires sessions from two different classes."
            );
        }
    }

    private ConflictDTO requireCurrentConflict(
            Long calendarVersionId,
            Long firstSessionId,
            Long secondSessionId
    ) {
        requirePositive(firstSessionId, "Session ID");
        requirePositive(secondSessionId, "Conflicting session ID");
        String requiredKey = pairKey(firstSessionId, secondSessionId);
        return safeConflicts(conflictDetectionService.checkConflicts(calendarVersionId)).stream()
                .filter(conflict -> conflict.getSession() != null
                        && conflict.getConflictingSession() != null)
                .filter(conflict -> requiredKey.equals(pairKey(
                        conflict.getSession().getId(),
                        conflict.getConflictingSession().getId()
                )))
                .findFirst()
                .orElseThrow(() -> new ConflictException(
                        "SCHEDULE_CONFLICT_NOT_FOUND",
                        "The selected session pair does not currently conflict in this calendar version."
                ));
    }

    private CalendarVersion requireDraftForUpdate(Long calendarVersionId) {
        requirePositive(calendarVersionId, "Calendar version ID");
        CalendarVersion version = calendarVersionRepository
                .findActiveByIdForUpdate(calendarVersionId)
                .orElseThrow(() -> new ResourceNotFoundException("Calendar version not found."));
        if (version.getStatus() != CalendarVersionStatus.DRAFT) {
            throw new ConflictException(
                    "CALENDAR_VERSION_NOT_DRAFT",
                    "Conflict resolutions can only be changed for a DRAFT calendar version."
            );
        }
        return version;
    }

    private void requireVersionExists(Long calendarVersionId) {
        requirePositive(calendarVersionId, "Calendar version ID");
        calendarVersionRepository.findById(calendarVersionId)
                .filter(value -> Boolean.TRUE.equals(value.getIsActive()))
                .orElseThrow(() -> new ResourceNotFoundException("Calendar version not found."));
    }

    private ScheduleConflictResolution requireForUpdate(Long versionId, Long resolutionId) {
        requirePositive(resolutionId, "Conflict resolution ID");
        return resolutionRepository.findForUpdate(versionId, resolutionId)
                .orElseThrow(() -> new ResourceNotFoundException("Conflict resolution not found."));
    }

    private Session requireSession(Long sessionId) {
        return sessionRepository.findByIdAndIsActiveTrue(sessionId)
                .orElseThrow(() -> new ResourceNotFoundException("Session not found: " + sessionId));
    }

    private void requireExpectedVersion(Session session, Long expectedVersion, String field) {
        if (expectedVersion != null && !Objects.equals(expectedVersion, session.getVersion())) {
            throw new ConflictException(
                    "SESSION_VERSION_CONFLICT",
                    field + " is stale; reload conflicts and try again."
            );
        }
    }

    private void requireStatus(
            ScheduleConflictResolution resolution,
            ConflictResolutionStatus expected,
            String action
    ) {
        if (resolution.getStatus() != expected) {
            throw new ConflictException(
                    "CONFLICT_RESOLUTION_INVALID_TRANSITION",
                    "Cannot " + action + " a resolution in status " + resolution.getStatus() + "."
            );
        }
    }

    private void appendAudit(
            ScheduleConflictResolution resolution,
            ConflictResolutionAuditAction action,
            Long actorId,
            String comment
    ) {
        auditRepository.save(ScheduleConflictResolutionAuditEvent.builder()
                .resolution(resolution)
                .action(action)
                .actorId(actorId)
                .occurredAt(LocalDateTime.now(clock))
                .comment(comment)
                .isActive(true)
                .build());
    }

    private ConflictResolutionResponse toResponse(
            ScheduleConflictResolution resolution,
            boolean includeAudit
    ) {
        boolean stale = LIVE_STATUSES.contains(resolution.getStatus()) && !isCurrent(resolution);
        ConflictResolutionStatus effectiveStatus = stale
                ? ConflictResolutionStatus.STALE
                : resolution.getStatus();
        List<ConflictResolutionAuditEventResponse> auditTrail = includeAudit
                ? auditRepository.findByResolution_IdOrderByOccurredAtAsc(resolution.getId())
                        .stream()
                        .map(event -> ConflictResolutionAuditEventResponse.builder()
                                .id(event.getId())
                                .action(event.getAction())
                                .actorId(event.getActorId())
                                .occurredAt(event.getOccurredAt())
                                .comment(event.getComment())
                                .build())
                        .toList()
                : List.of();

        return ConflictResolutionResponse.builder()
                .id(resolution.getId())
                .calendarVersionId(resolution.getCalendarVersion().getId())
                .sessionId(resolution.getSessionA().getId())
                .conflictingSessionId(resolution.getSessionB().getId())
                .conflictKey(pairKey(
                        resolution.getSessionA().getId(),
                        resolution.getSessionB().getId()
                ))
                .reasonCode(resolution.getReasonCode())
                .status(effectiveStatus)
                .detectedConflictTypes(detectedTypes(resolution))
                .waivedConflictTypes(stale
                        ? EnumSet.noneOf(ConflictType.class)
                        : waivedTypes(resolution, detectedTypes(resolution)))
                .justification(resolution.getJustification())
                .referenceCode(resolution.getReferenceCode())
                .sessionArea(resolution.getSessionArea())
                .conflictingSessionArea(resolution.getConflictingSessionArea())
                .expectedResolutionAt(resolution.getExpectedResolutionAt())
                .requestedBy(resolution.getRequestedBy())
                .requestedAt(resolution.getRequestedAt())
                .approvedBy(resolution.getApprovedBy())
                .approvedAt(resolution.getApprovedAt())
                .rejectedBy(resolution.getRejectedBy())
                .rejectedAt(resolution.getRejectedAt())
                .rejectionReason(resolution.getRejectionReason())
                .revokedBy(resolution.getRevokedBy())
                .revokedAt(resolution.getRevokedAt())
                .revocationReason(resolution.getRevocationReason())
                .appliedBy(resolution.getAppliedBy())
                .appliedAt(resolution.getAppliedAt())
                .sessionVersion(resolution.getSessionAVersion())
                .conflictingSessionVersion(resolution.getSessionBVersion())
                .stale(stale)
                .auditTrail(auditTrail)
                .build();
    }

    private Set<ConflictType> detectedTypes(ScheduleConflictResolution resolution) {
        EnumSet<ConflictType> result = EnumSet.noneOf(ConflictType.class);
        if (resolution.isTrainerConflictDetected()) {
            result.add(ConflictType.TRAINER_CONFLICT);
        }
        if (resolution.isRoomConflictDetected()) {
            result.add(ConflictType.ROOM_CONFLICT);
        }
        return result;
    }

    private String requireDecisionReason(ConflictResolutionDecisionRequest request) {
        if (request == null || request.getReason() == null || request.getReason().isBlank()) {
            throw UnprocessableEntityException.of(
                    "CONFLICT_RESOLUTION_INVALID",
                    "reason",
                    "A decision reason is required."
            );
        }
        return request.getReason().trim();
    }

    private void requireReferenceCode(String referenceCode) {
        if (isBlank(referenceCode)) {
            throw UnprocessableEntityException.of(
                    "CONFLICT_RESOLUTION_INVALID",
                    "referenceCode",
                    "A business reference code is required for an override request."
            );
        }
    }

    private Long classId(Session session) {
        if (session == null || session.getCalendarVersion() == null
                || session.getCalendarVersion().getCalendar() == null) {
            return null;
        }
        return session.getCalendarVersion().getCalendar().getClassId();
    }

    private boolean sameNonBlankRoom(String first, String second) {
        return !isBlank(first)
                && !isBlank(second)
                && first.trim().equalsIgnoreCase(second.trim());
    }

    private boolean isBlank(String value) {
        return value == null || value.isBlank();
    }

    private String trimToNull(String value) {
        return isBlank(value) ? null : value.trim();
    }

    private String pairKey(Long first, Long second) {
        if (first == null || second == null) {
            return null;
        }
        return Math.min(first, second) + ":" + Math.max(first, second);
    }

    private Set<ConflictType> copyTypes(Collection<ConflictType> types) {
        return types == null || types.isEmpty()
                ? EnumSet.noneOf(ConflictType.class)
                : EnumSet.copyOf(types);
    }

    private List<ConflictDTO> safeConflicts(ConflictCheckResult result) {
        return result.getConflicts() == null ? new ArrayList<>() : result.getConflicts();
    }

    private void requirePositive(Long value, String label) {
        if (value == null || value <= 0) {
            throw new BadRequestException(label + " must be positive.");
        }
    }
}
