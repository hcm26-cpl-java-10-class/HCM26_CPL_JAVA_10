package com.example.starter_project_2025.system.question.service;

import com.example.starter_project_2025.system.question.dto.QuestionDTO;
import com.example.starter_project_2025.system.question.dto.QuestionFilter;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.ss.usermodel.Workbook;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;

import java.io.ByteArrayOutputStream;
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

    private static final List<String> TEMPLATE_HEADERS = List.of(
            "content", "type", "difficulty", "topic", "points",
            "option 1", "correct 1", "option 2", "correct 2",
            "option 3", "correct 3", "option 4", "correct 4"
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

    // Downloadable CSV template with headers and sample rows.
    public byte[] downloadTemplate() {
        StringBuilder csv = new StringBuilder();
        appendRow(csv, TEMPLATE_HEADERS);
        appendRow(csv, List.of(
                "Java là ngôn ngữ lập trình loại nào?", "MULTIPLE_CHOICE", "EASY", "Java", "1",
                "Hướng đối tượng", "true", "Hướng thủ tục", "false", "Hợp ngữ", "false", "Kịch bản", "false"
        ));
        appendRow(csv, List.of(
                "Trình bày các tính chất cơ bản của lập trình hướng đối tượng (OOP).", "ESSAY", "HARD", "OOP", "5",
                "", "", "", "", "", "", "", ""
        ));
        return withUtf8Bom(csv);
    }

    // Downloadable Excel (.xlsx) template with headers and sample rows.
    public byte[] downloadExcelTemplate() {
        try (Workbook workbook = new XSSFWorkbook()) {
            Sheet sheet = workbook.createSheet("Questions");

            Row headerRow = sheet.createRow(0);
            for (int i = 0; i < TEMPLATE_HEADERS.size(); i++) {
                headerRow.createCell(i).setCellValue(TEMPLATE_HEADERS.get(i));
            }

            // Sample 1: MULTIPLE_CHOICE
            Row s1 = sheet.createRow(1);
            s1.createCell(0).setCellValue("Java là ngôn ngữ lập trình loại nào?");
            s1.createCell(1).setCellValue("MULTIPLE_CHOICE");
            s1.createCell(2).setCellValue("EASY");
            s1.createCell(3).setCellValue("Java");
            s1.createCell(4).setCellValue(1);
            s1.createCell(5).setCellValue("Hướng đối tượng");
            s1.createCell(6).setCellValue(true);
            s1.createCell(7).setCellValue("Hướng thủ tục");
            s1.createCell(8).setCellValue(false);
            s1.createCell(9).setCellValue("Hợp ngữ");
            s1.createCell(10).setCellValue(false);
            s1.createCell(11).setCellValue("Kịch bản");
            s1.createCell(12).setCellValue(false);

            // Sample 2: ESSAY
            Row s2 = sheet.createRow(2);
            s2.createCell(0).setCellValue("Trình bày các tính chất cơ bản của lập trình hướng đối tượng (OOP).");
            s2.createCell(1).setCellValue("ESSAY");
            s2.createCell(2).setCellValue("HARD");
            s2.createCell(3).setCellValue("OOP");
            s2.createCell(4).setCellValue(5);

            for (int i = 0; i < TEMPLATE_HEADERS.size(); i++) {
                sheet.autoSizeColumn(i);
            }

            ByteArrayOutputStream out = new ByteArrayOutputStream();
            workbook.write(out);
            return out.toByteArray();
        } catch (Exception e) {
            throw new RuntimeException("Failed to generate Excel template", e);
        }
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
