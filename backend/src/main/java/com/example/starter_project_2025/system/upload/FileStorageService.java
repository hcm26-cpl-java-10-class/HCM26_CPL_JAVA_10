package com.example.starter_project_2025.system.upload;

import com.example.starter_project_2025.exception.BadRequestException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.servlet.support.ServletUriComponentsBuilder;

import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.util.Map;
import java.util.UUID;

@Service
public class FileStorageService {

    private static final long MAX_BYTES = 2L * 1024 * 1024;
    private static final Map<String, String> EXTENSION_BY_TYPE = Map.of(
            "image/png", "png",
            "image/jpeg", "jpg",
            "image/gif", "gif",
            "image/webp", "webp");

    private final Path root;

    public FileStorageService(@Value("${app.upload-dir:uploads}") String uploadDir) {
        this.root = Path.of(uploadDir).toAbsolutePath().normalize();
    }

    public String storeImage(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new BadRequestException("No file was uploaded");
        }
        if (file.getSize() > MAX_BYTES) {
            throw new BadRequestException("Image must be 2 MB or smaller");
        }
        String extension = EXTENSION_BY_TYPE.get(file.getContentType());
        if (extension == null) {
            throw new BadRequestException("Only PNG, JPEG, GIF or WebP images are allowed");
        }

        String fileName = UUID.randomUUID() + "." + extension;
        try {
            Files.createDirectories(root);
            try (InputStream in = file.getInputStream()) {
                Files.copy(in, root.resolve(fileName).normalize(), StandardCopyOption.REPLACE_EXISTING);
            }
        } catch (IOException e) {
            throw new RuntimeException("Could not store the image", e);
        }
        return ServletUriComponentsBuilder.fromCurrentContextPath()
                .path("/uploads/").path(fileName).toUriString();
    }
}