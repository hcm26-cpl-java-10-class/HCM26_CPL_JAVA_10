package com.example.starter_project_2025.system.project.template;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class TemplateTeamConstraintsMapper {
    private final ObjectMapper objectMapper;

    public TemplateTeamConstraints read(String json) {
        ObjectNode root = parse(json);
        JsonNode roles = root.path("role_quotas");
        if (!root.hasNonNull("min_members") || !root.hasNonNull("max_members")
                || !root.hasNonNull("allow_multi_role") || !roles.isObject()
                || List.of("pm", "ba", "dev", "qa").stream().anyMatch(role -> minimum(roles, role).isMissingNode())) {
            return null;
        }
        if (!root.get("allow_multi_role").isBoolean()) {
            throw new IllegalStateException("Invalid stored multi-role setting");
        }
        return new TemplateTeamConstraints(integer(root.get("min_members")), integer(root.get("max_members")),
                new TemplateTeamConstraints.RoleQuotas(integer(minimum(roles, "pm")), integer(minimum(roles, "ba")),
                        integer(minimum(roles, "dev")), integer(minimum(roles, "qa"))),
                root.get("allow_multi_role").booleanValue());
    }

    public String write(String existingJson, TemplateTeamConstraintsRequest request) {
        ObjectNode root = parse(existingJson);
        root.put("min_members", request.minMembers().intValueExact());
        root.put("max_members", request.maxMembers().intValueExact());
        root.put("allow_multi_role", request.allowMultiRole());
        JsonNode existing = root.path("role_quotas");
        ObjectNode roles = objectMapper.createObjectNode();
        quota(roles, existing, "PM", request.roleQuotas().pm().intValueExact());
        quota(roles, existing, "BA", request.roleQuotas().ba().intValueExact());
        quota(roles, existing, "DEV", request.roleQuotas().dev().intValueExact());
        quota(roles, existing, "QA", request.roleQuotas().qa().intValueExact());
        root.set("role_quotas", roles);
        try {
            return objectMapper.writeValueAsString(root);
        } catch (JsonProcessingException exception) {
            throw new IllegalStateException("Unable to save template team constraints", exception);
        }
    }

    private ObjectNode parse(String json) {
        try {
            JsonNode root = objectMapper.readTree(json);
            if (root instanceof ObjectNode object) return object;
            throw new IllegalStateException("Template constraints must be a JSON object");
        } catch (JsonProcessingException exception) {
            throw new IllegalStateException("Unable to read template constraints", exception);
        }
    }

    private int integer(JsonNode node) {
        if (!node.isIntegralNumber() || !node.canConvertToInt()) {
            throw new IllegalStateException("Invalid stored team size or role quota");
        }
        return node.intValue();
    }

    private JsonNode minimum(JsonNode roles, String role) {
        JsonNode value = roles.hasNonNull(role) ? roles.path(role) : roles.path(role.toUpperCase(java.util.Locale.ROOT));
        return value.isObject() ? value.path("min") : value;
    }

    private void quota(ObjectNode roles, JsonNode existing, String role, int minimum) {
        JsonNode old = existing.has(role) ? existing.path(role) : existing.path(role.toLowerCase(java.util.Locale.ROOT));
        if (old instanceof ObjectNode object) {
            ObjectNode value = object.deepCopy();
            value.put("min", minimum);
            if (value.hasNonNull("max") && value.path("max").asInt() < minimum) value.put("max", minimum);
            roles.set(role, value);
        } else {
            roles.put(role, minimum);
        }
    }
}
