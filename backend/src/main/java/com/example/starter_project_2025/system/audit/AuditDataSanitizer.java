
package com.example.starter_project_2025.system.audit;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.springframework.stereotype.Component;

import java.util.Iterator;
import java.util.Map;
import java.util.Set;

@Component
public class AuditDataSanitizer {

    private static final Set<String> SENSITIVE_FIELDS = Set.of(
            "password",
            "passwordhash",
            "accesstoken",
            "refreshtoken",
            "token",
            "secret",
            "apikey",
            "authorization"
    );

    private final ObjectMapper objectMapper;

    public AuditDataSanitizer(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    public String sanitize(String json) {
        if (json == null || json.isBlank()) {
            return json;
        }

        try {
            JsonNode root = objectMapper.readTree(json);
            maskSensitiveFields(root);
            return objectMapper.writeValueAsString(root);
        } catch (Exception e) {
            // Không lưu dữ liệu không xác định được định dạng.
            return "[REDACTED]";
        }
    }

    private void maskSensitiveFields(JsonNode node) {
        if (node.isObject()) {
            ObjectNode object = (ObjectNode) node;

            Iterator<Map.Entry<String, JsonNode>> fields =
                    object.fields();

            while (fields.hasNext()) {
                Map.Entry<String, JsonNode> field = fields.next();

                String normalizedName = field.getKey()
                        .replace("_", "")
                        .replace("-", "")
                        .toLowerCase(java.util.Locale.ROOT);

                if (SENSITIVE_FIELDS.contains(normalizedName)) {
                    object.put(field.getKey(), "[REDACTED]");
                } else {
                    maskSensitiveFields(field.getValue());
                }
            }
        } else if (node.isArray()) {
            for (JsonNode child : node) {
                maskSensitiveFields(child);
            }
        }
    }
}
