package com.example.starter_project_2025.system.project.resources;

import com.example.starter_project_2025.exception.BusinessValidationException;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/**
 * Validates and stores the files attached to a template resource.
 * <p>
 * Business rules (US-RES-001 / AC03):
 * <ul>
 *     <li>only document formats are accepted
 *     ({@code pdf, doc(x), xls(x), csv, ppt(x), txt, md, zip, png, jpg})</li>
 *     <li>executable / script extensions ({@code exe, sh, bat, cmd, ps1, ...})
 *     are rejected explicitly, even if a matching MIME type is declared</li>
 *     <li>the size limit defaults to 25 MB and can be changed through
 *     {@code app.template-resource.upload.max-bytes}</li>
 * </ul>
 * The bytes are written under a generated {@code storageKey} so the original
 * file name is only metadata and can never escape the storage directory.
 */
@Slf4j
@Component
public class TemplateResourceFileStorage {

    /** Extensions accepted for a template resource upload. */
    public static final List<String> ALLOWED_EXTENSIONS = List.of(
            "pdf", "doc", "docx", "xls", "xlsx", "csv", "ppt", "pptx",
            "txt", "md", "zip", "png", "jpg", "jpeg"
    );

    /** Extensions rejected regardless of the declared content type. */
    public static final Set<String> BLOCKED_EXTENSIONS = Set.of(
            "exe", "sh", "bat", "cmd", "com", "msi", "scr", "ps1", "vbs", "js",
            "jar", "dll", "bin", "apk", "php", "py", "rb", "pl", "cgi", "class"
    );

    private static final Map<String, String> CONTENT_TYPES = Map.ofEntries(
            Map.entry("pdf", "application/pdf"),
            Map.entry("doc", "application/msword"),
            Map.entry("docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"),
            Map.entry("xls", "application/vnd.ms-excel"),
            Map.entry("xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"),
            Map.entry("csv", "text/csv"),
            Map.entry("ppt", "application/vnd.ms-powerpoint"),
            Map.entry("pptx", "application/vnd.openxmlformats-officedocument.presentationml.presentation"),
            Map.entry("txt", "text/plain"),
            Map.entry("md", "text/markdown"),
            Map.entry("zip", "application/zip"),
            Map.entry("png", "image/png"),
            Map.entry("jpg", "image/jpeg"),
            Map.entry("jpeg", "image/jpeg")
    );

    @Value("${app.template-resource.upload.max-bytes:26214400}")
    long maxBytes;

    @Value("${app.template-resource.upload.storage-path:./data/template-resource-uploads}")
    String storagePath;

    /** Limits exposed to the UI so the client can validate before uploading. */
    public long maxBytes() {
        return maxBytes;
    }

    public List<String> allowedExtensions() {
        return ALLOWED_EXTENSIONS;
    }

    /**
     * Validates the upload and writes it to the private storage directory.
     */
    public StoredTemplateFile store(MultipartFile file) {

        if (file == null || file.isEmpty()) {
            throw rejected("Choose a file to upload");
        }

        String originalName = safeFileName(file.getOriginalFilename());
        String extension = extensionOf(originalName);

        if (BLOCKED_EXTENSIONS.contains(extension)) {
            throw rejected("." + extension + " files are not allowed. Upload a PDF, DOCX, XLSX, CSV or ZIP file instead");
        }

        if (!ALLOWED_EXTENSIONS.contains(extension)) {
            throw rejected("Unsupported file type. Allowed formats: " + String.join(", ", ALLOWED_EXTENSIONS));
        }

        if (file.getSize() > maxBytes) {
            throw rejected("File exceeds the " + humanSize(maxBytes) + " size limit");
        }

        byte[] bytes;

        try {
            bytes = file.getBytes();
        } catch (IOException exception) {
            throw new BusinessValidationException(Map.of("file", List.of("The file could not be read. Please try again")));
        }

        return write(bytes, originalName, extension);
    }

