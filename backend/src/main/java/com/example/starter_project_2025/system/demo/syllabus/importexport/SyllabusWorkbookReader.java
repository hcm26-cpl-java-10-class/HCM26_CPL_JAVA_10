package com.example.starter_project_2025.system.demo.syllabus.importexport;

import org.apache.poi.ss.usermodel.*;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;
import java.util.*;

/** Excel format and cell-validation operations shared by Syllabus import. */
public final class SyllabusWorkbookReader {
    private SyllabusWorkbookReader() {}

    private static ResponseStatusException bad(String message) {
        return new ResponseStatusException(HttpStatus.BAD_REQUEST, message);
    }

    public static Sheet requiredSheet(
            Workbook workbook,
            String name
    ) {
        Sheet sheet = workbook.getSheet(name);

        if (sheet == null) {
            throw bad("Missing sheet: " + name);
        }

        if (sheet.getLastRowNum() > 5000) {
            throw bad(
                    "Too many rows in sheet: " + name
            );
        }

        return sheet;
    }

    public static Map<String, Integer> headers(
            Sheet sheet,
            String... requiredColumns
    ) {
        Row headerRow = sheet.getRow(0);

        if (headerRow == null) {
            throw bad(
                    "Missing headers in " +
                            sheet.getSheetName()
            );
        }

        Map<String, Integer> result =
                new HashMap<>();

        DataFormatter formatter =
                new DataFormatter();

        for (Cell cell : headerRow) {
            result.put(
                    formatter.formatCellValue(cell).trim(),
                    cell.getColumnIndex()
            );
        }

        for (String column : requiredColumns) {
            if (!result.containsKey(column)) {
                throw bad(
                        "Missing column: " + column
                );
            }
        }

        return result;
    }

    public static String value(
            Row row,
            Map<String, Integer> headers,
            String name
    ) {
        Integer index = headers.get(name);

        if (index == null) {
            return "";
        }

        Cell cell = row.getCell(
                index,
                Row.MissingCellPolicy.RETURN_BLANK_AS_NULL
        );

        if (cell == null) {
            return "";
        }

        if (cell.getCellType() == CellType.FORMULA) {
            throw bad(
                    "Excel formulas are not allowed"
            );
        }

        return new DataFormatter()
                .formatCellValue(cell)
                .strip();
    }

    public static String required(
            Row row,
            Map<String, Integer> headers,
            String name
    ) {
        String result = value(
                row,
                headers,
                name
        );

        if (result.isBlank()) {
            throw bad(
                    name + " is required"
            );
        }

        return result;
    }

    public static Integer number(
            Row row,
            Map<String, Integer> headers,
            String name,
            boolean optional
    ) {
        String result = value(
                row,
                headers,
                name
        );

        if (result.isBlank() && optional) {
            return null;
        }

        try {
            return Integer.valueOf(result);
        } catch (NumberFormatException exception) {
            throw bad(
                    name + " must be an integer"
            );
        }
    }

    public static boolean yes(
            Row row,
            Map<String, Integer> headers,
            String name
    ) {
        String result = value(
                row,
                headers,
                name
        );

        if (result.equalsIgnoreCase("TRUE")
                || result.equalsIgnoreCase("YES")
                || result.equals("1")) {
            return true;
        }

        if (result.isBlank()
                || result.equalsIgnoreCase("FALSE")
                || result.equalsIgnoreCase("NO")
                || result.equals("0")) {
            return false;
        }

        throw bad(
                name + " must be TRUE or FALSE"
        );
    }
}
