package com.example.starter_project_2025.base.dataio.importer.parser;

import org.apache.poi.ss.usermodel.Cell;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.ss.usermodel.Workbook;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Component
public class ExcelParser implements FileParser {

    @Override
    public boolean supports(String filename) {
        return filename.endsWith(".xlsx");
    }

    @Override
    public List<Map<String, String>> parse(InputStream inputStream) {
        List<Map<String, String>> rows = new ArrayList<>();

        try (Workbook workbook = new XSSFWorkbook(inputStream)) {
            Sheet sheet = workbook.getSheetAt(0);

            Row headerRow = sheet.getRow(0);
            List<String> headers = new ArrayList<>();

            headerRow.forEach(cell -> headers.add(cell.getStringCellValue()));

            for (int i = 1; i <= sheet.getLastRowNum(); i++) {
                Row row = sheet.getRow(i);

                Map<String, String> map = new HashMap<>();

                for (int j = 0; j < headers.size(); j++) {
                    Cell cell = row.getCell(j);
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
        if (cell == null) return null;

        return switch (cell.getCellType()) {
            case STRING -> cell.getStringCellValue();
            case NUMERIC -> String.valueOf(cell.getNumericCellValue());
            default -> null;
        };
    }
}
