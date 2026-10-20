package com.example.starter_project_2025.service;

import com.example.starter_project_2025.system.schedule.generation.dto.BulkPreviewRequestDTO;
import com.example.starter_project_2025.system.schedule.generation.dto.PreviewSessionItemDTO;
import com.example.starter_project_2025.system.schedule.generation.dto.ScheduleGenerationContextResponse;
import com.example.starter_project_2025.system.schedule.generation.engine.ScheduleGeneratorEngine;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.Collections;
import java.util.List;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.*;

public class ScheduleGeneratorEngineTest {

    private ScheduleGeneratorEngine engine;

    @BeforeEach
    void setUp() {
        engine = new ScheduleGeneratorEngine();
    }

    @Test
    @DisplayName("TC-BSG-201: Sinh đúng số buổi học theo thời lượng và lịch học tuần (T2-T4-T6)")
    void generate_ShouldDistributeSessionsAccurately() {
        // GIVEN: Topic 12 giờ, ca học 4 giờ -> dự kiến sinh 3 buổi
        List<ScheduleGenerationContextResponse.TopicContextItem> topics = List.of(
                ScheduleGenerationContextResponse.TopicContextItem.builder()
                        .topicId(1L)
                        .topicName("Java Core Foundation")
                        .sequenceOrder(1)
                        .totalHours(12.0)
                        .assignedTrainerId(10L)
                        .assignedTrainerName("Trainer A")
                        .build()
        );

        // Bắt đầu từ Thứ 2 ngày 02/11/2026
        LocalDate startDate = LocalDate.of(2026, 11, 2);
        BulkPreviewRequestDTO request = BulkPreviewRequestDTO.builder()
                .startDate(startDate)
                .daysOfWeek(Set.of(DayOfWeek.MONDAY, DayOfWeek.WEDNESDAY, DayOfWeek.FRIDAY))
                .slotTime(BulkPreviewRequestDTO.SlotTimeDTO.builder()
                        .slotName("MORNING")
                        .startTime(LocalTime.of(8, 0))
                        .endTime(LocalTime.of(12, 0))
                        .hoursPerSession(4.0)
                        .build())
                .defaultRoomId("Phòng A-301")
                .skipHolidays(true)
                .build();

        // WHEN
        List<PreviewSessionItemDTO> sessions = engine.generate(topics, request, Collections.emptySet());

        // THEN
        assertEquals(3, sessions.size(), "Topic 12h với ca 4h phải sinh đúng 3 buổi");

        assertEquals(LocalDate.of(2026, 11, 2), sessions.get(0).getDate(), "Buổi 1 là Thứ Hai 02/11");
        assertEquals(LocalDate.of(2026, 11, 4), sessions.get(1).getDate(), "Buổi 2 là Thứ Tư 04/11");
        assertEquals(LocalDate.of(2026, 11, 6), sessions.get(2).getDate(), "Buổi 3 là Thứ Sáu 06/11");

        assertEquals(LocalTime.of(8, 0), sessions.get(0).getStartTime().toLocalTime());
        assertEquals(LocalTime.of(12, 0), sessions.get(0).getEndTime().toLocalTime());
    }

