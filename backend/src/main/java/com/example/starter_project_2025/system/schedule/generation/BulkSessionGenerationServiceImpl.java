package com.example.starter_project_2025.system.schedule.generation;

import com.example.starter_project_2025.exception.BadRequestException;
import com.example.starter_project_2025.exception.ConflictException;
import com.example.starter_project_2025.system.demo.session.SessionDTO;
import com.example.starter_project_2025.system.demo.session.SessionService;
import com.example.starter_project_2025.system.schedule.ScheduleCandidate;
import com.example.starter_project_2025.system.schedule.ScheduleValidationEngine;
import com.example.starter_project_2025.system.schedule.generation.dto.*;
import com.example.starter_project_2025.system.schedule.generation.engine.ScheduleGeneratorEngine;
import com.example.starter_project_2025.system.trainingprogram.*;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

/** Phat owns generation; SessionService remains the single writer for Session records. */
@Service
@RequiredArgsConstructor
public class BulkSessionGenerationServiceImpl implements BulkSessionGenerationService {
    private final ScheduleGeneratorEngine scheduleGeneratorEngine;
    private final ClassSetupService classSetupService;
    private final SessionService sessionService;
    private final ScheduleValidationEngine validationEngine;
    private final ObjectMapper objectMapper;

    private record RequestKey(String user, Long classId, String key) {}
    private record SavedRequest(String payload, BulkSaveSessionsResponseDTO response, Instant expiresAt) {}
    // Retry support for one application instance; a database-backed store is a separate follow-up.
    private final Map<RequestKey, SavedRequest> idempotencyStore = new ConcurrentHashMap<>();

    @Override
    @Transactional(readOnly = true)
    @PreAuthorize("hasAuthority('SESSION_READ')")
    public ScheduleGenerationContextResponse getGenerationContext(Long classId) {
        return context(classId, LocalDate.now());
    }

    private ScheduleGenerationContextResponse context(Long classId, LocalDate onDate) {
        if (classId == null || classId <= 0) throw new BadRequestException("Select a valid class.");
        var plan = classSetupService.getClassProgramSubjects(classId);
        if (plan.program() == null || plan.program().status() != ProgramStatus.ACTIVE)
            throw new BadRequestException("Assign an ACTIVE training program to this class before generating its schedule.");
        if (plan.subjects() == null || plan.subjects().isEmpty())
            throw new BadRequestException("The class program does not contain any subjects.");

        var topics = plan.subjects().stream()
                .sorted(Comparator.comparing(ClassProgramSubjectsResponse.ProgramSubjectItem::orderIndex,
                        Comparator.nullsLast(Comparator.naturalOrder())))
                .map(subject -> {
                    if (subject.durationHours() == null || subject.durationHours() <= 0)
                        throw new BadRequestException("Set a positive duration for subject " + subject.subjectCode() + ".");
                    var assignment = subject.assignments().stream()
                            .filter(a -> a.role() == AssignmentRole.MAIN && a.effectiveFrom() != null
                                    && !onDate.isBefore(a.effectiveFrom())
                                    && (a.effectiveTo() == null || !onDate.isAfter(a.effectiveTo())))
                            .findFirst().orElse(null);
                    return ScheduleGenerationContextResponse.TopicContextItem.builder()
                            // Session topicId is the Subject ID; preserve ProgramSubject as a separate link.
                            .topicId(subject.subjectId()).programSubjectId(subject.programSubjectId())
                            .topicCode(subject.subjectCode()).topicName(subject.subjectName())
                            .sequenceOrder(subject.orderIndex()).totalHours(subject.durationHours().doubleValue())
                            .assignedTrainerId(assignment == null ? null : assignment.trainerId())
                            .assignedTrainerName(assignment == null ? null : assignment.trainerName())
                            .teachingAssignmentId(assignment == null ? null : assignment.id()).build();
                }).toList();
        return ScheduleGenerationContextResponse.builder().classId(classId).classCode(plan.classCode())
                .className(plan.className()).programId(plan.program().id()).programName(plan.program().name())
                .programVersion(plan.program().version()).topics(topics)
                .totalHours(topics.stream().mapToDouble(ScheduleGenerationContextResponse.TopicContextItem::getTotalHours).sum())
                .build();
    }

