package com.example.starter_project_2025.base.dataio.util;

import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;

public class ExportFileNameBuilder {

    private static final DateTimeFormatter FORMATTER =
            DateTimeFormatter.ofPattern("yyyyMMdd_HHmmss");

    private static final ZoneId ZONE = ZoneId.of("Asia/Ho_Chi_Minh");

    public static String build(String baseName, String extension) {
        String timestamp = ZonedDateTime.now(ZONE).format(FORMATTER);
        return baseName + "_" + timestamp + "." + extension;
    }
}
