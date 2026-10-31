
package com.example.starter_project_2025.system.trainingprogram;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.apache.poi.hssf.usermodel.HSSFWorkbook;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.ss.usermodel.Workbook;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Locale;
import java.util.Map;

@RestController
@RequestMapping("/api/programs")
@RequiredArgsConstructor
public class TrainingProgramController {

    private final TrainingProgramService service;
    private final TrainingProgramImportService importService;

    @GetMapping
    public ResponseEntity<Page<TrainingProgramResponse>> findAll(
            @RequestParam(required = false) String search,
            @RequestParam(required = false) ProgramStatus status,
            @RequestParam(required = false) String region,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size,
            @RequestParam(defaultValue = "id,desc") String sort) {

        if (page < 0 || size < 1 || size > 200) {
            throw new IllegalArgumentException("Invalid page or size.");
        }

        if (search != null && search.length() > 200) {
            throw new IllegalArgumentException(
                    "Search must be at most 200 characters."
            );
        }

        if (region != null && region.length() > 100) {
            throw new IllegalArgumentException(
                    "Region must be at most 100 characters."
            );
        }

        String[] sortParts = sort.split(",", 2);

        String property = List.of(
                "id", "code", "name", "version", "region", "status"
        ).contains(sortParts[0]) ? sortParts[0] : "id";

        Sort.Direction direction =
                sortParts.length > 1
                        && "asc".equalsIgnoreCase(sortParts[1])
                        ? Sort.Direction.ASC
                        : Sort.Direction.DESC;

        Sort sortOrder = Sort.by(direction, property);

        if (!"id".equals(property)) {
            sortOrder = sortOrder.and(
                    Sort.by(Sort.Direction.DESC, "id")
            );
        }

        Pageable pageable = PageRequest.of(page, size, sortOrder);

        return ResponseEntity.ok(
                service.findPage(search, status, region, pageable)
        );
    }

    @GetMapping("/regions")
    public ResponseEntity<List<String>> regions() {
        return ResponseEntity.ok(service.findRegions());
    }

    @PostMapping
    public ResponseEntity<TrainingProgramResponse> create(
            @Valid @RequestBody TrainingProgramRequest request) {

        return ResponseEntity.status(HttpStatus.CREATED)
                .body(service.create(request));
    }

    @GetMapping("/{id}")
    public ResponseEntity<TrainingProgramResponse> findById(
            @PathVariable Long id) {

        return ResponseEntity.ok(service.findById(id));
    }

    @PutMapping("/{id}")
    public ResponseEntity<TrainingProgramResponse> update(
            @PathVariable Long id,
            @Valid @RequestBody TrainingProgramRequest request) {

        return ResponseEntity.ok(service.update(id, request));
    }

    @GetMapping("/{id}/subjects")
    public ResponseEntity<List<TrainingProgramResponse.ProgramSubjectResponse>>
    subjects(@PathVariable Long id) {

        return ResponseEntity.ok(service.findById(id).subjects());
    }

    @PutMapping("/{id}/subjects")
    public ResponseEntity<TrainingProgramResponse> updateSubjects(
            @PathVariable Long id,
            @Valid @RequestBody List<@Valid ProgramSubjectRequest> subjects) {

        return ResponseEntity.ok(service.updateSubjects(id, subjects));
    }

    @PostMapping("/{id}/clone")
    public ResponseEntity<TrainingProgramResponse> cloneVersion(
            @PathVariable Long id,
            @RequestParam String newVersion) {

        return ResponseEntity.status(HttpStatus.CREATED)
                .body(service.cloneVersion(id, newVersion));
    }

    @PostMapping("/{id}/activate")
    public ResponseEntity<TrainingProgramResponse> activate(
            @PathVariable Long id) {

        return ResponseEntity.ok(service.activate(id));
    }

    @PatchMapping("/{id}/status")
    public ResponseEntity<TrainingProgramResponse> changeStatus(
            @PathVariable Long id,
            @RequestParam ProgramStatus status) {

        return ResponseEntity.ok(service.changeStatus(id, status));
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable Long id) {
        service.delete(id);
    }

    // ========================= IMPORT =========================

    @PostMapping(
            value = "/import/preview",
            consumes = MediaType.MULTIPART_FORM_DATA_VALUE
    )
    public ResponseEntity<ProgramImportPreviewResponse> previewImport(
            @RequestPart("file") MultipartFile file) {

        return ResponseEntity.ok(importService.preview(file));
    }

