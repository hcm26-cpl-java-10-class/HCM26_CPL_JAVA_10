package com.example.starter_project_2025.system.exam.service;

import com.example.starter_project_2025.exception.ResourceNotFoundException;
import com.example.starter_project_2025.system.exam.domain.Exam;
import com.example.starter_project_2025.system.exam.domain.ExamAttempt;
import com.example.starter_project_2025.system.exam.domain.ExamAttemptRepository;
import com.example.starter_project_2025.system.exam.domain.ExamRepository;
import com.example.starter_project_2025.system.exam.dto.ExamResultStatisticsDTO;
import com.example.starter_project_2025.system.rbac.user.User;
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
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;

@Service
public class ExamResultExportService {

    private final ExamRepository examRepository;
    private final ExamAttemptRepository attemptRepository;
    private final ExamResultStatisticsService statisticsService;
    private final ExamResultReadinessService readinessService;

    public ExamResultExportService(
            ExamRepository examRepository,
            ExamAttemptRepository attemptRepository,
            ExamResultStatisticsService statisticsService,
            ExamResultReadinessService readinessService
    ) {
        this.examRepository = examRepository;
        this.attemptRepository = attemptRepository;
        this.statisticsService = statisticsService;
        this.readinessService = readinessService;
    }

    private static final List<String> HEADERS = List.of(
            "Student name",
            "Email",
            "Attempt number",
            "Objective score",
            "Final score",
            "Maximum score",
            "Status",
            "Submitted at"
    );

    private record AttemptRow(
            String studentName,
            String email,
            int attemptNumber,
            String objectiveScore,
            String finalScore,
            String maxScore,
            String status,
            String submittedAt
    ) {}

    private record ExportData(
            Exam exam,
            ExamResultStatisticsDTO statistics,
            List<AttemptRow> rows
    ) {}

    @Transactional(readOnly = true)
    public byte[] exportCsv(Long examId) throws IOException {
        ExportData data = buildExportData(examId);
        StringBuilder csv = new StringBuilder();

        appendCsvRow(csv, List.of("Exam", safe(data.exam().getTitle())));
        appendCsvRow(csv, List.of(
                "Total attempts",
                String.valueOf(data.statistics().totalAttempts())
        ));
        appendCsvRow(csv, List.of(
                "Fully graded attempts",
                String.valueOf(data.statistics().fullyGradedAttempts())
        ));
        appendCsvRow(csv, List.of(
                "Pending grading",
                String.valueOf(data.statistics().pendingGradingAttempts())
        ));
        appendCsvRow(csv, List.of(
                "Unique students",
                String.valueOf(data.statistics().uniqueStudents())
        ));
        appendCsvRow(csv, List.of(
                "Average final score",
                safe(data.statistics().averageFinalScore())
        ));
        appendCsvRow(csv, List.of(
                "Highest final score",
                safe(data.statistics().highestFinalScore())
        ));
        appendCsvRow(csv, List.of(
                "Lowest final score",
                safe(data.statistics().lowestFinalScore())
        ));

        csv.append("\r\n");
        appendCsvRow(csv, HEADERS);

        for (AttemptRow row : data.rows()) {
            appendCsvRow(csv, toValues(row));
        }

        return ("\uFEFF" + csv).getBytes(StandardCharsets.UTF_8);
    }

    @Transactional(readOnly = true)
    public byte[] exportExcel(Long examId) throws IOException {
        ExportData data = buildExportData(examId);

        try (Workbook workbook = new XSSFWorkbook();
             ByteArrayOutputStream output = new ByteArrayOutputStream()) {

            Sheet summary = workbook.createSheet("Statistics");
            int rowNumber = 0;

            rowNumber = addSummaryRow(
                    summary, rowNumber, "Exam",
                    safe(data.exam().getTitle())
            );
            rowNumber = addSummaryRow(
                    summary, rowNumber, "Total attempts",
                    String.valueOf(data.statistics().totalAttempts())
            );
            rowNumber = addSummaryRow(
                    summary, rowNumber, "Fully graded attempts",
                    String.valueOf(data.statistics().fullyGradedAttempts())
            );
            rowNumber = addSummaryRow(
                    summary, rowNumber, "Pending grading",
                    String.valueOf(data.statistics().pendingGradingAttempts())
            );
            rowNumber = addSummaryRow(
                    summary, rowNumber, "Unique students",
                    String.valueOf(data.statistics().uniqueStudents())
            );
            rowNumber = addSummaryRow(
                    summary, rowNumber, "Average final score",
                    safe(data.statistics().averageFinalScore())
            );
            rowNumber = addSummaryRow(
                    summary, rowNumber, "Highest final score",
                    safe(data.statistics().highestFinalScore())
            );
            addSummaryRow(
                    summary, rowNumber, "Lowest final score",
                    safe(data.statistics().lowestFinalScore())
            );

            summary.autoSizeColumn(0);
            summary.autoSizeColumn(1);

            Sheet scores = workbook.createSheet("Student Scores");
            Row header = scores.createRow(0);

            for (int i = 0; i < HEADERS.size(); i++) {
                header.createCell(i).setCellValue(HEADERS.get(i));
            }

            int index = 1;
            for (AttemptRow item : data.rows()) {
                Row row = scores.createRow(index++);
                List<String> values = toValues(item);

                for (int i = 0; i < values.size(); i++) {
                    row.createCell(i).setCellValue(values.get(i));
                }
            }

            for (int i = 0; i < HEADERS.size(); i++) {
                scores.autoSizeColumn(i);
            }

            workbook.write(output);
            return output.toByteArray();
        }
    }

