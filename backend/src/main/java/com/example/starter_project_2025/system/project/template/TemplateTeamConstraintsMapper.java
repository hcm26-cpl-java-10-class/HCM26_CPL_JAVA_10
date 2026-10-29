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
                || List.of("pm", "ba", "dev", "qa").stream().anyMatch(role -> !roles.hasNonNull(role))) {
            return null;
        }
        if (!root.get("allow_multi_role").isBoolean()) {
            throw new IllegalStateException("Invalid stored multi-role setting");
        }
        return new TemplateTeamConstraints(integer(root.get("min_members")), integer(root.get("max_members")),
                new TemplateTeamConstraints.RoleQuotas(integer(roles.get("pm")), integer(roles.get("ba")),
                        integer(roles.get("dev")), integer(roles.get("qa"))),
                root.get("allow_multi_role").booleanValue());
    }

    public String write(String existingJson, TemplateTeamConstraintsRequest request) {
        ObjectNode root = parse(existingJson);
        root.put("min_members", request.minMembers().intValueExact());
        root.put("max_members", request.maxMembers().intValueExact());
        root.put("allow_multi_role", request.allowMultiRole());
        // Replace, don't merge: seeded JSON uses uppercase role keys while this
        // mapper uses lowercase, and merging produced duplicate PM/BA/DEV/QA
        // entries that made the template disappear from the assignable list.
        ObjectNode roles = objectMapper.createObjectNode();
        roles.put("pm", request.roleQuotas().pm().intValueExact());
        roles.put("ba", request.roleQuotas().ba().intValueExact());
        roles.put("dev", request.roleQuotas().dev().intValueExact());
        roles.put("qa", request.roleQuotas().qa().intValueExact());
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
}
