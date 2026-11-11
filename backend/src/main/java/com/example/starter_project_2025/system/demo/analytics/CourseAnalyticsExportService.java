package com.example.starter_project_2025.system.demo.analytics;

import com.example.starter_project_2025.system.demo.analytics.CourseAnalyticsDTO.*;
import lombok.RequiredArgsConstructor;
import org.apache.poi.ss.usermodel.BorderStyle;
import org.apache.poi.ss.usermodel.Cell;
import org.apache.poi.ss.usermodel.CellStyle;
import org.apache.poi.ss.usermodel.FillPatternType;
import org.apache.poi.ss.usermodel.Font;
import org.apache.poi.ss.usermodel.HorizontalAlignment;
import org.apache.poi.ss.usermodel.IndexedColors;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.ss.usermodel.VerticalAlignment;
import org.apache.poi.ss.usermodel.Workbook;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

/**
 * Xuất dữ liệu Course Analytics ra Excel (.xlsx) bằng Apache POI.
 *
 * <p>Có 2 kiểu export:
 * <ul>
 *   <li><b>Export từng phần</b> — mỗi nhóm analytics (phễu, xu hướng, hoạt động, đánh giá,
 *       phòng ban, xếp hạng, chất lượng nội dung, bài thi) có một endpoint riêng trả về
 *       file .xlsx gồm 1 sheet.</li>
 *   <li><b>Export tổng</b> — gom <b>tất cả</b> các phần analytics vào một file .xlsx
 *       nhiều sheet (mỗi phần 1 sheet) để báo cáo cho quản lý.</li>
 * </ul>
 */
@Service
@RequiredArgsConstructor
public class CourseAnalyticsExportService {

    private final CourseAnalyticsService analyticsService;

    private static final String SHEET_SUMMARY = "Tong quan";
    private static final int MAX_LABEL_LENGTH = 60;

    // =====================================================================
    // Export tổng (master export)
    // =====================================================================

    /** Gom toàn bộ analytics của một khóa học vào 1 file .xlsx nhiều sheet. */
    @Transactional(readOnly = true)
    public byte[] exportAll(Long courseId, LocalDate from, LocalDate to, Granularity granularity,
                            Integer inactiveDays) throws IOException {
        try (Workbook workbook = new XSSFWorkbook();
             ByteArrayOutputStream output = new ByteArrayOutputStream()) {

            LessonFunnelResponse funnel = analyticsService.getLessonFunnel(courseId);
            TrendResponse trend = analyticsService.getTrend(courseId, from, to, granularity);
            ActivityResponse activity = analyticsService.getActivity(courseId, inactiveDays, null);
            CourseReviewAnalyticsResponse reviews = analyticsService.getReviewAnalytics(courseId);
            DepartmentAnalyticsResponse departments = analyticsService.getDepartmentAnalytics(courseId);
            CourseRankingResponse ranking = analyticsService.getCourseRanking();
            ContentQualityResponse quality = analyticsService.getContentQuality(courseId);
            CourseExamAnalyticsResponse exams = analyticsService.getExamAnalytics(courseId);
            StudyTimeResponse studyTime = analyticsService.getStudyTime(courseId);

            writeSummary(workbook, funnel, trend, activity, reviews, departments, quality);

            writeFunnelSheet(workbook, funnel);
            writeTrendSheet(workbook, trend);
            writeActivitySheet(workbook, activity);
            writeReviewSheet(workbook, reviews);
            writeDepartmentSheet(workbook, departments);
            writeRankingSheet(workbook, ranking);
            writeContentQualitySheet(workbook, quality);
            writeExamSheet(workbook, exams);
            writeStudyTimeSheet(workbook, studyTime);

            workbook.write(output);
            return output.toByteArray();
        }
    }

