package com.example.starter_project_2025.system.schedule.session_audit.dto;

import com.example.starter_project_2025.system.schedule.session_audit.SessionAuditAction;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.experimental.FieldDefaults;
import org.springframework.format.annotation.DateTimeFormat;

import java.time.LocalDateTime;

/**
 * T2 / UFR-SYS-014 AC1–AC2 — Điều kiện tra cứu/export audit log.
 */
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class AuditLogQuery {

    String entityType;

    Long entityId;

    Long actorId;

    SessionAuditAction action;

    String correlationId;

    @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME)
    LocalDateTime from;

    @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME)
    LocalDateTime to;

    Integer page;

    Integer size;
}
