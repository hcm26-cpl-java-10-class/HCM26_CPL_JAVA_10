package com.example.starter_project_2025.system.question.service;

import com.example.starter_project_2025.system.question.dto.QuestionDTO;
import com.example.starter_project_2025.system.question.dto.QuestionFilter;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.itextpdf.io.font.PdfEncodings;
import com.itextpdf.io.font.constants.StandardFonts;
import com.itextpdf.kernel.font.PdfFont;
import com.itextpdf.kernel.font.PdfFontFactory;
import com.itextpdf.kernel.geom.PageSize;
import com.itextpdf.kernel.pdf.PdfDocument;
import com.itextpdf.kernel.pdf.PdfWriter;
import com.itextpdf.layout.Document;
import com.itextpdf.layout.element.Cell;
import com.itextpdf.layout.element.Paragraph;
import com.itextpdf.layout.element.Table;
import com.itextpdf.layout.properties.UnitValue;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.ss.usermodel.Workbook;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;

@Service
public class QuestionExportService {

    private static final int PAGE_SIZE = 500;
    private static final int MAX_OPTIONS = 6;

    private static final List<String> HEADERS = List.of(
            "content", "type", "difficulty", "topic", "points",
            "option 1", "correct 1",
            "option 2", "correct 2",
            "option 3", "correct 3",
            "option 4", "correct 4",
            "option 5", "correct 5",
            "option 6", "correct 6"
    );

