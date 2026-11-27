package com.example.starter_project_2025.system.learning.report;

import java.io.*;
import java.time.*;
import java.util.Arrays;
import org.apache.poi.ss.usermodel.*;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.stereotype.Service;
import static com.example.starter_project_2025.system.learning.report.ReportData.*;

@Service
class ReportExport {
    private record Percent(Number value) {}

    byte[] workbook(Detail detail) throws IOException {
        try (var book = new XSSFWorkbook(); var buffer = new ByteArrayOutputStream()) {
            var s = detail.snapshot();
            var report = detail.report();
            var zone = ZoneId.of(report.zone());
            var overview = book.createSheet("Overview");
            add(overview, "Report", report.title());
            add(overview, "Learner", s.learner());
            add(overview, "Period", report.from(), report.to(), report.zone(), report.periodToDate());
            add(overview, "Generated", LocalDateTime.ofInstant(report.generatedAt(), zone));
            add(overview, "AI status", report.aiStatus().name());
            if (s.overview() != null) {
                var o = s.overview();
                add(overview, "Enrolled", o.enrolled());
                add(overview, "Enrolled during period", o.enrolledInPeriod());
                add(overview, "Completed", o.completed());
                add(overview, "In progress", o.inProgress());
                add(overview, "Not started", o.notStarted());
                add(overview, "Unknown", o.unknown());
                add(overview, "Completion rate", new Percent(o.completionRate()));
                add(overview, "Average progress", new Percent(o.averageProgress()), o.measuredCourses());
            }
            for (String limit : s.limitations()) add(overview, "Data limitation", limit);
            if (s.courses() != null) {
                var sheet = book.createSheet("Course Progress");
                add(sheet, "Course", "Enrolled on", "Status at generation", "Progress", "Completed lessons", "Total lessons");
                for (var row : s.courses()) add(sheet, row.name(), row.enrolledOn(), row.status(), new Percent(row.percent()),
                    row.completedLessons(), row.totalLessons());
                filter(sheet, 6);
            }
            if (s.study() != null) {
                var study = s.study();
                var sheet = book.createSheet("Study Activity");
                add(sheet, "Date", "Recorded minutes", "Self-reported minutes", "Active day");
                for (var row : study.days()) add(sheet, row.date(), row.seconds() / 60.0, row.selfReportedSeconds() / 60.0, row.active());
                filter(sheet, 4);
                var goals = book.createSheet("Learning Goals");
                add(goals, "Recorded minutes", study.actualSeconds() / 60.0);
                add(goals, "Timer minutes", study.timerSeconds() / 60.0);
                add(goals, "Self-reported minutes", study.selfReportedSeconds() / 60.0);
                add(goals, "Planned minutes", minutes(study.plannedSeconds()));
                add(goals, "Remaining minutes", minutes(study.remainingSeconds()));
                add(goals, "Achievement", new Percent(study.achievement()));
                add(goals, "Covered days", study.coveredDays());
                add(goals, "Active days", study.activeDays());
                add(goals, "Average active-day minutes", study.averageActiveDaySeconds() / 60.0);
                add(goals, "Current streak", study.currentStreak());
                add(goals, "Longest streak in period", study.longestStreak());
                add(goals, "Week starting", "Planned minutes", "Recorded minutes");
                for (var row : study.weeks()) add(goals, row.start(), minutes(row.plannedSeconds()), row.actualSeconds() / 60.0);
                add(goals, "Course or General Study", "Recorded minutes");
                for (var row : study.byCourse()) add(goals, row.name(), row.seconds() / 60.0);
            }
            if (s.roadmap() != null) {
                var roadmap = s.roadmap();
                var sheet = book.createSheet("Roadmap");
                add(sheet, "Career goal", roadmap.goal(), roadmap.level());
                add(sheet, "Roadmap", roadmap.title(), roadmap.revision());
                add(sheet, "Weeks", roadmap.weeks(), "Planned minutes", roadmap.budgetMinutes());
                add(sheet, "Completed phases", roadmap.completedPhases(), roadmap.phases().size(), new Percent(roadmap.completionRate()));
                for (var phase : roadmap.phases()) {
                    add(sheet, phase.title(), phase.status(), phase.startWeek(), phase.endWeek(), phase.objective());
                    for (var row : phase.courses()) add(sheet, row.name(), row.status(), new Percent(row.percent()));
                }
            }
            if (s.objectives() != null) {
                var objectives = s.objectives();
                var sheet = book.createSheet("Personal Objectives");
                add(sheet, "Total", objectives.total());
                add(sheet, "Completed", objectives.completed());
                add(sheet, "Incomplete", objectives.total() - objectives.completed());
                add(sheet, "Overdue", objectives.overdue());
                add(sheet, "Completed in period", objectives.completedDuringPeriod());
                add(sheet, "Completion", new Percent(ReportAggregation.rate(objectives.completed(), objectives.total())));
            }
            if (s.assessments() != null) {
                var sheet = book.createSheet("Assessment Results");
                add(sheet, "Published results", s.assessments().results(), new Percent(s.assessments().averagePercent()));
                add(sheet, "Assessment", "Submitted", "Score", "Maximum", "Normalized score");
                for (var row : s.assessments().scores()) add(sheet, row.title(), LocalDateTime.ofInstant(row.submittedAt(), zone),
                    row.score(), row.maxScore(), new Percent(row.percent()));
            }
            if (detail.analysis() != null) {
                var sheet = book.createSheet("AI Analysis");
                var ai = detail.analysis();
                add(sheet, "Executive summary", ai.executiveSummary());
                for (var row : ai.achievements()) add(sheet, "Achievement", row.title(), row.description(), evidence(detail, row));
                for (var row : ai.improvementAreas()) add(sheet, "Improvement", row.title(), row.description(), evidence(detail, row));
                for (var row : ai.recommendations()) add(sheet, row.priority(), row.action(), row.reason());
                for (var row : ai.nextPeriodActionPlan()) add(sheet, "Next action", row);
                for (var row : ai.dataLimitations()) add(sheet, "Data limitation", row);
            }
            style(book);
            book.write(buffer);
            return buffer.toByteArray();
        }
    }

