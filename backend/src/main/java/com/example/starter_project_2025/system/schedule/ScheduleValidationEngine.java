package com.example.starter_project_2025.system.schedule;

import com.example.starter_project_2025.system.demo.session.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.*;
import java.time.*;
import java.util.*;

@Service
@RequiredArgsConstructor
public class ScheduleValidationEngine {
    private final SessionRepository sessions;
    private final ScheduleReferenceProvider references;
    private final ScheduleRules rules;
    private final ScheduleWriteLockRepository locks;

    /** Call BEFORE reading sessions, then validate and write in the SAME transaction. */
    @Transactional(propagation = Propagation.MANDATORY)
    public void lockForWrite() {
        locks.acquire().orElseThrow(() -> new IllegalStateException("Scheduling is temporarily unavailable. Please try again later."));
    }

    @Transactional(readOnly = true)
    public ScheduleValidationResult validate(List<ScheduleCandidate> candidates) {
        return validateReplacement(candidates, Set.of());
    }

    /** Trusted integration for Phat: old active IDs are derived server-side, never from a public request. */
    @Transactional(propagation = Propagation.MANDATORY)
    public void requireValidActivation(List<ScheduleCandidate> candidates, Set<Long> oldActiveSessionIds) {
        lockForWrite();
        var result = validateReplacement(candidates, oldActiveSessionIds);
        if (!result.valid()) throw new ScheduleValidationException(result);
    }

    @Transactional(propagation = Propagation.MANDATORY)
    public void requireValid(List<ScheduleCandidate> candidates) {
        var result = validate(candidates);
        if (!result.valid()) throw new ScheduleValidationException(result);
    }

    private ScheduleValidationResult validateReplacement(List<ScheduleCandidate> candidates, Set<Long> replacedIds) {
        List<ScheduleIssue> issues = new ArrayList<>();
        if (candidates == null || candidates.isEmpty() || candidates.size() > rules.getMaxBatchSize()) {
            issue(issues, "BATCH_SIZE", "sessions", "Provide between 1 and " + rules.getMaxBatchSize() + " sessions for validation.", -1);
            return result(issues);
        }
        Set<Long> excluded = new HashSet<>(replacedIds);
        Set<Long> proposedIds = new HashSet<>();
        for (int i = 0; i < candidates.size(); i++) {
            var c = candidates.get(i);
            if (c == null) {
                issue(issues, "REQUIRED", "session", "Session details are required.", i);
                continue;
            }
            if (c.id() != null) {
                if (!proposedIds.add(c.id())) issue(issues, "DUPLICATE_ID", "id", "Each existing session can appear only once in a validation batch.", i);
                if (!sessions.existsById(c.id())) issue(issues, "NOT_FOUND", "id", "The session you are trying to update could not be found.", i);
                excluded.add(c.id());
            }
            if (c.classId() == null || c.topicId() == null || c.trainerId() == null)
                issue(issues, "REQUIRED", "assignment", "A class, subject, and instructor are required.", i);
            if (c.title() == null || c.title().isBlank() || c.title().length() > 150)
                issue(issues, "TITLE", "title", "Enter a session title between 1 and 150 characters.", i);
            if ((c.location() != null && c.location().length() > 150) || (c.meetingUrl() != null && c.meetingUrl().length() > 1000))
                issue(issues, "VENUE_LENGTH", "location", "The room name must not exceed 150 characters, and the meeting URL must not exceed 1,000 characters.", i);
            if (c.startTime() == null || c.endTime() == null || !c.endTime().isAfter(c.startTime()))
                issue(issues, "TIME_ORDER", "endTime", "The end time must be later than the start time.", i);
        }
        // Fail input errors before touching shared services.
        if (!issues.isEmpty()) return result(issues);
        ScheduleReferences ref = references.load();
        for (int i = 0; i < candidates.size(); i++) checkConditions(candidates.get(i), i, ref, issues);

        LocalDateTime from = candidates.stream().map(ScheduleCandidate::startTime).min(LocalDateTime::compareTo).orElseThrow();
        LocalDateTime to = candidates.stream().map(ScheduleCandidate::endTime).max(LocalDateTime::compareTo).orElseThrow();
        List<Session> existing = sessions.findBlockingInRange(from, to);
        for (int i = 0; i < candidates.size(); i++) {
            var candidate = candidates.get(i);
            for (Session old : existing) {
                if (!excluded.contains(old.getId())) compare(candidate, fromSession(old), i, null, old.getId(), ref, issues);
            }
            for (int j = 0; j < i; j++) {
                int before = issues.size();
                compare(candidate, candidates.get(j), i, j, null, ref, issues);
                // Both rows carry a link to the other row in a batch.
                for (var conflict : List.copyOf(issues.subList(before, issues.size()))) {
                    issues.add(new ScheduleIssue(conflict.code(), conflict.field(), conflict.message(), j, i, null,
                            candidate.title(), candidate.startTime(), candidate.endTime()));
                }
            }
        }
        return result(issues);
    }

