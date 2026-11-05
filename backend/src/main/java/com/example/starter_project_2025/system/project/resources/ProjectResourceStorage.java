package com.example.starter_project_2025.system.project.resources;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.LinkOption;
import java.nio.file.Path;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.FileSystemResource;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;

@Component
public class ProjectResourceStorage {
    private final Path root;

    public ProjectResourceStorage(@Value("${app.project.resources.storage-path:./data/project-resources}") String path) {
        root = Path.of(path).toAbsolutePath().normalize();
    }

    public FileSystemResource read(String storageKey) {
        try {
            if (storageKey == null || !UUID.fromString(storageKey).toString().equals(storageKey)) throw unavailable();
            Path file = root.resolve(storageKey + ".blob");
            if (!Files.isRegularFile(file, LinkOption.NOFOLLOW_LINKS)
                    || !file.toRealPath().startsWith(root.toRealPath())) throw unavailable();
            return new FileSystemResource(file);
        } catch (IOException | IllegalArgumentException exception) {
            throw unavailable();
        }
    }

    private ResponseStatusException unavailable() {
        return new ResponseStatusException(HttpStatus.NOT_FOUND, "The resource file is unavailable");
    }
}
