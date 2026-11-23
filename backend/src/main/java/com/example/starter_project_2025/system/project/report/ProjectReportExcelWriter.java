package com.example.starter_project_2025.system.project.report;

import com.example.starter_project_2025.base.dataio.exporter.component.ExportColumn;
import com.example.starter_project_2025.base.dataio.exporter.component.ExportSheetConfig;
import com.example.starter_project_2025.base.dataio.exporter.variant.ExcelExporter;
import lombok.RequiredArgsConstructor;
import org.apache.poi.ss.usermodel.*;
import org.apache.poi.ss.util.CellRangeAddress;
import org.apache.poi.xssf.usermodel.XSSFCellStyle;
import org.apache.poi.xssf.usermodel.XSSFColor;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.stereotype.Component;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.time.Instant;
import java.time.LocalDateTime;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static com.example.starter_project_2025.system.project.report.ProjectReportDtos.*;

@Component
@RequiredArgsConstructor
public class ProjectReportExcelWriter {
    static final int HEADER_ROW = 5;
    private static final ExportSheetConfig<SubProject> PROJECT_PROGRESS = new ExportSheetConfig<>("Project Progress", List.of(
            new ExportColumn<>("Class", SubProject::className),
            new ExportColumn<>("Assigned team", ProjectReportExcelWriter::team),
            new ExportColumn<>("Master Project", project -> identity(project.masterCode(), project.masterName())),
            new ExportColumn<>("Sub-project", ProjectReportExcelWriter::part),
            new ExportColumn<>("Status", project -> projectStatus(project.status())),
            new ExportColumn<>("Mentor", ProjectReportExcelWriter::mentor),
            new ExportColumn<>("Milestone progress", project -> project.milestones().isEmpty() ? "No milestones"
                    : project.acceptedMilestones() + "/" + project.milestones().size() + " accepted")));
    private final ProjectReportSettings settings;
    private final ExcelExporter excel;

