package com.example.starter_project_2025.system.calendar;

import com.example.starter_project_2025.system.calendar.CalendarValidateRequest.CandidateSession;
import com.example.starter_project_2025.system.calendar.CalendarValidationResult.ConflictIssue;
import com.example.starter_project_2025.system.demo.session.Session;
import com.example.starter_project_2025.system.demo.session.SessionRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Objects;

/**
 * Validates candidate training calendar schedules for time bounds, intra-schedule overlaps,
 * and cross-class trainer/room collisions against persisted sessions.
 */
@Service
@RequiredArgsConstructor
public class CalendarValidationService {

    private static final long NO_SESSION = -1L;
    private static final DateTimeFormatter SLOT_FORMAT = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm");

    private final SessionRepository sessionRepository;

    @Transactional(readOnly = true)
    public CalendarValidationResult validate(CalendarValidateRequest request) {
        if (request == null || request.sessions() == null || request.sessions().isEmpty()) {
            return new CalendarValidationResult(true, List.of());
        }

        List<ConflictIssue> issues = new ArrayList<>();
        List<CandidateSession> validTimedCandidates = new ArrayList<>();

        for (CandidateSession candidate : request.sessions()) {
            if (candidate.startTime() == null || candidate.endTime() == null
                    || !candidate.endTime().isAfter(candidate.startTime())) {
                issues.add(new ConflictIssue(
                        "INVALID_TIME_RANGE",
                        candidate.candidateKey(),
                        "endTime",
                        describeCandidate(candidate) + ": End time must be after start time.",
                        null
                ));
                continue;
            }

            if (request.learningStartDate() != null
                    && candidate.startTime().toLocalDate().isBefore(request.learningStartDate())) {
                issues.add(new ConflictIssue(
                        "BEFORE_LEARNING_START",
                        candidate.candidateKey(),
                        "startTime",
                        describeCandidate(candidate) + " starts before learning start date (" + request.learningStartDate() + ").",
                        null
                ));
            }

            checkIntraBatchConflicts(candidate, validTimedCandidates, issues);
            checkDatabaseConflicts(request.classId(), candidate, issues);
            validTimedCandidates.add(candidate);
        }

        return new CalendarValidationResult(issues.isEmpty(), List.copyOf(issues));
    }

    private void checkIntraBatchConflicts(
            CandidateSession current,
            List<CandidateSession> earlierCandidates,
            List<ConflictIssue> issues
    ) {
        String currentRoom = normalizeLocation(current.location());
        for (CandidateSession earlier : earlierCandidates) {
            if (!isOverlapping(current, earlier)) {
                continue;
            }

            if (current.trainerId() != null && Objects.equals(current.trainerId(), earlier.trainerId())) {
                issues.add(new ConflictIssue(
                        "TRAINER_OVERLAP",
                        current.candidateKey(),
                        "trainerId",
                        describeCandidate(current) + " overlaps with " + describeCandidate(earlier) + " for the same trainer.",
                        null
                ));
            }

            if (currentRoom != null && !isVirtualLocation(currentRoom)
                    && currentRoom.equalsIgnoreCase(Objects.toString(normalizeLocation(earlier.location()), ""))) {
                issues.add(new ConflictIssue(
                        "ROOM_OVERLAP",
                        current.candidateKey(),
                        "location",
                        describeCandidate(current) + " conflicts on room '" + currentRoom + "' with " + describeCandidate(earlier) + ".",
                        null
                ));
            }

            issues.add(new ConflictIssue(
                    "CLASS_SLOT_OVERLAP",
                    current.candidateKey(),
                    "startTime",
                    describeCandidate(current) + " overlaps in time with " + describeCandidate(earlier) + " within the same class.",
                    null
            ));
        }
    }

    private void checkDatabaseConflicts(Long classId, CandidateSession candidate, List<ConflictIssue> issues) {
        if (candidate.trainerId() != null) {
            List<Session> overlapping = sessionRepository.findOverlappingForClassOrTrainer(
                    candidate.startTime(),
                    candidate.endTime(),
                    classId != null ? classId : -1L,
                    candidate.trainerId(),
                    NO_SESSION,
                    Session.SessionStatus.CANCELLED
            );
            for (Session other : overlapping) {
                // Ignore existing sessions of the class being replaced when clicking Save Schedule.
                if (classId != null && Objects.equals(other.getClassId(), classId)) {
                    continue;
                }
                if (Objects.equals(other.getTrainerId(), candidate.trainerId())) {
                    issues.add(new ConflictIssue(
                            "DB_TRAINER_OVERLAP",
                            candidate.candidateKey(),
                            "trainerId",
                            "Trainer #" + candidate.trainerId() + " is already assigned to "
                                    + describePersisted(other) + " (class #" + other.getClassId() + ").",
                            other.getId()
                    ));
                }
            }
        }

        String room = normalizeLocation(candidate.location());
        if (room != null && !isVirtualLocation(room)) {
            List<Session> roomConflicts = sessionRepository.findOverlappingAtLocation(
                    candidate.startTime(),
                    candidate.endTime(),
                    room,
                    NO_SESSION,
                    Session.SessionStatus.CANCELLED
            );
            for (Session other : roomConflicts) {
                if (classId != null && Objects.equals(other.getClassId(), classId)) {
                    continue;
                }
                issues.add(new ConflictIssue(
                        "DB_ROOM_OVERLAP",
                        candidate.candidateKey(),
                        "location",
                        "Room '" + room + "' is already booked by "
                                + describePersisted(other) + " (class #" + other.getClassId() + ").",
                        other.getId()
                ));
            }
        }
    }

    private static boolean isOverlapping(CandidateSession a, CandidateSession b) {
        return a.startTime().isBefore(b.endTime()) && a.endTime().isAfter(b.startTime());
    }

    private static String normalizeLocation(String location) {
        return location == null || location.isBlank() ? null : location.trim();
    }

    private static boolean isVirtualLocation(String location) {
        String lower = location.toLowerCase(Locale.ROOT);
        return lower.contains("online") || lower.contains("teams") || lower.contains("zoom");
    }

    private static String describeCandidate(CandidateSession candidate) {
        String label = candidate.title() != null && !candidate.title().isBlank() ? candidate.title().trim() : "Session";
        if (candidate.startTime() != null && candidate.endTime() != null) {
            return "'" + label + "' (" + candidate.startTime().format(SLOT_FORMAT) + " - "
                    + candidate.endTime().toLocalTime() + ")";
        }
        return "'" + label + "'";
    }

    private static String describePersisted(Session other) {
        return "'" + other.getTitle() + "' (session #" + other.getId() + ", "
                + other.getStartTime().format(SLOT_FORMAT) + " - " + other.getEndTime().format(SLOT_FORMAT) + ")";
    }
}

