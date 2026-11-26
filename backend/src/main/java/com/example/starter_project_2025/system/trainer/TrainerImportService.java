package com.example.starter_project_2025.system.trainer;

import com.example.starter_project_2025.exception.BadRequestException;
import com.example.starter_project_2025.exception.BusinessValidationException;
import com.example.starter_project_2025.system.subject.SubjectRepository;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import org.apache.poi.ss.usermodel.*;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.util.*;

import static com.example.starter_project_2025.system.trainer.TrainerServiceImpl.parseStatus;

@Service
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class TrainerImportService {

    public static final List<String> HEADERS = List.of(
            "Trainer ID*", "Full Name*", "Work Email*", "Specialization", "Teaching Topics", "Status"
    );

    private static final long MAX_FILE_BYTES = 5L * 1024 * 1024;
    private static final int MAX_ROWS = 500;

    TrainerServiceImpl trainerService;
    TrainerRepository trainerRepository;
    SubjectRepository subjectRepository;

    public record RowResult(int rowNumber, List<String> cells, boolean valid, List<String> errors) {}

    public record Preview(int totalRows, int validRows, boolean canImport, List<RowResult> rows) {}

    public record Result(int imported) {}

    private record Parsed(Preview preview, List<CreateTrainerRequest> requests) {}

    @Transactional(readOnly = true)
    public Preview preview(MultipartFile file) {
        return read(file).preview();
    }

    @Transactional(rollbackFor = Exception.class)
    public Result commit(MultipartFile file) {
        // Always revalidate the original file against current DB state.
        Parsed parsed = read(file);
        if (!parsed.preview().canImport()) {
            Map<String, List<String>> errors = new LinkedHashMap<>();
            parsed.preview().rows().stream()
                    .filter(row -> !row.valid())
                    .forEach(row -> errors.put("row[" + row.rowNumber() + "]", row.errors()));
            throw new BusinessValidationException(errors);
        }

        // Same transaction: any conflict rolls back every row.
        parsed.requests().forEach(trainerService::create);
        return new Result(parsed.requests().size());
    }

    public byte[] template() {
        try (XSSFWorkbook workbook = new XSSFWorkbook(); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            Sheet sheet = workbook.createSheet("Trainers");
            Row header = sheet.createRow(0);
            for (int i = 0; i < HEADERS.size(); i++) {
                header.createCell(i).setCellValue(HEADERS.get(i));
                sheet.setColumnWidth(i, 28 * 256);
            }
            sheet.createFreezePane(0, 1);
            workbook.write(out);
            return out.toByteArray();
        } catch (IOException ex) {
            throw new IllegalStateException("Cannot create Trainer template", ex);
        }
    }

    private Parsed read(MultipartFile file) {
        validateUploadFile(file);

        try (Workbook workbook = WorkbookFactory.create(file.getInputStream())) {
            if (workbook.getNumberOfSheets() != 1) {
                throw new BadRequestException("Use exactly one worksheet with the Trainer template headers.");
            }

            Sheet sheet = workbook.getSheetAt(0);
            DataFormatter formatter = new DataFormatter(Locale.ROOT);
            validateHeaders(sheet.getRow(0), formatter);

            if (sheet.getLastRowNum() > MAX_ROWS) {
                throw new BadRequestException("Import supports at most 500 rows.");
            }

            Map<String, List<Long>> topicIds = loadActiveTopicLookup();
            Map<Integer, List<String>> rows = new LinkedHashMap<>();
            Map<String, Integer> codeCounts = new HashMap<>();
            Map<String, Integer> emailCounts = new HashMap<>();
            extractDataRows(sheet, formatter, rows, codeCounts, emailCounts);

            if (rows.isEmpty()) {
                throw new BadRequestException("The Trainer file has no data rows.");
            }

            List<RowResult> results = new ArrayList<>();
            List<CreateTrainerRequest> requests = new ArrayList<>();
            for (Map.Entry<Integer, List<String>> entry : rows.entrySet()) {
                validateRow(entry.getKey(), entry.getValue(), codeCounts, emailCounts, topicIds, requests, results);
            }

            int validCount = (int) results.stream().filter(RowResult::valid).count();
            Preview preview = new Preview(results.size(), validCount, validCount == results.size(), results);
            return new Parsed(preview, requests);
        } catch (BadRequestException ex) {
            throw ex;
        } catch (Exception ex) {
            throw new BadRequestException("Cannot read the Trainer workbook. Check the template and file format.");
        }
    }

    private void validateUploadFile(MultipartFile file) {
        String filename = Optional.ofNullable(file.getOriginalFilename()).orElse("").toLowerCase(Locale.ROOT);
        if (file.isEmpty() || file.getSize() > MAX_FILE_BYTES || !(filename.endsWith(".xlsx") || filename.endsWith(".xls"))) {
            throw new BadRequestException("Upload a non-empty .xlsx or .xls file up to 5 MB.");
        }
    }

    private void validateHeaders(Row header, DataFormatter formatter) {
        if (header == null || header.getLastCellNum() != HEADERS.size()) {
            throw new BadRequestException("Invalid Trainer template headers.");
        }
        for (int i = 0; i < HEADERS.size(); i++) {
            String actual = formatter.formatCellValue(header.getCell(i)).trim();
            if (!HEADERS.get(i).equals(actual)) {
                throw new BadRequestException("Expected header: " + HEADERS.get(i));
            }
        }
    }

    private Map<String, List<Long>> loadActiveTopicLookup() {
        Map<String, List<Long>> topicIds = new HashMap<>();
        subjectRepository.findByIsActiveTrue().forEach(subject -> {
            String key = (subject.getCode() + "@" + subject.getVersion()).toLowerCase(Locale.ROOT);
            topicIds.computeIfAbsent(key, k -> new ArrayList<>()).add(subject.getId());
        });
        return topicIds;
    }

    private void extractDataRows(
            Sheet sheet,
            DataFormatter formatter,
            Map<Integer, List<String>> rows,
            Map<String, Integer> codeCounts,
            Map<String, Integer> emailCounts
    ) {
        // Read all rows first so in-file duplicates are flagged on BOTH affected rows.
        for (int number = 1; number <= sheet.getLastRowNum(); number++) {
            Row row = sheet.getRow(number);
            if (row == null) {
                continue;
            }

            List<String> cells = new ArrayList<>();
            int cellLimit = Math.max(HEADERS.size(), row.getLastCellNum());
            for (int i = 0; i < cellLimit; i++) {
                Cell cell = row.getCell(i);
                if (cell != null && cell.getCellType() == CellType.FORMULA) {
                    throw new BadRequestException("Formula cells are not allowed (row " + (number + 1) + ").");
                }
                cells.add(formatter.formatCellValue(cell).trim());
            }

            if (cells.stream().allMatch(String::isBlank)) {
                continue;
            }
            if (cells.size() > HEADERS.size()
                    && cells.subList(HEADERS.size(), cells.size()).stream().anyMatch(s -> !s.isBlank())) {
                throw new BadRequestException("Unexpected cells after Status (row " + (number + 1) + ").");
            }

            List<String> normalizedCells = new ArrayList<>(cells.subList(0, HEADERS.size()));
            rows.put(number + 1, normalizedCells);
            codeCounts.merge(normalizedCells.get(0).toUpperCase(Locale.ROOT), 1, Integer::sum);
            emailCounts.merge(normalizedCells.get(2).toLowerCase(Locale.ROOT), 1, Integer::sum);
        }
    }

    private void validateRow(
            int rowNumber,
            List<String> cells,
            Map<String, Integer> codeCounts,
            Map<String, Integer> emailCounts,
            Map<String, List<Long>> topicIds,
            List<CreateTrainerRequest> requests,
            List<RowResult> results
    ) {
        List<String> errors = new ArrayList<>();
        String code = cells.get(0).toUpperCase(Locale.ROOT);
        String email = cells.get(2).toLowerCase(Locale.ROOT);

        if (codeCounts.get(code) > 1) {
            errors.add("Duplicate Trainer ID in file.");
        }
        if (emailCounts.get(email) > 1) {
            errors.add("Duplicate Work Email in file.");
        }
        if (trainerRepository.existsByTrainerCodeIgnoreCaseAndIdNot(code, -1L)) {
            errors.add("Trainer ID already exists.");
        }
        if (trainerRepository.existsByEmailIgnoreCaseAndIdNot(email, -1L)) {
            errors.add("Work Email already exists.");
        }

        Set<Long> resolvedTopicIds = new LinkedHashSet<>();
        if (!cells.get(4).isBlank()) {
            for (String token : cells.get(4).split(";", -1)) {
                List<Long> found = topicIds.getOrDefault(token.trim().toLowerCase(Locale.ROOT), List.of());
                if (found.size() != 1) {
                    errors.add("Unknown, inactive or ambiguous Teaching Topic: " + token
                            + ". Use CODE@version separated by semicolons.");
                } else if (!resolvedTopicIds.add(found.getFirst())) {
                    errors.add("Duplicate Teaching Topic: " + token);
                }
            }
        }

        TrainerStatus status = TrainerStatus.ACTIVE;
        try {
            if (!cells.get(5).isBlank()) {
                status = parseStatus(cells.get(5));
            }
        } catch (BadRequestException ex) {
            errors.add(ex.getMessage());
        }

        CreateTrainerRequest request = new CreateTrainerRequest(
                code, cells.get(1), email, cells.get(3), status, resolvedTopicIds
        );
        try {
            request = trainerService.normalize(request);
        } catch (BusinessValidationException ex) {
            ex.getErrors().forEach((field, messages) ->
                    messages.forEach(msg -> errors.add(field + ": " + msg))
            );
        }

        requests.add(request);
        results.add(new RowResult(rowNumber, cells, errors.isEmpty(), errors));
    }
}
