package com.example.starter_project_2025.system.project.workspace.demo;

import com.example.starter_project_2025.system.project.ProjectRepository;
import com.example.starter_project_2025.system.project.domain.Project;
import com.example.starter_project_2025.system.project.sprint.Sprint;
import com.example.starter_project_2025.system.project.sprint.SprintRepository;
import com.example.starter_project_2025.system.project.sprint.SprintStatus;
import com.example.starter_project_2025.system.project.sprint_backlog.SprintBacklog;
import com.example.starter_project_2025.system.project.sprint_backlog.SprintBacklogPriority;
import com.example.starter_project_2025.system.project.sprint_backlog.SprintBacklogRepository;
import com.example.starter_project_2025.system.project.sprint_backlog.SprintBacklogStatus;
import com.example.starter_project_2025.system.project.sprint_backlog.SprintBacklogWorkType;
import com.example.starter_project_2025.system.rbac.user.User;
import com.example.starter_project_2025.system.rbac.user.UserRepository;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import lombok.experimental.NonFinal;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Profile;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Objects;

/**
 * Seeds one sprint timeline (plus its sprint backlog and product backlog) per
 * local workspace demo project.
 * <p>
 * {@link WorkspaceDemoDataService} creates one project per sample team
 * ({@code WS-DEMO-ACTIVE} for Team Nova, {@code WS-DEMO-EXISTING} for Team
 * Pixel, {@code WS-DEMO-COMPLETED} for Team Completed). Without this seed every
 * team workspace opened its Backlog tab on the shared
 * {@code Sprint 1 - Discovery} timeline of the generic demo project, so the
 * sample data below gives each workspace sprints and work items that match its
 * own project topic.
 * <p>
 * Runs after {@link WorkspaceDemoDataInitializer} (@Order 20) so the projects
 * already exist. The upserts are idempotent (sprint by unique name, work item
 * by project + title), so the seed can run on every startup.
 */
