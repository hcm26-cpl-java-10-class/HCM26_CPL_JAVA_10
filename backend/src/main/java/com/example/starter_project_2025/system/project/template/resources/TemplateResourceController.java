package com.example.starter_project_2025.system.project.template.resources;

import jakarta.servlet.http.HttpServletRequest;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import lombok.RequiredArgsConstructor;
import org.springframework.core.io.Resource;
import org.springframework.http.CacheControl;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/project-templates/{templateId}/resources")
@RequiredArgsConstructor
public class TemplateResourceController {
    private final TemplateResourceService service;

    @GetMapping
    @PreAuthorize("hasAuthority('PROJECT_TEMPLATE_READ')")
    public ResponseEntity<TemplateResourceService.Listing> list(@PathVariable Long templateId, @RequestParam(required = false) Long versionId) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(service.list(templateId, versionId));
    }

    @PostMapping(value = "/files", consumes = MediaType.APPLICATION_OCTET_STREAM_VALUE)
    @PreAuthorize("hasAuthority('PROJECT_TEMPLATE_UPDATE')")
    public TemplateResourceService.Listing upload(@PathVariable Long templateId, @RequestParam String fileName,
            @RequestParam Long lockVersion, @RequestParam(required = false) Long versionId, HttpServletRequest request) throws IOException {
        return service.upload(templateId, versionId, lockVersion, fileName, request.getContentLengthLong(), request.getInputStream());
    }

    @PostMapping("/links")
    @PreAuthorize("hasAuthority('PROJECT_TEMPLATE_UPDATE')")
    public TemplateResourceService.Listing addLink(@PathVariable Long templateId, @RequestParam(required = false) Long versionId,
            @RequestBody TemplateResourceService.LinkRequest request) {
        return service.addLink(templateId, versionId, request);
    }

    @DeleteMapping("/{resourceId}")
    @PreAuthorize("hasAuthority('PROJECT_TEMPLATE_UPDATE')")
    public TemplateResourceService.Listing remove(@PathVariable Long templateId, @PathVariable Long resourceId,
            @RequestParam Long lockVersion, @RequestParam(required = false) Long versionId) {
        return service.remove(templateId, resourceId, versionId, lockVersion);
    }

    @PostMapping("/{resourceId}/download-link")
    @PreAuthorize("hasAuthority('PROJECT_TEMPLATE_READ')")
    public ResponseEntity<TemplateResourceService.DownloadLink> link(@PathVariable Long templateId,
            @PathVariable Long resourceId, @RequestParam(required = false) Long versionId) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(service.link(templateId, resourceId, versionId));
    }

    @GetMapping("/{resourceId}/download")
    @PreAuthorize("hasAuthority('PROJECT_TEMPLATE_READ')")
    public ResponseEntity<Resource> download(@PathVariable Long templateId, @PathVariable Long resourceId,
            @RequestParam(required = false) Long versionId, @RequestParam long expires, @RequestParam String signature) {
        var download = service.download(templateId, resourceId, versionId, expires, signature);
        String name = download.fileName().replaceAll("[\\p{Cntrl}\\\\/]", "_");
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).contentType(MediaType.APPLICATION_OCTET_STREAM)
                .header(HttpHeaders.CONTENT_DISPOSITION, ContentDisposition.attachment().filename(name, StandardCharsets.UTF_8).build().toString())
                .header("X-Content-Type-Options", "nosniff").header("Referrer-Policy", "no-referrer").body(download.content());
    }
}
