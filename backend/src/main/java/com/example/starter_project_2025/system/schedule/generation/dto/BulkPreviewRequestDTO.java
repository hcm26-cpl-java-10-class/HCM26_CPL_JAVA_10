package com.example.starter_project_2025.system.schedule.generation.dto;

import com.fasterxml.jackson.annotation.JsonFormat;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import lombok.*;
import lombok.experimental.FieldDefaults;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;
import java.util.Set;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class BulkPreviewRequestDTO {

    @NotNull(message = "Start date is required")
    LocalDate startDate;

    @NotEmpty(message = "At least one day of the week must be selected")
    Set<DayOfWeek> daysOfWeek;

    @NotNull(message = "Slot time is required")
    SlotTimeDTO slotTime;

    Long defaultRoomId;

    String defaultRoomName;
    String meetingUrl;

    @Builder.Default
    Boolean skipHolidays = true;

    @Builder.Default
    Boolean checkConflicts = true;

    List<TopicOverrideDTO> topicOverrides;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @FieldDefaults(level = AccessLevel.PRIVATE)
    public static class SlotTimeDTO {
        @JsonFormat(pattern = "HH:mm:ss")
        LocalTime startTime;

        @JsonFormat(pattern = "HH:mm:ss")
        LocalTime endTime;

        Double hoursPerSession;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @FieldDefaults(level = AccessLevel.PRIVATE)
    public static class TopicOverrideDTO {
        Long topicId;
        Long programSubjectId;
        Long trainerId;
        String trainerName;
        Long roomId;
        String roomName;
    }
}
