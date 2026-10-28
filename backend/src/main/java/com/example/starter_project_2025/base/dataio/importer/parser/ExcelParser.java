package com.example.starter_project_2025.base.dataio.importer.parser;

import org.apache.poi.ss.usermodel.Cell;
import org.apache.poi.ss.usermodel.CellType;
import org.apache.poi.ss.usermodel.CellValue;
import org.apache.poi.ss.usermodel.DataFormatter;
import org.apache.poi.ss.usermodel.DateUtil;
import org.apache.poi.ss.usermodel.FormulaEvaluator;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.ss.usermodel.Workbook;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.io.InputStream;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

@Component
public class ExcelParser implements FileParser {

    @Override
    public boolean supports(String filename) {
        return filename != null && filename.toLowerCase(Locale.ROOT).endsWith(".xlsx");
    }

    @Override
    public List<Map<String, String>> parse(InputStream inputStream) {
        List<Map<String, String>> rows = new ArrayList<>();

        try (Workbook workbook = new XSSFWorkbook(inputStream)) {
            Sheet sheet = workbook.getSheetAt(0);

            Row headerRow = sheet.getRow(0);
            if (headerRow == null) {
                return rows;
            }

            DataFormatter formatter = new DataFormatter();
            FormulaEvaluator evaluator = workbook.getCreationHelper().createFormulaEvaluator();

            // Headers are trimmed, so "Email " in the file still matches the column "Email".
            List<String> headers = new ArrayList<>();
            int headerCount = Math.max(headerRow.getLastCellNum(), 0);
            for (int j = 0; j < headerCount; j++) {
                String header = getCellValue(headerRow.getCell(j), formatter, evaluator);
                headers.add(header == null ? "" : header);
            }

            for (int i = 1; i <= sheet.getLastRowNum(); i++) {
                Row row = sheet.getRow(i);

                // Empty rows are common at the end of a sheet (formatting only). They used to crash the import.
                if (row == null) {
                    continue;
                }

                Map<String, String> map = new HashMap<>();
                boolean hasData = false;

                for (int j = 0; j < headers.size(); j++) {
                    if (headers.get(j).isEmpty()) {
                        continue;
                    }
                    String value = getCellValue(row.getCell(j), formatter, evaluator);
                    map.put(headers.get(j), value);
                    if (value != null && !value.isBlank()) {
                        hasData = true;
                    }
                }

                if (hasData) {
                    map.put(ROW_NUMBER_KEY, String.valueOf(i + 1));
                    rows.add(map);
                }
            }
        } catch (IOException e) {
            throw new RuntimeException(e);
        }

        return rows;
    }

    /**
     * Text of a cell as the user typed it: numbers without ".0" or exponent notation (a phone number
     * stored as a number used to come out as "9.01234567E8"), formulas evaluated, text trimmed.
     */
    private String getCellValue(Cell cell, DataFormatter formatter, FormulaEvaluator evaluator) {
        if (cell == null) return null;

        CellType type = cell.getCellType();

        if (type == CellType.FORMULA) {
            CellValue evaluated;
            try {
                evaluated = evaluator.evaluate(cell);
            } catch (RuntimeException e) {
                return null;
            }
            if (evaluated == null) return null;

            return switch (evaluated.getCellType()) {
                case STRING -> blankToNull(evaluated.getStringValue());
                case NUMERIC -> numberText(cell, evaluated.getNumberValue(), formatter);
                case BOOLEAN -> String.valueOf(evaluated.getBooleanValue());
                default -> null;
            };
        }

        return switch (type) {
            case STRING -> blankToNull(cell.getStringCellValue());
            case NUMERIC -> numberText(cell, cell.getNumericCellValue(), formatter);
            case BOOLEAN -> String.valueOf(cell.getBooleanCellValue());
            default -> null;
        };
    }

    private String numberText(Cell cell, double number, DataFormatter formatter) {
        if (DateUtil.isCellDateFormatted(cell)) {
            return blankToNull(formatter.formatCellValue(cell));
        }
        return BigDecimal.valueOf(number).stripTrailingZeros().toPlainString();
    }

    private String blankToNull(String text) {
        if (text == null) return null;
        String trimmed = text.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }
}
