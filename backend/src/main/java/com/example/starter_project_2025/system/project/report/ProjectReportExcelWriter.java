package com.example.starter_project_2025.system.project.report;

import lombok.RequiredArgsConstructor;
import org.apache.poi.ss.usermodel.*;
import org.apache.poi.ss.util.CellRangeAddress;
import org.apache.poi.xssf.usermodel.XSSFCellStyle;
import org.apache.poi.xssf.usermodel.XSSFColor;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.stereotype.Component;

import java.io.ByteArrayOutputStream;
import java.time.Instant;
import java.time.LocalDateTime;
import java.util.Comparator;
import java.util.HashMap;
import java.util.Map;

import static com.example.starter_project_2025.system.project.report.ProjectReportDtos.*;

/** Workbook layout belongs to Reports; the shared exporter keeps its existing contract. */
@Component
@RequiredArgsConstructor
public class ProjectReportExcelWriter {
    static final int HEADER_ROW = 5;
    private final ProjectReportSettings settings;

    public byte[] write(ProjectReportService.ExportData data) throws Exception {
        var snapshot = data.snapshot();
        try (var book = new XSSFWorkbook(); var output = new ByteArrayOutputStream()) {
            var layout = new Layout(book, snapshot.asOf());
            var projects = snapshot.matching().stream().sorted(Comparator.comparing(SubProject::className)
                    .thenComparing(SubProject::masterCode).thenComparing(SubProject::depth).thenComparing(SubProject::code)).toList();
            var detail = layout.sheet();
            for (var project : projects) {
                layout.row(detail, project.className(), team(project), identity(project.masterCode(), project.masterName()),
                        part(project), projectStatus(project.status()), mentor(project),
                        project.milestones().isEmpty() ? "Chưa có milestone" : project.acceptedMilestones() + "/" + project.milestones().size() + " được chấp nhận");
            }
            layout.finish(detail);
            var overview = layout.extra("Tổng quan", "CHỈ SỐ TỔNG QUAN", "Chỉ số", "Số lượng");
            var k = data.overview();
            layout.values(overview, "Master đang triển khai", k.activeMasters());
            layout.values(overview, "Team đang tham gia", k.activeTeams());
            layout.values(overview, "Lớp có dự án", projects.stream().map(SubProject::classId).distinct().count());
            layout.values(overview, "Sub-project", projects.stream().filter(row -> row.parentProjectId() != null).count());
            layout.values(overview, "Task quá hạn", k.overdueTasks());
            layout.values(overview, "Backlog quá hạn", k.overdueBacklogItems());
            layout.values(overview, "Task con quá hạn", k.overdueSubtasks());
            layout.values(overview, "Rủi ro cần xử lý", k.riskCount());
            layout.values(overview, "Milestone rủi ro", k.milestoneRisks());
            layout.values(overview, "Thành viên không hoạt động", k.inactiveMembers());
            k.milestoneStatuses().forEach((status, count) -> layout.values(overview, "Milestone · " + label(status), count));
            k.artifactStatuses().forEach((status, count) -> layout.values(overview, "Bài nộp · " + label(status), count));
            var counts = data.work().backlog();
            layout.values(overview, "Công việc · Todo", counts.todo());
            layout.values(overview, "Công việc · In progress", counts.inProgress());
            layout.values(overview, "Công việc · Review", counts.review());
            layout.values(overview, "Công việc · Done", counts.done());
            layout.finish(overview);

            var work = layout.extra("Trạng thái công việc", "PHÂN BỐ CÔNG VIỆC THEO SPRINT", "Project", "Team", "Sprint", "Trạng thái Sprint",
                    "Bắt đầu", "Kết thúc", "Todo", "In progress", "Review", "Done", "Tổng");
            data.work().sprints().stream().filter(sprint -> data.work().selectedSprintId() == null || data.work().selectedSprintId().equals(sprint.id()))
                    .forEach(sprint -> layout.values(work, sprint.projectName(), sprint.teamName(), sprint.name(), label(sprint.status()),
                            sprint.startAt(), sprint.endAt(), sprint.backlog().todo(), sprint.backlog().inProgress(), sprint.backlog().review(),
                            sprint.backlog().done(), sprint.backlog().total()));
            if (data.work().selectedSprintId() == null) {
                var planned = data.work().sprints().stream().map(SprintRow::backlog).reduce(BacklogCounts.empty(), BacklogCounts::plus);
                if (counts.total() > planned.total()) layout.values(work, "Theo bộ lọc", null, "Chưa gán Sprint", null, null, null,
                        counts.todo() - planned.todo(), counts.inProgress() - planned.inProgress(), counts.review() - planned.review(),
                        counts.done() - planned.done(), counts.total() - planned.total());
            }
            layout.finish(work);
            var deliveries = layout.extra("Milestone và bài nộp", "MILESTONE VÀ BẢN NỘP HIỆN TẠI", "Master", "Project", "Team", "Milestone", "Bắt buộc",
                    "Deadline", "Trạng thái milestone", "Trạng thái bài nộp", "Phiên bản", "Thời điểm nộp", "Người duyệt", "Checklist đạt", "Tổng checklist", "Cảnh báo");
            data.deliveries().forEach(row -> layout.values(deliveries, row.masterName(), row.projectName(), row.teamName(), row.title(), row.mandatory() ? "Có" : "Không",
                    row.deadline(), label(row.milestoneStatus()), row.artifactStatus() == null ? "Chưa có bài nộp" : label(row.artifactStatus()), row.version(),
                    row.submittedAt(), row.reviewerName(), row.checklistCompleted(), row.checklistTotal(), label(row.attention())));
            layout.finish(deliveries);
            var risks = layout.extra("Cảnh báo", "CẢNH BÁO HIỆN TẠI", "Loại", "Project", "Team", "Đối tượng", "Deadline", "Lý do");
            data.risks().forEach(row -> layout.values(risks, label(row.kind()), row.projectName(), row.teamName(), row.subject(), row.deadline(), label(row.reason())));
            layout.finish(risks);
            var activity = layout.extra("Hoạt động", "HOẠT ĐỘNG TRONG PHẠM VI BÁO CÁO", "Thời gian", "Master", "Mã Project", "Project", "Team",
                    "Người thực hiện", "Đối tượng", "Hành động", "Trạng thái trước", "Trạng thái sau");
            data.activities().forEach(row -> layout.values(activity, row.occurredAt(), row.masterName(), row.projectCode(), row.projectName(), row.teamName(),
                    row.actorName(), row.subject(), action(row.action()), label(row.beforeStatus()), label(row.afterStatus())));
            layout.finish(activity);
            for (int index = 0; index < book.getNumberOfSheets(); index++) {
                var context = book.getSheetAt(index).getRow(3).getCell(0);
                context.setCellValue("Theo bộ lọc: " + filterText(data));
            }
            book.setActiveSheet(0);
            book.write(output);
            return output.toByteArray();
        }
    }

