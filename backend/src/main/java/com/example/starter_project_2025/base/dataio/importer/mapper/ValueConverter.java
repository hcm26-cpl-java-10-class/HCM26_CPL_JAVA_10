package com.example.starter_project_2025.base.dataio.importer.mapper;

import org.springframework.stereotype.Component;

@Component
public class ValueConverter {

    public Object convert(Class<?> type, String raw) {

        if (raw == null || raw.isBlank())
            return null;

        String val = raw.trim();

        if (type == String.class)
            return val;

        if (type == Long.class || type == long.class)
            return Long.valueOf(val);

        if (type == Integer.class || type == int.class)
            return Integer.valueOf(val);

        if (type == Boolean.class || type == boolean.class)
            return Boolean.valueOf(val);

        if (type == Double.class || type == double.class)
            return Double.valueOf(val);

        if (type == java.util.UUID.class)
            return java.util.UUID.fromString(val);

        if (type.isEnum()) {
            @SuppressWarnings({ "unchecked", "rawtypes" })
            Enum enumVal = Enum.valueOf((Class<Enum>) type, val);
            return enumVal;
        }

        if (type == java.time.LocalDateTime.class)
            return java.time.LocalDateTime.parse(val);

        if (type == java.time.LocalDate.class) {
            // Accept ISO format and common Excel date formats.
            java.time.format.DateTimeFormatter[] formats = {
                    java.time.format.DateTimeFormatter.ISO_LOCAL_DATE,
                    java.time.format.DateTimeFormatter.ofPattern("dd-MM-yyyy"),
                    java.time.format.DateTimeFormatter.ofPattern("dd/MM/yyyy")
            };
            for (java.time.format.DateTimeFormatter format : formats) {
                try {
                    return java.time.LocalDate.parse(val, format);
                } catch (java.time.format.DateTimeParseException ignored) {
                    // Try the next supported format.
                }
            }
            throw new IllegalArgumentException("Invalid date '" + val + "'. Use yyyy-MM-dd, dd-MM-yyyy, or dd/MM/yyyy.");
        }

        return raw;
    }
}
