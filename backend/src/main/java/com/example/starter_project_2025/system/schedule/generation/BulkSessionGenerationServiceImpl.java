package com.example.starter_project_2025.system.schedule.generation;

import com.example.starter_project_2025.system.demo.session.Session;
import com.example.starter_project_2025.system.demo.session.SessionRepository;
import com.example.starter_project_2025.system.schedule.generation.dto.*;
import com.example.starter_project_2025.system.schedule.generation.engine.ScheduleGeneratorEngine;
import com.example.starter_project_2025.system.subject.Subject;
import com.example.starter_project_2025.system.trainingprogram.*;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

@Slf4j
@Service
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class BulkSessionGenerationServiceImpl implements BulkSessionGenerationService {

    ScheduleGeneratorEngine scheduleGeneratorEngine;
    ClassSetupService classSetupService;
    ClassTrainingProgramRepository classTrainingProgramRepository;
    TeachingAssignmentRepository teachingAssignmentRepository;
    SessionRepository sessionRepository;

    Map<String, BulkSaveSessionsResponseDTO> idempotencyStore = new ConcurrentHashMap<>();

    @Override
    @Transactional(readOnly = true)
    public ScheduleGenerationContextResponse getGenerationContext(Long classId) {
        try {
            Optional<ClassTrainingProgram> linkOpt = classTrainingProgramRepository.findByClassId(classId);
            if (linkOpt.isPresent() && linkOpt.get().getProgram() != null) {
                TrainingProgram program = linkOpt.get().getProgram();
                if (program.getSubjects() != null && !program.getSubjects().isEmpty()) {
                    List<TeachingAssignment> assignments = teachingAssignmentRepository.findByClassIdOrderByEffectiveFromAscIdAsc(classId);
                    Map<Long, TeachingAssignment> assignmentByProgSubId = new HashMap<>();
                    for (TeachingAssignment asg : assignments) {
                        if (asg.getProgramSubject() != null) {
                            assignmentByProgSubId.putIfAbsent(asg.getProgramSubject().getId(), asg);
                        }
                    }

                    List<ScheduleGenerationContextResponse.TopicContextItem> topics = new ArrayList<>();
                    double totalHours = 0.0;

                    for (ProgramSubject ps : program.getSubjects()) {
                        Subject s = ps.getSubject();
                        if (s == null) continue;
                        double hours = (s.getDurationHours() != null && s.getDurationHours() > 0)
                                ? s.getDurationHours().doubleValue()
                                : 20.0;
                        totalHours += hours;

                        TeachingAssignment asg = assignmentByProgSubId.get(ps.getId());
                        Long trainerId = (asg != null && asg.getTrainerId() != null) ? asg.getTrainerId() : 1L;
                        String trainerName = (asg != null) ? ("Giảng viên (" + asg.getRole() + " - ID: " + trainerId + ")") : "Nguyễn Văn A (Lead Trainer)";
                        Long asgId = asg != null ? asg.getId() : null;

                        topics.add(ScheduleGenerationContextResponse.TopicContextItem.builder()
                                .topicId(ps.getId())
                                .topicCode(s.getCode())
                                .topicName(s.getName())
                                .sequenceOrder(ps.getOrderIndex() != null ? ps.getOrderIndex() : 1)
                                .totalHours(hours)
                                .assignedTrainerId(trainerId)
                                .assignedTrainerName(trainerName)
                                .teachingAssignmentId(asgId)
                                .defaultRoom("Phòng A101")
                                .build());
                    }

                    if (!topics.isEmpty()) {
                        return ScheduleGenerationContextResponse.builder()
                                .classId(classId)
                                .classCode("CLASS-" + classId)
                                .className("Lớp CLASS-" + classId)
                                .programId(program.getId())
                                .programName(program.getName())
                                .programVersion(program.getVersion())
                                .totalHours(totalHours)
                                .topics(topics)
                                .build();
                    }
                }
            }
        } catch (Exception ex) {
            log.warn("Could not load curriculum from DB for classId {}: {}. Providing fallback context.",
                    classId, ex.getMessage());
        }

        // Fallback context nếu lớp chưa gán môn hoặc đang thử nghiệm
        List<ScheduleGenerationContextResponse.TopicContextItem> fallbackTopics = List.of(
                ScheduleGenerationContextResponse.TopicContextItem.builder()
                        .topicId(1L)
                        .topicCode("JAVA_CORE")
                        .topicName("Lập trình Java Căn bản & Hướng đối tượng")
                        .sequenceOrder(1)
                        .totalHours(16.0)
                        .assignedTrainerId(1L)
                        .assignedTrainerName("Nguyễn Văn A (Lead Trainer)")
                        .defaultRoom("Phòng A101")
                        .build(),
                ScheduleGenerationContextResponse.TopicContextItem.builder()
                        .topicId(2L)
                        .topicCode("SPRING_BOOT")
                        .topicName("Spring Boot Framework & RESTful API")
                        .sequenceOrder(2)
                        .totalHours(20.0)
                        .assignedTrainerId(1L)
                        .assignedTrainerName("Nguyễn Văn A (Lead Trainer)")
                        .defaultRoom("Phòng A101")
                        .build(),
                ScheduleGenerationContextResponse.TopicContextItem.builder()
                        .topicId(3L)
                        .topicCode("MICROSERVICES")
                        .topicName("Microservices Architecture & Deployment")
                        .sequenceOrder(3)
                        .totalHours(16.0)
                        .assignedTrainerId(2L)
                        .assignedTrainerName("Trần Thị B (Trainer)")
                        .defaultRoom("Phòng Lab 2")
                        .build()
        );

        return ScheduleGenerationContextResponse.builder()
                .classId(classId)
                .classCode("CLASS-" + classId)
                .className("Lớp học mẫu #" + classId)
                .programId(100L)
                .programName("Chương trình đào tạo Chuyên sâu Backend")
                .programVersion("1.0")
                .totalHours(52.0)
                .topics(fallbackTopics)
                .build();
    }

    @Override
    @Transactional(readOnly = true)
    public BulkPreviewResponseDTO generatePreview(Long classId, BulkPreviewRequestDTO request) {
        ScheduleGenerationContextResponse context = getGenerationContext(classId);
        List<PreviewSessionItemDTO> previewSessions = scheduleGeneratorEngine.generate(
                context.getTopics(), request, Collections.emptySet()
        );

        double totalHours = previewSessions.stream()
                .mapToDouble(s -> {
                    long minutes = Duration.between(s.getStartTime(), s.getEndTime()).toMinutes();
                    return minutes / 60.0;
                })
                .sum();

        boolean hasConflicts = false;
        int conflictCount = 0;

        if (Boolean.TRUE.equals(request.getCheckConflicts())) {
            for (PreviewSessionItemDTO item : previewSessions) {
                // Kiểm tra xung đột với các buổi học đã lưu trong DB
                List<Session> overlaps = sessionRepository.findOverlappingSessions(
                        classId,
                        item.getTrainerId(),
                        item.getRoomName(),
                        item.getStartTime(),
                        item.getEndTime(),
                        null,
                        Session.SessionStatus.CANCELLED
                );

                if (overlaps != null && !overlaps.isEmpty()) {
                    Session first = overlaps.get(0);
                    hasConflicts = true;
                    conflictCount++;
                    item.setStatus("CONFLICT");

                    String conflictType = Objects.equals(first.getClassId(), classId)
                            ? "CLASS_OVERLAP"
                            : (Objects.equals(first.getTrainerId(), item.getTrainerId())
                            ? "TRAINER_OVERLAP"
                            : "ROOM_OVERLAP");

                    String message = String.format("Trùng lịch với buổi '%s' từ %s đến %s",
                            first.getTitle(),
                            first.getStartTime().toString(),
                            first.getEndTime().toString());

                    item.setConflictDetails(new PreviewSessionItemDTO.ConflictDetailDTO(
                            conflictType,
                            "Lớp " + first.getClassId(),
                            message
                    ));
                }
            }
        }

        LocalDate startDate = previewSessions.isEmpty() ? request.getStartDate() : previewSessions.get(0).getDate();
        LocalDate estimatedEndDate = previewSessions.isEmpty() ? request.getStartDate() : previewSessions.get(previewSessions.size() - 1).getDate();

        return BulkPreviewResponseDTO.builder()
                .classId(classId)
                .totalSessions(previewSessions.size())
                .totalHoursCalculated(totalHours)
                .hasConflicts(hasConflicts)
                .conflictCount(conflictCount)
                .startDate(startDate)
                .estimatedEndDate(estimatedEndDate)
                .skippedHolidaysCount(0)
                .sessions(previewSessions)
                .correlationId(UUID.randomUUID().toString())
                .build();
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public BulkSaveSessionsResponseDTO saveBulkSessions(Long classId, BulkSaveSessionsRequestDTO request, String idempotencyKey) {
        // 1. Chống gửi lặp bằng Idempotency Key
        if (idempotencyKey != null && !idempotencyKey.trim().isEmpty()) {
            BulkSaveSessionsResponseDTO cached = idempotencyStore.get(idempotencyKey.trim());
            if (cached != null) {
                log.info("Idempotency hit for key: {}. Returning cached result.", idempotencyKey);
                return cached;
            }
        }

        if (request == null || request.getSessions() == null || request.getSessions().isEmpty()) {
            throw new IllegalArgumentException("Danh sách buổi học lưu không được để rỗng.");
        }

        // 2. Chuyển đổi danh sách PreviewSessionItemDTO thành entity Session
        List<Session> sessionsToSave = new ArrayList<>();
        for (PreviewSessionItemDTO item : request.getSessions()) {
            if (item.getStartTime() == null || item.getEndTime() == null || !item.getEndTime().isAfter(item.getStartTime())) {
                throw new IllegalArgumentException(String.format("Buổi %s có khoảng thời gian không hợp lệ (giờ kết thúc phải sau giờ bắt đầu).", item.getTempId()));
            }

            Session session = Session.builder()
                    .classId(classId)
                    .topicId(item.getTopicId() != null ? item.getTopicId() : 1L)
                    .trainerId(item.getTrainerId() != null ? item.getTrainerId() : 1L)
                    .teachingAssignmentId(item.getTeachingAssignmentId())
                    .roomId(item.getRoomId())
                    .title((item.getTitle() != null && !item.getTitle().isBlank())
                            ? item.getTitle()
                            : item.getTopicName() + " - Buổi " + item.getSessionNumber())
                    .startTime(item.getStartTime())
                    .endTime(item.getEndTime())
                    .location((item.getRoomName() != null && !item.getRoomName().isBlank())
                            ? item.getRoomName()
                            : (item.getRoomId() != null ? "Phòng " + item.getRoomId() : "Trực tuyến"))
                    .status(Session.SessionStatus.SCHEDULED)
                    .build();
            session.setIsActive(true);

            sessionsToSave.add(session);
        }

        // 3. Batch Insert nguyên tử (All-or-Nothing qua @Transactional)
        List<Session> saved = sessionRepository.saveAll(sessionsToSave);

        BulkSaveSessionsResponseDTO response = BulkSaveSessionsResponseDTO.builder()
                .classId(classId)
                .createdCount(saved.size())
                .status("SUCCESS")
                .message(String.format("Đã lưu thành công %d buổi học cho lớp vào hệ thống.", saved.size()))
                .createdAt(LocalDateTime.now())
                .correlationId(UUID.randomUUID().toString())
                .build();

        if (idempotencyKey != null && !idempotencyKey.trim().isEmpty()) {
            idempotencyStore.put(idempotencyKey.trim(), response);
        }

        return response;
    }
}
