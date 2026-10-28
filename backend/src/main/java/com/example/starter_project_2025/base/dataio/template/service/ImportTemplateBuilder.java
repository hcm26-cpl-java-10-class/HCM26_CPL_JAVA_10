package com.example.starter_project_2025.base.dataio.template.service;

import com.example.starter_project_2025.base.dataio.importer.annotation.ImportField;
import org.apache.poi.ss.usermodel.BorderStyle;
import org.apache.poi.ss.usermodel.Cell;
import org.apache.poi.ss.usermodel.CellStyle;
import org.apache.poi.ss.usermodel.ClientAnchor;
import org.apache.poi.ss.usermodel.Comment;
import org.apache.poi.ss.usermodel.CreationHelper;
import org.apache.poi.ss.usermodel.DataValidation;
import org.apache.poi.ss.usermodel.DataValidationConstraint;
import org.apache.poi.ss.usermodel.DataValidationHelper;
import org.apache.poi.ss.usermodel.Drawing;
import org.apache.poi.ss.usermodel.FillPatternType;
import org.apache.poi.ss.usermodel.Font;
import org.apache.poi.ss.usermodel.HorizontalAlignment;
import org.apache.poi.ss.usermodel.IndexedColors;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.ss.usermodel.VerticalAlignment;
import org.apache.poi.ss.usermodel.Workbook;
import org.apache.poi.ss.util.CellRangeAddressList;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;

import java.io.ByteArrayOutputStream;
import java.lang.reflect.Field;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

/**
 * Renders an import template workbook from the columns a module declares.
 * <p>
 * Sheet {@value #IMPORT_SHEET} is the file the importer reads: row 0 holds the
 * column headers and every following row is data, so only the header row is
 * written. The column documentation is attached as cell comments and fixed
 * value lists become dropdown validations, which keeps the file importable while
 * telling the user what the backend accepts.
 * <p>
 * Sheet {@value #GUIDE_SHEET} is documentation only (the parsers always read the
 * first sheet) and repeats every column with its required flag, accepted values,
 * note and sample value, followed by the business rules of the entity.
 * <p>
 * Usage: a module builds its template inside its own package, e.g.
 * <pre>{@code
 * ImportTemplateBuilder.forEntity(Sprint.class, "Sprint")
 *         .column(ImportTemplateColumn.text("Name", true, "Duy nhất", "Sprint 1"))
 *         .rule("Sprint Name không được trùng")
 *         .build();
 * }</pre>
 * {@link #build()} fails when the declared columns and the {@code @ImportField}
 * headers of the entity diverge, so a template can never drift from the import
 * format.
 */
public final class ImportTemplateBuilder {

    private static final String IMPORT_SHEET = "Import";
    private static final String GUIDE_SHEET = "Hướng dẫn";

    private static final int HEADER_ROW = 0;
    /** Rows covered by the dropdown validation (far more than a realistic file). */
    private static final int LAST_VALIDATED_ROW = 1000;
    private static final int COLUMN_WIDTH_UNIT = 256;
    private static final int MIN_COLUMN_WIDTH = 16;
    private static final int MAX_COLUMN_WIDTH = 60;

    private final Class<?> entityClass;
    private final String label;
    private final List<ImportTemplateColumn> columns = new ArrayList<>();
    private final List<String> rules = new ArrayList<>();

    private ImportTemplateBuilder(Class<?> entityClass, String label) {
        this.entityClass = entityClass;
        this.label = label;
    }

    public static ImportTemplateBuilder forEntity(Class<?> entityClass, String label) {
        return new ImportTemplateBuilder(entityClass, label);
    }

    public ImportTemplateBuilder column(ImportTemplateColumn column) {
        columns.add(column);
        return this;
    }

    public ImportTemplateBuilder rule(String... rules) {
        this.rules.addAll(Arrays.asList(rules));
        return this;
    }

    public byte[] build() {

        validateColumns();

        try (Workbook workbook = new XSSFWorkbook()) {

            Styles styles = new Styles(workbook);

            writeImportSheet(workbook, styles);
            writeGuideSheet(workbook, styles);

            workbook.setActiveSheet(0);

            ByteArrayOutputStream out = new ByteArrayOutputStream();
            workbook.write(out);

            return out.toByteArray();

        } catch (Exception e) {
            throw new RuntimeException("Failed to generate template for " + label, e);
        }
    }

    // ---------------------------------------------------------------------
    // Import sheet (the file the importer reads)
    // ---------------------------------------------------------------------

