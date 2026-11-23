package com.example.starter_project_2025.system.project.developmentinsights.service;

import com.example.starter_project_2025.system.project.developmentinsights.dto.GitActivityDtos;
import com.itextpdf.io.font.PdfEncodings;
import com.itextpdf.kernel.colors.ColorConstants;
import com.itextpdf.kernel.colors.DeviceRgb;
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
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import lombok.RequiredArgsConstructor;
import org.apache.poi.ss.usermodel.CellStyle;
import org.apache.poi.ss.usermodel.FillPatternType;
import org.apache.poi.ss.usermodel.IndexedColors;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.ss.usermodel.Workbook;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.stereotype.Service;

/** Server-side PDF/Excel export built only from the already scoped report read models. */
@Service
@RequiredArgsConstructor
public class GitDevelopmentReportExportService {
    private static final ZoneId BUSINESS_ZONE = ZoneId.of("Asia/Ho_Chi_Minh");
    private static final DateTimeFormatter GENERATED = DateTimeFormatter.ofPattern("d MMM yyyy HH:mm z", Locale.ENGLISH)
            .withZone(BUSINESS_ZONE);
    private final GitActivityService activity;

    public ExportFile project(Long workspaceId, Long projectId, Long sprintId, Long developerId,
                               LocalDate from, LocalDate to, Format format) throws IOException {
        GitActivityDtos.ProjectDevelopmentReport report = activity.projectDevelopmentReport(
                workspaceId, projectId, sprintId, from, to, developerId);
        String name = safeName(report.projectName() == null ? "project" : report.projectName());
        String period = sprintId == null ? "project" : "sprint-" + sprintId;
        List<Metric> metrics = new ArrayList<>(projectRows(report));
        List<Metric> filters = new ArrayList<>();
        if (sprintId != null) filters.add(new Metric("Sprint filter", sprintId, "Selected report sprint"));
        if (developerId != null) {
            String developerName = report.developerActivity().stream()
                    .filter(row -> developerId.equals(row.developerId())).map(GitActivityDtos.DeveloperActivityRow::name)
                    .findFirst().orElse("Developer " + developerId);
            filters.add(new Metric("Developer filter", developerName, "Selected report developer"));
        }
        if (from != null) filters.add(new Metric("From date", from.toString(), "Inclusive report start date"));
        if (to != null) filters.add(new Metric("To date", to.toString(), "Inclusive report end date"));
        metrics.addAll(0, filters);
        return export("Development Report - " + report.projectName(), name + "-" + period,
                metrics, report.developerActivity(), from, to, developerId, sprintId, format);
    }

    public ExportFile sprint(Long workspaceId, Long sprintId, Format format) throws IOException {
        GitActivityDtos.SprintDevelopmentReport report = activity.sprintDevelopmentReport(workspaceId, sprintId);
        List<Metric> metrics = new ArrayList<>(sprintRows(report));
        return export("Sprint Development Report - " + report.sprintOverview().name(),
                "sprint-" + sprintId, metrics, report.developerActivity(), null, null, null, sprintId, format);
    }

    private ExportFile export(String title, String baseName, List<Metric> metrics,
                              List<GitActivityDtos.DeveloperActivityRow> developers,
                              LocalDate from, LocalDate to, Long developerId, Long sprintId, Format format) throws IOException {
        Instant generatedAt = Instant.now();
        byte[] bytes = format == Format.PDF
                ? pdf(title, metrics, developers, generatedAt)
                : excel(title, metrics, developers, generatedAt);
        String extension = format == Format.PDF ? "pdf" : "xlsx";
        return new ExportFile(baseName + "." + extension,
                format == Format.PDF ? "application/pdf"
                        : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                bytes, generatedAt, from, to, developerId, sprintId);
    }

