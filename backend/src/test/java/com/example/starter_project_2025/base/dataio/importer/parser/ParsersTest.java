package com.example.starter_project_2025.base.dataio.importer.parser;

import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.junit.jupiter.api.Test;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

/** The files an administrator really uploads: numbers, empty rows, spaces in headers, Excel's CSV. */
class ParsersTest {

    private static byte[] workbook(java.util.function.Consumer<Sheet> filler) throws Exception {
        try (XSSFWorkbook workbook = new XSSFWorkbook(); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            filler.accept(workbook.createSheet("Users"));
            workbook.write(out);
            return out.toByteArray();
        }
    }

    @Test
    void excel_numbersComeOutAsPlainText_headersAreTrimmed_emptyRowsAreSkipped_rowNumbersStayTrue() throws Exception {
        byte[] file = workbook(sheet -> {
            Row header = sheet.createRow(0);
            header.createCell(0).setCellValue("Email ");   // trailing space
            header.createCell(1).setCellValue("Phone");
            header.createCell(2).setCellValue("Password");

            Row first = sheet.createRow(1);
            first.createCell(0).setCellValue("a@example.com");
            first.createCell(1).setCellValue(901234567d);    // a phone number typed as a number
            first.createCell(2).setCellValue(12345678d);     // a numeric password

            sheet.createRow(2);                               // formatted but empty row
            // row index 3 does not exist at all (null row)

            Row last = sheet.createRow(4);
            last.createCell(0).setCellValue("  b@example.com  ");
        });

        List<Map<String, String>> rows = new ExcelParser().parse(new ByteArrayInputStream(file));

        assertEquals(2, rows.size());

        Map<String, String> first = rows.get(0);
        assertEquals("a@example.com", first.get("Email"));       // header "Email " matched "Email"
        assertEquals("901234567", first.get("Phone"));           // not "9.01234567E8" or "901234567.0"
        assertEquals("12345678", first.get("Password"));
        assertEquals("2", first.get(FileParser.ROW_NUMBER_KEY)); // Excel row 2

        Map<String, String> second = rows.get(1);
        assertEquals("b@example.com", second.get("Email"));      // trimmed
        assertNull(second.get("Phone"));
        assertEquals("5", second.get(FileParser.ROW_NUMBER_KEY)); // Excel row 5, even though rows 3-4 were empty
        assertEquals(5, FileParser.rowNumberOf(second, 99));
    }

    @Test
    void excel_decimalsKeepTheirDecimals() throws Exception {
        byte[] file = workbook(sheet -> {
            sheet.createRow(0).createCell(0).setCellValue("Score");
            sheet.createRow(1).createCell(0).setCellValue(7.5d);
        });

        assertEquals("7.5", new ExcelParser().parse(new ByteArrayInputStream(file)).get(0).get("Score"));
    }

    @Test
    void excel_fileNameIsMatchedIgnoringCase() {
        assertTrue(new ExcelParser().supports("Users.XLSX"));
        assertFalse(new ExcelParser().supports("users.csv"));
        assertTrue(new CsvParser().supports("USERS.CSV"));
    }

    @Test
    void csv_excelsHiddenByteOrderMarkDoesNotBreakTheFirstHeader() {
        String csv = "\uFEFFEmail,Password\r\na@example.com,Abc12345\r\n,\r\n\r\nb@example.com,\r\n";

        List<Map<String, String>> rows = new CsvParser().parse(
                new ByteArrayInputStream(csv.getBytes(StandardCharsets.UTF_8)));

        assertEquals(2, rows.size());                       // the empty lines are not rows
        assertEquals("a@example.com", rows.get(0).get("Email"));
        assertEquals("Abc12345", rows.get(0).get("Password"));
        assertEquals("2", rows.get(0).get(FileParser.ROW_NUMBER_KEY));
        assertEquals("5", rows.get(1).get(FileParser.ROW_NUMBER_KEY));
    }
}
