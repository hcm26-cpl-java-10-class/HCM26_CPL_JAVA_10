package com.example.starter_project_2025.system.exam.service;

import com.example.starter_project_2025.base.dataio.importer.result.ImportResult;
import com.example.starter_project_2025.base.dataio.importer.result.RowError;
import com.example.starter_project_2025.system.exam.domain.Exam;
import com.example.starter_project_2025.system.exam.domain.ExamCategory;
import com.example.starter_project_2025.system.exam.domain.ExamRepository;
import com.example.starter_project_2025.system.exam.domain.ExamType;
import com.opencsv.CSVReader;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.apache.poi.ss.usermodel.Cell;
import org.apache.poi.ss.usermodel.CellType;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.ss.usermodel.Workbook;
import org.apache.poi.ss.usermodel.WorkbookFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.InputStream;
import java.io.InputStreamReader;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

/**
 * Service to import Assessments/Exams from CSV or Excel files.
 * Follows strict All-or-Nothing / Rollback pattern identical to QuestionImportService:
 * If any row fails validation or parsing, 0 exams are saved to the database.
 * All errors are aggregated so the user can fix the input file.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ExamImportService {

    private final ExamRepository examRepository;

    @Transactional
    public ImportResult importExams(MultipartFile file) {
        ImportResult result = new ImportResult();

        if (file == null || file.isEmpty()) {
            result.getErrors().add(new RowError(0, "File tải lên không được để trống."));
            result.setFailureCount(1);
            return result;
        }

        String originalFilename = file.getOriginalFilename() != null ? file.getOriginalFilename().toLowerCase() : "";
        boolean isCsv = originalFilename.endsWith(".csv");
        boolean isExcel = originalFilename.endsWith(".xlsx") || originalFilename.endsWith(".xls");

        if (!isCsv && !isExcel) {
            result.getErrors().add(new RowError(0, "Hệ thống chỉ hỗ trợ định dạng Excel (.xlsx, .xls) và CSV (.csv)"));
            result.setFailureCount(1);
            return result;
        }

        List<ExamRowData> rows;
        try {
            if (isCsv) {
                rows = parseCsv(file.getInputStream());
            } else {
                rows = parseExcel(file.getInputStream());
            }
        } catch (Exception e) {
            log.error("Failed to parse exam import file: {}", e.getMessage(), e);
            result.getErrors().add(new RowError(0, "Không thể đọc nội dung file: " + e.getMessage()));
            result.setFailureCount(1);
            return result;
        }

        result.setTotalCount(rows.size());

        if (rows.isEmpty()) {
            result.getErrors().add(new RowError(1, "File không chứa dòng dữ liệu nào hợp lệ"));
            result.setFailureCount(1);
            return result;
        }

        List<Exam> validExams = new ArrayList<>();
        Set<String> seenInFile = new HashSet<>();

        // Phase 1: Validate all rows and collect all errors
        for (ExamRowData row : rows) {
            int rowNumber = row.rowNumber;

            try {
                Exam exam = validateAndBuildExam(row, seenInFile);
                validExams.add(exam);
            } catch (Exception e) {
                result.getErrors().add(new RowError(rowNumber, e.getMessage()));
                result.setFailureCount(result.getFailureCount() + 1);
            }
        }

        // Phase 2: Atomic Rollback / Abort Check
        // If there are ANY errors, do NOT persist any exams (rollback all-or-nothing)
        if (!result.getErrors().isEmpty()) {
            log.warn("Import assessments bị hủy (Rollback): phát hiện {} dòng lỗi trong file '{}'",
                    result.getFailureCount(), originalFilename);
            result.setSuccessCount(0);
            return result;
        }

        // Phase 3: Persist all valid exams
        for (Exam exam : validExams) {
            try {
                examRepository.save(exam);
                result.setSuccessCount(result.getSuccessCount() + 1);
            } catch (Exception e) {
                log.error("Lỗi khi lưu đề thi vào CSDL — rollback toàn bộ import", e);
                throw new RuntimeException("Lỗi khi lưu vào CSDL: " + e.getMessage(), e);
            }
        }

        log.info("Import thành công {} đề thi từ file '{}'", result.getSuccessCount(), originalFilename);
        return result;
    }

    private Exam validateAndBuildExam(ExamRowData row, Set<String> seenInFile) {
        if (row.title == null || row.title.trim().isEmpty()) {
            throw new IllegalArgumentException("Exam title is required.");
        }
        String trimmedTitle = row.title.trim();
        if (trimmedTitle.length() > 200) {
            throw new IllegalArgumentException("Exam title must not exceed 200 characters.");
        }

        String titleKey = trimmedTitle.toLowerCase();
        if (!seenInFile.add(titleKey)) {
            throw new IllegalArgumentException("Đề thi bị trùng lặp tiêu đề với một dòng khác trong cùng file: " + trimmedTitle);
        }

        int duration = 60;
        if (row.durationMinutes != null && !row.durationMinutes.trim().isEmpty()) {
            try {
                duration = Integer.parseInt(row.durationMinutes.trim());
                if (duration <= 0 || duration > 1440) {
                    throw new IllegalArgumentException("Duration must be a positive integer between 1 and 1440 minutes.");
                }
            } catch (NumberFormatException e) {
                throw new IllegalArgumentException("Invalid duration: " + row.durationMinutes);
            }
        }

        ExamCategory category = parseCategory(row.category);
        ExamType examType = parseExamType(row.examType);

        BigDecimal maxScore = BigDecimal.TEN;
        if (row.maxScore != null && !row.maxScore.trim().isEmpty()) {
            try {
                maxScore = new BigDecimal(row.maxScore.trim());
                if (maxScore.compareTo(BigDecimal.ZERO) <= 0 || maxScore.compareTo(BigDecimal.valueOf(1000)) > 0) {
                    throw new IllegalArgumentException("Max score must be greater than 0 and at most 1000.");
                }
            } catch (NumberFormatException e) {
                throw new IllegalArgumentException("Invalid max score: " + row.maxScore);
            }
        }

        BigDecimal passScore = BigDecimal.valueOf(5.0);
        if (row.passScore != null && !row.passScore.trim().isEmpty()) {
            try {
                passScore = new BigDecimal(row.passScore.trim());
                if (passScore.compareTo(BigDecimal.ZERO) < 0 || passScore.compareTo(maxScore) > 0) {
                    throw new IllegalArgumentException("Pass score must be between 0 and " + maxScore);
                }
            } catch (NumberFormatException e) {
                throw new IllegalArgumentException("Invalid pass score: " + row.passScore);
            }
        }

        int maxAttempts = 1;
        if (row.maxAttempts != null && !row.maxAttempts.trim().isEmpty()) {
            try {
                maxAttempts = Integer.parseInt(row.maxAttempts.trim());
                if (maxAttempts <= 0) {
                    maxAttempts = 1;
                }
            } catch (NumberFormatException ignored) {}
        }

        boolean shuffleQ = parseBoolean(row.shuffleQuestions);
        boolean shuffleOpt = parseBoolean(row.shuffleOptions);
        boolean antiCheat = parseBoolean(row.antiCheatEnabled);

        Exam exam = new Exam();
        exam.setTitle(trimmedTitle);
        exam.setCategory(category);
        exam.setExamType(examType);
        exam.setDurationMinutes(duration);
        exam.setMaxScore(maxScore);
        exam.setPassScore(passScore);
        exam.setMaxAttempts(maxAttempts);
        exam.setShuffleQuestions(shuffleQ);
        exam.setShuffleOptions(shuffleOpt);
        exam.setAntiCheatEnabled(antiCheat);
        if (antiCheat) {
            exam.setDetectTabSwitch(true);
            exam.setBlockCopyPaste(true);
        }

        return exam;
    }

    private ExamCategory parseCategory(String value) {
        if (value == null || value.isBlank()) {
            return ExamCategory.ASSIGNMENT;
        }
        String normalized = value.trim().toUpperCase().replace(" ", "_").replace("-", "_");
        return switch (normalized) {
            case "ASSIGNMENT", "BAI_TAP", "BÀI_TẬP" -> ExamCategory.ASSIGNMENT;
            case "QUIZ", "QUIZZ" -> ExamCategory.QUIZ;
            case "MIDTERM", "GIUA_KY", "GIỮA_KỲ" -> ExamCategory.MIDTERM;
            case "FINAL", "FINAL_TEST", "CUOI_KY", "CUỐI_KỲ" -> ExamCategory.FINAL_TEST;
            default -> throw new IllegalArgumentException(
                    "Invalid category: " + value + " (Must be QUIZ, ASSIGNMENT, MIDTERM, or FINAL / FINAL_TEST)");
        };
    }

    private ExamType parseExamType(String value) {
        if (value == null || value.isBlank()) {
            return ExamType.MIXED;
        }
        String normalized = value.trim().toUpperCase().replace(" ", "_").replace("-", "_");
        return switch (normalized) {
            case "MULTIPLE_CHOICE", "MULTIPLE_CHOICE_ONLY", "TRAC_NGHIEM", "TRẮC_NGHIỆM" -> ExamType.MULTIPLE_CHOICE;
            case "ESSAY", "ESSAY_ONLY", "TU_LUAN", "TỰ_LUẬN" -> ExamType.ESSAY;
            case "CODING", "CODING_ONLY", "LAP_TRINH", "LẬP_TRÌNH" -> ExamType.CODING;
            case "MC_CODING", "MULTIPLE_CHOICE_AND_CODING" -> ExamType.MC_CODING;
            case "MIXED", "TONG_HOP", "TỔNG_HỢP" -> ExamType.MIXED;
            default -> throw new IllegalArgumentException(
                    "Invalid examType: " + value + " (Must be MULTIPLE_CHOICE, ESSAY, CODING, MC_CODING, or MIXED)");
        };
    }

    private boolean parseBoolean(String value) {
        if (value == null) return false;
        String trimmed = value.trim().toLowerCase();
        return "true".equals(trimmed) || "1".equals(trimmed) || "yes".equals(trimmed);
    }

    private List<ExamRowData> parseCsv(InputStream is) throws Exception {
        List<ExamRowData> rows = new ArrayList<>();
        try (CSVReader reader = new CSVReader(new InputStreamReader(is, StandardCharsets.UTF_8))) {
            List<String[]> allLines = reader.readAll();
            int startIdx = 0;
            if (!allLines.isEmpty() && isHeaderRow(allLines.get(0))) {
                startIdx = 1;
            }

            for (int i = startIdx; i < allLines.size(); i++) {
                String[] line = allLines.get(i);
                if (line.length == 0 || (line.length == 1 && line[0].trim().isEmpty())) {
                    continue;
                }
                rows.add(fromArray(i + 1, line));
            }
        }
        return rows;
    }

    private List<ExamRowData> parseExcel(InputStream is) throws Exception {
        List<ExamRowData> rows = new ArrayList<>();
        try (Workbook workbook = WorkbookFactory.create(is)) {
            Sheet sheet = workbook.getSheetAt(0);
            int startRow = 0;
            Row firstRow = sheet.getRow(0);
            if (firstRow != null && isHeaderRow(firstRow)) {
                startRow = 1;
            }

            for (int r = startRow; r <= sheet.getLastRowNum(); r++) {
                Row row = sheet.getRow(r);
                if (row == null || isBlankRow(row)) {
                    continue;
                }
                rows.add(fromExcelRow(r + 1, row));
            }
        }
        return rows;
    }

    private boolean isHeaderRow(String[] line) {
        if (line.length == 0) return false;
        String first = line[0].trim().toLowerCase();
        return first.contains("title") || first.contains("tên") || first.contains("name");
    }

    private boolean isHeaderRow(Row row) {
        Cell cell = row.getCell(0);
        if (cell == null) return false;
        String val = getCellString(cell).trim().toLowerCase();
        return val.contains("title") || val.contains("tên") || val.contains("name");
    }

    private boolean isBlankRow(Row row) {
        for (int c = row.getFirstCellNum(); c < row.getLastCellNum(); c++) {
            Cell cell = row.getCell(c);
            if (cell != null && cell.getCellType() != CellType.BLANK && !getCellString(cell).trim().isEmpty()) {
                return false;
            }
        }
        return true;
    }

    private ExamRowData fromArray(int rowNumber, String[] arr) {
        ExamRowData d = new ExamRowData();
        d.rowNumber = rowNumber;
        d.title = getOrNull(arr, 0);
        d.category = getOrNull(arr, 1);
        d.examType = getOrNull(arr, 2);
        d.durationMinutes = getOrNull(arr, 3);
        d.maxScore = getOrNull(arr, 4);
        d.passScore = getOrNull(arr, 5);
        d.maxAttempts = getOrNull(arr, 6);
        d.shuffleQuestions = getOrNull(arr, 7);
        d.shuffleOptions = getOrNull(arr, 8);
        d.antiCheatEnabled = getOrNull(arr, 9);
        return d;
    }

    private ExamRowData fromExcelRow(int rowNumber, Row row) {
        ExamRowData d = new ExamRowData();
        d.rowNumber = rowNumber;
        d.title = getCellString(row.getCell(0));
        d.category = getCellString(row.getCell(1));
        d.examType = getCellString(row.getCell(2));
        d.durationMinutes = getCellString(row.getCell(3));
        d.maxScore = getCellString(row.getCell(4));
        d.passScore = getCellString(row.getCell(5));
        d.maxAttempts = getCellString(row.getCell(6));
        d.shuffleQuestions = getCellString(row.getCell(7));
        d.shuffleOptions = getCellString(row.getCell(8));
        d.antiCheatEnabled = getCellString(row.getCell(9));
        return d;
    }

    private String getOrNull(String[] arr, int idx) {
        return idx < arr.length ? arr[idx].trim() : null;
    }

    private String getCellString(Cell cell) {
        if (cell == null) return "";
        return switch (cell.getCellType()) {
            case STRING -> cell.getStringCellValue().trim();
            case NUMERIC -> {
                double val = cell.getNumericCellValue();
                if (val == (long) val) {
                    yield String.valueOf((long) val);
                } else {
                    yield String.valueOf(val);
                }
            }
            case BOOLEAN -> String.valueOf(cell.getBooleanCellValue());
            case FORMULA -> {
                try {
                    yield cell.getStringCellValue();
                } catch (Exception e) {
                    yield String.valueOf(cell.getNumericCellValue());
                }
            }
            default -> "";
        };
    }

    private static class ExamRowData {
        int rowNumber;
        String title;
        String category;
        String examType;
        String durationMinutes;
        String maxScore;
        String passScore;
        String maxAttempts;
        String shuffleQuestions;
        String shuffleOptions;
        String antiCheatEnabled;
    }
}
