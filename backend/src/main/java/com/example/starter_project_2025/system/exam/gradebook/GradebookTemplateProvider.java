package com.example.starter_project_2025.system.exam.gradebook;

import com.example.starter_project_2025.system.exam.core.domain.Exam;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/**
 * Score columns + weights (%) of a course for students that have no row in the saved snapshot
 * (enrolled after the last Save, or the course was saved while its student list was empty).
 * Order: another student's snapshot rows -> the course-level columns of a saved gradebook -> empty.
 * Scores are left empty; they appear once the instructor saves again.
 */
@Component
@RequiredArgsConstructor
public class GradebookTemplateProvider {

    private final GradebookPublishedItemRepository publishedRepository;
    private final GradebookColumnRepository columnRepository;
    private final GradebookStateRepository stateRepository;

    @Transactional(readOnly = true)
    public List<GradebookPublishedItem> forCourse(Long courseId) {
        List<GradebookPublishedItem> fromSnapshot = publishedRepository.templateForCourse(courseId);
        if (!fromSnapshot.isEmpty()) return fromSnapshot;
        // the instructor never pressed Save -> nothing was published yet
        var state = stateRepository.findByCourse_Id(courseId);
        if (state.isEmpty() || state.get().getSavedAt() == null) return List.of();
        return columnRepository.findByCourse_IdOrderByPositionAscIdAsc(courseId).stream()
                .<GradebookPublishedItem>map(c -> {
                    Exam e = c.getSourceExam();
                    return GradebookPublishedItem.builder()
                            .course(c.getCourse())
                            .position(c.getPosition())
                            .columnType(c.getType())
                            .columnName(c.getName())
                            .examId(e == null ? null : e.getId())
                            .examTitle(e == null ? null : e.getTitle())
                            .weightPercent(c.getWeightPercent())
                            .score(null)
                            .build();
                })
                .toList();
    }
}
