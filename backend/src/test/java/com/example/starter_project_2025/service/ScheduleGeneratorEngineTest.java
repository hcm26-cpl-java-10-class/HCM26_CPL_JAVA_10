package com.example.starter_project_2025.service;

import com.example.starter_project_2025.system.schedule.generation.dto.*;
import com.example.starter_project_2025.system.schedule.generation.engine.ScheduleGeneratorEngine;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.Collections;
import java.util.List;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;

class ScheduleGeneratorEngineTest {

    private final ScheduleGeneratorEngine engine = new ScheduleGeneratorEngine();

    @Test
    @DisplayName("Should generate sessions across requested days of week and handle partial hours")
    void shouldGenerateSessions() {
        var topics = List.of(
                ScheduleGenerationContextResponse.TopicContextItem.builder()
                        .topicId(1L)
                        .topicCode("JAVA_CORE")
                        .topicName("Java Core")
                        .sequenceOrder(1)
                        .totalHours(10.0) // 10 hours with 4h slot -> 3 sessions (4h, 4h, 2h)
                        .assignedTrainerId(10L)
                        .assignedTrainerName("Trainer A")
                        .build()
        );

        // Next Monday: 2026-11-02
        LocalDate startDate = LocalDate.of(2026, 11, 2);

        BulkPreviewRequestDTO request = BulkPreviewRequestDTO.builder()
                .startDate(startDate)
                .daysOfWeek(Set.of(DayOfWeek.MONDAY, DayOfWeek.WEDNESDAY, DayOfWeek.FRIDAY))
                .slotTime(BulkPreviewRequestDTO.SlotTimeDTO.builder()
                        .startTime(LocalTime.of(8, 0))
                        .hoursPerSession(4.0)
                        .build())
                .defaultRoomId(101L)
                .defaultRoomName("Room A101")
                .skipHolidays(true)
                .build();

        List<PreviewSessionItemDTO> result = engine.generate(topics, request, Collections.emptySet());

        assertThat(result).hasSize(3);

        // Session 1: Monday 2026-11-02 08:00 - 12:00 (4 hours)
        assertThat(result.get(0).getDate()).isEqualTo(LocalDate.of(2026, 11, 2));
        assertThat(result.get(0).getStartTime()).isEqualTo(LocalDate.of(2026, 11, 2).atTime(8, 0));
        assertThat(result.get(0).getEndTime()).isEqualTo(LocalDate.of(2026, 11, 2).atTime(12, 0));

        // Session 2: Wednesday 2026-11-04 08:00 - 12:00 (4 hours)
        assertThat(result.get(1).getDate()).isEqualTo(LocalDate.of(2026, 11, 4));

        // Session 3: Friday 2026-11-06 08:00 - 10:00 (Remaining 2 hours!)
        assertThat(result.get(2).getDate()).isEqualTo(LocalDate.of(2026, 11, 6));
        assertThat(result.get(2).getStartTime()).isEqualTo(LocalDate.of(2026, 11, 6).atTime(8, 0));
        assertThat(result.get(2).getEndTime()).isEqualTo(LocalDate.of(2026, 11, 6).atTime(10, 0));
    }

    @Test
    @DisplayName("Should skip national holidays such as 09-02 (National Day)")
    void shouldSkipNationalHolidays() {
        var topics = List.of(
                ScheduleGenerationContextResponse.TopicContextItem.builder()
                        .topicId(1L)
                        .topicName("Topic 1")
                        .sequenceOrder(1)
                        .totalHours(4.0)
                        .build()
        );

        // 2026-09-02 is Wednesday (National Holiday)
        LocalDate startDate = LocalDate.of(2026, 9, 2);

        BulkPreviewRequestDTO request = BulkPreviewRequestDTO.builder()
                .startDate(startDate)
                .daysOfWeek(Set.of(DayOfWeek.WEDNESDAY, DayOfWeek.FRIDAY))
                .slotTime(BulkPreviewRequestDTO.SlotTimeDTO.builder()
                        .startTime(LocalTime.of(8, 0))
                        .hoursPerSession(4.0)
                        .build())
                .skipHolidays(true)
                .build();

        List<PreviewSessionItemDTO> result = engine.generate(topics, request, Collections.emptySet());

        // Should skip 2026-09-02 and land on 2026-09-04 (Friday)
        assertThat(result).hasSize(1);
        assertThat(result.get(0).getDate()).isEqualTo(LocalDate.of(2026, 9, 4));
    }
}
