package com.example.starter_project_2025.system.notification.template;

import org.springframework.web.util.HtmlUtils;

import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Pure-Java HTML sanitizer and variable interpolator for email templates (UFR-COM-006).
 * Escapes interpolated variables to prevent injection and strips dangerous HTML tags,
 * inline event handlers, and scriptable URI schemes.
 */
public final class EmailHtmlSanitizer {

    private static final Pattern BLOCK_DANGEROUS_TAGS = Pattern.compile(
            "(?is)<\\s*(script|iframe|object|embed|style|form|applet)\\b[^>]*>.*?<\\s*/\\s*\\1\\s*>"
    );
    private static final Pattern SINGLE_DANGEROUS_TAGS = Pattern.compile(
            "(?is)<\\s*/?\\s*(script|iframe|object|embed|style|form|applet|meta|link|base|input|button|textarea|select)\\b[^>]*>"
    );
    private static final Pattern EVENT_HANDLER_ATTR = Pattern.compile(
            "(?is)\\s+on[a-z0-9_-]+\\s*=\\s*(?:\"[^\"]*\"|'[^']*'|[^\\s>]+)"
    );
    private static final Pattern DANGEROUS_URI = Pattern.compile(
            "(?is)(href|src|action)\\s*=\\s*([\"']?)\\s*(?:javascript|vbscript|data\\s*:\\s*text/html)\\s*:[^\"'\\s>]*\\2"
    );
    private static final Pattern PLACEHOLDER_PATTERN = Pattern.compile("\\{\\{\\s*([a-zA-Z0-9_.-]+)\\s*}}");

    private EmailHtmlSanitizer() {
    }

    public static String sanitizeHtml(String rawHtml) {
        if (rawHtml == null || rawHtml.isBlank()) {
            return "";
        }
        String cleaned = BLOCK_DANGEROUS_TAGS.matcher(rawHtml).replaceAll("");
        cleaned = SINGLE_DANGEROUS_TAGS.matcher(cleaned).replaceAll("");
        cleaned = EVENT_HANDLER_ATTR.matcher(cleaned).replaceAll("");
        cleaned = DANGEROUS_URI.matcher(cleaned).replaceAll("$1=\"#\"");
        return cleaned.trim();
    }

    public static String interpolatePlain(String template, Map<String, Object> variables) {
        if (template == null) {
            return "";
        }
        if (variables == null || variables.isEmpty()) {
            return template;
        }
        Matcher matcher = PLACEHOLDER_PATTERN.matcher(template);
        StringBuilder out = new StringBuilder();
        while (matcher.find()) {
            String key = matcher.group(1);
            Object value = variables.get(key);
            String replacement = value == null ? "" : String.valueOf(value);
            matcher.appendReplacement(out, Matcher.quoteReplacement(replacement));
        }
        matcher.appendTail(out);
        return out.toString();
    }

    public static String interpolateAndSanitizeHtml(String templateHtml, Map<String, Object> variables) {
        if (templateHtml == null) {
            return "";
        }
        String sanitizedTemplate = sanitizeHtml(templateHtml);
        if (variables == null || variables.isEmpty()) {
            return sanitizedTemplate;
        }
        Matcher matcher = PLACEHOLDER_PATTERN.matcher(sanitizedTemplate);
        StringBuilder out = new StringBuilder();
        while (matcher.find()) {
            String key = matcher.group(1);
            Object value = variables.get(key);
            String escaped = value == null ? "" : HtmlUtils.htmlEscape(String.valueOf(value));
            matcher.appendReplacement(out, Matcher.quoteReplacement(escaped));
        }
        matcher.appendTail(out);
        return DANGEROUS_URI.matcher(out.toString()).replaceAll("$1=\"#\"").trim();
    }
}
