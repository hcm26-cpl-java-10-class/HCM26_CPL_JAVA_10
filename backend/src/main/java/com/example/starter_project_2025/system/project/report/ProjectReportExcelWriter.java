package com.example.starter_project_2025.system.project.report;

import lombok.RequiredArgsConstructor;
import org.apache.poi.ss.usermodel.*;
import org.apache.poi.ss.util.CellRangeAddress;
import org.apache.poi.xssf.usermodel.XSSFCellStyle;
import org.apache.poi.xssf.usermodel.XSSFColor;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.stereotype.Component;

import java.io.ByteArrayOutputStream;
import java.time.Instant;
import java.time.LocalDateTime;
import java.util.Comparator;
import java.util.HashMap;
import java.util.Map;

import static com.example.starter_project_2025.system.project.report.ProjectReportDtos.*;

/** Workbook layout belongs to Reports; the shared exporter keeps its existing contract. */
@Component
@RequiredArgsConstructor
public class ProjectReportExcelWriter {
    static final int HEADER_ROW = 5;
    private final ProjectReportSettings settings;

    public byte[] write(ProjectReportService.Snapshot snapshot) throws Exception {
        try (var book = new XSSFWorkbook(); var output = new ByteArrayOutputStream()) {
            var layout = new Layout(book, snapshot.asOf());
            var projects = snapshot.matching().stream().sorted(Comparator.comparing(SubProject::className)
                    .thenComparing(SubProject::masterCode).thenComparing(SubProject::depth).thenComparing(SubProject::code)).toList();
            var detail = layout.sheet();
            for (var project : projects) {
                layout.row(detail, project.className(), team(project), identity(project.masterCode(), project.masterName()),
                        part(project), projectStatus(project.status()), mentor(project),
                        project.milestones().isEmpty() ? "Chưa có milestone" : project.acceptedMilestones() + "/" + project.milestones().size() + " được chấp nhận");
            }
            layout.finish(detail);
            book.setActiveSheet(0);
            book.write(output);
            return output.toByteArray();
        }
    }

    private static String identity(String code, String name) { return code + "\n" + name; }
    private static String part(SubProject project) {
        return project.parentProjectId() == null ? "Phần việc trực tiếp Master" : identity(project.code(), project.name());
    }
    private static String team(SubProject project) { return project.teamName() == null ? "Dùng chung trong Master" : project.teamName(); }
    private static String mentor(SubProject project) {
        return project.mentorName() != null ? project.mentorName() : project.teamId() == null ? "Theo từng Sub-project" : "Chưa phân công";
    }
    private static String projectStatus(Status status) {
        return switch (status) {
            case DRAFT -> "Bản nháp"; case PLANNING -> "Lên kế hoạch"; case ACTIVE -> "Đang triển khai";
            case COMPLETED -> "Hoàn thành"; case CANCELLED -> "Đã hủy";
        };
    }
    private final class Layout {
        private final XSSFWorkbook book;
        private final Instant asOf;
        private final XSSFCellStyle title, context, header, text, alternate, date;
        private final Map<String, CellStyle> states = new HashMap<>();

        Layout(XSSFWorkbook book, Instant asOf) {
            this.book = book; this.asOf = asOf;
            text = style("26344A", false, 10);
            text.setWrapText(true);
            alternate = copy(text); fill(alternate, "F3F6FA");
            title = style("183B69", true, 15);
            context = style("64748B", false, 10);
            header = style("FFFFFF", true, 10); fill(header, "24476B");
            header.setWrapText(true); header.setAlignment(HorizontalAlignment.CENTER);
            header.setBorderRight(BorderStyle.THIN); header.setRightBorderColor(IndexedColors.WHITE.getIndex());
            date = copy(text); date.setDataFormat(book.createDataFormat().getFormat("dd/mm/yyyy hh:mm"));
            state("Đang triển khai", "DBEAFE", "1D4ED8"); state("Hoàn thành", "DCFCE7", "166534");
            state("Lên kế hoạch", "EDE9FE", "6D28D9");
            state("Đã hủy", "FEE2E2", "991B1B");
        }

