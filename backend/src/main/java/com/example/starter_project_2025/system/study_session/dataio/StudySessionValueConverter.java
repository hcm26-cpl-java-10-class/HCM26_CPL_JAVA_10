package com.example.starter_project_2025.system.study_session.dataio;


import java.math.BigDecimal;


public class StudySessionValueConverter extends com.example.starter_project_2025.base.dataio.importer.mapper.ValueConverter {

    public Object convert(Class<?> type, String raw) {

        if (raw == null || raw.isBlank())
            return null;

        String val = raw.trim();

        if (type == String.class)
            return val;

        if (type == Long.class || type == long.class) {
            try {
                return new BigDecimal(val).longValueExact();
            } catch (NumberFormatException | ArithmeticException e) {
                throw new IllegalArgumentException("Expected a whole number within Long range: " + val, e);
            }
        }

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
            return val.contains("T") ? java.time.LocalDateTime.parse(val) : java.time.LocalDate.parse(val).atStartOfDay();

        if (type == java.time.LocalDate.class)
            return val.contains("T") ? java.time.LocalDateTime.parse(val).toLocalDate() : java.time.LocalDate.parse(val);

        if (type == java.time.LocalTime.class)
            return val.contains("T") ? java.time.LocalDateTime.parse(val).toLocalTime() : java.time.LocalTime.parse(val);

        return raw;
    }
}
