package com.example.starter_project_2025.system.learning.habits;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.LocalDate;
import java.util.List;
import java.util.Objects;
import static com.example.starter_project_2025.system.learning.habits.HabitDtos.*;
import static com.example.starter_project_2025.system.learning.habits.HabitPolicy.*;

@Service
@RequiredArgsConstructor
class HabitObjectives {
    private final HabitObjectiveRepository objectives;
    private final HabitPolicy policy;

    @Transactional(readOnly = true)
    public List<Objective> list(Long owner, LocalDate week, Boolean completed) {
        LocalDate monday = week == null ? periodStart(policy.today(), GoalPeriod.WEEKLY) : requireWeek(week);
        return objectives.findByOwnerIdAndWeekStartOrderByDisplayOrderAscIdAsc(owner, monday).stream()
            .filter(row -> completed == null || completed == (row.completedAt != null))
            .map(this::view).toList();
    }

    @Transactional
    public Objective save(Long owner, Long id, boolean canRead, ObjectiveInput input) {
        policy.lockOwner(owner);
        HabitObjective row = id == null ? new HabitObjective() : owned(owner, id);
        if (id != null) checkVersion(input.version(), row.version);
        LocalDate week = requireWeek(input.weekStart());
        validDate(input.targetDate());
        if (input.targetDate() != null && !periodStart(input.targetDate(), GoalPeriod.WEEKLY).equals(week)) {
            throw bad("Target date must be in the selected week");
        }
        if (!Objects.equals(row.courseId, input.courseId())) {
            CourseOption course = policy.course(owner, input.courseId(), canRead);
            row.courseId = course.id();
            row.courseName = course.name();
        }
        row.ownerId = owner;
        row.title = input.title().strip();
        row.description = optional(input.description());
        row.weekStart = week;
        row.targetDate = input.targetDate();
        row.displayOrder = input.displayOrder();
        return view(objectives.saveAndFlush(row));
    }

    @Transactional
    public Objective status(Long owner, Long id, ObjectiveStatus input) {
        policy.lockOwner(owner);
        HabitObjective row = owned(owner, id);
        if (input.completed() != (row.completedAt != null)) {
            checkVersion(input.version(), row.version);
            row.completedAt = input.completed() ? policy.now() : null;
            objectives.flush();
        }
        return view(row);
    }

    @Transactional
    public void delete(Long owner, Long id, long version) {
        policy.lockOwner(owner);
        HabitObjective row = owned(owner, id);
        checkVersion(version, row.version);
        objectives.delete(row);
    }

    private LocalDate requireWeek(LocalDate day) {
        validDate(day);
        if (!day.equals(periodStart(day, GoalPeriod.WEEKLY))) throw bad("Select the Monday of the week");
        return day;
    }

    private HabitObjective owned(Long owner, Long id) {
        return objectives.findByIdAndOwnerId(id, owner).orElseThrow(HabitPolicy::missing);
    }

    private Objective view(HabitObjective row) {
        return new Objective(row.id, row.version, row.courseId, row.courseName, row.title, row.description,
            row.weekStart, row.targetDate, row.completedAt, row.displayOrder);
    }
}
