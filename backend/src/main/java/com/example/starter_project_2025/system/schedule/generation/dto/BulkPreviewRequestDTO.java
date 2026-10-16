package com.example.starter_project_2025.system.schedule.generation.dto;

import com.fasterxml.jackson.annotation.JsonFormat;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import lombok.*;
import lombok.experimental.FieldDefaults;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;
import java.util.Set;

@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class BulkPreviewRequestDTO {

    @NotNull(message = "Start date is required")
    @JsonFormat(pattern = "yyyy-MM-dd")
    LocalDate startDate;

    @NotEmpty(message = "At least one day of week must be selected")
    Set<DayOfWeek> daysOfWeek;

    @NotNull(message = "Slot time configuration is required")
    @Valid
    SlotTimeDTO slotTime;

    String defaultRoomId;

    @Builder.Default
    Boolean skipHolidays = true;

    @Builder.Default
    Boolean checkConflicts = true;

    // Cho phép gửi kèm danh sách tùy chỉnh Topic nếu muốn điều chỉnh trước
    List<TopicOverrideDTO> topicOverrides;

    @Getter
    @Setter
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @FieldDefaults(level = AccessLevel.PRIVATE)
    public static class SlotTimeDTO {
        String slotName;

        @NotNull(message = "Start time is required")
        @JsonFormat(pattern = "HH:mm[:ss]")
        LocalTime startTime;

        @NotNull(message = "End time is required")
        @JsonFormat(pattern = "HH:mm[:ss]")
        LocalTime endTime;

        @NotNull(message = "Hours per session is required")
        Double hoursPerSession;
    }

    @Getter
    @Setter
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @FieldDefaults(level = AccessLevel.PRIVATE)
    public static class TopicOverrideDTO {
        Long topicId;
        Long trainerId;
        String trainerName;
        String roomId;
    }
}
