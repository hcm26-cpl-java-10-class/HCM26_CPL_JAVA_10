package com.example.starter_project_2025.system.project.analytics;

import com.itextpdf.io.font.PdfEncodings;
import com.itextpdf.io.font.constants.StandardFonts;
import com.itextpdf.kernel.colors.DeviceRgb;
import com.itextpdf.kernel.font.PdfFont;
import com.itextpdf.kernel.font.PdfFontFactory;
import com.itextpdf.kernel.geom.PageSize;
import com.itextpdf.kernel.pdf.PdfDocument;
import com.itextpdf.kernel.pdf.PdfWriter;
import com.itextpdf.layout.Document;
import com.itextpdf.layout.borders.SolidBorder;
import com.itextpdf.layout.element.Cell;
import com.itextpdf.layout.element.Paragraph;
import com.itextpdf.layout.element.Table;
import com.itextpdf.layout.properties.TextAlignment;
import com.itextpdf.layout.properties.UnitValue;
import lombok.RequiredArgsConstructor;
import org.slf4j.MDC;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Locale;
import java.util.UUID;

/**
 * US-ANL-010: exports the filtered Sprint &amp; Backlog analytics dataset as
 * CSV (daily aggregated time-series + item-level cycle/lead metrics) or PDF
 * (executive snapshot of KPIs, active filters and the 4 trend charts), writing
 * an immutable export audit log entry on every successful export.
 */
@Service
@RequiredArgsConstructor
public class ProjectAnalyticsExportService {

    public static final String FORMAT_CSV = "CSV";
    public static final String FORMAT_PDF = "PDF";

    private static final MediaType MEDIA_TYPE_CSV = MediaType.parseMediaType("text/csv; charset=UTF-8");
    private static final DateTimeFormatter FILE_DATE = DateTimeFormatter.ofPattern("yyyyMMdd");
    private static final DateTimeFormatter DISPLAY_TIMESTAMP = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm");

    private static final DeviceRgb COLOR_PRIMARY = new DeviceRgb(37, 99, 235);
    private static final DeviceRgb COLOR_SLATE_900 = new DeviceRgb(15, 23, 42);
    private static final DeviceRgb COLOR_SLATE_600 = new DeviceRgb(71, 85, 105);
    private static final DeviceRgb COLOR_SLATE_100 = new DeviceRgb(241, 245, 249);
    private static final DeviceRgb COLOR_BORDER = new DeviceRgb(226, 232, 240);
    private static final DeviceRgb COLOR_WHITE = new DeviceRgb(255, 255, 255);

    private static final int MAX_PDF_ITEM_ROWS = 120;

    private final ProjectAnalyticsService analyticsService;
    private final ProjectAnalyticsExportAuditRepository auditRepository;

    public record ExportFile(
            byte[] content,
            MediaType contentType,
            String filename,
            String correlationId
    ) { }

    /**
     * Authorizes, validates, renders the CSV or PDF export file, and persists
     * an immutable {@link ProjectAnalyticsExportAuditLog} row.
     */
    @Transactional
    public ExportFile export(String rawProjectId, ProjectAnalyticsExportRequest request, String headerCorrelationId) {
        ProjectAnalyticsExportRequest safeRequest = request == null
                ? new ProjectAnalyticsExportRequest(null, null, null, null, null, null)
                : request;
        String format = parseFormat(safeRequest.format());

        // AC02: authorization & project scope enforced before reading/generating anything.
        ProjectAnalyticsService.ExportSnapshot snapshot =
                analyticsService.exportSnapshot(rawProjectId, safeRequest.toFilter());
        ProjectAnalyticsResponse analytics = snapshot.analytics();

        // AC03 defense-in-depth: block empty dataset export.
        if (isEmptyDataset(analytics, snapshot.items())) {
            throw new ProjectAnalyticsValidationException("filters", "No data available to export");
        }

        Instant exportedAt = Instant.now();
        String correlationId = resolveCorrelationId(headerCorrelationId);
        String filterScope = serializeFilterScope(analytics, snapshot.selectedSprintName());

        byte[] content = FORMAT_CSV.equals(format)
                ? buildCsv(snapshot, exportedAt, correlationId)
                : buildPdf(snapshot, exportedAt, correlationId);

        // Mandatory immutable download audit log (only after auth & generation succeed).
        ProjectAnalyticsExportAuditLog audit = new ProjectAnalyticsExportAuditLog();
        audit.setId(UUID.randomUUID());
        audit.setActorId(snapshot.user().getId());
        audit.setTimestamp(exportedAt);
        audit.setProjectId(snapshot.project().getId());
        audit.setTenantId(snapshot.project().getTenantId());
        audit.setFilterScope(filterScope);
        audit.setExportFormat(format);
        audit.setCorrelationId(correlationId);
        auditRepository.save(audit);

        String filename = buildFilename(snapshot, format, exportedAt);
        MediaType mediaType = FORMAT_CSV.equals(format) ? MEDIA_TYPE_CSV : MediaType.APPLICATION_PDF;
        return new ExportFile(content, mediaType, filename, correlationId);
    }

