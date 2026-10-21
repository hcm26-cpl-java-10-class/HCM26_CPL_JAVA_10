package com.example.starter_project_2025.system.schedule.generation.engine;

import com.example.starter_project_2025.system.schedule.generation.dto.BulkPreviewRequestDTO;
import com.example.starter_project_2025.system.schedule.generation.dto.PreviewSessionItemDTO;
import com.example.starter_project_2025.system.schedule.generation.dto.ScheduleGenerationContextResponse;
import org.springframework.stereotype.Component;

import java.time.DayOfWeek;
import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.*;
import java.util.Objects;
import java.util.Comparator;

@Component
public class ScheduleGeneratorEngine {

    // Danh sách ngày lễ mặc định toàn quốc (Định dạng MM-dd để áp dụng cho mọi năm)
    private static final Set<String> DEFAULT_NATIONAL_HOLIDAYS = Set.of(
            "01-01", // Tết Dương Lịch
            "04-30", // Ngày Giải phóng Miền Nam
            "05-01", // Ngày Quốc tế Lao động
            "09-02"  // Ngày Quốc Khánh
    );

    /**
     * Sinh danh sách buổi học dự kiến
     */
    public List<PreviewSessionItemDTO> generate(
            List<ScheduleGenerationContextResponse.TopicContextItem> topics,
            BulkPreviewRequestDTO request,
            Set<LocalDate> customHolidays
    ) {
        if (topics == null || topics.isEmpty()) {
            return Collections.emptyList();
        }

        // Validate slot time
        validateSlotTime(request.getSlotTime());

        List<PreviewSessionItemDTO> result = new ArrayList<>();
        LocalDate currentDate = request.getStartDate();
        Set<DayOfWeek> daysOfWeek = request.getDaysOfWeek();
        BulkPreviewRequestDTO.SlotTimeDTO slot = request.getSlotTime();
        double hoursPerSession = slot.getHoursPerSession() != null && slot.getHoursPerSession() > 0
                ? slot.getHoursPerSession()
                : 4.0;

        // Map topic override nếu người dùng có tùy chỉnh trước
        Map<Long, BulkPreviewRequestDTO.TopicOverrideDTO> overrideMap = new HashMap<>();
        if (request.getTopicOverrides() != null) {
            for (BulkPreviewRequestDTO.TopicOverrideDTO o : request.getTopicOverrides()) {
                overrideMap.put(o.getTopicId(), o);
            }
        }

        // Sắp xếp danh mục Topic theo sequenceOrder tăng dần
        List<ScheduleGenerationContextResponse.TopicContextItem> sortedTopics = new ArrayList<>(topics);
        sortedTopics.sort(Comparator.comparing(
                ScheduleGenerationContextResponse.TopicContextItem::getSequenceOrder,
                Comparator.nullsLast(Comparator.naturalOrder())
        ));

        int globalSessionCounter = 1;

        for (ScheduleGenerationContextResponse.TopicContextItem topic : sortedTopics) {
            double remainingHours = topic.getTotalHours() != null ? topic.getTotalHours() : 0.0;
            if (remainingHours <= 0) {
                continue;
            }

            int sessionIndexForTopic = 1;

            // Xác định Trainer và Room cho Topic này
            Long trainerId = topic.getAssignedTrainerId();
            String trainerName = topic.getAssignedTrainerName();
            String roomId = request.getDefaultRoomId();

            if (overrideMap.containsKey(topic.getTopicId())) {
                BulkPreviewRequestDTO.TopicOverrideDTO o = overrideMap.get(topic.getTopicId());
                if (o.getTrainerId() != null) {
                    trainerId = o.getTrainerId();
                }
                if (o.getTrainerName() != null) {
                    trainerName = o.getTrainerName();
                }
                if (o.getRoomId() != null) {
                    roomId = o.getRoomId();
                }
            }

            while (remainingHours > 0) {
                // Tìm ngày học hợp lệ kế tiếp thỏa mãn: thuộc daysOfWeek và không phải holiday
                while (!isValidTeachingDay(currentDate, daysOfWeek, request.getSkipHolidays(), customHolidays)) {
                    currentDate = currentDate.plusDays(1);
                }

                // Xử lý giờ lẻ theo OD-F16-01: Buổi cuối Topic chỉ lấy số giờ còn lại
                double actualHours = Math.min(hoursPerSession, remainingHours);

                LocalTime startTime = slot.getStartTime();
                long minutesToAdd = Math.round(actualHours * 60);
                LocalTime endTime = startTime.plusMinutes(minutesToAdd);

                // Validate end time không vượt quá slot.endTime
                if (slot.getEndTime() != null && endTime.isAfter(slot.getEndTime())) {
                    endTime = slot.getEndTime();
                    actualHours = Duration.between(startTime, endTime).toMinutes() / 60.0;
                    if (actualHours <= 0) {
                        throw new IllegalArgumentException("Slot time too short for session");
                    }
                }

                LocalDateTime sessionStart = LocalDateTime.of(currentDate, startTime);
                LocalDateTime sessionEnd = LocalDateTime.of(currentDate, endTime);

                String tempId = String.format("tmp-%03d", globalSessionCounter);

                // Check intra-batch conflict with already generated sessions in this preview
                if (hasIntraBatchConflict(result, trainerId, roomId, sessionStart, sessionEnd)) {
                    throw new IllegalStateException(
                            String.format("Intra-batch conflict detected: trainer=%s, room=%s at %s - %s. " +
                                            "Adjust trainer/room in topic overrides or change slot/days.",
                                    trainerId, roomId, sessionStart, sessionEnd)
                    );
                }

                PreviewSessionItemDTO sessionItem = PreviewSessionItemDTO.builder()
                        .tempId(String.format("tmp-%03d", globalSessionCounter))
                        .topicId(topic.getTopicId())
                        .topicName(topic.getTopicName())
                        .sessionNumber(sessionIndexForTopic)
                        .date(currentDate)
                        .startTime(sessionStart)
                        .endTime(sessionEnd)
                        .trainerId(trainerId)
                        .trainerName(trainerName)
                        .roomId(roomId)
                        .status("VALID")
                        .build();

                result.add(sessionItem);

                remainingHours -= actualHours;
                sessionIndexForTopic++;
                globalSessionCounter++;

                // Chuyển sang ngày tiếp theo để xếp buổi kế tiếp
                currentDate = currentDate.plusDays(1);
            }
        }

        return result;
    }

