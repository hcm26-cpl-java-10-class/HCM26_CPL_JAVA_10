package com.example.starter_project_2025.system.training;

import com.example.starter_project_2025.system.external_api.ExternalApiService;
import com.example.starter_project_2025.system.external_api.exception.ExternalApiException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import java.util.*;

/** Adapter to the existing GET /api/trainees contract. Never creates or caches personal profiles. */
@Component
@RequiredArgsConstructor
public class MasterTraineeDirectory {
    private final ExternalApiService source;
    private final ObjectMapper mapper;
    public record Profile(Long id, String studentId, String fullName, String personalEmail,
                          String nationalId, String dob, String gender, String status) {
        @Override public String toString() { return "MasterTrainee[profile values omitted]"; }
    }

    public List<Profile> load() {
        if (source.isSampleData()) throw unavailable("A real master trainee directory is required; local sample mode cannot verify students.");
        JsonNode data = mapper.valueToTree(source.fetchAllTrainees());
        // The existing master pool contract is an array, not an incomplete page of students.
        if (data == null || !data.isArray()) throw unavailable("The master trainee directory returned an unsupported response.");
        List<Profile> result = new ArrayList<>();
        Set<Long> ids = new HashSet<>();
        for (var node : data) {
            if (!node.isObject() || !node.path("id").isIntegralNumber() || !node.path("id").canConvertToLong() || node.path("id").asLong() <= 0
                    || !ids.add(node.path("id").asLong())) throw unavailable("The master trainee directory has invalid or ambiguous identities.");
            result.add(new Profile(node.path("id").asLong(), first(node, "fptAccount", "code").toUpperCase(Locale.ROOT),
                text(node, "fullName"), first(node, "personalEmail", "email"), text(node, "nationalId"),
                text(node, "dob"), text(node, "gender"), text(node, "status")));
        }
        return result;
    }
    private String text(JsonNode node, String field) { return node.path(field).isTextual() ? node.path(field).asText().trim() : ""; }
    private String first(JsonNode node, String a, String b) { String value = text(node, a); return value.isBlank() ? text(node, b) : value; }
    private ExternalApiException unavailable(String message) { return new ExternalApiException(message, 503, null); }
}