    private static String parseFormat(String raw) {
        if (raw == null || raw.isBlank()) {
            throw new ProjectAnalyticsValidationException("format", "Export format must be CSV or PDF");
        }
        String value = raw.trim().toUpperCase(Locale.ROOT);
        if (FORMAT_CSV.equals(value) || FORMAT_PDF.equals(value)) {
            return value;
        }
        throw new ProjectAnalyticsValidationException("format", "Export format must be CSV or PDF");
    }

    private static boolean isEmptyDataset(
            ProjectAnalyticsResponse analytics,
            List<ProjectAnalyticsService.ExportWorkItemRow> items) {
        if (items != null && !items.isEmpty()) {
            return false;
        }
        return analytics.creationTrend().buckets().isEmpty()
                && analytics.cycleTimeTrend().points().isEmpty()
                && analytics.leadTimeTrend().points().isEmpty()
                && analytics.completionTrend().buckets().isEmpty();
    }

    private static String resolveCorrelationId(String headerCorrelationId) {
        if (headerCorrelationId != null && !headerCorrelationId.isBlank()) {
            String trimmed = headerCorrelationId.trim();
            return trimmed.length() > 100 ? trimmed.substring(0, 100) : trimmed;
        }
        String mdc = MDC.get("correlationId");
        if (mdc != null && !mdc.isBlank()) {
            String trimmed = mdc.trim();
            return trimmed.length() > 100 ? trimmed.substring(0, 100) : trimmed;
        }
        return UUID.randomUUID().toString();
    }

    private static String serializeFilterScope(ProjectAnalyticsResponse analytics, String sprintName) {
        ProjectAnalyticsResponse.Filters f = analytics.filters();
        ProjectAnalyticsResponse.Window w = analytics.window();
        StringBuilder sb = new StringBuilder();
        sb.append("scope=").append(f.scope());
        if (f.sprintId() != null) {
            sb.append(";sprintId=").append(f.sprintId());
            if (sprintName != null && !sprintName.isBlank()) {
                sb.append(";sprint=").append(sprintName.trim());
            }
        }
        sb.append(";itemType=").append(f.itemType());
        sb.append(";window=").append(w.startDate()).append("..").append(w.endDate());
        sb.append(";tz=").append(w.timeZone());
        String value = sb.toString();
        return value.length() > 500 ? value.substring(0, 500) : value;
    }

