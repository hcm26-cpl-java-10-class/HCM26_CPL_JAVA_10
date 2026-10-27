package com.example.starter_project_2025.system.schedule.generation.engine;

import com.example.starter_project_2025.system.schedule.generation.dto.BulkPreviewRequestDTO;
import com.example.starter_project_2025.system.schedule.generation.dto.PreviewSessionItemDTO;
import com.example.starter_project_2025.system.schedule.generation.dto.ScheduleGenerationContextResponse;
import org.springframework.stereotype.Component;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.*;

/**
 * Thuật toán phân bổ lịch học tự động từ cấu trúc môn học của chương trình đào tạo.
 * 1. Duyệt tuần tự các môn (ProgramSubject) theo thứ tự sequenceOrder.
 * 2. Phân bổ theo các ngày trong tuần được chọn (daysOfWeek) và khung ca học (slotTime).
 * 3. Tự động bỏ qua các ngày nghỉ lễ nếu skipHolidays = true.
 * 4. Xử lý chia giờ lẻ chính xác cho buổi cuối của mỗi môn.
 * 5. Tính toán hoàn toàn trên RAM, chưa ghi vào cơ sở dữ liệu.
 */
@Component
public class ScheduleGeneratorEngine {

    // Danh sách ngày lễ mặc định toàn quốc (Định dạng MM-dd)
    private static final Set<String> DEFAULT_NATIONAL_HOLIDAYS = Set.of(
            "01-01", // Tết Dương Lịch
            "04-30", // Ngày Giải phóng Miền Nam
            "05-01", // Ngày Quốc tế Lao động
            "09-02"  // Ngày Quốc Khánh
    );

    public List<PreviewSessionItemDTO> generate(
            List<ScheduleGenerationContextResponse.TopicContextItem> topics,
            BulkPreviewRequestDTO request,
            Set<LocalDate> customHolidays
    ) {
        if (topics == null || topics.isEmpty()) {
            return Collections.emptyList();
        }

        List<PreviewSessionItemDTO> result = new ArrayList<>();
        LocalDate currentDate = request.getStartDate();
        Set<DayOfWeek> daysOfWeek = request.getDaysOfWeek();
        BulkPreviewRequestDTO.SlotTimeDTO slot = request.getSlotTime();
        double hoursPerSession = (slot != null && slot.getHoursPerSession() != null && slot.getHoursPerSession() > 0)
                ? slot.getHoursPerSession()
                : 4.0;

        LocalTime slotStartTime = (slot != null && slot.getStartTime() != null)
                ? slot.getStartTime()
                : LocalTime.of(8, 0);

        // Map topic override nếu người dùng có tùy chỉnh trước
        Map<String, BulkPreviewRequestDTO.TopicOverrideDTO> overrideMap = new HashMap<>();
        if (request.getTopicOverrides() != null) {
            for (BulkPreviewRequestDTO.TopicOverrideDTO o : request.getTopicOverrides()) {
                if (o.getProgramSubjectId()!=null) overrideMap.put("PROGRAM_SUBJECT:"+o.getProgramSubjectId(),o);
                else if (o.getTopicId()!=null) overrideMap.put("TOPIC:"+o.getTopicId(),o);
            }
        }

        // Sắp xếp danh mục môn theo thứ tự sequenceOrder tăng dần
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

            Long trainerId = topic.getAssignedTrainerId();
            String trainerName = topic.getAssignedTrainerName();
            Long roomId = request.getDefaultRoomId();
            String roomName = request.getDefaultRoomName();
            Long teachingAssignmentId = topic.getTeachingAssignmentId();

            String overrideKey=topic.getProgramSubjectId()!=null?"PROGRAM_SUBJECT:"+topic.getProgramSubjectId():"TOPIC:"+topic.getTopicId();
            if (overrideMap.containsKey(overrideKey)) {
                BulkPreviewRequestDTO.TopicOverrideDTO o = overrideMap.get(overrideKey);
                if (o.getTrainerId() != null) {
                    trainerId = o.getTrainerId();
                }
                if (o.getTrainerName() != null) {
                    trainerName = o.getTrainerName();
                }
                if (o.getRoomId() != null) {
                    roomId = o.getRoomId();
                }
                if (o.getRoomName() != null) {
                    roomName = o.getRoomName();
                }
            }

            while (remainingHours > 0) {
                if(result.size()>=200) throw new IllegalArgumentException("A preview cannot contain more than 200 sessions.");
                // Tìm ngày học hợp lệ kế tiếp: thuộc daysOfWeek và không phải ngày nghỉ
                while (!isValidTeachingDay(currentDate, daysOfWeek, request.getSkipHolidays(), customHolidays)) {
                    currentDate = currentDate.plusDays(1);
                }

                // Giờ buổi học thực tế: không vượt quá số giờ còn lại của môn
                double actualHours = Math.min(hoursPerSession, remainingHours);

                long minutesToAdd = Math.round(actualHours * 60);
                if(minutesToAdd<1) throw new IllegalArgumentException("Each session must last at least one minute.");
                LocalTime sessionEndTime = slotStartTime.plusMinutes(minutesToAdd);

                LocalDateTime sessionStart = LocalDateTime.of(currentDate, slotStartTime);
                LocalDateTime sessionEnd = LocalDateTime.of(currentDate, sessionEndTime);

                String tempId = String.format("tmp-%03d", globalSessionCounter);
                String title = topic.getTopicName() + " - Buổi " + sessionIndexForTopic;

                PreviewSessionItemDTO sessionItem = PreviewSessionItemDTO.builder()
                        .tempId(tempId)
                        .topicId(topic.getTopicId())
                        .programSubjectId(topic.getProgramSubjectId())
                        .subjectId(topic.getSubjectId())
                        .topicName(topic.getTopicName())
                        .sessionNumber(sessionIndexForTopic)
                        .date(currentDate)
                        .startTime(sessionStart)
                        .endTime(sessionEnd)
                        .trainerId(trainerId)
                        .trainerName(trainerName)
                        .roomId(roomId)
                        .roomName(roomName)
                        .meetingUrl(request.getMeetingUrl())
                        .teachingAssignmentId(teachingAssignmentId)
                        .title(title)
                        .status("VALID")
                        .build();

                result.add(sessionItem);

                remainingHours -= actualHours;
                sessionIndexForTopic++;
                globalSessionCounter++;

                // Chuyển sang ngày tiếp theo để xét buổi kế tiếp
                currentDate = currentDate.plusDays(1);
            }
        }

        return result;
    }

    private boolean isValidTeachingDay(
            LocalDate date,
            Set<DayOfWeek> allowedDays,
            Boolean skipHolidays,
            Set<LocalDate> customHolidays
    ) {
        if (allowedDays == null || !allowedDays.contains(date.getDayOfWeek())) {
            return false;
        }

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
}