    private void checkConditions(ScheduleCandidate c, int index, ScheduleReferences ref, List<ScheduleIssue> issues) {
        var start = c.startTime();
        var end = c.endTime();
        if (!start.toLocalDate().equals(end.toLocalDate()) || start.toLocalTime().isBefore(rules.getOpeningTime())
                || end.toLocalTime().isAfter(rules.getClosingTime())
                || !rules.getWorkingDays().contains(start.getDayOfWeek().getValue())) {
            issue(issues, "WORKING_HOURS", "startTime", "Sessions must start and end on the same working day, within the permitted hours: "
                    + rules.getOpeningTime() + "–" + rules.getClosingTime(), index);
        }
        var clazz = ref.classes().stream().filter(x -> Objects.equals(x.getId(), c.classId())).findFirst();
        if (clazz.isEmpty()) issue(issues, "CLASS_NOT_FOUND", "classId", "The selected class could not be found.", index);
        else {
            if (!active(clazz.get().getStatus())) issue(issues, "CLASS_INACTIVE", "classId", "The selected class is inactive. Select an active class.", index);
            try {
                LocalDate first = LocalDate.parse(clazz.get().getStartDate());
                LocalDate last = LocalDate.parse(clazz.get().getEndDate());
                if (last.isBefore(first)) throw new IllegalArgumentException();
                if (start.toLocalDate().isBefore(first) || end.toLocalDate().isAfter(last))
                    issue(issues, "CLASS_DATE_RANGE", "startTime", "The session must fall within the class date range: " + first + " to " + last + ".", index);
            } catch (RuntimeException ex) {
                issue(issues, "CLASS_DATES_MISSING", "classId", "The class does not have a valid start and end date. Update the class dates before scheduling.", index);
            }
        }
        if (ref.trainers().stream().noneMatch(x -> Objects.equals(x.getId(), c.trainerId()) && active(x.getStatus())))
            issue(issues, "TRAINER_INACTIVE", "trainerId", "The selected instructor is unavailable or inactive. Select an active instructor.", index);
        boolean assigned = ref.assignments().stream().anyMatch(a ->
                (c.teachingAssignmentId() == null || Objects.equals(a.id(), c.teachingAssignmentId()))
                && Objects.equals(a.classId(), c.classId()) && Objects.equals(a.topicId(), c.topicId())
                && Objects.equals(a.trainerId(), c.trainerId()) && active(a.status())
                && a.effectiveFrom() != null && !start.toLocalDate().isBefore(a.effectiveFrom())
                && (a.effectiveTo() == null || !end.toLocalDate().isAfter(a.effectiveTo())));
        if (!assigned) issue(issues, "ASSIGNMENT_INVALID", "teachingAssignmentId", "No active teaching assignment matches this class, subject, and instructor for the full session duration.", index);

        Long room = canonicalRoom(c, ref);
        if (c.roomId() != null && ref.rooms().stream().noneMatch(r -> Objects.equals(r.getId(), c.roomId())))
            issue(issues, "ROOM_NOT_FOUND", "roomId", "The selected room could not be found. Select a room from the available list.", index);
        if (c.location() != null && !c.location().isBlank() && room == null)
            issue(issues, "ROOM_NOT_FOUND", "location", "The room name does not match an available room. Select a room from the list.", index);
        if (c.roomId() != null && c.location() != null && !c.location().isBlank()
                && ref.rooms().stream().noneMatch(r -> Objects.equals(r.getId(), c.roomId()) && normalized(r.getName()).equals(normalized(c.location()))))
            issue(issues, "ROOM_MISMATCH", "location", "The selected room and room name do not match. Select the room again.", index);
        if (room == null && (c.meetingUrl() == null || !c.meetingUrl().matches("https?://[^\\s]+")))
            issue(issues, "VENUE_REQUIRED", "meetingUrl", "Select a valid room or enter an online meeting URL beginning with http:// or https://.", index);
        for (var holiday : ref.holidays()) {
            if (holiday.date() == null) throw new IllegalStateException("The holiday calendar contains an entry without a date. Contact your administrator.");
            LocalDate last = holiday.endDate() == null ? holiday.date() : holiday.endDate();
            if (last.isBefore(holiday.date())) throw new IllegalStateException("The holiday calendar contains an invalid date range. Contact your administrator.");
            if (!end.toLocalDate().isBefore(holiday.date()) && !start.toLocalDate().isAfter(last))
                issue(issues, "HOLIDAY", "startTime", "The session falls on a scheduled holiday: " + holiday.name(), index);
        }
    }

