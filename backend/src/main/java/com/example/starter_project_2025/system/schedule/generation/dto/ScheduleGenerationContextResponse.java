package com.example.starter_project_2025.system.schedule.generation.dto;

import lombok.*;
import lombok.experimental.FieldDefaults;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class ScheduleGenerationContextResponse {

    Long classId;

    String classCode;

    String className;

    Long programId;

    String programName;

    String programVersion;

    Double totalHours;

    List<TopicContextItem> topics;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @FieldDefaults(level = AccessLevel.PRIVATE)
    public static class TopicContextItem {
        Long topicId;
        Long programSubjectId;
        Long subjectId;
        String topicName;
        String topicCode;
        Integer sequenceOrder;
        Double totalHours;
        Long assignedTrainerId;
        String assignedTrainerName;
        Long teachingAssignmentId;
        String defaultRoom;
    }
}