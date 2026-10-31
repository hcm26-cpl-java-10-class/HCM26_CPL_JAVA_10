package com.example.starter_project_2025.base.dataio.importer.parser;

import org.apache.poi.ss.usermodel.Cell;
import org.apache.poi.ss.usermodel.DateUtil;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.ss.usermodel.Workbook;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.stereotype.Component;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;
import java.util.zip.ZipOutputStream;

@Component
public class ExcelParser implements FileParser {
    private static final Pattern WORKSHEET_DATE_CELL = Pattern.compile(
            "<(?<tag>(?:[A-Za-z_][\\w.-]*:)?c)\\b(?<attributes>[^>]*\\bt\\s*=\\s*(?:\"d\"|'d')[^>]*)>(?<content>.*?)</\\k<tag>\\s*>",
            Pattern.DOTALL);
    private static final Pattern CELL_VALUE = Pattern.compile(
            "<(?<tag>(?:[A-Za-z_][\\w.-]*:)?v)\\b[^>]*>(?<value>.*?)</\\k<tag>\\s*>", Pattern.DOTALL);

    @Override
    public boolean supports(String filename) {
        return filename != null && filename.toLowerCase(Locale.ROOT).endsWith(".xlsx");
    }

    @Override
    public List<Map<String, String>> parse(InputStream inputStream) {
        List<Map<String, String>> rows = new ArrayList<>();

        try (InputStream compatibleInput = normalizeIsoDateCells(inputStream);
             Workbook workbook = new XSSFWorkbook(compatibleInput)) {
            Sheet sheet = workbook.getSheetAt(0);

            Row headerRow = sheet.getRow(0);
            if (headerRow == null) throw new IllegalArgumentException("Import file has no header row");
            List<String> headers = new ArrayList<>();

            headerRow.forEach(cell -> headers.add(cell.getStringCellValue()));

            for (int i = 1; i <= sheet.getLastRowNum(); i++) {
                Row row = sheet.getRow(i);
                if (row == null) {
                    rows.add(new HashMap<>());
                    continue;
                }

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
            case BOOLEAN -> String.valueOf(cell.getBooleanCellValue());
            case FORMULA -> getFormulaValue(cell);
            default -> null;
        };
    }

    private String getFormulaValue(Cell cell) {
        return switch (cell.getCachedFormulaResultType()) {
            case STRING -> cell.getStringCellValue();
            case NUMERIC -> String.valueOf(cell.getNumericCellValue());
            case BOOLEAN -> String.valueOf(cell.getBooleanCellValue());
            default -> null;
        };
    }

    /**
     * Apache POI's OOXML schema does not accept the ISO date cell type used by
     * some XLSX writers (t="d"). Convert those cells to ordinary Excel date
     * serials before opening the workbook, preserving the cell's date style.
     */
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
