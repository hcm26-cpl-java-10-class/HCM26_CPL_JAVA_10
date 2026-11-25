package com.example.starter_project_2025.system.trainer;

import com.example.starter_project_2025.exception.BadRequestException;
import com.example.starter_project_2025.exception.BusinessValidationException;
import com.example.starter_project_2025.system.subject.SubjectRepository;
import lombok.RequiredArgsConstructor;
import org.apache.poi.ss.usermodel.*;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;
import java.io.ByteArrayOutputStream;
import java.util.*;
import static com.example.starter_project_2025.system.trainer.TrainerServiceImpl.*;

@Service @RequiredArgsConstructor
public class TrainerImportService {
    public static final List<String> HEADERS = List.of("Trainer ID*", "Full Name*", "Work Email*", "Specialization", "Teaching Topics", "Status");
    private final TrainerServiceImpl service;
    private final TrainerRepository trainers;
    private final SubjectRepository subjects;
    public record RowResult(int rowNumber, List<String> cells, boolean valid, List<String> errors) {}
    public record Preview(int totalRows, int validRows, boolean canImport, List<RowResult> rows) {}
    public record Result(int imported) {}
    private record Parsed(Preview preview, List<CreateTrainerRequest> requests) {}

    @Transactional(readOnly = true)
    public Preview preview(MultipartFile file) { return read(file).preview(); }

    @Transactional(rollbackFor = Exception.class)
    public Result commit(MultipartFile file) {
        var parsed = read(file); // Always revalidate the original file against current DB state.
        if (!parsed.preview().canImport()) {
            Map<String, List<String>> errors = new LinkedHashMap<>();
            parsed.preview().rows().stream().filter(r -> !r.valid()).forEach(r -> errors.put("row[" + r.rowNumber() + "]", r.errors()));
            throw new BusinessValidationException(errors);
        }
        parsed.requests().forEach(service::create); // Same transaction; any conflict rolls back every row.
        return new Result(parsed.requests().size());
    }

    public byte[] template() {
        try (var workbook = new XSSFWorkbook(); var out = new ByteArrayOutputStream()) {
            var sheet = workbook.createSheet("Trainers");
            var header = sheet.createRow(0);
            for (int i = 0; i < HEADERS.size(); i++) { header.createCell(i).setCellValue(HEADERS.get(i)); sheet.setColumnWidth(i, 28 * 256); }
            sheet.createFreezePane(0, 1);
            workbook.write(out); return out.toByteArray();
        } catch (java.io.IOException ex) { throw new IllegalStateException("Cannot create Trainer template", ex); }
    }