        Sheet sheet() {
            String[] columns = {"Lớp", "Nhóm phụ trách", "Master Project", "Sub-project", "Trạng thái", "Mentor", "Tiến độ milestone"};
            int[] widths = {25, 25, 38, 38, 22, 25, 28};
            var sheet = book.createSheet("Tiến độ dự án");
            sheet.setDisplayGridlines(false); sheet.setZoom(100);
            var headingRow = sheet.createRow(1); headingRow.setHeightInPoints(25);
            cell(headingRow, 0, "PHÂN CÔNG VÀ TIẾN ĐỘ DỰ ÁN", title);
            var timeRow = sheet.createRow(2); timeRow.setHeightInPoints(22);
            cell(timeRow, 0, "Dữ liệu lúc", context); cell(timeRow, 1, asOf, date); cell(timeRow, 2, settings.getTimeZone(), context);
            var scopeRow = sheet.createRow(3); scopeRow.setHeightInPoints(20);
            cell(scopeRow, 0, "Dữ liệu theo bộ lọc trên Dashboard và phạm vi được phép xem.", context);
            var note = sheet.createRow(4); note.setHeightInPoints(22);
            cell(note, 0, "Milestone: số được chấp nhận / tổng số của từng Project; không suy ra từ số backlog đã Done.", context);
            var row = sheet.createRow(HEADER_ROW); row.setHeightInPoints(44);
            for (int column = 0; column < columns.length; column++) {
                sheet.setColumnWidth(column, widths[column] * 256);
                cell(row, column, columns[column], header);
            }
            sheet.createFreezePane(2, HEADER_ROW + 1);
            sheet.setAutobreaks(true); sheet.setFitToPage(true);
            var print = sheet.getPrintSetup(); print.setLandscape(true); print.setPaperSize(PrintSetup.A4_PAPERSIZE); print.setFitWidth((short) 1); print.setFitHeight((short) 0);
            sheet.setRepeatingRows(new CellRangeAddress(HEADER_ROW, HEADER_ROW, -1, -1));
            sheet.getFooter().setRight("Trang &P / &N");
            return sheet;
        }

        void row(Sheet sheet, String... values) {
            var row = sheet.createRow(sheet.getLastRowNum() + 1);
            boolean tinted = (row.getRowNum() - HEADER_ROW) % 2 == 0;
            int lines = 1;
            for (int column = 0; column < values.length; column++) {
                String value = values[column];
                CellStyle style = tinted ? alternate : text;
                if (value != null) {
                    // Only lifecycle columns use status colors; project names can equal a status label.
                    if (column == 4) style = states.getOrDefault(value, style);
                    int capacity = Math.max(1, sheet.getColumnWidth(column) / 256 - 2);
                    int wrapped = 0;
                    for (String segment : value.split("\n", -1)) wrapped += Math.max(1, (segment.length() + capacity - 1) / capacity);
                    lines = Math.max(lines, wrapped);
                }
                cell(row, column, value, style);
            }
            row.setHeightInPoints(Math.max(32, lines * 14 + 10));
        }

        void finish(Sheet sheet) {
            int columns = sheet.getRow(HEADER_ROW).getLastCellNum();
            if (sheet.getLastRowNum() == HEADER_ROW) {
                var row = sheet.createRow(HEADER_ROW + 1); row.setHeightInPoints(28);
                cell(row, 0, "Không có dữ liệu phù hợp.", context);
            } else sheet.setAutoFilter(new CellRangeAddress(HEADER_ROW, sheet.getLastRowNum(), 0, columns - 1));
            book.setPrintArea(book.getSheetIndex(sheet), 0, columns - 1, 0, sheet.getLastRowNum());
        }

        private void cell(Row row, int column, Object value, CellStyle style) {
            var cell = row.createCell(column); cell.setCellStyle(style);
            if (value instanceof Number numeric) cell.setCellValue(numeric.doubleValue());
            else if (value instanceof Instant instant) cell.setCellValue(LocalDateTime.ofInstant(instant, settings.zone()));
            else if (value != null) cell.setCellValue(value.toString());
        }
        private XSSFCellStyle style(String color, boolean bold, int size) {
            var font = book.createFont(); font.setFontName("Arial"); font.setFontHeightInPoints((short) size); font.setBold(bold); font.setColor(color(color));
            var style = book.createCellStyle(); style.setFont(font); style.setVerticalAlignment(VerticalAlignment.CENTER);
            return style;
        }
        private XSSFCellStyle copy(CellStyle source) { var style = book.createCellStyle(); style.cloneStyleFrom(source); return style; }
        private void fill(XSSFCellStyle style, String color) { style.setFillForegroundColor(color(color)); style.setFillPattern(FillPatternType.SOLID_FOREGROUND); }
        private void state(String label, String background, String foreground) {
            var style = style(foreground, true, 10); style.setWrapText(true); fill(style, background); states.put(label, style);
        }
        private XSSFColor color(String hex) { return new XSSFColor(java.util.HexFormat.of().parseHex(hex), null); }
    }
}
