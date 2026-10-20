package com.example.starter_project_2025.system.question.service;

import com.example.starter_project_2025.system.question.dto.QuestionDTO;
import com.example.starter_project_2025.system.question.dto.QuestionFilter;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.List;

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

}