    private void compare(ScheduleCandidate a, ScheduleCandidate b, int index, Integer peer, Long existingId,
            ScheduleReferences refs, List<ScheduleIssue> issues) {
        // Half-open intervals: a session ending at 10:00 does not clash with one starting at 10:00.
        if (!a.startTime().isBefore(b.endTime()) || !b.startTime().isBefore(a.endTime())) return;
        if (Objects.equals(a.trainerId(), b.trainerId())) conflict(issues, "TRAINER_CONFLICT", "trainerId", "The instructor is already scheduled for another session during this time.", index, peer, existingId, b);
        if (Objects.equals(a.classId(), b.classId())) conflict(issues, "CLASS_CONFLICT", "classId", "The class already has another session scheduled during this time.", index, peer, existingId, b);
        Long roomA = canonicalRoom(a, refs), roomB = canonicalRoom(b, refs);
        if (roomA != null && roomA.equals(roomB)) conflict(issues, "ROOM_CONFLICT", "roomId", "The room is already booked for another session during this time.", index, peer, existingId, b);
    }

    private Long canonicalRoom(ScheduleCandidate c, ScheduleReferences refs) {
        if (c.roomId() != null) return c.roomId();
        if (c.location() == null || c.location().isBlank()) return null;
        return refs.rooms().stream().filter(r -> normalized(r.getName()).equals(normalized(c.location())))
                .map(r -> r.getId()).findFirst().orElse(null);
    }

    private String normalized(String text) { return text == null ? "" : text.strip().replaceAll("\\s+", " ").toLowerCase(Locale.ROOT); }
    private boolean active(String status) { return "ACTIVE".equalsIgnoreCase(status); }
    private ScheduleValidationResult result(List<ScheduleIssue> issues) { return new ScheduleValidationResult(issues.isEmpty(), rules.getTimezone(), List.copyOf(issues)); }
    private void issue(List<ScheduleIssue> issues, String code, String field, String message, int index) {
        issues.add(new ScheduleIssue(code, field, message, index, null, null, null, null, null));
    }
    private void conflict(List<ScheduleIssue> issues, String code, String field, String message, int index, Integer peer, Long id, ScheduleCandidate other) {
        issues.add(new ScheduleIssue(code, field, message, index, peer, id, other.title(), other.startTime(), other.endTime()));
    }

    public static ScheduleCandidate fromSession(Session s) {
        return new ScheduleCandidate(s.getId(), s.getClassId(), s.getTopicId(), s.getTrainerId(),
                s.getTeachingAssignmentId(), s.getRoomId(), s.getLocation(), s.getMeetingUrl(), s.getTitle(), s.getStartTime(), s.getEndTime());
    }
}