    public byte[] write(ProjectReportService.ExportData data) throws IOException {
        var snapshot = data.snapshot();
        var projects = snapshot.matching().stream().sorted(Comparator.comparing(SubProject::className)
                .thenComparing(SubProject::masterCode).thenComparing(SubProject::depth).thenComparing(SubProject::code)).toList();
        var base = new ByteArrayOutputStream();
        excel.export(projects, PROJECT_PROGRESS, base);
        try (var book = new XSSFWorkbook(new ByteArrayInputStream(base.toByteArray()));
             var output = new ByteArrayOutputStream()) {
            var layout = new Layout(book, snapshot.asOf());
            layout.formatProjectProgress(book.getSheetAt(0));
            var overview = layout.extra("Overview", "KEY METRICS", "Metric", "Count");
            var k = data.overview();
            layout.values(overview, "Active master projects", k.activeMasters());
            layout.values(overview, "Active teams", k.activeTeams());
            layout.values(overview, "Classes with projects", projects.stream().map(SubProject::classId).distinct().count());
            layout.values(overview, "Sub-project", projects.stream().filter(row -> row.parentProjectId() != null).count());
            layout.values(overview, "Overdue tasks", k.overdueTasks());
            layout.values(overview, "Overdue backlog items", k.overdueBacklogItems());
            layout.values(overview, "Overdue subtasks", k.overdueSubtasks());
            layout.values(overview, "Risks needing attention", k.riskCount());
            k.milestoneStatuses().forEach((status, count) -> layout.values(overview, "Milestone · " + label(status), count));
            k.artifactStatuses().forEach((status, count) -> layout.values(overview, "Submission · " + label(status), count));
            var totals = data.workTotals();
            layout.values(overview, "Work items · To do", totals.todo());
            layout.values(overview, "Work items · In progress", totals.inProgress());
            layout.values(overview, "Work items · In review", totals.review());
            layout.values(overview, "Work items · Done", totals.done());
            layout.finish(overview);

            var work = layout.extra("Sprint Work", "WORK BREAKDOWN BY SPRINT", "Project", "Team", "Sprint", "Sprint status",
                    "Start", "End", "Todo", "In progress", "Review", "Done", "Total");
            data.work().sprints().stream().filter(sprint -> data.work().selectedSprintId() == null || data.work().selectedSprintId().equals(sprint.id()))
                    .forEach(sprint -> layout.values(work, sprint.projectName(), sprint.teamName(), sprint.name(), label(sprint.status()),
                            sprint.startAt(), sprint.endAt(), sprint.backlog().todo(), sprint.backlog().inProgress(), sprint.backlog().review(),
                            sprint.backlog().done(), sprint.backlog().total()));
            if (data.work().selectedSprintId() == null) {
                var counts = data.work().backlog();
                var planned = data.work().sprints().stream().map(SprintRow::backlog).reduce(BacklogCounts.empty(), BacklogCounts::plus);
                if (counts.total() > planned.total()) layout.values(work, "Applied filters", null, "No sprint assigned", null, null, null,
                        counts.todo() - planned.todo(), counts.inProgress() - planned.inProgress(), counts.review() - planned.review(),
                        counts.done() - planned.done(), counts.total() - planned.total());
            }
            layout.finish(work);
            var deliveries = layout.extra("Milestones and Submissions", "MILESTONES AND CURRENT SUBMISSIONS", "Master", "Project", "Class", "Team", "Milestone", "Required",
                    "Deadline", "Milestone status", "Submission status", "Version", "Submitted at", "Reviewer", "Checklist items passed", "Total checklist items", "Risks");
            data.deliveries().forEach(row -> layout.values(deliveries, row.masterName(), row.projectName(), row.className(), row.teamName(), row.title(), row.mandatory() ? "Yes" : "No",
                    row.deadline(), label(row.milestoneStatus()), row.artifactStatus() == null ? "No submission" : label(row.artifactStatus()), row.version(),
                    row.submittedAt(), row.reviewerName(), row.checklistCompleted(), row.checklistTotal(), riskReason(row.attention())));
            layout.finish(deliveries);
            var risks = layout.extra("Risks", "CURRENT RISKS", "Type", "Project", "Team", "Subject", "Deadline", "Reason");
            data.risks().forEach(row -> layout.values(risks, label(row.kind()), row.projectName(), row.teamName(), row.subject(), row.deadline(), riskReason(row.reason())));
            layout.finish(risks);
            var activity = layout.extra("Activity", "ACTIVITY IN REPORT SCOPE", "Time", "Master", "Project code", "Project", "Team",
                    "Actor", "Subject", "Action", "Previous status", "New status");
            data.activities().forEach(row -> layout.values(activity, row.occurredAt(), row.masterName(), row.projectCode(), row.projectName(), row.teamName(),
                    row.actorName(), row.subject(), action(row.action()), label(row.beforeStatus()), label(row.afterStatus())));
            layout.finish(activity);
            for (int index = 0; index < book.getNumberOfSheets(); index++) {
                var sheet = book.getSheetAt(index);
                var context = sheet.getRow(3).getCell(0);
                context.setCellValue("Applied filters: " + filterText(data, sheet.getSheetName().equals("Sprint Work")));
            }
            book.setActiveSheet(0);
            book.write(output);
            return output.toByteArray();
        }
    }