    private Parsed read(MultipartFile file) {
        String filename = Optional.ofNullable(file.getOriginalFilename()).orElse("").toLowerCase(Locale.ROOT);
        if (file.isEmpty() || file.getSize() > 5 * 1024 * 1024 || !(filename.endsWith(".xlsx") || filename.endsWith(".xls")))
            throw new BadRequestException("Upload a non-empty .xlsx or .xls file up to 5 MB.");
        try (var workbook = WorkbookFactory.create(file.getInputStream())) {
            if (workbook.getNumberOfSheets() != 1) throw new BadRequestException("Use exactly one worksheet with the Trainer template headers.");
            var sheet = workbook.getSheetAt(0);
            var header = sheet.getRow(0);
            var formatter = new DataFormatter(Locale.ROOT);
            if (header == null || header.getLastCellNum() != HEADERS.size()) throw new BadRequestException("Invalid Trainer template headers.");
            for (int i = 0; i < HEADERS.size(); i++)
                if (!HEADERS.get(i).equals(formatter.formatCellValue(header.getCell(i)).trim())) throw new BadRequestException("Expected header: " + HEADERS.get(i));
            if (sheet.getLastRowNum() > 500) throw new BadRequestException("Import supports at most 500 rows.");
            Map<String, List<Long>> topicIds = new HashMap<>();
            subjects.findByIsActiveTrue().forEach(s -> topicIds.computeIfAbsent((s.getCode() + "@" + s.getVersion()).toLowerCase(Locale.ROOT), k -> new ArrayList<>()).add(s.getId()));
            var result = new ArrayList<RowResult>();
            var requests = new ArrayList<CreateTrainerRequest>();
            var codes = new HashMap<String, Integer>(); var emails = new HashMap<String, Integer>();
            // Read first so duplicates are marked on BOTH affected rows.
            var rows = new LinkedHashMap<Integer, List<String>>();
            for (int number = 1; number <= sheet.getLastRowNum(); number++) {
                var row = sheet.getRow(number); if (row == null) continue;
                var cells = new ArrayList<String>();
                for (int i = 0; i < Math.max(HEADERS.size(), row.getLastCellNum()); i++) {
                    var cell = row.getCell(i);
                    if (cell != null && cell.getCellType() == CellType.FORMULA) throw new BadRequestException("Formula cells are not allowed (row " + (number + 1) + ").");
                    cells.add(formatter.formatCellValue(cell).trim());
                }
                if (cells.stream().allMatch(String::isBlank)) continue;
                if (cells.size() > HEADERS.size() && cells.subList(HEADERS.size(), cells.size()).stream().anyMatch(s -> !s.isBlank()))
                    throw new BadRequestException("Unexpected cells after Status (row " + (number + 1) + ").");
                cells = new ArrayList<>(cells.subList(0, HEADERS.size())); rows.put(number + 1, cells);
                codes.merge(cells.get(0).toUpperCase(Locale.ROOT), 1, Integer::sum);
                emails.merge(cells.get(2).toLowerCase(Locale.ROOT), 1, Integer::sum);
            }
            if (rows.isEmpty()) throw new BadRequestException("The Trainer file has no data rows.");
            for (var entry : rows.entrySet()) {
                var cells = entry.getValue(); var errors = new ArrayList<String>();
                String code = cells.get(0).toUpperCase(Locale.ROOT), email = cells.get(2).toLowerCase(Locale.ROOT);
                if (codes.get(code) > 1) errors.add("Duplicate Trainer ID in file.");
                if (emails.get(email) > 1) errors.add("Duplicate Work Email in file.");
                if (trainers.existsByTrainerCodeIgnoreCaseAndIdNot(code, -1L)) errors.add("Trainer ID already exists.");
                if (trainers.existsByEmailIgnoreCaseAndIdNot(email, -1L)) errors.add("Work Email already exists.");
                var ids = new LinkedHashSet<Long>();
                if (!cells.get(4).isBlank()) for (String token : cells.get(4).split(";", -1)) {
                    var found = topicIds.getOrDefault(token.trim().toLowerCase(Locale.ROOT), List.of());
                    if (found.size() != 1) errors.add("Unknown, inactive or ambiguous Teaching Topic: " + token + ". Use CODE@version separated by semicolons.");
                    else if (!ids.add(found.getFirst())) errors.add("Duplicate Teaching Topic: " + token);
                }
                TrainerStatus status = TrainerStatus.ACTIVE;
                try { if (!cells.get(5).isBlank()) status = parseStatus(cells.get(5)); }
                catch (BadRequestException ex) { errors.add(ex.getMessage()); }
                var request = new CreateTrainerRequest(code, cells.get(1), email, cells.get(3), status, ids);
                try { request = service.normalize(request); }
                catch (BusinessValidationException ex) { ex.getErrors().forEach((field, messages) -> messages.forEach(m -> errors.add(field + ": " + m))); }
                requests.add(request); result.add(new RowResult(entry.getKey(), cells, errors.isEmpty(), errors));
            }
            int valid = (int) result.stream().filter(RowResult::valid).count();
            return new Parsed(new Preview(result.size(), valid, valid == result.size(), result), requests);
        } catch (BadRequestException ex) { throw ex; }
        catch (Exception ex) { throw new BadRequestException("Cannot read the Trainer workbook. Check the template and file format."); }
    }
}