    @Transactional(readOnly = true)
    public byte[] exportPdf(Long examId) throws IOException {
        ExportData data = buildExportData(examId);

        try (ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            PdfDocument pdf = new PdfDocument(new PdfWriter(output));

            try (Document document = new Document(pdf, PageSize.A4.rotate())) {
                document.setMargins(20, 20, 20, 20);
                document.setFont(createVietnameseFont());

                document.add(new Paragraph("Exam Result Statistics")
                        .setFontSize(18)
                        .setBold());

                document.add(new Paragraph(
                        "Exam: " + safe(data.exam().getTitle())
                ));
                document.add(new Paragraph(
                        "Total attempts: "
                                + data.statistics().totalAttempts()
                ));
                document.add(new Paragraph(
                        "Fully graded: "
                                + data.statistics().fullyGradedAttempts()
                ));
                document.add(new Paragraph(
                        "Pending grading: "
                                + data.statistics().pendingGradingAttempts()
                ));
                document.add(new Paragraph(
                        "Unique students: "
                                + data.statistics().uniqueStudents()
                ));
                document.add(new Paragraph(
                        "Average final score: "
                                + safe(data.statistics().averageFinalScore())
                ));
                document.add(new Paragraph(
                        "Highest final score: "
                                + safe(data.statistics().highestFinalScore())
                ));
                document.add(new Paragraph(
                        "Lowest final score: "
                                + safe(data.statistics().lowestFinalScore())
                ));

                float[] widths = {
                        1.5f, 2, 2, 0.9f, 1.1f,
                        1.1f, 1.1f, 1.2f, 2
                };

                Table table = new Table(UnitValue.createPercentArray(widths))
                        .useAllAvailableWidth();

                for (String heading : HEADERS) {
                    table.addHeaderCell(
                            new Cell().add(
                                    new Paragraph(heading)
                                            .setBold()
                                            .setFontSize(8)
                            )
                    );
                }

                for (AttemptRow item : data.rows()) {
                    for (String value : toValues(item)) {
                        table.addCell(
                                new Cell().add(
                                        new Paragraph(value)
                                                .setFontSize(7)
                                )
                        );
                    }
                }

                document.add(table);
            }

            return output.toByteArray();
        }
    }

    private ExportData buildExportData(Long examId) {
        Exam exam = examRepository.findById(examId)
                .orElseThrow(() ->
                        new ResourceNotFoundException("Exam not found")
                );

        ExamResultStatisticsDTO statistics =
                statisticsService.getStatistics(examId);

        List<ExamAttempt> attempts =
                attemptRepository.findAllByExam_Id(examId);

        List<AttemptRow> rows = new ArrayList<>();

        for (ExamAttempt attempt : attempts) {
            User student = attempt.getStudent();

            // Chỉ xuất điểm cuối cùng khi bài thi đã chấm hoàn tất.
            boolean fullyGraded = readinessService.isFullyGraded(attempt);

            rows.add(new AttemptRow(
                    student == null ? "" : safe(student.getFullName()),
                    student == null ? "" : safe(student.getEmail()),
                    attempt.getAttemptNumber(),
                    safe(attempt.getObjectiveScore()),
                    fullyGraded ? safe(attempt.getFinalScore()) : "",
                    safe(attempt.getMaxScore()),
                    attempt.getStatus() == null
                            ? ""
                            : attempt.getStatus().name(),
                    formatInstant(attempt.getSubmittedAt())
            ));
        }

        return new ExportData(exam, statistics, rows);
    }

    private int addSummaryRow(
            Sheet sheet,
            int rowNumber,
            String label,
            String value
    ) {
        Row row = sheet.createRow(rowNumber);
        row.createCell(0).setCellValue(label);
        row.createCell(1).setCellValue(value);
        return rowNumber + 1;
    }

    private List<String> toValues(AttemptRow row) {
        return List.of(
                row.studentName(),
                row.email(),
                String.valueOf(row.attemptNumber()),
                row.objectiveScore(),
                row.finalScore(),
                row.maxScore(),
                row.status(),
                row.submittedAt()
        );
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

    private String formatInstant(Instant instant) {
        return instant == null
                ? ""
                : DateTimeFormatter.ISO_INSTANT.format(instant);
    }

    private String safe(Object value) {
        return value == null ? "" : value.toString();
    }

    private PdfFont createVietnameseFont() throws IOException {
        try (InputStream stream = getClass().getResourceAsStream(
                "/fonts/DejaVuSans.ttf"
        )) {
            if (stream != null) {
                return PdfFontFactory.createFont(
                        stream.readAllBytes(),
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
