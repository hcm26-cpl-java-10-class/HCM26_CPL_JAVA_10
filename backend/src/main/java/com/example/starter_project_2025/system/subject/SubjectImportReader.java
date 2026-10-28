package com.example.starter_project_2025.system.subject;

import com.example.starter_project_2025.exception.BadRequestException;
import com.opencsv.CSVReader;
import org.apache.poi.ss.usermodel.*;
import org.springframework.stereotype.Component;
import org.springframework.web.multipart.MultipartFile;

import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.util.*;

/** Subject-only reader: preserves source row numbers and never writes to the database. */
@Component
public class SubjectImportReader {
    public static final int MAX_ROWS = 1000;
    public static final int MAX_FILE_BYTES = 5 * 1024 * 1024;
    public record Row(int rowNumber, Map<String, String> values) {}

    public List<Row> read(MultipartFile file) {
        if (file.isEmpty()) throw new BadRequestException("Choose a non-empty CSV or Excel file");
        if (file.getSize() > MAX_FILE_BYTES) throw new BadRequestException("Subject import files must not exceed 5 MB");
        String filename = Objects.requireNonNullElse(file.getOriginalFilename(), "").toLowerCase(Locale.ROOT);
        try {
            List<Row> rows;
            if (filename.endsWith(".csv")) rows = csv(file);
            else if (filename.endsWith(".xlsx") || filename.endsWith(".xls")) rows = excel(file);
            else throw new BadRequestException("Use a CSV, XLSX or XLS file");
            if (rows.isEmpty()) throw new BadRequestException("The import file has no subject rows");
            return rows;
        } catch (BadRequestException error) {
            throw error;
        } catch (Exception error) {
            throw new BadRequestException("Unable to read subject import file. Use a valid CSV or Excel template.");
        }
    }

    private List<Row> csv(MultipartFile file) throws Exception {
        try (var reader = new CSVReader(new InputStreamReader(file.getInputStream(), StandardCharsets.UTF_8))) {
            String[] first = reader.readNext();
            if (first == null) throw new BadRequestException("The import file is empty");
            var headers = headers(Arrays.asList(first));
            List<Row> result = new ArrayList<>();
            int number = 1;
            String[] values;
            while ((values = reader.readNext()) != null) {
                number++;
                if (Arrays.stream(values).allMatch(String::isBlank)) continue;
                if (values.length > headers.size()) throw new BadRequestException("Row " + number + " has more values than the header");
                add(result, number, headers, Arrays.asList(values));
            }
            return result;
        }
    }

    private List<Row> excel(MultipartFile file) throws Exception {
        try (var workbook = WorkbookFactory.create(file.getInputStream())) {
            if (workbook.getNumberOfSheets() == 0) throw new BadRequestException("The workbook has no sheets");
            var sheet = workbook.getSheetAt(0);
            var first = sheet.getRow(0);
            if (first == null) throw new BadRequestException("The first row must contain the template headers");
            var formatter = new DataFormatter(Locale.ROOT);
            List<String> headerValues = new ArrayList<>();
            for (int i = 0; i < first.getLastCellNum(); i++) headerValues.add(formatter.formatCellValue(first.getCell(i)));
            var headers = headers(headerValues);
            List<Row> result = new ArrayList<>();
            for (int i = 1; i <= sheet.getLastRowNum(); i++) {
                var row = sheet.getRow(i);
                if (row == null) continue;
                List<String> values = new ArrayList<>();
                for (int j = 0; j < headers.size(); j++) values.add(formatter.formatCellValue(row.getCell(j)));
                if (values.stream().allMatch(String::isBlank)) continue;
                add(result, i + 1, headers, values);
            }
            return result;
        }
    }

    private List<String> headers(List<String> values) {
        List<String> headers = values.stream().map(value -> value.replace("\uFEFF", "").trim()).toList();
        Set<String> unique = new HashSet<>();
        for (String header : headers) {
            if (header.isBlank() || !unique.add(header.toLowerCase(Locale.ROOT))) {
                throw new BadRequestException("Import headers must be non-empty and unique");
            }
        }
        for (String required : List.of("code", "name", "version")) {
            if (!unique.contains(required)) throw new BadRequestException("Missing import column: " + required);
        }
        if (!unique.contains("hours") && !unique.contains("duration (hours)")) {
            throw new BadRequestException("Missing import column: Hours");
        }
        return headers;
    }

    private void add(List<Row> result, int number, List<String> headers, List<String> values) {
        if (result.size() >= MAX_ROWS) throw new BadRequestException("Import at most 1000 subject rows at a time");
        Map<String, String> mapped = new LinkedHashMap<>();
        for (int i = 0; i < headers.size(); i++) mapped.put(headers.get(i), i < values.size() ? values.get(i) : "");
        result.add(new Row(number, mapped));
    }
}
