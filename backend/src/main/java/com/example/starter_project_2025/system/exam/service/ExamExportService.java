package com.example.starter_project_2025.system.exam.service;

import com.example.starter_project_2025.system.exam.domain.Exam;
import com.example.starter_project_2025.system.exam.domain.ExamCategory;
import com.example.starter_project_2025.system.exam.domain.ExamRepository;
import com.example.starter_project_2025.system.exam.dto.ExamDTO;
import com.example.starter_project_2025.system.exam.dto.ExamFilter;
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
import lombok.RequiredArgsConstructor;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.ss.usermodel.Workbook;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;

@Service
@RequiredArgsConstructor
public class ExamExportService {

    private final ExamServiceImpl examService;

    private static final List<String> HEADERS = List.of(
            "Title", "Category", "Exam Type", "Duration (Mins)",
            "Max Score", "Pass Score", "Max Attempts",
            "Shuffle Questions", "Shuffle Options", "Anti-Cheat", "Course / Placement"
    );

    private static final List<String> TEMPLATE_HEADERS = List.of(
            "title", "category", "examType", "durationMinutes",
            "maxScore", "passScore", "maxAttempts",
            "shuffleQuestions", "shuffleOptions", "antiCheatEnabled"
    );

    public List<ExamDTO> getExams(ExamFilter filter, String search) {
        List<ExamDTO> allExams = new ArrayList<>();
        int pageNumber = 0;
        int pageSize = 100;
        Page<ExamDTO> page;

        do {
            page = examService.getAll(
                    PageRequest.of(pageNumber, pageSize, Sort.by(Sort.Direction.DESC, "createdAt")),
                    search,
                    filter
            );
            allExams.addAll(page.getContent());
            pageNumber++;
        } while (page.hasNext());

        return allExams;
    }

    public byte[] exportCsv(ExamFilter filter, String search) {
        StringBuilder csv = new StringBuilder();
        appendCsvRow(csv, HEADERS);

        for (ExamDTO exam : getExams(filter, search)) {
            appendCsvRow(csv, toExportRow(exam));
        }

        return withUtf8Bom(csv);
    }

    public byte[] exportExcel(ExamFilter filter, String search) throws IOException {
        try (Workbook workbook = new XSSFWorkbook();
             ByteArrayOutputStream output = new ByteArrayOutputStream()) {

            Sheet sheet = workbook.createSheet("Assessments");

            Row headerRow = sheet.createRow(0);
            for (int col = 0; col < HEADERS.size(); col++) {
                headerRow.createCell(col).setCellValue(HEADERS.get(col));
            }

            int rowIdx = 1;
            for (ExamDTO exam : getExams(filter, search)) {
                List<String> values = toExportRow(exam);
                Row row = sheet.createRow(rowIdx++);
                for (int col = 0; col < values.size(); col++) {
                    row.createCell(col).setCellValue(values.get(col));
                }
            }

            for (int col = 0; col < HEADERS.size(); col++) {
                sheet.autoSizeColumn(col);
            }

            workbook.write(output);
            return output.toByteArray();
        }
    }

    public byte[] exportPdf(ExamFilter filter, String search) throws IOException {
        try (ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            PdfWriter writer = new PdfWriter(output);
            PdfDocument pdf = new PdfDocument(writer);

            try (Document document = new Document(pdf, PageSize.A4.rotate())) {
                document.setMargins(20, 20, 20, 20);

                PdfFont font = createVietnameseFont();
                document.setFont(font);

                document.add(new Paragraph("Assessments & Exams Export")
                        .setFontSize(16)
                        .setBold());

                List<ExamDTO> exams = getExams(filter, search);
                document.add(new Paragraph("Total records: " + exams.size()).setFontSize(9));

                float[] widths = {3.5f, 1.5f, 2.0f, 1.2f, 1.0f, 1.0f, 1.0f, 1.0f, 1.0f, 1.0f, 2.5f};
                Table table = new Table(UnitValue.createPercentArray(widths)).useAllAvailableWidth();

                for (String heading : HEADERS) {
                    table.addHeaderCell(new Cell().add(new Paragraph(heading).setBold().setFontSize(9)));
                }

                for (ExamDTO exam : exams) {
                    List<String> rowValues = toExportRow(exam);
                    for (String val : rowValues) {
                        table.addCell(new Cell().add(new Paragraph(val).setFontSize(8)));
                    }
                }

                document.add(table);
            }

            return output.toByteArray();
        }
    }

