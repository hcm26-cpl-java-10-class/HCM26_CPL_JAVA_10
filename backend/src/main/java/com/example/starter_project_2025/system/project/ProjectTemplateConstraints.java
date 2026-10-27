package com.example.starter_project_2025.system.project;

import com.example.starter_project_2025.exception.BadRequestException;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

/**
 * US-10: single source of truth for the {@code constraints_json} capacity
 * window of a {@link ProjectTemplate}.
 * <p>
 * The JSON shape is:
 * <pre>
 * { "min_members": 4, "max_members": 6 }
 * </pre>
 * {@code min_members} is optional and defaults to {@link #DEFAULT_MIN_MEMBERS};
 * {@code max_members} is required unless a fallback is supplied by the caller
 * (the manual allocation session uses the session capacity as fallback so the
 * historical behaviour of {@code TeamAllocationSessionService} is preserved).
 */
public final class ProjectTemplateConstraints {

    public static final int DEFAULT_MIN_MEMBERS = 1;

    private ProjectTemplateConstraints() {
    }

    public record Capacity(int minMembers, int maxMembers) {

        public boolean accepts(long memberCount) {
            return memberCount >= minMembers && memberCount <= maxMembers;
        }

        public String window() {
            return minMembers + "-" + maxMembers;
        }
    }

    /**
     * @param fallbackMax value used when the template does not declare
     *                    {@code max_members}; may be {@code null} when the
     *                    template must declare it.
     */
    public static Capacity parse(
            ObjectMapper objectMapper,
            ProjectTemplate template,
            Integer fallbackMax
    ) {
        if (template == null) {
            throw new BadRequestException("Project template is required");
        }

        JsonNode constraints;
        try {
            constraints = objectMapper.readTree(template.getConstraintsJson());
        } catch (JsonProcessingException exception) {
            throw new BadRequestException("Project template constraints contain invalid JSON");
        }
        if (constraints == null || constraints.isNull()) {
            constraints = objectMapper.createObjectNode();
        }

        Integer declaredMin = readNullableInt(constraints.get("min_members"), "min_members");
        int minMembers = declaredMin == null ? DEFAULT_MIN_MEMBERS : declaredMin;
        if (minMembers < DEFAULT_MIN_MEMBERS) {
            throw new BadRequestException(
                    "Project template min_members must be greater than zero");
        }

        Integer declaredMax = readNullableInt(constraints.get("max_members"), "max_members");
        Integer maxMembers = declaredMax != null ? declaredMax : fallbackMax;

        if (maxMembers == null) {
            throw new BadRequestException(
                    "Project template constraints must contain integer max_members");
        }
        if (maxMembers <= 0) {
            throw new BadRequestException(
                    "Project template max_members must be greater than zero");
        }
        if (maxMembers < minMembers) {
            throw new BadRequestException(
                    "Project template max_members must be greater than or equal to min_members");
        }

        return new Capacity(minMembers, maxMembers);
    }

    private static Integer readNullableInt(JsonNode node, String field) {
        if (node == null || node.isNull() || node.isMissingNode()) {
            return null;
        }
        if (!node.canConvertToInt()) {
            throw new BadRequestException(
                    "Project template constraints must contain integer " + field);
        }
        return node.asInt();
    }
}