    private static String identity(String code, String name) { return code + "\n" + name; }
    private static String part(SubProject project) {
        return project.parentProjectId() == null ? "Master project work" : identity(project.code(), project.name());
    }
    private static String team(SubProject project) { return project.teamName() == null ? "Shared master work" : project.teamName(); }
    private static String mentor(SubProject project) {
        return project.mentorName() != null ? project.mentorName() : project.teamId() == null ? "By sub-project" : "Unassigned";
    }
    private String filterText(ProjectReportService.ExportData data, boolean includeSprint) {
        var filter = data.snapshot().filter();
        var rows = data.snapshot().all();
        var parts = new java.util.ArrayList<String>();
        if (filter.programId() != null) parts.add("Program: " + rows.stream().filter(row -> filter.programId().equals(row.programId())).map(SubProject::programName).filter(java.util.Objects::nonNull).findFirst().orElse("#" + filter.programId()));
        if (filter.cohortId() != null) parts.add("Cohort: " + rows.stream().filter(row -> filter.cohortId().equals(row.cohortId())).map(SubProject::cohortName).filter(java.util.Objects::nonNull).findFirst().orElse("#" + filter.cohortId()));
        if (filter.classId() != null) parts.add("Class: " + rows.stream().filter(row -> filter.classId().equals(row.classId())).map(SubProject::className).findFirst().orElse("#" + filter.classId()));
        if (filter.masterId() != null) parts.add("Master: " + rows.stream().filter(row -> filter.masterId().equals(row.masterId())).map(SubProject::masterName).findFirst().orElse("#" + filter.masterId()));
        if (filter.projectId() != null) parts.add("Project: " + rows.stream().filter(row -> filter.projectId().equals(row.id())).map(SubProject::name).findFirst().orElse("#" + filter.projectId()));
        if (filter.teamId() != null) parts.add("Team: " + rows.stream().filter(row -> filter.teamId().equals(row.teamId())).map(SubProject::teamName).filter(java.util.Objects::nonNull).findFirst().orElse("#" + filter.teamId()));
        if (filter.mentorId() != null) parts.add("Mentor: " + rows.stream().filter(row -> filter.mentorId().equals(row.mentorId())).map(SubProject::mentorName).findFirst().orElse("#" + filter.mentorId()));
        if (filter.templateId() != null) parts.add("Project template: " + rows.stream().filter(row -> filter.templateId().equals(row.templateId())).map(SubProject::templateName).findFirst().orElse("#" + filter.templateId()));
        if (filter.sourceVersionId() != null) parts.add("Version: " + rows.stream().filter(row -> filter.sourceVersionId().equals(row.sourceVersionId())).map(SubProject::sourceVersion).findFirst().orElse("#" + filter.sourceVersionId()));
        if (filter.masterStatus() != null) parts.add("Master status: " + projectStatus(filter.masterStatus()));
        if (filter.status() != null) parts.add("Sub-project status: " + projectStatus(filter.status()));
        if (filter.risk() != Risk.ALL) parts.add("Risk: " + switch (filter.risk()) { case OVERDUE -> "Overdue"; case NEEDS_ATTENTION -> "Needs attention"; case LATE_SUBMISSION -> "Late submissions"; default -> "All"; });
        if (filter.createdFrom() != null) parts.add("Created from " + filter.createdFrom());
        if (filter.createdTo() != null) parts.add("Created to " + filter.createdTo());
        if (includeSprint && filter.workSprintId() != null) parts.add("Sprint: " + data.work().sprints().stream().filter(row -> filter.workSprintId().equals(row.id())).map(SprintRow::name).findFirst().orElse("#" + filter.workSprintId()));
        if (!filter.q().isBlank()) parts.add("Search: " + filter.q());
        if (filter.includeCancelled()) parts.add("Includes cancelled projects");
        return parts.isEmpty() ? "All data in your access scope" : String.join(" · ", parts);
    }
    static String label(String status) {
        if (status == null || status.equals("NONE")) return "—";
        return switch (status) {
            case "DRAFT" -> "Draft"; case "PLANNED", "PLANNING" -> "Not started";
            case "IN_PROGRESS" -> "In progress"; case "ACTIVE" -> "In progress";
            case "SUBMITTED" -> "Pending review"; case "ACCEPTED" -> "Accepted"; case "CHANGES_REQUESTED" -> "Changes requested";
            case "REJECTED" -> "Rejected"; case "WAIVED" -> "Waived"; case "COMPLETED" -> "Completed";
            case "CANCELLED" -> "Cancelled"; case "OVERDUE" -> "Overdue"; case "DUE_SOON" -> "Due soon · awaiting submission";
            case "MILESTONE" -> "Milestone"; case "BACKLOG" -> "Backlog item"; case "SUBTASK" -> "Subtask"; case "TASK" -> "Task";
            default -> status;
        };
    }
    private static String riskReason(String reason) {
        if ("CHANGES_REQUESTED".equals(reason)) return "Submission needs changes";
        if ("REJECTED".equals(reason)) return "Submission rejected";
        return label(reason);
    }
    static String action(String value) {
        if (value == null) return "Updated";
        return switch (value) {
            case "TASK_CREATED", "BACKLOG_CREATE", "BACKLOG_CREATED" -> "Created work item";
            case "TASK_STATUS_CHANGED", "TASK_UPDATE_STATUS", "BACKLOG_STATUS_CHANGED", "BACKLOG_STATUS_UPDATED" -> "Changed work item status";
            case "TASK_UPDATED", "TASK_UPDATE", "BACKLOG_UPDATE", "BACKLOG_UPDATED" -> "Updated work item";
            case "TASK_DELETED", "TASK_DELETE", "BACKLOG_DELETE", "BACKLOG_DELETED" -> "Deleted work item";
            case "TASK_ASSIGNED" -> "Assigned work item"; case "TASK_MOVED_TO_SPRINT" -> "Moved work item to sprint";
            case "TASK_REORDERED" -> "Reordered work item"; case "SUBMISSION_SUBMITTED" -> "Submitted work";
            case "SUBMISSION_ACCEPT" -> "Accepted submission"; case "SUBMISSION_REJECT" -> "Rejected submission";
            case "SUBMISSION_REQUEST_CHANGES" -> "Requested changes"; case "MILESTONE_CREATED" -> "Created milestone";
            case "MILESTONE_AT_RISK_ALERT_SENT" -> "Sent milestone alert";
            default -> "Updated " + (value.startsWith("MILESTONE_") ? "milestone" : value.startsWith("SUBMISSION_") ? "submission" : "work item");
        };
    }
    private static String projectStatus(Status status) {
        return switch (status) {
            case DRAFT -> "Draft"; case PLANNING -> "Planning"; case ACTIVE -> "In progress";
            case COMPLETED -> "Completed"; case CANCELLED -> "Cancelled";
        };
    }
    private final class Layout {
        private final XSSFWorkbook book;
        private final Instant asOf;
        private final XSSFCellStyle title, context, header, text, alternate, date;
        private final Map<String, CellStyle> states = new HashMap<>();