    public byte[] downloadCsvTemplate() {
        StringBuilder csv = new StringBuilder();
        appendCsvRow(csv, TEMPLATE_HEADERS);

        appendCsvRow(csv, List.of(
                "Java Spring Boot Fundamentals Quiz",
                "QUIZ",
                "MULTIPLE_CHOICE_ONLY",
                "45",
                "10",
                "5",
                "1",
                "true",
                "true",
                "false"
        ));

        appendCsvRow(csv, List.of(
                "Java REST APIs Assignment",
                "ASSIGNMENT",
                "CODING_ONLY",
                "60",
                "10",
                "6",
                "2",
                "false",
                "false",
                "false"
        ));

        appendCsvRow(csv, List.of(
                "Final Exam - Full Stack Java",
                "FINAL",
                "MIXED",
                "90",
                "10",
                "5",
                "1",
                "true",
                "true",
                "true"
        ));

        return withUtf8Bom(csv);
    }

    public byte[] downloadExcelTemplate() {
        try (Workbook workbook = new XSSFWorkbook();
             ByteArrayOutputStream output = new ByteArrayOutputStream()) {

            Sheet sheet = workbook.createSheet("Exam_Template");

            Row headerRow = sheet.createRow(0);
            for (int col = 0; col < TEMPLATE_HEADERS.size(); col++) {
                headerRow.createCell(col).setCellValue(TEMPLATE_HEADERS.get(col));
            }

            List<List<String>> samples = List.of(
                    List.of("Java Spring Boot Fundamentals Quiz", "QUIZ", "MULTIPLE_CHOICE_ONLY", "45", "10", "5", "1", "true", "true", "false"),
                    List.of("Java REST APIs Assignment", "ASSIGNMENT", "CODING_ONLY", "60", "10", "6", "2", "false", "false", "false"),
                    List.of("Final Exam - Full Stack Java", "FINAL", "MIXED", "90", "10", "5", "1", "true", "true", "true")
            );

            int rowIdx = 1;
            for (List<String> sample : samples) {
                Row row = sheet.createRow(rowIdx++);
                for (int col = 0; col < sample.size(); col++) {
                    row.createCell(col).setCellValue(sample.get(col));
                }
            }

            for (int col = 0; col < TEMPLATE_HEADERS.size(); col++) {
                sheet.autoSizeColumn(col);
            }

            workbook.write(output);
            return output.toByteArray();
        } catch (IOException e) {
            throw new RuntimeException("Failed to generate Excel template", e);
        }
    }

    private List<String> toExportRow(ExamDTO exam) {
        String coursePlacement = "—";
        if (exam.getCourseName() != null) {
            String place = exam.getLessonTitle() != null ? exam.getLessonTitle() : exam.getSectionTitle();
            coursePlacement = place != null ? exam.getCourseName() + " › " + place : exam.getCourseName();
        }

        return List.of(
                safe(exam.getTitle()),
                safe(exam.getCategory()),
                safe(exam.getExamType()),
                safe(exam.getDurationMinutes()),
                safe(exam.getMaxScore()),
                safe(exam.getPassScore()),
                safe(exam.getMaxAttempts()),
                safe(exam.getShuffleQuestions()),
                safe(exam.getShuffleOptions()),
                safe(exam.getAntiCheatEnabled()),
                safe(coursePlacement)
        );
    }

    private String safe(Object obj) {
        return obj == null ? "" : String.valueOf(obj);
    }

    private void appendCsvRow(StringBuilder csv, List<String> values) {
        for (int i = 0; i < values.size(); i++) {
            String value = values.get(i) == null ? "" : values.get(i);
            csv.append("\"").append(value.replace("\"", "\"\"")).append("\"");
            if (i < values.size() - 1) {
                csv.append(",");
            }
        }
        csv.append("\n");
    }

    private byte[] withUtf8Bom(StringBuilder csv) {
        byte[] bytes = csv.toString().getBytes(StandardCharsets.UTF_8);
        byte[] bom = new byte[]{(byte) 0xEF, (byte) 0xBB, (byte) 0xBF};
        byte[] result = new byte[bom.length + bytes.length];
        System.arraycopy(bom, 0, result, 0, bom.length);
        System.arraycopy(bytes, 0, result, bom.length, bytes.length);
        return result;
    }

    private PdfFont createVietnameseFont() throws IOException {
        try (InputStream fontStream = getClass().getResourceAsStream("/fonts/DejaVuSans.ttf")) {
            if (fontStream != null) {
                return PdfFontFactory.createFont(fontStream.readAllBytes(), PdfEncodings.IDENTITY_H);
            }
        }
        try {
            return PdfFontFactory.createFont("C:/Windows/Fonts/arial.ttf", PdfEncodings.IDENTITY_H);
        } catch (IOException ignored) {
            return PdfFontFactory.createFont(StandardFonts.HELVETICA);
        }
    }
}
