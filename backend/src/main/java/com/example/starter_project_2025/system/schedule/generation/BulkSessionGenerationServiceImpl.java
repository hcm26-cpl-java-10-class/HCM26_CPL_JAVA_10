package com.example.starter_project_2025.system.schedule.generation;

import com.example.starter_project_2025.base.crud.validation.ValidationContext;
import com.example.starter_project_2025.exception.BadRequestException;
import com.example.starter_project_2025.exception.ConflictException;
import com.example.starter_project_2025.system.schedule.*;
import com.example.starter_project_2025.system.schedule.generation.dto.*;
import com.example.starter_project_2025.system.schedule.generation.engine.ScheduleGeneratorEngine;
import com.example.starter_project_2025.system.study_session.*;
import com.example.starter_project_2025.system.trainingprogram.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.*;
import java.util.*;

@Service
@RequiredArgsConstructor
public class BulkSessionGenerationServiceImpl implements BulkSessionGenerationService {
    private final ScheduleGeneratorEngine generator;
    private final ClassSetupService classSetup;
    private final TeachingAssignmentRepository assignments;
    private final StudySessionRepository sessions;
    private final StudySessionValidator sessionValidator;
    private final TeachingAssignmentSessionGuard guard;
    private final AssignmentScheduleValidation validation;
    private final ScheduleReferenceProvider references;
    private final BulkScheduleReceiptRepository receipts;
    private final ObjectMapper json;

    @Override
    @Transactional(readOnly = true)
    @PreAuthorize("hasAuthority('SESSION_READ')")
    public ScheduleGenerationContextResponse getGenerationContext(Long classId) {
        if (classId == null || classId <= 0) throw new BadRequestException("Select a valid class.");
        var context = classSetup.getAssignmentCreateContext(classId);
        var plan = classSetup.getClassProgramSubjects(classId);
        if (plan.program() == null || plan.program().status() != ProgramStatus.ACTIVE)
            throw new BadRequestException("Assign an ACTIVE training program to this class before generating its schedule.");

        var topics = plan.subjects().stream()
                .filter(s -> context.subjects().stream().anyMatch(active -> active.programSubjectId().equals(s.programSubjectId())))
                .map(s -> ScheduleGenerationContextResponse.TopicContextItem.builder()
                        .programSubjectId(s.programSubjectId()).subjectId(s.subjectId())
                        .topicCode(s.subjectCode()).topicName(s.subjectName()).sequenceOrder(s.orderIndex())
                        .totalHours(s.durationHours().doubleValue()).build())
                .toList();
        if (topics.isEmpty()) throw new BadRequestException("The class has no active curriculum subjects to schedule.");
        return ScheduleGenerationContextResponse.builder().classId(classId).classCode(context.classProfile().getCode())
                .className(context.classProfile().getName()).programId(plan.program().id()).programName(plan.program().name())
                .programVersion(plan.program().version())
                .totalHours(topics.stream().mapToDouble(ScheduleGenerationContextResponse.TopicContextItem::getTotalHours).sum())
                .topics(topics).build();
    }

