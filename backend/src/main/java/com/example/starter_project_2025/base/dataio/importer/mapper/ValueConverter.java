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

        if (type == Long.class || type == long.class) {
            try { return new java.math.BigDecimal(val).longValueExact(); }
            catch (NumberFormatException | ArithmeticException error) {
                throw new IllegalArgumentException("Expected a whole number within the supported range: " + val, error);
            }
        }

        if (type == Integer.class || type == int.class) {
            try { return new java.math.BigDecimal(val).intValueExact(); }
            catch (NumberFormatException | ArithmeticException error) {
                throw new IllegalArgumentException("Expected a whole number within the supported range: " + val, error);
            }
        }

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

        String dateTime = val.replace(' ', 'T');
        try {
            if (type == java.time.LocalDateTime.class)
                return java.time.LocalDateTime.parse(dateTime);
            if (type == java.time.LocalDate.class)
                return dateTime.contains("T") ? java.time.LocalDateTime.parse(dateTime).toLocalDate()
                        : java.time.LocalDate.parse(dateTime);
            if (type == java.time.LocalTime.class)
                return dateTime.contains("T") ? java.time.LocalDateTime.parse(dateTime).toLocalTime()
                        : java.time.LocalTime.parse(dateTime);
        } catch (java.time.format.DateTimeParseException error) {
            String format = type == java.time.LocalDate.class ? "yyyy-MM-dd"
                    : type == java.time.LocalTime.class ? "HH:mm" : "yyyy-MM-ddTHH:mm (for example 2026-10-28T09:00)";
            throw new IllegalArgumentException("Expected " + format + ": " + val, error);
        }
        return raw;
    }
}
