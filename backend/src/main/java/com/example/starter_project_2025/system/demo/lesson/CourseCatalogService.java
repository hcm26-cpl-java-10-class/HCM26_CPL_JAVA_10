package com.example.starter_project_2025.system.demo.lesson;

import com.example.starter_project_2025.exception.ResourceNotFoundException;
import com.example.starter_project_2025.system.demo.category.Category;
import com.example.starter_project_2025.system.demo.category.CategoryRepository;
import com.example.starter_project_2025.system.demo.course.Course;
import com.example.starter_project_2025.system.demo.course.CourseLevel;
import com.example.starter_project_2025.system.demo.course.CourseRepository;
import com.example.starter_project_2025.system.demo.course.CourseStatus;
import com.example.starter_project_2025.system.demo.enrollment.CourseEnrollment;
import com.example.starter_project_2025.system.demo.enrollment.CourseEnrollmentRepository;
import com.example.starter_project_2025.system.demo.section.Section;
import com.example.starter_project_2025.system.demo.section.SectionRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Catalog khóa học cho người học:
 * - Danh sách: chỉ khóa PUBLISHED (và active), hỗ trợ search, lọc Category/Level, phân trang.
 * - Chi tiết: kèm Section/Lesson, ẩn contentUrl/textContent nếu user chưa ghi danh.
 */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class CourseCatalogService {

    static final int MAX_PAGE_SIZE = 50;
    private static final Set<String> SORTABLE_FIELDS = Set.of("name", "createdAt", "updatedAt");

    private final CourseRepository courseRepository;
    private final CategoryRepository categoryRepository;
    private final SectionRepository sectionRepository;
    private final LessonRepository lessonRepository;
    private final CourseEnrollmentRepository enrollmentRepository;
    private final CourseContentAccessGuard contentAccessGuard;

    // ------------------------------------------------------------------ catalog list

    /**
     * @param categoryId lọc theo danh mục; nếu là danh mục cha thì gồm cả các danh mục con
     */
    public Page<CatalogCourseDTO> search(
            String keyword,
            Long categoryId,
            CourseLevel level,
            Pageable pageable,
            Long userId
    ) {
        Pageable safePageable = sanitize(pageable);

        Set<Long> categoryIds = null;
        if (categoryId != null) {
            categoryIds = collectCategoryIds(categoryId);
            if (categoryIds.isEmpty()) {
                return Page.empty(safePageable);
            }
        }

        Specification<Course> spec = buildSpec(keyword, categoryIds, level);
        Page<Course> page = courseRepository.findAll(spec, safePageable);
        if (page.isEmpty()) {
            return new PageImpl<>(List.of(), safePageable, page.getTotalElements());
        }

        List<Long> courseIds = page.getContent().stream().map(Course::getId).toList();
        Map<Long, CourseLessonStats> stats = lessonRepository.findStatsByCourseIds(courseIds).stream()
                .collect(Collectors.toMap(CourseLessonStats::courseId, s -> s));
        Set<Long> enrolledIds = enrolledCourseIds(userId);

        return page.map(course -> {
            CourseLessonStats courseStats = stats.get(course.getId());
            Category category = course.getCategory();
            return new CatalogCourseDTO(
                    course.getId(),
                    course.getName(),
                    course.getDescription(),
                    course.getThumbnailUrl(),
                    course.getInstructor(),
                    category == null ? null : category.getId(),
                    category == null ? null : category.getName(),
                    course.getLevel(),
                    courseStats == null ? 0 : courseStats.lessonCount(),
                    courseStats == null ? 0 : courseStats.totalDuration(),
                    Boolean.TRUE.equals(course.getIsFree()),
                    enrolledIds.contains(course.getId())
            );
        });
    }

    private Specification<Course> buildSpec(String keyword, Set<Long> categoryIds, CourseLevel level) {
        return (root, query, cb) -> {
            List<jakarta.persistence.criteria.Predicate> predicates = new ArrayList<>();

            // Chỉ lấy khóa đã xuất bản và đang active
            predicates.add(cb.equal(root.get("status"), CourseStatus.PUBLISHED));
            predicates.add(cb.isTrue(root.<Boolean>get("isActive")));

            if (level != null) {
                predicates.add(cb.equal(root.get("level"), level));
            }
            if (categoryIds != null) {
                predicates.add(root.get("category").get("id").in(categoryIds));
            }
            if (keyword != null && !keyword.isBlank()) {
                String like = "%" + escapeLike(keyword.trim().toLowerCase()) + "%";
                predicates.add(cb.or(
                        cb.like(cb.lower(root.<String>get("name")), like, '\\'),
                        cb.like(cb.lower(root.<String>get("description")), like, '\\'),
                        cb.like(cb.lower(root.<String>get("instructor")), like, '\\')
                ));
            }
            return cb.and(predicates.toArray(new jakarta.persistence.criteria.Predicate[0]));
        };
    }

    /** Danh mục được chọn cùng toàn bộ danh mục con (cháu...). Rỗng nếu danh mục không tồn tại. */
    private Set<Long> collectCategoryIds(Long categoryId) {
        List<Category> all = categoryRepository.findAll();
        Map<Long, List<Long>> childrenByParent = new HashMap<>();
        Set<Long> existing = new HashSet<>();
        for (Category category : all) {
            existing.add(category.getId());
            if (category.getParent() != null) {
                childrenByParent
                        .computeIfAbsent(category.getParent().getId(), k -> new ArrayList<>())
                        .add(category.getId());
            }
        }
        if (!existing.contains(categoryId)) {
            return Set.of();
        }

        Set<Long> result = new HashSet<>();
        List<Long> queue = new ArrayList<>(List.of(categoryId));
        while (!queue.isEmpty()) {
            Long current = queue.remove(queue.size() - 1);
            if (result.add(current)) {
                queue.addAll(childrenByParent.getOrDefault(current, List.of()));
            }
        }
        return result;
    }

    /** Giới hạn page size và chỉ cho sort theo field hợp lệ (tránh lỗi/lộ field nội bộ). */
    private Pageable sanitize(Pageable pageable) {
        int size = Math.min(Math.max(pageable.getPageSize(), 1), MAX_PAGE_SIZE);
        Sort sort = Sort.by(pageable.getSort().stream()
                .filter(order -> SORTABLE_FIELDS.contains(order.getProperty()))
                .toList());
        if (sort.isUnsorted()) {
            sort = Sort.by(Sort.Direction.DESC, "createdAt");
        }
        // id làm tiêu chí phụ để phân trang ổn định
        sort = sort.and(Sort.by(Sort.Direction.ASC, "id"));
        return PageRequest.of(Math.max(pageable.getPageNumber(), 0), size, sort);
    }

    private static String escapeLike(String value) {
        return value.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_");
    }

    private Set<Long> enrolledCourseIds(Long userId) {
        if (userId == null) {
            return Set.of();
        }
        return enrollmentRepository.findAllByUser_IdOrderByCreatedAtDesc(userId).stream()
                .map(CourseEnrollment::getCourse)
                .map(Course::getId)
                .collect(Collectors.toSet());
    }

    // ------------------------------------------------------------------ course detail

    /**
     * @param administrator người dùng có role ADMIN: xem được cả khóa chưa PUBLISHED.
     */
    public CourseDetailDTO getDetail(Long courseId, Long userId, boolean administrator) {
        Course course = courseRepository.findById(courseId)
                .filter(c -> administrator || contentAccessGuard.isOwner(c, userId)
                        || (c.getStatus() == CourseStatus.PUBLISHED
                        && Boolean.TRUE.equals(c.getIsActive())))
                .orElseThrow(() -> new ResourceNotFoundException("Course not found"));

        boolean enrolled = userId != null
                && enrollmentRepository.existsByUser_IdAndCourse_Id(userId, courseId);
        boolean unlocked = contentAccessGuard.canAccess(course, userId, administrator, enrolled);

        List<Section> sections = sectionRepository.findByCourse_IdOrderByOrderIndexAsc(courseId).stream()
                .filter(section -> Boolean.TRUE.equals(section.getIsActive()))
                .toList();

        Map<Long, List<CourseDetailDTO.LessonItem>> lessonsBySection = new LinkedHashMap<>();
        int lessonCount = 0;
        long totalDuration = 0;
        for (Lesson lesson : lessonRepository.findActiveByCourseIdOrdered(courseId)) {
            lessonsBySection
                    .computeIfAbsent(lesson.getSection().getId(), k -> new ArrayList<>())
                    .add(toLessonItem(lesson, unlocked));
            lessonCount++;
            totalDuration += lesson.getDuration() == null ? 0 : lesson.getDuration();
        }

        List<CourseDetailDTO.SectionItem> sectionItems = sections.stream()
                .map(section -> new CourseDetailDTO.SectionItem(
                        section.getId(),
                        section.getTitle(),
                        section.getOrderIndex(),
                        lessonsBySection.getOrDefault(section.getId(), List.of())))
                .toList();

        Category category = course.getCategory();
        return new CourseDetailDTO(
                course.getId(),
                course.getName(),
                course.getDescription(),
                course.getThumbnailUrl(),
                course.getInstructor(),
                category == null ? null : category.getId(),
                category == null ? null : category.getName(),
                course.getLevel(),
                Boolean.TRUE.equals(course.getIsFree()),
                enrolled,
                unlocked,
                lessonCount,
                totalDuration,
                sectionItems
        );
    }

    /** Lesson bị khóa: giữ metadata nhưng bỏ hẳn contentUrl/textContent khỏi response. */
    private CourseDetailDTO.LessonItem toLessonItem(Lesson lesson, boolean unlocked) {
        return new CourseDetailDTO.LessonItem(
                lesson.getId(),
                lesson.getTitle(),
                lesson.getContentType(),
                lesson.getDuration(),
                lesson.getOrderIndex(),
                !unlocked,
                unlocked ? lesson.getContentUrl() : null,
                unlocked ? lesson.getTextContent() : null
        );
    }
}
