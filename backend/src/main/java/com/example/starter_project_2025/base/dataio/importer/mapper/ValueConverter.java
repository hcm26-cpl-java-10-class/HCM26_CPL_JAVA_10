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
            Class<Enum> enumClass = (Class<Enum>) type;
            for (Enum constant : enumClass.getEnumConstants()) {
                if (constant.name().equalsIgnoreCase(val)) {
                    return constant;
                }
            }
            // Handle common aliases for status enums
            if (val.equalsIgnoreCase("hoạt động") || val.equalsIgnoreCase("dang hoat dong")
                    || val.equalsIgnoreCase("true") || val.equalsIgnoreCase("1")) {
                for (Enum constant : enumClass.getEnumConstants()) {
                    if (constant.name().equalsIgnoreCase("ACTIVE")) return constant;
                }
            }
            if (val.equalsIgnoreCase("ngừng hoạt động") || val.equalsIgnoreCase("ngung hoat dong")
                    || val.equalsIgnoreCase("false") || val.equalsIgnoreCase("0")) {
                for (Enum constant : enumClass.getEnumConstants()) {
                    if (constant.name().equalsIgnoreCase("INACTIVE")) return constant;
                }
            }
            throw new IllegalArgumentException("Giá trị '" + val + "' không hợp lệ cho trạng thái (Chỉ chấp nhận ACTIVE hoặc INACTIVE)");
        }

        if (type == java.time.LocalDateTime.class)
            return java.time.LocalDateTime.parse(val);

        if (type == java.time.LocalDate.class)
            return java.time.LocalDate.parse(val);

        return raw;
    }
}
