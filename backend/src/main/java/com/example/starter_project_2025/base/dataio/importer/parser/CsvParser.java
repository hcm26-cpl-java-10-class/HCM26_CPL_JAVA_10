package com.example.starter_project_2025.base.dataio.importer.parser;

import com.opencsv.CSVReader;
import org.springframework.stereotype.Component;

import java.io.InputStream;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.util.HashSet;
import java.util.Locale;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
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

            String[] headers = rows.get(0);
            var unique = new HashSet<String>();
            for (int i = 0; i < headers.length; i++) {
                headers[i] = headers[i].replace("\uFEFF", "").strip();
                if (headers[i].isEmpty() || !unique.add(headers[i].toLowerCase(Locale.ROOT))) {
                    throw new IllegalArgumentException("Column names must be non-empty and unique");
                }
            }

            for (int i = 1; i < rows.size(); i++) {
                Map<String, String> rowMap = new HashMap<>();

                String[] row = rows.get(i);
                for (int j = headers.length; j < row.length; j++) {
                    if (!row[j].isBlank()) throw new IllegalArgumentException("A row contains more values than the header");
                }

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