@Slf4j
@Component
@Order(21)
@Profile("!test")
@ConditionalOnProperty(name = "app.workspace.demo.enabled", havingValue = "true", matchIfMissing = true)
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class WorkspaceDemoBacklogInitializer implements CommandLineRunner {

    /** Learning Resource Hub - workspace of Team Nova. */
    static final String ACTIVE_PROJECT = "WS-DEMO-ACTIVE";

    /** Student Support Portal - workspace of Team Pixel. */
    static final String EXISTING_PROJECT = "WS-DEMO-EXISTING";

    /** Completed Project - workspace of Team Completed. */
    static final String COMPLETED_PROJECT = "WS-DEMO-COMPLETED";

    UserRepository users;
    ProjectRepository projects;
    SprintRepository sprints;
    SprintBacklogRepository backlogs;

    @Value("${app.seed.admin.email:admin@example.com}")
    @NonFinal
    String adminEmail;

    @Override
    @Transactional
    public void run(String... args) {
        User admin = users.findByEmail(adminEmail).orElse(null);
        if (admin == null || admin.getTenant() == null) {
            log.info("Workspace backlog demo seed skipped: the demo admin account is missing.");
            return;
        }

        Long tenantId = admin.getTenant().getId();
        int seeded = seedProject(tenantId, learningResourceHub())
                + seedProject(tenantId, studentSupportPortal())
                + seedProject(tenantId, completedProject());

        log.info("Ensured sample workspaces backlogs for {} sprint(s) across the workspace demo projects.", seeded);
    }

    /** @return number of sprints seeded for the project (0 when it is missing). */
    private int seedProject(Long tenantId, ProjectSeed seed) {
        Project project = projects.findByCodeAndTenantId(seed.code(), tenantId).orElse(null);
        if (project == null) {
            return 0;
        }

        for (SprintSeed sprintSeed : seed.sprints()) {
            Sprint sprint = upsertSprint(project.getId(), sprintSeed);
            for (ItemSeed item : sprintSeed.items()) {
                upsertSprintItem(sprint, project.getId(), item);
            }
        }

        for (ItemSeed item : seed.productBacklog()) {
            upsertProductBacklogItem(project.getId(), item);
        }

        return seed.sprints().size();
    }

    private Sprint upsertSprint(Long projectId, SprintSeed seed) {
        Sprint sprint = sprints.findFirstByProjectIdAndNameOrderByIdAsc(projectId, seed.name())
                .orElseGet(Sprint::new);

        sprint.setName(seed.name());
        sprint.setSprintGoal(seed.goal());
        sprint.setProjectId(projectId);
        sprint.setStartDate(seed.start());
        sprint.setEndDate(seed.end());
        sprint.setStatus(seed.status());
        sprint.setIsActive(true);

        return sprints.save(sprint);
    }

    private void upsertSprintItem(Sprint sprint, Long projectId, ItemSeed item) {
        List<SprintBacklog> matches = sprint.getId() == null
                ? List.of()
                : backlogs.findAllBySprintIdAndTitleIgnoreCaseOrderByIdAsc(sprint.getId(), item.title());
        SprintBacklog backlog = sprint.getId() == null
                ? backlogs.findBySprintIsNullAndTitleIgnoreCase(item.title()).orElseGet(SprintBacklog::new)
                : matches.stream().findFirst().orElseGet(SprintBacklog::new);

        backlog.setSprint(sprint);
        backlog.setProjectId(projectId);
        applyItem(backlog, item);

        backlogs.save(backlog);

        matches.stream()
                .skip(1)
                .filter(duplicate -> matchesSeed(duplicate, item))
                .forEach(duplicate -> archiveDuplicate(duplicate, projectId, item.title()));
    }

    private void upsertProductBacklogItem(Long projectId, ItemSeed item) {
        List<SprintBacklog> matches = backlogs
                .findAllByProjectIdAndSprintIsNullAndTitleIgnoreCaseOrderByIdAsc(projectId, item.title());

        boolean alreadyInSprint = backlogs.findAllByProjectIdAndTitleIgnoreCaseAndIsActiveTrue(projectId, item.title())
                .stream()
                .anyMatch(candidate -> candidate.getSprint() != null
                        && Objects.equals(candidate.getDescription(), item.description()));
        if (alreadyInSprint) {
            matches.stream()
                    .filter(duplicate -> matchesSeed(duplicate, item))
                    .forEach(duplicate -> archiveDuplicate(duplicate, projectId, item.title()));
            return;
        }

        SprintBacklog backlog = matches.isEmpty() ? new SprintBacklog() : matches.get(0);

        backlog.setSprint(null);
        backlog.setProjectId(projectId);
        applyItem(backlog, item);

        backlogs.save(backlog);

        // Older demo runs could insert the same fixture more than once. Keep
        // user-edited rows intact; only soft-archive duplicates that still
        // exactly match the seeded fixture. Workspace reads exclude inactive
        // rows, while their history and database records remain available.
        matches.stream()
                .skip(1)
                .filter(duplicate -> matchesSeed(duplicate, item))
                .forEach(duplicate -> archiveDuplicate(duplicate, projectId, item.title()));
    }

    private void archiveDuplicate(SprintBacklog duplicate, Long projectId, String title) {
        duplicate.setIsActive(false);
        backlogs.save(duplicate);
        log.info("Archived duplicate workspace demo backlog item id={} projectId={} title={}",
                duplicate.getId(), projectId, title);
    }

    private boolean matchesSeed(SprintBacklog backlog, ItemSeed item) {
        return Objects.equals(backlog.getDescription(), item.description())
                && Objects.equals(backlog.getStartDate(), item.start())
                && Objects.equals(backlog.getEndDate(), item.end())
                && backlog.getStatus() == item.status()
                && backlog.getPriority() == item.priority()
                && backlog.getWorkType() == item.workType()
                && Objects.equals(backlog.getEstimatedHours(), item.estimatedHours());
    }

    private void applyItem(SprintBacklog backlog, ItemSeed item) {
        backlog.setTitle(item.title());
        backlog.setDescription(item.description());
        backlog.setStartDate(item.start());
        backlog.setEndDate(item.end());
        backlog.setStatus(item.status());
        backlog.setPriority(item.priority());
        backlog.setWorkType(item.workType());
        backlog.setEstimatedHours(item.estimatedHours());
        backlog.setIsActive(true);
    }

    private ProjectSeed learningResourceHub() {
        return new ProjectSeed(
                ACTIVE_PROJECT,
                List.of(
                        new SprintSeed(
                                "Resource Audit",
                                "Audit the current learning resources and tag them by subject and level",
                                LocalDateTime.of(2026, 10, 19, 0, 0),
                                LocalDateTime.of(2026, 10, 30, 0, 0),
                                SprintStatus.ACTIVE,
                                List.of(
                                        item("Inventory existing course resources",
                                                "List every resource already published in the hub, with its owner, "
                                                        + "subject and last review date, so the catalogue has a baseline.",
                                                SprintBacklogStatus.DONE, SprintBacklogPriority.HIGH,
                                                SprintBacklogWorkType.STORY, 12.0,
                                                LocalDateTime.of(2026, 10, 19, 9, 0),
                                                LocalDateTime.of(2026, 10, 22, 17, 0)),
                                        item("Tag resources by subject and level",
                                                "Apply the agreed subject and difficulty taxonomy to every resource "
                                                        + "and report the ones that cannot be classified yet.",
                                                SprintBacklogStatus.IN_PROGRESS, SprintBacklogPriority.URGENT,
                                                SprintBacklogWorkType.TASK, 16.0,
                                                LocalDateTime.of(2026, 10, 20, 9, 0),
                                                LocalDateTime.of(2026, 10, 28, 17, 0)))),
                        new SprintSeed(
                                "Recommendation Engine",
                                "Recommend the next learning resource from the learner's progress",
                                LocalDateTime.of(2026, 11, 2, 0, 0),
                                LocalDateTime.of(2026, 11, 13, 0, 0),
                                SprintStatus.PLANNED,
                                List.of(
                                        item("Design the recommendation data model",
                                                "Model learner progress, resource metadata and the signals used by "
                                                        + "the ranking so the engine can be evaluated later.",
                                                SprintBacklogStatus.TODO, SprintBacklogPriority.HIGH,
                                                SprintBacklogWorkType.TASK, 12.0,
                                                LocalDateTime.of(2026, 11, 2, 9, 0),
                                                LocalDateTime.of(2026, 11, 6, 17, 0)),
                                        item("Prototype the personalised resource feed",
                                                "Show the top five recommended resources on the learner home page "
                                                        + "and log every click so the ranking can be tuned.",
                                                SprintBacklogStatus.REVIEW, SprintBacklogPriority.MEDIUM,
                                                SprintBacklogWorkType.STORY, 20.0,
                                                LocalDateTime.of(2026, 11, 4, 9, 0),
                                                LocalDateTime.of(2026, 11, 12, 17, 0)))),
                        new SprintSeed(
                                "Offline Reading",
                                "Let learners keep reading when the connection drops",
                                LocalDateTime.of(2026, 11, 16, 0, 0),
                                LocalDateTime.of(2026, 11, 27, 0, 0),
                                SprintStatus.PLANNED,
                                List.of(
                                        item("Cache articles for offline reading",
                                                "Store the resource content locally and show a clear banner when the "
                                                        + "learner reads a cached copy.",
                                                SprintBacklogStatus.TODO, SprintBacklogPriority.MEDIUM,
                                                SprintBacklogWorkType.STORY, 20.0,
                                                LocalDateTime.of(2026, 11, 16, 9, 0),
                                                LocalDateTime.of(2026, 11, 20, 17, 0))))),
                List.of(
                        productItem("Improve resource search ranking",
                                "Rank exact subject matches above partial ones and expose the ranking weights "
                                        + "in the configuration.",
                                SprintBacklogPriority.HIGH, SprintBacklogWorkType.STORY, 8.0),
                        productItem("Fix duplicate bookmark shortcut",
                                "Bookmarking the same resource twice creates two entries; keep one and merge the "
                                        + "timestamps.",
                                SprintBacklogPriority.URGENT, SprintBacklogWorkType.BUG, 4.0)));
    }

    private ProjectSeed studentSupportPortal() {
        return new ProjectSeed(
                EXISTING_PROJECT,
                List.of(
                        new SprintSeed(
                                "Intake Triage",
                                "Classify incoming support requests and publish the escalation path",
                                LocalDateTime.of(2026, 10, 19, 0, 0),
                                LocalDateTime.of(2026, 10, 30, 0, 0),
                                SprintStatus.ACTIVE,
                                List.of(
                                        item("Categorise support request types",
                                                "Agree the request categories with the student services team and map "
                                                        + "every legacy request onto one of them.",
                                                SprintBacklogStatus.DONE, SprintBacklogPriority.HIGH,
                                                SprintBacklogWorkType.STORY, 8.0,
                                                LocalDateTime.of(2026, 10, 19, 9, 0),
                                                LocalDateTime.of(2026, 10, 22, 17, 0)),
                                        item("Build the support ticket intake form",
                                                "One form that routes each request to the right advisor, with "
                                                        + "attachments and a confirmation email.",
                                                SprintBacklogStatus.IN_PROGRESS, SprintBacklogPriority.URGENT,
                                                SprintBacklogWorkType.STORY, 16.0,
                                                LocalDateTime.of(2026, 10, 20, 9, 0),
                                                LocalDateTime.of(2026, 10, 29, 17, 0)))),
                        new SprintSeed(
                                "Knowledge Base",
                                "Publish self-service answers for the most common student questions",
                                LocalDateTime.of(2026, 11, 2, 0, 0),
                                LocalDateTime.of(2026, 11, 13, 0, 0),
                                SprintStatus.PLANNED,
                                List.of(
                                        item("Draft FAQ answers for the top ten questions",
                                                "Write and review the answers with student services, then publish "
                                                        + "them in the help centre.",
                                                SprintBacklogStatus.TODO, SprintBacklogPriority.MEDIUM,
                                                SprintBacklogWorkType.TASK, 12.0,
                                                LocalDateTime.of(2026, 11, 2, 9, 0),
                                                LocalDateTime.of(2026, 11, 6, 17, 0)),
                                        item("Add search to the help centre",
                                                "Full text search over the FAQ with synonyms for the ticket "
                                                        + "categories agreed in Sprint 1.",
                                                SprintBacklogStatus.TODO, SprintBacklogPriority.HIGH,
                                                SprintBacklogWorkType.STORY, 16.0,
                                                LocalDateTime.of(2026, 11, 4, 9, 0),
                                                LocalDateTime.of(2026, 11, 12, 17, 0)))),
                        new SprintSeed(
                                "Advising Workflow",
                                "Give advisors a single queue for appointments and follow-ups",
                                LocalDateTime.of(2026, 11, 16, 0, 0),
                                LocalDateTime.of(2026, 11, 27, 0, 0),
                                SprintStatus.PLANNED,
                                List.of(
                                        item("Book advising appointments online",
                                                "Students pick an open slot and advisors see the booking in their "
                                                        + "queue with the linked support ticket.",
                                                SprintBacklogStatus.TODO, SprintBacklogPriority.MEDIUM,
                                                SprintBacklogWorkType.STORY, 24.0,
                                                LocalDateTime.of(2026, 11, 16, 9, 0),
                                                LocalDateTime.of(2026, 11, 24, 17, 0))))),
                List.of(
                        productItem("Collect advisor feedback survey",
                                "Short survey for advisors after each closed ticket to measure the triage quality.",
                                SprintBacklogPriority.LOW, SprintBacklogWorkType.TASK, 4.0),
                        productItem("Fix attachment upload on support replies",
                                "Replies larger than 5 MB fail silently; validate the size and surface the error.",
                                SprintBacklogPriority.URGENT, SprintBacklogWorkType.BUG, 6.0)));
    }

    private ProjectSeed completedProject() {
        return new ProjectSeed(
                COMPLETED_PROJECT,
                List.of(
                        new SprintSeed(
                                "Final Handover",
                                "Hand the finished product over to the program team",
                                LocalDateTime.of(2026, 9, 7, 0, 0),
                                LocalDateTime.of(2026, 9, 18, 0, 0),
                                SprintStatus.COMPLETED,
                                List.of(
                                        item("Write the setup and deployment guide",
                                                "Document the local setup, the environment variables and the "
                                                        + "release checklist used for the final demo.",
                                                SprintBacklogStatus.DONE, SprintBacklogPriority.HIGH,
                                                SprintBacklogWorkType.TASK, 8.0,
                                                LocalDateTime.of(2026, 9, 7, 9, 0),
                                                LocalDateTime.of(2026, 9, 11, 17, 0)),
                                        item("Run the final acceptance demo",
                                                "Walk the program team through every acceptance criterion and "
                                                        + "record the sign-off.",
                                                SprintBacklogStatus.DONE, SprintBacklogPriority.MEDIUM,
                                                SprintBacklogWorkType.STORY, 6.0,
                                                LocalDateTime.of(2026, 9, 14, 9, 0),
                                                LocalDateTime.of(2026, 9, 17, 17, 0)))),
                        new SprintSeed(
                                "Project Closure",
                                "Close the project and archive its artefacts",
                                LocalDateTime.of(2026, 9, 21, 0, 0),
                                LocalDateTime.of(2026, 10, 2, 0, 0),
                                SprintStatus.COMPLETED,
                                List.of(
                                        item("Archive project artefacts",
                                                "Move the design files, reports and meeting notes into the archive "
                                                        + "folder and confirm the retention owner.",
                                                SprintBacklogStatus.DONE, SprintBacklogPriority.LOW,
                                                SprintBacklogWorkType.TASK, 4.0,
                                                LocalDateTime.of(2026, 9, 21, 9, 0),
                                                LocalDateTime.of(2026, 9, 30, 17, 0))))),
                List.of());
    }

    private static ItemSeed item(
            String title,
            String description,
            SprintBacklogStatus status,
            SprintBacklogPriority priority,
            SprintBacklogWorkType workType,
            Double estimatedHours,
            LocalDateTime start,
            LocalDateTime end
    ) {
        return new ItemSeed(title, description, status, priority, workType, estimatedHours, start, end);
    }

    /** Product backlog item: no sprint, so no schedule. */
    private static ItemSeed productItem(
            String title,
            String description,
            SprintBacklogPriority priority,
            SprintBacklogWorkType workType,
            Double estimatedHours
    ) {
        return new ItemSeed(title, description, SprintBacklogStatus.TODO, priority, workType,
                estimatedHours, null, null);
    }

    private record ItemSeed(
            String title,
            String description,
            SprintBacklogStatus status,
            SprintBacklogPriority priority,
            SprintBacklogWorkType workType,
            Double estimatedHours,
            LocalDateTime start,
            LocalDateTime end
    ) {
    }

    private record SprintSeed(
            String name,
            String goal,
            LocalDateTime start,
            LocalDateTime end,
            SprintStatus status,
            List<ItemSeed> items
    ) {
    }

    private record ProjectSeed(String code, List<SprintSeed> sprints, List<ItemSeed> productBacklog) {
    }
}
