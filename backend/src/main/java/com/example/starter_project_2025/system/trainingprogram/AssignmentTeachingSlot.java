package com.example.starter_project_2025.system.trainingprogram;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import jakarta.validation.constraints.NotNull;
import lombok.*;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.List;

/** A dated teaching interval in Vietnam local time; adjacent intervals may touch. */
@Embeddable
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @EqualsAndHashCode
public class AssignmentTeachingSlot {
    @NotNull(message = "Enter a teaching date.")
    @Column(name = "teaching_date", nullable = false)
    private LocalDate date;
    @NotNull(message = "Enter a start time.")
    @Column(name = "starts_at", nullable = false)
    private LocalTime startTime;
    @NotNull(message = "Enter an end time.")
    @Column(name = "ends_at", nullable = false)
    private LocalTime endTime;

    public boolean contains(LocalDateTime from, LocalDateTime to) {
        return from != null && to != null && to.isAfter(from)
                && date.equals(from.toLocalDate()) && date.equals(to.toLocalDate())
                && !from.toLocalTime().isBefore(startTime) && !to.toLocalTime().isAfter(endTime);
    }
    public static boolean covers(List<AssignmentTeachingSlot> slots, LocalDateTime from, LocalDateTime to) {
        return slots == null || slots.isEmpty() || slots.stream().anyMatch(slot -> slot.contains(from, to));
    }
}
