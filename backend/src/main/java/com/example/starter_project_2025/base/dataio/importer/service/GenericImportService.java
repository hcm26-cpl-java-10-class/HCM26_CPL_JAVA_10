
package com.example.starter_project_2025.base.dataio.importer.service;

import com.example.starter_project_2025.base.dataio.importer.annotation.ImportHash;
import com.example.starter_project_2025.base.dataio.importer.mapper.GenericImportMapper;
import com.example.starter_project_2025.base.dataio.importer.parser.FileParser;
import com.example.starter_project_2025.base.dataio.importer.parser.ParserFactory;
import com.example.starter_project_2025.base.dataio.importer.result.ImportResult;
import com.example.starter_project_2025.base.dataio.importer.result.RowError;
import com.example.starter_project_2025.system.management.student.Student;
import com.example.starter_project_2025.system.rbac.role.Role;
import com.example.starter_project_2025.system.rbac.role.RoleRepository;

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

    /**
     * First data row of the spreadsheet.
     * Row 1 is the header.
     */
    private static final int FIRST_DATA_ROW = 2;

    private static final int MAX_ERROR_MESSAGE_LENGTH = 500;

    private final ParserFactory parserFactory;
    private final GenericImportMapper mapper;
    private final PasswordEncoder passwordEncoder;
    private final PlatformTransactionManager transactionManager;
    private final RoleRepository roleRepository;

    @Override
    public <T, ID> ImportResult importFile(
            MultipartFile file,
            Class<T> entityClass,
            JpaRepository<T, ID> repository) {

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

                // Automatically assign STUDENT role when importing Student
                assignStudentRole(entity);

                repository.save(entity);

                result.setSuccessCount(result.getSuccessCount() + 1);

            } catch (Exception e) {

                result.getErrors().add(
                        new RowError(rowIndex, rootMessage(e))
                );

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
            JpaRepository<T, ID> repository) {

        ImportResult result = new ImportResult();

        List<Map<String, String>> rows;

        try {
            rows = parse(file);
        } catch (Exception e) {
            throw new RuntimeException("Import failed", e);
        }

        // Phase 1: Map and validate all rows in memory
        List<T> entities = new ArrayList<>(rows.size());

        int rowIndex = FIRST_DATA_ROW;

        for (Map<String, String> row : rows) {

            try {
                T entity = toEntity(row, entityClass);

                // Automatically assign STUDENT role when importing Student
                assignStudentRole(entity);

                entities.add(entity);

            } catch (Exception e) {
                result.getErrors().add(
                        new RowError(rowIndex, rootMessage(e))
                );
            }

            rowIndex++;
        }

        // If any row has an error, do not save anything
        if (!result.getErrors().isEmpty()) {
            result.setSuccessCount(0);
            result.setFailureCount(rows.size());
            return result;
        }

        // Phase 2: Save all entities in one transaction
        try {
            new TransactionTemplate(transactionManager)
                    .executeWithoutResult(status -> {

                        for (int i = 0; i < entities.size(); i++) {

                            try {
                                repository.saveAndFlush(entities.get(i));

                            } catch (Exception e) {
                                throw new RowPersistenceException(
                                        FIRST_DATA_ROW + i,
                                        e
                                );
                            }
                        }
                    });

        } catch (RowPersistenceException e) {

            result.setSuccessCount(0);
            result.setFailureCount(rows.size());

            result.getErrors().add(
                    new RowError(
                            e.getRowNumber(),
                            rootMessage(e.getCause())
                    )
            );

            return result;
        }

        result.setSuccessCount(entities.size());
        result.setFailureCount(0);

        return result;
    }

    /**
     * Parse uploaded file.
     */
    private List<Map<String, String>> parse(
            MultipartFile file) throws Exception {

        FileParser parser = parserFactory.getParser(
                file.getOriginalFilename()
        );

        return parser.parse(file.getInputStream());
    }

    /**
     * Convert spreadsheet row to entity and hash password.
     */
    private <T> T toEntity(
            Map<String, String> row,
            Class<T> entityClass) throws IllegalAccessException {

        T entity = mapper.map(row, entityClass);

        applyHash(entity);

        return entity;
    }

    /**
     * Automatically assign STUDENT role to imported Student.
     */
    private void assignStudentRole(Object entity) {

        if (!(entity instanceof Student student)) {
            return;
        }

        Role studentRole = roleRepository.findByName("STUDENT")
                .orElseThrow(() -> new IllegalStateException(
                        "Role STUDENT does not exist"
                ));

        if (student.getRoles() == null) {
            throw new IllegalStateException(
                    "Student roles collection is null"
            );
        }

        // Add role without deleting other imported roles
        student.getRoles().add(studentRole);
    }

    /**
     * Hash fields marked with @ImportHash.
     * Scan both the entity class and its parent classes.
     */
    private void applyHash(Object entity)
            throws IllegalAccessException {

        Class<?> current = entity.getClass();

        while (current != null && current != Object.class) {

            for (Field field : current.getDeclaredFields()) {

                ImportHash ann = field.getAnnotation(ImportHash.class);

                if (ann == null) {
                    continue;
                }

                field.setAccessible(true);

                Object value = field.get(entity);

                if (value instanceof String raw
                        && !raw.isBlank()
                        && !isHashed(raw)) {

                    field.set(entity, passwordEncoder.encode(raw));
                }
            }

            current = current.getSuperclass();
        }
    }

    /**
     * Check whether password is already BCrypt hashed.
     */
    private boolean isHashed(String value) {
        return value.startsWith("$2");
    }

    /**
     * Get the deepest cause message.
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
     * Carries spreadsheet row number when database saving fails.
     */
    private static final class RowPersistenceException
            extends RuntimeException {

        private final int rowNumber;

        RowPersistenceException(int rowNumber, Throwable cause) {
            super(cause);
            this.rowNumber = rowNumber;
        }

        int getRowNumber() {
            return rowNumber;
        }
    }
}
