package com.example.starter_project_2025.base.dataio.importer.parser;

import com.opencsv.CSVReader;
import org.springframework.stereotype.Component;

import java.io.InputStream;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.util.*;

@Component
public class CsvParser implements FileParser {
    @Override
    public boolean supports(String filename) {
        if (filename == null) return false;
        return filename.toLowerCase(Locale.ROOT).endsWith(".csv");
    }
    @Override
   public List<Map<String, String>> parse(InputStream input) {
    List<Map<String, String>> result = new ArrayList<>();

        try (CSVReader reader = new CSVReader(new InputStreamReader(input, StandardCharsets.UTF_8))) {
            List<String[]> rows = reader.readAll();

            if (rows.size() < 2) return result;

            String[] headers = Arrays.stream(rows.get(0))
                    .map(this::cleanHeader)
                    .toArray(String[]::new);

            Set<String> seenHeaders = new HashSet<>();
            for (String header : headers) {
                if (header.isBlank()) {
                    throw new IllegalArgumentException("Every column needs a header.");
                }
                if (!seenHeaders.add(header.replaceAll("\\s+", " ").toLowerCase(Locale.ROOT))) {
                    throw new IllegalArgumentException("Duplicate column header: " + header);
                }
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
                    rowMap.put("_rowNumber", String.valueOf(i + 1));
                    result.add(rowMap);
                }
            }
        } catch (IllegalArgumentException e) {
            throw e;
        } catch (Exception e) {
            throw new RuntimeException("Failed to parse CSV file", e);
        }

        return result;
    }

    private String cleanHeader(String header) {
        if (header == null) return "";
        return header.replace("\uFEFF", "").trim();
    }
}