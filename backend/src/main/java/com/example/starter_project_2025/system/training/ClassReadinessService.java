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

    public enum State { READY, NOT_READY, UNKNOWN }
    public record Check(String key, String label, State status, String reason, String target) {}
    public record Readiness(Long classId, List<Check> checks, int ready, int notReady, int unknown,
                            int verified, long enrolledTrainees, Instant evaluatedAt) {}

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
        return new Readiness(classId, checks, ready, checks.size() - ready - unknown, unknown,
            checks.size() - unknown, occupied, trainingClassClock.instant());
    }

    private Check basic(TrainingClass item, Optional<ClassTrainingProgram> link) {
        if (blank(item.getCode()) || blank(item.getName()) || blank(item.getSite()) || blank(item.getProgram())
                || item.getStartDate() == null || item.getEndDate() == null || !item.getEndDate().isAfter(item.getStartDate()))
            return new Check("basic", "Basic Information", State.NOT_READY, "Complete code, name, site, program and valid dates.", "edit");
        if (link.isEmpty()) return new Check("basic", "Basic Information", State.UNKNOWN,
            "A program name is recorded, but no program link has been verified.", "setup");
        var program = link.get().getProgram();
        boolean valid = Boolean.TRUE.equals(program.getIsActive()) && program.getStatus() == ProgramStatus.ACTIVE
            && (item.getProgram().equalsIgnoreCase(program.getCode()) || item.getProgram().equalsIgnoreCase(program.getName()));
        return new Check("basic", "Basic Information", valid ? State.READY : State.NOT_READY,
            valid ? "Required information and the linked active program are verified."
                : "The linked program is inactive or does not match the class program.", "setup");
    }

    private Check trainer(TrainingClass item, Optional<ClassTrainingProgram> link) {
        if (blank(item.getMasterTrainer())) return new Check("trainer", "Trainer Assignment", State.NOT_READY,
            "No master trainer is recorded.", "edit");
        var main = assignments.findByClassIdOrderByEffectiveFromAscIdAsc(item.getId()).stream()
            .filter(a -> Boolean.TRUE.equals(a.getIsActive()) && a.getRole() == AssignmentRole.MAIN)
            .filter(a -> !a.getEffectiveFrom().isAfter(item.getStartDate())
                && (a.getEffectiveTo() == null || !a.getEffectiveTo().isBefore(item.getEndDate())))
            .filter(a -> link.isPresent() && Objects.equals(a.getProgramSubject().getProgram().getId(), link.get().getProgram().getId()))
            .toList();
        if (main.isEmpty()) return new Check("trainer", "Trainer Assignment", State.UNKNOWN,
            "Trainer text alone cannot verify a main assignment covering the class dates.", "setup");
        if (directory.isSampleData()) return new Check("trainer", "Trainer Assignment", State.UNKNOWN,
            "The local sample directory cannot verify real trainer eligibility.", "setup");
        try {
            var activeIds = directory.fetchTrainers("active").stream()
                .filter(t -> "active".equalsIgnoreCase(t.getStatus())).map(t -> t.getId()).collect(java.util.stream.Collectors.toSet());
            boolean valid = main.stream().allMatch(a -> activeIds.contains(a.getTrainerId()));
            return new Check("trainer", "Trainer Assignment", valid ? State.READY : State.NOT_READY,
                valid ? "Main assignments and active trainer identities are verified."
                    : "An assigned main trainer is not active in the master directory.", "setup");
        } catch (ExternalApiException ex) {
            return new Check("trainer", "Trainer Assignment", State.UNKNOWN, "Trainer directory is unavailable; eligibility could not be verified.", "setup");
        }
    }

    private Check operations(TrainingClass item) {
        if (blank(item.getDeliveryType()) || blank(item.getFormatType()) || blank(item.getLocation()))
            return new Check("operations", "Operational Information", State.NOT_READY,
                "Provide delivery type, format and a location or meeting URL.", "edit");
        String format = item.getFormatType().trim().toLowerCase(Locale.ROOT);
        boolean online = format.equals("online");
        if (!Set.of("online", "offline", "hybrid").contains(format)) return new Check("operations", "Operational Information",
            State.UNKNOWN, "No operational validation rule is defined for this format.", "edit");
        if (online) {
            try {
                var uri = java.net.URI.create(item.getLocation());
                if (!Set.of("http", "https").contains(uri.getScheme()) || uri.getHost() == null) throw new IllegalArgumentException();
            } catch (IllegalArgumentException ex) {
                return new Check("operations", "Operational Information", State.NOT_READY, "Online classes require a valid HTTP(S) meeting URL.", "edit");
            }
        } else {
            if (directory.isSampleData()) return new Check("operations", "Operational Information", State.UNKNOWN,
                "The local sample room directory cannot verify a real training location.", "edit");
            try {
                var matches = directory.fetchRooms().stream()
                    .filter(room -> room.getName() != null && room.getName().equalsIgnoreCase(item.getLocation().trim())).toList();
                if (matches.size() != 1) return new Check("operations", "Operational Information", State.UNKNOWN,
                    "The location text cannot be uniquely verified in the room directory.", "edit");
                var capacity = matches.getFirst().getCapacity();
                if (capacity == null) return new Check("operations", "Operational Information", State.UNKNOWN,
                    "The room exists, but its capacity is not available for verification.", "edit");
                if (capacity < item.getPlannedSize()) return new Check("operations", "Operational Information", State.NOT_READY,
                    "The verified room capacity is below the planned class size.", "edit");
            } catch (ExternalApiException ex) {
                return new Check("operations", "Operational Information", State.UNKNOWN,
                    "The room directory is unavailable; the venue could not be verified.", "edit");
            }
        }
        return new Check("operations", "Operational Information", State.READY,
            online ? "Delivery format and meeting URL syntax are valid." : "Delivery format, room identity and room capacity are verified.", "edit");
    }

    private boolean blank(String value) { return value == null || value.isBlank(); }
}