    private void writeSummary(
            Workbook workbook,
            LessonFunnelResponse funnel,
            TrendResponse trend,
            ActivityResponse activity,
            CourseReviewAnalyticsResponse reviews,
            DepartmentAnalyticsResponse departments,
            ContentQualityResponse quality
    ) {
        Sheet sheet = workbook.createSheet(SHEET_SUMMARY);
        CellStyle titleStyle = titleStyle(workbook);
        CellStyle labelStyle = labelStyle(workbook);
        CellStyle valueStyle = valueStyle(workbook);

        int rowNum = 0;
        Row title = sheet.createRow(rowNum++);
        Cell titleCell = title.createCell(0);
        titleCell.setCellValue("TONG HOP PHAN TICH KHOA HOC");
        titleCell.setCellStyle(titleStyle);
        sheet.addMergedRegion(new org.apache.poi.ss.util.CellRangeAddress(0, 0, 0, 3));

        rowNum = addRow(sheet, rowNum, labelStyle, valueStyle, "Khóa học", funnel.courseName());
        rowNum = addRow(sheet, rowNum, labelStyle, valueStyle, "Tổng học viên", funnel.totalLearners());
        rowNum = addRow(sheet, rowNum, labelStyle, valueStyle, "Tổng bài học", funnel.totalLessons());

        rowNum = addRow(sheet, rowNum, labelStyle, valueStyle,
                "Hoàn thành khóa học", activity.completedLearners());
        rowNum = addRow(sheet, rowNum, labelStyle, valueStyle,
                "Đang học (active)", activity.activeLearners());
        rowNum = addRow(sheet, rowNum, labelStyle, valueStyle,
                "Nguy cơ bỏ học", activity.inactiveLearners() + activity.neverStartedLearners());

        rowNum = addRow(sheet, rowNum, labelStyle, valueStyle,
                "Điểm đánh giá TB", reviews.totalReviews() > 0 ? reviews.averageRating() : null);
        rowNum = addRow(sheet, rowNum, labelStyle, valueStyle,
                "Số review", reviews.totalReviews());

        rowNum = addRow(sheet, rowNum, labelStyle, valueStyle,
                "Khoảng thời gian xu hướng", trend.from() + " → " + trend.to());
        rowNum = addRow(sheet, rowNum, labelStyle, valueStyle,
                "Lượt đăng ký trong kỳ", trend.totalEnrollments());
        rowNum = addRow(sheet, rowNum, labelStyle, valueStyle,
                "Bài hoàn thành trong kỳ", trend.totalLessonsCompleted());
        rowNum = addRow(sheet, rowNum, labelStyle, valueStyle,
                "Chứng chỉ cấp trong kỳ", trend.totalCertificatesIssued());

        rowNum = addRow(sheet, rowNum, labelStyle, valueStyle,
                "Số phòng ban", departments.departmentCount());
        rowNum = addRow(sheet, rowNum, labelStyle, valueStyle,
                "Tổng giờ học (phòng ban)", departments.totalStudyHours());
        rowNum = addRow(sheet, rowNum, labelStyle, valueStyle,
                "Phòng ban tốt nhất",
                departments.bestDepartment() == null ? null : departments.bestDepartment().departmentName());
        rowNum = addRow(sheet, rowNum, labelStyle, valueStyle,
                "Phòng ban kém nhất",
                departments.worstDepartment() == null ? null : departments.worstDepartment().departmentName());

        rowNum = addRow(sheet, rowNum, labelStyle, valueStyle,
                "Bài học bị báo lỗi", quality.totalReports());
        rowNum = addRow(sheet, rowNum, labelStyle, valueStyle,
                "Câu hỏi chưa trả lời", quality.unansweredQuestions());
        rowNum = addRow(sheet, rowNum, labelStyle, valueStyle,
                "Thời gian phản hồi TB (giờ)", quality.averageResponseHours());

        sheet.setColumnWidth(0, 8000);
        sheet.setColumnWidth(1, 14000);
    }

    // =====================================================================
    // Export từng phần
    // =====================================================================

    @Transactional(readOnly = true)
    public byte[] exportLessonFunnel(Long courseId) throws IOException {
        try (Workbook workbook = new XSSFWorkbook();
             ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            writeFunnelSheet(workbook, analyticsService.getLessonFunnel(courseId));
            workbook.write(output);
            return output.toByteArray();
        }
    }

