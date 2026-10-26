package com.example.starter_project_2025.system.study_session.dataio;

import org.apache.poi.ss.usermodel.*;


import java.io.InputStream;
import com.example.starter_project_2025.base.dataio.importer.parser.FileParser;
import java.math.BigDecimal;
import java.util.*;


public class StudySessionExcelParser implements FileParser {

    @Override
    public boolean supports(String filename) {
        if (filename == null) return false;
        String lower = filename.toLowerCase(Locale.ROOT);
        return lower.endsWith(".xlsx") || lower.endsWith(".xls");
    }

    @Override
    public List<Map<String, String>> parse(InputStream inputStream) {
        try (Workbook workbook = WorkbookFactory.create(inputStream)) {
            if (workbook.getNumberOfSheets() == 0) {
                throw new IllegalArgumentException("The Excel file has no worksheets");
            }
            Sheet sheet = workbook.getSheetAt(0);
            Row headerRow = sheet.getRow(0);
            if (headerRow == null || headerRow.getLastCellNum() <= 0) {
                throw new IllegalArgumentException("The Excel file is missing its header row");
            }

            FormulaEvaluator evaluator = workbook.getCreationHelper().createFormulaEvaluator();
            boolean date1904 = workbook instanceof Date1904Support support && support.isDate1904();
            List<String> headers = new ArrayList<>();
            Set<String> seen = new HashSet<>();
            for (int column = 0; column < headerRow.getLastCellNum(); column++) {
                String header = getCellValue(headerRow.getCell(column), evaluator, date1904);
                header = header == null ? "" : header.replace("\uFEFF", "").trim();
                if (header.isEmpty()) {
                    throw new IllegalArgumentException("Missing column header at column " + (column + 1));
                }
                if (!seen.add(header.toLowerCase(Locale.ROOT))) {
                    throw new IllegalArgumentException("Duplicate column header: " + header);
                }
                headers.add(header);
            }

            List<Map<String, String>> rows = new ArrayList<>();
            for (int index = 1; index <= sheet.getLastRowNum(); index++) {
                Row row = sheet.getRow(index);
                Map<String, String> values = new LinkedHashMap<>();
                for (int column = 0; column < headers.size(); column++) {
                    values.put(headers.get(column), getCellValue(
                            row == null ? null : row.getCell(column), evaluator, date1904));
                }
                // Retain blank rows so callers can report the original Excel row number.
                rows.add(values);
            }
            return rows;
        } catch (IllegalArgumentException exception) {
            throw exception;
        } catch (Exception exception) {
            throw new IllegalArgumentException("Unable to read the Excel file. Upload a valid .xlsx or .xls workbook.", exception);
        }
    }

    private String getCellValue(Cell cell, FormulaEvaluator evaluator, boolean date1904) {
        if (cell == null || cell.getCellType() == CellType.BLANK) return null;
        CellValue value = evaluator.evaluate(cell);
        if (value == null) return null;
        return switch (value.getCellType()) {
            case STRING -> value.getStringValue();
            case BOOLEAN -> Boolean.toString(value.getBooleanValue());
            case NUMERIC -> {
                double number = value.getNumberValue();
                if (DateUtil.isCellDateFormatted(cell)) {
                    var dateTime = DateUtil.getLocalDateTime(number, date1904).withNano(0);
                    yield number >= 0 && number < 1
                            ? dateTime.toLocalTime().toString() : dateTime.toString();
                }
                // Excel stores IDs as doubles; 1 must remain "1", rather than "1.0".
                yield cell instanceof org.apache.poi.xssf.usermodel.XSSFCell xssf
                        && cell.getCellType() == CellType.NUMERIC
                        ? new BigDecimal(xssf.getRawValue()).stripTrailingZeros().toPlainString()
                        : BigDecimal.valueOf(number).stripTrailingZeros().toPlainString();
            }
            case ERROR -> throw new IllegalArgumentException(
                    "Excel cell " + cell.getAddress() + " contains an error");
            default -> null;
        };
    }
}
