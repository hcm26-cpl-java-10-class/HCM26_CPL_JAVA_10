package com.example.starter_project_2025.system.demo.course;

import com.example.starter_project_2025.base.dataio.importer.result.ImportResult;
import com.example.starter_project_2025.base.dataio.importer.result.ImportRolledBackException;
import com.example.starter_project_2025.base.dataio.importer.result.RowError;
import com.example.starter_project_2025.system.demo.category.Category;
import com.example.starter_project_2025.system.demo.category.CategoryRepository;
import com.example.starter_project_2025.system.demo.lesson.Lesson;
import com.example.starter_project_2025.system.demo.lesson.LessonContentType;
import com.example.starter_project_2025.system.demo.lesson.LessonRepository;
import com.example.starter_project_2025.system.demo.section.Section;
import com.example.starter_project_2025.system.demo.section.SectionRepository;
import com.example.starter_project_2025.system.rbac.user.User;
import com.example.starter_project_2025.system.rbac.user.UserRepository;
import lombok.RequiredArgsConstructor;
import org.apache.poi.ss.usermodel.DataFormatter;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.ss.usermodel.Workbook;
import org.apache.poi.ss.usermodel.WorkbookFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

@Service
@RequiredArgsConstructor
public class CourseBundleImportService {

    private final CourseRepository courseRepository;
    private final SectionRepository sectionRepository;
    private final LessonRepository lessonRepository;
    private final UserRepository userRepository;
    private final CategoryRepository categoryRepository;

    public boolean supports(MultipartFile file) {
        String name = file.getOriginalFilename();
        if (name == null || !name.toLowerCase(Locale.ROOT).endsWith(".xlsx")) return false;
        try (Workbook workbook = WorkbookFactory.create(file.getInputStream())) {
            return workbook.getSheet("Courses") != null
                    && workbook.getSheet("Sections") != null
                    && workbook.getSheet("Lessons") != null;
        } catch (Exception ignored) {
            return false;
        }
    }

    /**
     * Import tất cả hoặc không gì cả. Các sheet phụ thuộc nhau (Sections cần Courses, Lessons cần Sections),
     * nên sau khi một sheet có lỗi thì dừng, tránh sinh ra các lỗi dây chuyền gây hiểu nhầm.
     */
    @Transactional
    public ImportResult importBundle(MultipartFile file) {
        ImportResult result = new ImportResult();
        try (Workbook workbook = WorkbookFactory.create(file.getInputStream())) {
            importCourses(workbook.getSheet("Courses"), result);
            if (result.getFailureCount() == 0) {
                importSections(workbook.getSheet("Sections"), result);
            }
            if (result.getFailureCount() == 0) {
                importLessons(workbook.getSheet("Lessons"), result);
            }
        } catch (Exception exception) {
            throw new RuntimeException("Course bundle import failed: " + exception.getMessage(), exception);
        }
        if (result.getFailureCount() > 0) {
            throw new ImportRolledBackException(result);
        }
        return result;
    }

    private void importCourses(Sheet sheet, ImportResult result) {
        Map<String, Integer> columns = columns(sheet);
        for (int index = 1; index <= sheet.getLastRowNum(); index++) {
            Row row = sheet.getRow(index);
            if (row == null || value(row, columns, "Name").isBlank()) continue;
            try {
                String name = value(row, columns, "Name");
                Course course = courseRepository.findByName(name).orElseGet(Course::new);
                course.setName(name);
                course.setDescription(value(row, columns, "Description"));
                course.setInstructor(optionalValue(row, columns, "Instructor"));

                String instructorEmail = optionalValue(row, columns, "Instructor Email");
                if (instructorEmail != null) {
                    User instructor = userRepository.findByEmail(instructorEmail)
                            .orElseThrow(() -> new IllegalArgumentException("instructor was not found: " + instructorEmail));
                    course.setInstructorUser(instructor);
                    course.setInstructor(instructor.getFullName());
                }

                Set<Category> categories = new HashSet<>();
                String categoryCodes = optionalValue(row, columns, "Category Codes");
                if (categoryCodes != null && !categoryCodes.isBlank()) {
                    String[] codes = categoryCodes.split("[,;|]");
                    for (String rawCode : codes) {
                        String code = rawCode.trim();
                        if (code.isEmpty()) continue;
                        Category category = categoryRepository.findByCodeIgnoreCase(code)
                                .orElseThrow(() -> new IllegalArgumentException("category was not found: " + code));
                        categories.add(category);
                    }
                }

                course.setCategories(categories);

                course.setThumbnailUrl(optionalValue(row, columns, "Thumbnail URL"));
                course.setStatus(enumValue(value(row, columns, "Status"), CourseStatus.class, CourseStatus.PUBLISHED));
                course.setLevel(enumValue(value(row, columns, "Level"), CourseLevel.class, CourseLevel.BEGINNER));
                course.setIsActive(booleanValue(row, columns, "Active", true));

                courseRepository.saveAndFlush(course);
                success(result);
            } catch (Exception exception) {
                failure(result, index + 1, "Courses: " + ImportRolledBackException.describe(exception));
                if (ImportRolledBackException.isPersistenceFailure(exception)) return;
            }
        }
    }

