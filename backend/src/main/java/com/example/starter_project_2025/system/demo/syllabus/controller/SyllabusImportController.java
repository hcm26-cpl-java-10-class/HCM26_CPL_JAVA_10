package com.example.starter_project_2025.system.demo.syllabus.controller;


import com.example.starter_project_2025.system.demo.syllabus.importexport.SyllabusImportTemplateService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import com.example.starter_project_2025.system.demo.syllabus.importexport.SyllabusBundleImportService;

@RestController
@RequestMapping("/api/syllabuses")
@RequiredArgsConstructor
public class SyllabusImportController {
    private final SyllabusBundleImportService importService;
    private final SyllabusImportTemplateService templateService;

    private static final String IMPORT_PERMISSION =
            "hasAuthority('SYLLABUS_CREATE') and " +
            "hasAuthority('SYLLABUS_UPDATE')";

    @PostMapping(value = "/import", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @PreAuthorize(IMPORT_PERMISSION)
    public SyllabusBundleImportService.ImportSummary importExcel(@RequestParam("file") MultipartFile file) {
        return importService.importExcel(file);
    }

    @GetMapping("/import/template")
    @PreAuthorize(IMPORT_PERMISSION)
    public ResponseEntity<byte[]> downloadTemplate() {
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(
                        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"))
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"syllabuses-template.xlsx\"")
                .header("Access-Control-Expose-Headers", "Content-Disposition")
                .body(templateService.generate());
    }
}