        Layout(XSSFWorkbook book, Instant asOf) {
            this.book = book; this.asOf = asOf;
            text = style("26344A", false, 10);
            text.setWrapText(true);
            alternate = copy(text); fill(alternate, "F3F6FA");
            title = style("183B69", true, 15);
            context = style("64748B", false, 10); context.setWrapText(true);
            header = style("FFFFFF", true, 10); fill(header, "24476B");
            header.setWrapText(true); header.setAlignment(HorizontalAlignment.CENTER);
            header.setBorderRight(BorderStyle.THIN); header.setRightBorderColor(IndexedColors.WHITE.getIndex());
            date = copy(text); date.setDataFormat(book.createDataFormat().getFormat("dd/mm/yyyy hh:mm"));
            state("In progress", "DBEAFE", "1D4ED8"); state("Completed", "DCFCE7", "166534");
            state("Planning", "EDE9FE", "6D28D9");
            state("Cancelled", "FEE2E2", "991B1B");
        }

        void formatProjectProgress(Sheet sheet) {
            int[] widths = {25, 25, 38, 38, 22, 25, 28};
            sheet.shiftRows(0, sheet.getLastRowNum(), HEADER_ROW);
            configureSheet(sheet, "PROJECT ASSIGNMENTS AND PROGRESS", widths);
            for (int row = HEADER_ROW + 1; row <= sheet.getLastRowNum(); row++) {
                formatRow(sheet.getRow(row));
            }
            finish(sheet);
        }
        Sheet extra(String name, String heading, String... columns) {
            int[] widths = new int[columns.length]; java.util.Arrays.fill(widths, 26);
            var sheet = book.createSheet(name);
            var row = sheet.createRow(HEADER_ROW);
            for (int column = 0; column < columns.length; column++) {
                cell(row, column, columns[column], header);
            }
            configureSheet(sheet, heading, widths);
            return sheet;
        }
        void configureSheet(Sheet sheet, String heading, int[] widths) {
            sheet.setDisplayGridlines(false); sheet.setZoom(100);
            var headingRow = sheet.createRow(1); headingRow.setHeightInPoints(25);
            cell(headingRow, 0, heading, title);
            var timeRow = sheet.createRow(2); timeRow.setHeightInPoints(22);
            cell(timeRow, 0, "Data as of", context); cell(timeRow, 1, asOf, date); cell(timeRow, 2, settings.getTimeZone(), context);
            var scopeRow = sheet.createRow(3); scopeRow.setHeightInPoints(44);
            cell(scopeRow, 0, "The data follows the dashboard filters and your access scope.", context);
            var note = sheet.createRow(4); note.setHeightInPoints(32);
            cell(note, 0, "Figures are counts by status. Date filters use the project creation date.", context);
            for (int merged : new int[]{1, 3, 4}) sheet.addMergedRegion(new CellRangeAddress(merged, merged, 0, widths.length - 1));
            var row = sheet.getRow(HEADER_ROW); row.setHeightInPoints(44);
            for (int column = 0; column < widths.length; column++) {
                sheet.setColumnWidth(column, widths[column] * 256);
                row.getCell(column).setCellStyle(header);
            }
            sheet.createFreezePane(2, HEADER_ROW + 1);
            sheet.setAutobreaks(true); sheet.setFitToPage(true);
            var print = sheet.getPrintSetup(); print.setLandscape(true); print.setPaperSize(PrintSetup.A4_PAPERSIZE); print.setFitWidth((short) 1); print.setFitHeight((short) 0);
            sheet.setRepeatingRows(new CellRangeAddress(HEADER_ROW, HEADER_ROW, -1, -1));
            sheet.getFooter().setRight("Page &P / &N");
        }
        void values(Sheet sheet, Object... values) {
            var row = sheet.createRow(sheet.getLastRowNum() + 1);
            for (int column = 0; column < values.length; column++) {
                cell(row, column, values[column], text);
            }
            formatRow(row);
        }

