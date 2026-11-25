package com.example.starter_project_2025.system.audit;

import com.example.starter_project_2025.init.annotation.ResourcePermission;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Small helpers used when writing audit events by hand.
 */
public final class AuditSupport {

    private static final ObjectMapper MAPPER = new ObjectMapper();

    private AuditSupport() {
    }

    /**
     * Builds a JSON object string from alternating key/value arguments,
     * e.g. json("examId", 1, "userId", 2) gives {"examId":1,"userId":2}.
     */
    public static String json(Object... keyValues) {
        Map<String, Object> map = new LinkedHashMap<>();

        for (int i = 0; i + 1 < keyValues.length; i += 2) {
            map.put(String.valueOf(keyValues[i]), keyValues[i + 1]);
        }

        try {
            return MAPPER.writeValueAsString(map);
        } catch (JsonProcessingException e) {
            return null;
        }
    }

    /**
     * Entity type name used in the audit log for an entity class
     * (the @ResourcePermission value, otherwise the upper-cased class name).
     */
    public static String resourceOf(Class<?> entityClass) {
        ResourcePermission annotation = entityClass.getAnnotation(ResourcePermission.class);

        return annotation != null
                ? annotation.value()
                : entityClass.getSimpleName().toUpperCase();
    }
}