    private static String buildFilename(
            ProjectAnalyticsService.ExportSnapshot snapshot, String format, Instant exportedAt) {
        String rawCode = snapshot.project().getCode() != null && !snapshot.project().getCode().isBlank()
                ? snapshot.project().getCode()
                : "project-" + snapshot.project().getId();
        String slugCode = rawCode.trim().toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9-]+", "-");
        String scopeSlug = snapshot.analytics().filters().scope().toLowerCase(Locale.ROOT);
        if (snapshot.selectedSprintName() != null && !snapshot.selectedSprintName().isBlank()) {
            String sprintSlug = snapshot.selectedSprintName().trim().toLowerCase(Locale.ROOT)
                    .replaceAll("[^a-z0-9]+", "-")
                    .replaceAll("^-|-$", "");
            if (!sprintSlug.isEmpty()) {
                scopeSlug = sprintSlug.length() > 32 ? sprintSlug.substring(0, 32) : sprintSlug;
            }
        }
        String dateStamp = ZonedDateTime.ofInstant(exportedAt, snapshot.tenantZone()).format(FILE_DATE);
        String ext = FORMAT_CSV.equals(format) ? "csv" : "pdf";
        return slugCode + "-analytics-" + scopeSlug + "-" + dateStamp + "." + ext;
    }

    // ---------------------------------------------------------------------
    // CSV generation
    // ---------------------------------------------------------------------

    private byte[] buildCsv(ProjectAnalyticsService.ExportSnapshot snapshot, Instant exportedAt, String correlationId) {
        ProjectAnalyticsResponse analytics = snapshot.analytics();
        StringBuilder csv = new StringBuilder(8192);
        String generatedAt = ZonedDateTime.ofInstant(exportedAt, snapshot.tenantZone()).format(DISPLAY_TIMESTAMP)
                + " (" + snapshot.tenantZone().getId() + ")";

        // Section 1: Report Metadata & Active Filters
        appendCsvRow(csv, List.of("SECTION", "FIELD", "VALUE"));
        appendCsvRow(csv, List.of("METADATA", "Project Code", safe(analytics.projectCode())));
        appendCsvRow(csv, List.of("METADATA", "Project Name", safe(analytics.projectName())));
        appendCsvRow(csv, List.of("METADATA", "Scope", safe(analytics.filters().scope())));
        appendCsvRow(csv, List.of("METADATA", "Sprint", snapshot.selectedSprintName() == null ? "All" : snapshot.selectedSprintName()));
        appendCsvRow(csv, List.of("METADATA", "Work Item Type", safe(analytics.filters().itemType())));
        appendCsvRow(csv, List.of("METADATA", "Date Window", analytics.window().startDate() + " to " + analytics.window().endDate()));
        appendCsvRow(csv, List.of("METADATA", "Tenant Timezone", safe(analytics.window().timeZone())));
        appendCsvRow(csv, List.of("METADATA", "Generated At", generatedAt));
        appendCsvRow(csv, List.of("METADATA", "Correlation ID", correlationId));
        csv.append("\n");

        // Section 2: KPI Summary
        appendCsvRow(csv, List.of("KPI SUMMARY"));
        appendCsvRow(csv, List.of("Metric", "Value", "Caption", "Sub-Caption"));
        for (ProjectAnalyticsResponse.Kpi kpi : analytics.kpis()) {
            appendCsvRow(csv, List.of(
                    safe(kpi.label()),
                    safe(kpi.value()),
                    safe(kpi.caption()),
                    safe(kpi.subCaption())));
        }
        csv.append("\n");

        // Section 3: Work Item Creation Trend (Daily Time-Series)
        appendCsvRow(csv, List.of("WORK ITEM CREATION TREND"));
        appendCsvRow(csv, List.of("Creation Date", "Done", "To Do", "Total"));
        for (ProjectAnalyticsResponse.CreationBucket bucket : analytics.creationTrend().buckets()) {
            long total = bucket.done() + bucket.todo();
            appendCsvRow(csv, List.of(
                    formatDate(bucket.date()),
                    Long.toString(bucket.done()),
                    Long.toString(bucket.todo()),
                    Long.toString(total)));
        }
        csv.append("\n");

        // Section 4: Work Item Cycle Time Trend
        appendCsvRow(csv, List.of("WORK ITEM CYCLE TIME"));
        appendCsvRow(csv, List.of("Completed Date", "Average Cycle Time (days)", "Completed Items"));
        for (ProjectAnalyticsResponse.CycleTimePoint point : analytics.cycleTimeTrend().points()) {
            appendCsvRow(csv, List.of(
                    formatDate(point.date()),
                    oneDecimal(point.averageDays()),
                    Integer.toString(point.itemCount())));
        }
        csv.append("\n");

        // Section 5: Work Item Lead Time Trend (Story / Subtask / Task)
        appendCsvRow(csv, List.of("WORK ITEM LEAD TIME"));
        appendCsvRow(csv, List.of(
                "Completed Date",
                "Story Avg (days)", "Story Count",
                "Subtask Avg (days)", "Subtask Count",
                "Task Avg (days)", "Task Count"));
        for (ProjectAnalyticsResponse.LeadTimePoint point : analytics.leadTimeTrend().points()) {
            appendCsvRow(csv, List.of(
                    formatDate(point.date()),
                    point.story() == null ? "" : oneDecimal(point.story()),
                    Integer.toString(point.storyCount()),
                    point.subtask() == null ? "" : oneDecimal(point.subtask()),
                    Integer.toString(point.subtaskCount()),
                    point.task() == null ? "" : oneDecimal(point.task()),
                    Integer.toString(point.taskCount())));
        }
        csv.append("\n");

        // Section 6: Work Item Completion Trend
        appendCsvRow(csv, List.of("WORK ITEM COMPLETION TREND"));
        appendCsvRow(csv, List.of("Completed Date", "Subtask", "Story", "Task", "Total"));
        for (ProjectAnalyticsResponse.CompletionBucket bucket : analytics.completionTrend().buckets()) {
            long total = bucket.subtask() + bucket.story() + bucket.task();
            appendCsvRow(csv, List.of(
                    formatDate(bucket.date()),
                    Long.toString(bucket.subtask()),
                    Long.toString(bucket.story()),
                    Long.toString(bucket.task()),
                    Long.toString(total)));
        }
        csv.append("\n");

        // Section 7: Item-Level Cycle & Lead Time Metrics
        appendCsvRow(csv, List.of("ITEM-LEVEL CYCLE & LEAD METRICS"));
        appendCsvRow(csv, List.of(
                "Task Code", "Title", "Type", "Status", "Sprint", "Assignee",
                "Created Date", "Completed Date", "Cycle Time (days)", "Lead Time (days)", "Estimated Hours"));
        for (ProjectAnalyticsService.ExportWorkItemRow item : snapshot.items()) {
            appendCsvRow(csv, List.of(
                    safe(item.taskCode()),
                    safe(item.title()),
                    safe(item.workType()),
                    safe(item.status()),
                    safe(item.sprintName()),
                    item.assigneeName() == null ? "Unassigned" : item.assigneeName(),
                    formatDate(item.createdDate()),
                    formatDate(item.completedDate()),
                    item.cycleDays() == null ? "" : oneDecimal(item.cycleDays()),
                    item.leadDays() == null ? "" : oneDecimal(item.leadDays()),
                    item.estimatedHours() == null ? "" : oneDecimal(item.estimatedHours())));
        }

        byte[] payload = csv.toString().getBytes(StandardCharsets.UTF_8);
        byte[] bom = new byte[]{(byte) 0xEF, (byte) 0xBB, (byte) 0xBF};
        byte[] output = new byte[bom.length + payload.length];
        System.arraycopy(bom, 0, output, 0, bom.length);
        System.arraycopy(payload, 0, output, bom.length, payload.length);
        return output;
    }

    private static void appendCsvRow(StringBuilder csv, List<String> values) {
        for (int i = 0; i < values.size(); i++) {
            String raw = values.get(i) == null ? "" : values.get(i);
            // Guard against spreadsheet formula injection when opened in Excel/Sheets.
            if (!raw.isEmpty() && ("=+-@\t\r".indexOf(raw.charAt(0)) >= 0)) {
                raw = "'" + raw;
            }
            csv.append('"').append(raw.replace("\"", "\"\"")).append('"');
            if (i < values.size() - 1) {
                csv.append(',');
            }
        }
        csv.append('\n');
    }

    // ---------------------------------------------------------------------
    // PDF executive summary generation (iText 7)
    // ---------------------------------------------------------------------

    private byte[] buildPdf(ProjectAnalyticsService.ExportSnapshot snapshot, Instant exportedAt, String correlationId) {
        ProjectAnalyticsResponse analytics = snapshot.analytics();
        String generatedAt = ZonedDateTime.ofInstant(exportedAt, snapshot.tenantZone()).format(DISPLAY_TIMESTAMP)
                + " (" + snapshot.tenantZone().getId() + ")";
        String scopeLabel = switch (analytics.filters().scope()) {
            case "SPRINT" -> snapshot.selectedSprintName() == null
                    ? "Sprint scope" : "Sprint: " + snapshot.selectedSprintName();
            case "BACKLOG" -> "Product backlog";
            default -> "All project work items";
        };

        try (ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            PdfWriter writer = new PdfWriter(output);
            PdfDocument pdf = new PdfDocument(writer);
            try (Document doc = new Document(pdf, PageSize.A4)) {
                doc.setMargins(28, 28, 28, 28);
                PdfFont font = loadUnicodeFont();
                doc.setFont(font);

                // Executive Header
                String heading = (analytics.projectCode() != null && !analytics.projectCode().isBlank()
                        ? analytics.projectCode() + " · " : "")
                        + (analytics.projectName() != null ? analytics.projectName() : "Project Analytics");
                doc.add(new Paragraph("Sprint & Backlog Analytics Report")
                        .setFontSize(16)
                        .setBold()
                        .setFontColor(COLOR_SLATE_900)
                        .setMarginBottom(2));
                doc.add(new Paragraph(heading)
                        .setFontSize(11)
                        .setFontColor(COLOR_PRIMARY)
                        .setBold()
                        .setMarginBottom(6));
                doc.add(new Paragraph(
                        "Scope: " + scopeLabel
                                + "  |  Type: " + analytics.filters().itemType()
                                + "  |  Window: " + analytics.window().startDate() + " to " + analytics.window().endDate()
                                + "\nGenerated: " + generatedAt + "  |  Correlation ID: " + correlationId)
                        .setFontSize(8.5f)
                        .setFontColor(COLOR_SLATE_600)
                        .setMarginBottom(12));

                // KPI Summary Strip
                Table kpiTable = new Table(UnitValue.createPercentArray(new float[]{1, 1, 1, 1}))
                        .useAllAvailableWidth()
                        .setMarginBottom(14);
                for (ProjectAnalyticsResponse.Kpi kpi : analytics.kpis()) {
                    Cell cell = new Cell()
                            .setBorder(new SolidBorder(COLOR_BORDER, 0.75f))
                            .setBackgroundColor(COLOR_SLATE_100)
                            .setPadding(8);
                    cell.add(new Paragraph(safe(kpi.label()))
                            .setFontSize(8)
                            .setFontColor(COLOR_SLATE_600)
                            .setMarginBottom(2));
                    cell.add(new Paragraph(safe(kpi.value()))
                            .setFontSize(13)
                            .setBold()
                            .setFontColor(COLOR_SLATE_900)
                            .setMarginBottom(2));
                    if (kpi.caption() != null) {
                        cell.add(new Paragraph(kpi.caption())
                                .setFontSize(7.5f)
                                .setFontColor(COLOR_SLATE_600));
                    }
                    kpiTable.addCell(cell);
                }
                doc.add(kpiTable);

                // Trend 1: Work Item Creation Trend
                addSectionTitle(doc, "1. Work Item Creation Trend (Done vs To Do)");
                if (analytics.creationTrend().buckets().isEmpty()) {
                    addEmptyNote(doc, "No work items created in the selected window.");
                } else {
                    Table table = createDataTable(new float[]{2.2f, 1.2f, 1.2f, 1.2f, 1.4f},
                            List.of("Creation Date", "Done", "To Do", "Total", "Done Share"));
                    for (ProjectAnalyticsResponse.CreationBucket b : analytics.creationTrend().buckets()) {
                        long total = b.done() + b.todo();
                        String share = total == 0 ? "0.0%" : oneDecimal(b.done() * 100.0 / total) + "%";
                        addDataRow(table, List.of(
                                formatDate(b.date()),
                                Long.toString(b.done()),
                                Long.toString(b.todo()),
                                Long.toString(total),
                                share));
                    }
                    doc.add(table);
                }

                // Trend 2: Work Item Cycle Time
                addSectionTitle(doc, "2. Work Item Cycle Time (Average Active Execution Days)");
                if (analytics.cycleTimeTrend().points().isEmpty()) {
                    addEmptyNote(doc, "No completed work items recorded in the selected window.");
                } else {
                    Table table = createDataTable(new float[]{2.5f, 2.0f, 1.5f},
                            List.of("Completed Date", "Avg Cycle Time (days)", "Completed Items"));
                    for (ProjectAnalyticsResponse.CycleTimePoint p : analytics.cycleTimeTrend().points()) {
                        addDataRow(table, List.of(
                                formatDate(p.date()),
                                oneDecimal(p.averageDays()),
                                Integer.toString(p.itemCount())));
                    }
                    doc.add(table);
                }

                // Trend 3: Work Item Lead Time (Story / Subtask / Task)
                addSectionTitle(doc, "3. Work Item Lead Time (Story / Subtask / Task)");
                if (analytics.leadTimeTrend().points().isEmpty()) {
                    addEmptyNote(doc, "No completed Story, Subtask or Task lead times in the selected window.");
                } else {
                    Table table = createDataTable(new float[]{2.0f, 1.5f, 1.5f, 1.5f},
                            List.of("Completed Date", "Story Avg (days)", "Subtask Avg (days)", "Task Avg (days)"));
                    for (ProjectAnalyticsResponse.LeadTimePoint p : analytics.leadTimeTrend().points()) {
                        addDataRow(table, List.of(
                                formatDate(p.date()),
                                p.story() == null ? "—" : oneDecimal(p.story()) + " (" + p.storyCount() + ")",
                                p.subtask() == null ? "—" : oneDecimal(p.subtask()) + " (" + p.subtaskCount() + ")",
                                p.task() == null ? "—" : oneDecimal(p.task()) + " (" + p.taskCount() + ")"));
                    }
                    doc.add(table);
                }

                // Trend 4: Work Item Completion Trend
                addSectionTitle(doc, "4. Work Item Completion Trend (By Work Item Type)");
                if (analytics.completionTrend().buckets().isEmpty()) {
                    addEmptyNote(doc, "No work items completed in the selected window.");
                } else {
                    Table table = createDataTable(new float[]{2.2f, 1.2f, 1.2f, 1.2f, 1.2f},
                            List.of("Completed Date", "Subtask", "Story", "Task", "Total"));
                    for (ProjectAnalyticsResponse.CompletionBucket b : analytics.completionTrend().buckets()) {
                        long total = b.subtask() + b.story() + b.task();
                        addDataRow(table, List.of(
                                formatDate(b.date()),
                                Long.toString(b.subtask()),
                                Long.toString(b.story()),
                                Long.toString(b.task()),
                                Long.toString(total)));
                    }
                    doc.add(table);
                }

                // Item-level breakdown
                addSectionTitle(doc, "5. Work Item Cycle & Lead Metrics (" + snapshot.items().size() + " items)");
                if (snapshot.items().isEmpty()) {
                    addEmptyNote(doc, "No work items in the selected scope.");
                } else {
                    Table table = createDataTable(new float[]{1.4f, 3.0f, 1.1f, 1.2f, 1.5f, 1.0f, 1.0f},
                            List.of("Code", "Title", "Type", "Status", "Assignee", "Cycle (d)", "Lead (d)"));
                    int limit = Math.min(snapshot.items().size(), MAX_PDF_ITEM_ROWS);
                    for (int i = 0; i < limit; i++) {
                        ProjectAnalyticsService.ExportWorkItemRow item = snapshot.items().get(i);
                        addDataRow(table, List.of(
                                safe(item.taskCode()),
                                truncate(item.title(), 70),
                                safe(item.workType()),
                                safe(item.status()),
                                item.assigneeName() == null ? "Unassigned" : truncate(item.assigneeName(), 28),
                                item.cycleDays() == null ? "—" : oneDecimal(item.cycleDays()),
                                item.leadDays() == null ? "—" : oneDecimal(item.leadDays())));
                    }
                    doc.add(table);
                    if (snapshot.items().size() > MAX_PDF_ITEM_ROWS) {
                        doc.add(new Paragraph("Showing first " + MAX_PDF_ITEM_ROWS + " of "
                                + snapshot.items().size() + " items. Export CSV for the full item-level dataset.")
                                .setFontSize(7.5f)
                                .setFontColor(COLOR_SLATE_600)
                                .setMarginTop(4));
                    }
                }
            }
            return output.toByteArray();
        } catch (IOException ex) {
            throw new IllegalStateException("Could not generate analytics PDF report", ex);
        }
    }

    private static void addSectionTitle(Document doc, String title) {
        doc.add(new Paragraph(title)
                .setFontSize(10.5f)
                .setBold()
                .setFontColor(COLOR_SLATE_900)
                .setMarginTop(10)
                .setMarginBottom(5));
    }

    private static void addEmptyNote(Document doc, String note) {
        doc.add(new Paragraph(note)
                .setFontSize(8.5f)
                .setFontColor(COLOR_SLATE_600)
                .setMarginBottom(6));
    }

    private static Table createDataTable(float[] widths, List<String> headers) {
        Table table = new Table(UnitValue.createPercentArray(widths))
                .useAllAvailableWidth()
                .setMarginBottom(8);
        for (String header : headers) {
            table.addHeaderCell(new Cell()
                    .setBackgroundColor(COLOR_PRIMARY)
                    .setBorder(new SolidBorder(COLOR_PRIMARY, 0.5f))
                    .setPadding(5)
                    .add(new Paragraph(header)
                            .setBold()
                            .setFontSize(8)
                            .setFontColor(COLOR_WHITE)));
        }
        return table;
    }

    private static void addDataRow(Table table, List<String> values) {
        for (int i = 0; i < values.size(); i++) {
            Cell cell = new Cell()
                    .setBorder(new SolidBorder(COLOR_BORDER, 0.5f))
                    .setPadding(4.5f)
                    .add(new Paragraph(values.get(i))
                            .setFontSize(8)
                            .setFontColor(COLOR_SLATE_900));
            if (i > 0 && values.size() <= 5) {
                cell.setTextAlignment(TextAlignment.RIGHT);
            }
            table.addCell(cell);
        }
    }

    private PdfFont loadUnicodeFont() throws IOException {
        try (InputStream stream = getClass().getResourceAsStream("/fonts/DejaVuSans.ttf")) {
            if (stream != null) {
                return PdfFontFactory.createFont(stream.readAllBytes(), PdfEncodings.IDENTITY_H);
            }
        }
        try {
            return PdfFontFactory.createFont("C:/Windows/Fonts/arial.ttf", PdfEncodings.IDENTITY_H);
        } catch (IOException ignored) {
            return PdfFontFactory.createFont(StandardFonts.HELVETICA);
        }
    }

    private static String safe(String value) {
        return value == null ? "" : value;
    }

    private static String formatDate(LocalDate value) {
        return value == null ? "" : value.toString();
    }

    private static String oneDecimal(double value) {
        return String.format(Locale.ROOT, "%.1f", value);
    }

    private static String truncate(String value, int maxLength) {
        if (value == null) return "";
        String trimmed = value.trim();
        return trimmed.length() <= maxLength ? trimmed : trimmed.substring(0, maxLength - 1) + "…";
    }
}
