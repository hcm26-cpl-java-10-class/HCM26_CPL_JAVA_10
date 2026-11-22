package com.example.starter_project_2025.system.demo.syllabus.importexport;

import org.apache.poi.ss.usermodel.*;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;
import java.io.ByteArrayOutputStream;
import java.io.IOException;

/** Generates the existing five-sheet XLSX template without HTTP concerns. */
@Service
public class SyllabusImportTemplateService {
    public byte[] generate() {
        try (
                XSSFWorkbook workbook = new XSSFWorkbook();
                ByteArrayOutputStream output =
                        new ByteArrayOutputStream()
        ) {
            CellStyle headerStyle =
                    workbook.createCellStyle();

            Font headerFont = workbook.createFont();
            headerFont.setBold(true);

            headerStyle.setFont(headerFont);

            addSheet(
                    workbook,
                    headerStyle,
                    "Syllabuses",
                    "Code",
                    "Name",
                    "Description",
                    "Teaching Methods",
                    "Degree Level",
                    "Time Allocation",
                    "Student Responsibilities",
                    "Required Tools",
                    "Scoring Scale"
            );

            addSheet(
                    workbook,
                    headerStyle,
                    "CLOs",
                    "Syllabus Code",
                    "CLO Code",
                    "Details",
                    "Order Index"
            );

            addSheet(
                    workbook,
                    headerStyle,
                    "Sections",
                    "Syllabus Code",
                    "Section Title",
                    "Order Index",
                    "Mission"
            );

            addSheet(
                    workbook,
                    headerStyle,
                    "Topics",
                    "Syllabus Code",
                    "Section Title",
                    "Topic Title",
                    "Order Index"
            );

            workbook.write(output);

            return output.toByteArray();

        } catch (IOException exception) {
            throw new ResponseStatusException(
                    HttpStatus.INTERNAL_SERVER_ERROR,
                    "Could not generate Syllabus template",
                    exception
            );
        }
    }

    private static void addSheet(
            XSSFWorkbook workbook,
            CellStyle style,
            String name,
            String... headers
    ) {
        Sheet sheet = workbook.createSheet(name);
        Row row = sheet.createRow(0);

        for (int index = 0; index < headers.length; index++) {
            Cell cell = row.createCell(index);

            cell.setCellValue(headers[index]);
            cell.setCellStyle(style);

            sheet.setColumnWidth(index, 7000);
        }

        sheet.createFreezePane(0, 1);
    }
}
