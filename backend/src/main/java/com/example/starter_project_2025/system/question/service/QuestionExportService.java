package com.example.starter_project_2025.system.question.service;

import com.example.starter_project_2025.system.question.dto.QuestionDTO;
import com.example.starter_project_2025.system.question.dto.QuestionFilter;
import com.example.starter_project_2025.system.question.domain.Difficulty;
import com.example.starter_project_2025.system.question.domain.QuestionType;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
public class QuestionExportService {

    private static final List<String> HEADERS = List.of(
            "content",
            "type",
            "difficulty",
            "topic",
            "points",
            "options",
            "isActive"
    );

    private final QuestionServiceImpl questionService;
    private final ObjectMapper objectMapper;

    public QuestionExportService(
            QuestionServiceImpl questionService,
            ObjectMapper objectMapper
    ) {
        this.questionService = questionService;
        this.objectMapper = objectMapper;
    }

    // Export all questions matching the filter, across every page.
    public byte[] exportCsv(QuestionFilter filter) throws IOException {
        StringBuilder csv = new StringBuilder();
        appendRow(csv, HEADERS);

        int pageNumber = 0;
        Page<QuestionDTO> page;

        do {
            page = questionService.getAll(
                    PageRequest.of(pageNumber, 500),
                    null,
                    filter
            );

            for (QuestionDTO question : page.getContent()) {
                String optionsJson = objectMapper.writeValueAsString(
                        question.getOptions() == null
                                ? List.of()
                                : question.getOptions()
                );

                appendRow(csv, List.of(
                        safe(question.getContent()),
                        safe(question.getType()),
                        safe(question.getDifficulty()),
                        safe(question.getTopic()),
                        safe(question.getPoints()),
                        optionsJson,
                        safe(question.getIsActive())
                ));
            }

            pageNumber++;
        } while (page.hasNext());

        return withUtf8Bom(csv);
    }

    // Downloadable CSV template with headers only.
    public byte[] downloadTemplate() {
        StringBuilder csv = new StringBuilder();
        appendRow(csv, HEADERS);
        return withUtf8Bom(csv);
    }

    // Import each CSV record through the existing create service.
    public int importCsv(MultipartFile file) throws IOException {
        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException("Please upload a non-empty CSV file.");
        }

        String content = new String(
                file.getBytes(),
                StandardCharsets.UTF_8
        );

        // Remove UTF-8 BOM if present.
        if (!content.isEmpty() && content.charAt(0) == '\uFEFF') {
            content = content.substring(1);
        }

        List<List<String>> rows = parseCsv(content);

        if (rows.isEmpty()) {
            throw new IllegalArgumentException("The CSV file is empty.");
        }

        List<String> headers = rows.get(0).stream()
                .map(String::trim)
                .map(String::toLowerCase)
                .toList();

        for (String required : List.of(
                "content", "type", "difficulty", "points", "options"
        )) {
            if (!headers.contains(required)) {
                throw new IllegalArgumentException(
                        "Missing required CSV column: " + required
                );
            }
        }

        Map<String, Integer> columns = new HashMap<>();
        for (int i = 0; i < headers.size(); i++) {
            columns.put(headers.get(i), i);
        }

        int imported = 0;

        for (int rowIndex = 1; rowIndex < rows.size(); rowIndex++) {
            List<String> row = rows.get(rowIndex);

            if (row.stream().allMatch(String::isBlank)) {
                continue;
            }

            int csvLine = rowIndex + 1;

            try {
                QuestionDTO dto = new QuestionDTO();

                dto.setContent(value(row, columns, "content"));
                dto.setType(QuestionType.valueOf(
                        value(row, columns, "type").trim()
                ));
                dto.setDifficulty(Difficulty.valueOf(
                        value(row, columns, "difficulty").trim()
                ));
                dto.setTopic(blankToNull(
                        value(row, columns, "topic")
                ));

                dto.setPoints(Integer.valueOf(
                        value(row, columns, "points").trim()
                ));

                String optionsJson = value(row, columns, "options").trim();

                List<QuestionDTO.OptionDTO> options =
                        optionsJson.isEmpty()
                                ? new ArrayList<>()
                                : objectMapper.readValue(
                                optionsJson,
                                new TypeReference<
                                                 List<QuestionDTO.OptionDTO>
                                                 >() {}
                        );

                // Do not reuse old option IDs from an exported file.
                options.forEach(option -> option.setId(null));
                dto.setOptions(options);

                String active = value(row, columns, "isActive").trim();
                if (!active.isEmpty()) {
                    if (!active.equalsIgnoreCase("true")
                            && !active.equalsIgnoreCase("false")) {
                        throw new IllegalArgumentException(
                                "isActive must be true or false."
                        );
                    }
                    dto.setIsActive(Boolean.valueOf(active));
                }

                // Reuse existing mapping, validation and permission checks.
                questionService.create(dto);
                imported++;

            } catch (Exception ex) {
                throw new IllegalArgumentException(
                        "Import failed at CSV row " + csvLine
                                + ": " + ex.getMessage(),
                        ex
                );
            }
        }

        return imported;
    }

    private String value(
            List<String> row,
            Map<String, Integer> columns,
            String name
    ) {
        Integer index = columns.get(name);
        if (index == null || index >= row.size()) {
            return "";
        }
        return row.get(index);
    }

    private String blankToNull(String value) {
        return value == null || value.isBlank()
                ? null
                : value.trim();
    }

    private String safe(Object value) {
        return value == null ? "" : value.toString();
    }

    private void appendRow(StringBuilder csv, List<String> values) {
        for (int i = 0; i < values.size(); i++) {
            if (i > 0) {
                csv.append(',');
            }

            String value = values.get(i) == null ? "" : values.get(i);

            // Escape CSV fields containing commas, quotes or line breaks.
            csv.append('"')
                    .append(value.replace("\"", "\"\""))
                    .append('"');
        }

        csv.append("\r\n");
    }

    private byte[] withUtf8Bom(StringBuilder csv) {
        return ("\uFEFF" + csv).getBytes(StandardCharsets.UTF_8);
    }

    // Handles quoted fields, escaped quotes, commas and embedded newlines.
    private List<List<String>> parseCsv(String csv) {
        List<List<String>> rows = new ArrayList<>();
        List<String> row = new ArrayList<>();
        StringBuilder field = new StringBuilder();
        boolean quoted = false;

        for (int i = 0; i < csv.length(); i++) {
            char c = csv.charAt(i);

            if (quoted) {
                if (c == '"') {
                    if (i + 1 < csv.length()
                            && csv.charAt(i + 1) == '"') {
                        field.append('"');
                        i++;
                    } else {
                        quoted = false;
                    }
                } else {
                    field.append(c);
                }
            } else if (c == '"' && field.isEmpty()) {
                quoted = true;
            } else if (c == ',') {
                row.add(field.toString());
                field.setLength(0);
            } else if (c == '\n' || c == '\r') {
                if (c == '\r' && i + 1 < csv.length()
                        && csv.charAt(i + 1) == '\n') {
                    i++;
                }

                row.add(field.toString());
                field.setLength(0);

                rows.add(row);
                row = new ArrayList<>();
            } else {
                field.append(c);
            }
        }

        if (quoted) {
            throw new IllegalArgumentException(
                    "CSV contains an unclosed quoted field."
            );
        }

        if (!row.isEmpty() || !field.isEmpty()) {
            row.add(field.toString());
            rows.add(row);
        }

        return rows;
    }
}
