package com.example.starter_project_2025.system.schedule.session_audit.dto;

import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.experimental.FieldDefaults;

import java.time.LocalDateTime;

/**
 * T2 — Một dòng audit log trả về cho màn hình/API tra cứu (UFR-SYS-014).
 */
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class AuditLogResponse {

    Long id;

    Long actorId;

    String action;

    String entityType;

    Long entityId;

    String beforeState;

    String afterState;

    String reason;

    String correlationId;

    LocalDateTime createdAt;
}
