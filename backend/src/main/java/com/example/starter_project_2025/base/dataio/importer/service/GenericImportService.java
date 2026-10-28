package com.example.starter_project_2025.base.dataio.importer.service;

import com.example.starter_project_2025.base.dataio.importer.annotation.ImportHash;
import com.example.starter_project_2025.base.dataio.importer.hook.ImportHandler;
import com.example.starter_project_2025.base.dataio.importer.mapper.GenericImportMapper;
import com.example.starter_project_2025.base.dataio.importer.parser.FileParser;
import com.example.starter_project_2025.base.dataio.importer.parser.ParserFactory;
import com.example.starter_project_2025.base.dataio.importer.result.ImportResult;
import com.example.starter_project_2025.base.dataio.importer.result.RowError;
import lombok.RequiredArgsConstructor;
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
    private final List<ImportHandler<?>> handlers;

    @Override
    public <T, ID> ImportResult importFile(
            MultipartFile file,
            Class<T> entityClass,
            JpaRepository<T, ID> repository) {

        ImportResult result = new ImportResult();

        try {
            FileParser parser = parserFactory.getParser(file.getOriginalFilename());

            List<Map<String, String>> rows = parser.parse(file.getInputStream());

            result.setTotalCount(rows.size());

            ImportHandler<T> handler = findHandler(entityClass);

            if (handler != null) {
                handler.beforeImport(rows);
            }

            try {
                int rowIndex = 2;

                for (Map<String, String> row : rows) {

                    rowIndex = FileParser.rowNumberOf(row, rowIndex);

                    try {
                        if (handler != null && handler.shouldSkip(row)) {
                            result.setSkippedCount(result.getSkippedCount() + 1);
                            rowIndex++;
                            continue;
                        }

                        T entity = handler != null
                                ? handler.resolveExisting(row).orElse(null)
                                : null;

                        if (entity == null) {
                            entity = mapper.map(row, entityClass);
                        }

                        if (handler != null) {
                            handler.beforeSave(entity, row);
                        }

                        applyHash(entity);

                        repository.save(entity);

                        result.setSuccessCount(result.getSuccessCount() + 1);

                        if (handler != null) {
                            handler.afterSave(entity, row, rowIndex, result);
                        }

                    } catch (Exception e) {

                        result.getErrors().add(
                                new RowError(rowIndex, e.getMessage()));

                        result.setFailureCount(result.getFailureCount() + 1);
                    }

                    rowIndex++;
                }

            } finally {
                if (handler != null) {
                    handler.afterImport();
                }
            }

        } catch (Exception e) {
            throw new RuntimeException("Import failed", e);
        }

        return result;
    }

    @SuppressWarnings("unchecked")
    private <T> ImportHandler<T> findHandler(Class<T> entityClass) {
        for (ImportHandler<?> handler : handlers) {
            if (handler.entityType().equals(entityClass)) {
                return (ImportHandler<T>) handler;
            }
        }
        return null;
    }

    private void applyHash(Object entity) throws IllegalAccessException {

        for (Field field : entity.getClass().getDeclaredFields()) {

            ImportHash ann = field.getAnnotation(ImportHash.class);
            if (ann == null)
                continue;

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