    /**
     * Check intra-batch conflict: pairwise comparison within the same generated batch.
     */
    private boolean hasIntraBatchConflict(
            List<PreviewSessionItemDTO> existingSessions,
            Long trainerId,
            String roomId,
            LocalDateTime startTime,
            LocalDateTime endTime
    ) {
        for (PreviewSessionItemDTO existing : existingSessions) {
            if (overlaps(existing.getStartTime(), existing.getEndTime(), startTime, endTime)) {
                boolean trainerConflict = Objects.equals(existing.getTrainerId(), trainerId);
                boolean roomConflict = sameNonBlankRoom(existing.getRoomId(), roomId);
                if (trainerConflict || roomConflict) {
                    return true;
                }
            }
        }
        return false;
    }

    /**
     * Validate slot time configuration.
     */
    private void validateSlotTime(BulkPreviewRequestDTO.SlotTimeDTO slot) {
        if (slot == null) {
            throw new IllegalArgumentException("Slot time is required");
        }
        if (slot.getStartTime() == null || slot.getEndTime() == null) {
            throw new IllegalArgumentException("Slot startTime and endTime are required");
        }
        if (!slot.getEndTime().isAfter(slot.getStartTime())) {
            throw new IllegalArgumentException("Slot endTime must be after startTime");
        }
        Double hours = slot.getHoursPerSession();
        if (hours == null || hours <= 0) {
            throw new IllegalArgumentException("hoursPerSession must be positive");
        }
        long slotMinutes = Duration.between(slot.getStartTime(), slot.getEndTime()).toMinutes();
        double maxHours = slotMinutes / 60.0;
        if (hours > maxHours) {
            throw new IllegalArgumentException(
                    String.format("hoursPerSession (%.2f) exceeds slot duration (%.2f hours)", hours, maxHours));
        }
    }

    private boolean isValidTeachingDay(
            LocalDate date,
            Set<DayOfWeek> allowedDays,
            Boolean skipHolidays,
            Set<LocalDate> customHolidays
    ) {
        // Kiểm tra thứ trong tuần
        if (!allowedDays.contains(date.getDayOfWeek())) {
            return false;
        }

        // Kiểm tra ngày nghỉ lễ nếu được cấu hình bỏ qua
        if (Boolean.TRUE.equals(skipHolidays)) {
            if (isNationalHoliday(date)) {
                return false;
            }
            if (customHolidays != null && customHolidays.contains(date)) {
                return false;
            }
        }

        return true;
    }

    private boolean isNationalHoliday(LocalDate date) {
        String mmDd = String.format("%02d-%02d", date.getMonthValue(), date.getDayOfMonth());
        return DEFAULT_NATIONAL_HOLIDAYS.contains(mmDd);
    }

    private boolean overlaps(LocalDateTime start1, LocalDateTime end1, LocalDateTime start2, LocalDateTime end2) {
        return start1.isBefore(end2) && end1.isAfter(start2);
    }

    private boolean sameNonBlankRoom(String firstRoom, String secondRoom) {
        return firstRoom != null
                && secondRoom != null
                && !firstRoom.isBlank()
                && !secondRoom.isBlank()
                && firstRoom.trim().equalsIgnoreCase(secondRoom.trim());
    }
}