package com.example.starter_project_2025.system.schedule.conflict_resolution.dto;

import com.example.starter_project_2025.system.schedule.conflict_resolution.ConflictResolutionAuditAction;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.experimental.FieldDefaults;

import java.time.LocalDateTime;

@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class ConflictResolutionAuditEventResponse {
    Long id;
    ConflictResolutionAuditAction action;
    Long actorId;
    LocalDateTime occurredAt;
    String comment;
}
