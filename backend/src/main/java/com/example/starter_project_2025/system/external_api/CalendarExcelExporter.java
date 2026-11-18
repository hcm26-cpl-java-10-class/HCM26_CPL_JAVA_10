package com.example.starter_project_2025.system.external_api;

import com.example.starter_project_2025.exception.ResourceNotFoundException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.apache.poi.ss.usermodel.*;
import org.apache.poi.ss.util.CellRangeAddress;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.stereotype.Service;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.time.LocalTime;
import java.util.*;
import java.util.regex.Pattern;

/** Formatted calendar export. Missing upstream data stays blank, including teaching times. */
@Service
@RequiredArgsConstructor
public class CalendarExcelExporter {
    private final ExternalApiService externalApiService;
    private final ObjectMapper objectMapper;
    private static final String[] HEADERS = { "No.", "Topic / Subject", "Date", "Start Time", "End Time", "Duration (hours)",
            "Trainer", "Delivery Type", "Venue", "Notes", "Staff Type", "Topic Code", "Topic Version", "Training Materials" };
    private static final Pattern SLOT = Pattern.compile("(\\d{1,2}:\\d{2})\\s*-\\s*(\\d{1,2}:\\d{2})");

    public byte[] export(Long classId, Long calendarId) throws IOException {
        JsonNode calendars = objectMapper.valueToTree(externalApiService.fetchClassCalendars(classId));
        JsonNode calendar = null;
        if (calendars.isArray()) for (JsonNode item : calendars) {
            if (item.path("id").asLong(-1) == calendarId) { calendar = item; break; }
        }
        if (calendar == null) throw new ResourceNotFoundException("Calendar version not found for this class");
        return build(calendar);
    }

