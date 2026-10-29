package com.example.starter_project_2025.system.demo.lesson;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.Resource;
import org.springframework.core.io.UrlResource;
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
@RequestMapping("/api/lesson-audio")
public class LessonAudioController {

    private static final long MAX_AUDIO_BYTES = 25L * 1024 * 1024;
    private static final Set<String> AUDIO_EXTENSIONS = Set.of("mp3", "wav", "ogg", "m4a", "aac", "flac", "webm");

    private final Path storageDirectory;
    private final String backendUrl;

    public LessonAudioController(
            @Value("${app.lesson-audio.directory:uploads/audio}") String storageDirectory,
            @Value("${app.backend-domain:http://localhost:8080}") String backendUrl
    ) {
        this.storageDirectory = Paths.get(storageDirectory).toAbsolutePath().normalize();
        this.backendUrl = backendUrl.replaceAll("/$", "");
    }

    @PostMapping
    @PreAuthorize("hasAuthority('LESSON_CREATE') or hasAuthority('LESSON_UPDATE')")
    public AudioUploadResponse upload(@RequestParam("file") MultipartFile file) {
        String contentType = file.getContentType();
        String extension = extensionOf(file.getOriginalFilename());
        if (file.isEmpty()) throw new ResponseStatusException(BAD_REQUEST, "Choose a non-empty audio file");
        if (file.getSize() > MAX_AUDIO_BYTES) throw new ResponseStatusException(BAD_REQUEST, "Audio file must not exceed 25 MB");
        if (contentType == null || !contentType.toLowerCase(Locale.ROOT).startsWith("audio/") || !AUDIO_EXTENSIONS.contains(extension)) {
            throw new ResponseStatusException(BAD_REQUEST, "Supported audio formats: MP3, WAV, OGG, M4A, AAC, FLAC, WEBM");
        }

        String storedName = UUID.randomUUID() + "." + extension;
        try {
            Files.createDirectories(storageDirectory);
            file.transferTo(storageDirectory.resolve(storedName));
        } catch (IOException exception) {
            throw new ResponseStatusException(BAD_REQUEST, "Could not store the audio file", exception);
        }
        return new AudioUploadResponse(backendUrl + "/api/lesson-audio/" + storedName);
    }

    @GetMapping("/{filename:[a-f0-9-]+\\.[a-z0-9]+}")
    public ResponseEntity<Resource> download(@PathVariable String filename) {
        Path file = storageDirectory.resolve(filename).normalize();
        if (!file.startsWith(storageDirectory) || !Files.isRegularFile(file)) {
            throw new ResponseStatusException(NOT_FOUND, "Audio file not found");
        }
        try {
            String contentType = Files.probeContentType(file);
            return ResponseEntity.ok()
                    .contentType(contentType == null ? MediaType.APPLICATION_OCTET_STREAM : MediaType.parseMediaType(contentType))
                    .body(new UrlResource(file.toUri()));
        } catch (IOException exception) {
            throw new ResponseStatusException(NOT_FOUND, "Audio file not found", exception);
        }
    }

    private static String extensionOf(String filename) {
        if (filename == null) return "";
        int dot = filename.lastIndexOf('.');
        return dot < 0 ? "" : filename.substring(dot + 1).toLowerCase(Locale.ROOT);
    }

    public record AudioUploadResponse(String url) {}
}
