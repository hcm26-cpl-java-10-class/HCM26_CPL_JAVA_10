
package com.example.starter_project_2025.system.demo.syllabus;

import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/syllabuses")
@RequiredArgsConstructor
public class SyllabusImportController {

    private final SyllabusBundleImportService importService;

    @PostMapping(
            value = "/import",
            consumes = MediaType.MULTIPART_FORM_DATA_VALUE
    )
    @PreAuthorize(
            "hasAuthority('SYLLABUS_CREATE') and " +
                    "hasAuthority('SYLLABUS_UPDATE')"
    )
    public SyllabusBundleImportService.ImportSummary importExcel(
            @RequestParam("file") MultipartFile file
    ) {
        return importService.importExcel(file);
    }
}