    private void writeImportSheet(Workbook workbook, Styles styles) {

        Sheet sheet = workbook.createSheet(IMPORT_SHEET);

        Row headerRow = sheet.createRow(HEADER_ROW);

        CreationHelper helper = workbook.getCreationHelper();
        Drawing<?> drawing = sheet.createDrawingPatriarch();
        DataValidationHelper validation = sheet.getDataValidationHelper();

        for (int index = 0; index < columns.size(); index++) {

            ImportTemplateColumn column = columns.get(index);

            Cell cell = headerRow.createCell(index);
            cell.setCellValue(column.name());
            cell.setCellStyle(column.required() ? styles.requiredHeader : styles.optionalHeader);
            cell.setCellComment(createComment(helper, drawing, index, commentText(column)));

            if (!column.options().isEmpty()) {
                addDropdownValidation(validation, sheet, index, column);
            }

            if (isDateTimeColumn(column)) {
                // Keep the ISO 8601 text the importer expects: an Excel date
                // value would be reformatted with the locale of the reader.
                sheet.setDefaultColumnStyle(index, styles.text);
            }

            sheet.setColumnWidth(index, columnWidth(column.name()));
        }

        sheet.createFreezePane(0, 1);
    }

    private Comment createComment(CreationHelper helper,
                                  Drawing<?> drawing,
                                  int column,
                                  String text) {

        ClientAnchor anchor = helper.createClientAnchor();
        anchor.setCol1(column);
        anchor.setCol2(column + 4);
        anchor.setRow1(HEADER_ROW);
        anchor.setRow2(HEADER_ROW + 6);

        Comment comment = drawing.createCellComment(anchor);
        comment.setString(helper.createRichTextString(text));
        comment.setAuthor("Import template");

        return comment;
    }

    private void addDropdownValidation(DataValidationHelper helper,
                                       Sheet sheet,
                                       int columnIndex,
                                       ImportTemplateColumn column) {

        String[] values = column.options().toArray(String[]::new);

        DataValidationConstraint constraint = helper.createExplicitListConstraint(values);
        CellRangeAddressList range =
                new CellRangeAddressList(HEADER_ROW + 1, LAST_VALIDATED_ROW, columnIndex, columnIndex);

        DataValidation dataValidation = helper.createValidation(constraint, range);
        dataValidation.setShowErrorBox(true);
        dataValidation.setErrorStyle(DataValidation.ErrorStyle.STOP);
        dataValidation.setSuppressDropDownArrow(true);
        dataValidation.createErrorBox(
                "Giá trị không hợp lệ",
                "Chỉ chấp nhận: " + String.join(", ", values));

        dataValidation.setShowPromptBox(true);
        dataValidation.createPromptBox(
                "Giá trị hợp lệ",
                "Chọn một trong: " + String.join(", ", values));

        sheet.addValidationData(dataValidation);
    }

    // ---------------------------------------------------------------------
    // Guide sheet (documentation, never read by the importer)
    // ---------------------------------------------------------------------

    private void writeGuideSheet(Workbook workbook, Styles styles) {

        Sheet sheet = workbook.createSheet(GUIDE_SHEET);

        int rowIndex = 0;

        Row titleRow = sheet.createRow(rowIndex++);
        createCell(titleRow, 0, "Hướng dẫn nhập dữ liệu – " + label, styles.guideTitle);

        Row introRow = sheet.createRow(rowIndex++);
        createCell(introRow, 0,
                "Nhập dữ liệu vào sheet \"" + IMPORT_SHEET + "\" và giữ nguyên tên cột ở dòng đầu tiên. "
                        + "Mọi dòng nằm dưới dòng tiêu đề đều được đọc khi import, nên không thêm dòng ghi chú "
                        + "hoặc dòng có dữ liệu vào sheet này.",
                styles.guideText);

        rowIndex++;

        String[] headers = {
                "Cột",
                "Bắt buộc",
                "Kiểu dữ liệu",
                "Giá trị hợp lệ / Định dạng",
                "Ghi chú",
                "Ví dụ"
        };

        Row headerRow = sheet.createRow(rowIndex++);
        for (int column = 0; column < headers.length; column++) {
            createCell(headerRow, column, headers[column], styles.guideHeader);
        }

        for (ImportTemplateColumn column : columns) {
            Row row = sheet.createRow(rowIndex++);

            createCell(row, 0, column.name(), styles.guideText);
            createCell(row, 1, column.required() ? "Có" : "Không", styles.guideText);
            createCell(row, 2, column.typeLabel(), styles.guideText);
            createCell(row, 3, column.allowedValues(), styles.guideText);
            createCell(row, 4, column.note(), styles.guideText);
            createCell(row, 5, column.example(), styles.guideText);
        }

        if (!rules.isEmpty()) {

            rowIndex++;

            Row rulesTitle = sheet.createRow(rowIndex++);
            createCell(rulesTitle, 0,
                    "Quy tắc dữ liệu (backend kiểm tra khi import)", styles.guideHeader);

            for (String rule : rules) {
                Row ruleRow = sheet.createRow(rowIndex++);
                createCell(ruleRow, 0, "• " + rule, styles.guideText);
            }
        }

        int[] widths = {24, 12, 18, 44, 52, 34};
        for (int i = 0; i < widths.length; i++) {
            sheet.setColumnWidth(i, widths[i] * COLUMN_WIDTH_UNIT);
        }
    }

    // ---------------------------------------------------------------------
    // Column documentation
    // ---------------------------------------------------------------------