    @PostMapping(
            value = "/import",
            consumes = MediaType.MULTIPART_FORM_DATA_VALUE
    )
    public ResponseEntity<Map<String, Object>> importPrograms(
            @RequestPart("file") MultipartFile file) {

        int imported = importService.importAll(file);

        return ResponseEntity.ok(
                Map.of(
                        "importedPrograms", imported,
                        "message", "Import thành công."
                )
        );
    }

    @GetMapping("/import/template")
    public ResponseEntity<byte[]> importTemplate() throws IOException {

        try (
                XSSFWorkbook workbook = new XSSFWorkbook();
                ByteArrayOutputStream output = new ByteArrayOutputStream()
        ) {
            Sheet sheet = workbook.createSheet("TrainingPrograms");

            String[] columns = {
                    "programCode",
                    "programName",
                    "programVersion",
                    "region",
                    "subjectCode",
                    "subjectVersion",
                    "orderIndex"
            };

            Row header = sheet.createRow(0);

            for (int i = 0; i < columns.length; i++) {
                header.createCell(i).setCellValue(columns[i]);
                sheet.setColumnWidth(i, 24 * 256);
            }

            String[] first = {
                    "JAVA_BACKEND",
                    "Java Backend",
                    "1.0",
                    "HCM",
                    "JAVA_CORE",
                    "1.0",
                    "1"
            };

            Row example1 = sheet.createRow(1);

            for (int i = 0; i < first.length; i++) {
                example1.createCell(i).setCellValue(first[i]);
            }

            String[] second = {
                    "JAVA_BACKEND",
                    "Java Backend",
                    "1.0",
                    "HCM",
                    "JAVA_ADVANCED",
                    "1.0",
                    "2"
            };

            Row example2 = sheet.createRow(2);

            for (int i = 0; i < second.length; i++) {
                example2.createCell(i).setCellValue(second[i]);
            }

            workbook.write(output);

            return ResponseEntity.ok()
                    .header(
                            HttpHeaders.CONTENT_DISPOSITION,
                            "attachment; filename=training-program-template.xlsx"
                    )
                    .contentType(MediaType.APPLICATION_OCTET_STREAM)
                    .body(output.toByteArray());
        }
    }

    // ========================= EXPORT =========================

    @GetMapping("/export")
    public ResponseEntity<byte[]> export(
            @RequestParam(required = false) String search,
            @RequestParam(required = false) ProgramStatus status,
            @RequestParam(required = false) String region,
            @RequestParam(defaultValue = "filtered") String scope,
            @RequestParam(defaultValue = "xlsx") String format
    ) throws IOException {

        if (search != null && search.length() > 200) {
            throw new IllegalArgumentException(
                    "Search must be at most 200 characters."
            );
        }

        if (region != null && region.length() > 100) {
            throw new IllegalArgumentException(
                    "Region must be at most 100 characters."
            );
        }

        String normalizedScope = scope.toLowerCase(Locale.ROOT);
        String normalizedFormat = format.toLowerCase(Locale.ROOT);

        if (!List.of("all", "filtered").contains(normalizedScope)) {
            throw new IllegalArgumentException(
                    "Scope phải là all hoặc filtered."
            );
        }

        if (!List.of("xlsx", "xls", "csv", "txt")
                .contains(normalizedFormat)) {
            throw new IllegalArgumentException(
                    "Định dạng Export không được hỗ trợ."
            );
        }

        // Nếu chọn all thì bỏ qua các bộ lọc.
        if ("all".equals(normalizedScope)) {
            search = null;
            status = null;
            region = null;
        }

        // findAll lấy toàn bộ kết quả, không giới hạn theo trang hiện tại.
        List<TrainingProgramResponse> programs =
                service.findAll(search, status, region);

        String[] headers = {
                "programCode",
                "programName",
                "programVersion",
                "region",
                "subjectCode",
                "subjectVersion",
                "orderIndex"
        };

        byte[] fileBytes;
        String contentType;
        String extension;

        switch (normalizedFormat) {
            case "xlsx" -> {
                fileBytes = exportExcel(programs, headers, true);
                contentType =
                        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
                extension = "xlsx";
            }

            case "xls" -> {
                fileBytes = exportExcel(programs, headers, false);
                contentType = "application/vnd.ms-excel";
                extension = "xls";
            }

            case "csv" -> {
                fileBytes = exportDelimited(
                        programs,
                        headers,
                        ','
                );
                contentType = "text/csv; charset=UTF-8";
                extension = "csv";
            }

            case "txt" -> {
                fileBytes = exportDelimited(
                        programs,
                        headers,
                        '\t'
                );
                contentType = "text/plain; charset=UTF-8";
                extension = "txt";
            }

            default -> throw new IllegalArgumentException(
                    "Định dạng Export không hợp lệ."
            );
        }

        String filename = "training-programs." + extension;

        return ResponseEntity.ok()
                .header(
                        HttpHeaders.CONTENT_DISPOSITION,
                        "attachment; filename=\"" + filename + "\""
                )
                .contentType(MediaType.parseMediaType(contentType))
                .body(fileBytes);
    }

