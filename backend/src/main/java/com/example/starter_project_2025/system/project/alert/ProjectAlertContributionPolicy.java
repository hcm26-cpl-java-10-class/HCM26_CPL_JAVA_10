package com.example.starter_project_2025.system.project.alert;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import java.util.List;
import java.util.Objects;

/** Compare business changes across the different modules' audit contracts. */
@Component
@RequiredArgsConstructor
public class ProjectAlertContributionPolicy {
    private static final List<String> AUDIT_METADATA = List.of(
            "version", "createdAt", "updatedAt", "createdBy", "updatedBy");
    private final ObjectMapper json;

    public boolean changed(String before, String after) {
        if (Objects.equals(before, after)) return false;
        if (before == null || after == null) return true;
        try {
            var previous = json.readTree(before);
            var current = json.readTree(after);
            if (previous instanceof ObjectNode previousObject && current instanceof ObjectNode currentObject) {
                previousObject.remove(AUDIT_METADATA);
                currentObject.remove(AUDIT_METADATA);
                return !previousObject.equals(currentObject);
            }
            return !Objects.equals(previous, current);
        } catch (JsonProcessingException legacyPlainText) {
            // Earlier status history used plain TODO / DONE values.
            return true;
        }
    }
}
