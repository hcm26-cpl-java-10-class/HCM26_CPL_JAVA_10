package com.example.starter_project_2025.system.project.backlog_temp;

import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/**
 * Resolves the milestone a backlog item is linked to.
 * <p>
 * Business rule of UFR-PRJ-003-02: every backlog item belongs to a project and
 * may only be linked to a milestone of that same project. A milestone that does
 * not exist any more (deleted), was cancelled, or belongs to another project is
 * reported as not found (404, AC03) so the UI can ask the user to pick another
 * one while keeping the rest of the form data.
 */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class MilestoneLookup {

    MilestoneRepository milestoneRepository;

    /**
     * @param milestoneId milestone selected by the user, may be {@code null}
     *                    (a backlog item does not have to be linked)
     * @param projectId   project the backlog item belongs to
     * @return the milestone when it exists and can be linked
     * @throws TaskMilestoneNotFoundException when the milestone is unknown,
     *                                        cancelled or owned by another
     *                                        project
     */
    public Milestone requireLinkable(Long milestoneId, Long projectId) {

        if (milestoneId == null) {
            return null;
        }

        Milestone milestone = milestoneRepository.findById(milestoneId)
                .orElseThrow(TaskMilestoneNotFoundException::new);

        if (!milestone.isLinkable()
                || (projectId != null && !projectId.equals(milestone.getProjectId()))) {
            throw new TaskMilestoneNotFoundException();
        }

        return milestone;
    }

    /**
     * Milestones that can be linked, optionally restricted to one project.
     */
    public List<MilestoneOptionDTO> listLinkable(Long projectId) {

        List<Milestone> milestones = projectId == null
                ? milestoneRepository.findByStatusNotOrderByProjectIdAscNameAsc(MilestoneStatus.CANCELLED)
                : milestoneRepository.findByProjectIdAndStatusNotOrderByNameAsc(
                        projectId, MilestoneStatus.CANCELLED);

        return milestones.stream()
                .map(MilestoneOptionDTO::from)
                .toList();
    }
}