    @Override
    @Transactional(readOnly = true)
    @PreAuthorize("hasAuthority('SESSION_READ')")
    public BulkPreviewResponseDTO generatePreview(Long classId, BulkPreviewRequestDTO request) {
        validateRequest(request);
        var context = getGenerationContext(classId);
        var directory = classSetup.getSchedulingDirectory(classId);
        var refs = references.loadResources();
        var holidays = new HashSet<LocalDate>();
        for (var holiday : refs.holidays()) {
            LocalDate last = holiday.endDate() == null ? holiday.date() : holiday.endDate();
            if (holiday.date() == null || last.isBefore(holiday.date())) throw new BadRequestException("Invalid holiday range.");
            for (LocalDate day = holiday.date(); ; day = day.plusDays(1)) {
                if (holidays.size() > 3660) throw new BadRequestException("Holiday range is too large.");
                holidays.add(day);
                if (day.equals(last)) break;
            }
        }
        var rows = generator.generate(context.getTopics(), request, holidays);
        if (rows.size() > 200) throw new BadRequestException("A generation preview cannot contain more than 200 sessions.");

        // Assignment resolution always runs: it is required to save, not an optional conflict check.
        boolean unresolved = false;
        for (var row : rows) {
            var eligible = directory.assignments().stream().filter(a -> a.programSubjectId().equals(row.getProgramSubjectId())
                    && !row.getStartTime().toLocalDate().isBefore(a.effectiveFrom())
                    && (a.effectiveTo() == null || !row.getEndTime().toLocalDate().isAfter(a.effectiveTo()))
                    && com.example.starter_project_2025.system.trainingprogram.AssignmentTeachingSlot.covers(
                        a.teachingSlots(), row.getStartTime(), row.getEndTime())).toList();
            // Trainer overrides are explicit preferences, never free-text identity resolution.
            var preferred = eligible.stream().filter(a -> row.getTrainerId() == null || row.getTrainerId().equals(a.trainerId())).toList();
            var main = preferred.stream().filter(a -> a.role() == AssignmentRole.MAIN).toList();
            var chosen = main.size() == 1 ? main.get(0) : preferred.size() == 1 ? preferred.get(0) : null;
            if (chosen == null) {
                unresolved = true;
                row.setStatus("CONFLICT");
                row.setConflictDetails(new PreviewSessionItemDTO.ConflictDetailDTO("ASSIGNMENT_INVALID", null,
                        "No unique eligible assignment exists for this subject, trainer and session date."));
            } else {
                row.setTeachingAssignmentId(chosen.id());
                row.setTrainerId(chosen.trainerId());
                row.setTrainerName(chosen.trainerName());
            }
        }

        // From modulesubject_dev: conflict checking is opt-in via the request flag.
        if (Boolean.TRUE.equals(request.getCheckConflicts())) {
            if (!unresolved && !rows.isEmpty()) {
                var result = validation.preview(rows.stream().map(row -> proposal(classId, row)).toList());
                for (var issue : result.issues()) {
                    if (issue.candidateIndex() == null) rows.forEach(row -> conflict(row, issue));
                    else {
                        conflict(rows.get(issue.candidateIndex()), issue);
                        if (issue.relatedCandidateIndex() != null) conflict(rows.get(issue.relatedCandidateIndex()), issue);
                    }
                }
            }
        } else {
            rows.stream().filter(row -> !"CONFLICT".equals(row.getStatus())).forEach(row -> row.setStatus("PENDING"));
        }

        int count = (int) rows.stream().filter(row -> "CONFLICT".equals(row.getStatus())).count();
        return BulkPreviewResponseDTO.builder().classId(classId).totalSessions(rows.size())
                .totalHoursCalculated(rows.stream().mapToDouble(row -> Duration.between(row.getStartTime(), row.getEndTime()).toMinutes() / 60.0).sum())
                .hasConflicts(count > 0).conflictCount(count)
                .startDate(rows.isEmpty() ? request.getStartDate() : rows.get(0).getDate())
                .estimatedEndDate(rows.isEmpty() ? request.getStartDate() : rows.get(rows.size() - 1).getDate())
                .skippedHolidaysCount(0).sessions(rows).correlationId(UUID.randomUUID().toString()).build();
    }

    private void conflict(PreviewSessionItemDTO row, AssignmentScheduleValidation.Issue issue) {
        row.setStatus("CONFLICT");
        row.setConflictDetails(new PreviewSessionItemDTO.ConflictDetailDTO(issue.code(), null, issue.message()));
    }

    private void validateRequest(BulkPreviewRequestDTO request) {
        if (request == null || request.getStartDate() == null || request.getDaysOfWeek() == null || request.getDaysOfWeek().isEmpty()
                || request.getSlotTime() == null || request.getSlotTime().getStartTime() == null
                || request.getSlotTime().getHoursPerSession() == null || !Double.isFinite(request.getSlotTime().getHoursPerSession())
                || request.getSlotTime().getHoursPerSession() < 1.0 / 60 || request.getSlotTime().getHoursPerSession() > 12
                || request.getDaysOfWeek().stream().anyMatch(Objects::isNull))
            throw new BadRequestException("Provide a start date, teaching days, start time and session duration between 0 and 12 hours.");
    }

