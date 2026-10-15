package com.example.starter_project_2025.system.demo.lesson;

import com.example.starter_project_2025.base.crud.domain.BaseCrudRepository;
import com.example.starter_project_2025.base.crud.mapper.BaseCrudMapper;
import com.example.starter_project_2025.base.crud.service.BaseCrudServiceImpl;
import com.example.starter_project_2025.base.crud.validation.ValidationContext;
import com.example.starter_project_2025.system.demo.section.Section;
import com.example.starter_project_2025.system.demo.section.SectionRepository;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
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
}
