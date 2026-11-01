package com.example.starter_project_2025.base.dataio.util;

import org.apache.poi.ss.usermodel.CellStyle;
import org.apache.poi.ss.usermodel.DataValidation;
import org.apache.poi.ss.usermodel.DataValidationConstraint;
import org.apache.poi.ss.usermodel.DataValidationHelper;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.ss.usermodel.SheetVisibility;
import org.apache.poi.ss.usermodel.Workbook;
import org.apache.poi.ss.util.CellRangeAddressList;
import org.apache.poi.ss.util.CellReference;

import java.util.List;

/**
 * Adds input helpers to columns of a generated Excel sheet: a date column that only accepts real
 * dates, and a column with a drop-down list of the values that exist in the system.
 */
public final class ExcelSheetDecorator {

    /** Data validation covers the rows below the header, up to this row number. */
    public static final int LAST_ROW = 10_000;

    private static final String LISTS_SHEET = "Lists";

    private ExcelSheetDecorator() {
    }

    /** Cell style that shows a date as yyyy-mm-dd, whatever the regional settings of the computer. */
    public static CellStyle dateStyle(Workbook workbook) {
        CellStyle style = workbook.createCellStyle();
        style.setDataFormat(workbook.getCreationHelper().createDataFormat().getFormat("yyyy-mm-dd"));
        return style;
    }

    /** Empty cells of the column get the date format, and anything that is not a real date is refused. */
    public static void applyDateColumn(Sheet sheet, int column, CellStyle dateStyle, String header) {
        sheet.setDefaultColumnStyle(column, dateStyle);
        sheet.setColumnWidth(column, 16 * 256);

        DataValidationHelper helper = sheet.getDataValidationHelper();
        // 1 = 1900-01-01 in Excel's date numbering; TODAY() keeps the upper limit current every day.
        DataValidationConstraint constraint = helper.createDateConstraint(
                DataValidationConstraint.OperatorType.BETWEEN, "1", "TODAY()", "yyyy-mm-dd");

        DataValidation validation = helper.createValidation(
                constraint, new CellRangeAddressList(1, LAST_ROW, column, column));
        validation.setShowErrorBox(true);
        validation.setErrorStyle(DataValidation.ErrorStyle.STOP);
        validation.createErrorBox("Invalid date",
                "Enter a real date from 1900-01-01 up to today, for example 2000-01-31.");
        validation.setShowPromptBox(true);
        validation.createPromptBox(truncate(header, 32), "Enter a date as yyyy-mm-dd, for example 2000-01-31.");
        sheet.addValidationData(validation);
    }

    /**
     * Adds a drop-down to the column. The values are written to a hidden sheet, so the list can be as long
     * as needed. Several values are typed in one cell separated by commas, which is what the import reads,
     * so the cell is not restricted to the list.
     *
     * @param allowMultiple true: the cell may hold several comma-separated values; false: only one value from the list
     * @param listColumn the column of the hidden sheet that holds this list (use a different one per column)
     */
    public static void applyOptionsColumn(Workbook workbook, Sheet sheet, int column, String header,
                                          List<String> options, int listColumn, boolean allowMultiple) {
        sheet.setColumnWidth(column, 28 * 256);
        if (options == null || options.isEmpty()) {
            return;
        }

        Sheet lists = workbook.getSheet(LISTS_SHEET);
        if (lists == null) {
            lists = workbook.createSheet(LISTS_SHEET);
            workbook.setSheetVisibility(workbook.getSheetIndex(lists), SheetVisibility.HIDDEN);
        }
        for (int i = 0; i < options.size(); i++) {
            Row row = lists.getRow(i);
            if (row == null) {
                row = lists.createRow(i);
            }
            row.createCell(listColumn).setCellValue(options.get(i));
        }

        String col = CellReference.convertNumToColString(listColumn);
        String reference = LISTS_SHEET + "!$" + col + "$1:$" + col + "$" + options.size();

        DataValidationHelper helper = sheet.getDataValidationHelper();
        DataValidation validation = helper.createValidation(
                helper.createFormulaListConstraint(reference),
                new CellRangeAddressList(1, LAST_ROW, column, column));
        validation.setSuppressDropDownArrow(true); // POI naming: true keeps the arrow visible
        validation.setShowErrorBox(!allowMultiple); // multi: allow "A,B"; single: refuse anything not in the list
        if (!allowMultiple) {
            validation.setErrorStyle(DataValidation.ErrorStyle.STOP);
            validation.createErrorBox("Invalid value", "Pick one value from the list.");
        }
        validation.setShowPromptBox(true);
        validation.createPromptBox(truncate(header, 32), allowMultiple
                ? "Pick a value from the list. For more than one, type them separated by commas."
                : "Pick a value from the list.");
        sheet.addValidationData(validation);
    }

    private static String truncate(String text, int max) {
        return text.length() <= max ? text : text.substring(0, max);
    }
}
