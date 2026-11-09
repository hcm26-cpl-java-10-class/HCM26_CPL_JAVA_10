package com.example.starter_project_2025.base.dataio.importer.service;

import com.example.starter_project_2025.base.dataio.importer.annotation.ImportHash;
import com.example.starter_project_2025.base.dataio.importer.annotation.ImportField;
import com.example.starter_project_2025.base.dataio.importer.hook.ImportHandler;
import com.example.starter_project_2025.base.dataio.importer.mapper.GenericImportMapper;
import com.example.starter_project_2025.base.dataio.importer.parser.FileParser;
import com.example.starter_project_2025.base.dataio.importer.parser.ParserFactory;
import com.example.starter_project_2025.base.dataio.importer.resolver.RelationLookupEngine;
import com.example.starter_project_2025.base.dataio.importer.result.ImportResult;
import com.example.starter_project_2025.base.dataio.importer.result.RowError;
import lombok.RequiredArgsConstructor;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.interceptor.TransactionAspectSupport;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.web.multipart.MultipartFile;

import java.lang.reflect.Field;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.Locale;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.regex.Pattern;

@Service
@RequiredArgsConstructor
public class GenericImportService implements ImportService {

    private final ParserFactory parserFactory;
    private final GenericImportMapper mapper;
    private final PasswordEncoder passwordEncoder;
    private final List<ImportHandler<?>> handlers;
    private final RelationLookupEngine relationLookupEngine;

    /**
     * All or nothing: the whole file is imported in one transaction. When any row has an error nothing is
     * saved, and the result lists every row that has to be fixed before the file is imported again.
     */
    @Override
    @Transactional(rollbackFor = Exception.class)
    public <T, ID> ImportResult importFile(
            MultipartFile file,
            Class<T> entityClass,
            JpaRepository<T, ID> repository
    ) {

        ImportResult result = new ImportResult();

        relationLookupEngine.startCache();

        try {
            FileParser parser = parserFactory.getParser(file.getOriginalFilename());

            List<Map<String, String>> rows =
                    parser.parse(file.getInputStream());

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

            if (result.getFailureCount() > 0) {
                rollBack(result, rows, entityClass);
            }

        } catch (Exception e) {
            throw new RuntimeException("Import failed", e);
        } finally {
            relationLookupEngine.endCache();
        }

        return result;
    }

    /** Undo everything this import did and report that nothing was saved. */
    private void rollBack(ImportResult result, List<Map<String, String>> rows, Class<?> entityClass) {
        if (TransactionSynchronizationManager.isActualTransactionActive()) {
            TransactionAspectSupport.currentTransactionStatus().setRollbackOnly();
        }

        int rowsWithErrors = result.getFailureCount();

        result.setRolledBack(true);
        result.setSuccessCount(0);
        result.setUpdatedCount(0);
        result.setEmailsSent(0);
        result.setEmailsFailed(0);
        result.setEmailsSkipped(0);
        result.getCredentials().clear();
        result.setMissingCodes(missingCodes(rows, entityClass));
        result.setMessage("Nothing was imported: " + rowsWithErrors
                + " row(s) have errors. Fix the rows listed below in the file and import it again.");
    }

    /**
     * Every code used in the file (all rows, not only the first one that failed in each row) that has no
     * record yet, so they can all be added in one go instead of one round of importing per code.
     */
    private List<String> missingCodes(List<Map<String, String>> rows, Class<?> entityClass) {
        Map<String, String> missing = new LinkedHashMap<>();

        for (Field field : entityClass.getDeclaredFields()) {
            ImportField column = field.getAnnotation(ImportField.class);
            if (column == null || column.lookupEntity() == Void.class || !"code".equals(column.lookupField())) {
                continue;
            }

            String separator = column.separator().isEmpty() ? "," : column.separator();
            Set<String> checked = new HashSet<>();

            for (Map<String, String> row : rows) {
                String raw = row.get(column.name());
                if (raw == null || raw.isBlank()) {
                    continue;
                }
                for (String part : raw.split(Pattern.quote(separator))) {
                    String code = part.trim();
                    if (code.isEmpty() || !checked.add(code.toLowerCase(Locale.ROOT))) {
                        continue;
                    }
                    try {
                        relationLookupEngine.resolveSingle(code, column.lookupEntity(), "code");
                    } catch (RuntimeException e) {
                        if (e.getMessage() != null && e.getMessage().startsWith("Not found:")) {
                            missing.putIfAbsent(code.toLowerCase(Locale.ROOT), code);
                        }
                    }
                }
            }
        }
        return new ArrayList<>(missing.values());
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
