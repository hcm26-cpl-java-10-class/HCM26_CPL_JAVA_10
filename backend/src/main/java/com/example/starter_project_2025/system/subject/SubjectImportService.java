package com.example.starter_project_2025.system.subject;

import com.example.starter_project_2025.base.crud.dto.OnCreate;
import com.example.starter_project_2025.base.dataio.importer.mapper.GenericImportMapper;
import com.example.starter_project_2025.base.dataio.importer.parser.ParserFactory;
import com.example.starter_project_2025.base.dataio.importer.result.ImportResult;
import com.example.starter_project_2025.base.dataio.importer.result.RowError;
import com.example.starter_project_2025.exception.BadRequestException;
import com.example.starter_project_2025.exception.BusinessValidationException;
import com.example.starter_project_2025.system.subject.dto.TopicImportPreviewResponse;
import jakarta.validation.ConstraintViolation;
import jakarta.validation.ConstraintViolationException;
import jakarta.validation.Validator;
import jakarta.validation.groups.Default;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.InputStream;
import java.math.BigDecimal;
import java.util.*;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class SubjectImportService {
    private final ParserFactory parserFactory;
    private final GenericImportMapper importMapper;
    private final SubjectMapper subjectMapper;
    private final SubjectService subjectService;
    private final SubjectRepository subjectRepository;
    private final Validator validator;

    @PreAuthorize("hasAuthority('SUBJECT_READ')")
    public TopicImportPreviewResponse preview(MultipartFile file) {
        List<Map<String, String>> rawRows = parseFile(file);
        Set<String> seenKeys = new HashSet<>();
        List<TopicImportPreviewResponse.RowResult> rowResults = new ArrayList<>();

        int rowNumber = 2; // Row 1 is header
        for (Map<String, String> raw : rawRows) {
            Map<String, String> normalized = normalizeRow(raw);
            List<String> errors = new ArrayList<>();

            String code = normalized.get("Code");
            String name = normalized.get("Name");
            String version = normalized.get("Version");
            String technicalGroup = normalized.get("Technical Group");
            String durationStr = normalized.get("Duration (Hours)");
            String description = normalized.get("Description");
            String status = normalized.get("Status");

            Integer duration = null;
            if (durationStr != null && !durationStr.isBlank()) {
                try {
                    duration = Integer.parseInt(durationStr.trim());
                    if (duration <= 0) {
                        errors.add("Thời lượng (Hours) phải lớn hơn 0");
                    }
                } catch (Exception e) {
                    errors.add("Thời lượng (Hours) phải là số nguyên");
                }
            } else {
                errors.add("Thời lượng (Hours) không được để trống");
            }

            if (code == null || code.isBlank()) {
                errors.add("Mã môn học (Code) không được để trống");
            }
            if (name == null || name.isBlank()) {
                errors.add("Tên môn học (Name) không được để trống");
            }
            if (version == null || version.isBlank()) {
                errors.add("Phiên bản (Version) không được để trống");
            }

            // Bean validation via DTO
            try {
                SubjectDTO dto = subjectMapper.toResponse(importMapper.map(normalized, Subject.class));
                var violations = validator.validate(dto, Default.class, OnCreate.class);
                for (var v : violations) {
                    errors.add(v.getMessage());
                }
            } catch (Exception ex) {
                errors.add(rowErrorMessage(ex));
            }

            // Check duplicate in same file
            String normCode = SubjectIdentity.normalizeCode(code);
            String normVersion = SubjectIdentity.normalizeVersion(version);
            if (normCode != null && !normCode.isBlank() && normVersion != null && !normVersion.isBlank()) {
                String key = normCode + "#" + normVersion;
                if (seenKeys.contains(key)) {
                    errors.add("Trùng mã và phiên bản với dòng trước đó trong file: " + normCode + " (v" + normVersion + ")");
                } else {
                    seenKeys.add(key);
                }

                // Check duplicate in existing database
                boolean existsInDb = subjectRepository.existsByNormalizedIdentity(
                        normCode, SubjectIdentity.versionAliases(normVersion), null);
                if (existsInDb) {
                    errors.add("Môn học với mã '" + normCode + "' phiên bản '" + normVersion + "' đã tồn tại trong hệ thống.");
                }
            }

            List<String> distinctErrors = errors.stream().distinct().toList();
            boolean valid = distinctErrors.isEmpty();

            rowResults.add(new TopicImportPreviewResponse.RowResult(
                    rowNumber,
                    code,
                    name,
                    version,
                    technicalGroup,
                    duration,
                    description,
                    status != null && !status.isBlank() ? status : "ACTIVE",
                    valid,
                    distinctErrors
            ));
            rowNumber++;
        }

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
     * Import subject/topics with strict all-or-nothing rollback semantics:
     * If ANY row in the file has an error, the entire import is rejected and rolled back.
     */
    @Transactional(rollbackFor = Exception.class)
    @PreAuthorize("hasAuthority('SUBJECT_CREATE')")
    public ImportResult importFile(MultipartFile file) {
        TopicImportPreviewResponse preview = preview(file);

        if (!preview.canImport()) {
            throw new BadRequestException(
                    "Import bị từ chối (Rollback toàn bộ): Phát hiện "
                            + preview.invalidRows()
                            + " dòng có lỗi. Theo quy định, 100% dòng phải hợp lệ mới được phép Import."
            );
        }

        List<Map<String, String>> rawRows = parseFile(file);
        ImportResult result = new ImportResult();

        int rowNumber = 2;
        for (Map<String, String> raw : rawRows) {
            Map<String, String> normalized = normalizeRow(raw);
            try {
                SubjectDTO request = subjectMapper.toResponse(importMapper.map(normalized, Subject.class));
                subjectService.create(request);
                result.setSuccessCount(result.getSuccessCount() + 1);
            } catch (Exception error) {
                // If anything fails here, transaction rolls back automatically
                log.error("Error creating subject row {}: {}", rowNumber, error.getMessage(), error);
                throw new BadRequestException("Lỗi lưu dòng " + rowNumber + ": " + rowErrorMessage(error));
            }
            rowNumber++;
        }

        return result;
    }

    /**
     * Import subject/topics from parsed & edited row list with strict all-or-nothing rollback semantics:
     * If ANY row fails validation or persistence, the whole operation is rejected and rolled back.
     */
    @Transactional(rollbackFor = Exception.class)
    @PreAuthorize("hasAuthority('SUBJECT_CREATE')")
    public ImportResult commitRows(List<SubjectDTO> rows) {
        if (rows == null || rows.isEmpty()) {
            throw new BadRequestException("Danh sách môn học không được để trống.");
        }

        Set<String> seenKeys = new HashSet<>();
        int rowNumber = 1;
        for (SubjectDTO row : rows) {
            String code = row.getCode();
            String name = row.getName();
            String version = row.getVersion();
            Integer duration = row.getDurationHours();

            if (code == null || code.isBlank()) {
                throw new BadRequestException("Dòng " + rowNumber + ": Mã môn học (Code) không được để trống.");
            }
            if (name == null || name.isBlank()) {
                throw new BadRequestException("Dòng " + rowNumber + ": Tên môn học (Name) không được để trống.");
            }
            if (version == null || version.isBlank()) {
                throw new BadRequestException("Dòng " + rowNumber + ": Phiên bản (Version) không được để trống.");
            }
            if (duration == null || duration <= 0) {
                throw new BadRequestException("Dòng " + rowNumber + ": Thời lượng (Hours) phải lớn hơn 0.");
            }

            var violations = validator.validate(row, Default.class, OnCreate.class);
            if (!violations.isEmpty()) {
                throw new BadRequestException("Dòng " + rowNumber + ": " + violations.iterator().next().getMessage());
            }

            String normCode = SubjectIdentity.normalizeCode(code);
            String normVersion = SubjectIdentity.normalizeVersion(version);
            String key = normCode + "#" + normVersion;
            if (seenKeys.contains(key)) {
                throw new BadRequestException("Dòng " + rowNumber + ": Trùng mã và phiên bản trong danh sách: " + normCode + " (v" + normVersion + ")");
            }
            seenKeys.add(key);

            boolean existsInDb = subjectRepository.existsByNormalizedIdentity(
                    normCode, SubjectIdentity.versionAliases(normVersion), null);
            if (existsInDb) {
                throw new BadRequestException("Dòng " + rowNumber + ": Môn học với mã '" + normCode + "' phiên bản '" + normVersion + "' đã tồn tại trong hệ thống.");
            }

            rowNumber++;
        }

        ImportResult result = new ImportResult();
        for (SubjectDTO row : rows) {
            subjectService.create(row);
            result.setSuccessCount(result.getSuccessCount() + 1);
        }
        return result;
    }

    private List<Map<String, String>> parseFile(MultipartFile file) {
        try (InputStream input = file.getInputStream()) {
            return parserFactory.getParser(file.getOriginalFilename()).parse(input);
        } catch (Exception error) {
            throw new BadRequestException("Không thể đọc file import. Vui lòng sử dụng file CSV hoặc Excel hợp lệ.");
        }
    }

    private Map<String, String> normalizeRow(Map<String, String> row) {
        Map<String, String> values = new HashMap<>();

        // Map common aliases to canonical header names
        for (Map.Entry<String, String> entry : row.entrySet()) {
            if (entry.getKey() == null) continue;
            String key = entry.getKey().trim();
            String normKey = key.toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9]", "");

            if (normKey.equals("code") || normKey.equals("topiccode") || normKey.equals("subjectcode")) {
                values.put("Code", entry.getValue());
            } else if (normKey.equals("name") || normKey.equals("topicname") || normKey.equals("subjectname")) {
                values.put("Name", entry.getValue());
            } else if (normKey.equals("version") || normKey.equals("topicversion")) {
                values.put("Version", entry.getValue());
            } else if (normKey.equals("technicalgroup") || normKey.equals("techgroup") || normKey.equals("group")) {
                values.put("Technical Group", entry.getValue());
            } else if (normKey.startsWith("duration")) {
                values.put("Duration (Hours)", entry.getValue());
            } else if (normKey.equals("description") || normKey.equals("desc")) {
                values.put("Description", entry.getValue());
            } else if (normKey.equals("status")) {
                values.put("Status", entry.getValue());
            } else {
                values.put(key, entry.getValue());
            }
        }

        String duration = values.get("Duration (Hours)");
        if (duration != null && !duration.isBlank()) {
            try {
                // Excel's parser returns numeric cells such as 40 as "40.0".
                values.put("Duration (Hours)", new BigDecimal(duration.trim()).toBigIntegerExact().toString());
            } catch (ArithmeticException | NumberFormatException error) {
                try {
                    int rounded = (int) Math.round(Double.parseDouble(duration.trim()));
                    values.put("Duration (Hours)", String.valueOf(rounded));
                } catch (Exception ex) {
                    values.put("Duration (Hours)", duration.trim());
                }
            }
        }

        String status = values.get("Status");
        if (status != null && !status.isBlank()) {
            String normStatus = status.trim().toUpperCase(Locale.ROOT);
            if ("HOẠT ĐỘNG".equals(normStatus) || "DANG HOAT DONG".equals(normStatus) || "TRUE".equals(normStatus) || "1".equals(normStatus)) {
                normStatus = "ACTIVE";
            } else if ("NGỪNG HOẠT ĐỘNG".equals(normStatus) || "NGUNG HOAT DONG".equals(normStatus) || "FALSE".equals(normStatus) || "0".equals(normStatus)) {
                normStatus = "INACTIVE";
            }
            values.put("Status", normStatus);
        } else {
            values.put("Status", "ACTIVE");
        }

        return values;
    }

    private String rowErrorMessage(Exception error) {
        Throwable cause = error;
        while (cause.getCause() != null && cause.getCause() != cause) {
            cause = cause.getCause();
        }
        String msg = cause.getMessage();
        if (msg != null && msg.contains("No enum constant")) {
            return "Trạng thái không hợp lệ. Vui lòng nhập ACTIVE hoặc INACTIVE.";
        }
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
        return msg != null ? msg : "Dữ liệu môn học không hợp lệ";
    }
}