    @Transactional(readOnly = true)
    public byte[] exportTrend(Long courseId, LocalDate from, LocalDate to, Granularity granularity)
            throws IOException {
        try (Workbook workbook = new XSSFWorkbook();
             ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            writeTrendSheet(workbook, analyticsService.getTrend(courseId, from, to, granularity));
            workbook.write(output);
            return output.toByteArray();
        }
    }

    @Transactional(readOnly = true)
    public byte[] exportActivity(Long courseId, Integer inactiveDays) throws IOException {
        try (Workbook workbook = new XSSFWorkbook();
             ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            // Dùng đúng ngưỡng không hoạt động mà FE đang chọn để dữ liệu export
            // khớp với dữ liệu hiển thị trên màn hình.
            writeActivitySheet(workbook, analyticsService.getActivity(courseId, inactiveDays, null));
            workbook.write(output);
            return output.toByteArray();
        }
    }

    @Transactional(readOnly = true)
    public byte[] exportReviews(Long courseId) throws IOException {
        try (Workbook workbook = new XSSFWorkbook();
             ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            writeReviewSheet(workbook, analyticsService.getReviewAnalytics(courseId));
            workbook.write(output);
            return output.toByteArray();
        }
    }

    @Transactional(readOnly = true)
    public byte[] exportDepartments(Long courseId) throws IOException {
        try (Workbook workbook = new XSSFWorkbook();
             ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            writeDepartmentSheet(workbook, analyticsService.getDepartmentAnalytics(courseId));
            workbook.write(output);
            return output.toByteArray();
        }
    }

    @Transactional(readOnly = true)
    public byte[] exportCourseRanking() throws IOException {
        try (Workbook workbook = new XSSFWorkbook();
             ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            writeRankingSheet(workbook, analyticsService.getCourseRanking());
            workbook.write(output);
            return output.toByteArray();
        }
    }

    @Transactional(readOnly = true)
    public byte[] exportContentQuality(Long courseId) throws IOException {
        try (Workbook workbook = new XSSFWorkbook();
             ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            writeContentQualitySheet(workbook, analyticsService.getContentQuality(courseId));
            workbook.write(output);
            return output.toByteArray();
        }
    }

    @Transactional(readOnly = true)
    public byte[] exportExams(Long courseId) throws IOException {
        try (Workbook workbook = new XSSFWorkbook();
             ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            writeExamSheet(workbook, analyticsService.getExamAnalytics(courseId));
            workbook.write(output);
            return output.toByteArray();
        }
    }

    @Transactional(readOnly = true)
    public byte[] exportStudyTime(Long courseId) throws IOException {
        try (Workbook workbook = new XSSFWorkbook();
             ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            writeStudyTimeSheet(workbook, analyticsService.getStudyTime(courseId));
            workbook.write(output);
            return output.toByteArray();
        }
    }

    // =====================================================================
    // Các sheet
    // =====================================================================

    private void writeFunnelSheet(Workbook workbook, LessonFunnelResponse data) {
        Sheet sheet = workbook.createSheet("Phieu hoc tap");
        List<String> headers = List.of(
                "STT", "Bai hoc", "Section", "Loai", "Vi tri", "Nguoi bat dau", "Nguoi hoan thanh", "Ty le hoan thanh (%)", "Ty le tut (%)");
        writeHeader(workbook, sheet, headers);

        int rowNum = 1;
        int index = 1;
        for (LessonFunnelItem item : data.lessons()) {
            Row row = sheet.createRow(rowNum++);
            setNumber(row, 0, index++);
            setText(row, 1, item.lessonTitle());
            setText(row, 2, item.sectionTitle());
            setText(row, 3, item.contentType());
            setNumber(row, 4, item.position());
            setNumber(row, 5, item.startedCount());
            setNumber(row, 6, item.completedCount());
            setNumber(row, 7, item.completionRate());
            setNumber(row, 8, item.dropOffFromPrevious());
        }
        autosize(sheet, headers.size());
    }

