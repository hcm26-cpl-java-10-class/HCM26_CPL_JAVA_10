package com.example.starter_project_2025.system.training;

import com.example.starter_project_2025.exception.ResourceNotFoundException;
import com.example.starter_project_2025.system.external_api.ExternalApiService;
import com.example.starter_project_2025.system.external_api.exception.ExternalApiException;
import com.example.starter_project_2025.system.training.entity.TrainingClass;
import com.example.starter_project_2025.system.trainingprogram.*;
import jakarta.persistence.EntityManager;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.Clock;
import java.time.Instant;
import java.util.*;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class ClassReadinessService {
    private final TrainingClassRepository classes;
    private final ClassEnrollmentRepository enrollments;
    private final ClassTrainingProgramRepository programs;
    private final TeachingAssignmentRepository assignments;
    private final ExternalApiService directory;
    private final EntityManager entityManager;
    private final Clock trainingClassClock;

    public enum State { READY, NOT_READY, UNKNOWN, BLOCKED }
    public record Check(String key, String label, State status, String reason, String target, String action) {
        public Check(String key, String label, State status, String reason, String target) {
            this(key, label, status, reason, target, switch (key) {
                case "basic" -> "Open Class Setup and link an ACTIVE training program to this internal class ID. Class Info Program must match its code or name; saving text does not create the link.";
                case "trainer" -> "Open Class Setup and create an active MAIN teaching assignment for this internal class ID and an eligible subject of its linked program. Cover the entire class date range and select an active real directory trainer matching Master Trainer.";
                case "enrollment" -> "Open Trainee List and save at least one ACTIVE enrollment for this internal class. Active and reserved seats must not exceed Planned Size.";
                case "calendar" -> "Open Calendar > Manage Sessions for this internal class ID. Save at least one non-cancelled session within the class dates with end time after start time. A class-date overview or draft calendar alone is not a session.";
                case "operations" -> "In Class Info, supply Delivery Type and Format Type. Offline/Hybrid/Blended needs an exact, unique real room name with capacity >= Planned Size; Online needs an HTTP(S) meeting URL. Restore the real Room API if verification is blocked.";
                default -> "";
            });
        }
    }
    public record Readiness(Long classId, List<Check> checks, int ready, int notReady, int unknown,
                            int blocked, int verified, long enrolledTrainees, Instant evaluatedAt) {}

    public Readiness get(Long classId) {
        var item = classes.findByIdAndIsActiveTrue(classId)
            .orElseThrow(() -> new ResourceNotFoundException("Class not found"));
        var link = programs.findByClassId(classId).filter(p -> Boolean.TRUE.equals(p.getIsActive()));
        List<Check> checks = new ArrayList<>();
        checks.add(basic(item, link));
        checks.add(trainer(item, link));
        long occupied = enrollments.occupiedSeats(classId);
        long active = enrollments.countByTrainingClass_IdAndIsActiveTrueAndStatus(classId, ClassEnrollment.Status.ACTIVE);
        checks.add(new Check("enrollment", "Trainee Enrollment",
            active > 0 && occupied <= item.getPlannedSize() ? State.READY : State.NOT_READY,
            occupied > item.getPlannedSize() ? "Enrollment exceeds planned capacity."
                : active == 0 ? "No active trainee enrollments."
                : active + " active trainees; " + occupied + "/" + item.getPlannedSize() + " seats occupied.", "trainees"));
        long sessions = entityManager.createQuery("""
            select count(s) from Session s where s.classId = :classId and s.isActive = true
            and s.status <> com.example.starter_project_2025.system.demo.session.Session.SessionStatus.CANCELLED
            """, Long.class).setParameter("classId", classId).getSingleResult();
        long validSessions = entityManager.createQuery("""
            select count(s) from Session s where s.classId = :classId and s.isActive = true
            and s.status <> com.example.starter_project_2025.system.demo.session.Session.SessionStatus.CANCELLED
            and s.startTime >= :start and s.endTime <= :end and s.endTime > s.startTime
            """, Long.class).setParameter("classId", classId)
            .setParameter("start", item.getStartDate().atStartOfDay())
            .setParameter("end", item.getEndDate().plusDays(1).atStartOfDay()).getSingleResult();
        checks.add(new Check("calendar", "Calendar Readiness",
            sessions > 0 && sessions == validSessions ? State.READY : State.NOT_READY,
            sessions == 0 ? "No non-cancelled sessions for this class."
                : sessions != validSessions ? "Some sessions fall outside the class dates or have invalid times."
                : validSessions + " valid non-cancelled sessions.", "calendar"));
        checks.add(operations(item));
        int ready = (int) checks.stream().filter(c -> c.status() == State.READY).count();
        int unknown = (int) checks.stream().filter(c -> c.status() == State.UNKNOWN).count();
        int blocked = (int) checks.stream().filter(c -> c.status() == State.BLOCKED).count();
        return new Readiness(classId, checks, ready, checks.size() - ready - unknown - blocked, unknown,
            blocked, checks.size() - unknown - blocked, occupied, trainingClassClock.instant());
    }

    private Check basic(TrainingClass item, Optional<ClassTrainingProgram> link) {
        if (blank(item.getCode()) || blank(item.getName()) || blank(item.getSite()) || blank(item.getProgram())
                || item.getStartDate() == null || item.getEndDate() == null || !item.getEndDate().isAfter(item.getStartDate()))
            return new Check("basic", "Basic Information", State.NOT_READY, "Complete code, name, site, program and valid dates.", "edit");
        if (link.isEmpty()) return new Check("basic", "Basic Information", State.UNKNOWN,
            "Internal class " + item.getId() + " has Program '" + item.getProgram()
                + "', but no active ClassTrainingProgram link for this class ID.", "setup");
        var program = link.get().getProgram();
        boolean valid = Boolean.TRUE.equals(program.getIsActive()) && program.getStatus() == ProgramStatus.ACTIVE
            && (item.getProgram().trim().equalsIgnoreCase(program.getCode().trim()) || item.getProgram().trim().equalsIgnoreCase(program.getName().trim()));
        return new Check("basic", "Basic Information", valid ? State.READY : State.NOT_READY,
            valid ? "Required information and the linked active program are verified."
                : "The linked program is inactive or does not match the class program.", "setup");
    }

    private Check trainer(TrainingClass item, Optional<ClassTrainingProgram> link) {
        if (blank(item.getMasterTrainer())) return new Check("trainer", "Trainer Assignment", State.NOT_READY,
            "No master trainer is recorded.", "edit");
        var all = assignments.findByClassIdOrderByEffectiveFromAscIdAsc(item.getId());
        if (link.isEmpty()) return new Check("trainer", "Trainer Assignment", State.UNKNOWN,
            "Internal class " + item.getId() + " has no active program link; Master Trainer '"
                + item.getMasterTrainer() + "' is text only. Found " + all.size() + " assignment records for this class ID.", "setup");
        if (!Boolean.TRUE.equals(link.get().getProgram().getIsActive()) || link.get().getProgram().getStatus() != ProgramStatus.ACTIVE)
            return new Check("trainer", "Trainer Assignment", State.NOT_READY, "The assignment's linked training program is inactive.", "setup");
        var main = all.stream()
            .filter(a -> Boolean.TRUE.equals(a.getIsActive()) && a.getRole() == AssignmentRole.MAIN)
            .filter(a -> !a.getEffectiveFrom().isAfter(item.getStartDate())
                && (a.getEffectiveTo() == null || !a.getEffectiveTo().isBefore(item.getEndDate())))
            .filter(a -> link.isPresent() && Objects.equals(a.getProgramSubject().getProgram().getId(), link.get().getProgram().getId()))
            .filter(a -> Boolean.TRUE.equals(a.getProgramSubject().getSubject().getIsActive())
                && a.getProgramSubject().getSubject().getStatus() == com.example.starter_project_2025.system.subject.SubjectStatus.ACTIVE)
            .toList();
        if (main.isEmpty()) return new Check("trainer", "Trainer Assignment", State.UNKNOWN,
            "No active MAIN assignment for internal class " + item.getId() + " and linked program "
                + link.get().getProgram().getCode() + " covers " + item.getStartDate() + " through " + item.getEndDate() + ".", "setup");
        if (directory.isSampleData()) return new Check("trainer", "Trainer Assignment", State.BLOCKED,
            "The local sample directory cannot verify real trainer eligibility.", "setup");
        try {
            var trainers = directory.fetchTrainers("active");
            if (directory.isSampleData()) return new Check("trainer", "Trainer Assignment", State.BLOCKED,
                "Trainer API returned sample data; real trainer eligibility is not verified.", "setup");
            var activeTrainers = trainers.stream().filter(t -> t.getId() != null && "active".equalsIgnoreCase(t.getStatus())).toList();
            var activeIds = activeTrainers.stream().map(t -> t.getId()).collect(java.util.stream.Collectors.toSet());
            boolean valid = main.stream().allMatch(a -> activeIds.contains(a.getTrainerId()));
            boolean matchesName = activeTrainers.stream().anyMatch(t -> main.stream().anyMatch(a -> Objects.equals(a.getTrainerId(), t.getId()))
                && (item.getMasterTrainer().trim().equalsIgnoreCase(t.getName()) || item.getMasterTrainer().trim().equalsIgnoreCase(t.getEmail())));
            return new Check("trainer", "Trainer Assignment", valid && matchesName ? State.READY : State.NOT_READY,
                valid && matchesName ? "Main assignments and active trainer identities are verified."
                    : "An assigned main trainer is inactive, missing, or does not match Master Trainer.", "setup");
        } catch (ExternalApiException ex) {
            return new Check("trainer", "Trainer Assignment", State.BLOCKED,
                "Trainer directory is unavailable" + failure(ex) + "; eligibility could not be verified.", "setup");
        }
    }

    private Check operations(TrainingClass item) {
        if (blank(item.getDeliveryType()) || blank(item.getFormatType()) || blank(item.getLocation()))
            return new Check("operations", "Operational Information", State.NOT_READY,
                "Provide delivery type, format and a location or meeting URL.", "edit");
        String format = item.getFormatType().trim().toLowerCase(Locale.ROOT);
        boolean online = format.equals("online");
        if (!Set.of("online", "offline", "hybrid", "blended").contains(format)) return new Check("operations", "Operational Information",
            State.UNKNOWN, "Unsupported saved Format Type '" + item.getFormatType() + "'. Use Online, Offline, Hybrid or Blended.", "edit");
        if (online) {
            try {
                var uri = java.net.URI.create(item.getLocation());
                if (!("http".equalsIgnoreCase(uri.getScheme()) || "https".equalsIgnoreCase(uri.getScheme()))
                        || uri.getHost() == null) throw new IllegalArgumentException();
            } catch (IllegalArgumentException ex) {
                return new Check("operations", "Operational Information", State.NOT_READY, "Online classes require a valid HTTP(S) meeting URL.", "edit");
            }
        } else {
            if (directory.isSampleData()) return new Check("operations", "Operational Information", State.BLOCKED,
                "The local sample room directory cannot verify a real training location.", "edit");
            try {
                var rooms = directory.fetchRooms();
                if (directory.isSampleData()) return new Check("operations", "Operational Information", State.BLOCKED,
                    "Room API returned sample data; real room identity and capacity cannot be verified.", "edit");
                var matches = rooms.stream()
                    .filter(room -> room.getName() != null && room.getName().equalsIgnoreCase(item.getLocation().trim())).toList();
                if (matches.size() != 1) return new Check("operations", "Operational Information", State.UNKNOWN,
                    "Saved Location '" + item.getLocation() + "' matches " + matches.size() + " rooms out of " + rooms.size()
                        + ". An exact, unique room name is required; a building or site name alone is insufficient.", "edit");
                if (matches.getFirst().getId() == null) return new Check("operations", "Operational Information", State.UNKNOWN,
                    "The matched room has no directory ID; its identity cannot be verified.", "edit");
                var capacity = matches.getFirst().getCapacity();
                if (capacity == null || capacity <= 0) return new Check("operations", "Operational Information", State.UNKNOWN,
                    "Room '" + matches.getFirst().getName() + "' has no valid capacity; Planned Size is " + item.getPlannedSize() + ".", "edit");
                if (capacity < item.getPlannedSize()) return new Check("operations", "Operational Information", State.NOT_READY,
                    "Room '" + matches.getFirst().getName() + "' capacity " + capacity + " is below Planned Size " + item.getPlannedSize() + ".", "edit");
                return new Check("operations", "Operational Information", State.READY,
                    "Room " + matches.getFirst().getId() + " ('" + matches.getFirst().getName() + "') is uniquely verified; capacity "
                        + capacity + " >= Planned Size " + item.getPlannedSize() + "; Format Type '" + item.getFormatType()
                        + "', Delivery Type '" + item.getDeliveryType() + "'.", "edit");
            } catch (ExternalApiException ex) {
                return new Check("operations", "Operational Information", State.BLOCKED,
                    "Room API is unavailable" + failure(ex) + "; real room identity and capacity cannot be verified. No sample room was substituted.", "edit");
            }
        }
        return new Check("operations", "Operational Information", State.READY,
            online ? "Delivery format and meeting URL syntax are valid." : "Delivery format, room identity and room capacity are verified.", "edit");
    }

    private boolean blank(String value) { return value == null || value.isBlank(); }

    private String failure(ExternalApiException ex) {
        // Do not expose upstream bodies, credentials or internal connection strings.
        return ex.getStatusCode() > 0 ? " (HTTP " + ex.getStatusCode() + ")" : " (connection or response failure)";
    }
}
