package com.example.starter_project_2025.system.project.resources.template_resources;

import lombok.RequiredArgsConstructor;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.nio.charset.StandardCharsets;

/**
 * Resources tab of a Project Template version (US-RES-001).
 * <p>
 * All routes are version-scoped: the template and the version are derived from
 * the URL, never from the payload.
 */
@RestController
@RequiredArgsConstructor
@RequestMapping("/api/project-template-versions/{id}/resources")
public class TemplateResourceVersionController {

    static final String READ_RULE =
            "hasAuthority('PROJECT_TEMPLATE_READ') and hasAuthority('PROJECT_TEMPLATE_VERSION_READ')";
    static final String WRITE_RULE =
            "hasAuthority('PROJECT_TEMPLATE_UPDATE') and hasAuthority('PROJECT_TEMPLATE_VERSION_UPDATE')";

    private final TemplateResourceVersionService service;

    @GetMapping
    @PreAuthorize(READ_RULE)
    public TemplateResourceCollection list(@PathVariable Long id) {
        return service.getByVersion(id);
    }

    @PostMapping
    @PreAuthorize(WRITE_RULE)
    public TemplateResourceView create(@PathVariable Long id,
                                       @RequestBody TemplateResourceRequest request) {
        return service.create(id, request);
    }

    @PutMapping("/{resourceId}")
    @PreAuthorize(WRITE_RULE)
    public TemplateResourceView update(@PathVariable Long id,
                                       @PathVariable Long resourceId,
                                       @RequestBody TemplateResourceRequest request) {
        return service.update(id, resourceId, request);
    }

    @DeleteMapping("/{resourceId}")
    @PreAuthorize(WRITE_RULE)
    public ResponseEntity<Void> delete(@PathVariable Long id, @PathVariable Long resourceId) {
        service.delete(id, resourceId);
        return ResponseEntity.noContent().build();
    }

    @PostMapping(value = "/{resourceId}/files", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @PreAuthorize(WRITE_RULE)
    public TemplateResourceFileView upload(@PathVariable Long id,
                                           @PathVariable Long resourceId,
                                           @RequestPart("file") MultipartFile file) {
        return service.upload(id, resourceId, file);
    }

    @DeleteMapping("/files/{fileId}")
    @PreAuthorize(WRITE_RULE)
    public ResponseEntity<Void> deleteFile(@PathVariable Long id, @PathVariable Long fileId) {
        service.deleteFile(id, fileId);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/files/{fileId}/download")
    @PreAuthorize(READ_RULE)
    public ResponseEntity<byte[]> download(@PathVariable Long id, @PathVariable Long fileId) {
        TemplateResourceDownload download = service.download(id, fileId);

        ContentDisposition disposition = ContentDisposition.attachment()
                .filename(download.originalName(), StandardCharsets.UTF_8)
                .build();

        MediaType mediaType;
        try {
            mediaType = MediaType.parseMediaType(download.contentType());
        } catch (IllegalArgumentException exception) {
            mediaType = MediaType.APPLICATION_OCTET_STREAM;
        }

        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, disposition.toString())
                .contentType(mediaType)
                .body(download.content());
    }
}