    private void writeTrendSheet(Workbook workbook, TrendResponse data) {
        Sheet sheet = workbook.createSheet("Xu huong");
        List<String> headers = List.of(
                "Ky tuong", "Dang ky moi", "Bai hoan thanh", "Chung chi cap");
        writeHeader(workbook, sheet, headers);

        int rowNum = 1;
        for (TrendPoint point : data.points()) {
            Row row = sheet.createRow(rowNum++);
            setText(row, 0, point.bucketStart().toString());
            setNumber(row, 1, point.enrollments());
            setNumber(row, 2, point.lessonsCompleted());
            setNumber(row, 3, point.certificatesIssued());
        }
        autosize(sheet, headers.size());
    }

    private void writeActivitySheet(Workbook workbook, ActivityResponse data) {
        Sheet sheet = workbook.createSheet("Hoat dong");

        // Phần 1: phân bố tiến độ.
        writeHeader(workbook, sheet, List.of("Nhom tien do", "So hoc vien"));
        int rowNum = 1;
        for (ProgressBucket bucket : data.progressDistribution()) {
            Row row = sheet.createRow(rowNum++);
            setText(row, 0, bucket.label());
            setNumber(row, 1, bucket.learners());
        }
        autosize(sheet, 2);

        // Phần 2: tổng hợp trạng thái.
        Sheet summarySheet = workbook.createSheet("Tong hop hoat dong");
        writeHeader(workbook, summarySheet, List.of("Chi so", "Gia tri"));
        CellStyle labelStyle = labelStyle(workbook);
        CellStyle valueStyle = valueStyle(workbook);
        int summaryRow = 1;
        summaryRow = addRow(summarySheet, summaryRow, labelStyle, valueStyle, "Tong hoc vien", data.totalLearners());
        summaryRow = addRow(summarySheet, summaryRow, labelStyle, valueStyle, "Da hoan thanh", data.completedLearners());
        summaryRow = addRow(summarySheet, summaryRow, labelStyle, valueStyle, "Dang hoc (active)", data.activeLearners());
        summaryRow = addRow(summarySheet, summaryRow, labelStyle, valueStyle, "Inactive", data.inactiveLearners());
        summaryRow = addRow(summarySheet, summaryRow, labelStyle, valueStyle, "Chua bat dau", data.neverStartedLearners());
        summaryRow = addRow(summarySheet, summaryRow, labelStyle, valueStyle, "Nguy co bo hoc", data.atRiskCount());
        summaryRow = addRow(summarySheet, summaryRow, labelStyle, valueStyle, "Rui ro cao", data.highRiskCount());
        summaryRow = addRow(summarySheet, summaryRow, labelStyle, valueStyle, "Rui ro trung binh", data.mediumRiskCount());
        summaryRow = addRow(summarySheet, summaryRow, labelStyle, valueStyle, "Diem rui ro TB", data.averageRiskScore());
        summaryRow = addRow(summarySheet, summaryRow, labelStyle, valueStyle, "Nguong khong hoat dong (ngay)",
                data.inactiveThresholdDays());
        autosize(summarySheet, 2);

        // Phần 3: học viên nguy cơ bỏ học.
        Sheet riskSheet = workbook.createSheet("Hoc vien nguy co");
        List<String> headers = List.of(
                "Hoc vien", "Email", "Tien do (%)", "Ngay khong hoat dong", "Ly do",
                "Diem rui ro", "Muc do rui ro", "Yeu to rui ro");
        writeHeader(workbook, riskSheet, headers);

        rowNum = 1;
        for (AtRiskLearner learner : data.atRiskLearners()) {
            Row row = riskSheet.createRow(rowNum++);
            setText(row, 0, learner.studentName());
            setText(row, 1, learner.studentEmail());
            setNumber(row, 2, learner.progressPercentage());
            setNumber(row, 3, learner.inactiveDays());
            setText(row, 4, learner.reason());
            setNumber(row, 5, learner.riskScore());
            setText(row, 6, learner.riskLevel());
            setText(row, 7, learner.primaryRiskReason());
        }
        autosize(riskSheet, headers.size());
    }

