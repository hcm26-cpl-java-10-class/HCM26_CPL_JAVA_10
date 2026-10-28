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
    public <T, ID> ImportResult importFile(
            MultipartFile file,
            Class<T> entityClass,
            JpaRepository<T, ID> repository
    ) {

        ImportResult result = new ImportResult();

        try {
            FileParser parser = parserFactory.getParser(file.getOriginalFilename());

            List<Map<String, String>> rows =
                    parser.parse(file.getInputStream());

            int rowIndex = 2;

            for (Map<String, String> row : rows) {

                try {
                    T entity = mapper.map(row, entityClass);

                    applyHash(entity);

                    repository.save(entity);

                    result.setSuccessCount(result.getSuccessCount() + 1);

                } catch (Exception e) {

                    result.getErrors().add(
                            new RowError(rowIndex, e.getMessage()));

                    result.setFailureCount(result.getFailureCount() + 1);
                }

                rowIndex++;
            }

        } catch (Exception e) {
            throw new RuntimeException("Import failed", e);
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
