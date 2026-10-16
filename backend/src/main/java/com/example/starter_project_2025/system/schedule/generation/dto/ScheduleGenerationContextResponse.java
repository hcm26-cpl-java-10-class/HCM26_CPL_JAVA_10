package com.example.starter_project_2025.system.schedule.generation.dto;

import lombok.*;
import lombok.experimental.FieldDefaults;

import java.util.List;

@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class ScheduleGenerationContextResponse {
    Long classId;
    String classCode;
    Long programId;
    String programName;
    String defaultRoomId;
    String defaultRoomName;
    List<TopicContextItem> topics;

    @Getter
    @Setter
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @FieldDefaults(level = AccessLevel.PRIVATE)
    public static class TopicContextItem {
        Long topicId;
        String topicName;
        Integer sequenceOrder;
        Double totalHours;
        Long assignedTrainerId;
        String assignedTrainerName;
    }
}
