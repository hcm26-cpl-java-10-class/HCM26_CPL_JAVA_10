package com.example.starter_project_2025.system.trainingprogram;

import com.example.starter_project_2025.system.schedule.ScheduleEntryKey;
import java.time.LocalDateTime;

/** topicId is deliberately absent: subject and curriculum-row identity remain distinct. */
public record AssignmentScheduleProposal(
        ScheduleEntryKey replacedKey,
        @jakarta.validation.constraints.NotNull @jakarta.validation.constraints.Positive Long teachingAssignmentId,
        Long classId, Long subjectId, Long programSubjectId, Long trainerId,
        @jakarta.validation.constraints.NotBlank @jakarta.validation.constraints.Size(max=150) String title,
        @jakarta.validation.constraints.NotNull LocalDateTime startTime,
        @jakarta.validation.constraints.NotNull LocalDateTime endTime,
        @jakarta.validation.constraints.Positive Long roomId,
        @jakarta.validation.constraints.Size(max=2048) String meetingUrl) {}
