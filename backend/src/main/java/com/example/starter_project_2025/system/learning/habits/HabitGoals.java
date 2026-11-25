package com.example.starter_project_2025.system.learning.habits;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.LocalDate;
import java.util.List;
import static com.example.starter_project_2025.system.learning.habits.HabitDtos.*;
import static com.example.starter_project_2025.system.learning.habits.HabitPolicy.*;

@Service
@RequiredArgsConstructor
class HabitGoals {
    private final HabitGoalRepository goals;
    private final HabitTargetRepository targets;
    private final HabitPolicy policy;

    @Transactional(readOnly = true)
    public List<Goal> list(Long owner) {
        LocalDate today = policy.today();
        return goals.findByOwnerIdOrderByIdDesc(owner).stream().map(goal -> view(goal, today)).toList();
    }

    @Transactional
    public Goal save(Long owner, Long id, GoalInput input) {
        policy.lockOwner(owner);
        LocalDate today = policy.today();
        validDate(input.startDate());
        validDate(input.endDate());
        if (input.endDate() != null && input.endDate().isBefore(input.startDate())) {
            throw bad("End date must be on or after the start date");
        }
        if (input.targetMinutes() > (input.period() == GoalPeriod.WEEKLY ? 10080 : 44640)) {
            throw bad("Target exceeds the number of minutes in the period");
        }
        LocalDate current = periodStart(today, input.period());
        HabitGoal goal = id == null ? new HabitGoal() : owned(owner, id);
        if (id != null) {
            checkVersion(input.version(), goal.version);
            if (goal.archivedOn != null || goal.endDate != null && goal.endDate.isBefore(today)) {
                throw conflict("This goal has ended. Create a new target.");
            }
            if (goal.period != input.period()) throw bad("The period type of an existing goal cannot change");
            if (!goal.startDate.isAfter(today) && !goal.startDate.equals(input.startDate())) {
                throw bad("A goal that has started keeps its original start date");
            }
        }
        if ((id == null || !goal.startDate.equals(input.startDate())) && input.startDate().isBefore(current)) {
            throw bad("Start date must be in the current period or later");
        }
        if (input.endDate() != null && input.endDate().isBefore(today)) throw bad("End date cannot be in the past");

        boolean occupied = goals.findByOwnerIdOrderByIdDesc(owner).stream()
            .anyMatch(other -> !other.id.equals(id) && other.period == input.period()
                && other.archivedOn == null && (other.endDate == null || !other.endDate.isBefore(today)));
        if (occupied) throw conflict("There is already a target for this period type");

        if (id != null) snapshotThrough(goal, current.minusDays(1));
        goal.ownerId = owner;
        goal.period = input.period();
        goal.title = input.title().strip();
        goal.description = optional(input.description());
        goal.targetMinutes = input.targetMinutes();
        goal.startDate = input.startDate();
        goal.endDate = input.endDate();
        goal.historyFrom = current;
        return view(goals.saveAndFlush(goal), today);
    }

    @Transactional
    public Goal archive(Long owner, Long id, long version) {
        policy.lockOwner(owner);
        HabitGoal goal = owned(owner, id);
        if (goal.archivedOn != null) return view(goal, policy.today());
        checkVersion(version, goal.version);
        LocalDate today = policy.today();
        snapshotThrough(goal, today);
        goal.archivedOn = today;
        return view(goals.saveAndFlush(goal), today);
    }

    List<HabitGoal> entities(Long owner) { return goals.findByOwnerIdOrderByIdDesc(owner); }
    List<HabitGoalTarget> history(Long owner) { return targets.findByOwnerIdOrderByPeriodStartDesc(owner); }

    private HabitGoal owned(Long owner, Long id) {
        return goals.findByIdAndOwnerId(id, owner).orElseThrow(HabitPolicy::missing);
    }

    private void snapshotThrough(HabitGoal goal, LocalDate through) {
        LocalDate start = later(goal.historyFrom, periodStart(goal.startDate, goal.period));
        for (; !start.isAfter(through); start = nextPeriod(start, goal.period)) {
            HabitGoalTarget target = targetFor(goal, start);
            if (target == null) break;
            HabitGoalTarget snapshot = targets.findByOwnerIdAndPeriodAndPeriodStart(goal.ownerId, goal.period, start)
                .orElse(target);
            snapshot.goalId = goal.id;
            snapshot.title = target.title;
            snapshot.targetMinutes = target.targetMinutes;
            snapshot.fromDate = target.fromDate;
            snapshot.toDate = earlier(target.toDate, through);
            if (!snapshot.toDate.isBefore(snapshot.fromDate)) targets.save(snapshot);
        }
    }

    static HabitGoalTarget targetFor(HabitGoal goal, LocalDate start) {
        if (goal.archivedOn != null || start.isBefore(goal.historyFrom)) return null;
        LocalDate from = later(start, goal.startDate);
        LocalDate end = nextPeriod(start, goal.period).minusDays(1);
        if (goal.endDate != null) end = earlier(end, goal.endDate);
        if (end.isBefore(from)) return null;
        HabitGoalTarget target = new HabitGoalTarget();
        target.ownerId = goal.ownerId;
        target.goalId = goal.id;
        target.period = goal.period;
        target.periodStart = start;
        target.fromDate = from;
        target.toDate = end;
        target.title = goal.title;
        target.targetMinutes = goal.targetMinutes;
        return target;
    }

    static LocalDate later(LocalDate a, LocalDate b) { return a.isAfter(b) ? a : b; }
    static LocalDate earlier(LocalDate a, LocalDate b) { return a.isBefore(b) ? a : b; }

    private Goal view(HabitGoal goal, LocalDate today) {
        String status = "ACTIVE";
        if (goal.archivedOn != null) status = "ARCHIVED";
        else if (goal.startDate.isAfter(today)) status = "SCHEDULED";
        else if (goal.endDate != null && goal.endDate.isBefore(today)) status = "ENDED";
        return new Goal(goal.id, goal.version, goal.title, goal.description, goal.period,
            goal.targetMinutes, goal.startDate, goal.endDate, goal.archivedOn, status);
    }
}
