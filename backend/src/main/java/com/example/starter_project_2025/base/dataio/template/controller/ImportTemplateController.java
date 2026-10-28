package com.example.starter_project_2025.base.dataio.template.controller;

import com.example.starter_project_2025.base.dataio.template.registry.ImportEntityRegistry;
import com.example.starter_project_2025.base.dataio.template.service.ImportTemplateService;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/import")
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
@Tag(name = "Import Template", description = "APIs for managing import templates")
public class ImportTemplateController {

    ImportTemplateService templateService;
    ImportEntityRegistry registry;

    @GetMapping("/template")
    public ResponseEntity<byte[]> downloadTemplate(
            @RequestParam String entity) {

        Class<?> clazz = registry.getEntity(entity);

        if (clazz == null) {
            throw new RuntimeException("Unknown entity: " + entity);
        }

        byte[] file = templateService.generateTemplate(clazz);

        String filename = entity + "-template.xlsx";

        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        "attachment; filename=\"" + filename + "\"")
                .header("Access-Control-Expose-Headers", "Content-Disposition")
                .contentType(MediaType.APPLICATION_OCTET_STREAM)
                .body(file);
    }
}
