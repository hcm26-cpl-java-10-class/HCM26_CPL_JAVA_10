package com.example.starter_project_2025.base.dataio.importer.parser;

import com.opencsv.CSVReader;
import org.springframework.stereotype.Component;

import java.io.InputStream;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Component
public class CsvParser implements FileParser {

    @Override
    public boolean supports(String filename) {
        return filename != null && filename.toLowerCase().endsWith(".csv");
    }

    @Override
    public List<Map<String, String>> parse(InputStream input) {

        List<Map<String, String>> result = new ArrayList<>();

        try (CSVReader reader = new CSVReader(new InputStreamReader(input, StandardCharsets.UTF_8))) {

            List<String[]> rows = reader.readAll();

            if (rows.size() < 2) return result;

            String[] headers = rows.get(0);
            if (headers.length > 0 && headers[0] != null && headers[0].startsWith("\uFEFF")) {
                headers[0] = headers[0].substring(1);
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
            throw new RuntimeException("Error parsing CSV: " + e.getMessage(), e);
        }

        return result;
    }
}