    private void writeReviewSheet(Workbook workbook, CourseReviewAnalyticsResponse data) {
        Sheet sheet = workbook.createSheet("Danh gia");
        List<String> headers = List.of("So sao", "So review", "Ty le (%)");
        writeHeader(workbook, sheet, headers);

        int rowNum = 1;
        for (RatingBucket bucket : data.distribution()) {
            Row row = sheet.createRow(rowNum++);
            setNumber(row, 0, bucket.stars());
            setNumber(row, 1, bucket.count());
            setNumber(row, 2, bucket.percentage());
        }
        autosize(sheet, headers.size());
    }

    private void writeDepartmentSheet(Workbook workbook, DepartmentAnalyticsResponse data) {
        Sheet sheet = workbook.createSheet("Phong ban");
        List<String> headers = List.of(
                "Ma phong ban", "Ten phong ban", "So hoc vien", "Hoan thanh", "Ty le hoan thanh (%)",
                "Tien do TB (%)", "Diem thi TB (%)", "Luot thi da cham", "Hoc vien active", "Hoc vien nguy co",
                "Ty le bo hoc (%)", "Tong gio hoc", "Gio hoc TB / hoc vien");
        writeHeader(workbook, sheet, headers);

        int rowNum = 1;
        for (DepartmentAnalyticsItem item : data.departments()) {
            Row row = sheet.createRow(rowNum++);
            setText(row, 0, item.departmentCode());
            setText(row, 1, item.departmentName());
            setNumber(row, 2, item.learnerCount());
            setNumber(row, 3, item.completedLearners());
            setNumber(row, 4, item.completionRate());
            setNumber(row, 5, item.averageProgress());
            if (item.averageExamScore() == null) {
                setBlank(row, 6);
            } else {
                setNumber(row, 6, item.averageExamScore());
            }
            setNumber(row, 7, item.examGradedAttempts());
            setNumber(row, 8, item.activeLearners());
            setNumber(row, 9, item.atRiskLearners());
            setNumber(row, 10, item.dropOffRate());
            setNumber(row, 11, item.totalStudyHours());
            setNumber(row, 12, item.averageStudyHoursPerLearner());
        }
        autosize(sheet, headers.size());
    }

    private void writeStudyTimeSheet(Workbook workbook, StudyTimeResponse data) {
        Sheet sheet = workbook.createSheet("Thoi gian hoc");
        List<String> headers = List.of(
                "Hoc vien", "Email", "Phong ban", "Tong gio hoc", "Tong giay hoc",
                "Bai hoan thanh", "Tong bai", "Ty le hoan thanh (%)", "Truy cap gan nhat");
        writeHeader(workbook, sheet, headers);

        int rowNum = 1;
        for (StudentStudyTimeItem item : data.learners()) {
            Row row = sheet.createRow(rowNum++);
            setText(row, 0, item.studentName());
            setText(row, 1, item.studentEmail());
            setText(row, 2, item.departmentName());
            setNumber(row, 3, item.studyHours());
            setNumber(row, 4, item.studySeconds());
            setNumber(row, 5, item.completedLessons());
            setNumber(row, 6, item.totalLessons());
            setNumber(row, 7, item.completionRate());
            setText(row, 8, item.lastAccessedAt() == null ? null : item.lastAccessedAt().toString());
        }
        autosize(sheet, headers.size());
    }

    private void writeRankingSheet(Workbook workbook, CourseRankingResponse data) {
        Sheet sheet = workbook.createSheet("Xep hang khoa hoc");
        List<String> headers = List.of(
                "Hang", "Khoa hoc", "Giang vien", "So hoc vien", "Hoan thanh", "Ty le hoan thanh (%)",
                "Diem danh gia TB", "So review", "Active", "Inactive", "Chua bat dau",
                "Chua hoan thanh", "Ty le chua hoan thanh (%)", "Ty le bo hoc (%)");
        writeHeader(workbook, sheet, headers);

        int rowNum = 1;
        for (CourseRankingItem item : data.allCourses()) {
            Row row = sheet.createRow(rowNum++);
            setNumber(row, 0, item.rank());
            setText(row, 1, item.courseName());
            setText(row, 2, item.instructor());
            setNumber(row, 3, item.learnerCount());
            setNumber(row, 4, item.completedLearners());
            setNumber(row, 5, item.completionRate());
            setNumber(row, 6, item.averageRating());
            setNumber(row, 7, item.totalReviews());
            setNumber(row, 8, item.activeLearners());
            setNumber(row, 9, item.inactiveLearners());
            setNumber(row, 10, item.neverStartedLearners());
            setNumber(row, 11, item.notCompletedLearners());
            setNumber(row, 12, item.notCompletedRate());
            setNumber(row, 13, item.dropOffRate());
        }
        autosize(sheet, headers.size());
    }