    public byte[] build(JsonNode calendar) throws IOException {
        try (XSSFWorkbook workbook = new XSSFWorkbook(); ByteArrayOutputStream bytes = new ByteArrayOutputStream()) {
            Sheet sheet = workbook.createSheet("Training Calendar");
            CellStyle normal = style(workbook, false, false, null);
            CellStyle group = style(workbook, true, false, IndexedColors.GREY_50_PERCENT);
            CellStyle header = style(workbook, true, false, IndexedColors.GREY_25_PERCENT);
            CellStyle italic = style(workbook, true, true, null);
            CellStyle time = workbook.createCellStyle(); time.cloneStyleFrom(normal);
            time.setDataFormat(workbook.createDataFormat().getFormat("hh:mm"));
            CellStyle date = workbook.createCellStyle(); date.cloneStyleFrom(normal);
            date.setDataFormat(workbook.createDataFormat().getFormat("dd-mmm-yyyy"));
            CellStyle duration = workbook.createCellStyle(); duration.cloneStyleFrom(normal);
            duration.setDataFormat(workbook.createDataFormat().getFormat("0.00"));

            String[] summary = { text(calendar, "name"), "Version: " + text(calendar, "version") + "    Status: " + text(calendar, "status"),
                    "History Change: " + text(calendar, "historyChange"),
                    "Last Modified: " + text(calendar, "lastModifiedDate") + "    By: " + text(calendar, "lastModifiedBy") };
            for (int i = 0; i < summary.length; i++) {
                Row row = sheet.createRow(i); row.setHeightInPoints(i == 0 ? 32 : 24);
                cell(row, 0, summary[i], i == 0 ? header : normal);
                sheet.addMergedRegion(new CellRangeAddress(i, i, 0, 13));
            }
            Row heading = sheet.createRow(4); heading.setHeightInPoints(38);
            for (int i = 0; i < HEADERS.length; i++) cell(heading, i, HEADERS[i], header);

            Map<String, List<JsonNode>> groups = new LinkedHashMap<>();
            Map<String, JsonNode> ranges = new HashMap<>();
            for (JsonNode item : calendar.path("overviewItems")) {
                String label = text(item, "label");
                groups.putIfAbsent(label, new ArrayList<>());
                ranges.put(label, item);
                for (JsonNode lesson : item.path("lessons")) {
                    var session = objectMapper.createObjectNode();
                    session.put("topic", text(lesson, "name"));
                    session.put("topicCode", label.replaceAll("^\\[|\\]$", ""));
                    session.put("topicVersion", text(item, "version"));
                    session.put("date", text(lesson, "from").equals(text(lesson, "to")) ? text(lesson, "from") : text(lesson, "from") + " - " + text(lesson, "to"));
                    session.put("slot", text(lesson, "slot").isBlank() ? text(item, "slot") : text(lesson, "slot"));
                    session.put("trainer", text(lesson, "trainer"));
                    session.put("room", text(lesson, "venue"));
                    session.put("notes", text(lesson, "notes"));
                    session.put("trainingMaterials", text(lesson, "materials"));
                    groups.get(label).add(session);
                }
            }
            List<JsonNode> sessions = new ArrayList<>();
            calendar.path("sessions").forEach(sessions::add);
            sessions.sort(Comparator.comparing(item -> text(item, "date")));
            for (JsonNode session : sessions) {
                String label = text(session, "topicCode");
                if (label.isBlank()) label = text(session, "topic");
                if (label.isBlank()) label = "Unassigned topic";
                String bracketed = "[" + label + "]";
                if (groups.containsKey(bracketed)) label = bracketed;
                groups.computeIfAbsent(label, unused -> new ArrayList<>()).add(session);
            }
            int rowIndex = 5;
            int number = 1;
            for (Map.Entry<String, List<JsonNode>> entry : groups.entrySet()) {
                String label = entry.getKey();
                JsonNode first = entry.getValue().isEmpty() ? null : entry.getValue().getFirst();
                String code = text(first, "topicCode");
                if (code.isBlank() && label.startsWith("[") && label.endsWith("]")) code = label.substring(1, label.length() - 1);
                Row groupRow = sheet.createRow(rowIndex++); groupRow.setHeightInPoints(23);
                for (int i = 0; i < 14; i++) cell(groupRow, i, "", group);
                cell(groupRow, 0, String.valueOf(number++), group);
                cell(groupRow, 1, label, group);
                cell(groupRow, 11, code, group);
                cell(groupRow, 12, text(first, "topicVersion"), group);
                if (first == null) {
                    Row row = sheet.createRow(rowIndex++); row.setHeightInPoints(34);
                    for (int i = 0; i < 14; i++) cell(row, i, "", normal);
                    cell(row, 1, label, italic);
                    JsonNode range = ranges.get(label);
                    cell(row, 2, text(range, "startDate") + (text(range, "endDate").equals(text(range, "startDate")) ? "" : " - " + text(range, "endDate")), normal);
                    cell(row, 9, "Detailed session times are not available for this topic.", normal);
                    cell(row, 11, code, italic);
                }
                for (JsonNode session : entry.getValue()) {
                    Row row = sheet.createRow(rowIndex++); row.setHeightInPoints(42);
                    for (int i = 0; i < 14; i++) cell(row, i, "", normal);
                    cell(row, 1, text(session, "topic"), italic);
                    String rawDate = text(session, "date");
                    try {
                        Cell value = row.getCell(2);
                        value.setCellValue(java.time.LocalDate.parse(rawDate).atStartOfDay()); value.setCellStyle(date);
                    } catch (java.time.format.DateTimeParseException ignored) { cell(row, 2, rawDate, normal); }
                    String start = text(session, "startTime"); String end = text(session, "endTime");
                    var matcher = SLOT.matcher(text(session, "slot"));
                    if (matcher.find()) { if (start.isBlank()) start = matcher.group(1); if (end.isBlank()) end = matcher.group(2); }
                    Double startValue = timeValue(start); Double endValue = timeValue(end);
                    if (startValue != null) { row.getCell(3).setCellValue(startValue); row.getCell(3).setCellStyle(time); }
                    if (endValue != null) { row.getCell(4).setCellValue(endValue); row.getCell(4).setCellStyle(time); }
                    if (startValue != null && endValue != null && endValue > startValue) {
                        row.getCell(5).setCellFormula("(E" + rowIndex + "-D" + rowIndex + ")*24"); row.getCell(5).setCellStyle(duration);
                    }
                    cell(row, 6, text(session, "trainer"), normal);
                    cell(row, 7, text(session, "type"), normal);
                    cell(row, 8, text(session, "room"), normal);
                    cell(row, 9, text(session, "notes"), normal);
                    cell(row, 10, text(session, "staffType"), normal);
                    cell(row, 11, code, italic);
                    cell(row, 12, text(session, "topicVersion"), italic);
                    cell(row, 13, text(session, "trainingMaterials"), normal);
                }
                Row note = sheet.createRow(rowIndex++); note.setHeightInPoints(30);
                for (int i = 0; i < 14; i++) cell(note, i, "", normal);
                cell(note, 9, text(first, "notes"), normal);
            }
            if (groups.isEmpty()) cell(sheet.createRow(5), 1, "No detailed calendar data available for this version.", normal);
            int[] widths = { 7, 38, 28, 13, 13, 18, 24, 20, 24, 65, 20, 24, 18, 85 };
            for (int i = 0; i < widths.length; i++) sheet.setColumnWidth(i, widths[i] * 256);
            sheet.createFreezePane(2, 5);
            sheet.setAutoFilter(new CellRangeAddress(4, Math.max(5, rowIndex - 1), 0, 13));
            sheet.setDisplayGridlines(false);
            sheet.setRepeatingRows(new CellRangeAddress(4, 4, -1, -1));
            sheet.getPrintSetup().setLandscape(true);
            sheet.getPrintSetup().setPaperSize(PrintSetup.A3_PAPERSIZE);
            sheet.setFitToPage(true); sheet.getPrintSetup().setFitWidth((short) 1); sheet.getPrintSetup().setFitHeight((short) 0);
            workbook.getCreationHelper().createFormulaEvaluator().evaluateAll();
            workbook.write(bytes);
            return bytes.toByteArray();
        }
    }

