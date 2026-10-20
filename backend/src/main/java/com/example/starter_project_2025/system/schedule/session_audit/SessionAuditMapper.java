package com.example.starter_project_2025.system.schedule.session_audit;

import com.example.starter_project_2025.base.crud.mapper.BaseMapperConfig;
import com.example.starter_project_2025.system.schedule.session_audit.dto.AuditLogResponse;
import com.example.starter_project_2025.system.schedule.session_audit.dto.SessionStatusHistoryResponse;
import com.example.starter_project_2025.system.schedule.session_audit.entity.SessionAuditLog;
import com.example.starter_project_2025.system.schedule.session_audit.entity.SessionStatusHistory;
import org.mapstruct.Mapper;

import java.util.List;

@Mapper(componentModel = "spring", config = BaseMapperConfig.class)
public interface SessionAuditMapper {

    SessionStatusHistoryResponse toHistoryResponse(SessionStatusHistory entity);

    List<SessionStatusHistoryResponse> toHistoryResponses(List<SessionStatusHistory> entities);

    AuditLogResponse toAuditLogResponse(SessionAuditLog entity);

    List<AuditLogResponse> toAuditLogResponses(List<SessionAuditLog> entities);
}
