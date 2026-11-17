package com.example.starter_project_2025.system.git_integration.tasklink;

import com.example.starter_project_2025.system.git_integration.domain.BacklogReferenceField;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * SY-05: finds the Task IDs ({@code FA-21}) written in a commit message or a pull request.
 * <ul>
 *     <li>A token counts only when its prefix is a prefix in use in the tenant, so
 *     {@code UTF-8}, {@code SHA-256} or {@code ISO-8601} are never taken for tasks.</li>
 *     <li>{@code #21} is GitHub's issue / pull request syntax and is not a Task ID.</li>
 *     <li>Case-insensitive ({@code fa-21} → {@code FA-21}), duplicates removed in order,
 *     at most {@value #MAX_KEYS} keys per source.</li>
 * </ul>
 */
public final class TaskKeyParser {

    public static final int MAX_KEYS = 20;
    /** Only the start of a long pull request body is scanned. */
    public static final int MAX_SCAN_LENGTH = 10_000;

    private static final Pattern CANDIDATE =
            Pattern.compile("(?<![A-Za-z0-9])([A-Za-z0-9]{1,8})-([1-9][0-9]{0,17})(?![A-Za-z0-9])");

    private TaskKeyParser() {
    }

    /** A Task ID found in a source: normalized key, text as written, and where it was found. */
    public record Mention(String key, String raw, BacklogReferenceField field) {
    }

    public static List<Mention> parse(String text, BacklogReferenceField field, Set<String> knownPrefixes) {
        return parseAll(List.of(new Source(field, text)), knownPrefixes);
    }

    /** One text of a source, in priority order: the first field mentioning a key wins. */
    public record Source(BacklogReferenceField field, String text) {
    }

    public static List<Mention> parseAll(List<Source> sources, Set<String> knownPrefixes) {
        Map<String, Mention> found = new LinkedHashMap<>();
        if (knownPrefixes.isEmpty()) return List.of();
        for (Source source : sources) {
            if (source.text() == null || source.text().isEmpty()) continue;
            String text = source.text().length() > MAX_SCAN_LENGTH ? source.text().substring(0, MAX_SCAN_LENGTH) : source.text();
            Matcher matcher = CANDIDATE.matcher(text);
            while (matcher.find() && found.size() < MAX_KEYS) {
                String prefix = matcher.group(1).toUpperCase(Locale.ROOT);
                if (!knownPrefixes.contains(prefix)) continue;
                String key = prefix + "-" + matcher.group(2);
                found.putIfAbsent(key, new Mention(key, matcher.group(), source.field()));
            }
        }
        return new ArrayList<>(found.values());
    }
}
