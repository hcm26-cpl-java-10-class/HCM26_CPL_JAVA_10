
package com.example.starter_project_2025.system.demo.syllabus;

import com.example.starter_project_2025.exception.BusinessValidationException;
import com.example.starter_project_2025.exception.ResourceNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
@Transactional
public class SyllabusWorkflowService {

    private final SyllabusRepository syllabuses;
    private final SyllabusSectionRepository sections;
    private final SyllabusTopicRepository topics;
    private final SyllabusCloRepository clos;
    private final SyllabusMaterialRepository materials;

    public record ProgressCheck(
            String key,
            String label,
            boolean complete
    ) {}

    public record ProgressView(
            Long syllabusId,
            SyllabusStatus status,
            int completionPercent,
            boolean canPublish,
            List<ProgressCheck> checks,
            List<String> missing
    ) {}

    private Syllabus find(Long id) {
        return syllabuses.findById(id)
                .orElseThrow(() ->
                        new ResourceNotFoundException(
                                "Syllabus not found"
                        )
                );
    }

    private static boolean filled(String value) {
        return value != null && !value.isBlank();
    }

    private ProgressView calculate(Syllabus syllabus) {
        Long id = syllabus.getId();

        var sectionList =
                sections.findBySyllabus_IdOrderByOrderIndexAsc(id);

        boolean informationReady =
                filled(syllabus.getDescription())
                        && filled(syllabus.getTeachingMethods())
                        && filled(syllabus.getDegreeLevel())
                        && filled(syllabus.getTimeAllocation())
                        && filled(syllabus.getStudentResponsibilities())
                        && filled(syllabus.getRequiredTools())
                        && syllabus.getScoringScale() != null;

        boolean sectionsReady = !sectionList.isEmpty();

        boolean topicsReady = sectionsReady
                && sectionList.stream().allMatch(section ->
                topics.countBySection_Id(section.getId()) > 0
        );

        boolean missionsReady = sectionsReady
                && sectionList.stream().allMatch(section ->
                filled(section.getMission())
        );

        List<ProgressCheck> checks = List.of(
                new ProgressCheck(
                        "information",
                        "General Information",
                        informationReady
                ),
                new ProgressCheck(
                        "clos",
                        "At least one CLO",
                        clos.countBySyllabus_Id(id) > 0
                ),
                new ProgressCheck(
                        "sections",
                        "At least one Section",
                        sectionsReady
                ),
                new ProgressCheck(
                        "topics",
                        "Every Section has a Topic",
                        topicsReady
                ),
                new ProgressCheck(
                        "missions",
                        "Every Section has a Mission",
                        missionsReady
                ),
                new ProgressCheck(
                        "materials",
                        "At least one Learning Material",
                        materials.countBySyllabus_Id(id) > 0
                )
        );

        List<String> missing = new ArrayList<>();

        for (ProgressCheck check : checks) {
            if (!check.complete()) {
                missing.add(check.label());
            }
        }

        long completed = checks.stream()
                .filter(ProgressCheck::complete)
                .count();

        int percent = (int) Math.round(
                completed * 100.0 / checks.size()
        );

        SyllabusStatus status =
                syllabus.getStatus() == null
                        ? SyllabusStatus.DRAFT
                        : syllabus.getStatus();

        return new ProgressView(
                id,
                status,
                percent,
                missing.isEmpty(),
                checks,
                missing
        );
    }

    @Transactional(readOnly = true)
    public ProgressView progress(Long syllabusId) {
        return calculate(find(syllabusId));
    }

    public void requireDraft(Long syllabusId) {
        Syllabus syllabus = find(syllabusId);

        if (syllabus.getStatus() == SyllabusStatus.PUBLISHED) {
            throw new BusinessValidationException(
                    Map.of(
                            "status",
                            List.of(
                                    "Published Syllabus is read-only. "
                                            + "Return it to Draft before editing."
                            )
                    )
            );
        }
    }

    public ProgressView publish(Long syllabusId) {
        Syllabus syllabus = find(syllabusId);
        ProgressView current = calculate(syllabus);

        if (!current.canPublish()) {
            throw new BusinessValidationException(
                    Map.of("status", current.missing())
            );
        }

        syllabus.setStatus(SyllabusStatus.PUBLISHED);
        syllabuses.saveAndFlush(syllabus);

        return calculate(syllabus);
    }

    public ProgressView returnToDraft(Long syllabusId) {
        Syllabus syllabus = find(syllabusId);

        syllabus.setStatus(SyllabusStatus.DRAFT);
        syllabuses.saveAndFlush(syllabus);

        return calculate(syllabus);
    }
}
