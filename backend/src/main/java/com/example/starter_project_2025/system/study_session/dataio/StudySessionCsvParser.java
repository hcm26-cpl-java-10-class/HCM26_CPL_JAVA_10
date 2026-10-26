package com.example.starter_project_2025.system.study_session.dataio;

import com.opencsv.CSVReader;


import java.io.InputStream;
import com.example.starter_project_2025.base.dataio.importer.parser.FileParser;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.util.*;


public class StudySessionCsvParser implements FileParser {

    @Override
    public boolean supports(String filename) {
        return filename != null && filename.toLowerCase(Locale.ROOT).endsWith(".csv");
    }

    @Override
    public List<Map<String, String>> parse(InputStream input) {

        try (CSVReader reader = new CSVReader(new InputStreamReader(input, StandardCharsets.UTF_8))) {
            List<String[]> records = reader.readAll();
            if (records.isEmpty()) {
                throw new IllegalArgumentException("The CSV file is missing its header row");
            }
            String[] headers = records.getFirst();
            Set<String> seen = new HashSet<>();
            for (int column = 0; column < headers.length; column++) {
                headers[column] = headers[column].replace("\uFEFF", "").trim();
                if (headers[column].isEmpty()) {
                    throw new IllegalArgumentException("Missing column header at column " + (column + 1));
                }
                if (!seen.add(headers[column].toLowerCase(Locale.ROOT))) {
                    throw new IllegalArgumentException("Duplicate column header: " + headers[column]);
                }
            }

            List<Map<String, String>> result = new ArrayList<>();
            for (int index = 1; index < records.size(); index++) {
                Map<String, String> values = new LinkedHashMap<>();
                String[] record = records.get(index);
                if (record.length > headers.length) {
                    throw new IllegalArgumentException("CSV row " + (index + 1) + " has more values than column headers");
                }
                for (int column = 0; column < headers.length; column++) {
                    values.put(headers[column], column < record.length ? record[column] : "");
                }
                result.add(values);
            }
            return result;
        } catch (IllegalArgumentException exception) {
            throw exception;
        } catch (Exception exception) {
            throw new IllegalArgumentException("Unable to read the CSV file. Upload a valid UTF-8 CSV file.", exception);
        }
    }
}
