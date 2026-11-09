package com.example.starter_project_2025.base.dataio.importer.service;

import com.example.starter_project_2025.base.dataio.importer.result.ImportResult;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.web.multipart.MultipartFile;

public interface ImportService {

    /**
     * Best-effort import: every valid row is stored, invalid rows are reported
     * in the {@link ImportResult#getErrors() errors} list and skipped.
     */
    <T, ID> ImportResult importFile(
            MultipartFile file,
            Class<T> entityClass,
            JpaRepository<T, ID> repository
    );

    /**
     * All-or-nothing import.
     * <p>
     * Every row is mapped / validated in memory first. When at least one row
     * fails, nothing is written to the database. The mapped entities are then
     * persisted in a single transaction: if any of them cannot be stored, the
     * transaction is rolled back, so a file is either imported completely or
     * not at all.
     * <p>
     * On failure the returned {@link ImportResult} has {@code successCount = 0}
     * and the offending rows in the errors list.
     */
    <T, ID> ImportResult importFileAtomic(
            MultipartFile file,
            Class<T> entityClass,
            JpaRepository<T, ID> repository
    );

}