    /**
     * Stores in-memory content under the same rules as an upload. Used by the
     * demo fixtures so a seeded document is a real, downloadable object.
     */
    public StoredTemplateFile storeBytes(byte[] content, String originalName) {

        if (content == null || content.length == 0) {
            throw rejected("Choose a file to upload");
        }

        String safeName = safeFileName(originalName);
        String extension = extensionOf(safeName);

        if (BLOCKED_EXTENSIONS.contains(extension)) {
            throw rejected("." + extension + " files are not allowed. Upload a PDF, DOCX, XLSX, CSV or ZIP file instead");
        }

        if (!ALLOWED_EXTENSIONS.contains(extension)) {
            throw rejected("Unsupported file type. Allowed formats: " + String.join(", ", ALLOWED_EXTENSIONS));
        }

        if (content.length > maxBytes) {
            throw rejected("File exceeds the " + humanSize(maxBytes) + " size limit");
        }

        return write(content, safeName, extension);
    }

    private StoredTemplateFile write(byte[] bytes, String originalName, String extension) {

        String storageKey = UUID.randomUUID() + "." + extension;
        Path root = Path.of(storagePath).toAbsolutePath().normalize();
        Path destination = root.resolve(storageKey).normalize();

        if (!destination.startsWith(root)) {
            throw new BusinessValidationException(Map.of("file", List.of("Invalid storage configuration")));
        }

        try {
            Files.createDirectories(root);
            Files.write(destination, bytes);
        } catch (IOException exception) {
            log.error("Unable to store template resource file {}", storageKey, exception);
            throw new BusinessValidationException(Map.of("file", List.of("The file could not be stored. Please try again")));
        }

        return new StoredTemplateFile(storageKey, originalName,
                CONTENT_TYPES.getOrDefault(extension, "application/octet-stream"), (long) bytes.length);
    }

    /** Reads a previously stored file back. */
    public byte[] read(String storageKey) {

        Path root = Path.of(storagePath).toAbsolutePath().normalize();
        Path source = root.resolve(storageKey).normalize();

        if (!source.startsWith(root)) {
            throw new BusinessValidationException(Map.of("file", List.of("Invalid stored file reference")));
        }

        try {
            return Files.readAllBytes(source);
        } catch (IOException exception) {
            throw new BusinessValidationException(Map.of("file",
                    List.of("The stored file is no longer available")));
        }
    }

    /** Best-effort removal; a missing object is not an error. */
    public void delete(String storageKey) {

        if (storageKey == null || storageKey.isBlank()) {
            return;
        }

        Path root = Path.of(storagePath).toAbsolutePath().normalize();
        Path target = root.resolve(storageKey).normalize();

        if (!target.startsWith(root)) {
            return;
        }

        try {
            Files.deleteIfExists(target);
        } catch (IOException exception) {
            log.warn("Unable to delete template resource file {}", storageKey, exception);
        }
    }

    private String extensionOf(String fileName) {

        int dot = fileName.lastIndexOf('.');

        if (dot < 0 || dot == fileName.length() - 1) {
            return "";
        }

        return fileName.substring(dot + 1).toLowerCase(Locale.ROOT);
    }

    private String safeFileName(String original) {

        String value = original == null ? "resource" : original.replace('\\', '/');
        value = value.substring(value.lastIndexOf('/') + 1)
                .replaceAll("[\\p{Cntrl}]", "_")
                .trim();

        if (value.isBlank()) {
            value = "resource";
        }

        return value.length() <= 255 ? value : value.substring(value.length() - 255);
    }

    private String humanSize(long bytes) {
        return bytes >= 1024 * 1024 ? (bytes / (1024 * 1024)) + " MB" : bytes + " bytes";
    }

    private BusinessValidationException rejected(String message) {
        Map<String, List<String>> errors = new LinkedHashMap<>();
        errors.put("file", List.of(message));
        return new BusinessValidationException(errors);
    }

    /** Metadata of a stored upload. */
    public record StoredTemplateFile(String storageKey, String originalName, String contentType, Long sizeBytes) {
    }
}
