package com.example.starter_project_2025.system.git_integration.webhook;

import com.fasterxml.jackson.databind.JsonNode;

/** Null-safe reads of webhook payload fields. */
public final class GitWebhookJson {

    private GitWebhookJson() {
    }

    public static JsonNode at(JsonNode root, String... path) {
        JsonNode node = root;
        for (String key : path) {
            if (node == null || !node.isObject()) return null;
            node = node.get(key);
        }
        return node == null || node.isNull() || node.isMissingNode() ? null : node;
    }

    public static String text(JsonNode root, String... path) {
        JsonNode node = at(root, path);
        return node != null && node.isValueNode() ? node.asText() : null;
    }

    public static Long number(JsonNode root, String... path) {
        JsonNode node = at(root, path);
        return node != null && node.canConvertToLong() ? node.asLong() : null;
    }

    /** Truncates to the column size. */
    public static String limit(String value, int max) {
        return value == null || value.length() <= max ? value : value.substring(0, max);
    }
}
