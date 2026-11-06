package com.example.starter_project_2025.system.demo.lesson;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.Resource;
import org.springframework.core.io.UrlResource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;

import static org.springframework.http.HttpStatus.BAD_REQUEST;
import static org.springframework.http.HttpStatus.NOT_FOUND;

@RestController
@RequestMapping("/api/lesson-documents")
public class LessonDocumentController {

    private static final long MAX_DOCUMENT_BYTES = 25L * 1024 * 1024;
    private static final Set<String> DOCUMENT_EXTENSIONS = Set.of(
            "pdf", "doc", "docx", "ppt", "pptx", "xls", "xlsx", "txt"
    );

    private final Path storageDirectory;
    private final String backendUrl;

    public LessonDocumentController(
            @Value("${app.lesson-document.directory:uploads/documents}") String storageDirectory,
            @Value("${app.backend-domain:http://localhost:8080}") String backendUrl
    ) {
        this.storageDirectory = Paths.get(storageDirectory).toAbsolutePath().normalize();
        this.backendUrl = backendUrl.replaceAll("/$", "");
    }

    @PostMapping
    @PreAuthorize("hasAuthority('LESSON_CREATE') or hasAuthority('LESSON_UPDATE')")
    public DocumentUploadResponse upload(@RequestParam("file") MultipartFile file) {
        String extension = extensionOf(file.getOriginalFilename());
        if (file.isEmpty()) throw new ResponseStatusException(BAD_REQUEST, "Choose a non-empty document file");
        if (file.getSize() > MAX_DOCUMENT_BYTES) throw new ResponseStatusException(BAD_REQUEST, "Document file must not exceed 25 MB");
        if (!DOCUMENT_EXTENSIONS.contains(extension)) {
            throw new ResponseStatusException(BAD_REQUEST, "Supported document formats: PDF, DOC, DOCX, PPT, PPTX, XLS, XLSX, TXT");
        }

        String storedName = UUID.randomUUID() + "." + extension;
        try {
            Files.createDirectories(storageDirectory);
            file.transferTo(storageDirectory.resolve(storedName));
        } catch (IOException exception) {
            throw new ResponseStatusException(BAD_REQUEST, "Could not store the document file", exception);
        }
        return new DocumentUploadResponse(backendUrl + "/api/lesson-documents/" + storedName);
    }

    @GetMapping("/{filename:[a-f0-9-]+\\.[a-z0-9]+}")
    public ResponseEntity<Resource> download(@PathVariable String filename) {
        Path file = storageDirectory.resolve(filename).normalize();
        if (!file.startsWith(storageDirectory) || !Files.isRegularFile(file)) {
            throw new ResponseStatusException(NOT_FOUND, "Document file not found");
        }
        try {
            String contentType = Files.probeContentType(file);
            return ResponseEntity.ok()
                    .header(HttpHeaders.CONTENT_DISPOSITION, "inline; filename=\"" + filename + "\"")
                    .contentType(contentType == null ? MediaType.APPLICATION_OCTET_STREAM : MediaType.parseMediaType(contentType))
                    .body(new UrlResource(file.toUri()));
        } catch (IOException exception) {
            throw new ResponseStatusException(NOT_FOUND, "Document file not found", exception);
        }
    }

    private static String extensionOf(String filename) {
        if (filename == null) return "";
        int dot = filename.lastIndexOf('.');
        return dot < 0 ? "" : filename.substring(dot + 1).toLowerCase(Locale.ROOT);
    }

    public record DocumentUploadResponse(String url) {}
}
