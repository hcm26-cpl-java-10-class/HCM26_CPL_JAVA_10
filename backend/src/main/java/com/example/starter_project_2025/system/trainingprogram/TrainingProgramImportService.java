
package com.example.starter_project_2025.system.trainingprogram;

import com.example.starter_project_2025.system.subject.Subject;
import com.example.starter_project_2025.system.subject.SubjectRepository;
import lombok.RequiredArgsConstructor;
import org.apache.poi.ss.usermodel.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class TrainingProgramImportService {

    private final TrainingProgramRepository programRepository;
    private final SubjectRepository subjectRepository;
    private final TrainingProgramService programService;

    private record Row(
            int number,
            String code,
            String name,
            String version,
            String region,
            String subjectCode,
            String subjectVersion,
            Integer orderIndex
    ) {}

    private record Key(String code, String version) {}

    @Transactional(readOnly = true)
    public ProgramImportPreviewResponse preview(MultipartFile file) {
        List<Row> rows = read(file);
        Map<Integer, List<String>> errors = validate(rows);

        List<ProgramImportPreviewResponse.RowResult> result = rows.stream()
                .map(row -> {
                    List<String> rowErrors =
                            errors.getOrDefault(row.number(), List.of());

                    return new ProgramImportPreviewResponse.RowResult(
                            row.number(),
                            row.code(),
                            row.version(),
                            row.subjectCode(),
                            row.subjectVersion(),
                            rowErrors.isEmpty(),
                            rowErrors
                    );
                })
                .toList();

        int invalid = (int) result.stream()
                .filter(row -> !row.valid())
                .count();

        return new ProgramImportPreviewResponse(
                rows.size(),
                rows.size() - invalid,
                invalid,
                invalid == 0,
                result
        );
    }

    @Transactional
    public int importAll(MultipartFile file) {
        List<Row> rows = read(file);
        Map<Integer, List<String>> errors = validate(rows);

        if (!errors.isEmpty()) {
            throw new IllegalArgumentException(
                    "Import bị từ chối vì có "
                            + errors.size()
                            + " dòng lỗi. Hãy preview và sửa file trước khi import."
            );
        }

        Map<Key, List<Row>> groups = rows.stream()
                .collect(Collectors.groupingBy(
                        row -> new Key(
                                norm(row.code()),
                                norm(row.version())
                        ),
                        LinkedHashMap::new,
                        Collectors.toList()
                ));

        List<TrainingProgramRequest> requests = new ArrayList<>();

        for (List<Row> group : groups.values()) {
            Row first = group.get(0);

            List<ProgramSubjectRequest> subjects = group.stream()
                    .sorted(Comparator.comparing(Row::orderIndex))
                    .map(row -> {
                        Subject subject = subjectRepository
                                .findByCodeAndVersion(
                                        row.subjectCode().trim(),
                                        row.subjectVersion().trim()
                                )
                                .orElseThrow(() ->
                                        new IllegalArgumentException(
                                                "Không tìm thấy môn "
                                                        + row.subjectCode()
                                                        + " phiên bản "
                                                        + row.subjectVersion()
                                        )
                                );

                        if (!Boolean.TRUE.equals(subject.getIsActive())) {
                            throw new IllegalArgumentException(
                                    "Môn học "
                                            + row.subjectCode()
                                            + " đang INACTIVE."
                            );
                        }

                        if (subject.getDurationHours() == null
            || subject.getDurationHours() <= 0) {
                            throw new IllegalArgumentException(
                                    "Thời lượng môn "
                                            + row.subjectCode()
                                            + " phải lớn hơn 0."
                            );
                        }

                        return new ProgramSubjectRequest(
                                subject.getId(),
                                row.orderIndex()
                        );
                    })
                    .toList();

            requests.add(new TrainingProgramRequest(
                    first.code().trim(),
                    first.name().trim(),
                    first.version().trim(),
                    first.region() == null ? null : first.region().trim(),
                    subjects
            ));
        }

        for (TrainingProgramRequest request : requests) {
            programService.create(request);
        }

        return requests.size();
    }

    private Map<Integer, List<String>> validate(List<Row> rows) {
        Map<Integer, List<String>> errors = new LinkedHashMap<>();

        if (rows == null || rows.isEmpty()) {
            return errors;
        }

        Map<Key, List<Row>> groups = rows.stream()
                .collect(Collectors.groupingBy(
                        row -> new Key(
                                norm(row.code()),
                                norm(row.version())
                        ),
                        LinkedHashMap::new,
                        Collectors.toList()
                ));

        Set<Key> existingPrograms = programRepository.findAll()
                .stream()
                .map(program -> new Key(
                        norm(program.getCode()),
                        norm(program.getVersion())
                ))
                .collect(Collectors.toSet());

        for (Map.Entry<Key, List<Row>> entry : groups.entrySet()) {
            List<Row> group = entry.getValue();
            Row first = group.get(0);

            if (blank(first.code())) {
                group.forEach(row ->
                        add(errors, row.number(), "Thiếu programCode.")
                );
            }

            if (blank(first.name())) {
                group.forEach(row ->
                        add(errors, row.number(), "Thiếu programName.")
                );
            }

            if (blank(first.version())) {
                group.forEach(row ->
                        add(errors, row.number(), "Thiếu programVersion.")
                );
            }

            if (first.code() != null
                    && first.code().trim().length() > 50) {
                group.forEach(row ->
                        add(errors, row.number(),
                                "programCode tối đa 50 ký tự.")
                );
            }

            if (first.name() != null
                    && first.name().trim().length() > 255) {
                group.forEach(row ->
                        add(errors, row.number(),
                                "programName tối đa 255 ký tự.")
                );
            }

            if (first.version() != null
                    && first.version().trim().length() > 30) {
                group.forEach(row ->
                        add(errors, row.number(),
                                "programVersion tối đa 30 ký tự.")
                );
            }

            if (first.region() != null
                    && first.region().trim().length() > 100) {
                group.forEach(row ->
                        add(errors, row.number(),
                                "region tối đa 100 ký tự.")
                );
            }

            if (existingPrograms.contains(entry.getKey())) {
                group.forEach(row ->
                        add(errors, row.number(),
                                "Chương trình code/version đã tồn tại trong hệ thống.")
                );
            }

            Set<String> subjects = new HashSet<>();
            Set<Integer> order = new HashSet<>();

            for (Row row : group) {
                if (!Objects.equals(
                        norm(row.name()),
                        norm(first.name())
                ) || !Objects.equals(
                        norm(row.region()),
                        norm(first.region())
                )) {
                    add(errors, row.number(),
                            "Thông tin chương trình phải giống nhau trên các dòng cùng code/version.");
                }

                if (blank(row.subjectCode())
                        || blank(row.subjectVersion())) {
                    add(errors, row.number(),
                            "Thiếu subjectCode hoặc subjectVersion.");
                }

                if (row.orderIndex() == null || row.orderIndex() < 1) {
                    add(errors, row.number(),
                            "orderIndex phải là số nguyên dương.");
                } else if (!order.add(row.orderIndex())) {
                    add(errors, row.number(),
                            "orderIndex bị trùng trong chương trình.");
                }

                String identity = norm(row.subjectCode())
                        + "::"
                        + norm(row.subjectVersion());

                if (!subjects.add(identity)) {
                    add(errors, row.number(),
                            "Môn học bị trùng trong chương trình.");
                }

                if (!blank(row.subjectCode())
                        && !blank(row.subjectVersion())) {
                    Optional<Subject> subject =
                            subjectRepository.findByCodeAndVersion(
                                    row.subjectCode().trim(),
                                    row.subjectVersion().trim()
                            );

                    if (subject.isEmpty()) {
                        add(errors, row.number(),
                                "Không tìm thấy môn học theo code/version.");
                    } else if (!Boolean.TRUE.equals(
                            subject.get().getIsActive()
                    )) {
                        add(errors, row.number(),
                                "Môn học đang INACTIVE.");
                    } else if (subject.get().getDurationHours() == null
            || subject.get().getDurationHours() <= 0) {
                        add(errors, row.number(),
                                "Thời lượng môn học phải lớn hơn 0.");
                    }
                }
            }

            if (order.size() != group.size()) {
                group.forEach(row ->
                        add(errors, row.number(),
                                "Thứ tự môn phải liên tục từ 1 đến N.")
                );
            }

            for (int i = 1; i <= group.size(); i++) {
                if (!order.contains(i)) {
                    int missingIndex = i;

                    group.forEach(row ->
                            add(errors, row.number(),
                                    "Thiếu orderIndex "
                                            + missingIndex
                                            + "; thứ tự phải liên tục từ 1 đến N.")
                    );

                    break;
                }
            }
        }

        return errors;
    }

    private List<Row> read(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException(
                    "Vui lòng chọn file cần Import."
            );
        }

        String filename = Optional
                .ofNullable(file.getOriginalFilename())
                .orElse("")
                .toLowerCase(Locale.ROOT);

        try {
            if (filename.endsWith(".xlsx")
                    || filename.endsWith(".xls")) {
                return readExcel(file);
            }

            if (filename.endsWith(".csv")) {
                return readDelimited(file, ',');
            }

            if (filename.endsWith(".txt")) {
                return readDelimited(file, '\t');
            }

            throw new IllegalArgumentException(
                    "Định dạng không được hỗ trợ. "
                            + "Chỉ chấp nhận XLSX, XLS, CSV hoặc TXT."
            );

        } catch (IOException e) {
            throw new IllegalArgumentException(
                    "Không thể đọc file Import.",
                    e
            );
        }
    }

    private List<Row> readExcel(MultipartFile file)
            throws IOException {

        try (Workbook workbook =
                     WorkbookFactory.create(file.getInputStream())) {

            if (workbook.getNumberOfSheets() == 0) {
                throw new IllegalArgumentException(
                        "File không có sheet dữ liệu."
                );
            }

            Sheet sheet = workbook.getSheetAt(0);

            if (sheet.getLastRowNum() < 1) {
                throw new IllegalArgumentException(
                        "File không có dòng dữ liệu."
                );
            }

            DataFormatter formatter = new DataFormatter();
            org.apache.poi.ss.usermodel.Row header =
                    sheet.getRow(0);

            if (header == null) {
                throw new IllegalArgumentException(
                        "Thiếu dòng tiêu đề."
                );
            }

            Map<String, Integer> columns = new HashMap<>();

            for (Cell cell : header) {
                columns.put(
                        normalize(formatter.formatCellValue(cell)),
                        cell.getColumnIndex()
                );
            }

            int codeCol = col(columns, "programcode", "code");
            int nameCol = col(columns, "programname", "name");
            int versionCol = col(columns, "programversion", "version");
            int regionCol = col(columns, "region");
            int subjectCodeCol =
                    col(columns, "subjectcode", "topiccode");
            int subjectVersionCol =
                    col(columns, "subjectversion", "topicversion");
            int orderCol = col(columns, "orderindex", "order");

            validateColumns(
                    codeCol,
                    nameCol,
                    versionCol,
                    subjectCodeCol,
                    subjectVersionCol,
                    orderCol
            );

            List<Row> rows = new ArrayList<>();

            for (int i = 1; i <= sheet.getLastRowNum(); i++) {
                org.apache.poi.ss.usermodel.Row data =
                        sheet.getRow(i);

                if (data == null) {
                    continue;
                }

                String code = value(data, codeCol, formatter);
                String subjectCode =
                        value(data, subjectCodeCol, formatter);

                if (blank(code) && blank(subjectCode)) {
                    continue;
                }

                String orderText =
                        value(data, orderCol, formatter);

                Integer order = parseOrder(orderText);

                rows.add(new Row(
                        i + 1,
                        code,
                        value(data, nameCol, formatter),
                        value(data, versionCol, formatter),
                        value(data, regionCol, formatter),
                        subjectCode,
                        value(data, subjectVersionCol, formatter),
                        order
                ));
            }

            return ensureRows(rows);
        }
    }

    private List<Row> readDelimited(
            MultipartFile file,
            char delimiter
    ) throws IOException {

        List<Row> rows = new ArrayList<>();

        try (BufferedReader reader = new BufferedReader(
                new InputStreamReader(
                        file.getInputStream(),
                        StandardCharsets.UTF_8
                )
        )) {
            String headerLine = reader.readLine();

            if (headerLine == null) {
                throw new IllegalArgumentException(
                        "File không có dữ liệu."
                );
            }

            headerLine = removeBom(headerLine);

            List<String> headers = parseDelimitedLine(
                    headerLine,
                    delimiter
            );

            Map<String, Integer> columns = new HashMap<>();

            for (int i = 0; i < headers.size(); i++) {
                columns.put(normalize(headers.get(i)), i);
            }

            int codeCol = col(columns, "programcode", "code");
            int nameCol = col(columns, "programname", "name");
            int versionCol = col(columns, "programversion", "version");
            int regionCol = col(columns, "region");
            int subjectCodeCol =
                    col(columns, "subjectcode", "topiccode");
            int subjectVersionCol =
                    col(columns, "subjectversion", "topicversion");
            int orderCol = col(columns, "orderindex", "order");

            validateColumns(
                    codeCol,
                    nameCol,
                    versionCol,
                    subjectCodeCol,
                    subjectVersionCol,
                    orderCol
            );

            String line;
            int lineNumber = 1;

            while ((line = reader.readLine()) != null) {
                lineNumber++;

                if (line.isBlank()) {
                    continue;
                }

                List<String> values =
                        parseDelimitedLine(line, delimiter);

                String code = getValue(values, codeCol);
                String subjectCode =
                        getValue(values, subjectCodeCol);

                if (blank(code) && blank(subjectCode)) {
                    continue;
                }

                rows.add(new Row(
                        lineNumber,
                        code,
                        getValue(values, nameCol),
                        getValue(values, versionCol),
                        getValue(values, regionCol),
                        getValue(values, subjectCodeCol),
                        getValue(values, subjectVersionCol),
                        parseOrder(getValue(values, orderCol))
                ));
            }
        }

        return ensureRows(rows);
    }

    private List<String> parseDelimitedLine(
            String line,
            char delimiter
    ) {
        List<String> values = new ArrayList<>();
        StringBuilder current = new StringBuilder();

        boolean quoted = false;

        for (int i = 0; i < line.length(); i++) {
            char c = line.charAt(i);

            if (c == '"') {
                if (quoted
                        && i + 1 < line.length()
                        && line.charAt(i + 1) == '"') {
                    current.append('"');
                    i++;
                } else {
                    quoted = !quoted;
                }
            } else if (c == delimiter && !quoted) {
                values.add(current.toString().trim());
                current.setLength(0);
            } else {
                current.append(c);
            }
        }

        if (quoted) {
            throw new IllegalArgumentException(
                    "Dòng CSV/TXT có dấu nháy kép chưa được đóng."
            );
        }

        values.add(current.toString().trim());

        return values;
    }

    private List<Row> ensureRows(List<Row> rows) {
        if (rows.isEmpty()) {
            throw new IllegalArgumentException(
                    "Không tìm thấy dòng dữ liệu trong file."
            );
        }

        return rows;
    }

    private void validateColumns(
            int codeCol,
            int nameCol,
            int versionCol,
            int subjectCodeCol,
            int subjectVersionCol,
            int orderCol
    ) {
        if (codeCol < 0
                || nameCol < 0
                || versionCol < 0
                || subjectCodeCol < 0
                || subjectVersionCol < 0
                || orderCol < 0) {
            throw new IllegalArgumentException(
                    "Thiếu cột bắt buộc: "
                            + "programCode, programName, programVersion, "
                            + "subjectCode, subjectVersion, orderIndex."
            );
        }
    }

    private Integer parseOrder(String value) {
        if (blank(value)) {
            return null;
        }

        try {
            return new BigDecimal(value.trim()).intValueExact();
        } catch (Exception ignored) {
            return null;
        }
    }

    private int col(
            Map<String, Integer> columns,
            String... aliases
    ) {
        for (String alias : aliases) {
            if (columns.containsKey(alias)) {
                return columns.get(alias);
            }
        }

        return -1;
    }

    private String value(
            org.apache.poi.ss.usermodel.Row row,
            int index,
            DataFormatter formatter
    ) {
        if (index < 0) {
            return "";
        }

        Cell cell = row.getCell(index);

        return cell == null
                ? ""
                : formatter.formatCellValue(cell).trim();
    }

    private String getValue(List<String> values, int index) {
        if (index < 0 || index >= values.size()) {
            return "";
        }

        return values.get(index).trim();
    }

    private String removeBom(String value) {
        if (value != null && !value.isEmpty()
                && value.charAt(0) == '\uFEFF') {
            return value.substring(1);
        }

        return value;
    }

    private String normalize(String value) {
        return value == null
                ? ""
                : value.trim()
                .toLowerCase(Locale.ROOT)
                .replaceAll("[^a-z0-9]", "");
    }

    private String norm(String value) {
        return normalize(value);
    }

    private boolean blank(String value) {
        return value == null || value.isBlank();
    }

    private void add(
            Map<Integer, List<String>> errors,
            int row,
            String message
    ) {
        errors.computeIfAbsent(
                row,
                ignored -> new ArrayList<>()
        ).add(message);
    }
}
