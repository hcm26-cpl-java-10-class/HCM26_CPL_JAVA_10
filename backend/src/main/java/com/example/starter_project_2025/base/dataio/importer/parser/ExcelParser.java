package com.example.starter_project_2025.base.dataio.importer.parser;

import org.apache.poi.ss.usermodel.Cell;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.ss.usermodel.Workbook;
import org.apache.poi.ss.usermodel.WorkbookFactory;
import org.apache.poi.ss.usermodel.DataFormatter;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Locale;
import java.util.HashSet;

@Component
public class ExcelParser implements FileParser {

    @Override
    public boolean supports(String filename) {
        if (filename == null) return false;
        String name = filename.toLowerCase(Locale.ROOT);
        return name.endsWith(".xlsx") || name.endsWith(".xls");
    }

    @Override
    public List<Map<String, String>> parse(InputStream inputStream) {
        List<Map<String, String>> rows = new ArrayList<>();

        try (Workbook workbook = WorkbookFactory.create(inputStream)) {
            Sheet sheet = workbook.getSheetAt(0);

            Row headerRow = sheet.getRow(0);
            if (headerRow == null) return rows;
            List<String> headers = new ArrayList<>();
            var unique = new HashSet<String>();
            for (int i = 0; i < headerRow.getLastCellNum(); i++) {
                String name = getCellValue(headerRow.getCell(i)).replace("\uFEFF", "").strip();
                if (name.isEmpty() || !unique.add(name.toLowerCase(Locale.ROOT))) {
                    throw new IllegalArgumentException("Column names must be non-empty and unique");
                }
                headers.add(name);
            }

            for (int i = 1; i <= sheet.getLastRowNum(); i++) {
                Row row = sheet.getRow(i);
                if (row != null) {
                    for (int j = headers.size(); j < row.getLastCellNum(); j++) {
                        if (!getCellValue(row.getCell(j)).isBlank()) throw new IllegalArgumentException("A row contains more values than the header");
                    }
                }

                Map<String, String> map = new HashMap<>();

                for (int j = 0; j < headers.size(); j++) {
                    Cell cell = row == null ? null : row.getCell(j);
                    map.put(headers.get(j), getCellValue(cell));
                }

                rows.add(map);
            }
        } catch (IOException e) {
            throw new RuntimeException(e);
        }

        return rows;
    }

    private String getCellValue(Cell cell) {
        return cell == null ? "" : new DataFormatter(Locale.ROOT).formatCellValue(cell);
    }
}
