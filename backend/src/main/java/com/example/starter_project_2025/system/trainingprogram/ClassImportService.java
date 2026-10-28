package com.example.starter_project_2025.system.trainingprogram;

import com.example.starter_project_2025.base.dataio.importer.parser.ParserFactory;
import com.example.starter_project_2025.base.dataio.importer.result.ImportResult;
import com.example.starter_project_2025.base.dataio.importer.result.RowError;
import com.example.starter_project_2025.exception.BadRequestException;
import com.example.starter_project_2025.system.external_api.ExternalApiService;
import com.example.starter_project_2025.system.external_api.dto.ExternalClassDTO;
import com.example.starter_project_2025.system.external_api.dto.ExternalClassRequest;
import jakarta.validation.ConstraintViolation;
import jakarta.validation.Validator;
import lombok.RequiredArgsConstructor;
import org.apache.poi.ss.usermodel.DateUtil;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.InputStream;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class ClassImportService {
    private static final List<DateTimeFormatter> DATE_FORMATS = List.of(
            DateTimeFormatter.ofPattern("d-MMM-yyyy", Locale.ENGLISH),
            DateTimeFormatter.ofPattern("M/d/yy", Locale.US),
            DateTimeFormatter.ofPattern("M/d/yyyy", Locale.US),
            DateTimeFormatter.ofPattern("d/M/yyyy", Locale.UK),
            DateTimeFormatter.ofPattern("dd-MM-yyyy", Locale.ROOT)
    );

    private final ParserFactory parserFactory;
    private final ClassSetupService classSetupService;
    private final ExternalApiService externalApiService;
    private final TrainingProgramRepository trainingProgramRepository;
    private final Validator validator;

    public ImportResult importFile(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new BadRequestException("File import lớp không được để trống.");
        }

        String filename = file.getOriginalFilename();
        if (filename == null || !(filename.toLowerCase(Locale.ROOT).endsWith(".xlsx")
                || filename.toLowerCase(Locale.ROOT).endsWith(".csv"))) {
            throw new BadRequestException("Chỉ hỗ trợ file Excel .xlsx hoặc CSV .csv.");
        }

        List<Map<String, String>> rows;
        try (InputStream input = file.getInputStream()) {
            rows = parserFactory.getParser(filename.toLowerCase(Locale.ROOT)).parse(input);
        } catch (Exception error) {
            throw new BadRequestException("Không đọc được file lớp học. Hãy dùng mẫu Excel tải từ trang này.");
        }
        if (rows.isEmpty()) {
            throw new BadRequestException("File không có dòng dữ liệu để import.");
        }

        Set<String> existingCodes = externalApiService.fetchClasses(null).stream()
                .map(ExternalClassDTO::getCode)
                .filter(code -> code != null && !code.isBlank())
                .map(this::normalizeCode)
                .collect(Collectors.toCollection(HashSet::new));
        Set<String> fileCodes = new HashSet<>();
        List<TrainingProgram> activePrograms = trainingProgramRepository.findAll().stream()
                .filter(program -> program.getStatus() == ProgramStatus.ACTIVE)
                .toList();
        ImportResult result = new ImportResult();
        List<PreparedRow> preparedRows = new ArrayList<>();
        List<RowError> validationErrors = new ArrayList<>();
        int dataRowCount = 0;

        for (int index = 0; index < rows.size(); index++) {
            Map<String, String> row = rows.get(index);
            int rowNumber = index + 2;
            if (isBlankRow(row)) continue;

            dataRowCount++;
            try {
                ParsedClass parsed = parseRow(row, activePrograms);
                String normalizedCode = normalizeCode(parsed.request().code());
                if (existingCodes.contains(normalizedCode)) {
                    throw new IllegalArgumentException("Mã lớp đã tồn tại trong hệ thống.");
                }
                if (!fileCodes.add(normalizedCode)) {
                    throw new IllegalArgumentException("Mã lớp bị trùng trong file import.");
                }

                Set<ConstraintViolation<ExternalClassRequest>> violations = validator.validate(parsed.request());
                if (!violations.isEmpty()) {
                    throw new IllegalArgumentException(violations.stream()
                            .map(ConstraintViolation::getMessage).distinct().sorted().collect(Collectors.joining("; ")));
                }

                preparedRows.add(new PreparedRow(rowNumber, parsed));
            } catch (Exception error) {
                validationErrors.add(new RowError(rowNumber, errorMessage(error, "Dữ liệu không hợp lệ.")));
            }
        }

        if (dataRowCount == 0) {
            throw new BadRequestException("File không có dòng dữ liệu để import.");
        }

        if (!validationErrors.isEmpty()) {
            result.setFailureCount(dataRowCount);
            result.getErrors().addAll(validationErrors.stream()
                    .map(error -> new RowError(error.getRowNumber(), error.getMessage()
                            + " Toàn bộ file đã bị hủy, không có lớp nào được tạo."))
                    .toList());
            Set<Integer> rowsWithErrors = validationErrors.stream()
                    .map(RowError::getRowNumber)
                    .collect(Collectors.toSet());
            preparedRows.stream()
                    .filter(row -> !rowsWithErrors.contains(row.rowNumber()))
                    .forEach(row -> result.getErrors().add(new RowError(row.rowNumber(),
                            "Dòng hợp lệ nhưng chưa được tạo vì file có lỗi; toàn bộ import đã bị hủy.")));
            return result;
        }

        List<CreatedClass> createdClasses = new ArrayList<>();
        int failedRowNumber = -1;
        try {
            for (PreparedRow row : preparedRows) {
                failedRowNumber = row.rowNumber();
                ExternalClassDTO created = classSetupService.createClass(row.parsed().request());
                if (created == null || created.getId() == null) {
                    throw new IllegalStateException("API không trả về ID của lớp vừa tạo nên không thể tiếp tục import an toàn.");
                }
                createdClasses.add(new CreatedClass(row.rowNumber(), created.getId(), created.getCode()));
                if (row.parsed().program() != null) {
                    classSetupService.assignProgram(created.getId(), row.parsed().program().getId());
                }
            }
            result.setSuccessCount(preparedRows.size());
            return result;
        } catch (Exception error) {
            String message = "Import thất bại: " + errorMessage(error, "Lỗi khi lưu dữ liệu.")
                    + " Toàn bộ file đã bị hủy.";
            result.setFailureCount(dataRowCount);
            result.getErrors().add(new RowError(failedRowNumber, message));

            Set<Integer> rowsWithErrors = new HashSet<>();
            rowsWithErrors.add(failedRowNumber);
            for (int index = createdClasses.size() - 1; index >= 0; index--) {
                CreatedClass created = createdClasses.get(index);
                try {
                    classSetupService.deleteClass(created.id());
                } catch (Exception cleanupError) {
                    rowsWithErrors.add(created.rowNumber());
                    result.getErrors().add(new RowError(created.rowNumber(),
                            "Không thể hoàn tác lớp " + created.code() + ": "
                                    + errorMessage(cleanupError, "Lỗi khi xóa lớp.")));
                }
            }

            preparedRows.stream()
                    .filter(row -> !rowsWithErrors.contains(row.rowNumber()))
                    .forEach(row -> result.getErrors().add(new RowError(row.rowNumber(),
                            "Dòng chưa được import vì một dòng khác gặp lỗi; toàn bộ file đã bị hủy.")));
            return result;
        }
    }

    private String errorMessage(Exception error, String fallback) {
        return error.getMessage() == null || error.getMessage().isBlank() ? fallback : error.getMessage();
    }

    private ParsedClass parseRow(Map<String, String> row, List<TrainingProgram> activePrograms) {
        String code = requiredValue(row, "Class Code", "Code");
        String name = requiredValue(row, "Class Name", "Name");
        String status = value(row, "Status");
        if (status == null || status.isBlank()) status = "active";
        status = status.trim().toLowerCase(Locale.ROOT);

        ExternalClassRequest request = new ExternalClassRequest(
                code.trim(), name.trim(), parseDate(value(row, "Expected Start Date", "Start Date")),
                parseDate(value(row, "Expected End Date", "End Date")), status,
                parseInteger(value(row, "Planned Trainee No.", "Planned Size")),
                value(row, "Delivery Type"), value(row, "Trainee Type"), value(row, "Format Type"),
                value(row, "Skills"), value(row, "Site"), value(row, "Location"), value(row, "Subject Type"),
                value(row, "Scope"), value(row, "Supplier/Partner", "Supplier Partner"),
                value(row, "Key Program"), parseBoolean(value(row, "Job Recommendation"))
        );

        String programCode = value(row, "Training Program Code");
        String programVersion = value(row, "Training Program Version");
        TrainingProgram program = resolveProgram(programCode, programVersion, activePrograms);
        if (program != null && !"active".equals(status)) {
            throw new IllegalArgumentException("Chỉ có thể gán chương trình cho lớp đang hoạt động.");
        }
        return new ParsedClass(request, program);
    }

    private TrainingProgram resolveProgram(String code, String version, List<TrainingProgram> activePrograms) {
        if (code == null || code.isBlank()) {
            if (version != null && !version.isBlank()) {
                throw new IllegalArgumentException("Cần nhập Training Program Code khi có Training Program Version.");
            }
            return null;
        }
        List<TrainingProgram> matches = activePrograms.stream()
                .filter(program -> program.getCode().equalsIgnoreCase(code.trim()))
                .filter(program -> version == null || version.isBlank() || program.getVersion().equalsIgnoreCase(version.trim()))
                .toList();
        if (matches.isEmpty()) {
            throw new IllegalArgumentException("Không tìm thấy chương trình ACTIVE phù hợp với mã và phiên bản đã nhập.");
        }
        if (matches.size() > 1) {
            throw new IllegalArgumentException("Mã chương trình có nhiều phiên bản ACTIVE; hãy nhập Training Program Version.");
        }
        return matches.getFirst();
    }

    private String parseDate(String value) {
        if (value == null || value.isBlank()) return null;
        String trimmed = value.trim();
        try {
            return LocalDate.parse(trimmed).toString();
        } catch (DateTimeParseException ignored) {
            for (DateTimeFormatter formatter : DATE_FORMATS) {
                try {
                    return LocalDate.parse(trimmed, formatter).toString();
                } catch (DateTimeParseException ignoredFormat) {
                }
            }
        }
        try {
            double excelSerial = new BigDecimal(trimmed).doubleValue();
            if (DateUtil.isValidExcelDate(excelSerial)) {
                return DateUtil.getLocalDateTime(excelSerial).toLocalDate().toString();
            }
        } catch (NumberFormatException ignored) {
        }
        throw new IllegalArgumentException("Ngày phải theo định dạng yyyy-MM-dd hoặc là ô ngày hợp lệ trong Excel.");
    }

    private Integer parseInteger(String value) {
        if (value == null || value.isBlank()) return null;
        try {
            return new BigDecimal(value.trim()).intValueExact();
        } catch (ArithmeticException | NumberFormatException error) {
            throw new IllegalArgumentException("Planned Trainee No. phải là số nguyên.");
        }
    }

    private Boolean parseBoolean(String value) {
        if (value == null || value.isBlank()) return null;
        return switch (value.trim().toLowerCase(Locale.ROOT)) {
            case "yes", "true", "1", "có" -> true;
            case "no", "false", "0", "không" -> false;
            default -> throw new IllegalArgumentException("Job Recommendation chỉ nhận Yes/No hoặc true/false.");
        };
    }

    private String requiredValue(Map<String, String> row, String... headers) {
        String value = value(row, headers);
        if (value == null || value.isBlank()) {
            throw new IllegalArgumentException(headers[0] + " không được để trống.");
        }
        return value;
    }

    private String value(Map<String, String> row, String... headers) {
        for (String header : headers) {
            for (Map.Entry<String, String> entry : row.entrySet()) {
                if (entry.getKey() != null && entry.getKey().trim().equalsIgnoreCase(header)) {
                    return blankToNull(entry.getValue());
                }
            }
        }
        return null;
    }

    private boolean isBlankRow(Map<String, String> row) {
        return row.values().stream().allMatch(value -> value == null || value.isBlank());
    }

    private String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    private String normalizeCode(String code) {
        return code.trim().toLowerCase(Locale.ROOT);
    }

    private record ParsedClass(ExternalClassRequest request, TrainingProgram program) {}
    private record PreparedRow(int rowNumber, ParsedClass parsed) {}
    private record CreatedClass(int rowNumber, Long id, String code) {}
}
