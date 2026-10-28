package com.example.starter_project_2025.base.dataio.importer.service;

import com.example.starter_project_2025.base.dataio.importer.annotation.ImportHash;
import com.example.starter_project_2025.base.dataio.importer.mapper.GenericImportMapper;
import com.example.starter_project_2025.base.dataio.importer.parser.FileParser;
import com.example.starter_project_2025.base.dataio.importer.parser.ParserFactory;
import com.example.starter_project_2025.base.dataio.importer.result.ImportResult;
import com.example.starter_project_2025.base.dataio.importer.result.ImportRolledBackException;
import com.example.starter_project_2025.base.dataio.importer.result.RowError;
import lombok.RequiredArgsConstructor;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
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


    @Override
    @Transactional
    public <T, ID> ImportResult importFile(
            MultipartFile file,
            Class<T> entityClass,
            JpaRepository<T, ID> repository
    ) {

        ImportResult result = new ImportResult();

        List<Map<String, String>> rows;
        try {
            FileParser parser = parserFactory.getParser(file.getOriginalFilename());
            rows = parser.parse(file.getInputStream());
        } catch (Exception e) {
            throw new RuntimeException("Import failed", e);
        }

        int rowIndex = 2;

        for (Map<String, String> row : rows) {

            try {
                T entity = mapper.map(row, entityClass);

                applyHash(entity);

                repository.saveAndFlush(entity);

                result.setSuccessCount(result.getSuccessCount() + 1);

            } catch (Exception e) {

                boolean stop = ImportRolledBackException.isPersistenceFailure(e);
                String message = stop
                        ? ImportRolledBackException.describe(e)
                          + " (import stopped here, the remaining rows were not checked)"
                        : e.getMessage();

                result.getErrors().add(new RowError(rowIndex, message));
                result.setFailureCount(result.getFailureCount() + 1);

                if (stop) {
                    break;
                }
            }

            rowIndex++;
        }

        if (result.getFailureCount() > 0) {
            throw new ImportRolledBackException(result);
        }

        return result;
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