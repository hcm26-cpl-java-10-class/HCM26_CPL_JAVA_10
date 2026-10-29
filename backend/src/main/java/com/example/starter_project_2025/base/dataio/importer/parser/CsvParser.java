package com.example.starter_project_2025.base.dataio.importer.parser;

import com.opencsv.CSVReader;
import org.springframework.stereotype.Component;

import java.io.InputStream;
import java.io.InputStreamReader;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Component
public class CsvParser implements FileParser {

    @Override
    public boolean supports(String filename) {
        return filename != null && filename.toLowerCase(java.util.Locale.ROOT).endsWith(".csv");
    }

    @Override
    public List<Map<String, String>> parse(InputStream input) {

        List<Map<String, String>> result = new ArrayList<>();

        try (CSVReader reader = new CSVReader(new InputStreamReader(input, java.nio.charset.StandardCharsets.UTF_8))) {

            List<String[]> rows = reader.readAll();

            if (rows.size() < 2) return result;

            String[] headers = java.util.Arrays.stream(rows.get(0))
                    .map(header -> header.replace("\uFEFF", "").trim()).toArray(String[]::new);

            var seenHeaders = new java.util.HashSet<String>();
            for (String header : headers) {
                if (header.isBlank()) throw new IllegalArgumentException("Every column needs a header.");
                if (!seenHeaders.add(header.replaceAll("\\s+", " ").toLowerCase(java.util.Locale.ROOT)))
                    throw new IllegalArgumentException("Duplicate column header: " + header);
            }

            for (int i = 1; i < rows.size(); i++) {
                Map<String, String> rowMap = new HashMap<>();

                String[] row = rows.get(i);

                for (int j = 0; j < headers.length; j++) {
                    rowMap.put(headers[j], j < row.length ? row[j] : "");
                }

                result.add(rowMap);
            }
        } catch (Exception e) {
            throw new RuntimeException(e);
        }

        return result;
    }
}
