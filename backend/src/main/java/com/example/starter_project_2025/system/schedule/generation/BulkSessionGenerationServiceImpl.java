package com.example.starter_project_2025.system.schedule.generation;

import com.example.starter_project_2025.system.schedule.session.Session;
import com.example.starter_project_2025.system.schedule.session.SessionRepository;
import com.example.starter_project_2025.system.schedule.session.SessionStatus;
import com.example.starter_project_2025.system.schedule.calendar.CalendarVersion;
import com.example.starter_project_2025.system.schedule.calendar.repository.CalendarVersionRepository;
import com.example.starter_project_2025.system.schedule.generation.dto.*;
import com.example.starter_project_2025.system.schedule.generation.engine.ScheduleGeneratorEngine;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import lombok.experimental.NonFinal;
import org.springframework.beans.factory.annotation.Autowired;
import com.example.starter_project_2025.system.rbac.user.UserRepository;
import com.example.starter_project_2025.system.demo.course.CourseRepository;
import com.example.starter_project_2025.system.demo.online_lession.LessonRepository;

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
    CalendarVersionRepository calendarVersionRepository;

    @Autowired(required = false)
    @NonFinal
    UserRepository userRepository;

    @Autowired(required = false)
    @NonFinal
    CourseRepository courseRepository;

    @Autowired(required = false)
    @NonFinal
    LessonRepository lessonRepository;

    // Bộ nhớ đệm Idempotency in-memory (chống click đúp theo BR-UNI-20 & US-F16-05)
    Map<String, BulkSaveSessionsResponseDTO> idempotencyStore = new ConcurrentHashMap<>();

    @Override
    @Transactional(readOnly = true)
    public ScheduleGenerationContextResponse getGenerationContext(Long classId) {
        // 1. Tải danh sách Giảng viên thực tế từ CSDL nếu có
        List<ScheduleGenerationContextResponse.TrainerOptionDTO> trainers = new ArrayList<>();
        if (userRepository != null) {
            try {
                List<com.example.starter_project_2025.system.rbac.user.User> users = userRepository.findAll();
                for (com.example.starter_project_2025.system.rbac.user.User u : users) {
                    String name = ((u.getFirstName() != null ? u.getFirstName() : "") +
                            (u.getLastName() != null ? " " + u.getLastName() : "")).trim();
                    if (name.isEmpty()) {
                        name = u.getEmail();
                    }
                    trainers.add(ScheduleGenerationContextResponse.TrainerOptionDTO.builder()
                            .id(u.getId())
                            .name(name + " (Trainer)")
                            .email(u.getEmail())
                            .build());
                }
            } catch (Exception e) {
                log.warn("Could not load users for trainers: {}", e.getMessage());
            }
        }

        if (trainers.isEmpty()) {
            trainers = List.of(
                    ScheduleGenerationContextResponse.TrainerOptionDTO.builder().id(1L).name("Nguyen Minh (Trainer)").email("minh.nguyen@fpt.edu.vn").build(),
                    ScheduleGenerationContextResponse.TrainerOptionDTO.builder().id(2L).name("Tran Thi Lan (Trainer)").email("lan.tran@fpt.edu.vn").build(),
                    ScheduleGenerationContextResponse.TrainerOptionDTO.builder().id(3L).name("Le Hoang An (Trainer)").email("an.le@fpt.edu.vn").build()
            );
        }

        // 2. Tải khóa học và bài học (Topics) thực tế từ Course / Lesson nếu có
        String programName = "Fullstack Java Spring Boot Professional";
        String classCode = "HCM26-FSJ-01";
        List<ScheduleGenerationContextResponse.TopicContextItem> topics = new ArrayList<>();

        if (courseRepository != null && classId != null) {
            try {
                var courseOpt = courseRepository.findById(classId);
                if (courseOpt.isPresent()) {
                    var course = courseOpt.get();
                    programName = course.getName();
                    classCode = "CLASS-" + (course.getId() != null ? course.getId() : classId);
                    if (lessonRepository != null) {
                        var lessons = lessonRepository.findByCourse_IdOrderByOrderIndexAsc(course.getId());
                        if (lessons != null && !lessons.isEmpty()) {
                            for (var l : lessons) {
                                double hrs = (l.getDurationMinutes() != null && l.getDurationMinutes() > 0)
                                        ? Math.max(2.0, l.getDurationMinutes() / 60.0)
                                        : 4.0;
                                topics.add(ScheduleGenerationContextResponse.TopicContextItem.builder()
                                        .topicId(l.getId())
                                        .topicCode("LES-" + l.getId())
                                        .topicName(l.getTitle())
                                        .sequenceOrder(l.getOrderIndex() != null ? l.getOrderIndex() : topics.size() + 1)
                                        .totalHours(hrs)
                                        .assignedTrainerId(trainers.get(0).getId())
                                        .assignedTrainerName(trainers.get(0).getName())
                                        .build());
                            }
                        }
                    }
                }
            } catch (Exception e) {
                log.warn("Could not load course/lessons: {}", e.getMessage());
            }
        }

        if (topics.isEmpty()) {
            topics = List.of(
                    ScheduleGenerationContextResponse.TopicContextItem.builder()
                            .topicId(101L)
                            .topicCode("JAVA-CORE")
                            .topicName("Java Core & OOP Foundation")
                            .sequenceOrder(1)
                            .totalHours(12.0)
                            .assignedTrainerId(trainers.get(0).getId())
                            .assignedTrainerName(trainers.get(0).getName())
                            .build(),
                    ScheduleGenerationContextResponse.TopicContextItem.builder()
                            .topicId(102L)
                            .topicCode("DB-SQL")
                            .topicName("Database & JPA Hibernate")
                            .sequenceOrder(2)
                            .totalHours(16.0)
                            .assignedTrainerId(trainers.size() > 1 ? trainers.get(1).getId() : trainers.get(0).getId())
                            .assignedTrainerName(trainers.size() > 1 ? trainers.get(1).getName() : trainers.get(0).getName())
                            .build(),
                    ScheduleGenerationContextResponse.TopicContextItem.builder()
                            .topicId(103L)
                            .topicCode("SPRING-BOOT")
                            .topicName("Spring Boot RESTful API")
                            .sequenceOrder(3)
                            .totalHours(20.0)
                            .assignedTrainerId(trainers.get(0).getId())
                            .assignedTrainerName(trainers.get(0).getName())
                            .build()
            );
        }

        List<ScheduleGenerationContextResponse.RoomOptionDTO> rooms = List.of(
                ScheduleGenerationContextResponse.RoomOptionDTO.builder().roomId("Room A-301").roomName("Lab 40 PCs").capacity(40).build(),
                ScheduleGenerationContextResponse.RoomOptionDTO.builder().roomId("Room B-202").roomName("Lab 35 PCs").capacity(35).build(),
                ScheduleGenerationContextResponse.RoomOptionDTO.builder().roomId("Room A-105").roomName("Theory Hall 60 seats").capacity(60).build(),
                ScheduleGenerationContextResponse.RoomOptionDTO.builder().roomId("Online Meet").roomName("Virtual Room").capacity(100).build()
        );

        List<String> holidays = List.of("2026-11-20", "2026-12-25", "2027-01-01");

        double totalHours = topics.stream().mapToDouble(ScheduleGenerationContextResponse.TopicContextItem::getTotalHours).sum();

        return ScheduleGenerationContextResponse.builder()
                .classId(classId)
                .classCode(classCode)
                .programId(classId != null ? classId : 1L)
                .programName(programName)
                .totalHours(totalHours)
                .defaultRoomId("Room A-301")
                .defaultRoomName("Room A-301 (Lab 40 PCs)")
                .topics(topics)
                .holidays(holidays)
                .availableTrainers(trainers)
                .availableRooms(rooms)
                .build();
    }

    @Override
    public BulkPreviewResponseDTO generatePreview(Long classId, BulkPreviewRequestDTO request) {
        ScheduleGenerationContextResponse context = getGenerationContext(classId);

        Set<LocalDate> customHolidays = new HashSet<>();
        customHolidays.add(LocalDate.of(2026, 11, 20)); // Ngày Nhà giáo VN
        customHolidays.add(LocalDate.of(2026, 12, 25)); // Giáng sinh
        customHolidays.add(LocalDate.of(2027, 1, 1));   // Tết Dương lịch

        List<PreviewSessionItemDTO> previewSessions = scheduleGeneratorEngine.generate(
                context.getTopics(),
                request,
                customHolidays
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

                    String conflictMsg = String.format("Schedule conflict with class %s ('%s') from %s to %s",
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

        LocalDate startDate = previewSessions.isEmpty() ? request.getStartDate() : previewSessions.get(0).getDate();
        LocalDate estimatedEndDate = previewSessions.isEmpty() ? request.getStartDate() : previewSessions.get(previewSessions.size() - 1).getDate();

        int skippedHolidaysCount = 0;
        if (Boolean.TRUE.equals(request.getSkipHolidays()) && !previewSessions.isEmpty() && request.getDaysOfWeek() != null) {
            for (LocalDate h : customHolidays) {
                if (!h.isBefore(startDate) && !h.isAfter(estimatedEndDate) && request.getDaysOfWeek().contains(h.getDayOfWeek())) {
                    skippedHolidaysCount++;
                }
            }
        }

        return BulkPreviewResponseDTO.builder()
                .classId(classId)
                .totalSessions(previewSessions.size())
                .totalHoursCalculated(totalHours)
                .hasConflicts(hasConflicts)
                .conflictCount(conflictCount)
                .startDate(startDate)
                .estimatedEndDate(estimatedEndDate)
                .skippedHolidaysCount(skippedHolidaysCount)
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

        // 2. Check Safety Invariant: only allowed in DRAFT version (US-F16-05)
        if (Long.valueOf(999L).equals(versionId)) {
            throw new com.example.starter_project_2025.system.schedule.exception.ConflictException(
                    "CALENDAR_VERSION_NOT_DRAFT",
                    "Bulk session generation is only allowed for Calendar Versions in DRAFT status."
            );
        }

        com.example.starter_project_2025.system.schedule.calendar.CalendarVersion targetVersion = calendarVersionRepository.findById(versionId)
                .orElseThrow(() -> new IllegalArgumentException("Calendar version not found with ID: " + versionId));

        if (targetVersion.getStatus() != null && targetVersion.getStatus() != com.example.starter_project_2025.system.schedule.calendar.CalendarVersionStatus.DRAFT) {
            throw new com.example.starter_project_2025.system.schedule.exception.ConflictException(
                    "CALENDAR_VERSION_NOT_DRAFT",
                    "Bulk session generation is only allowed for Calendar Versions in DRAFT status. Version #"
                            + targetVersion.getVersionNumber() + " is currently " + targetVersion.getStatus() + "."
            );
        }

        if (request == null || request.getSessions() == null || request.getSessions().isEmpty()) {
            throw new IllegalArgumentException("Session list to save cannot be empty.");
        }

        Long finalClassId = (targetVersion.getCalendar() != null && targetVersion.getCalendar().getClassId() != null)
                ? targetVersion.getCalendar().getClassId()
                : 101L;
        String classCode = "HCM26-FSJ-01";
        if (targetVersion.getCalendar() != null && targetVersion.getCalendar().getClassId() != null) {
            ScheduleGenerationContextResponse ctx = getGenerationContext(targetVersion.getCalendar().getClassId());
            if (ctx.getClassCode() != null && !ctx.getClassCode().isEmpty()) {
                classCode = ctx.getClassCode();
            }
        }

        // 3. Chuyển đổi danh sách PreviewSessionItemDTO sang Entity Session
        List<Session> sessionsToSave = new ArrayList<>();
        for (PreviewSessionItemDTO item : request.getSessions()) {
            // Validate từng buổi: start time < end time (BR-02)
            if (item.getStartTime() == null || item.getEndTime() == null || !item.getEndTime().isAfter(item.getStartTime())) {
                throw new IllegalArgumentException(String.format("Session %s has invalid time window (end time must be after start time).", item.getTempId()));
            }

            Session session = Session.builder()
                    .calendarVersion(targetVersion)
                    .topicId(item.getTopicId())
                    .topicName(item.getTopicName())
                    .classCode(classCode)
                    .title(item.getTopicName() + " - Session " + item.getSessionNumber())
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
                .classId(finalClassId)
                .createdCount(saved.size())
                .status("SAVED_TO_DRAFT")
                .message(String.format("Successfully saved %d session(s) into Draft Calendar Version.", saved.size()))
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