    private static String text(JsonNode node, String field) { return node == null || node.path(field).isNull() ? "" : node.path(field).asText(""); }

    private static Double timeValue(String value) {
        try {
            String local = value.contains("T") ? value.substring(value.indexOf('T') + 1) : value;
            if (local.matches("\\d:\\d{2}")) local = "0" + local;
            return LocalTime.parse(local).toSecondOfDay() / 86400d;
        } catch (java.time.format.DateTimeParseException ignored) { return null; }
    }

    private static void cell(Row row, int index, String value, CellStyle style) {
        Cell cell = row.getCell(index) == null ? row.createCell(index) : row.getCell(index);
        cell.setCellValue(value); cell.setCellStyle(style);
    }

    private static CellStyle style(Workbook workbook, boolean bold, boolean italic, IndexedColors fill) {
        CellStyle style = workbook.createCellStyle();
        Font font = workbook.createFont(); font.setFontName("Calibri"); font.setFontHeightInPoints((short) 11);
        font.setBold(bold); font.setItalic(italic);
        if (fill == IndexedColors.GREY_50_PERCENT) font.setColor(IndexedColors.WHITE.getIndex());
        style.setFont(font); style.setWrapText(true); style.setVerticalAlignment(VerticalAlignment.CENTER);
        style.setBorderTop(BorderStyle.THIN); style.setBorderBottom(BorderStyle.THIN);
        style.setBorderLeft(BorderStyle.THIN); style.setBorderRight(BorderStyle.THIN);
        if (fill != null) { style.setFillForegroundColor(fill.getIndex()); style.setFillPattern(FillPatternType.SOLID_FOREGROUND); }
        return style;
    }
}