    @Override
    @Transactional(readOnly = true)
    @PreAuthorize("hasAuthority('SESSION_READ')")
    public BulkPreviewResponseDTO generatePreview(Long classId, BulkPreviewRequestDTO request) {
        if (request == null || request.getStartDate() == null)
            throw new BadRequestException("A schedule start date is required.");
        var sessions = scheduleGeneratorEngine.generate(context(classId, request.getStartDate()).getTopics(),
                request, Collections.emptySet());
        if (Boolean.TRUE.equals(request.getCheckConflicts()) && !sessions.isEmpty()) {
            var result = validationEngine.validate(sessions.stream().map(item -> candidate(toSession(classId, item))).toList());
            for (var issue : result.issues()) {
                int index = issue.candidateIndex();
                if (index >= 0 && index < sessions.size()) {
                    var item = sessions.get(index);
                    item.setStatus("CONFLICT");
                    item.setConflictDetails(new PreviewSessionItemDTO.ConflictDetailDTO(issue.code(), null, issue.message()));
                }
            }
        }
        if (!Boolean.TRUE.equals(request.getCheckConflicts())) sessions.forEach(item -> item.setStatus("PENDING"));
        int conflicts = (int) sessions.stream().filter(s -> "CONFLICT".equals(s.getStatus())).count();
        return BulkPreviewResponseDTO.builder().classId(classId).totalSessions(sessions.size())
                .totalHoursCalculated(sessions.stream().mapToDouble(s -> Duration.between(s.getStartTime(), s.getEndTime()).toMinutes() / 60.0).sum())
                .hasConflicts(conflicts > 0).conflictCount(conflicts).startDate(request.getStartDate())
                .estimatedEndDate(sessions.isEmpty() ? request.getStartDate() : sessions.getLast().getDate())
                .skippedHolidaysCount(0).sessions(sessions).correlationId(UUID.randomUUID().toString()).build();
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    @PreAuthorize("hasAuthority('SESSION_READ') and hasAuthority('SESSION_CREATE')")
    public BulkSaveSessionsResponseDTO saveBulkSessions(Long classId, BulkSaveSessionsRequestDTO request, String key) {
        if (classId == null || classId <= 0 || request == null || request.getSessions() == null || request.getSessions().isEmpty())
            throw new BadRequestException("Select a class and provide at least one session.");
        if (key != null && key.length() > 128) throw new BadRequestException("Idempotency-Key must not exceed 128 characters.");
        // The same lock is acquired by SessionService before validation/writes. Also serialize cache retries.
        validationEngine.lockForWrite();
        idempotencyStore.entrySet().removeIf(entry -> entry.getValue().expiresAt().isBefore(Instant.now()));
        var auth = SecurityContextHolder.getContext().getAuthentication();
        var requestKey = key == null || key.isBlank() ? null
                : new RequestKey(auth == null ? "anonymous" : auth.getName(), classId, key.trim());
        String payload = payload(request);
        var previous = requestKey == null ? null : idempotencyStore.get(requestKey);
        if (previous != null) {
            if (!previous.payload().equals(payload)) throw new ConflictException("This request key was already used for different session data.");
            return previous.response();
        }
        var requests = request.getSessions().stream().map(item -> toSession(classId, item)).toList();
        // Recheck the complete, possibly edited preview against the DB and itself, in the write transaction.
        var saved = sessionService.createValidatedBatch(requests);
        var response = BulkSaveSessionsResponseDTO.builder().classId(classId).createdCount(saved.size()).status("SUCCESS")
                .message(String.format("Đã lưu thành công %d buổi học cho lớp vào hệ thống.", saved.size()))
                .createdAt(LocalDateTime.now()).correlationId(UUID.randomUUID().toString()).build();
        if (requestKey != null) {
            var cached = new SavedRequest(payload, response, Instant.now().plus(Duration.ofMinutes(30)));
            // Never return a cached success for a transaction that failed at commit.
            if (TransactionSynchronizationManager.isSynchronizationActive()) {
                TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                    @Override public void afterCommit() { idempotencyStore.put(requestKey, cached); }
                });
            }
        }
        return response;
    }

    private String payload(BulkSaveSessionsRequestDTO request) {
        try { return objectMapper.writeValueAsString(request); }
        catch (JsonProcessingException ex) { throw new BadRequestException("Session data could not be read."); }
    }

    private SessionDTO toSession(Long classId, PreviewSessionItemDTO item) {
        if (item == null || item.getTopicId() == null || item.getTrainerId() == null || item.getTeachingAssignmentId() == null)
            throw new BadRequestException("Every session must reference a subject, trainer and teaching assignment.");
        var dto = SessionDTO.builder().classId(classId).topicId(item.getTopicId()).trainerId(item.getTrainerId())
                .teachingAssignmentId(item.getTeachingAssignmentId()).roomId(item.getRoomId()).location(item.getRoomName())
                .meetingUrl(item.getMeetingUrl()).title(item.getTitle() == null || item.getTitle().isBlank()
                        ? item.getTopicName() + " - Buổi " + item.getSessionNumber() : item.getTitle())
                .startTime(item.getStartTime()).endTime(item.getEndTime()).build();
        dto.setIsActive(true);
        return dto;
    }

    private ScheduleCandidate candidate(SessionDTO dto) {
        return new ScheduleCandidate(null, dto.getClassId(), dto.getTopicId(), dto.getTrainerId(), dto.getTeachingAssignmentId(),
                dto.getRoomId(), dto.getLocation(), dto.getMeetingUrl(), dto.getTitle(), dto.getStartTime(), dto.getEndTime());
    }
}
