package com.example.starter_project_2025.system.project;

import com.example.starter_project_2025.exception.BadRequestException;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;

/**
 * US-10/US-11: single source of truth for the {@code constraints_json} of a
 * {@link ProjectTemplate}.
 * <p>
 * The JSON shape is:
 * <pre>
 * {
 *   "min_members": 4,
 *   "max_members": 6,
 *   "allow_multi_role": false,
 *   "role_quotas": {
 *     "PM": { "min": 1, "max": 1 },
 *     "BA": { "min": 1, "max": 1 },
 *     "DEV": { "min": 2, "max": 4 },
 *     "QA": { "min": 1, "max": 1 }
 *   }
 * }
 * </pre>
 * {@code min_members} is optional and defaults to {@link #DEFAULT_MIN_MEMBERS};
 * {@code max_members} is required unless a fallback is supplied by the caller
 * (the manual allocation session uses the session capacity as fallback so the
 * historical behaviour of {@code TeamAllocationSessionService} is preserved).
 * <p>
 * US-11 adds {@code allow_multi_role} (default {@code false}) and
 * {@code role_quotas}. {@code role_quotas} accepts either an object keyed by
 * role code or an array of {@code {role,min,max}} entries. A plain integer
 * value is shorthand for a minimum quota with no upper bound.
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

    /** One required / allowed seat count for a team role. */
    public record RoleQuota(String role, int min, int max) {

        public boolean hasUpperBound() {
            return max != Integer.MAX_VALUE;
        }

        /** Human readable {@code 1-1} / {@code 1+} window. */
        public String window() {
            return hasUpperBound() ? min + "-" + max : min + "+";
        }
    }

    /** US-11 role configuration of a template. */
    public record RolePolicy(boolean allowMultiRole, List<RoleQuota> quotas) {

        /**
         * Policy used when a team has no template yet (or the template cannot
         * be parsed). It preserves the historical single-role behaviour so the
         * UI does not offer multi-select before a template is assigned.
         */
        public static RolePolicy singleRoleDefault() {
            return new RolePolicy(false, List.of());
        }

        public Optional<RoleQuota> quotaFor(String role) {
            return quotas.stream()
                    .filter(quota -> quota.role().equals(role))
                    .findFirst();
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

    /**
     * US-11: reads {@code allow_multi_role} and {@code role_quotas} from the
     * template constraints. A template without the keys keeps the historical
     * single-role behaviour (multi-role disabled) and no quota requirements.
     */
    public static RolePolicy parseRolePolicy(
            ObjectMapper objectMapper,
            ProjectTemplate template
    ) {
        if (template == null) {
            return RolePolicy.singleRoleDefault();
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

        boolean allowMultiRole = readBoolean(
                constraints.get("allow_multi_role"), "allow_multi_role", false);

        JsonNode quotasNode = constraints.get("role_quotas");
        if (quotasNode == null || quotasNode.isNull() || quotasNode.isMissingNode()) {
            quotasNode = constraints.get("roleQuotas");
        }

        List<RoleQuota> quotas = new ArrayList<>();
        if (quotasNode != null && !quotasNode.isNull() && !quotasNode.isMissingNode()) {
            if (quotasNode.isObject()) {
                quotasNode.fields().forEachRemaining(entry ->
                        quotas.add(readQuota(entry.getKey(), entry.getValue())));
            } else if (quotasNode.isArray()) {
                for (JsonNode item : quotasNode) {
                    if (!item.isObject() || !item.hasNonNull("role")) {
                        throw new BadRequestException(
                                "Project template role_quotas entries must contain a role");
                    }
                    quotas.add(readQuota(item.get("role").asText(), item));
                }
            } else {
                throw new BadRequestException(
                        "Project template role_quotas must be an object or an array");
            }
        }

        Set<String> seenRoles = new HashSet<>();
        for (RoleQuota quota : quotas) {
            if (!seenRoles.add(quota.role())) {
                throw new BadRequestException(
                        "Project template role_quotas contains duplicate role " + quota.role());
            }
        }
        return new RolePolicy(allowMultiRole, List.copyOf(quotas));
    }

    private static RoleQuota readQuota(String role, JsonNode node) {
        String normalizedRole = role == null ? null : role.trim().toUpperCase();
        if (!ProjectMemberRole.isValid(normalizedRole)) {
            throw new BadRequestException(
                    "Project template role_quotas contains unknown role " + role);
        }

        int min;
        int max;
        if (node != null && node.isNumber()) {
            min = node.asInt();
            max = Integer.MAX_VALUE;
        } else if (node != null && node.isObject()) {
            Integer declaredMin = readNullableInt(node.get("min"), "role_quotas.min");
            Integer declaredMax = readNullableInt(node.get("max"), "role_quotas.max");
            min = declaredMin == null ? 0 : declaredMin;
            max = declaredMax == null ? Integer.MAX_VALUE : declaredMax;
        } else {
            throw new BadRequestException(
                    "Project template role quota for " + normalizedRole
                            + " must be an integer or an object");
        }

        if (min < 0) {
            throw new BadRequestException(
                    "Project template role quota min for " + normalizedRole
                            + " must not be negative");
        }
        if (max < min) {
            throw new BadRequestException(
                    "Project template role quota max for " + normalizedRole
                            + " must be greater than or equal to min");
        }
        return new RoleQuota(normalizedRole, min, max);
    }

    private static boolean readBoolean(JsonNode node, String field, boolean fallback) {
        if (node == null || node.isNull() || node.isMissingNode()) {
            return fallback;
        }
        if (!node.isBoolean()) {
            throw new BadRequestException(
                    "Project template constraints must contain boolean " + field);
        }
        return node.asBoolean();
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
