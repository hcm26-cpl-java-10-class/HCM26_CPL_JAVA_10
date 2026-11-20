
package com.example.starter_project_2025.base.dataio.importer.parser;

import java.io.InputStream;
import java.util.List;
import java.util.Map;

public interface FileParser {

    List<Map<String, String>> parse(InputStream inputStream);

    boolean supports(String filename);

    static int rowNumberOf(Map<String, String> row, int fallback) {
        if (row == null) {
            return fallback;
        }

        String rowNumber = row.get("__rowNumber");

        if (rowNumber == null || rowNumber.isBlank()) {
            return fallback;
        }

        try {
            return Integer.parseInt(rowNumber);
        } catch (NumberFormatException e) {
            return fallback;
        }
    }
}
