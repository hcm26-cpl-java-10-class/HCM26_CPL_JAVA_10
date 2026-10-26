package com.example.starter_project_2025.system.project.workspace.service;

import com.example.starter_project_2025.system.project.workspace.domain.WorkspaceCreationRequest;
import com.example.starter_project_2025.system.project.workspace.dto.WorkspaceCreateRequest;
import com.example.starter_project_2025.system.project.workspace.dto.WorkspaceResponse;
import com.example.starter_project_2025.system.project.workspace.repository.WorkspaceCreationRequestRepository;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.apache.commons.codec.digest.DigestUtils;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class WorkspaceIdempotencyService {
    private final WorkspaceCreationRequestRepository requests;
    private final ObjectMapper mapper;

    public WorkspaceCreationRequest find(Long tenantId, Long actorId, String key) {
        return requests.findByTenantIdAndActorIdAndIdempotencyKey(tenantId, actorId, key).orElse(null);
    }

    private String hash(WorkspaceCreateRequest request) {
        return DigestUtils.sha256Hex(request.getProjectId() + ":" + request.getTeamId());
    }

    public void checkPayload(WorkspaceCreationRequest saved, WorkspaceCreateRequest request) {
        if (!saved.getPayloadHash().equals(hash(request))) {
            throw new WorkspaceConflictException("Idempotency key đã được dùng với dữ liệu khác", null);
        }
    }

    public WorkspaceResponse response(WorkspaceCreationRequest saved) {
        try { return mapper.readValue(saved.getResponseJson(), WorkspaceResponse.class); }
        catch (JsonProcessingException exception) { throw new IllegalStateException("Cannot read persisted workspace result", exception); }
    }

    public void save(Long tenantId, Long actorId, String key, WorkspaceCreateRequest payload, WorkspaceResponse response) {
        WorkspaceCreationRequest request = new WorkspaceCreationRequest();
        request.setTenantId(tenantId); request.setActorId(actorId); request.setIdempotencyKey(key);
        request.setPayloadHash(hash(payload)); request.setWorkspaceId(response.getId());
        try { request.setResponseJson(mapper.writeValueAsString(response)); }
        catch (JsonProcessingException exception) { throw new IllegalStateException("Cannot persist workspace result", exception); }
        requests.saveAndFlush(request);
    }
}