    private void writeContentQualitySheet(Workbook workbook, ContentQualityResponse data) {
        // Sheet 1: bài học bị báo lỗi nhiều nhất.
        Sheet lessonSheet = workbook.createSheet("Bai hoc bi bao loi");
        List<String> lessonHeaders = List.of(
                "Hang", "Bai hoc", "Khoa hoc", "Tong so bao cao", "Dang mo", "Da xu ly", "Ly do pho bien nhat");
        writeHeader(workbook, lessonSheet, lessonHeaders);

        int rowNum = 1;
        for (ReportedLessonItem item : data.mostReportedLessons()) {
            Row row = lessonSheet.createRow(rowNum++);
            setNumber(row, 0, item.rank());
            setText(row, 1, item.lessonTitle());
            setText(row, 2, item.courseName());
            setNumber(row, 3, item.reportCount());
            setNumber(row, 4, item.openReports());
            setNumber(row, 5, item.resolvedReports());
            setText(row, 6, item.topReason());
        }
        autosize(lessonSheet, lessonHeaders.size());

        // Sheet 2: phân loại lý do.
        Sheet reasonSheet = workbook.createSheet("Ly do bao cao");
        List<String> reasonHeaders = List.of("Ly do", "So bao cao", "Ty le (%)");
        writeHeader(workbook, reasonSheet, reasonHeaders);

        rowNum = 1;
        for (ReportReasonBucket bucket : data.reportReasons()) {
            Row row = reasonSheet.createRow(rowNum++);
            setText(row, 0, bucket.reason());
            setNumber(row, 1, bucket.count());
            setNumber(row, 2, bucket.percentage());
        }
        autosize(reasonSheet, reasonHeaders.size());

        // Sheet 3: câu hỏi chưa trả lời.
        Sheet questionSheet = workbook.createSheet("Cau hoi chua tra loi");
        List<String> questionHeaders = List.of(
                "Bai hoc", "Hoc vien", "Noi dung cau hoi", "Ngay hoi", "So gio cho");
        writeHeader(workbook, questionSheet, questionHeaders);

        rowNum = 1;
        for (UnansweredQuestionItem item : data.unansweredQuestions()) {
            Row row = questionSheet.createRow(rowNum++);
            setText(row, 0, item.lessonTitle());
            setText(row, 1, item.studentName());
            setText(row, 2, truncate(item.content()));
            setText(row, 3, item.createdAt() == null ? null : item.createdAt().toString());
            setNumber(row, 4, item.waitingHours());
        }
        autosize(questionSheet, questionHeaders.size());
    }

    private void writeExamSheet(Workbook workbook, CourseExamAnalyticsResponse data) {
        Sheet sheet = workbook.createSheet("Bai thi");
        List<String> headers = List.of(
                "Bai thi", "Danh muc", "Diem toi da", "Diem dat", "Tong luot thi", "Luot da cham",
                "Nguoi thi", "Diem TB", "Diem cao nhat", "Diem thap nhat", "Luot dat", "Ty le dat (%)");
        writeHeader(workbook, sheet, headers);

        int rowNum = 1;
        for (ExamAnalyticsItem item : data.exams()) {
            Row row = sheet.createRow(rowNum++);
            setText(row, 0, item.title());
            setText(row, 1, item.category());
            setNumber(row, 2, item.maxScore().doubleValue());
            setNumber(row, 3, item.passScore().doubleValue());
            setNumber(row, 4, item.totalAttempts());
            setNumber(row, 5, item.gradedAttempts());
            setNumber(row, 6, item.participants());
            setNullableNumber(row, 7, item.averageScore());
            setNullableNumber(row, 8, item.highestScore());
            setNullableNumber(row, 9, item.lowestScore());
            setNumber(row, 10, item.passedAttempts());
            setNullableNumber(row, 11, item.passRate());
        }
        autosize(sheet, headers.size());
    }

