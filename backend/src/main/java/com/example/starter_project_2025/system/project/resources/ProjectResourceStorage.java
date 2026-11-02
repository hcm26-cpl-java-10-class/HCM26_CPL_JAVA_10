package com.example.starter_project_2025.system.project.resources;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.LinkOption;
import java.nio.file.Path;
import java.nio.file.StandardOpenOption;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.FileSystemResource;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

@Component
public class ProjectResourceStorage {
    private final Path root;

    public ProjectResourceStorage(@Value("${app.project.resources.storage-path:./data/project-resources}") String path) {
        root = Path.of(path).toAbsolutePath().normalize();
    }

    public String store(byte[] bytes) {
        String key = UUID.randomUUID().toString();
        Path file = root.resolve(key + ".blob");
        try {
            Files.createDirectories(root);
            Files.write(file, bytes, StandardOpenOption.CREATE_NEW);
            if (TransactionSynchronizationManager.isSynchronizationActive()) {
                TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                    @Override
                    public void afterCompletion(int status) {
                        if (status != STATUS_COMMITTED) {
                            try { Files.deleteIfExists(file); } catch (IOException ignored) { }
                        }
                    }
                });
            }
            return key;
        } catch (IOException exception) {
            try { Files.deleteIfExists(file); } catch (IOException ignored) { }
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "The resource file could not be stored");
        }
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
