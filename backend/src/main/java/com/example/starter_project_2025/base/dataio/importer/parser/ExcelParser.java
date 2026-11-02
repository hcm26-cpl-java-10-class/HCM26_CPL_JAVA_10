package com.example.starter_project_2025.base.dataio.importer.parser;

import org.apache.poi.ss.usermodel.*;


import java.io.InputStream;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;
import java.util.zip.ZipOutputStream;

import com.example.starter_project_2025.base.dataio.importer.parser.FileParser;
import java.math.BigDecimal;
import java.util.*;


@org.springframework.stereotype.Component
public class ExcelParser implements FileParser {

    private static final Pattern WORKSHEET_DATE_CELL = Pattern.compile(
            "<(?<tag>(?:[A-Za-z_][\\w.-]*:)?c)\\b(?<attributes>[^>]*\\bt\\s*=\\s*(?:\"d\"|'d')[^>]*)>(?<content>.*?)</\\k<tag>\\s*>",
            Pattern.DOTALL);
    private static final Pattern CELL_VALUE = Pattern.compile(
            "<(?<tag>(?:[A-Za-z_][\\w.-]*:)?v)\\b[^>]*>(?<value>.*?)</\\k<tag>\\s*>", Pattern.DOTALL);

    @Override
    public boolean supports(String filename) {
        if (filename == null) return false;
        String lower = filename.toLowerCase(Locale.ROOT);
        return lower.endsWith(".xlsx") || lower.endsWith(".xls");
    }

    @Override
    public List<Map<String, String>> parse(InputStream inputStream) {
        try (InputStream normalized = normalizeIsoDateCells(inputStream);
             Workbook workbook = WorkbookFactory.create(normalized)) {
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
    private InputStream normalizeIsoDateCells(InputStream inputStream) throws IOException {
        byte[] original = inputStream.readAllBytes();
        List<ZipEntryData> entries = new ArrayList<>();
        boolean changed = false;

        try (ZipInputStream zipInput = new ZipInputStream(new ByteArrayInputStream(original))) {
            ZipEntry entry;
            while ((entry = zipInput.getNextEntry()) != null) {
                byte[] content = zipInput.readAllBytes();
                if (entry.getName().matches("xl/worksheets/[^/]+\\.xml")) {
                    String xml = new String(content, StandardCharsets.UTF_8);
                    String normalized = normalizeWorksheetDates(xml);
                    if (!normalized.equals(xml)) {
                        content = normalized.getBytes(StandardCharsets.UTF_8);
                        changed = true;
                    }
                }
                entries.add(new ZipEntryData(entry.getName(), content, entry.getTime(), entry.getComment()));
                zipInput.closeEntry();
            }
        }

        if (!changed) return new ByteArrayInputStream(original);

        ByteArrayOutputStream normalizedWorkbook = new ByteArrayOutputStream();
        try (ZipOutputStream zipOutput = new ZipOutputStream(normalizedWorkbook)) {
            for (ZipEntryData item : entries) {
                ZipEntry entry = new ZipEntry(item.name());
                if (item.time() >= 0) entry.setTime(item.time());
                if (item.comment() != null) entry.setComment(item.comment());
                zipOutput.putNextEntry(entry);
                zipOutput.write(item.content());
                zipOutput.closeEntry();
            }
        }
        return new ByteArrayInputStream(normalizedWorkbook.toByteArray());
    }

    private String normalizeWorksheetDates(String xml) {
        Matcher cellMatcher = WORKSHEET_DATE_CELL.matcher(xml);
        StringBuffer normalizedXml = new StringBuffer();
        while (cellMatcher.find()) {
            String attributes = cellMatcher.group("attributes");
            Matcher valueMatcher = CELL_VALUE.matcher(cellMatcher.group("content"));
            if (!valueMatcher.find()) {
                cellMatcher.appendReplacement(normalizedXml, Matcher.quoteReplacement(cellMatcher.group()));
                continue;
            }

            String dateValue = valueMatcher.group("value").trim();
            try {
                LocalDate date = LocalDate.parse(dateValue.substring(0, 10));
                double serial = DateUtil.getExcelDate(date.atStartOfDay());
                String valueCell = valueMatcher.group().replace(valueMatcher.group("value"), Double.toString(serial));
                String normalizedContent = valueMatcher.replaceFirst(Matcher.quoteReplacement(valueCell));
                String normalizedAttributes = attributes.replaceFirst(
                        "\\bt\\s*=\\s*(?:\"d\"|'d')", "t=\"n\"");
                String normalizedCell = "<" + cellMatcher.group("tag") + normalizedAttributes + ">"
                        + normalizedContent + "</" + cellMatcher.group("tag") + ">";
                cellMatcher.appendReplacement(normalizedXml, Matcher.quoteReplacement(normalizedCell));
            } catch (DateTimeParseException | IndexOutOfBoundsException error) {
                cellMatcher.appendReplacement(normalizedXml, Matcher.quoteReplacement(cellMatcher.group()));
            }
        }
        cellMatcher.appendTail(normalizedXml);
        return normalizedXml.toString();
    }

    private record ZipEntryData(String name, byte[] content, long time, String comment) {}
}
