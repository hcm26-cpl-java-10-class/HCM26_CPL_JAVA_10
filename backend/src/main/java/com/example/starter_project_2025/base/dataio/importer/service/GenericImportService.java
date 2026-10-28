package com.example.starter_project_2025.base.dataio.importer.service;

import com.example.starter_project_2025.base.dataio.importer.annotation.ImportHash;
import com.example.starter_project_2025.base.dataio.importer.mapper.GenericImportMapper;
import com.example.starter_project_2025.base.dataio.importer.parser.FileParser;
import com.example.starter_project_2025.base.dataio.importer.parser.ParserFactory;
import com.example.starter_project_2025.base.dataio.importer.result.ImportResult;
import com.example.starter_project_2025.base.dataio.importer.result.RowError;
import lombok.RequiredArgsConstructor;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.multipart.MultipartFile;

import java.lang.reflect.Field;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class GenericImportService implements ImportService {

    /** First data row of the spreadsheet (row 1 is the header). */
    private static final int FIRST_DATA_ROW = 2;

    private static final int MAX_ERROR_MESSAGE_LENGTH = 500;

    private final ParserFactory parserFactory;
    private final GenericImportMapper mapper;
    private final PasswordEncoder passwordEncoder;
    private final PlatformTransactionManager transactionManager;

    @Override
    public <T, ID> ImportResult importFile(
            MultipartFile file,
            Class<T> entityClass,
            JpaRepository<T, ID> repository
    ) {

        ImportResult result = new ImportResult();

        List<Map<String, String>> rows;

        try {
            rows = parse(file);
        } catch (Exception e) {
            throw new RuntimeException("Import failed", e);
        }

        int rowIndex = FIRST_DATA_ROW;

        for (Map<String, String> row : rows) {

            try {
                T entity = toEntity(row, entityClass);

                repository.save(entity);

                result.setSuccessCount(result.getSuccessCount() + 1);

            } catch (Exception e) {

                result.getErrors().add(
                        new RowError(rowIndex, rootMessage(e)));

                result.setFailureCount(result.getFailureCount() + 1);
            }

            rowIndex++;
        }

        return result;
    }

    @Override
    public <T, ID> ImportResult importFileAtomic(
            MultipartFile file,
            Class<T> entityClass,
            JpaRepository<T, ID> repository
    ) {

        ImportResult result = new ImportResult();

        List<Map<String, String>> rows;

        try {
            rows = parse(file);
        } catch (Exception e) {
            throw new RuntimeException("Import failed", e);
        }

        // Phase 1: map / validate every row in memory. Nothing is written yet,
        // so a validation error leaves the database untouched.
        List<T> entities = new ArrayList<>(rows.size());

        int rowIndex = FIRST_DATA_ROW;

        for (Map<String, String> row : rows) {

            try {
                entities.add(toEntity(row, entityClass));
            } catch (Exception e) {
                result.getErrors().add(new RowError(rowIndex, rootMessage(e)));
            }

            rowIndex++;
        }

        if (!result.getErrors().isEmpty()) {
            result.setSuccessCount(0);
            result.setFailureCount(rows.size());
            return result;
        }

        // Phase 2: persist every entity in one transaction. A failure on any
        // row rolls the whole transaction back, so nothing of the file is kept.
        try {
            new TransactionTemplate(transactionManager).executeWithoutResult(status -> {
                for (int i = 0; i < entities.size(); i++) {
                    try {
                        repository.saveAndFlush(entities.get(i));
                    } catch (Exception e) {
                        throw new RowPersistenceException(FIRST_DATA_ROW + i, e);
                    }
                }
            });
        } catch (RowPersistenceException e) {
            result.setSuccessCount(0);
            result.setFailureCount(rows.size());
            result.getErrors().add(
                    new RowError(e.getRowNumber(), rootMessage(e.getCause())));
            return result;
        }

        result.setSuccessCount(entities.size());
        result.setFailureCount(0);

        return result;
    }

    private List<Map<String, String>> parse(MultipartFile file) throws Exception {
        FileParser parser = parserFactory.getParser(file.getOriginalFilename());
        return parser.parse(file.getInputStream());
    }

    private <T> T toEntity(Map<String, String> row, Class<T> entityClass) throws IllegalAccessException {
        T entity = mapper.map(row, entityClass);
        applyHash(entity);
        return entity;
    }

    /**
     * Message of the deepest cause, trimmed to a readable length for the
     * per-row error list of the import result.
     */
    private String rootMessage(Throwable throwable) {

        Throwable root = throwable;

        while (root.getCause() != null && root.getCause() != root) {
            root = root.getCause();
        }

        String message = root.getMessage();

        if (message == null || message.isBlank()) {
            message = throwable.getMessage();
        }

        if (message == null || message.isBlank()) {
            return throwable.getClass().getSimpleName();
        }

        return message.length() > MAX_ERROR_MESSAGE_LENGTH
                ? message.substring(0, MAX_ERROR_MESSAGE_LENGTH) + "..."
                : message;
    }

    /**
     * Carries the spreadsheet row number of the row that could not be stored,
     * so the transaction can be rolled back and the failure reported.
     */
    private static final class RowPersistenceException extends RuntimeException {

        private final int rowNumber;

        RowPersistenceException(int rowNumber, Throwable cause) {
            super(cause);
            this.rowNumber = rowNumber;
        }

        int getRowNumber() {
            return rowNumber;
        }
    }

    private void applyHash(Object entity) throws IllegalAccessException {

        for (Field field : entity.getClass().getDeclaredFields()) {

            ImportHash ann = field.getAnnotation(ImportHash.class);
            if (ann == null) continue;

            field.setAccessible(true);

            Object val = field.get(entity);

            if (val instanceof String raw && !isHashed(raw)) {
                field.set(entity, passwordEncoder.encode(raw));
            }
        }
    }

    private boolean isHashed(String v) {
        return v.startsWith("$2");
    }
}
