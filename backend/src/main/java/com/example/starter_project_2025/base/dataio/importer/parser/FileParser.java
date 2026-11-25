package com.example.starter_project_2025.base.dataio.importer.parser;

import java.io.InputStream;
import java.util.List;
import java.util.Map;

public interface FileParser {

    /**
     * Key added to every parsed row: the row number in the file (header = row 1). Rows that are skipped
     * because they are empty keep the numbering of the others, so error messages point at the right line.
     */
    String ROW_NUMBER_KEY = "#row";

    List<Map<String, String>> parse(InputStream inputStream);

    boolean supports(String filename);

    /** Row number of a parsed row, or {@code fallback} when the parser did not set one. */
    static int rowNumberOf(Map<String, String> row, int fallback) {
        String value = row.get(ROW_NUMBER_KEY);
        if (value == null) {
            return fallback;
        }
        try {
            return Integer.parseInt(value);
        } catch (NumberFormatException e) {
            return fallback;
        }
    }
}
