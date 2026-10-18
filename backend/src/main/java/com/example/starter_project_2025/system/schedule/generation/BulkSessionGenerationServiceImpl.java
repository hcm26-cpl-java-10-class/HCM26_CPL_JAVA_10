package com.example.starter_project_2025.system.schedule.generation;

import com.example.starter_project_2025.system.schedule.Session;
import com.example.starter_project_2025.system.schedule.SessionRepository;
import com.example.starter_project_2025.system.schedule.SessionStatus;
import com.example.starter_project_2025.system.schedule.generation.dto.*;
import com.example.starter_project_2025.system.schedule.generation.engine.ScheduleGeneratorEngine;
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
    ScheduleGeneratorEngine scheduleGeneratorEngine;

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
        ScheduleGenerationContextResponse context = getGenerationContext(classId);
        List<PreviewSessionItemDTO> previewSessions = scheduleGeneratorEngine.generate(
                context.getTopics(),
                request,
                Collections.emptySet()
        );

        // Tính tổng số giờ dự kiến
        double totalHours = previewSessions.stream()
                .mapToDouble(s -> {
                    long minutes = java.time.Duration.between(s.getStartTime(), s.getEndTime()).toMinutes();
                    return minutes / 60.0;
                })
                .sum();

        // Kiểm tra xung đột nếu bật checkConflicts (US-F16-04)
        boolean hasConflicts = false;
        int conflictCount = 0;

        if (Boolean.TRUE.equals(request.getCheckConflicts())) {
            // Kiểm tra xung đột với các session đã tồn tại trong DB
            for (PreviewSessionItemDTO sessionItem : previewSessions) {
                List<Session> conflicts = sessionRepository.findConflictingSessions(
                        sessionItem.getTrainerId(),
                        sessionItem.getRoomId(),
                        null,
                        sessionItem.getStartTime(),
                        sessionItem.getEndTime(),
                        null
                );

                if (!conflicts.isEmpty()) {
                    Session first = conflicts.get(0);
                    hasConflicts = true;
                    conflictCount++;
                    sessionItem.setStatus("CONFLICT");

                    String conflictType = Objects.equals(first.getTrainerId(), sessionItem.getTrainerId())
                            ? "TRAINER_CONFLICT"
                            : "ROOM_CONFLICT";

                    String conflictMsg = String.format("Trùng lịch với lớp %s ('%s') từ %s đến %s",
                            first.getClassCode(),
                            first.getTitle(),
                            first.getStartTime().toString(),
                            first.getEndTime().toString()
                    );

                    sessionItem.setConflictDetails(PreviewSessionItemDTO.ConflictDetailDTO.builder()
                            .type(conflictType)
                            .conflictingClassCode(first.getClassCode())
                            .message(conflictMsg)
                            .build());
                }
            }
        }

        return BulkPreviewResponseDTO.builder()
                .classId(classId)
                .totalSessions(previewSessions.size())
                .totalHoursCalculated(totalHours)
                .hasConflicts(hasConflicts)
                .conflictCount(conflictCount)
                .sessions(previewSessions)
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
