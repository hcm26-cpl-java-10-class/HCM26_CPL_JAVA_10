package com.example.starter_project_2025.system.demo.syllabus;

import com.example.starter_project_2025.exception.BusinessValidationException;
import com.example.starter_project_2025.exception.ResourceNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.net.URI;
import java.net.URISyntaxException;
import java.util.List;
import java.util.Map;
import java.util.Objects;

@Service
@RequiredArgsConstructor
@Transactional
public class SyllabusMaterialService {

    private final SyllabusRepository syllabuses;
    private final SyllabusTopicRepository topics;
    private final SyllabusMaterialRepository materials;

    public record MaterialInput(
            String title,
            String type,
            String url,
            String author,
            String publisher,
            Boolean mainMaterial,
            String note,
            Long topicId
    ) {}

    public record MaterialView(
            Long id,
            String title,
            String type,
            String url,
            String author,
            String publisher,
            boolean mainMaterial,
            String note,
            Long topicId
    ) {}

    private static void fail(String field, String message) {
        throw new BusinessValidationException(
                Map.of(field, List.of(message))
        );
    }

    private static String clean(String raw) {
        return raw == null
                ? ""
                : raw.strip().replaceAll("(?U)\\s+", " ");
    }

    private static String text(
            String raw,
            String field,
            int max,
            boolean required
    ) {
        String value = clean(raw);

        if (required &&
                (value.length() < 3 ||
                        value.codePoints().noneMatch(Character::isLetter))) {
            fail(field, "Must contain letters and at least 3 characters");
        }

        if (value.length() > max) {
            fail(field, "Maximum " + max + " characters");
        }

        return value;
    }

    private static String validateUrl(String raw) {
        String value = raw == null ? "" : raw.strip();

        if (value.isEmpty() || value.length() > 2048) {
            fail("url", "URL is required (max 2048 characters)");
        }

        try {
            URI uri = new URI(value);

            String scheme = uri.getScheme();

            if (scheme == null ||
                    !(scheme.equalsIgnoreCase("https") ||
                            scheme.equalsIgnoreCase("http")) ||
                    uri.getHost() == null ||
                    uri.getUserInfo() != null) {
                fail("url", "Enter a valid HTTP or HTTPS URL");
            }

        } catch (URISyntaxException exception) {
            fail("url", "Invalid URL format");
        }

        return value;
    }

    private Syllabus requireSyllabus(Long id) {
        if (id == null || id <= 0) {
            fail("syllabusId", "Invalid Syllabus ID");
        }

        return syllabuses.findById(id)
                .orElseThrow(() ->
                        new ResourceNotFoundException(
                                "Syllabus not found"
                        )
                );
    }

    private SyllabusTopic resolveTopic(
            Long syllabusId,
            Long topicId
    ) {
        if (topicId == null) {
            return null;
        }

        SyllabusTopic topic = topics.findById(topicId)
                .orElseThrow(() ->
                        new ResourceNotFoundException(
                                "Topic not found"
                        )
                );

        Long parentId = topic.getSection()
                .getSyllabus()
                .getId();

        if (!Objects.equals(parentId, syllabusId)) {
            fail("topicId", "Topic belongs to another Syllabus");
        }

        return topic;
    }

    private SyllabusMaterial requireMaterial(
            Long syllabusId,
            Long materialId
    ) {
        SyllabusMaterial material =
                materials.findById(materialId)
                        .orElseThrow(() ->
                                new ResourceNotFoundException(
                                        "Learning Material not found"
                                )
                        );

        if (!Objects.equals(
                material.getSyllabus().getId(),
                syllabusId
        )) {
            throw new ResourceNotFoundException(
                    "Material does not belong to this Syllabus"
            );
        }

        return material;
    }

    private static MaterialView view(SyllabusMaterial material) {
        return new MaterialView(
                material.getId(),
                material.getTitle(),
                material.getType().name(),
                material.getUrl(),
                material.getAuthor(),
                material.getPublisher(),
                Boolean.TRUE.equals(material.getMainMaterial()),
                material.getNote(),
                material.getTopic() == null
                        ? null
                        : material.getTopic().getId()
        );
    }

    private void fill(
            SyllabusMaterial material,
            Long syllabusId,
            MaterialInput input
    ) {
        if (input == null) {
            fail("material", "Request body is required");
        }

        String title = text(input.title(), "title", 200, true);
        String url = validateUrl(input.url());

        if (input.type() == null) {
            fail("type", "Material type is required");
        }

        SyllabusMaterial.MaterialType type;

        try {
            type = SyllabusMaterial.MaterialType.valueOf(
                    input.type().strip().toUpperCase(java.util.Locale.ROOT)
            );
        } catch (IllegalArgumentException exception) {
            fail("type", "Unsupported material type");
            return;
        }

        SyllabusTopic topic = resolveTopic(
                syllabusId,
                input.topicId()
        );

        material.setTitle(title);
        material.setType(type);
        material.setUrl(url);
        material.setAuthor(text(input.author(), "author", 150, false));
        material.setPublisher(text(input.publisher(), "publisher", 150, false));
        material.setMainMaterial(Boolean.TRUE.equals(input.mainMaterial()));
        material.setNote(text(input.note(), "note", 1000, false));
        material.setTopic(topic);
    }

    @Transactional(readOnly = true)
    public List<MaterialView> list(Long syllabusId) {
        requireSyllabus(syllabusId);

        return materials.findBySyllabus_IdOrderByIdAsc(syllabusId)
                .stream()
                .map(SyllabusMaterialService::view)
                .toList();
    }

    public MaterialView create(
            Long syllabusId,
            MaterialInput input
    ) {
        Syllabus syllabus = requireSyllabus(syllabusId);

        SyllabusMaterial material = new SyllabusMaterial();
        material.setSyllabus(syllabus);

        fill(material, syllabusId, input);

        return view(materials.saveAndFlush(material));
    }

    public MaterialView update(
            Long syllabusId,
            Long materialId,
            MaterialInput input
    ) {
        SyllabusMaterial material =
                requireMaterial(syllabusId, materialId);

        fill(material, syllabusId, input);

        return view(materials.saveAndFlush(material));
    }

    public void delete(
            Long syllabusId,
            Long materialId
    ) {
        SyllabusMaterial material =
                requireMaterial(syllabusId, materialId);

        materials.delete(material);
    }
}