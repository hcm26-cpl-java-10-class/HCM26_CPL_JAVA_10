package com.example.starter_project_2025.system.subject;

import com.example.starter_project_2025.base.crud.dto.OnCreate;
import com.example.starter_project_2025.base.dataio.importer.mapper.GenericImportMapper;
import com.example.starter_project_2025.base.dataio.importer.parser.ParserFactory;
import com.example.starter_project_2025.base.dataio.importer.result.ImportResult;
import com.example.starter_project_2025.base.dataio.importer.result.RowError;
import com.example.starter_project_2025.exception.BadRequestException;
import com.example.starter_project_2025.exception.BusinessValidationException;
import jakarta.validation.ConstraintViolation;
import jakarta.validation.ConstraintViolationException;
import jakarta.validation.Validator;
import jakarta.validation.groups.Default;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.multipart.MultipartFile;

import java.io.InputStream;
import java.math.BigDecimal;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class SubjectImportService {
    private final ParserFactory parserFactory;
    private final GenericImportMapper importMapper;
    private final SubjectMapper subjectMapper;
    private final SubjectService subjectService;
    private final Validator validator;
    private final PlatformTransactionManager transactionManager;

    @PreAuthorize("hasAuthority('SUBJECT_CREATE')")
    public ImportResult importFile(MultipartFile file) {
        List<Map<String, String>> rows;
        try (InputStream input = file.getInputStream()) {
            rows = parserFactory.getParser(file.getOriginalFilename()).parse(input);
        } catch (Exception error) {
            throw new BadRequestException("Unable to read subject import file. Use a valid CSV or Excel template.");
        }

        // Commit each successful row before reading the next one. A failed row must
        // not roll back earlier rows or poison the transaction for later rows.
        TransactionTemplate rowTransaction = new TransactionTemplate(transactionManager);
        rowTransaction.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
        ImportResult result = new ImportResult();
        int rowNumber = 2;
        for (Map<String, String> row : rows) {
            try {
                SubjectDTO request = subjectMapper.toResponse(importMapper.map(normalizeRow(row), Subject.class));
                var violations = validator.validate(request, Default.class, OnCreate.class);
                if (!violations.isEmpty()) throw new ConstraintViolationException(violations);
                rowTransaction.execute(status -> subjectService.create(request));
                result.setSuccessCount(result.getSuccessCount() + 1);
            } catch (AccessDeniedException error) {
                throw error;
            } catch (Exception error) {
                result.getErrors().add(new RowError(rowNumber, rowErrorMessage(error)));
                result.setFailureCount(result.getFailureCount() + 1);
            }
            rowNumber++;
        }
        return result;
    }

    private Map<String, String> normalizeRow(Map<String, String> row) {
        Map<String, String> values = new HashMap<>(row);
        String duration = values.get("Duration (Hours)");
        if (duration != null && !duration.isBlank()) {
            try {
                // Excel's parser returns numeric cells such as 40 as "40.0".
                values.put("Duration (Hours)", new BigDecimal(duration.trim()).toBigIntegerExact().toString());
            } catch (ArithmeticException | NumberFormatException error) {
                throw new BadRequestException("Duration must be a whole number of hours");
            }
        }
        return values;
    }

    private String rowErrorMessage(Exception error) {
        if (error instanceof BusinessValidationException validation) {
            return validation.getErrors().values().stream().flatMap(List::stream)
                    .distinct().sorted().collect(Collectors.joining("; "));
        }
        if (error instanceof ConstraintViolationException validation) {
            return validation.getConstraintViolations().stream().map(ConstraintViolation::getMessage)
                    .distinct().sorted().collect(Collectors.joining("; "));
        }
        if (error instanceof DataIntegrityViolationException integrity) {
            return SubjectExceptionHandler.persistenceMessage(integrity);
        }
        return error.getMessage() != null ? error.getMessage() : "Invalid subject data";
    }
}