    private void importSections(Sheet sheet, ImportResult result) {
        Map<String, Integer> columns = columns(sheet);
        for (int index = 1; index <= sheet.getLastRowNum(); index++) {
            Row row = sheet.getRow(index);
            if (row == null || value(row, columns, "Course Name").isBlank()) continue;
            try {
                Course course = courseRepository.findByName(value(row, columns, "Course Name"))
                        .orElseThrow(() -> new IllegalArgumentException("course was not found"));

                String title = value(row, columns, "Section Title");
                Section section = sectionRepository.findByCourse_IdOrderByOrderIndexAsc(course.getId()).stream()
                        .filter(item -> title.equalsIgnoreCase(item.getTitle()))
                        .findFirst()
                        .orElseGet(Section::new);

                section.setCourse(course);
                section.setTitle(title);
                section.setOrderIndex(integerValue(row, columns, "Order Index", 0));
                section.setIsActive(booleanValue(row, columns, "Active", true));
                sectionRepository.saveAndFlush(section);
                success(result);
            } catch (Exception exception) {
                failure(result, index + 1, "Sections: " + ImportRolledBackException.describe(exception));
                if (ImportRolledBackException.isPersistenceFailure(exception)) return;
            }
        }
    }

    private void importLessons(Sheet sheet, ImportResult result) {
        Map<String, Integer> columns = columns(sheet);
        for (int index = 1; index <= sheet.getLastRowNum(); index++) {
            Row row = sheet.getRow(index);
            if (row == null || value(row, columns, "Course Name").isBlank()) continue;
            try {
                Course course = courseRepository.findByName(value(row, columns, "Course Name"))
                        .orElseThrow(() -> new IllegalArgumentException("course was not found"));

                String sectionTitle = value(row, columns, "Section Title");
                Section section = sectionRepository.findByCourse_IdOrderByOrderIndexAsc(course.getId()).stream()
                        .filter(item -> sectionTitle.equalsIgnoreCase(item.getTitle()))
                        .findFirst()
                        .orElseThrow(() -> new IllegalArgumentException("section was not found"));

                String title = value(row, columns, "Lesson Title");
                List<Lesson> existing = lessonRepository.findBySection_IdOrderByOrderIndexAsc(section.getId());
                Lesson lesson = existing.stream()
                        .filter(item -> title.equalsIgnoreCase(item.getTitle()))
                        .findFirst()
                        .orElseGet(Lesson::new);

                lesson.setSection(section);
                lesson.setTitle(title);
                lesson.setContentType(enumValue(value(row, columns, "Content Type"), LessonContentType.class, LessonContentType.VIDEO));
                lesson.setContentUrl(optionalValue(row, columns, "Content URL"));
                lesson.setTextContent(optionalValue(row, columns, "Text Content"));
                lesson.setDuration(nullableIntegerValue(row, columns, "Duration (seconds)"));
                lesson.setOrderIndex(integerValue(row, columns, "Order Index", 0));
                lesson.setIsActive(booleanValue(row, columns, "Active", true));

                lessonRepository.saveAndFlush(lesson);
                success(result);
            } catch (Exception exception) {
                failure(result, index + 1, "Lessons: " + ImportRolledBackException.describe(exception));
                if (ImportRolledBackException.isPersistenceFailure(exception)) return;
            }
        }
    }

    private Map<String, Integer> columns(Sheet sheet) {
        if (sheet == null || sheet.getRow(0) == null) {
            throw new IllegalArgumentException("required sheet or header row is missing");
        }
        Map<String, Integer> columns = new HashMap<>();
        DataFormatter formatter = new DataFormatter();
        for (var cell : sheet.getRow(0)) {
            columns.put(formatter.formatCellValue(cell).trim(), cell.getColumnIndex());
        }
        return columns;
    }

    private String value(Row row, Map<String, Integer> columns, String name) {
        Integer index = columns.get(name);
        if (index == null) throw new IllegalArgumentException("missing column '" + name + "'");
        return new DataFormatter().formatCellValue(row.getCell(index)).trim();
    }

    private String optionalValue(Row row, Map<String, Integer> columns, String name) {
        Integer index = columns.get(name);
        if (index == null) return null;
        String result = new DataFormatter().formatCellValue(row.getCell(index)).trim();
        return result.isBlank() ? null : result;
    }

    private int integerValue(Row row, Map<String, Integer> columns, String name, int fallback) {
        String raw = optionalValue(row, columns, name);
        return raw == null ? fallback : (int) Double.parseDouble(raw);
    }

    private Integer nullableIntegerValue(Row row, Map<String, Integer> columns, String name) {
        String raw = optionalValue(row, columns, name);
        return raw == null ? null : (int) Double.parseDouble(raw);
    }

    private boolean booleanValue(Row row, Map<String, Integer> columns, String name, boolean fallback) {
        String raw = optionalValue(row, columns, name);
        return raw == null ? fallback : Boolean.parseBoolean(raw);
    }

    private <E extends Enum<E>> E enumValue(String raw, Class<E> type, E fallback) {
        return raw.isBlank() ? fallback : Enum.valueOf(type, raw.toUpperCase(Locale.ROOT));
    }

    private void success(ImportResult result) {
        result.setSuccessCount(result.getSuccessCount() + 1);
    }

    private void failure(ImportResult result, int row, String message) {
        result.setFailureCount(result.getFailureCount() + 1);
        result.getErrors().add(new RowError(row, message));
    }
}