package com.example.starter_project_2025.system.project.workspace.service;

import com.example.starter_project_2025.system.project.workspace.domain.WorkspaceSection;
import com.example.starter_project_2025.system.project.workspace.repository.WorkspaceActivityRepository;

import com.example.starter_project_2025.system.rbac.user.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import static com.example.starter_project_2025.system.project.workspace.dto.WorkspaceSectionDtos.*;

@Service @RequiredArgsConstructor
@ConditionalOnProperty(name = "app.workspace.sections.provider", havingValue = "mock", matchIfMissing = true)
public class MockWorkspaceSectionDataSource implements WorkspaceSectionDataSource {
    private record Key(Scope scope, WorkspaceSection section) { }
    private final Map<Key, List<Item>> records = new ConcurrentHashMap<>();
    private final Map<Key, MockControl> controls = new ConcurrentHashMap<>();
    private final WorkspaceActivityRepository activities;
    private final UserRepository users;

    @Override public List<Item> list(Scope scope, WorkspaceSection section) {
        var control = controls.get(new Key(scope, section));
        if (control != null) {
            try { if (control.delayMs() > 0) Thread.sleep(control.delayMs()); }
            catch (InterruptedException exception) {
                Thread.currentThread().interrupt();
                throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "Request was interrupted");
            }
            switch (control.mode()) {
                case EMPTY -> { return List.of(); }
                case NOT_FOUND -> throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Section data was not found");
                case ERROR -> throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Section data could not be loaded");
                default -> { }
            }
        }
        if (section == WorkspaceSection.ACTIVITY) {
            return activities.findByWorkspaceIdOrderByOccurredAtDesc(scope.workspaceId()).stream()
                    .map(item -> new Item(item.getEventId(), item.getAction(),
                            users.findById(item.getActorId()).map(user -> user.getFullName()).orElse("Former member"),
                            "RECORDED", true, null, item.getOccurredAt())).toList();
        }
        // No computeIfAbsent/seed/save during GET.
        return records.getOrDefault(new Key(scope, section), List.of());
    }

    @Override public Item create(Scope scope, WorkspaceSection section, Create request, String status) {
        Item item = new Item(UUID.randomUUID().toString(), request.title().trim(), request.description(),
                status, request.published(), null);
        append(new Key(scope, section), item);
        return item;
    }
    @Override public Item updateTask(Scope scope, String id, Create request) {
        Key key = new Key(scope, WorkspaceSection.BACKLOG);
        var result = new Item[1];
        records.compute(key, (ignored, old) -> {
            var items = new ArrayList<>(old == null ? List.<Item>of() : old);
            for (int i = 0; i < items.size(); i++) if (items.get(i).id().equals(id)) {
                Item previous = items.get(i);
                result[0] = new Item(id, request.title().trim(), request.description(),
                        previous.status(), previous.published(), null);
                items.set(i, result[0]); return List.copyOf(items);
            }
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Task was not found in this workspace");
        });
        return result[0];
    }
    @Override public Item review(Scope scope, Review request) {
        WorkspaceSection target = switch (request.kind()) {
            case ARTIFACT -> WorkspaceSection.ARTIFACT;
            case MILESTONE -> WorkspaceSection.MILESTONE;
            case SPRINT -> WorkspaceSection.SPRINT;
        };
        Item item = records.getOrDefault(new Key(scope, target), List.of()).stream()
                .filter(row -> row.id().equals(request.targetId())).findFirst()
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Review target was not found in this workspace"));
        Item review = new Item(UUID.randomUUID().toString(), "Review: " + item.title(), request.comment(),
                request.published() ? "PUBLISHED" : "DRAFT", request.published(), request.score());
        append(new Key(scope, WorkspaceSection.FEEDBACK), review);
        // Reviewing does not auto-complete the target or change the Project.
        return review;
    }
    private void append(Key key, Item item) {
        records.compute(key, (ignored, old) -> {
            var values = new ArrayList<>(old == null ? List.<Item>of() : old);
            values.add(item); return List.copyOf(values);
        });
    }
    public void seed(Scope scope) {
        for (WorkspaceSection section : List.of(WorkspaceSection.MILESTONE, WorkspaceSection.SPRINT,
                WorkspaceSection.BACKLOG, WorkspaceSection.ARTIFACT, WorkspaceSection.FEEDBACK))
            seedSection(scope, section);
    }
    private void seedSection(Scope scope, WorkspaceSection section) {
        if (section == WorkspaceSection.OVERVIEW || section == WorkspaceSection.MEMBERS || section == WorkspaceSection.ACTIVITY) return;
        records.putIfAbsent(new Key(scope, section), List.of(
                new Item(section.getKey() + "-" + scope.workspaceId() + "-published",
                        "Workspace " + scope.workspaceId() + " · " + section.getKey(),
                        "Published sample for project " + scope.projectId() + ", team " + scope.teamId(),
                        "OPEN", true, section == WorkspaceSection.FEEDBACK ? 8.0 : null),
                new Item(section.getKey() + "-" + scope.workspaceId() + "-draft",
                        "Draft · workspace " + scope.workspaceId(),
                        "Unpublished sample", "DRAFT", false,
                        section == WorkspaceSection.FEEDBACK ? 2.0 : null)));
    }
    public void configure(Scope scope, WorkspaceSection section, MockControl control) {
        controls.put(new Key(scope, section), control);
        if (control.mode() == MockMode.DATA) seedSection(scope, section);
    }
    public long size(Scope scope) {
        return records.entrySet().stream().filter(entry -> entry.getKey().scope().equals(scope))
                .mapToLong(entry -> entry.getValue().size()).sum();
    }
}
