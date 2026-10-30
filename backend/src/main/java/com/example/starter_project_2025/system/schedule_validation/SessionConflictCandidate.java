package com.example.starter_project_2025.system.schedule_validation;

import com.example.starter_project_2025.system.demo.session.Session;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;

@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SessionConflictCandidate {

    private Long sessionId;

    @NotNull(message = "Class ID is required")
    private Long classId;

    @NotNull(message = "Trainer ID is required")
    private Long trainerId;

    private String location;

    @NotNull(message = "Start time is required")
    private LocalDateTime startTime;

    @NotNull(message = "End time is required")
    private LocalDateTime endTime;

    public static SessionConflictCandidate from(Session session) {
        return SessionConflictCandidate.builder()
                .sessionId(session.getId())
                .classId(session.getClassId())
                .trainerId(session.getTrainerId())
                .location(session.getLocation())
                .startTime(session.getStartTime())
                .endTime(session.getEndTime())
                .build();
    }
}
