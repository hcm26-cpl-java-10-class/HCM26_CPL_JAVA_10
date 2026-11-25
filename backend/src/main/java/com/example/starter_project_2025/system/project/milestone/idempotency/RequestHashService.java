package com.example.starter_project_2025.system.project.milestone.idempotency;

import com.example.starter_project_2025.system.project.milestone.dto.request.CreateMilestoneRequest;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;
import java.util.UUID;

@Component
@RequiredArgsConstructor
public class RequestHashService {

    private final ObjectMapper objectMapper;

    public String hash(Long projectId, Long tenantId, UUID actorId, CreateMilestoneRequest request) {
        try {
            String canonical = "CREATE_MILESTONE|" + projectId + "|" + tenantId + "|" + actorId
                    + "|" + objectMapper.writeValueAsString(request);
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            return HexFormat.of().formatHex(digest.digest(canonical.getBytes(StandardCharsets.UTF_8)));
        } catch (JsonProcessingException | NoSuchAlgorithmException ex) {
            throw new IllegalStateException("Unable to hash milestone request", ex);
        }
    }
}
