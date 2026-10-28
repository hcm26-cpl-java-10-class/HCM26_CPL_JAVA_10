package com.example.starter_project_2025.base.dataio.importer.parser;

import com.opencsv.CSVReader;
import org.springframework.stereotype.Component;

import java.io.InputStream;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

@Component
public class CsvParser implements FileParser {

    @Override
    public boolean supports(String filename) {
        return filename != null && filename.toLowerCase(Locale.ROOT).endsWith(".csv");
    }

    @Override
    public List<Map<String, String>> parse(InputStream input) {

        List<Map<String, String>> result = new ArrayList<>();

        try (CSVReader reader = new CSVReader(new InputStreamReader(input, StandardCharsets.UTF_8))) {

            List<String[]> rows = reader.readAll();

            if (rows.size() < 2) return result;

            String[] headers = rows.get(0).clone();
            for (int j = 0; j < headers.length; j++) {
                headers[j] = cleanHeader(headers[j], j == 0);
            }

            for (int i = 1; i < rows.size(); i++) {
                Map<String, String> rowMap = new HashMap<>();
                String[] row = rows.get(i);
                boolean hasData = false;

                for (int j = 0; j < headers.length; j++) {
                    if (headers[j].isEmpty()) {
                        continue;
                    }
                    String value = j < row.length ? row[j].trim() : "";
                    rowMap.put(headers[j], value);
                    if (!value.isEmpty()) {
                        hasData = true;
                    }
                }

                if (hasData) {
                    rowMap.put(ROW_NUMBER_KEY, String.valueOf(i + 1));
                    result.add(rowMap);
                }
            }
        } catch (Exception e) {
            throw new RuntimeException(e);
        }

        return result;
    }

    /** Excel saves "CSV UTF-8" with a hidden byte-order mark in front of the first header ("\uFEFFEmail"). */
    private String cleanHeader(String header, boolean first) {
        String text = header == null ? "" : header;
        if (first && text.startsWith("\uFEFF")) {
            text = text.substring(1);
        }
        return text.trim();
    }
}
