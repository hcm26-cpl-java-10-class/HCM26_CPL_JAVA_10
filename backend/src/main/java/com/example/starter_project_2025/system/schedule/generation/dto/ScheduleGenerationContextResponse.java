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
    Double totalHours;
    String defaultRoomId;
    String defaultRoomName;
    List<TopicContextItem> topics;
    List<String> holidays;
    List<TrainerOptionDTO> availableTrainers;
    List<RoomOptionDTO> availableRooms;

    @Getter
    @Setter
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @FieldDefaults(level = AccessLevel.PRIVATE)
    public static class TopicContextItem {
        Long topicId;
        String topicCode;
        String topicName;
        Integer sequenceOrder;
        Double totalHours;
        Long assignedTrainerId;
        String assignedTrainerName;
    }

    @Getter
    @Setter
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @FieldDefaults(level = AccessLevel.PRIVATE)
    public static class TrainerOptionDTO {
        Long id;
        String name;
        String email;
    }

    @Getter
    @Setter
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @FieldDefaults(level = AccessLevel.PRIVATE)
    public static class RoomOptionDTO {
        String roomId;
        String roomName;
        Integer capacity;
    }
}