    /**
     * Export XLSX hoặc XLS.
     * Mỗi môn học là một dòng dữ liệu.
     */
    private byte[] exportExcel(
            List<TrainingProgramResponse> programs,
            String[] headers,
            boolean useXlsx
    ) throws IOException {

        try (
                Workbook workbook = useXlsx
                        ? new XSSFWorkbook()
                        : new HSSFWorkbook();

                ByteArrayOutputStream output =
                        new ByteArrayOutputStream()
        ) {
            Sheet sheet = workbook.createSheet("TrainingPrograms");

            Row headerRow = sheet.createRow(0);

            for (int i = 0; i < headers.length; i++) {
                headerRow.createCell(i).setCellValue(headers[i]);
                sheet.setColumnWidth(i, 24 * 256);
            }

            int rowIndex = 1;

            for (TrainingProgramResponse program : programs) {
                if (program.subjects() == null
                        || program.subjects().isEmpty()) {
                    continue;
                }

                for (var subject : program.subjects()) {
                    Row row = sheet.createRow(rowIndex++);

                    row.createCell(0).setCellValue(
                            safeCell(program.code())
                    );

                    row.createCell(1).setCellValue(
                            safeCell(program.name())
                    );

                    row.createCell(2).setCellValue(
                            safeCell(program.version())
                    );

                    row.createCell(3).setCellValue(
                            safeCell(program.region())
                    );

                    row.createCell(4).setCellValue(
                            safeCell(subject.code())
                    );

                    row.createCell(5).setCellValue(
                            safeCell(subject.version())
                    );

                    row.createCell(6).setCellValue(
                            subject.orderIndex() == null
                                    ? ""
                                    : String.valueOf(subject.orderIndex())
                    );
                }
            }

            workbook.write(output);

            return output.toByteArray();
        }
    }

    /**
     * Export CSV hoặc TXT.
     * TXT sử dụng tab làm ký tự phân cách.
     * File được ghi với UTF-8 BOM.
     */
    private byte[] exportDelimited(
            List<TrainingProgramResponse> programs,
            String[] headers,
            char delimiter
    ) {
        StringBuilder content = new StringBuilder();

        appendDelimitedRow(content, headers, delimiter);

        for (TrainingProgramResponse program : programs) {
            if (program.subjects() == null
                    || program.subjects().isEmpty()) {
                continue;
            }

            for (var subject : program.subjects()) {
                String[] values = {
                        safeCell(program.code()),
                        safeCell(program.name()),
                        safeCell(program.version()),
                        safeCell(program.region()),
                        safeCell(subject.code()),
                        safeCell(subject.version()),
                        String.valueOf(subject.orderIndex())
                };

                appendDelimitedRow(content, values, delimiter);
            }
        }

        String result = "\uFEFF" + content;

        return result.getBytes(StandardCharsets.UTF_8);
    }

    private void appendDelimitedRow(
            StringBuilder output,
            String[] values,
            char delimiter
    ) {
        for (int i = 0; i < values.length; i++) {
            if (i > 0) {
                output.append(delimiter);
            }

            output.append(quoteDelimited(values[i]));
        }

        output.append("\r\n");
    }

    /**
     * Escape giá trị cho CSV/TXT.
     * Đồng thời hạn chế CSV Formula Injection.
     */
    private String quoteDelimited(String value) {
        if (value == null) {
            value = "";
        }

        String safe = safeCell(value);

        return "\""
                + safe.replace("\"", "\"\"")
                + "\"";
    }

    /**
     * Chặn các ký tự có thể khiến Excel hiểu dữ liệu
     * là công thức khi mở file.
     */
    private String safeCell(String value) {
        if (value == null) {
            return "";
        }

        String trimmed = value.stripLeading();

        if (trimmed.startsWith("=")
                || trimmed.startsWith("+")
                || trimmed.startsWith("-")
                || trimmed.startsWith("@")) {
            return "'" + value;
        }

        return value;
    }
}
