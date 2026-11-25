package com.example.starter_project_2025.system.learning.habits;

import com.example.starter_project_2025.exception.error.ErrorResponse;
import com.example.starter_project_2025.security.UserPrincipal;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Locale;
import static org.springframework.http.HttpStatus.*;
import static com.example.starter_project_2025.system.learning.habits.HabitDtos.*;
import static com.example.starter_project_2025.system.learning.habits.HabitPolicy.*;

@RestController
@RequestMapping("/api/learning/me")
@PreAuthorize("hasAuthority('LEARNER_ACCESS') and hasAuthority('LEARNING_SELF_READ')")
@RequiredArgsConstructor
public class HabitController {
    private final HabitGoals goals;
    private final HabitSessions sessions;
    private final HabitObjectives objectives;
    private final HabitStatistics statistics;
    private final HabitPolicy policy;

    @GetMapping("/study-courses")
    public List<CourseOption> courses(@AuthenticationPrincipal UserPrincipal principal) {
        return policy.courses(owner(principal), canReadCourses(principal));
    }

    @GetMapping("/goals")
    public List<Goal> goals(@AuthenticationPrincipal UserPrincipal principal) {
        return goals.list(owner(principal));
    }

    @PostMapping("/goals")
    @ResponseStatus(CREATED)
    public Goal createGoal(@AuthenticationPrincipal UserPrincipal principal, @Valid @RequestBody GoalInput input) {
        return goals.save(owner(principal), null, input);
    }

    @PutMapping("/goals/{id}")
    public Goal updateGoal(@AuthenticationPrincipal UserPrincipal principal, @PathVariable Long id,
                           @Valid @RequestBody GoalInput input) {
        return goals.save(owner(principal), id, input);
    }

    @PatchMapping("/goals/{id}/archive")
    public Goal archive(@AuthenticationPrincipal UserPrincipal principal, @PathVariable Long id,
                        @RequestParam long version) {
        return goals.archive(owner(principal), id, version);
    }

    @GetMapping("/goals/periods")
    public List<GoalProgress> goalHistory(@AuthenticationPrincipal UserPrincipal principal,
            @RequestParam(required = false) LocalDate from, @RequestParam(required = false) LocalDate to,
            @RequestParam(required = false) GoalPeriod type) {
        return statistics.history(owner(principal), from, to, type);
    }

    @GetMapping("/study-sessions")
    public History sessionHistory(@AuthenticationPrincipal UserPrincipal principal,
            @RequestParam(required = false) StudySource source, @RequestParam(required = false) LocalDate from,
            @RequestParam(required = false) LocalDate to, @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size) {
        return sessions.history(owner(principal), source, from == null ? EARLIEST : from,
            to == null ? policy.today() : to, page, size);
    }

    @GetMapping("/study-sessions/active")
    public ResponseEntity<Session> active(@AuthenticationPrincipal UserPrincipal principal) {
        var session = sessions.active(owner(principal));
        return session == null ? ResponseEntity.noContent().build() : ResponseEntity.ok(session);
    }

    @PostMapping("/study-sessions/start")
    @ResponseStatus(CREATED)
    public Session start(@AuthenticationPrincipal UserPrincipal principal, @Valid @RequestBody TimerInput input) {
        return sessions.start(owner(principal), canReadCourses(principal), input);
    }

    @PostMapping("/study-sessions/{id}/{action:pause|resume|finish|cancel}")
    public Session transition(@AuthenticationPrincipal UserPrincipal principal, @PathVariable Long id,
                              @PathVariable String action, @RequestParam long version) {
        return sessions.transition(owner(principal), id, version, HabitSessions.Action.valueOf(action.toUpperCase(Locale.ROOT)));
    }

    @PostMapping("/study-sessions/manual")
    @ResponseStatus(CREATED)
    public Session manual(@AuthenticationPrincipal UserPrincipal principal, @Valid @RequestBody StudyInput input) {
        return sessions.manual(owner(principal), canReadCourses(principal), input);
    }

    @PutMapping("/study-sessions/{id}")
    public Session editSession(@AuthenticationPrincipal UserPrincipal principal, @PathVariable Long id,
                               @Valid @RequestBody StudyInput input) {
        return sessions.edit(owner(principal), id, canReadCourses(principal), input);
    }

    @DeleteMapping("/study-sessions/{id}")
    @ResponseStatus(NO_CONTENT)
    public void deleteSession(@AuthenticationPrincipal UserPrincipal principal, @PathVariable Long id,
                              @RequestParam long version) {
        sessions.delete(owner(principal), id, version);
    }

    @GetMapping("/objectives")
    public List<Objective> objectives(@AuthenticationPrincipal UserPrincipal principal,
            @RequestParam(required = false) LocalDate week, @RequestParam(required = false) Boolean completed) {
        return objectives.list(owner(principal), week, completed);
    }

    @PostMapping("/objectives")
    @ResponseStatus(CREATED)
    public Objective createObjective(@AuthenticationPrincipal UserPrincipal principal, @Valid @RequestBody ObjectiveInput input) {
        return objectives.save(owner(principal), null, canReadCourses(principal), input);
    }

    @PutMapping("/objectives/{id}")
    public Objective editObjective(@AuthenticationPrincipal UserPrincipal principal, @PathVariable Long id,
                                   @Valid @RequestBody ObjectiveInput input) {
        return objectives.save(owner(principal), id, canReadCourses(principal), input);
    }

    @PatchMapping("/objectives/{id}/status")
    public Objective status(@AuthenticationPrincipal UserPrincipal principal, @PathVariable Long id,
                            @Valid @RequestBody ObjectiveStatus input) {
        return objectives.status(owner(principal), id, input);
    }

    @DeleteMapping("/objectives/{id}")
    @ResponseStatus(NO_CONTENT)
    public void deleteObjective(@AuthenticationPrincipal UserPrincipal principal, @PathVariable Long id,
                                @RequestParam long version) {
        objectives.delete(owner(principal), id, version);
    }

    @GetMapping("/statistics")
    public Statistics statistics(@AuthenticationPrincipal UserPrincipal principal,
            @RequestParam(required = false) LocalDate from, @RequestParam(required = false) LocalDate to) {
        return statistics.summary(owner(principal), from, to);
    }

    @GetMapping("/activity")
    public List<Day> activity(@AuthenticationPrincipal UserPrincipal principal,
            @RequestParam(required = false) LocalDate from, @RequestParam(required = false) LocalDate to) {
        return statistics.activity(owner(principal), from, to);
    }

    @ExceptionHandler({HttpMessageNotReadableException.class, MissingServletRequestParameterException.class,
        MethodArgumentTypeMismatchException.class})
    @ResponseStatus(BAD_REQUEST)
    public ErrorResponse invalidInput() {
        return new ErrorResponse(BAD_REQUEST.value(), "Check the request fields and date formats", LocalDateTime.now());
    }

    private Long owner(UserPrincipal principal) { return principal.getUser().getId(); }

    private boolean canReadCourses(UserPrincipal principal) {
        return principal.getAuthorities().stream().anyMatch(grant -> grant.getAuthority().equals("COURSE_READ"));
    }
}