    @Test
    @DisplayName("TC-BSG-202: Tự động bỏ qua ngày nghỉ lễ (02/09) và dời sang buổi tiếp theo")
    void generate_ShouldSkipNationalHoliday() {
        // GIVEN: Bắt đầu từ Thứ 2 ngày 31/08/2026, lịch T2-T4-T6
        // Thứ 4 rơi vào ngày 02/09/2026 (Quốc Khánh) -> Buổi 2 phải nhảy sang Thứ 6 ngày 04/09
        List<ScheduleGenerationContextResponse.TopicContextItem> topics = List.of(
                ScheduleGenerationContextResponse.TopicContextItem.builder()
                        .topicId(1L)
                        .topicName("Git & DevOps")
                        .sequenceOrder(1)
                        .totalHours(8.0) // 2 buổi (4h/buổi)
                        .assignedTrainerId(10L)
                        .assignedTrainerName("Trainer B")
                        .build()
        );

        LocalDate startDate = LocalDate.of(2026, 8, 31); // Thứ 2
        BulkPreviewRequestDTO request = BulkPreviewRequestDTO.builder()
                .startDate(startDate)
                .daysOfWeek(Set.of(DayOfWeek.MONDAY, DayOfWeek.WEDNESDAY, DayOfWeek.FRIDAY))
                .slotTime(BulkPreviewRequestDTO.SlotTimeDTO.builder()
                        .slotName("AFTERNOON")
                        .startTime(LocalTime.of(13, 30))
                        .endTime(LocalTime.of(17, 30))
                        .hoursPerSession(4.0)
                        .build())
                .defaultRoomId("Phòng B-202")
                .skipHolidays(true)
                .build();

        // WHEN
        List<PreviewSessionItemDTO> sessions = engine.generate(topics, request, Collections.emptySet());

        // THEN
        assertEquals(2, sessions.size());
        assertEquals(LocalDate.of(2026, 8, 31), sessions.get(0).getDate(), "Buổi 1 là Thứ Hai 31/08");
        assertEquals(LocalDate.of(2026, 9, 4), sessions.get(1).getDate(), "Buổi 2 phải bỏ qua ngày 02/09 và rơi vào Thứ Sáu 04/09");
    }

    @Test
    @DisplayName("OD-F16-01: Xử lý giờ lẻ chính xác (Topic 10 giờ với ca 4 giờ -> 4h + 4h + 2h)")
    void generate_ShouldHandleFractionalHoursProperly() {
        // GIVEN: Topic 10 giờ, ca 4 giờ -> Buổi 1: 4h, Buổi 2: 4h, Buổi 3: 2h
        List<ScheduleGenerationContextResponse.TopicContextItem> topics = List.of(
                ScheduleGenerationContextResponse.TopicContextItem.builder()
                        .topicId(1L)
                        .topicName("React Framework")
                        .sequenceOrder(1)
                        .totalHours(10.0)
                        .assignedTrainerId(5L)
                        .assignedTrainerName("Trainer C")
                        .build()
        );

        LocalDate startDate = LocalDate.of(2026, 11, 2);
        BulkPreviewRequestDTO request = BulkPreviewRequestDTO.builder()
                .startDate(startDate)
                .daysOfWeek(Set.of(DayOfWeek.MONDAY, DayOfWeek.TUESDAY, DayOfWeek.WEDNESDAY))
                .slotTime(BulkPreviewRequestDTO.SlotTimeDTO.builder()
                        .slotName("MORNING")
                        .startTime(LocalTime.of(8, 0))
                        .endTime(LocalTime.of(12, 0))
                        .hoursPerSession(4.0)
                        .build())
                .defaultRoomId("Phòng A-101")
                .skipHolidays(true)
                .build();

        // WHEN
        List<PreviewSessionItemDTO> sessions = engine.generate(topics, request, Collections.emptySet());

        // THEN
        assertEquals(3, sessions.size());
        // Buổi 1: 08:00 - 12:00 (4h)
        assertEquals(LocalTime.of(8, 0), sessions.get(0).getStartTime().toLocalTime());
        assertEquals(LocalTime.of(12, 0), sessions.get(0).getEndTime().toLocalTime());

        // Buổi 2: 08:00 - 12:00 (4h)
        assertEquals(LocalTime.of(8, 0), sessions.get(1).getStartTime().toLocalTime());
        assertEquals(LocalTime.of(12, 0), sessions.get(1).getEndTime().toLocalTime());

        // Buổi 3: 08:00 - 10:00 (2h giờ lẻ)
        assertEquals(LocalTime.of(8, 0), sessions.get(2).getStartTime().toLocalTime());
        assertEquals(LocalTime.of(10, 0), sessions.get(2).getEndTime().toLocalTime());
    }
}