    private static final List<String> LEGACY_HEADERS = List.of(
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
            "option 1", "correct 1",
            "option 2", "correct 2",
            "option 3", "correct 3",
            "option 4", "correct 4"
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

    private List<QuestionDTO> getQuestions(QuestionFilter filter) {
        List<QuestionDTO> questions = new ArrayList<>();
        int pageNumber = 0;
        Page<QuestionDTO> page;

        do {
            page = questionService.getAll(
                    PageRequest.of(pageNumber, PAGE_SIZE),
                    null,
                    filter
            );

            questions.addAll(page.getContent());
            pageNumber++;
        } while (page.hasNext());

        return questions;
    }

    public byte[] exportLegacyCsv(QuestionFilter filter)
            throws IOException {
        StringBuilder csv = new StringBuilder();
        appendCsvRow(csv, LEGACY_HEADERS);

        for (QuestionDTO question : getQuestions(filter)) {
            String optionsJson = objectMapper.writeValueAsString(
                    question.getOptions() == null
                            ? List.of()
                            : question.getOptions()
            );

            appendCsvRow(csv, List.of(
                    safe(question.getContent()),
                    safe(question.getType()),
                    safe(question.getDifficulty()),
                    safe(question.getTopic()),
                    safe(question.getPoints()),
                    optionsJson,
                    safe(question.getIsActive())
            ));
        }

        return withUtf8Bom(csv);
    }

    public byte[] exportCsv(QuestionFilter filter) throws IOException {
        StringBuilder csv = new StringBuilder();
        appendCsvRow(csv, HEADERS);

        for (QuestionDTO question : getQuestions(filter)) {
            appendCsvRow(csv, toExportRow(question));
        }

        return withUtf8Bom(csv);
    }

    public byte[] exportExcel(QuestionFilter filter) throws IOException {
        try (Workbook workbook = new XSSFWorkbook();
             ByteArrayOutputStream output = new ByteArrayOutputStream()) {

            Sheet sheet = workbook.createSheet("Questions");

            Row header = sheet.createRow(0);
            for (int column = 0; column < HEADERS.size(); column++) {
                header.createCell(column).setCellValue(HEADERS.get(column));
            }

            int rowNumber = 1;

            for (QuestionDTO question : getQuestions(filter)) {
                List<String> values = toExportRow(question);
                Row row = sheet.createRow(rowNumber++);

                for (int column = 0; column < values.size(); column++) {
                    row.createCell(column).setCellValue(values.get(column));
                }
            }

            for (int column = 0; column < HEADERS.size(); column++) {
                sheet.autoSizeColumn(column);
            }

            workbook.write(output);
            return output.toByteArray();
        }
    }

    public byte[] exportPdf(QuestionFilter filter) throws IOException {
        try (ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            PdfWriter writer = new PdfWriter(output);
            PdfDocument pdf = new PdfDocument(writer);

            try (Document document = new Document(pdf, PageSize.A4.rotate())) {
                document.setMargins(24, 24, 24, 24);

                PdfFont font = createVietnameseFont();
                document.setFont(font);

                document.add(new Paragraph("Question Export")
                        .setFontSize(18)
                        .setBold());

                List<QuestionDTO> questions = getQuestions(filter);

                document.add(new Paragraph(
                        "Total questions: " + questions.size()
                ).setFontSize(10));

                float[] widths = {4, 1.4f, 1.4f, 2, 0.8f, 5};
                Table table = new Table(UnitValue.createPercentArray(widths))
                        .useAllAvailableWidth();

                for (String heading : List.of(
                        "Content", "Type", "Difficulty",
                        "Topic", "Points", "Options"
                )) {
                    table.addHeaderCell(new Cell().add(
                            new Paragraph(heading).setBold()
                    ));
                }

                for (QuestionDTO question : questions) {
                    table.addCell(pdfCell(question.getContent()));
                    table.addCell(pdfCell(question.getType()));
                    table.addCell(pdfCell(question.getDifficulty()));
                    table.addCell(pdfCell(question.getTopic()));
                    table.addCell(pdfCell(question.getPoints()));
                    table.addCell(pdfCell(formatOptions(question)));
                }

                document.add(table);
            }

            return output.toByteArray();
        }
    }

    public byte[] downloadTemplate() {
        StringBuilder csv = new StringBuilder();
        appendCsvRow(csv, TEMPLATE_HEADERS);

        appendCsvRow(csv, List.of(
                "Java là ngôn ngữ lập trình loại nào?",
                "MULTIPLE_CHOICE", "EASY", "Java", "1",
                "Hướng đối tượng", "true",
                "Hướng thủ tục", "false",
                "Hợp ngữ", "false",
                "Kịch bản", "false"
        ));

        appendCsvRow(csv, List.of(
                "Trình bày các tính chất cơ bản của lập trình hướng đối tượng (OOP).",
                "ESSAY", "HARD", "OOP", "5",
                "", "", "", "", "", "", "", ""
        ));

        return withUtf8Bom(csv);
    }

    public byte[] downloadExcelTemplate() {
        try (Workbook workbook = new XSSFWorkbook();
             ByteArrayOutputStream output = new ByteArrayOutputStream()) {

            Sheet sheet = workbook.createSheet("Questions");

            Row headerRow = sheet.createRow(0);
            for (int i = 0; i < TEMPLATE_HEADERS.size(); i++) {
                headerRow.createCell(i).setCellValue(TEMPLATE_HEADERS.get(i));
            }

            Row s1 = sheet.createRow(1);
            s1.createCell(0).setCellValue(
                    "Java là ngôn ngữ lập trình loại nào?"
            );
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

            Row s2 = sheet.createRow(2);
            s2.createCell(0).setCellValue(
                    "Trình bày các tính chất cơ bản của lập trình hướng đối tượng (OOP)."
            );
            s2.createCell(1).setCellValue("ESSAY");
            s2.createCell(2).setCellValue("HARD");
            s2.createCell(3).setCellValue("OOP");
            s2.createCell(4).setCellValue(5);

            for (int i = 0; i < TEMPLATE_HEADERS.size(); i++) {
                sheet.autoSizeColumn(i);
            }

            workbook.write(output);
            return output.toByteArray();
        } catch (Exception e) {
            throw new RuntimeException(
                    "Failed to generate Excel template", e
            );
        }
    }

    private List<String> toExportRow(QuestionDTO question) {
        List<String> values = new ArrayList<>();

        values.add(safe(question.getContent()));
        values.add(safe(question.getType()));
        values.add(safe(question.getDifficulty()));
        values.add(safe(question.getTopic()));
        values.add(safe(question.getPoints()));

        List<QuestionDTO.OptionDTO> options = question.getOptions();

        for (int i = 0; i < MAX_OPTIONS; i++) {
            if (options != null
                    && i < options.size()
                    && options.get(i) != null) {
                QuestionDTO.OptionDTO option = options.get(i);
                values.add(safe(option.getContent()));
                values.add(Boolean.toString(option.isCorrect()));
            } else {
                values.add("");
                values.add("");
            }
        }

        return values;
    }

    private String formatOptions(QuestionDTO question) {
        List<QuestionDTO.OptionDTO> options = question.getOptions();

        if (options == null || options.isEmpty()) {
            return "";
        }

        StringBuilder result = new StringBuilder();

        for (int i = 0; i < options.size(); i++) {
            QuestionDTO.OptionDTO option = options.get(i);

            if (option == null) {
                continue;
            }

            if (result.length() > 0) {
                result.append("\n");
            }

            result.append(i + 1)
                    .append(". ")
                    .append(safe(option.getContent()));

            if (option.isCorrect()) {
                result.append(" (Correct)");
            }
        }

        return result.toString();
    }

    private void appendCsvRow(
            StringBuilder csv,
            List<String> values
    ) {
        for (int i = 0; i < values.size(); i++) {
            if (i > 0) {
                csv.append(',');
            }

            String value = values.get(i) == null ? "" : values.get(i);

            csv.append('"')
                    .append(value.replace("\"", "\"\""))
                    .append('"');
        }

        csv.append("\r\n");
    }

    private byte[] withUtf8Bom(StringBuilder csv) {
        return ("\uFEFF" + csv).getBytes(StandardCharsets.UTF_8);
    }

    private Cell pdfCell(Object value) {
        return new Cell().add(
                new Paragraph(safe(value)).setFontSize(9)
        );
    }

    private String safe(Object value) {
        return value == null ? "" : value.toString();
    }

    private PdfFont createVietnameseFont() throws IOException {
        try (InputStream fontStream = getClass().getResourceAsStream(
                "/fonts/DejaVuSans.ttf"
        )) {
            if (fontStream != null) {
                return PdfFontFactory.createFont(
                        fontStream.readAllBytes(),
                        PdfEncodings.IDENTITY_H
                );
            }
        }

        try {
            return PdfFontFactory.createFont(
                    "C:/Windows/Fonts/arial.ttf",
                    PdfEncodings.IDENTITY_H
            );
        } catch (IOException ignored) {
            return PdfFontFactory.createFont(StandardFonts.HELVETICA);
        }
    }
}
