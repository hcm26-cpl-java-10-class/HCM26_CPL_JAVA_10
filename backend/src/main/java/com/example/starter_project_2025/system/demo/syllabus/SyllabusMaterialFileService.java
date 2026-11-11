package com.example.starter_project_2025.system.demo.syllabus;

import com.example.starter_project_2025.exception.ResourceNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.io.IOException;
import java.net.URI;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;
import java.util.regex.Pattern;

/** Local learning files are private: only the authenticated download controllers expose them. */
@Service
@RequiredArgsConstructor
public class SyllabusMaterialFileService {
    private static final Set<String> ALLOWED = Set.of("pdf", "pptx", "docx", "xlsx", "txt");
    private static final Pattern FILE_KEY = Pattern.compile("[0-9a-f-]{36}_[a-zA-Z0-9._-]{1,100}");
    private static final long LIMIT = 20L * 1024 * 1024;

    private final SyllabusRepository syllabuses;
    private final SyllabusMaterialRepository materials;
    private final SyllabusWorkflowService workflow;

    @Value("${app.syllabus.material-files-dir:syllabus-material-files}")
    private String storageDir;

    public record UploadedFile(String key, String originalName) {}

    public UploadedFile upload(Long syllabusId, MultipartFile file) {
        if (!syllabuses.existsById(syllabusId)) {
            throw new ResourceNotFoundException("Syllabus not found");
        }
        workflow.requireDraft(syllabusId);
        if (file == null || file.isEmpty() || file.getSize() > LIMIT) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "File is empty or exceeds 20 MB");
        }
        String originalName = file.getOriginalFilename() == null ? "" : file.getOriginalFilename();
        originalName = originalName.replace('\\', '/');
        originalName = originalName.substring(originalName.lastIndexOf('/') + 1);
        String extension = originalName.contains(".")
                ? originalName.substring(originalName.lastIndexOf('.') + 1).toLowerCase(Locale.ROOT)
                : "";
        if (!ALLOWED.contains(extension)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Supported files: PDF, PPTX, DOCX, XLSX, TXT");
        }
        String safe = originalName.replaceAll("[^a-zA-Z0-9._-]", "_");
        if (safe.length() > 100) safe = safe.substring(safe.length() - 100);
        if (safe.startsWith(".")) safe = "file_" + safe;
        if (safe.length() > 100) safe = safe.substring(safe.length() - 100);
        String key = UUID.randomUUID() + "_" + safe;
        try {
            Path folder = root().resolve("syllabus-" + syllabusId);
            Files.createDirectories(folder);
            Path destination = folder.resolve(key).normalize();
            if (!destination.startsWith(folder) || Files.isSymbolicLink(folder)) {
                throw new IOException("Invalid storage path");
            }
            try (var stream = file.getInputStream()) {
                Files.copy(stream, destination);
            }
            return new UploadedFile(key, originalName);
        } catch (IOException error) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR,
                    "Could not store learning material", error);
        }
    }

    public static String resourcePath(Long syllabusId, String key) {
        return "/api/student/syllabuses/" + syllabusId + "/material-files/" + key;
    }

    /** Only files whose URL belongs to the exact Syllabus and the file endpoint are bundled. */
    public String keyFromUrl(Long syllabusId, String url) {
        if (url == null) return null;
        try {
            URI parsed = URI.create(url);
            String prefix = "/api/student/syllabuses/" + syllabusId + "/material-files/";
            String path = parsed.getPath();
            if (path == null || !path.startsWith(prefix)) return null;
            String key = path.substring(prefix.length());
            return FILE_KEY.matcher(key).matches() ? key : null;
        } catch (IllegalArgumentException ignored) {
            return null;
        }
    }

    public Path existingFile(Long syllabusId, String key) {
        if (!FILE_KEY.matcher(key).matches()) {
            throw new ResourceNotFoundException("Learning file not found");
        }
        Path folder = root().resolve("syllabus-" + syllabusId).normalize();
        Path file = folder.resolve(key).normalize();
        if (!file.startsWith(folder) || !Files.isRegularFile(file) || Files.isSymbolicLink(file)) {
            throw new ResourceNotFoundException("Learning file not found");
        }
        return file;
    }

    /** Require file to be referenced by a material in this syllabus, not merely stored on disk. */
    public Path referencedFile(Long syllabusId, String key) {
        boolean referenced = materials.findBySyllabus_IdOrderByIdAsc(syllabusId)
                .stream().anyMatch(m -> key.equals(keyFromUrl(syllabusId, m.getUrl())));
        if (!referenced) throw new ResourceNotFoundException("Learning file not found");
        return existingFile(syllabusId, key);
    }

    /** Copy an uploaded file into the new Syllabus so templates never depend on the source file. */
    public String copyForTemplate(Long sourceId, Long targetId, String url) {
        String oldKey = keyFromUrl(sourceId, url);
        if (oldKey == null) return url;
        Path source = referencedFile(sourceId, oldKey);
        String newKey = UUID.randomUUID() + "_" + displayFileName(oldKey);
        Path destinationFolder = root().resolve("syllabus-" + targetId);
        try {
            Files.createDirectories(destinationFolder);
            Files.copy(source, destinationFolder.resolve(newKey));
        } catch (IOException error) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Unable to duplicate learning file", error);
        }
        return url.replace(resourcePath(sourceId, oldKey), resourcePath(targetId, newKey));
    }

    public String displayFileName(String key) {
        return key.substring(key.indexOf('_') + 1);
    }

    private Path root() {
        return Path.of(storageDir).toAbsolutePath().normalize();
    }
}
