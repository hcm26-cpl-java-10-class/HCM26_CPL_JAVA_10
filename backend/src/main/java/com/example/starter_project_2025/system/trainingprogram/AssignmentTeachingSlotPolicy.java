package com.example.starter_project_2025.system.trainingprogram;

import com.example.starter_project_2025.exception.BusinessValidationException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import java.time.Duration;
import java.util.*;

@Service
@RequiredArgsConstructor
public class AssignmentTeachingSlotPolicy {
    private final TeachingAssignmentRepository assignments;
    private final AssignmentSessionHistory history;

    public void validate(TeachingAssignmentRequest request, Long ignoreId) {
        var slots = request.teachingSlots();
        if (slots == null) return; // Existing API clients and historical assignments have no dated slots.
        if (slots.isEmpty() || slots.size() > 200) throw invalid("teachingSlots", "Add between 1 and 200 teaching slots.");
        for (int i = 0; i < slots.size(); i++) {
            var slot = slots.get(i);
            String field = "teachingSlots[" + i + "]";
            durationMinutes(slot, field);
            if (slot.getDate().isBefore(request.effectiveFrom())
                    || (request.effectiveTo() != null && slot.getDate().isAfter(request.effectiveTo())))
                throw invalid(field + ".date", "Teaching date must be within the assignment effective dates and class dates.");
            for (int j = 0; j < i; j++) {
                var previous = slots.get(j);
                if (slot.getDate().equals(previous.getDate()) && slot.getStartTime().isBefore(previous.getEndTime())
                        && previous.getStartTime().isBefore(slot.getEndTime()))
                    throw invalid(field + ".startTime", "Teaching slots must not overlap. Adjacent slots are allowed.");
            }
            if (assignments.existsTrainerSlotConflict(request.trainerId(), ignoreId, slot.getDate(), slot.getStartTime(), slot.getEndTime())
                    || history.hasTrainerBooking(request.trainerId(), ignoreId,
                        slot.getDate().atTime(slot.getStartTime()), slot.getDate().atTime(slot.getEndTime())))
                throw invalid("teachingSlots", "The trainer already has a teaching slot or session overlapping "
                        + slot.getDate() + " " + slot.getStartTime() + "–" + slot.getEndTime() + ". Choose another time.");
        }
    }
    public static long durationMinutes(AssignmentTeachingSlot slot, String field) {
        if (slot == null || slot.getDate() == null) throw invalid(field + ".date", "Enter a teaching date.");
        if (slot.getStartTime() == null) throw invalid(field + ".startTime", "Enter a start time.");
        if (slot.getEndTime() == null) throw invalid(field + ".endTime", "Enter an end time.");
        if (!slot.getEndTime().isAfter(slot.getStartTime())) throw invalid(field + ".endTime", "End time must be after start time on the same day.");
        if (slot.getStartTime().getSecond() != 0 || slot.getEndTime().getSecond() != 0
                || slot.getStartTime().getNano() != 0 || slot.getEndTime().getNano() != 0)
            throw invalid(field + ".startTime", "Use hours and minutes only (HH:mm).");
        long minutes = Duration.between(slot.getStartTime(), slot.getEndTime()).toMinutes();
        if (minutes <= 30) throw invalid(field + ".endTime", "Each teaching slot must be longer than 30 minutes.");
        return minutes;
    }
    private static BusinessValidationException invalid(String field, String message) {
        return new BusinessValidationException(Map.of(field, List.of(message)));
    }
}
