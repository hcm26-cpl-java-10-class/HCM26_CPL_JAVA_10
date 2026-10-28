package com.example.starter_project_2025.system.demo.session;

import com.example.starter_project_2025.base.dataio.importer.annotation.ImportField;
import com.example.starter_project_2025.base.dataio.importer.mapper.ValueConverter;
import com.example.starter_project_2025.base.dataio.importer.parser.ParserFactory;
import com.example.starter_project_2025.base.dataio.importer.result.ImportResult;
import com.example.starter_project_2025.base.dataio.importer.result.RowError;
import com.example.starter_project_2025.exception.BusinessValidationException;
import com.example.starter_project_2025.system.schedule.*;
import com.example.starter_project_2025.system.external_api.exception.ExternalApiException;
import jakarta.persistence.Column;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.lang.reflect.Field;
import java.net.URI;
import java.time.DayOfWeek;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class SessionImportService {
    public static final int MAX_ROWS = 200;
    public static final int MAX_CELL_LENGTH = 2048;
    private static final List<Field> FIELDS = Arrays.stream(Session.class.getDeclaredFields())
            .filter(field -> field.isAnnotationPresent(ImportField.class)).toList();
    private static final List<String> COLUMNS = FIELDS.stream().map(field -> field.getAnnotation(ImportField.class).name()).toList();
    private static final List<String> REQUIRED = FIELDS.stream().filter(field -> field.getAnnotation(ImportField.class).required())
            .map(field -> field.getAnnotation(ImportField.class).name()).toList();

    private final ParserFactory parserFactory;
    private final ValueConverter converter;
    private final SessionMapper sessionMapper;
    private final SessionImportCoordinator sessions;
    private final ScheduleRules schedulingRules;

    public SessionImportPreview preview(MultipartFile file) { return prepareFile(file).preview(); }
    public SessionImportPreview previewRows(SessionImportRowsRequest request) {
        return prepare(checkedRows(request), List.of()).preview();
    }
    public ImportResult importFile(MultipartFile file) { return save(prepareFile(file)); }
    public ImportResult importRows(SessionImportRowsRequest request) {
        return save(prepare(checkedRows(request), List.of()));
    }

    /** Confirmation validates the submitted values again; the final batch write remains atomic. */
    private ImportResult save(Prepared prepared) {
        var result = new ImportResult();
        if (!prepared.preview().canImport()) {
            result.setFailureCount(prepared.preview().totalRows());
            prepared.preview().rows().forEach(row -> row.errors().forEach(message ->
                    result.getErrors().add(new RowError(row.rowNumber(), message))));
            return result;
        }
        try {
            sessions.createValidatedBatch(prepared.requests());
            result.setSuccessCount(prepared.requests().size());
        } catch (ScheduleValidationException error) {
            result.setFailureCount(prepared.requests().size());
            error.getResult().issues().forEach(issue -> result.getErrors().add(new RowError(
                    issue.candidateIndex() < 0 ? 1 : prepared.rowNumbers().get(issue.candidateIndex()),
                    issueMessage(issue, prepared.rowNumbers()))));
        } catch (ExternalApiException error) {
            result.setFailureCount(prepared.requests().size());
            prepared.rowNumbers().forEach(number -> result.getErrors().add(new RowError(number,
                    "Scheduling reference source is unavailable; no sessions were imported. Restore the real Topic/assignment/resource source and recheck.")));
        } catch (BusinessValidationException error) {
            result.setFailureCount(prepared.requests().size());
            error.getErrors().forEach((field, messages) -> messages.forEach(message ->
                    result.getErrors().add(new RowError(1, field + ": " + message))));
        }
        return result;
    }

    private Prepared prepareFile(MultipartFile file) {
        if (file == null || file.isEmpty()) throw new IllegalArgumentException("Choose a non-empty Excel or CSV file.");
        String filename = file.getOriginalFilename();
        if (filename == null || !filename.toLowerCase(Locale.ROOT).matches(".*\\.(xlsx|xls|csv)$")) {
            throw new IllegalArgumentException("Choose an Excel or CSV file (.xlsx, .xls, .csv).");
        }
        List<Map<String, String>> source;
        try (var input = file.getInputStream()) { source = parserFactory.getParser(filename).parse(input); }
        catch (IOException error) { throw new IllegalArgumentException("The import file could not be read. Upload it again.", error); }
        if (source.isEmpty()) throw new IllegalArgumentException("The file has no data rows below its header.");
        var header = normalizeColumns(source.getFirst(), false);
        var warnings = new ArrayList<String>();
        var missing = REQUIRED.stream().filter(column -> !header.containsKey(column)).toList();
        if (!missing.isEmpty()) warnings.add("Missing required columns: " + String.join(", ", missing)
                + ". Fill these fields in preview or use the Session template.");
        var unknown = source.getFirst().keySet().stream().filter(column -> canonicalColumn(column) == null).toList();
        if (!unknown.isEmpty()) warnings.add("Columns not used by Session import: " + String.join(", ", unknown) + ".");
        if (source.getFirst().keySet().stream().anyMatch(column -> normalizeHeader(column).equals("subject id"))) {
            warnings.add("This appears to be a Study Sessions file. Session import needs Topic ID and Trainer ID; Subject ID and Lecturer cannot replace them.");
        }
        var rows = new ArrayList<SessionImportRowsRequest.Row>();
        for (int index = 0; index < source.size(); index++) {
            rows.add(new SessionImportRowsRequest.Row(index + 2, normalizeColumns(source.get(index), false)));
        }
        checkRowCount(rows.size());
        return prepare(rows, warnings);
    }

    private List<SessionImportRowsRequest.Row> checkedRows(SessionImportRowsRequest request) {
        if (request == null || request.rows() == null) throw new IllegalArgumentException("Provide rows to check or import.");
        checkRowCount(request.rows().size());
        var seen = new HashSet<Integer>();
        var checked = new ArrayList<SessionImportRowsRequest.Row>();
        for (var row : request.rows()) {
            if (row == null || row.rowNumber() == null || row.rowNumber() < 2 || row.rowNumber() > 1048576
                    || !seen.add(row.rowNumber())) throw new IllegalArgumentException("Each row needs a unique original row number between 2 and 1048576.");
            if (row.values() == null || row.values().size() > COLUMNS.size()) throw new IllegalArgumentException("Provide only the Session template columns for each row.");
            for (var value : row.values().values()) {
                if (value != null && value.length() > MAX_CELL_LENGTH) throw new IllegalArgumentException("A cell must not exceed " + MAX_CELL_LENGTH + " characters.");
            }
            checked.add(new SessionImportRowsRequest.Row(row.rowNumber(), normalizeColumns(row.values(), true)));
        }
        return checked;
    }

    private void checkRowCount(int count) {
        int maximum = Math.min(MAX_ROWS, schedulingRules.getMaxBatchSize());
        if (count < 1 || count > maximum) throw new IllegalArgumentException("Provide between 1 and " + maximum + " sessions per import.");
    }

    private Map<String, String> normalizeColumns(Map<String, String> source, boolean rejectUnknown) {
        var normalized = new LinkedHashMap<String, String>();
        for (var entry : source.entrySet()) {
            String name = canonicalColumn(entry.getKey());
            if (name == null) {
                if (rejectUnknown) throw new IllegalArgumentException("Unknown Session column: " + entry.getKey());
                continue;
            }
            if (normalized.containsKey(name)) throw new IllegalArgumentException("Duplicate column header: " + name);
            normalized.put(name, entry.getValue());
        }
        return normalized;
    }

    private String canonicalColumn(String header) {
        String normalized = normalizeHeader(header);
        return COLUMNS.stream().filter(column -> normalizeHeader(column).equals(normalized)).findFirst().orElse(null);
    }
    private String normalizeHeader(String header) {
        return header == null ? "" : header.replace(String.valueOf((char) 0xFEFF), "").trim().replaceAll("\\s+", " ").toLowerCase(Locale.ROOT);
    }

    private Prepared prepare(List<SessionImportRowsRequest.Row> sourceRows, List<String> warnings) {
        var requests = new ArrayList<SessionDTO>();
        var rowNumbers = new ArrayList<Integer>();
        var values = new ArrayList<Map<String, String>>();
        var errors = new ArrayList<List<String>>();
        var sourcePositions = new ArrayList<Integer>();
        for (int index = 0; index < sourceRows.size(); index++) {
            var source = sourceRows.get(index);
            var row = new LinkedHashMap<String, String>();
            COLUMNS.forEach(column -> row.put(column, source.values().getOrDefault(column, "")));
            var rowErrors = new ArrayList<String>();
            var entity = new Session();
            // Validate every column so a row reports all format/required errors in one check.
            for (var field : FIELDS) {
                var metadata = field.getAnnotation(ImportField.class);
                String raw = row.get(metadata.name());
                if (raw == null || raw.isBlank()) {
                    if (metadata.required()) rowErrors.add("Missing: " + metadata.name());
                    continue;
                }
                try {
                    Object value = converter.convert(field.getType(), raw);
                    if (value instanceof Long id && id <= 0) throw new IllegalArgumentException("Enter a positive whole-number ID.");
                    if (value instanceof String string) {
                        var column = field.getAnnotation(Column.class);
                        if (column != null && string.length() > column.length()) {
                            throw new IllegalArgumentException("Use at most " + column.length() + " characters.");
                        }
                        if (field.getName().equals("meetingUrl")) {
                            var uri = URI.create(string);
                            if (!("http".equals(uri.getScheme()) || "https".equals(uri.getScheme())) || uri.getHost() == null) {
                                throw new IllegalArgumentException("Enter a valid http:// or https:// meeting URL.");
                            }
                        }
                    }
                    field.setAccessible(true); field.set(entity, value);
                    row.put(metadata.name(), value.toString());
                } catch (IllegalArgumentException | IllegalAccessException error) {
                    rowErrors.add(metadata.name() + ": " + error.getMessage());
                }
            }
            if (entity.getStartTime() != null && entity.getEndTime() != null && !entity.getEndTime().isAfter(entity.getStartTime())) {
                rowErrors.add("End Time: The end time must be later than the start time.");
            }
            if (rowErrors.isEmpty()) {
                requests.add(sessionMapper.toDto(entity)); rowNumbers.add(source.rowNumber()); sourcePositions.add(index);
            }
            values.add(row); errors.add(rowErrors);
        }
        if (!requests.isEmpty()) {
            var validation = sessions.previewValidatedBatch(requests);
            for (int index = 0; index < requests.size(); index++) {
                Long assignmentId = requests.get(index).getTeachingAssignmentId();
                values.get(sourcePositions.get(index)).put("Teaching Assignment ID", assignmentId == null ? "" : assignmentId.toString());
            }
            for (var issue : validation.issues()) {
                String message = issueMessage(issue, rowNumbers);
                if (issue.candidateIndex() < 0) errors.forEach(rowErrors -> rowErrors.add(message));
                else errors.get(sourcePositions.get(issue.candidateIndex())).add(message);
            }
        }
        var previewRows = new ArrayList<SessionImportPreview.Row>();
        for (int index = 0; index < values.size(); index++) {
            previewRows.add(new SessionImportPreview.Row(sourceRows.get(index).rowNumber(), values.get(index), errors.get(index).isEmpty(), List.copyOf(errors.get(index))));
        }
        int validRows = (int) previewRows.stream().filter(SessionImportPreview.Row::valid).count();
        return new Prepared(new SessionImportPreview(previewRows.size(), validRows, previewRows.size() - validRows,
                validRows == previewRows.size(), COLUMNS, previewRows, REQUIRED, warnings, rules()), requests, rowNumbers);
    }

    private List<String> rules() {
        return List.of(
                "Required: " + String.join(", ", REQUIRED) + ".",
                "IDs must be positive whole numbers. 1 and 1.0 are accepted; fractions, zero and overflowing values are rejected.",
                "Use Excel date/time cells or yyyy-MM-ddTHH:mm / yyyy-MM-dd HH:mm. Times use " + schedulingRules.getTimezone() + ".",
                "End time must be later than start time, on the same working day between " + schedulingRules.getOpeningTime() + " and " + schedulingRules.getClosingTime() + ".",
                "Working days: " + schedulingRules.getWorkingDays().stream().sorted().map(day -> DayOfWeek.of(day).name()).collect(Collectors.joining(", ")) + ".",
                "The class and trainer must be active. The date must be within the class period and outside scheduled holidays.",
                "Teaching Assignment ID is optional only when one real eligible assignment can be resolved for the class, trainer and full interval. Explicit IDs must exist in the current store and the available API. Topic is checked separately; it is not Subject or ProgramSubject.",
                "Provide a valid Room ID, recognized Location / Room, or a valid http(s) Meeting URL. Room ID and room name must agree when both are provided.",
                "Class, trainer and room must not overlap other bookings or other rows in this file. Adjacent sessions are allowed.",
                "Session Title and Location / Room: at most 150 characters; Meeting URL: at most 1000 characters.",
                "All rows must pass validation; at most " + Math.min(MAX_ROWS, schedulingRules.getMaxBatchSize()) + " rows are imported as one atomic batch. The server checks again at confirmation.");
    }

    private String issueMessage(ScheduleIssue issue, List<Integer> rowNumbers) {
        return issue.message()
                + (issue.relatedSessionId() == null ? "" : " (session #" + issue.relatedSessionId() + ")")
                + (issue.relatedCandidateIndex() == null ? "" : " (row " + rowNumbers.get(issue.relatedCandidateIndex()) + ")");
    }
    private record Prepared(SessionImportPreview preview, List<SessionDTO> requests, List<Integer> rowNumbers) {}
}