        private void formatRow(Row row) {
            var sheet = row.getSheet();
            boolean tinted = (row.getRowNum() - HEADER_ROW) % 2 == 0;
            int lines = 1;
            for (Cell cell : row) {
                int column = cell.getColumnIndex();
                String value = cell.toString();
                CellStyle style = cell.getCellStyle().getIndex() == date.getIndex() ? date : tinted ? alternate : text;
                // The Status column in Project Progress uses the same colors as the dashboard.
                if (book.getSheetIndex(sheet) == 0 && column == 4) style = states.getOrDefault(value, style);
                cell.setCellStyle(style);
                int capacity = Math.max(1, sheet.getColumnWidth(column) / 256 - 2);
                int wrapped = 0;
                for (String segment : value.split("\n", -1)) wrapped += Math.max(1, (segment.length() + capacity - 1) / capacity);
                lines = Math.max(lines, wrapped);
            }
            row.setHeightInPoints(Math.max(32, lines * 14 + 10));
        }

        void finish(Sheet sheet) {
            int columns = sheet.getRow(HEADER_ROW).getLastCellNum();
            if (sheet.getLastRowNum() == HEADER_ROW) {
                var row = sheet.createRow(HEADER_ROW + 1); row.setHeightInPoints(28);
                cell(row, 0, "No matching data.", context);
            } else sheet.setAutoFilter(new CellRangeAddress(HEADER_ROW, sheet.getLastRowNum(), 0, columns - 1));
            book.setPrintArea(book.getSheetIndex(sheet), 0, columns - 1, 0, sheet.getLastRowNum());
        }

        private void cell(Row row, int column, Object value, CellStyle style) {
            var cell = row.createCell(column); cell.setCellStyle(value instanceof Instant ? date : style);
            if (value instanceof Number numeric) cell.setCellValue(numeric.doubleValue());
            else if (value instanceof Instant instant) cell.setCellValue(LocalDateTime.ofInstant(instant, settings.zone()));
            else if (value != null) cell.setCellValue(value.toString());
        }
        private XSSFCellStyle style(String color, boolean bold, int size) {
            var font = book.createFont(); font.setFontName("Arial"); font.setFontHeightInPoints((short) size); font.setBold(bold); font.setColor(color(color));
            var style = book.createCellStyle(); style.setFont(font); style.setVerticalAlignment(VerticalAlignment.CENTER);
            return style;
        }
        private XSSFCellStyle copy(CellStyle source) { var style = book.createCellStyle(); style.cloneStyleFrom(source); return style; }
        private void fill(XSSFCellStyle style, String color) { style.setFillForegroundColor(color(color)); style.setFillPattern(FillPatternType.SOLID_FOREGROUND); }
        private void state(String label, String background, String foreground) {
            var style = style(foreground, true, 10); style.setWrapText(true); fill(style, background); states.put(label, style);
        }
        private XSSFColor color(String hex) { return new XSSFColor(java.util.HexFormat.of().parseHex(hex), null); }
    }
}
