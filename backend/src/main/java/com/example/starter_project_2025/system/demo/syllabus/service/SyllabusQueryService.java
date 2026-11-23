package com.example.starter_project_2025.system.demo.syllabus.service;

import com.example.starter_project_2025.exception.BusinessValidationException;
import com.example.starter_project_2025.exception.ResourceNotFoundException;
import com.example.starter_project_2025.system.demo.syllabus.dto.SyllabusModels.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;
import com.example.starter_project_2025.system.demo.syllabus.entity.Syllabus;
import com.example.starter_project_2025.system.demo.syllabus.repository.SyllabusRepository;
import com.example.starter_project_2025.system.demo.syllabus.repository.SyllabusSectionRepository;
import com.example.starter_project_2025.system.demo.syllabus.repository.SyllabusTopicRepository;

/**
 * Query side of the Syllabus application service.
 * The controller still uses SyllabusService; this class only reads JPA entities
 * and maps them to response DTOs. It does not mutate persistent state.
 */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class SyllabusQueryService {

    private final SyllabusRepository syllabuses;
    private final SyllabusSectionRepository sections;
    private final SyllabusTopicRepository topics;
    private final SyllabusWorkflowService workflow;

    private static String clean(String raw) {
        return raw == null ? "" : raw.strip().replaceAll("(?U)\\s+", " ");
    }

    private Syllabus find(Long id) {
        return syllabuses.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Syllabus not found"));
    }

    public List<Summary> list(String query) {
        String q = clean(query);
        if (q.length() > 100) {
            throw new BusinessValidationException(Map.of("search", List.of("Search text is too long")));
        }

        return syllabuses.search(q).stream()
                .map(s -> {
                    var progress = workflow.progress(s.getId());
                    return new Summary(
                            s.getId(), s.getCode(), s.getName(), s.getDescription(),
                            sections.countBySyllabus_Id(s.getId()),
                            Boolean.TRUE.equals(s.getIsActive()),
                            progress.status().name(), progress.completionPercent()
                    );
                })
                .toList();
    }

    public Detail get(Long id) {
        Syllabus s = find(id);
        List<SectionView> content = sections.findBySyllabus_IdOrderByOrderIndexAsc(id)
                .stream()
                .map(sec -> new SectionView(
                        sec.getId(), sec.getTitle(), sec.getOrderIndex(), sec.getMission(),
                        topics.findBySection_IdOrderByOrderIndexAsc(sec.getId())
                                .stream()
                                .map(t -> new TopicView(t.getId(), t.getTitle(), t.getOrderIndex()))
                                .toList()
                ))
                .toList();
        var progress = workflow.progress(id);
        return new Detail(
                s.getId(), s.getCode(), s.getName(), s.getDescription(), content,
                Boolean.TRUE.equals(s.getIsActive()), progress.status().name(), progress.completionPercent()
        );
    }

    public InformationView getInformation(Long syllabusId) {
        return toInformationView(find(syllabusId));
    }

    /** Single mapper shared by reads and the response of updateInformation. */
    public InformationView toInformationView(Syllabus s) {
        return new InformationView(
                s.getId(), s.getCode(), s.getName(), s.getDescription(),
                s.getTeachingMethods(), s.getDegreeLevel(), s.getTimeAllocation(),
                s.getStudentResponsibilities(), s.getRequiredTools(), s.getScoringScale()
        );
    }
}