    private String evidence(Detail detail, Finding row) {
        return String.join(", ", row.evidenceMetricIds().stream().map(key -> key + " = " + detail.evidence().get(key)).toList());
    }

    private Double minutes(Long seconds) { return seconds == null ? null : seconds / 60.0; }

    private void add(Sheet sheet, Object... data) {
        Row row = sheet.createRow(sheet.getPhysicalNumberOfRows());
        int column = 0;
        for (Object value : data) {
            Cell cell = row.createCell(column++);
            switch (value) {
                case null -> {}
                case Percent percent -> { if (percent.value() != null) cell.setCellValue(percent.value().doubleValue() / 100); }
                case Number number -> cell.setCellValue(number.doubleValue());
                case Boolean bool -> cell.setCellValue(bool);
                case LocalDate date -> cell.setCellValue(date);
                case LocalDateTime date -> cell.setCellValue(date);
                default -> cell.setCellValue(value.toString());
            }
            if (value instanceof LocalDate || value instanceof LocalDateTime || value instanceof Percent) {
                cell.setCellStyle(styleOf(sheet.getWorkbook(), value));
            }
        }
    }

    private CellStyle styleOf(Workbook book, Object value) {
        String format = value instanceof LocalDate ? "yyyy-mm-dd" : value instanceof LocalDateTime ? "yyyy-mm-dd hh:mm" : "0.00%";
        short number = book.createDataFormat().getFormat(format);
        for (int index = 1; index < book.getNumCellStyles(); index++) {
            CellStyle style = book.getCellStyleAt(index);
            if (style.getDataFormat() == number) return style;
        }
        CellStyle style = book.createCellStyle();
        style.setDataFormat(number);
        return style;
    }

    private void filter(Sheet sheet, int columns) {
        if (sheet.getLastRowNum() > 0) sheet.setAutoFilter(new org.apache.poi.ss.util.CellRangeAddress(0, sheet.getLastRowNum(), 0, columns - 1));
    }

    private void style(Workbook book) {
        Font font = book.createFont();
        font.setBold(true);
        CellStyle header = book.createCellStyle();
        header.setFont(font);
        header.setFillForegroundColor(IndexedColors.PALE_BLUE.getIndex());
        header.setFillPattern(FillPatternType.SOLID_FOREGROUND);
        for (Sheet sheet : book) {
            sheet.createFreezePane(0, 1);
            int cols = 0;
            for (Row row : sheet) cols = Math.max(cols, row.getLastCellNum());
            for (int i = 0; i < cols; i++) {
                sheet.setColumnWidth(i, (i == 0 ? 33 : 26) * 256);
                Cell cell = sheet.getRow(0).getCell(i);
                if (cell != null && cell.getCellType() == CellType.STRING) cell.setCellStyle(header);
            }
        }
    }
}
