package com.example.starter_project_2025.system.project.report;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.UUID;

@Component
@Slf4j
class ProjectReportFileStorage {
    private final Path root;

    ProjectReportFileStorage(@Value("${app.project-reports.export.storage-path:./data/project-report-exports}") String path) {
        root = Path.of(path).toAbsolutePath().normalize();
    }

    void store(UUID id, byte[] bytes) {
        Path destination = path(id);
        try {
            Files.createDirectories(root);
            // Downloads require a committed READY job. The worker holds the job lock until then.
            Files.write(destination, bytes);
        } catch (IOException failure) {
            discard(id);
            throw new UncheckedIOException("Unable to store project report " + id, failure);
        }
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override
            public void afterCompletion(int status) {
                if (status == STATUS_ROLLED_BACK) discard(id);
            }
        });
    }

    byte[] read(UUID id) throws IOException {
        return Files.readAllBytes(path(id));
    }

    private Path path(UUID id) {
        return root.resolve(id + ".xlsx");
    }

    void discard(UUID id) {
        try {
            Files.deleteIfExists(path(id));
        } catch (IOException failure) {
            log.warn("Unable to remove project report file {}", id, failure);
        }
    }
}
