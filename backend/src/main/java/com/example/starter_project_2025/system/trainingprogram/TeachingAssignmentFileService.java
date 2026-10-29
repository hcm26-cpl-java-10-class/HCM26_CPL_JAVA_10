package com.example.starter_project_2025.system.trainingprogram;

import com.example.starter_project_2025.base.dataio.importer.result.ImportResult;
import com.example.starter_project_2025.base.dataio.importer.result.RowError;
import com.example.starter_project_2025.exception.BadRequestException;
import com.example.starter_project_2025.exception.BusinessValidationException;
import com.example.starter_project_2025.exception.ConflictException;
import com.example.starter_project_2025.exception.ResourceNotFoundException;
import com.opencsv.CSVReader;
import jakarta.validation.ConstraintViolation;
import jakarta.validation.ConstraintViolationException;
import jakarta.validation.Validator;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.apache.poi.ss.usermodel.*;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.multipart.MultipartFile;

import java.io.InputStreamReader;
import java.io.ByteArrayOutputStream;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class TeachingAssignmentFileService {
    private static final List<String> HEADERS = List.of("Class ID", "Program Subject ID", "Trainer ID", "Role", "Effective From", "Effective To");
    private static final List<String> DETAILS_HEADERS = List.of("Class Name", "Class Start Date", "Class End Date", "Planned Size",
            "Program Name", "Program Version", "Subject Name", "Duration Hours", "Trainer Name", "Trainer Email",
            "Role", "Effective From", "Effective To");
    private static final int MAX_IMPORT_ROWS = 1000;
    private static final int MAX_EXPORT_ROWS = 10000;
    private final ClassSetupService assignments;
    private final TeachingAssignmentDetailsImport detailsImport;
    private final Validator validator;
    private final PlatformTransactionManager transactionManager;

    @Transactional(readOnly = true)
    public byte[] template() throws java.io.IOException {
        var options = assignments.getAssignmentCreateOptions();
        try (var workbook = new org.apache.poi.xssf.usermodel.XSSFWorkbook(); var out = new ByteArrayOutputStream()) {
            var input = workbook.createSheet("Import");
            var templateHeaders = new ArrayList<>(DETAILS_HEADERS); templateHeaders.add("Teaching Slots");
            append(input, templateHeaders.toArray());
            var guide = workbook.createSheet("Instructions");
            append(guide, "Fill the Import sheet to create a new class, program, subject, trainer and assignment per row. IDs are generated automatically.");
            append(guide, "Effective To is optional. Duration Hours may be blank when Teaching Slots is supplied; otherwise enter positive hours (fractions are allowed). Planned Size: 1-10000.");
            append(guide, "New class names create classes with one subject. Existing classes are reused only when name, dates, size, program/version and subject/duration match.");
            append(guide, "Deleting assignments keeps classes, programs, subjects and trainers. Reimport recreates assignments using matching existing details; overlaps still fail.");
            append(guide, "An existing active trainer is reused only when both email and name match. Do not invent email addresses.");
            append(guide, "Role must be MAIN or ASSISTANT. Assignment dates must be within the supplied class dates.");
            append(guide, "Dates use YYYY-MM-DD or Excel date cells. Effective To may be blank.");
            append(guide, "Teaching Slots (optional for legacy files): YYYY-MM-DD HH:mm-HH:mm; YYYY-MM-DD HH:mm-HH:mm. A trainer's slots must not overlap, across all classes and subjects.");
            append(guide, "When Teaching Slots is supplied, duration is recalculated as the sum of end minus start, preserving fractional hours. Each slot must be longer than 30 minutes.");
            append(guide, "Each valid row commits separately. Failed rows leave no new records. Existing assignments are never overwritten.");
            append(guide, "Creating all details requires assignment, class, program, subject and trainer creation permissions.");
            append(guide, "Legacy ID-based files remain supported: use the Existing Assignments headers as the first sheet in a separate file.");
            append(guide, "Maximum 1000 rows; CSV must be UTF-8. Import rechecks all current reference data.");
            append(workbook.createSheet("Existing Assignments"), HEADERS.toArray());
            var classes = workbook.createSheet("Classes");
            append(classes, "Class ID", "Code", "Name");
            var curriculum = workbook.createSheet("Curriculum");
            append(curriculum, "Class ID", "Class Code", "Program Subject ID", "Subject Code", "Subject Name", "Version");
            for (var clazz : options.classes()) {
                append(classes, clazz.getId(), clazz.getCode(), clazz.getName());
                for (var subject : assignments.getAssignmentCreateContext(clazz.getId()).subjects()) {
                    append(curriculum, clazz.getId(), clazz.getCode(), subject.programSubjectId(), subject.code(), subject.name(), subject.version());
                }
            }
            var trainers = workbook.createSheet("Trainers");
            append(trainers, "Trainer ID", "Name", "Email");
            for (var trainer : options.trainers()) append(trainers, trainer.getId(), trainer.getName(), trainer.getEmail());
            for (var sheet : workbook) {
                sheet.createFreezePane(0, 1);
                for (int col = 0; col < sheet.getRow(0).getLastCellNum(); col++) {
                    sheet.autoSizeColumn(col);
                    sheet.setColumnWidth(col, Math.min(16000, Math.max(4000, sheet.getColumnWidth(col) + 512)));
                }
            }
            workbook.write(out);
            return out.toByteArray();
        }
    }

    private void append(Sheet sheet, Object... values) {
        var row = sheet.createRow(sheet.getPhysicalNumberOfRows());
        for (int col = 0; col < values.length; col++) row.createCell(col).setCellValue(Objects.toString(values[col], ""));
    }

    // No outer write transaction: each row commits or rolls back independently.
    public ImportResult importFile(MultipartFile file) {
        var rows = read(file);
        var transaction = new TransactionTemplate(transactionManager);
        transaction.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
        var result = new ImportResult();
        for (var row : rows) {
            if (row.values().values().stream().allMatch(String::isBlank)) continue;
            try {
                var values = row.values();
                if (values.containsKey("Class Name")) {
                    var request = detailsRequest(values);
                    transaction.execute(status -> detailsImport.create(request));
                } else {
                    var request = new TeachingAssignmentRequest(id(values, "Class ID"), id(values, "Program Subject ID"),
                        id(values, "Trainer ID"), role(values.get("Role")), date(values, "Effective From", false),
                        date(values, "Effective To", true), null, teachingSlots(values));
                    var violations = validator.validate(request);
                    if (!violations.isEmpty()) throw new ConstraintViolationException(violations);
                    transaction.execute(status -> assignments.createAssignment(request));
                }
                result.setSuccessCount(result.getSuccessCount() + 1);
            } catch (AccessDeniedException error) {
                throw error;
            } catch (Exception error) {
                result.setFailureCount(result.getFailureCount() + 1);
                result.getErrors().add(new RowError(row.number(), message(error)));
            }
        }
        return result;
    }

    @Transactional(readOnly = true)
    public List<TeachingAssignmentFileRow> exportRows(Long classId, Long programSubjectId, Long trainerId,
            AssignmentRole role, LocalDate effectiveOn, String search, Long subjectId, Sort sort) {
        var result = new ArrayList<TeachingAssignmentFileRow>();
        for (int page = 0; ; page++) {
            var batch = assignments.searchAssignments(classId, programSubjectId, trainerId, role, effectiveOn,
                    search, subjectId, PageRequest.of(page, 100, sort));
            if (batch.getTotalElements() > MAX_EXPORT_ROWS) {
                throw new BadRequestException("Export supports up to 10000 assignments. Narrow the filters and try again.");
            }
            result.addAll(batch.getContent().stream().map(TeachingAssignmentFileRow::from).toList());
            if (!batch.hasNext()) return result;
        }
    }

    private record FileRow(int number, Map<String, String> values) {}

    private List<FileRow> read(MultipartFile file) {
        if (file.isEmpty()) throw new BadRequestException("Choose a non-empty Excel or CSV file.");
        if (file.getSize() > 50L * 1024 * 1024) throw new BadRequestException("File size must not exceed 50 MB.");
        String name = Objects.toString(file.getOriginalFilename(), "").toLowerCase(Locale.ROOT);
        try {
            if (name.endsWith(".csv")) {
                try (var reader = new CSVReader(new InputStreamReader(file.getInputStream(), StandardCharsets.UTF_8))) {
                    var header = reader.readNext();
                    var headers = headers(header == null ? List.of() : Arrays.asList(header));
                    var rows = new ArrayList<FileRow>();
                    String[] values;
                    while ((values = reader.readNext()) != null) {
                        limit(rows.size() + 1);
                        rows.add(new FileRow(rows.size() + 2, values(headers, Arrays.asList(values))));
                    }
                    return rows;
                }
            }
            if (name.endsWith(".xlsx") || name.endsWith(".xls")) {
                try (var workbook = WorkbookFactory.create(file.getInputStream())) {
                    var sheet = workbook.getSheetAt(0);
                    limit(sheet.getLastRowNum());
                    var header = sheet.getRow(0);
                    if (header == null) throw new BadRequestException("Missing header row. Download the import template.");
                    var formatter = new DataFormatter(Locale.ROOT);
                    var names = new ArrayList<String>();
                    for (int col = 0; col < header.getLastCellNum(); col++) names.add(formatter.formatCellValue(header.getCell(col)));
                    var headers = headers(names);
                    var rows = new ArrayList<FileRow>();
                    for (int number = 1; number <= sheet.getLastRowNum(); number++) {
                        var row = sheet.getRow(number);
                        var cells = new ArrayList<String>();
                        for (int col = 0; col < headers.size(); col++) {
                            var cell = row == null ? null : row.getCell(col);
                            if (cell != null && cell.getCellType() == CellType.NUMERIC && DateUtil.isCellDateFormatted(cell)) {
                                cells.add(cell.getLocalDateTimeCellValue().toLocalDate().toString());
                            } else {
                                cells.add(formatter.formatCellValue(cell));
                            }
                        }
                        rows.add(new FileRow(number + 1, values(headers, cells)));
                    }
                    return rows;
                }
            }
            throw new BadRequestException("Use an Excel (.xlsx, .xls) or CSV (.csv) file.");
        } catch (BadRequestException error) {
            throw error;
        } catch (Exception error) {
            throw new BadRequestException("Unable to read the file. Use a valid Excel or UTF-8 CSV template.");
        }
    }

    private List<String> headers(List<String> cells) {
        var headers = cells.stream().map(value -> value.replace("\uFEFF", "").trim()).toList();
        boolean details = headers.contains("Class Name");
        var required = details ? DETAILS_HEADERS : HEADERS;
        if (!headers.containsAll(required) || new HashSet<>(headers).size() != headers.size()) {
            throw new BadRequestException("Use unique template headers: " + String.join(", ", required) + ". Download the current template to create new classes, subjects and trainers.");
        }
        return headers;
    }

    private Map<String, String> values(List<String> headers, List<String> cells) {
        var values = new HashMap<String, String>();
        for (int i = 0; i < headers.size(); i++) values.put(headers.get(i), i < cells.size() ? cells.get(i).trim() : "");
        return values;
    }

    private void limit(int count) {
        if (count > MAX_IMPORT_ROWS) throw new BadRequestException("Import supports at most 1000 rows per file.");
    }

    private Long id(Map<String, String> values, String key) {
        try {
            long id = new BigDecimal(values.get(key)).longValueExact();
            if (id > 0) return id;
        } catch (ArithmeticException | NumberFormatException ignored) { }
        throw new BadRequestException(key + " must be an existing positive whole-number ID.");
    }

    private AssignmentRole role(String value) {
        try { return AssignmentRole.valueOf(value.toUpperCase(Locale.ROOT)); }
        catch (IllegalArgumentException error) { throw new BadRequestException("Role must be MAIN or ASSISTANT."); }
    }

    private AssignmentCreationService.Request detailsRequest(Map<String, String> values) {
        return new AssignmentCreationService.Request(
                new AssignmentClassCreation.Request(values.get("Class Name"), null,
                        date(values, "Class Start Date", false), date(values, "Class End Date", false),
                        positiveInteger(values, "Planned Size"),
                        new AssignmentProgramCreation.Request(values.get("Program Name"), values.get("Program Version"), List.of())),
                new AssignmentTrainerCreation.Request(values.get("Trainer Name"), values.get("Trainer Email")),
                null, role(values.get("Role")), date(values, "Effective From", false), date(values, "Effective To", true),
                new AssignmentSubjectCreation.Request(values.get("Subject Name"), positiveHours(values.get("Duration Hours"))), teachingSlots(values));
    }

    private List<AssignmentTeachingSlot> teachingSlots(Map<String, String> values) {
        String value = values.getOrDefault("Teaching Slots", "");
        if (value.isBlank()) return null;
        var parts = value.split(";", -1);
        if (parts.length > 200) throw new BadRequestException("Use at most 200 teaching slots per assignment.");
        var slots = new ArrayList<AssignmentTeachingSlot>();
        for (String part : parts) {
            String text = part.strip();
            if (!text.matches("\\d{4}-\\d{2}-\\d{2} \\d{2}:\\d{2}-\\d{2}:\\d{2}"))
                throw new BadRequestException("Teaching Slots must use YYYY-MM-DD HH:mm-HH:mm separated by semicolons.");
            try {
                slots.add(new AssignmentTeachingSlot(LocalDate.parse(text.substring(0, 10)),
                        java.time.LocalTime.parse(text.substring(11, 16)), java.time.LocalTime.parse(text.substring(17, 22))));
            } catch (java.time.format.DateTimeParseException error) {
                throw new BadRequestException("Enter valid dates and times in Teaching Slots.");
            }
        }
        return slots;
    }

    private Integer positiveInteger(Map<String, String> values, String key) {
        try {
            int value = new BigDecimal(values.get(key)).intValueExact();
            if (value > 0) return value;
        } catch (ArithmeticException | NumberFormatException ignored) { }
        throw new BadRequestException(key + " must be a positive whole number.");
    }

    private BigDecimal positiveHours(String text) {
        if (text == null || text.isBlank()) return null; // Teaching slots can supply the duration.
        try {
            var value = new BigDecimal(text).stripTrailingZeros();
            if (value.signum() > 0 && value.scale() <= 9 && value.compareTo(new BigDecimal("2147483647")) <= 0) return value;
        } catch (NumberFormatException ignored) { }
        throw new BadRequestException("Duration Hours must be a positive number with at most 9 decimal places, or blank when Teaching Slots is provided.");
    }

    private LocalDate date(Map<String, String> values, String key, boolean optional) {
        String value = values.get(key);
        if (optional && value.isBlank()) return null;
        try { return LocalDate.parse(value); }
        catch (java.time.format.DateTimeParseException error) { throw new BadRequestException(key + " must use YYYY-MM-DD or an Excel date cell."); }
    }

    private String message(Exception error) {
        if (error instanceof BusinessValidationException validation) return validation.getErrors().values().stream()
                .flatMap(List::stream).distinct().sorted().collect(Collectors.joining("; "));
        if (error instanceof ConstraintViolationException validation) return validation.getConstraintViolations().stream()
                .map(ConstraintViolation::getMessage).distinct().sorted().collect(Collectors.joining("; "));
        if (error instanceof BadRequestException || error instanceof ConflictException
                || error instanceof ResourceNotFoundException || error instanceof IllegalArgumentException) return error.getMessage();
        log.error("Teaching assignment import row failed", error);
        return "Unable to import this row. Check shared reference data and try again.";
    }
}
