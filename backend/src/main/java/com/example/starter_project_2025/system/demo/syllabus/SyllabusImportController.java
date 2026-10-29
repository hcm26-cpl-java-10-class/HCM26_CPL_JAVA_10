
package com.example.starter_project_2025.system.demo.syllabus;

import lombok.RequiredArgsConstructor;
import org.apache.poi.ss.usermodel.Cell;
import org.apache.poi.ss.usermodel.CellStyle;
import org.apache.poi.ss.usermodel.Font;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;

import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;

import org.springframework.security.access.prepost.PreAuthorize;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.io.ByteArrayOutputStream;
import java.io.IOException;

@RestController
@RequestMapping("/api/syllabuses")
@RequiredArgsConstructor
public class SyllabusImportController {

    private final SyllabusBundleImportService importService;

    private static final String IMPORT_PERMISSION =
            "hasAuthority('SYLLABUS_CREATE') and " +
                    "hasAuthority('SYLLABUS_UPDATE')";

    @PostMapping(
            value = "/import",
            consumes = MediaType.MULTIPART_FORM_DATA_VALUE
    )
    @PreAuthorize(IMPORT_PERMISSION)
    public SyllabusBundleImportService.ImportSummary importExcel(
            @RequestParam("file") MultipartFile file
    ) {
        return importService.importExcel(file);
    }

    @GetMapping("/import/template")
    @PreAuthorize(IMPORT_PERMISSION)
    public ResponseEntity<byte[]> downloadTemplate() {
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

            addSheet(
                    workbook,
                    headerStyle,
                    "LearningMaterials",
                    "Syllabus Code",
                    "Section Title",
                    "Topic Title",
                    "Title",
                    "Type",
                    "URL",
                    "Author",
                    "Publisher",
                    "Main Material",
                    "Note"
            );

            workbook.write(output);

            return ResponseEntity.ok()
                    .contentType(
                            MediaType.parseMediaType(
                                    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                            )
                    )
                    .header(
                            HttpHeaders.CONTENT_DISPOSITION,
                            "attachment; filename=\"syllabuses-template.xlsx\""
                    )
                    .header(
                            "Access-Control-Expose-Headers",
                            "Content-Disposition"
                    )
                    .body(output.toByteArray());

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
