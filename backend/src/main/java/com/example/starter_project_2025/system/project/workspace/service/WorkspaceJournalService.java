package com.example.starter_project_2025.system.project.workspace.service;

import com.example.starter_project_2025.system.project.workspace.domain.Workspace;
import com.example.starter_project_2025.system.project.workspace.domain.WorkspaceActivity;
import com.example.starter_project_2025.system.project.workspace.domain.WorkspaceAudit;
import com.example.starter_project_2025.system.project.workspace.domain.WorkspaceOutboxEvent;
import com.example.starter_project_2025.system.project.workspace.dto.WorkspaceResponse;
import com.example.starter_project_2025.system.project.workspace.repository.WorkspaceActivityRepository;
import com.example.starter_project_2025.system.project.workspace.repository.WorkspaceAuditRepository;
import com.example.starter_project_2025.system.project.workspace.repository.WorkspaceOutboxRepository;

import com.example.starter_project_2025.system.rbac.user.User;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import java.time.Instant;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class WorkspaceJournalService {
    private final WorkspaceAuditRepository audits;
    private final WorkspaceOutboxRepository outbox;
    private final WorkspaceActivityRepository activities;
    private final ObjectMapper mapper;

    @Transactional(propagation = Propagation.MANDATORY)
    public void recordCreation(Workspace workspace, User user, WorkspaceResponse response, String correlationId) {
        String eventId = UUID.randomUUID().toString();
        String snapshot;
        try { snapshot = mapper.writeValueAsString(response); }
        catch (JsonProcessingException exception) { throw new IllegalStateException("Cannot serialize workspace audit", exception); }
        WorkspaceAudit audit = new WorkspaceAudit();
        audit.setEventId(eventId); audit.setTenantId(workspace.getTenant().getId()); audit.setActorId(user.getId());
        audit.setWorkspaceId(workspace.getId());
        audit.setProjectId(workspace.getProject() == null ? null : workspace.getProject().getId());
        audit.setTeamId(workspace.getTeam().getId());
        audit.setAction("WORKSPACE_CREATED"); audit.setCorrelationId(correlationId); audit.setBeforeJson("null"); audit.setAfterJson(snapshot);
        audits.saveAndFlush(audit);
        WorkspaceOutboxEvent event = new WorkspaceOutboxEvent();
        event.setEventId(eventId); event.setTenantId(audit.getTenantId()); event.setActorId(user.getId()); event.setWorkspaceId(workspace.getId());
        event.setEventType("WORKSPACE_CREATED"); event.setCorrelationId(correlationId); event.setOccurredAt(Instant.now()); event.setPayload(snapshot);
        outbox.saveAndFlush(event);
        recordActivityOnce(event);
    }

    @Transactional(propagation = Propagation.MANDATORY)
    public void recordActivityOnce(WorkspaceOutboxEvent event) {
        if (activities.existsByEventId(event.getEventId())) return;
        WorkspaceActivity activity = new WorkspaceActivity();
        activity.setEventId(event.getEventId()); activity.setTenantId(event.getTenantId()); activity.setActorId(event.getActorId());
        activity.setWorkspaceId(event.getWorkspaceId()); activity.setAction(event.getEventType());
        activity.setCorrelationId(event.getCorrelationId()); activity.setOccurredAt(event.getOccurredAt());
        activities.saveAndFlush(activity);
    }
}
