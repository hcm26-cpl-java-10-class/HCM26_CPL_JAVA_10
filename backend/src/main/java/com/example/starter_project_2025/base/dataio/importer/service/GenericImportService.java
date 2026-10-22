package com.example.starter_project_2025.base.dataio.importer.service;

import com.example.starter_project_2025.base.dataio.importer.annotation.ImportField;
import com.example.starter_project_2025.base.dataio.importer.annotation.ImportHash;
import com.example.starter_project_2025.base.dataio.importer.annotation.ImportUpsert;
import com.example.starter_project_2025.base.dataio.importer.mapper.GenericImportMapper;
import com.example.starter_project_2025.base.dataio.importer.parser.FileParser;
import com.example.starter_project_2025.base.dataio.importer.parser.ParserFactory;
import com.example.starter_project_2025.base.dataio.importer.result.ImportResult;
import com.example.starter_project_2025.base.dataio.importer.result.RowError;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceException;
import jakarta.persistence.TypedQuery;
import jakarta.persistence.criteria.CriteriaBuilder;
import jakarta.persistence.criteria.CriteriaQuery;
import jakarta.persistence.criteria.Root;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.lang.reflect.Field;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class GenericImportService implements ImportService {

    private final ParserFactory parserFactory;
    private final GenericImportMapper mapper;
    private final PasswordEncoder passwordEncoder;
    private final EntityManager entityManager;

    @Override
    public <T, ID> ImportResult importFile(
            MultipartFile file,
            Class<T> entityClass,
            JpaRepository<T, ID> repository
    ) {
        ImportResult result = new ImportResult();

        try {
            FileParser parser = parserFactory.getParser(file.getOriginalFilename());
            List<Map<String, String>> rows = parser.parse(file.getInputStream());
            int rowIndex = 2; // Header is row 1 in the spreadsheet.

            for (Map<String, String> row : rows) {
                try {
                    T importedEntity = mapper.map(row, entityClass);
                    applyHash(importedEntity);

                    ImportUpsert upsert = entityClass.getAnnotation(ImportUpsert.class);
                    if (upsert == null) {
                        // Preserve the existing behavior for every entity that has not opted in.
                        repository.save(importedEntity);
                    } else {
                        upsertAndSave(row, entityClass, repository, importedEntity, upsert);
                    }

                    result.setSuccessCount(result.getSuccessCount() + 1);
                } catch (Exception e) {
                    result.getErrors().add(new RowError(rowIndex,
                            readableError(e, entityClass, row)));
                    result.setFailureCount(result.getFailureCount() + 1);
                }
                rowIndex++;
            }
        } catch (Exception e) {
            throw new RuntimeException("Unable to read import file. Check that it is a valid Excel or CSV file.", e);
        }
        return result;
    }

    private <T, ID> void upsertAndSave(
            Map<String, String> row,
            Class<T> entityClass,
            JpaRepository<T, ID> repository,
            T importedEntity,
            ImportUpsert upsert
    ) throws Exception {
        Field keyField = findField(entityClass, upsert.keyField());
        keyField.setAccessible(true);
        Object keyValue = keyField.get(importedEntity);

        if (keyValue == null || keyValue.toString().isBlank()) {
            throw new IllegalArgumentException(upsert.keyField() + " is required to identify the " + upsert.displayName() + ".");
        }

        T existing = findExisting(entityClass, keyField.getName(), keyValue);
        if (existing == null) {
            repository.save(importedEntity);
            return;
        }

        // Update only fields explicitly marked as importable and present in the file.
        // A blank optional cell clears that field; a missing column leaves it unchanged.
        for (Field field : entityClass.getDeclaredFields()) {
            ImportField importField = field.getAnnotation(ImportField.class);
            if (importField == null || !row.containsKey(importField.name())) {
                continue;
            }
            field.setAccessible(true);
            field.set(existing, field.get(importedEntity));
        }
        repository.save(existing);
    }

    private <T> T findExisting(Class<T> entityClass, String keyFieldName, Object keyValue) throws Exception {
        CriteriaBuilder cb = entityManager.getCriteriaBuilder();
        CriteriaQuery<T> criteria = cb.createQuery(entityClass);
        Root<T> root = criteria.from(entityClass);
        criteria.select(root).where(cb.equal(root.get(keyFieldName), keyValue));
        TypedQuery<T> query = entityManager.createQuery(criteria);
        query.setMaxResults(1);
        return query.getResultStream().findFirst().orElse(null);
    }

    private Field findField(Class<?> type, String name) throws NoSuchFieldException {
        Class<?> current = type;
        while (current != null && current != Object.class) {
            try {
                return current.getDeclaredField(name);
            } catch (NoSuchFieldException ignored) {
                current = current.getSuperclass();
            }
        }
        throw new NoSuchFieldException("Import upsert key field '" + name + "' was not found on " + type.getSimpleName());
    }

    private void applyHash(Object entity) throws IllegalAccessException {
        for (Field field : entity.getClass().getDeclaredFields()) {
            if (field.getAnnotation(ImportHash.class) == null) continue;
            field.setAccessible(true);
            Object value = field.get(entity);
            if (value instanceof String raw && !isHashed(raw)) {
                field.set(entity, passwordEncoder.encode(raw));
            }
        }
    }

    private boolean isHashed(String value) {
        return value.startsWith("$2");
    }

    private String readableError(Exception exception, Class<?> entityClass, Map<String, String> row) {
        ImportUpsert upsert = entityClass.getAnnotation(ImportUpsert.class);
        Throwable root = exception;
        while (root.getCause() != null && root.getCause() != root) root = root.getCause();

        if (upsert != null) {
            String keyColumn = upsert.keyField();
            try {
                Field keyField = findField(entityClass, upsert.keyField());
                ImportField importField = keyField.getAnnotation(ImportField.class);
                if (importField != null) keyColumn = importField.name();
            } catch (NoSuchFieldException ignored) {
                // The configuration error is reported by the upsert operation itself.
            }
            String key = row.get(keyColumn);
            String keyLabel = key == null || key.isBlank()
                    ? keyColumn + " is blank"
                    : keyColumn + " '" + key.trim() + "'";

            if (exception instanceof DataIntegrityViolationException
                    || root instanceof PersistenceException
                    || containsDatabaseConstraintMessage(root.getMessage())) {
                return "Could not save " + upsert.displayName() + " with " + keyLabel
                        + ". Check duplicate values and required fields.";
            }
            String message = firstUsefulMessage(exception);
            return "Could not import " + upsert.displayName() + " with " + keyLabel + ": " + message;
        }

        // Avoid exposing a huge SQL statement to users for generic imports too.
        if (exception instanceof DataIntegrityViolationException || root instanceof PersistenceException
                || containsDatabaseConstraintMessage(root.getMessage())) {
            return "Database constraint violation. Check required fields and ensure unique values are not duplicated.";
        }
        return firstUsefulMessage(exception);
    }

    private boolean containsDatabaseConstraintMessage(String message) {
        if (message == null) return false;
        String lower = message.toLowerCase();
        return lower.contains("unique index") || lower.contains("unique constraint")
                || lower.contains("primary key violation") || lower.contains("constraint violation")
                || lower.contains("could not execute statement");
    }

    private String firstUsefulMessage(Exception exception) {
        Throwable current = exception;
        while (current != null) {
            String message = current.getMessage();
            if (message != null && !message.isBlank()
                    && !containsDatabaseConstraintMessage(message)
                    && !message.toLowerCase().contains("sql statement:")) {
                return message.length() > 240 ? message.substring(0, 237) + "..." : message;
            }
            current = current.getCause();
        }
        return "Please check the values in this row.";
    }
}
