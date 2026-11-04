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

        if (type == java.time.LocalDate.class)
            return java.time.LocalDate.parse(val);

        return raw;
    }
}
