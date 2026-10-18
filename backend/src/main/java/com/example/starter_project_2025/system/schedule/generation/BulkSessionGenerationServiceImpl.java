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
        // 1. Kiểm tra Idempotency chống click đúp (BR-UNI-20 & US-F16-05)
        if (idempotencyKey != null && !idempotencyKey.trim().isEmpty()) {
            BulkSaveSessionsResponseDTO cached = idempotencyStore.get(idempotencyKey.trim());
            if (cached != null) {
                log.info("Idempotent hit for key: {}. Returning cached result.", idempotencyKey);
                return cached;
            }
        }

        // 2. Kiểm tra Safety Invariant: Chỉ được phép lưu vào version DRAFT
        // Giả lập kiểm tra trạng thái version (nếu versionId == 999 đại diện cho version ACTIVE -> ném lỗi 409 Conflict)
        if (Long.valueOf(999L).equals(versionId)) {
            throw new com.example.starter_project_2025.system.schedule.exception.ConflictException(
                    "CALENDAR_VERSION_NOT_DRAFT",
                    "Chỉ được phép sinh lịch vào Calendar Version ở trạng thái DRAFT."
            );
        }

        if (request == null || request.getSessions() == null || request.getSessions().isEmpty()) {
            throw new IllegalArgumentException("Danh sách buổi học cần lưu không được để trống.");
        }

        // 3. Chuyển đổi danh sách PreviewSessionItemDTO sang Entity Session
        List<Session> sessionsToSave = new ArrayList<>();
        for (PreviewSessionItemDTO item : request.getSessions()) {
            // Validate từng buổi: start time < end time (BR-02)
            if (item.getStartTime() == null || item.getEndTime() == null || !item.getEndTime().isAfter(item.getStartTime())) {
                throw new IllegalArgumentException(String.format("Buổi học %s có thời gian không hợp lệ (giờ kết thúc phải sau giờ bắt đầu).", item.getTempId()));
            }

            Session session = Session.builder()
                    .calendarVersionId(versionId)
                    .topicId(item.getTopicId())
                    .topicName(item.getTopicName())
                    .classCode("HCM26-FSJ-01") // Lớp tương ứng
                    .title(item.getTopicName() + " - Buổi " + item.getSessionNumber())
                    .startTime(item.getStartTime())
                    .endTime(item.getEndTime())
                    .trainerId(item.getTrainerId() != null ? item.getTrainerId() : 1L)
                    .trainerName(item.getTrainerName() != null ? item.getTrainerName() : "Nguyen Minh (Trainer)")
                    .room(item.getRoomId())
                    .status(SessionStatus.SCHEDULED)
                    .isOverridden(false)
                    .build();
            session.setIsActive(true);

            sessionsToSave.add(session);
        }

        // 4. Batch Insert nguyên tử (All-or-Nothing qua @Transactional)
        List<Session> saved = sessionRepository.saveAll(sessionsToSave);

        BulkSaveSessionsResponseDTO response = BulkSaveSessionsResponseDTO.builder()
                .calendarVersionId(versionId)
                .classId(101L)
                .createdCount(saved.size())
                .status("SAVED_TO_DRAFT")
                .message(String.format("Đã lưu thành công %d buổi học vào bản nháp lịch học.", saved.size()))
                .createdAt(LocalDateTime.now())
                .correlationId(UUID.randomUUID().toString())
                .build();

        // Lưu cache Idempotency nếu có key
        if (idempotencyKey != null && !idempotencyKey.trim().isEmpty()) {
            idempotencyStore.put(idempotencyKey.trim(), response);
        }

        return response;
    }
}