    // =====================================================================
    // Helper
    // =====================================================================

    private void writeHeader(Workbook workbook, Sheet sheet, List<String> headers) {
        Row row = sheet.createRow(0);
        CellStyle style = headerStyle(workbook);
        for (int i = 0; i < headers.size(); i++) {
            Cell cell = row.createCell(i);
            cell.setCellValue(headers.get(i));
            cell.setCellStyle(style);
        }
        sheet.createFreezePane(0, 1);
    }

    private int addRow(Sheet sheet, int rowNum, CellStyle labelStyle, CellStyle valueStyle,
                       String label, Object value) {
        Row row = sheet.createRow(rowNum);
        Cell labelCell = row.createCell(0);
        labelCell.setCellValue(label);
        labelCell.setCellStyle(labelStyle);

        Cell valueCell = row.createCell(1);
        if (value == null) {
            valueCell.setCellValue("—");
        } else if (value instanceof Number number) {
            valueCell.setCellValue(number.doubleValue());
        } else {
            valueCell.setCellValue(String.valueOf(value));
        }
        valueCell.setCellStyle(valueStyle);
        return rowNum + 1;
    }

    private static void setText(Row row, int column, String value) {
        Cell cell = row.createCell(column);
        cell.setCellValue(value == null ? "" : truncate(value));
    }

    private static void setNumber(Row row, int column, double value) {
        Cell cell = row.createCell(column);
        cell.setCellValue(value);
    }

    private static void setNumber(Row row, int column, long value) {
        Cell cell = row.createCell(column);
        cell.setCellValue(value);
    }

    private static void setNullableNumber(Row row, int column, Double value) {
        Cell cell = row.createCell(column);
        if (value == null) {
            cell.setCellValue("");
        } else {
            cell.setCellValue(value);
        }
    }

    private static void setBlank(Row row, int column) {
        row.createCell(column).setCellValue("");
    }

    private static String truncate(String value) {
        if (value == null) {
            return "";
        }
        String flat = value.strip().replaceAll("\\s+", " ");
        return flat.length() <= MAX_LABEL_LENGTH ? flat : flat.substring(0, MAX_LABEL_LENGTH - 1) + "…";
    }

    private static void autosize(Sheet sheet, int columns) {
        for (int i = 0; i < columns; i++) {
            sheet.autoSizeColumn(i);
            if (sheet.getColumnWidth(i) > 12000) {
                sheet.setColumnWidth(i, 12000);
            }
        }
    }

    private static CellStyle headerStyle(Workbook workbook) {
        CellStyle style = workbook.createCellStyle();
        Font font = workbook.createFont();
        font.setBold(true);
        font.setColor(IndexedColors.WHITE.getIndex());
        style.setFont(font);
        style.setFillForegroundColor(IndexedColors.DARK_BLUE.getIndex());
        style.setFillPattern(FillPatternType.SOLID_FOREGROUND);
        style.setAlignment(HorizontalAlignment.CENTER);
        style.setVerticalAlignment(VerticalAlignment.CENTER);
        style.setBorderBottom(BorderStyle.THIN);
        return style;
    }

    private static CellStyle titleStyle(Workbook workbook) {
        CellStyle style = workbook.createCellStyle();
        Font font = workbook.createFont();
        font.setBold(true);
        font.setFontHeightInPoints((short) 14);
        style.setFont(font);
        return style;
    }

    private static CellStyle labelStyle(Workbook workbook) {
        CellStyle style = workbook.createCellStyle();
        Font font = workbook.createFont();
        font.setBold(true);
        style.setFont(font);
        style.setFillForegroundColor(IndexedColors.GREY_25_PERCENT.getIndex());
        style.setFillPattern(FillPatternType.SOLID_FOREGROUND);
        return style;
    }

    private static CellStyle valueStyle(Workbook workbook) {
        CellStyle style = workbook.createCellStyle();
        style.setVerticalAlignment(VerticalAlignment.CENTER);
        return style;
    }
}
