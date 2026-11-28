package com.example.starter_project_2025.system.demo.course;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.text.Normalizer;
import java.util.HexFormat;
import java.util.List;
import java.util.Locale;
import java.util.stream.Collectors;

/** Deterministic scope and name keys used by BOTH manual and AI creation. */
public final class CourseSourceScope {
    private CourseSourceScope() {}

    public static String nameKey(String name) {
        return name == null ? null : Normalizer.normalize(name, Normalizer.Form.NFKC)
                .strip().replaceAll("\\s+", " ").toLowerCase(Locale.ROOT);
    }

    public static List<Long> canonical(List<Long> ids) {
        return ids.stream().distinct().sorted().toList();
    }

    public static String idsCsv(List<Long> ids) {
        return canonical(ids).stream().map(String::valueOf).collect(Collectors.joining(","));
    }

    public static String key(List<Long> ids) {
        return sha256(idsCsv(ids)); // V1 key: retained only for existing rows
    }

    /** V2 uses the existing unique DB column for scope + ordered, normalized teaching outline. */
    public static String outlineKey(List<Long> ids, List<CourseFromSyllabusModels.DraftSection> outline) {
        StringBuilder signature = new StringBuilder("v2:").append(idsCsv(ids));
        for (var section : outline) {
            signature.append("\nS:").append(nameKey(section.title()));
            for (String lesson : section.lessons()) {
                signature.append("\nL:").append(nameKey(lesson));
            }
        }
        return sha256(signature.toString());
    }

    private static String sha256(String data) {
        try {
            byte[] bytes = MessageDigest.getInstance("SHA-256")
                    .digest(data.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(bytes);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 is unavailable", e);
        }
    }
}