    private static String identity(String code, String name) { return code + "\n" + name; }
    private static String part(SubProject project) {
        return project.parentProjectId() == null ? "Phần việc trực tiếp Master" : identity(project.code(), project.name());
    }
    private static String team(SubProject project) { return project.teamName() == null ? "Dùng chung trong Master" : project.teamName(); }
    private static String mentor(SubProject project) {
        return project.mentorName() != null ? project.mentorName() : project.teamId() == null ? "Theo từng Sub-project" : "Chưa phân công";
    }
    private String filterText(ProjectReportService.ExportData data) {
        var filter = data.snapshot().filter();
        var rows = data.snapshot().all();
        var parts = new java.util.ArrayList<String>();
        if (filter.programId() != null) parts.add("Chương trình: " + rows.stream().filter(row -> filter.programId().equals(row.programId())).map(SubProject::programName).filter(java.util.Objects::nonNull).findFirst().orElse("#" + filter.programId()));
        if (filter.cohortId() != null) parts.add("Cohort: " + rows.stream().filter(row -> filter.cohortId().equals(row.cohortId())).map(SubProject::cohortName).filter(java.util.Objects::nonNull).findFirst().orElse("#" + filter.cohortId()));
        if (filter.classId() != null) parts.add("Lớp: " + rows.stream().filter(row -> filter.classId().equals(row.classId())).map(SubProject::className).findFirst().orElse("#" + filter.classId()));
        if (filter.masterId() != null) parts.add("Master: " + rows.stream().filter(row -> filter.masterId().equals(row.masterId())).map(SubProject::masterName).findFirst().orElse("#" + filter.masterId()));
        if (filter.projectId() != null) parts.add("Project: " + rows.stream().filter(row -> filter.projectId().equals(row.id())).map(SubProject::name).findFirst().orElse("#" + filter.projectId()));
        if (filter.teamId() != null) parts.add("Team: " + rows.stream().filter(row -> filter.teamId().equals(row.teamId())).map(SubProject::teamName).filter(java.util.Objects::nonNull).findFirst().orElse("#" + filter.teamId()));
        if (filter.mentorId() != null) parts.add("Mentor: " + rows.stream().filter(row -> filter.mentorId().equals(row.mentorId())).map(SubProject::mentorName).findFirst().orElse("#" + filter.mentorId()));
        if (filter.templateId() != null) parts.add("Đề bài: " + rows.stream().filter(row -> filter.templateId().equals(row.templateId())).map(SubProject::templateName).findFirst().orElse("#" + filter.templateId()));
        if (filter.sourceVersionId() != null) parts.add("Phiên bản: " + rows.stream().filter(row -> filter.sourceVersionId().equals(row.sourceVersionId())).map(SubProject::sourceVersion).findFirst().orElse("#" + filter.sourceVersionId()));
        if (filter.masterStatus() != null) parts.add("Trạng thái Master: " + projectStatus(filter.masterStatus()));
        if (filter.status() != null) parts.add("Trạng thái Project con: " + projectStatus(filter.status()));
        if (filter.risk() != Risk.ALL) parts.add("Cảnh báo: " + switch (filter.risk()) { case OVERDUE -> "Quá hạn"; case INACTIVE_MEMBERS -> "Thành viên không hoạt động"; case NEEDS_ATTENTION -> "Đang cần xử lý"; case LATE_SUBMISSION -> "Lịch sử nộp trễ"; default -> "Tất cả"; });
        if (filter.createdFrom() != null) parts.add("Ngày tạo từ " + filter.createdFrom());
        if (filter.createdTo() != null) parts.add("Ngày tạo đến " + filter.createdTo());
        if (filter.workSprintId() != null) parts.add("Công việc trong Sprint: " + data.work().sprints().stream().filter(row -> filter.workSprintId().equals(row.id())).map(SprintRow::name).findFirst().orElse("#" + filter.workSprintId()));
        if (!filter.q().isBlank()) parts.add("Tìm kiếm: " + filter.q());
        if (filter.includeCancelled()) parts.add("Bao gồm dự án đã hủy");
        return parts.isEmpty() ? "Tất cả dữ liệu trong phạm vi được phép xem" : String.join(" · ", parts);
    }
    static String label(String status) {
        if (status == null || status.equals("NONE")) return "—";
        return switch (status) {
            case "DRAFT" -> "Bản nháp"; case "PLANNED", "PLANNING" -> "Chưa bắt đầu";
            case "IN_PROGRESS" -> "Đang thực hiện"; case "ACTIVE" -> "Đang triển khai";
            case "SUBMITTED" -> "Chờ duyệt"; case "ACCEPTED" -> "Đã chấp nhận"; case "CHANGES_REQUESTED" -> "Cần chỉnh sửa";
            case "REJECTED" -> "Bị từ chối"; case "WAIVED" -> "Được miễn"; case "COMPLETED" -> "Hoàn thành";
            case "CANCELLED" -> "Đã hủy"; case "OVERDUE" -> "Quá hạn"; case "DUE_SOON" -> "Sắp hạn chưa nộp";
            case "REVISION" -> "Bài nộp cần xử lý"; case "INACTIVE" -> "Không có hoạt động trong cửa sổ theo dõi";
            case "MILESTONE" -> "Milestone"; case "TASK" -> "Công việc"; case "MEMBER" -> "Thành viên";
            default -> status;
        };
    }
    static String action(String value) {
        if (value == null) return "Cập nhật";
        return switch (value) {
            case "TASK_CREATED", "BACKLOG_CREATE", "BACKLOG_CREATED" -> "Tạo công việc";
            case "TASK_STATUS_CHANGED", "TASK_UPDATE_STATUS", "BACKLOG_STATUS_CHANGED", "BACKLOG_STATUS_UPDATED" -> "Đổi trạng thái công việc";
            case "TASK_UPDATED", "TASK_UPDATE", "BACKLOG_UPDATE", "BACKLOG_UPDATED" -> "Cập nhật công việc";
            case "TASK_DELETED", "TASK_DELETE", "BACKLOG_DELETE", "BACKLOG_DELETED" -> "Xóa công việc";
            case "TASK_ASSIGNED" -> "Phân công công việc"; case "TASK_MOVED_TO_SPRINT" -> "Chuyển công việc vào Sprint";
            case "TASK_REORDERED" -> "Sắp xếp công việc"; case "SUBMISSION_SUBMITTED" -> "Nộp bài";
            case "SUBMISSION_ACCEPT" -> "Chấp nhận bài nộp"; case "SUBMISSION_REJECT" -> "Từ chối bài nộp";
            case "SUBMISSION_REQUEST_CHANGES" -> "Yêu cầu chỉnh sửa"; case "MILESTONE_CREATED" -> "Tạo milestone";
            case "MILESTONE_AT_RISK_ALERT_SENT" -> "Gửi cảnh báo milestone";
            default -> "Cập nhật " + (value.startsWith("MILESTONE_") ? "milestone" : value.startsWith("SUBMISSION_") ? "bài nộp" : "công việc");
        };
    }
    private static String projectStatus(Status status) {
        return switch (status) {
            case DRAFT -> "Bản nháp"; case PLANNING -> "Lên kế hoạch"; case ACTIVE -> "Đang triển khai";
            case COMPLETED -> "Hoàn thành"; case CANCELLED -> "Đã hủy";
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
            state("Đang triển khai", "DBEAFE", "1D4ED8"); state("Hoàn thành", "DCFCE7", "166534");
            state("Lên kế hoạch", "EDE9FE", "6D28D9");
            state("Đã hủy", "FEE2E2", "991B1B");
        }

        Sheet sheet() {
            String[] columns = {"Lớp", "Nhóm phụ trách", "Master Project", "Sub-project", "Trạng thái", "Mentor", "Tiến độ milestone"};
            int[] widths = {25, 25, 38, 38, 22, 25, 28};
            return sheet("Tiến độ dự án", "PHÂN CÔNG VÀ TIẾN ĐỘ DỰ ÁN", columns, widths);
        }
        Sheet extra(String name, String heading, String... columns) {
            int[] widths = new int[columns.length]; java.util.Arrays.fill(widths, 26);
            return sheet(name, heading, columns, widths);
        }
        Sheet sheet(String name, String heading, String[] columns, int[] widths) {
            var sheet = book.createSheet(name);
            sheet.setDisplayGridlines(false); sheet.setZoom(100);
            var headingRow = sheet.createRow(1); headingRow.setHeightInPoints(25);
            cell(headingRow, 0, heading, title);
            var timeRow = sheet.createRow(2); timeRow.setHeightInPoints(22);
            cell(timeRow, 0, "Dữ liệu lúc", context); cell(timeRow, 1, asOf, date); cell(timeRow, 2, settings.getTimeZone(), context);
            var scopeRow = sheet.createRow(3); scopeRow.setHeightInPoints(44);
            cell(scopeRow, 0, "Dữ liệu theo bộ lọc trên Dashboard và phạm vi được phép xem.", context);
            var note = sheet.createRow(4); note.setHeightInPoints(32);
            cell(note, 0, "Số lượng theo trạng thái; không hiển thị phần trăm. Ngày lọc là ngày tạo Project.", context);
            for (int merged : new int[]{1, 3, 4}) sheet.addMergedRegion(new CellRangeAddress(merged, merged, 0, columns.length - 1));
            var row = sheet.createRow(HEADER_ROW); row.setHeightInPoints(44);
            for (int column = 0; column < columns.length; column++) {
                sheet.setColumnWidth(column, widths[column] * 256);
                cell(row, column, columns[column], header);
            }
            sheet.createFreezePane(2, HEADER_ROW + 1);
            sheet.setAutobreaks(true); sheet.setFitToPage(true);
            var print = sheet.getPrintSetup(); print.setLandscape(true); print.setPaperSize(PrintSetup.A4_PAPERSIZE); print.setFitWidth((short) 1); print.setFitHeight((short) 0);
            sheet.setRepeatingRows(new CellRangeAddress(HEADER_ROW, HEADER_ROW, -1, -1));
            sheet.getFooter().setRight("Trang &P / &N");
            return sheet;
        }

        void row(Sheet sheet, String... values) {
            values(sheet, (Object[]) values);
        }
        void values(Sheet sheet, Object... values) {
            var row = sheet.createRow(sheet.getLastRowNum() + 1);
            boolean tinted = (row.getRowNum() - HEADER_ROW) % 2 == 0;
            int lines = 1;
            for (int column = 0; column < values.length; column++) {
                Object value = values[column];
                CellStyle style = tinted ? alternate : text;
                if (value != null) {
                    // Only lifecycle columns use status colors; project names can equal a status label.
                    if (book.getSheetIndex(sheet) == 0 && column == 4) style = states.getOrDefault(value, style);
                    int capacity = Math.max(1, sheet.getColumnWidth(column) / 256 - 2);
                    int wrapped = 0;
                    for (String segment : value.toString().split("\n", -1)) wrapped += Math.max(1, (segment.length() + capacity - 1) / capacity);
                    lines = Math.max(lines, wrapped);
                }
                cell(row, column, value, style);
            }
            row.setHeightInPoints(Math.max(32, lines * 14 + 10));
        }

        void finish(Sheet sheet) {
            int columns = sheet.getRow(HEADER_ROW).getLastCellNum();
            if (sheet.getLastRowNum() == HEADER_ROW) {
                var row = sheet.createRow(HEADER_ROW + 1); row.setHeightInPoints(28);
                cell(row, 0, "Không có dữ liệu phù hợp.", context);
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
