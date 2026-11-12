package com.example.starter_project_2025.system.demo.syllabus;

import lombok.RequiredArgsConstructor;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.servlet.support.ServletUriComponentsBuilder;

import java.io.IOException;
import java.nio.file.Files;

@RestController
@RequiredArgsConstructor
public class SyllabusMaterialDownloadController {
    private final SyllabusMaterialFileService files;
    private final StudentSyllabusCatalogService catalog;
    private final SyllabusMaterialsArchiveService archives;

    public record UploadResponse(String url, String fileName) {}

    @PostMapping(value = "/api/syllabuses/{syllabusId}/material-files", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @PreAuthorize("hasAuthority('SYLLABUS_CREATE') or hasAuthority('SYLLABUS_UPDATE')")
    public UploadResponse upload(@PathVariable Long syllabusId, @RequestParam("file") MultipartFile file) {
        SyllabusMaterialFileService.UploadedFile saved = files.upload(syllabusId, file);
        String url = ServletUriComponentsBuilder.fromCurrentContextPath()
                .path(SyllabusMaterialFileService.resourcePath(syllabusId, saved.key()))
                .toUriString();
        return new UploadResponse(url, saved.originalName());
    }

    @GetMapping("/api/syllabuses/{syllabusId}/material-files/{fileKey}")
    @PreAuthorize("hasAuthority('SYLLABUS_UPDATE')")
    public ResponseEntity<byte[]> adminFile(@PathVariable Long syllabusId, @PathVariable String fileKey) throws IOException {
        // Authorized editors can preview their Draft files; Student endpoint still checks Published + Active.
        byte[] bytes = Files.readAllBytes(files.referencedFile(syllabusId, fileKey));
        return ResponseEntity.ok().contentType(MediaType.APPLICATION_OCTET_STREAM)
                .header(HttpHeaders.CONTENT_DISPOSITION, ContentDisposition.attachment()
                        .filename(files.displayFileName(fileKey), java.nio.charset.StandardCharsets.UTF_8).build().toString())
                .body(bytes);
    }

    @GetMapping("/api/student/syllabuses/{syllabusId}/material-files/{fileKey}")
    @PreAuthorize("hasAuthority('COURSE_READ') or hasAuthority('SYLLABUS_READ')")
    public ResponseEntity<byte[]> file(@PathVariable Long syllabusId, @PathVariable String fileKey) throws IOException {
        catalog.detail(syllabusId); // Published + Active only.
        byte[] bytes = Files.readAllBytes(files.referencedFile(syllabusId, fileKey));
        return ResponseEntity.ok()
                .contentType(MediaType.APPLICATION_OCTET_STREAM)
                .header(HttpHeaders.CONTENT_DISPOSITION, ContentDisposition.attachment()
                        .filename(files.displayFileName(fileKey), java.nio.charset.StandardCharsets.UTF_8).build().toString())
                .body(bytes);
    }

    @GetMapping(value = "/api/student/syllabuses/{syllabusId}/materials.zip", produces = "application/zip")
    @PreAuthorize("hasAuthority('COURSE_READ') or hasAuthority('SYLLABUS_READ')")
    public ResponseEntity<byte[]> archive(@PathVariable Long syllabusId) throws IOException {
        SyllabusMaterialsArchiveService.Export result = archives.export(syllabusId);
        return ResponseEntity.ok().contentType(MediaType.parseMediaType("application/zip"))
                .header(HttpHeaders.CONTENT_DISPOSITION, ContentDisposition.attachment()
                        .filename(result.fileName(), java.nio.charset.StandardCharsets.UTF_8).build().toString())
                .body(result.bytes());
    }
}
