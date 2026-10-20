package com.example.starter_project_2025.service;

import com.example.starter_project_2025.system.schedule.session.Session;
import com.example.starter_project_2025.system.schedule.session.SessionRepository;
import com.example.starter_project_2025.system.schedule.calendar.repository.CalendarVersionRepository;
import com.example.starter_project_2025.system.schedule.calendar.CalendarVersion;
import com.example.starter_project_2025.system.schedule.calendar.CalendarVersionStatus;
import com.example.starter_project_2025.system.schedule.exception.ConflictException;
import com.example.starter_project_2025.system.schedule.generation.BulkSessionGenerationServiceImpl;
import com.example.starter_project_2025.system.schedule.generation.dto.BulkSaveSessionsRequestDTO;
import com.example.starter_project_2025.system.schedule.generation.dto.BulkSaveSessionsResponseDTO;
import com.example.starter_project_2025.system.schedule.generation.dto.PreviewSessionItemDTO;
import com.example.starter_project_2025.system.schedule.generation.engine.ScheduleGeneratorEngine;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
public class BulkSessionGenerationServiceTest {

    @Mock
    private SessionRepository sessionRepository;

    @Mock
    private CalendarVersionRepository calendarVersionRepository;

    private ScheduleGeneratorEngine scheduleGeneratorEngine = new ScheduleGeneratorEngine();

    private BulkSessionGenerationServiceImpl service;

    @BeforeEach
    void setUp() {
        service = new BulkSessionGenerationServiceImpl(sessionRepository, scheduleGeneratorEngine, calendarVersionRepository);
    }

    @Test
    @DisplayName("TC-BSG-501: Lưu thành công danh sách Session vào CalendarVersion DRAFT")
    void saveBulkSessions_ShouldPersistSuccessfully() {
        // GIVEN: 2 buổi học hợp lệ cần lưu vào version DRAFT #10
        Long versionId = 10L;
        List<PreviewSessionItemDTO> items = List.of(
                PreviewSessionItemDTO.builder()
                        .tempId("tmp-001")
                        .topicId(101L)
                        .topicName("Java Core")
                        .sessionNumber(1)
                        .date(LocalDate.of(2026, 11, 2))
                        .startTime(LocalDateTime.of(2026, 11, 2, 8, 0))
                        .endTime(LocalDateTime.of(2026, 11, 2, 12, 0))
                        .trainerId(1L)
                        .trainerName("Nguyen Minh")
                        .roomId("Phòng A-301")
                        .build(),
                PreviewSessionItemDTO.builder()
                        .tempId("tmp-002")
                        .topicId(101L)
                        .topicName("Java Core")
                        .sessionNumber(2)
                        .date(LocalDate.of(2026, 11, 4))
                        .startTime(LocalDateTime.of(2026, 11, 4, 8, 0))
                        .endTime(LocalDateTime.of(2026, 11, 4, 12, 0))
                        .trainerId(1L)
                        .trainerName("Nguyen Minh")
                        .roomId("Phòng A-301")
                        .build()
        );

        BulkSaveSessionsRequestDTO request = BulkSaveSessionsRequestDTO.builder()
                .sessions(items)
                .build();

        CalendarVersion draft = new CalendarVersion();
        draft.setStatus(CalendarVersionStatus.DRAFT);
        when(calendarVersionRepository.findActiveByIdForUpdate(versionId))
                .thenReturn(java.util.Optional.of(draft));
        when(sessionRepository.saveAll(anyList())).thenAnswer(invocation -> invocation.getArgument(0));

        // WHEN
        BulkSaveSessionsResponseDTO response = service.saveBulkSessions(versionId, request, "idemp-key-001");

        // THEN
        assertNotNull(response);
        assertEquals(versionId, response.getCalendarVersionId());
        assertEquals(2, response.getCreatedCount());
        assertEquals("SAVED_TO_DRAFT", response.getStatus());

        verify(sessionRepository, times(1)).saveAll(anyList());
    }

    @Test
    @DisplayName("TC-BSG-503: Chặn cố tình lưu vào CalendarVersion ACTIVE (Safety Invariant)")
    void saveBulkSessions_ShouldThrowConflict_WhenVersionIsActive() {
        // GIVEN: version đang ở trạng thái ACTIVE
        Long activeVersionId = 999L;
        BulkSaveSessionsRequestDTO request = BulkSaveSessionsRequestDTO.builder()
                .sessions(List.of(
                        PreviewSessionItemDTO.builder()
                                .tempId("tmp-001")
                                .startTime(LocalDateTime.of(2026, 11, 2, 8, 0))
                                .endTime(LocalDateTime.of(2026, 11, 2, 12, 0))
                                .build()
                ))
                .build();

        CalendarVersion active = new CalendarVersion();
        active.setVersionNumber(1);
        active.setStatus(CalendarVersionStatus.ACTIVE);
        when(calendarVersionRepository.findActiveByIdForUpdate(activeVersionId))
                .thenReturn(java.util.Optional.of(active));

        // WHEN & THEN: Phải ném ngoại lệ ConflictException (HTTP 409)
        ConflictException ex = assertThrows(ConflictException.class, () ->
                service.saveBulkSessions(activeVersionId, request, null)
        );

        assertEquals("CALENDAR_VERSION_NOT_DRAFT", ex.getCode());
        verify(sessionRepository, never()).saveAll(anyList());
    }

    @Test
    @DisplayName("TC-BSG-504: Chống trùng lặp khi gửi cùng Idempotency-Key (Replay Protection)")
    void saveBulkSessions_ShouldReturnCachedResult_WhenReplayedWithSameIdempotencyKey() {
        // GIVEN
        Long versionId = 10L;
        String idempotencyKey = "idemp-key-unique-999";
        BulkSaveSessionsRequestDTO request = BulkSaveSessionsRequestDTO.builder()
                .sessions(List.of(
                        PreviewSessionItemDTO.builder()
                                .tempId("tmp-001")
                                .startTime(LocalDateTime.of(2026, 11, 2, 8, 0))
                                .endTime(LocalDateTime.of(2026, 11, 2, 12, 0))
                                .build()
                ))
                .build();

        CalendarVersion draft = new CalendarVersion();
        draft.setStatus(CalendarVersionStatus.DRAFT);
        when(calendarVersionRepository.findActiveByIdForUpdate(versionId))
                .thenReturn(java.util.Optional.of(draft));
        when(sessionRepository.saveAll(anyList())).thenAnswer(invocation -> invocation.getArgument(0));

        // WHEN: Lần gọi thứ 1
        BulkSaveSessionsResponseDTO firstCall = service.saveBulkSessions(versionId, request, idempotencyKey);

        // WHEN: Lần gọi thứ 2 với cùng idempotencyKey
        BulkSaveSessionsResponseDTO secondCall = service.saveBulkSessions(versionId, request, idempotencyKey);

        // THEN: Cả 2 lần trả về cùng 1 kết quả, nhưng saveAll chỉ được gọi đúng 1 lần duy nhất
        assertSame(firstCall, secondCall);
        verify(sessionRepository, times(1)).saveAll(anyList());
        verify(calendarVersionRepository, times(2)).findActiveByIdForUpdate(versionId);
    }
}
