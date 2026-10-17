package com.example.starter_project_2025.system.schedule.generation;

import com.example.starter_project_2025.system.schedule.session.Session;
import com.example.starter_project_2025.system.schedule.session.SessionRepository;
import com.example.starter_project_2025.system.schedule.session.SessionStatus;
import com.example.starter_project_2025.system.schedule.generation.dto.*;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

@Slf4j
@Service
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class BulkSessionGenerationServiceImpl implements BulkSessionGenerationService {

    SessionRepository sessionRepository;

    // Bộ nhớ đệm Idempotency in-memory (chống click đúp theo BR-UNI-20 & US-F16-05)
    Map<String, BulkSaveSessionsResponseDTO> idempotencyStore = new ConcurrentHashMap<>();

    @Override
    @Transactional(readOnly = true)
    public ScheduleGenerationContextResponse getGenerationContext(Long classId) {
        // Dữ liệu mẫu topic theo thứ tự sequence_order (US-F16-01)
        List<ScheduleGenerationContextResponse.TopicContextItem> topics = List.of(
                ScheduleGenerationContextResponse.TopicContextItem.builder()
                        .topicId(101L)
                        .topicName("Java Core & OOP Foundation")
                        .sequenceOrder(1)
                        .totalHours(12.0)
                        .assignedTrainerId(1L)
                        .assignedTrainerName("Nguyen Minh (Trainer)")
                        .build(),
                ScheduleGenerationContextResponse.TopicContextItem.builder()
                        .topicId(102L)
                        .topicName("Database & JPA Hibernate")
                        .sequenceOrder(2)
                        .totalHours(16.0)
                        .assignedTrainerId(2L)
                        .assignedTrainerName("Tran Thi Lan (Trainer)")
                        .build(),
                ScheduleGenerationContextResponse.TopicContextItem.builder()
                        .topicId(103L)
                        .topicName("Spring Boot RESTful API")
                        .sequenceOrder(3)
                        .totalHours(20.0)
                        .assignedTrainerId(1L)
                        .assignedTrainerName("Nguyen Minh (Trainer)")
                        .build()
        );

        return ScheduleGenerationContextResponse.builder()
                .classId(classId)
                .classCode("HCM26-FSJ-01")
                .programId(1L)
                .programName("Fullstack Java Spring Boot Professional")
                .defaultRoomId("Phòng A-301")
                .defaultRoomName("Phòng A-301 (Lab 40 máy)")
                .topics(topics)
                .build();
    }

    @Override
    public BulkPreviewResponseDTO generatePreview(Long classId, BulkPreviewRequestDTO request) {
        // Sẽ triển khai chi tiết ở Bước 2 với ScheduleGeneratorEngine
        return BulkPreviewResponseDTO.builder()
                .classId(classId)
                .totalSessions(0)
                .totalHoursCalculated(0.0)
                .hasConflicts(false)
                .conflictCount(0)
                .sessions(Collections.emptyList())
                .correlationId(UUID.randomUUID().toString())
                .build();
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public BulkSaveSessionsResponseDTO saveBulkSessions(Long versionId, BulkSaveSessionsRequestDTO request, String idempotencyKey) {
        // Sẽ triển khai chi tiết ở Bước 3 với All-or-Nothing transaction
        return BulkSaveSessionsResponseDTO.builder()
                .calendarVersionId(versionId)
                .classId(1L)
                .createdCount(0)
                .status("SAVED_TO_DRAFT")
                .message("Mock response")
                .createdAt(LocalDateTime.now())
                .correlationId(UUID.randomUUID().toString())
                .build();
    }
}