    private byte[] pdf(String title, List<Metric> metrics,
                       List<GitActivityDtos.DeveloperActivityRow> developers, Instant generatedAt) throws IOException {
        try (ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            PdfDocument pdf = new PdfDocument(new PdfWriter(output));
            try (Document document = new Document(pdf, PageSize.A4.rotate())) {
                document.setMargins(28, 32, 28, 32);
                document.setFont(vietnameseFont());
                document.add(new Paragraph(title).setFontSize(20).setBold().setFontColor(new DeviceRgb(67, 56, 202)));
                document.add(new Paragraph("Generated " + GENERATED.format(generatedAt))
                        .setFontSize(9).setFontColor(ColorConstants.GRAY));
                document.add(new Paragraph("Development overview").setFontSize(13).setBold().setMarginTop(14));
                Table metricTable = new Table(UnitValue.createPercentArray(new float[]{4, 2, 8})).useAllAvailableWidth();
                header(metricTable, List.of("Metric", "Value", "Description"));
                for (Metric metric : metrics) {
                    metricTable.addCell(cell(metric.name()));
                    metricTable.addCell(cell(metric.value()).setBold());
                    metricTable.addCell(cell(metric.description()));
                }
                document.add(metricTable);
                document.add(new Paragraph("Developer Activity").setFontSize(13).setBold().setMarginTop(14));
                Table developerTable = new Table(UnitValue.createPercentArray(new float[]{3, 1, 1, 1, 1, 2, 2}))
                        .useAllAvailableWidth();
                header(developerTable, List.of("Developer", "Commits", "PRs", "Merged", "Active days", "Last activity", "Status"));
                for (var row : developers) {
                    developerTable.addCell(cell(row.name() + (row.login() == null ? "" : " (" + row.login() + ")")));
                    developerTable.addCell(cell(row.commits()));
                    developerTable.addCell(cell(row.pullRequests()));
                    developerTable.addCell(cell(row.mergedPullRequests()));
                    developerTable.addCell(cell(row.activeDays()));
                    developerTable.addCell(cell(row.lastActiveAt() == null ? "—" : GENERATED.format(row.lastActiveAt())));
                    developerTable.addCell(cell(row.unmapped() ? "Unmapped contributor" : row.noActivity() ? "No activity" : "Active"));
                }
                document.add(developerTable);
            }
            return output.toByteArray();
        }
    }

    private byte[] excel(String title, List<Metric> metrics,
                         List<GitActivityDtos.DeveloperActivityRow> developers, Instant generatedAt) throws IOException {
        try (Workbook workbook = new XSSFWorkbook(); ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            CellStyle heading = workbook.createCellStyle();
            heading.setFillForegroundColor(IndexedColors.LIGHT_CORNFLOWER_BLUE.getIndex());
            heading.setFillPattern(FillPatternType.SOLID_FOREGROUND);
            org.apache.poi.ss.usermodel.Font bold = workbook.createFont();
            bold.setBold(true);
            heading.setFont(bold);
            Sheet overview = workbook.createSheet("Development Report");
            overview.createRow(0).createCell(0).setCellValue(title);
            overview.createRow(1).createCell(0).setCellValue("Generated " + GENERATED.format(generatedAt));
            Row header = overview.createRow(3);
            writeHeader(header, heading, List.of("Metric", "Value", "Description"));
            int rowNum = 4;
            for (Metric metric : metrics) {
                Row row = overview.createRow(rowNum++);
                row.createCell(0).setCellValue(metric.name());
                Object value = metric.value();
                if (value instanceof Number number) row.createCell(1).setCellValue(number.doubleValue());
                else if (value instanceof Boolean bool) row.createCell(1).setCellValue(bool);
                else row.createCell(1).setCellValue(value == null ? "" : value.toString());
                row.createCell(2).setCellValue(metric.description());
            }
            for (int column = 0; column < 3; column++) overview.autoSizeColumn(column);

            Sheet developerSheet = workbook.createSheet("Developer Activity");
            Row developerHeader = developerSheet.createRow(0);
            writeHeader(developerHeader, heading, List.of("Developer", "Login", "Commits", "PRs",
                    "Merged PRs", "Active days", "Last activity", "Status"));
            rowNum = 1;
            for (var developer : developers) {
                Row row = developerSheet.createRow(rowNum++);
                row.createCell(0).setCellValue(developer.name() == null ? "" : developer.name());
                row.createCell(1).setCellValue(developer.login() == null ? "" : developer.login());
                row.createCell(2).setCellValue(developer.commits());
                row.createCell(3).setCellValue(developer.pullRequests());
                row.createCell(4).setCellValue(developer.mergedPullRequests());
                row.createCell(5).setCellValue(developer.activeDays());
                row.createCell(6).setCellValue(developer.lastActiveAt() == null ? "" : GENERATED.format(developer.lastActiveAt()));
                row.createCell(7).setCellValue(developer.unmapped() ? "Unmapped contributor" : developer.noActivity() ? "No activity" : "Active");
            }
            for (int column = 0; column < 8; column++) developerSheet.autoSizeColumn(column);
            workbook.write(output);
            return output.toByteArray();
        }
    }

    private List<Metric> projectRows(GitActivityDtos.ProjectDevelopmentReport report) {
        return commonRows(report.gitActivity(), report.taskTraceability(), report.totalTasks(), report.todoTasks(),
                report.inProgressTasks(), report.reviewTasks(), report.doneTasks(), report.repositoryConfigured());
    }

