package com.example.starter_project_2025.system.project.sprint_backlog.key;

import java.util.Locale;
import java.util.Optional;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * The Task ID standard of backlog items: {@code PREFIX-NUMBER}, e.g. {@code FA-12}.
 * <ul>
 *     <li>PREFIX: the workspace task key prefix, 1 to 8 upper case letters or digits
 *     ({@code FA} by default)</li>
 *     <li>NUMBER: a positive number without leading zeros, allocated per
 *     (tenant, prefix) by {@link TaskKeySequenceAllocator}</li>
 * </ul>
 * Keys are stored upper case; lookups accept any case ({@code fa-12}).
 */
public final class TaskKeyFormat {

    public static final String DEFAULT_PREFIX = "FA";
    public static final int MAX_PREFIX_LENGTH = 8;
    public static final int MAX_KEY_LENGTH = 20;

    private static final Pattern PREFIX = Pattern.compile("[A-Z0-9]{1," + MAX_PREFIX_LENGTH + "}");
    private static final Pattern KEY = Pattern.compile("([A-Z0-9]{1," + MAX_PREFIX_LENGTH + "})-([1-9][0-9]{0,17})");

    private TaskKeyFormat() {
    }

    public record ParsedKey(String prefix, long number) {
        public String key() {
            return format(prefix, number);
        }
    }

    public static String format(String prefix, long number) {
        if (!isValidPrefix(prefix) || number < 1) {
            throw new IllegalArgumentException("Invalid task key parts: " + prefix + ", " + number);
        }
        return prefix + "-" + number;
    }

    public static boolean isValidPrefix(String prefix) {
        return prefix != null && PREFIX.matcher(prefix).matches();
    }

    /** Upper-cased, trimmed prefix when valid; the default prefix otherwise. */
    public static String prefixOrDefault(String prefix) {
        String normalized = prefix == null ? null : prefix.trim().toUpperCase(Locale.ROOT);
        return isValidPrefix(normalized) ? normalized : DEFAULT_PREFIX;
    }

    /** {@code " fa-12 "} → {@code FA-12}; empty when the text is not a task key. */
    public static Optional<ParsedKey> parse(String text) {
        if (text == null) return Optional.empty();
        Matcher matcher = KEY.matcher(text.trim().toUpperCase(Locale.ROOT));
        if (!matcher.matches()) return Optional.empty();
        return Optional.of(new ParsedKey(matcher.group(1), Long.parseLong(matcher.group(2))));
    }

    /**
     * Acronym of a project name, the key prefix the frontend used to display for
     * workspaces without a stored prefix ({@code Student Support Portal} → {@code SSP}).
     * Same rule as {@code projectKeyOf} in {@code backlog.constants.ts}; empty when it
     * would not be a valid prefix (fewer than 2 letters, or longer than 8).
     */
    public static Optional<String> acronym(String projectName) {
        if (projectName == null) return Optional.empty();
        StringBuilder acronym = new StringBuilder();
        for (String token : projectName.split("[^A-Za-z0-9]+")) {
            if (!token.isEmpty() && !token.chars().allMatch(Character::isDigit)) acronym.append(token.charAt(0));
        }
        String value = acronym.toString().toUpperCase(Locale.ROOT);
        return value.length() >= 2 && isValidPrefix(value) ? Optional.of(value) : Optional.empty();
    }
}
