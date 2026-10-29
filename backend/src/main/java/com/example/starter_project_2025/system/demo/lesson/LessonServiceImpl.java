package com.example.starter_project_2025.system.demo.lesson;

import com.example.starter_project_2025.base.crud.domain.BaseCrudRepository;
import com.example.starter_project_2025.base.crud.mapper.BaseCrudMapper;
import com.example.starter_project_2025.base.crud.service.BaseCrudServiceImpl;
import com.example.starter_project_2025.base.crud.validation.ValidationContext;
import com.example.starter_project_2025.system.demo.certificate.CertificateRepository;
import com.example.starter_project_2025.system.demo.course.Course;
import com.example.starter_project_2025.system.demo.section.Section;
import com.example.starter_project_2025.system.demo.section.SectionRepository;
import com.example.starter_project_2025.system.demo.course.CourseStatus;
import com.example.starter_project_2025.system.demo.enrollment.CourseEnrollment;
import com.example.starter_project_2025.system.demo.enrollment.CourseEnrollmentRepository;
import com.example.starter_project_2025.system.notification.NotificationService;
import com.example.starter_project_2025.security.UserPrincipal;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.net.URI;
import java.net.URISyntaxException;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.Set;

@Service
@Transactional
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class LessonServiceImpl
        extends BaseCrudServiceImpl<Lesson, Long, LessonDTO, LessonFilter>
        implements LessonService {

    LessonRepository lessonRepository;
    LessonMapper lessonMapper;
    SectionRepository sectionRepository;
    CourseContentAccessGuard contentAccessGuard;
    CourseEnrollmentRepository enrollmentRepository;
    NotificationService notificationService;
    CertificateRepository certificateRepository;

    private static final ThreadLocal<List<String>> PENDING_CHANGES = new ThreadLocal<>();

    @Override
    protected BaseCrudRepository<Lesson, Long> getRepository() {
        return lessonRepository;
    }

    @Override
    protected BaseCrudMapper<Lesson, LessonDTO> getMapper() {
        return lessonMapper;
    }

    @Override
    protected String[] searchableFields() {
        return new String[]{"title", "textContent"};
    }

    @Override
    public LessonDTO getById(Long id) {
        LessonDTO lesson = super.getById(id);
        assertCanReadContent(lesson);
        return lesson;
    }

    @Override
    public Page<LessonDTO> getAll(Pageable pageable, String search, LessonFilter filter) {
        Page<LessonDTO> lessons = super.getAll(pageable, search, filter);
        lessons.forEach(this::assertCanReadContent);
        return lessons;
    }

    @Override
    protected void beforeCreate(Lesson lesson, LessonDTO request, ValidationContext ctx) {
        Long sectionId = request.getSectionId();

        if (sectionId == null) {
            ctx.add("sectionId", "Section ID is required");
        } else {
            Section section = sectionRepository.findById(sectionId).orElse(null);
            if (section == null) {
                ctx.add("sectionId", "Section not found");
            } else {
                lesson.setSection(section);
            }
        }

        normalizeTitle(request, ctx);
        if (request.getTitle() != null) {
            lesson.setTitle(request.getTitle());
        }
        normalizeUrl(request);
        if (request.getContentUrl() != null) {
            lesson.setContentUrl(request.getContentUrl());
        }
        if (lesson.getIsActive() == null) {
            lesson.setIsActive(true);
        }
        validateContent(request.getContentType(), request.getContentUrl(),
                request.getTextContent(), ctx);
        if (sectionId != null) {
            validateOrderIndex(sectionId, request.getOrderIndex(), null, ctx);
        }
    }

    @Override
    protected void beforeUpdate(Lesson lesson, LessonDTO request, ValidationContext ctx) {
        if (request.getSectionId() != null
                && !request.getSectionId().equals(lesson.getSection().getId())) {
            ctx.add("sectionId", "Cannot change section of a lesson");
        }

        normalizeTitle(request, ctx);
        normalizeUrl(request);

        if (request.getOrderIndex() != null
                && !request.getOrderIndex().equals(lesson.getOrderIndex())) {
            validateOrderIndex(lesson.getSection().getId(), request.getOrderIndex(),
                    lesson.getId(), ctx);
        }

        LessonContentType type = request.getContentType() != null
                ? request.getContentType() : lesson.getContentType();
        String url = request.getContentUrl() != null
                ? request.getContentUrl() : lesson.getContentUrl();
        String text = request.getTextContent() != null
                ? request.getTextContent() : lesson.getTextContent();

        validateContent(type, url, text, ctx);
        PENDING_CHANGES.set(detectChanges(lesson, request));
    }

    @Override
    public LessonDTO update(Long id, LessonDTO request) {
        try {
            return super.update(id, request);
        } finally {
            PENDING_CHANGES.remove();
        }
    }

    @Override
    protected void afterCreate(Lesson lesson, LessonDTO request) {
        notifyEnrolledStudents(
                lesson,
                "lesson-created:" + lesson.getId(),
                "New lesson available",
                abbreviate(lesson.getTitle(), 150) + " was added to "
                        + abbreviate(lesson.getSection().getCourse().getName(), 150) + "."
        );
    }

    @Override
    protected void afterUpdate(Lesson lesson, LessonDTO request) {
        List<String> changes = PENDING_CHANGES.get();
        if (changes == null || changes.isEmpty() || !Boolean.TRUE.equals(lesson.getIsActive())) {
            return;
        }
        notifyEnrolledStudents(
                lesson,
                "lesson-updated:" + lesson.getId() + ":" + System.currentTimeMillis(),
                "Lesson updated",
                abbreviate(lesson.getTitle(), 150) + " in "
                        + abbreviate(lesson.getSection().getCourse().getName(), 150)
                        + " was updated (" + String.join(", ", changes) + ")."
        );
    }

    @Override
    protected void afterDelete(Lesson lesson) {
        notifyEnrolledStudents(
                lesson,
                "lesson-deleted:" + lesson.getId() + ":" + System.currentTimeMillis(),
                "Lesson removed",
                abbreviate(lesson.getTitle(), 150) + " was removed from "
                        + abbreviate(lesson.getSection().getCourse().getName(), 150) + "."
        );
    }


    private void notifyEnrolledStudents(Lesson lesson, String eventKeyBase, String title, String message) {
        Course course = lesson.getSection().getCourse();
        if (course.getStatus() != CourseStatus.PUBLISHED) {
            return;
        }
        Set<Long> certifiedUserIds = certificateRepository.findUserIdsByCourseId(course.getId());
        for (CourseEnrollment enrollment : enrollmentRepository.findAllByCourse_Id(course.getId())) {
            Long userId = enrollment.getUser().getId();
            if (certifiedUserIds.contains(userId)) {
                continue;
            }
            notificationService.createOnce(
                    userId,
                    eventKeyBase + ":" + userId,
                    title,
                    message,
                    "/enrollments/" + enrollment.getId() + "/learn"
            );
        }
    }

    private static List<String> detectChanges(Lesson lesson, LessonDTO request) {
        List<String> changes = new ArrayList<>();
        if (request.getTitle() != null && !request.getTitle().equals(lesson.getTitle())) {
            changes.add("title");
        }
        if (request.getContentType() != null && request.getContentType() != lesson.getContentType()) {
            changes.add("content type");
        }
        if (request.getContentUrl() != null && !request.getContentUrl().equals(lesson.getContentUrl())) {
            changes.add("content link");
        }
        if (request.getTextContent() != null && !request.getTextContent().equals(lesson.getTextContent())) {
            changes.add("text content");
        }
        if (request.getDuration() != null && !request.getDuration().equals(lesson.getDuration())) {
            changes.add("duration");
        }
        if (request.getIsActive() != null && !request.getIsActive().equals(lesson.getIsActive())) {
            changes.add("visibility");
        }
        return changes;
    }

    private static String abbreviate(String value, int max) {
        if (value == null || value.length() <= max) {
            return value;
        }
        return value.substring(0, max - 3) + "...";
    }

    private void normalizeTitle(LessonDTO request, ValidationContext ctx) {
        if (request.getTitle() != null) {
            String title = request.getTitle().trim();
            request.setTitle(title);
            if (title.isEmpty()) {
                ctx.add("title", "Lesson title must not be blank");
            }
        }
    }

    private void normalizeUrl(LessonDTO request) {
        if (request.getContentUrl() != null) {
            request.setContentUrl(request.getContentUrl().trim());
        }
    }

    private void validateOrderIndex(Long sectionId, Integer orderIndex, Long editingId,
                                    ValidationContext ctx) {
        if (orderIndex == null) {
            return;
        }
        boolean duplicate = lessonRepository.findBySection_IdOrderByOrderIndexAsc(sectionId)
                .stream()
                .anyMatch(other -> !Objects.equals(other.getId(), editingId)
                        && Objects.equals(other.getOrderIndex(), orderIndex));
        if (duplicate) {
            ctx.add("orderIndex", "Order index already exists in this section");
        }
    }

    private static boolean isValidHttpUrl(String url) {
        try {
            URI uri = new URI(url);
            String scheme = uri.getScheme();
            return ("http".equalsIgnoreCase(scheme) || "https".equalsIgnoreCase(scheme))
                    && uri.getHost() != null && !uri.getHost().isBlank();
        } catch (URISyntaxException ex) {
            return false;
        }
    }

    private void validateContent(LessonContentType type, String url, String text,
                                 ValidationContext ctx) {
        if (type == null) {
            return;
        }
        boolean hasUrl = url != null && !url.isBlank();
        boolean hasText = text != null && !text.isBlank();

        switch (type) {
            case VIDEO, AUDIO, DOCUMENT, LINK -> {
                if (!hasUrl) {
                    ctx.add("contentUrl", "Content URL is required for " + type + " lessons");
                } else if (!isValidHttpUrl(url.trim())) {
                    ctx.add("contentUrl", "Content URL must be a valid http/https URL");
                }
            }
            case TEXT -> {
                if (!hasText) {
                    ctx.add("textContent", "Text content is required for TEXT lessons");
                }
            }
        }
    }

    private void assertCanReadContent(LessonDTO lesson) {
        Section section = sectionRepository.findById(lesson.getSectionId())
                .orElseThrow(() -> new IllegalStateException("Lesson section not found"));
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        UserPrincipal principal = authentication != null
                && authentication.getPrincipal() instanceof UserPrincipal userPrincipal
                ? userPrincipal
                : null;
        Long userId = principal == null || principal.getUser() == null
                ? null
                : principal.getUser().getId();
        boolean administrator = authentication != null
                && authentication.getAuthorities().stream()
                .anyMatch(authority -> "ROLE_ADMIN".equals(authority.getAuthority()));
        if (!contentAccessGuard.canAccess(section.getCourse(), userId, administrator)) {
            throw new AccessDeniedException("Enrollment required to access lesson content");
        }
    }
}