    private List<Metric> sprintRows(GitActivityDtos.SprintDevelopmentReport report) {
        var overview = report.sprintOverview();
        List<Metric> metrics = new ArrayList<>(commonRows(report.gitActivity(), report.taskTraceability(),
                overview.totalTasks(), overview.todoTasks(), overview.inProgressTasks(), overview.reviewTasks(),
                overview.doneTasks(), report.repositoryConfigured()));
        metrics.add(0, new Metric("Sprint", overview.name(), "Sprint " + overview.startDate() + " — " + overview.endDate()));
        metrics.add(6, new Metric("Unfinished tasks", overview.unfinishedTasks(), "Tasks not marked done"));
        return metrics;
    }

    private List<Metric> commonRows(GitActivityDtos.GitActivitySummary git, GitActivityDtos.TaskTraceability trace,
                                   long totalTasks, long todo, long inProgress, long review, long done,
                                   boolean repositoryConfigured) {
        return List.of(
                new Metric("Repository connected", repositoryConfigured ? "Yes" : "No", "Connection state"),
                new Metric("Commits", git.totalCommits(), "Visible unique commits within the selected report filters"),
                new Metric("Pull Requests", git.totalPullRequests(), "PRs created within the selected report filters"),
                new Metric("Merged PRs", git.mergedPullRequests(), "PRs merged within the selected report filters"),
                new Metric("Open PRs", git.openPullRequests(), "Open PRs created within the selected report filters"),
                new Metric("Closed without merge", git.closedWithoutMergePullRequests(), "Closed PRs not merged"),
                new Metric("Total tasks", totalTasks, "Tasks in the selected project or sprint scope"),
                new Metric("To do", todo, "Tasks in TODO state"),
                new Metric("In progress", inProgress, "Tasks in IN_PROGRESS state"),
                new Metric("In review", review, "Tasks in REVIEW state"),
                new Metric("Done", done, "Tasks in DONE state"),
                new Metric("Tasks with commits", trace.tasksWithCommits(), "Distinct linked tasks"),
                new Metric("Tasks with pull requests", trace.tasksWithPullRequests(), "Distinct linked tasks"),
                new Metric("Tasks without Git activity", trace.tasksWithoutGitActivity(), "No linked commit or pull request"),
                new Metric("Commits without Task links", trace.unmappedCommits(), "Visible commits without a Task link"),
                new Metric("PRs without Task links", trace.unmappedPullRequests(), "Visible PRs without a Task link")
        );
    }

    private PdfFont vietnameseFont() throws IOException {
        for (String resourcePath : List.of("/fonts/NotoSans.ttf", "/fonts/DejaVuSans.ttf")) {
            try (var stream = getClass().getResourceAsStream(resourcePath)) {
                if (stream != null) return PdfFontFactory.createFont(stream.readAllBytes(), PdfEncodings.IDENTITY_H);
            }
        }
        for (String fontPath : List.of(
                "C:/Windows/Fonts/arial.ttf",
                "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
                "/usr/share/fonts/truetype/noto/NotoSans-Regular.ttf",
                "/usr/share/fonts/truetype/liberation2/LiberationSans-Regular.ttf")) {
            Path path = Path.of(fontPath);
            if (Files.isRegularFile(path)) {
                return PdfFontFactory.createFont(Files.readAllBytes(path), PdfEncodings.IDENTITY_H);
            }
        }
        return PdfFontFactory.createFont(com.itextpdf.io.font.constants.StandardFonts.HELVETICA);
    }

    private static void header(Table table, List<String> labels) {
        for (String label : labels) table.addHeaderCell(new Cell().add(new Paragraph(label).setBold())
                .setBackgroundColor(new DeviceRgb(224, 231, 255)));
    }

    private static void writeHeader(Row row, CellStyle style, List<String> labels) {
        for (int column = 0; column < labels.size(); column++) {
            var cell = row.createCell(column);
            cell.setCellValue(labels.get(column));
            cell.setCellStyle(style);
        }
    }

    private static Cell cell(Object value) {
        return new Cell().add(new Paragraph(value == null ? "" : value.toString()).setFontSize(8));
    }

    private static String safeName(String value) {
        String normalized = value == null ? "project" : value.toLowerCase(Locale.ROOT)
                .replaceAll("[^a-z0-9]+", "-").replaceAll("^-|-$", "");
        return normalized.isBlank() ? "project" : normalized;
    }

    public enum Format { PDF, EXCEL }
    public record ExportFile(String fileName, String contentType, byte[] bytes, Instant generatedAt,
                             LocalDate from, LocalDate to, Long developerId, Long sprintId) { }
    private record Metric(String name, Object value, String description) { }
}
