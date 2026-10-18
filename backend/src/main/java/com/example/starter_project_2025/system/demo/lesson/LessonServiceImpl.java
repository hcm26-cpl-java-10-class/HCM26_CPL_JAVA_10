package com.example.starter_project_2025.system.demo.lesson;

import com.example.starter_project_2025.base.crud.domain.BaseCrudRepository;
import com.example.starter_project_2025.base.crud.mapper.BaseCrudMapper;
import com.example.starter_project_2025.base.crud.service.BaseCrudServiceImpl;
import com.example.starter_project_2025.base.crud.validation.ValidationContext;
import com.example.starter_project_2025.system.demo.section.Section;
import com.example.starter_project_2025.system.demo.section.SectionRepository;
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
        validateContent(request.getContentType(), request.getContentUrl(),
                request.getTextContent(), ctx);
    }

    @Override
    protected void beforeUpdate(Lesson lesson, LessonDTO request, ValidationContext ctx) {
        if (request.getSectionId() != null
                && !request.getSectionId().equals(lesson.getSection().getId())) {
            ctx.add("sectionId", "Cannot change section of a lesson");
        }

        normalizeTitle(request, ctx);

        // Gộp giá trị mới (nếu có) với giá trị hiện tại để kiểm tra nội dung
        LessonContentType type = request.getContentType() != null
                ? request.getContentType() : lesson.getContentType();
        String url = request.getContentUrl() != null
                ? request.getContentUrl() : lesson.getContentUrl();
        String text = request.getTextContent() != null
                ? request.getTextContent() : lesson.getTextContent();

        validateContent(type, url, text, ctx);
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

    private void validateContent(LessonContentType type, String url, String text,
                                 ValidationContext ctx) {
        if (type == null) {
            return;
        }
        boolean hasUrl = url != null && !url.isBlank();
        boolean hasText = text != null && !text.isBlank();

        switch (type) {
            case VIDEO, DOCUMENT, LINK -> {
                if (!hasUrl) {
                    ctx.add("contentUrl", "Content URL is required for " + type + " lessons");
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
