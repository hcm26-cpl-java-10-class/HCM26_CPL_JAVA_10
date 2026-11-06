
package com.example.starter_project_2025.system.demo.syllabus;

import com.example.starter_project_2025.exception.ResourceNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Locale;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class StudentSyllabusCatalogService {

    private final SyllabusRepository syllabuses;
    private final SyllabusSectionRepository sections;
    private final SyllabusTopicRepository topics;
    private final SyllabusCloRepository clos;
    private final SyllabusMaterialRepository materials;

    public record Item(
            Long id,
            String code,
            String name,
            String description,
            long sectionCount
    ) {}

    public record CatalogPage(
            List<Item> items,
            int page,
            int size,
            long totalElements,
            int totalPages
    ) {}

    public record TopicView(
            Long id,
            String title,
            Integer orderIndex
    ) {}

    public record SectionView(
            Long id,
            String title,
            Integer orderIndex,
            String mission,
            List<TopicView> topics
    ) {}

    public record CloView(
            Long id,
            String code,
            String details,
            Integer orderIndex
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

    public record Detail(
            Long id,
            String code,
            String name,
            String description,
            String teachingMethods,
            String degreeLevel,
            String timeAllocation,
            String studentResponsibilities,
            String requiredTools,
            Integer scoringScale,
            List<SectionView> sections,
            List<CloView> clos,
            List<MaterialView> materials
    ) {}

    // Search and pagination for Published syllabuses.
    public CatalogPage list(
            String rawQuery,
            String searchBy,
            String sortBy,
            int page
    ) {
        String query = rawQuery == null
                ? ""
                : rawQuery.strip();

        if (query.length() > 100) {
            query = query.substring(0, 100);
        }

        String field = switch (
                searchBy == null
                        ? ""
                        : searchBy.toLowerCase(Locale.ROOT)
                ) {
            case "code", "name" ->
                    searchBy.toLowerCase(Locale.ROOT);
            default -> "all";
        };

        String sortField =
                "code".equalsIgnoreCase(sortBy)
                        ? "code"
                        : "name";

        String pattern =
                "%" + query.toLowerCase(Locale.ROOT) + "%";

        Page<Syllabus> result =
                syllabuses.searchPublished(
                        SyllabusStatus.PUBLISHED,
                        query,
                        field,
                        pattern,
                        PageRequest.of(
                                Math.max(0, page),
                                9,
                                Sort.by(sortField)
                                        .ascending()
                                        .and(
                                                Sort.by("id")
                                                        .ascending()
                                        )
                        )
                );

        List<Item> items = result.getContent()
                .stream()
                .map(s -> new Item(
                        s.getId(),
                        s.getCode(),
                        s.getName(),
                        s.getDescription(),
                        sections.countBySyllabus_Id(
                                s.getId()
                        )
                ))
                .toList();

        return new CatalogPage(
                items,
                result.getNumber(),
                result.getSize(),
                result.getTotalElements(),
                result.getTotalPages()
        );
    }

    // Student detail:
    // Draft or inactive syllabus must not be exposed.
    public Detail detail(Long id) {

        Syllabus s = syllabuses.findById(id)
                .filter(value ->
                        value.getStatus()
                                == SyllabusStatus.PUBLISHED
                                && Boolean.TRUE.equals(
                                value.getIsActive()
                        )
                )
                .orElseThrow(
                        () -> new ResourceNotFoundException(
                                "Published Syllabus not found"
                        )
                );

        List<SectionView> sectionViews =
                sections.findBySyllabus_IdOrderByOrderIndexAsc(id)
                        .stream()
                        .map(section -> new SectionView(
                                section.getId(),
                                section.getTitle(),
                                section.getOrderIndex(),
                                section.getMission(),

                                topics.findBySection_IdOrderByOrderIndexAsc(
                                                section.getId()
                                        )
                                        .stream()
                                        .map(topic -> new TopicView(
                                                topic.getId(),
                                                topic.getTitle(),
                                                topic.getOrderIndex()
                                        ))
                                        .toList()
                        ))
                        .toList();

        List<CloView> cloViews =
                clos.findBySyllabus_IdOrderByOrderIndexAsc(id)
                        .stream()
                        .map(clo -> new CloView(
                                clo.getId(),
                                clo.getCode(),
                                clo.getDetails(),
                                clo.getOrderIndex()
                        ))
                        .toList();

        List<MaterialView> materialViews =
                materials.findBySyllabus_IdOrderByIdAsc(id)
                        .stream()
                        .map(material -> new MaterialView(
                                material.getId(),
                                material.getTitle(),
                                material.getType().name(),
                                material.getUrl(),
                                material.getAuthor(),
                                material.getPublisher(),
                                Boolean.TRUE.equals(
                                        material.getMainMaterial()
                                ),
                                material.getNote(),
                                material.getTopic() == null
                                        ? null
                                        : material.getTopic().getId()
                        ))
                        .toList();

        return new Detail(
                s.getId(),
                s.getCode(),
                s.getName(),
                s.getDescription(),
                s.getTeachingMethods(),
                s.getDegreeLevel(),
                s.getTimeAllocation(),
                s.getStudentResponsibilities(),
                s.getRequiredTools(),
                s.getScoringScale(),
                sectionViews,
                cloViews,
                materialViews
        );
    }
}
