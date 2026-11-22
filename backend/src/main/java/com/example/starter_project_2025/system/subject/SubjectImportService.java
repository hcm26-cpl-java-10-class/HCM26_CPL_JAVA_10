package com.example.starter_project_2025.system.subject;

import com.example.starter_project_2025.base.dataio.importer.parser.ParserFactory;
import com.example.starter_project_2025.base.dataio.importer.result.ImportResult;
import com.example.starter_project_2025.exception.BadRequestException;
import com.example.starter_project_2025.system.subject.dto.TopicImportPreviewResponse;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.InputStream;
import java.math.BigDecimal;
import java.util.*;

@Slf4j
@Service
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class SubjectImportService {

    ParserFactory parserFactory;
    SubjectMapper subjectMapper;
    SubjectRepository subjectRepository;
    SubjectValidator subjectValidator;

    @PreAuthorize("hasAuthority('SUBJECT_READ')")
    public TopicImportPreviewResponse preview(MultipartFile file) {
        List<ParsedRow> parsedRows = parseRows(file);
        List<ValidatedRow> validated = validateBatch(parsedRows);

        List<TopicImportPreviewResponse.RowResult> rowResults = validated.stream()
                .map(ValidatedRow::toRowResult)
                .toList();

        int invalidCount = (int) rowResults.stream().filter(r -> !r.valid()).count();
        int validCount = rowResults.size() - invalidCount;
        boolean canImport = invalidCount == 0 && !rowResults.isEmpty();

        return new TopicImportPreviewResponse(
                rowResults.size(),
                validCount,
                invalidCount,
                canImport,
                rowResults
        );
    }

    /**
     * Imports topics from Excel/CSV with strict all-or-nothing rollback semantics.
     */
    @Transactional(rollbackFor = Exception.class)
    @PreAuthorize("hasAuthority('SUBJECT_CREATE')")
    public ImportResult importFile(MultipartFile file) {
        List<ParsedRow> parsedRows = parseRows(file);
        if (parsedRows.isEmpty()) {
            throw new BadRequestException("Import rejected (Strict Rollback): Uploaded file contains no data rows.");
        }

        List<ValidatedRow> validated = validateBatch(parsedRows);
        long invalidCount = validated.stream().filter(r -> !r.errors().isEmpty()).count();
        if (invalidCount > 0) {
            throw new BadRequestException(
                    "Import rejected (Strict Rollback): Found "
                            + invalidCount
                            + " row(s) with errors. 100% of rows must be valid to import."
            );
        }

        return persistBatch(validated.stream().map(ValidatedRow::dto).toList());
    }

    /**
     * Imports edited preview rows with strict all-or-nothing rollback and full multi-row validation feedback.
     */
    @Transactional(rollbackFor = Exception.class)
    @PreAuthorize("hasAuthority('SUBJECT_CREATE')")
    public ImportResult commitRows(List<SubjectDTO> rows) {
        if (rows == null || rows.isEmpty()) {
            throw new BadRequestException("Import topic list cannot be empty.");
        }

        List<ParsedRow> parsedRows = new ArrayList<>(rows.size());
        for (int i = 0; i < rows.size(); i++) {
            SubjectDTO row = rows.get(i);
            subjectValidator.normalizeForCreate(row);
            String statusText = row.getStatus() != null ? row.getStatus().name() : SubjectStatus.ACTIVE.name();
            parsedRows.add(new ParsedRow(i + 1, row, false, List.of(), statusText));
        }

        List<ValidatedRow> validated = validateBatch(parsedRows);
        List<String> allRowErrors = validated.stream()
                .filter(r -> !r.errors().isEmpty())
                .map(r -> "Row " + r.rowNumber() + ": " + String.join(", ", r.errors()))
                .toList();

        if (!allRowErrors.isEmpty()) {
            throw new BadRequestException(String.join(" | ", allRowErrors));
        }

        return persistBatch(validated.stream().map(ValidatedRow::dto).toList());
    }

    private ImportResult persistBatch(List<SubjectDTO> dtos) {
        try {
            List<Subject> entities = dtos.stream()
                    .map(subjectMapper::toEntity)
                    .toList();
            List<Subject> saved = subjectRepository.saveAll(entities);
            ImportResult result = new ImportResult();
            result.setTotalCount(saved.size());
            result.setSuccessCount(saved.size());
            return result;
        } catch (DataIntegrityViolationException error) {
            throw new BadRequestException(SubjectExceptionHandler.persistenceMessage(error));
        }
    }

    private List<ValidatedRow> validateBatch(List<ParsedRow> parsedRows) {
        List<SubjectDTO> allDtos = parsedRows.stream().map(ParsedRow::dto).toList();
        Set<String> existingDbKeys = subjectValidator.findExistingIdentityKeys(allDtos);
        Set<String> seenKeys = new HashSet<>();

        List<ValidatedRow> results = new ArrayList<>(parsedRows.size());
        for (ParsedRow row : parsedRows) {
            SubjectDTO dto = row.dto();
            List<String> errors = new ArrayList<>(row.parseErrors());
            errors.addAll(subjectValidator.validateDtoConstraints(dto, row.hasDurationParseError()));

            String key = SubjectIdentity.identityKey(dto.getCode(), dto.getVersion());
            if (key != null) {
                if (!seenKeys.add(key)) {
                    errors.add("Duplicate Code and Version in import data: "
                            + dto.getCode() + " (v" + dto.getVersion() + ")");
                }
                if (existingDbKeys.contains(key)) {
                    errors.add("Topic with Code '" + dto.getCode()
                            + "' and Version '" + dto.getVersion() + "' already exists in system.");
                }
            }

            List<String> distinctErrors = errors.stream().distinct().toList();
            results.add(new ValidatedRow(row.rowNumber(), dto, row.rawStatus(), distinctErrors));
        }
        return results;
    }

    private List<ParsedRow> parseRows(MultipartFile file) {
        List<Map<String, String>> rawRows = readFileRows(file);
        List<ParsedRow> parsed = new ArrayList<>(rawRows.size());

        int rowNumber = 2; // Row 1 is header
        for (Map<String, String> raw : rawRows) {
            parsed.add(toParsedRow(rowNumber++, raw));
        }
        return parsed;
    }

    private List<Map<String, String>> readFileRows(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new BadRequestException("Import file cannot be empty.");
        }
        try (InputStream input = file.getInputStream()) {
            return parserFactory.getParser(file.getOriginalFilename()).parse(input);
        } catch (Exception error) {
            throw new BadRequestException("Cannot read import file. Please use a valid CSV or Excel file.");
        }
    }

    private ParsedRow toParsedRow(int rowNumber, Map<String, String> rawRow) {
        Map<String, String> canonical = canonicalizeHeaders(rawRow);
        List<String> parseErrors = new ArrayList<>();

        String durationRaw = canonical.get("Duration (Hours)");
        Integer duration = null;
        boolean hasDurationParseError = false;
        if (durationRaw != null && !durationRaw.isBlank()) {
            try {
                duration = new BigDecimal(durationRaw.trim()).toBigIntegerExact().intValueExact();
            } catch (ArithmeticException | NumberFormatException ex) {
                parseErrors.add("Duration (Hours) must be a valid integer");
                hasDurationParseError = true;
            }
        }

        String statusRaw = canonical.get("Status");
        SubjectStatus parsedStatus = SubjectStatus.ACTIVE;
        String displayStatus = "ACTIVE";
        if (statusRaw != null && !statusRaw.isBlank()) {
            SubjectStatus resolved = parseStatus(statusRaw);
            if (resolved == null) {
                parseErrors.add("Invalid status. Please enter ACTIVE or INACTIVE.");
                displayStatus = statusRaw.trim();
            } else {
                parsedStatus = resolved;
                displayStatus = resolved.name();
            }
        }

        SubjectDTO dto = SubjectDTO.builder()
                .code(canonical.get("Code"))
                .name(canonical.get("Name"))
                .version(canonical.get("Version"))
                .technicalGroup(canonical.get("Technical Group"))
                .description(canonical.get("Description"))
                .durationHours(duration)
                .status(parsedStatus)
                .build();
        dto.setIsActive(parsedStatus == SubjectStatus.ACTIVE);

        subjectValidator.normalizeForCreate(dto);
        return new ParsedRow(rowNumber, dto, hasDurationParseError, parseErrors, displayStatus);
    }

    private Map<String, String> canonicalizeHeaders(Map<String, String> row) {
        Map<String, String> values = new HashMap<>();
        for (Map.Entry<String, String> entry : row.entrySet()) {
            if (entry.getKey() == null) continue;
            String key = entry.getKey().trim();
            String normKey = key.toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9]", "");

            switch (normKey) {
                case "code", "topiccode", "subjectcode" -> values.put("Code", entry.getValue());
                case "name", "topicname", "subjectname" -> values.put("Name", entry.getValue());
                case "version", "topicversion" -> values.put("Version", entry.getValue());
                case "technicalgroup", "techgroup", "group" -> values.put("Technical Group", entry.getValue());
                case "description", "desc" -> values.put("Description", entry.getValue());
                case "status" -> values.put("Status", entry.getValue());
                default -> {
                    if (normKey.startsWith("duration")) {
                        values.put("Duration (Hours)", entry.getValue());
                    } else {
                        values.put(key, entry.getValue());
                    }
                }
            }
        }
        return values;
    }

    private SubjectStatus parseStatus(String raw) {
        String normalized = raw.trim().toUpperCase(Locale.ROOT);
        return switch (normalized) {
            case "ACTIVE", "HOẠT ĐỘNG", "DANG HOAT DONG", "TRUE", "1" -> SubjectStatus.ACTIVE;
            case "INACTIVE", "NGỪNG HOẠT ĐỘNG", "NGUNG HOAT DONG", "FALSE", "0" -> SubjectStatus.INACTIVE;
            default -> null;
        };
    }

    private record ParsedRow(
            int rowNumber,
            SubjectDTO dto,
            boolean hasDurationParseError,
            List<String> parseErrors,
            String rawStatus
    ) {}

    private record ValidatedRow(
            int rowNumber,
            SubjectDTO dto,
            String rawStatus,
            List<String> errors
    ) {
        TopicImportPreviewResponse.RowResult toRowResult() {
            return new TopicImportPreviewResponse.RowResult(
                    rowNumber,
                    dto.getCode(),
                    dto.getName(),
                    dto.getVersion(),
                    dto.getTechnicalGroup(),
                    dto.getDurationHours(),
                    dto.getDescription(),
                    rawStatus,
                    errors.isEmpty(),
                    errors
            );
        }
    }
}