    private AssignmentScheduleProposal proposal(Long classId, PreviewSessionItemDTO row) {
        return new AssignmentScheduleProposal(null, row.getTeachingAssignmentId(), classId, row.getSubjectId(), row.getProgramSubjectId(),
                row.getTrainerId(), row.getTitle(), row.getStartTime(), row.getEndTime(), row.getRoomId(), row.getMeetingUrl());
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    @PreAuthorize("hasAuthority('SESSION_READ') and hasAuthority('SESSION_CREATE')")
    public BulkSaveSessionsResponseDTO saveBulkSessions(Long classId, BulkSaveSessionsRequestDTO request, String idempotencyKey) {
        guard.lockForWrite();
        if (classId == null || classId <= 0 || request == null || request.getSessions() == null || request.getSessions().isEmpty()
                || request.getSessions().size() > 200 || request.getSessions().stream().anyMatch(Objects::isNull))
            throw new BadRequestException("Provide between 1 and 200 sessions.");
        if (idempotencyKey != null && idempotencyKey.length() > 100)
            throw new BadRequestException("Idempotency-Key must be at most 100 characters.");

        String scope = null, requestHash = hash(serialize(request));
        if (idempotencyKey != null && !idempotencyKey.isBlank()) {
            scope = hash(serialize(List.of(SecurityContextHolder.getContext().getAuthentication().getName(), classId, idempotencyKey.trim())));
            var receipt = receipts.findById(scope).orElse(null);
            if (receipt != null) {
                if (!receipt.getRequestHash().equals(requestHash))
                    throw new ConflictException("Idempotency-Key was already used with different content.");
                try { return json.readValue(receipt.getResponseJson(), BulkSaveSessionsResponseDTO.class); }
                catch (Exception error) { throw new IllegalStateException("Stored bulk result could not be read.", error); }
            }
        }

        validation.requireValid(request.getSessions().stream().map(row -> proposal(classId, row)).toList());
        var trainerNames = new HashMap<Long, String>();
        var entities = new ArrayList<StudySession>();
        for (var row : request.getSessions()) {
            var a = assignments.findById(row.getTeachingAssignmentId()).orElseThrow();
            var session = StudySession.builder().classId(classId).subjectId(a.getProgramSubject().getSubject().getId())
                    .programSubjectId(a.getProgramSubject().getId()).teachingAssignmentId(a.getId()).trainerId(a.getTrainerId())
                    .title(row.getTitle()).sessionDate(row.getStartTime().toLocalDate()).startTime(row.getStartTime().toLocalTime())
                    .endTime(row.getEndTime().toLocalTime()).roomId(row.getRoomId()).meetingUrl(row.getMeetingUrl())
                    .room(row.getRoomName())
                    .lecturer(trainerNames.computeIfAbsent(a.getTrainerId(), ignored -> classSetup.getAssignment(a.getId()).trainerName()))
                    .type(StudySessionType.LECTURE).status(SessionStatus.SCHEDULED).build();
            session.setIsActive(true);
            var ctx = new ValidationContext();
            sessionValidator.validateImport(session, ctx);
            ctx.throwIfErrors();
            entities.add(session);
        }

        var saved = sessions.saveAllAndFlush(entities);
        var response = BulkSaveSessionsResponseDTO.builder().classId(classId).createdCount(saved.size()).status("SUCCESS")
                .message("Study sessions saved successfully.").createdAt(LocalDateTime.now(ZoneId.of("Asia/Ho_Chi_Minh")))
                .correlationId(UUID.randomUUID().toString())
                .createdSessions(saved.stream().map(s -> new ScheduleEntryKey(ScheduleEntryKey.Source.STUDY_SESSION, s.getId())).toList())
                .build();

        if (scope != null) {
            var receipt = new BulkScheduleReceipt();
            receipt.setId(scope);
            receipt.setRequestHash(requestHash);
            receipt.setResponseJson(serialize(response));
            receipts.saveAndFlush(receipt);
        }
        return response;
    }

    private String serialize(Object value) {
        try { return json.writeValueAsString(value); }
        catch (Exception error) { throw new BadRequestException("Invalid bulk payload."); }
    }

    private String hash(String value) {
        try {
            return HexFormat.of().formatHex(java.security.MessageDigest.getInstance("SHA-256")
                    .digest(value.getBytes(java.nio.charset.StandardCharsets.UTF_8)));
        } catch (java.security.NoSuchAlgorithmException error) { throw new IllegalStateException(error); }
    }
}
