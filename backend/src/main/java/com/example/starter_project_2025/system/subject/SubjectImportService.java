package com.example.starter_project_2025.system.subject;

import com.example.starter_project_2025.base.crud.dto.OnCreate;
import com.example.starter_project_2025.base.dataio.importer.mapper.GenericImportMapper;
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

import java.math.BigDecimal;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class SubjectImportService {
    private final SubjectImportReader reader;
    private final GenericImportMapper importMapper;
    private final SubjectMapper subjectMapper;
    private final SubjectService subjectService;
    private final Validator validator;
    private final PlatformTransactionManager transactionManager;

    @PreAuthorize("hasAuthority('SUBJECT_CREATE')")
    public ImportResult importFile(MultipartFile file) {
        return saveRows(reader.read(file));
    }

    @PreAuthorize("hasAuthority('SUBJECT_CREATE')")
    public ImportResult importRows(SubjectImportRowsRequest request) {
        return saveRows(checkedRows(request));
    }

    private ImportResult saveRows(List<SubjectImportReader.Row> rows) {
        // Commit each successful row before reading the next one. A failed row must
        // not roll back earlier rows or poison the transaction for later rows.
        TransactionTemplate rowTransaction = new TransactionTemplate(transactionManager);
        rowTransaction.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
        ImportResult result = new ImportResult();
        for (var row : rows) {
            try {
                SubjectDTO request = prepare(row.values());
                rowTransaction.execute(status -> subjectService.create(request));
                result.setSuccessCount(result.getSuccessCount() + 1);
            } catch (AccessDeniedException error) {
                throw error;
            } catch (Exception error) {
                result.getErrors().add(new RowError(row.rowNumber(), rowErrorMessage(error)));
                result.setFailureCount(result.getFailureCount() + 1);
            }
        }
        return result;
    }

    @PreAuthorize("hasAuthority('SUBJECT_CREATE')")
    public SubjectImportPreview preview(MultipartFile file) {
        return analyzeRows(reader.read(file));
    }

    @PreAuthorize("hasAuthority('SUBJECT_CREATE')")
    public SubjectImportPreview previewRows(SubjectImportRowsRequest request) {
        return analyzeRows(checkedRows(request));
    }

    private List<SubjectImportReader.Row> checkedRows(SubjectImportRowsRequest request) {
        if (request.rows() == null || request.rows().isEmpty() || request.rows().size() > SubjectImportReader.MAX_ROWS) {
            throw new BadRequestException("Provide between 1 and 1000 subject rows");
        }
        Set<Integer> numbers = new HashSet<>();
        List<SubjectImportReader.Row> rows = new ArrayList<>();
        for (var row : request.rows()) {
            if (row == null || row.rowNumber() < 2 || row.values() == null || row.values().isEmpty() || !numbers.add(row.rowNumber())) {
                throw new BadRequestException("Each edited row needs its original, unique row number and values");
            }
            rows.add(new SubjectImportReader.Row(row.rowNumber(), row.values()));
        }
        return rows;
    }

    private SubjectImportPreview analyzeRows(List<SubjectImportReader.Row> rows) {
        List<SubjectImportPreview.Row> preview = new ArrayList<>();
        Set<String> identities = new HashSet<>();
        for (var row : rows) {
            SubjectDTO request = null;
            try {
                request = prepare(row.values());
                subjectService.validateForCreate(request);
                String identity = request.getCode() + "\u0000" + request.getVersion();
                if (!identities.add(identity)) throw new BadRequestException("Duplicate code and version in this file");
                preview.add(new SubjectImportPreview.Row(row.rowNumber(), request, List.of(), editableValues(row.values())));
            } catch (AccessDeniedException error) {
                throw error;
            } catch (Exception error) {
                preview.add(new SubjectImportPreview.Row(row.rowNumber(), request, List.of(rowErrorMessage(error)), editableValues(row.values())));
            }
        }
        long valid = preview.stream().filter(SubjectImportPreview.Row::isValid).count();
        return new SubjectImportPreview(preview.size(), valid, preview.size() - valid, preview);
    }

    private Map<String, String> editableValues(Map<String, String> source) {
        List<String> columns = List.of("Code", "Name", "Version", "Technical Group", "Hours", "Description", "Status",
                "Objectives", "Skills", "Delivery Mode", "Outline");
        Map<String, String> values = new LinkedHashMap<>();
        for (String column : columns) {
            String value = source.entrySet().stream().filter(entry -> entry.getKey() != null && entry.getKey().equalsIgnoreCase(column))
                    .map(entry -> Objects.requireNonNullElse(entry.getValue(), "")).findFirst().orElse("");
            if (column.equals("Hours") && value.isEmpty()) {
                value = source.entrySet().stream().filter(entry -> entry.getKey() != null && entry.getKey().equalsIgnoreCase("Duration (Hours)"))
                        .map(entry -> Objects.requireNonNullElse(entry.getValue(), "")).findFirst().orElse("");
            }
            values.put(column, value);
        }
        return values;
    }

    private SubjectDTO prepare(Map<String, String> row) {
        SubjectDTO request = subjectMapper.toResponse(importMapper.map(normalizeRow(row), Subject.class));
        request.setIsActive(request.getStatus() != SubjectStatus.INACTIVE);
        var violations = validator.validate(request, Default.class, OnCreate.class);
        if (!violations.isEmpty()) throw new ConstraintViolationException(violations);
        return request;
    }

    private Map<String, String> normalizeRow(Map<String, String> row) {
        Map<String, String> values = new HashMap<>();
        // Preserve old templates while the UI and new export files use the shorter Hours label.
        List<String> names = List.of("Code", "Name", "Version", "Duration (Hours)", "Description", "Technical Group",
                "Status", "Objectives", "Skills", "Delivery Mode", "Outline");
        row.forEach((key, value) -> {
            String canonical = key.equalsIgnoreCase("Hours") ? "Duration (Hours)"
                    : names.stream().filter(name -> name.equalsIgnoreCase(key)).findFirst().orElse(key);
            if (values.containsKey(canonical) && !Objects.equals(values.get(canonical), value)) {
                throw new BadRequestException("Hours and Duration (Hours) must not disagree");
            }
            values.put(canonical, value);
        });
        String duration = values.get("Duration (Hours)");
        if (duration != null && !duration.isBlank()) {
            try {
                values.put("Duration (Hours)", new BigDecimal(duration.trim()).toBigIntegerExact().toString());
            } catch (ArithmeticException | NumberFormatException error) {
                throw new BadRequestException("Duration / Hours must be a whole number of hours");
            }
        }
        for (String field : List.of("Status", "Delivery Mode")) {
            if (values.get(field) != null) values.put(field, values.get(field).trim().toUpperCase(Locale.ROOT));
        }
        String status = values.get("Status");
        if (status != null && !status.isBlank() && !Set.of("ACTIVE", "INACTIVE").contains(status)) {
            throw new BadRequestException("Status must be ACTIVE or INACTIVE");
        }
        String mode = values.get("Delivery Mode");
        if (mode != null && !mode.isBlank() && !Set.of("ONLINE", "OFFLINE", "HYBRID").contains(mode)) {
            throw new BadRequestException("Delivery Mode must be ONLINE, OFFLINE or HYBRID");
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