    private String commentText(ImportTemplateColumn column) {

        StringBuilder comment = new StringBuilder();

        comment.append(column.required() ? "BẮT BUỘC" : "Không bắt buộc");
        comment.append(" · ").append(column.typeLabel());

        if (!"-".equals(column.allowedValues())) {
            comment.append("\nGiá trị: ").append(column.allowedValues());
        }

        if (!column.note().isBlank()) {
            comment.append("\n").append(column.note());
        }

        if (!column.example().isBlank()) {
            comment.append("\nVí dụ: ").append(column.example());
        }

        return comment.toString();
    }

    // ---------------------------------------------------------------------
    // Helpers
    // ---------------------------------------------------------------------

    /**
     * A template is only useful when it is importable: the declared columns and
     * the {@code @ImportField} headers of the entity must be identical.
     */
    private void validateColumns() {

        Set<String> importable = new LinkedHashSet<>();
        for (Field field : entityClass.getDeclaredFields()) {
            ImportField meta = field.getAnnotation(ImportField.class);
            if (meta != null) {
                importable.add(meta.name());
            }
        }

        Set<String> declared = new LinkedHashSet<>();
        for (ImportTemplateColumn column : columns) {
            if (!declared.add(column.name())) {
                throw new IllegalStateException(
                        "Duplicate import template column '" + column.name() + "' for " + label);
            }
        }

        Set<String> unknown = new LinkedHashSet<>(declared);
        unknown.removeAll(importable);
        if (!unknown.isEmpty()) {
            throw new IllegalStateException(
                    "Template column(s) " + unknown + " are not @ImportField columns of "
                            + entityClass.getSimpleName());
        }

        Set<String> missing = new LinkedHashSet<>(importable);
        missing.removeAll(declared);
        if (!missing.isEmpty()) {
            throw new IllegalStateException(
                    "Missing template column(s) " + missing + " of " + entityClass.getSimpleName());
        }
    }

    private boolean isDateTimeColumn(ImportTemplateColumn column) {
        return column.typeLabel().startsWith("Ngày giờ");
    }

    private int columnWidth(String header) {
        int width = Math.max(MIN_COLUMN_WIDTH, header.length() + 6);
        return Math.min(MAX_COLUMN_WIDTH, width) * COLUMN_WIDTH_UNIT;
    }

    private void createCell(Row row, int column, String value, CellStyle style) {
        Cell cell = row.createCell(column);
        cell.setCellValue(value);
        cell.setCellStyle(style);
    }

    /**
     * Styles are shared by both sheets of the workbook; the data sheet itself
     * stays a plain grid so the importer never sees formatted values.
     */
    private static final class Styles {

        private final CellStyle requiredHeader;
        private final CellStyle optionalHeader;
        private final CellStyle text;
        private final CellStyle guideTitle;
        private final CellStyle guideHeader;
        private final CellStyle guideText;

        private Styles(Workbook workbook) {

            Font bold = workbook.createFont();
            bold.setBold(true);

            requiredHeader = workbook.createCellStyle();
            requiredHeader.setFont(bold);
            requiredHeader.setWrapText(true);
            requiredHeader.setAlignment(HorizontalAlignment.CENTER);
            requiredHeader.setVerticalAlignment(VerticalAlignment.CENTER);
            requiredHeader.setFillPattern(FillPatternType.SOLID_FOREGROUND);
            requiredHeader.setFillForegroundColor(IndexedColors.LEMON_CHIFFON.getIndex());
            requiredHeader.setBorderBottom(BorderStyle.THIN);
            requiredHeader.setBorderTop(BorderStyle.THIN);
            requiredHeader.setBorderLeft(BorderStyle.THIN);
            requiredHeader.setBorderRight(BorderStyle.THIN);

            optionalHeader = workbook.createCellStyle();
            optionalHeader.cloneStyleFrom(requiredHeader);
            optionalHeader.setFillForegroundColor(IndexedColors.GREY_25_PERCENT.getIndex());

            text = workbook.createCellStyle();
            text.setDataFormat(workbook.createDataFormat().getFormat("@"));

            Font titleFont = workbook.createFont();
            titleFont.setBold(true);
            titleFont.setFontHeightInPoints((short) 14);

            guideTitle = workbook.createCellStyle();
            guideTitle.setFont(titleFont);

            guideHeader = workbook.createCellStyle();
            guideHeader.setFont(bold);
            guideHeader.setWrapText(true);
            guideHeader.setVerticalAlignment(VerticalAlignment.CENTER);
            guideHeader.setFillPattern(FillPatternType.SOLID_FOREGROUND);
            guideHeader.setFillForegroundColor(IndexedColors.GREY_25_PERCENT.getIndex());
            guideHeader.setBorderBottom(BorderStyle.THIN);

            guideText = workbook.createCellStyle();
            guideText.setWrapText(true);
            guideText.setVerticalAlignment(VerticalAlignment.TOP);
            guideText.setDataFormat(workbook.createDataFormat().getFormat("@"));
        }
    }
}
