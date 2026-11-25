package com.example.starter_project_2025.system.rbac.location;

import com.example.starter_project_2025.base.crud.CrudAction;
import com.example.starter_project_2025.system.demo.aicourse.AiTextClient;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Deque;
import java.util.List;

@Service
@RequiredArgsConstructor
public class LocationAiService {

    private final AiTextClient ai;
    private final LocationRepository locationRepository;
    private final ObjectMapper objectMapper;

    public record Status(boolean configured) {}

    public record Finding(
            String severity,
            String title,
            String description,
            Long locationId,
            String locationCode,
            String suggestedAction
    ) {}

    public record Analysis(
            boolean configured,
            String summary,
            List<Finding> findings
    ) {}

    public Status getStatus() {
        return new Status(ai.isConfigured());
    }

    @Transactional(readOnly = true)
    public Analysis analyze() {
        List<Location> locations = locationRepository.findAll();
        List<Location> roots = locations.stream()
                .filter(location -> location.getParentLocation() == null)
                .toList();

        List<Finding> deterministic = buildDeterministicFindings(locations);
        if (!ai.isConfigured()) {
            return new Analysis(false,
                    "AI key is not configured. The page is using deterministic organization checks.",
                    deterministic);
        }

        try {
            String system = """
                    You are an enterprise location-hierarchy analyst.
                    Analyze the supplied location hierarchy and staff assignments.
                    Return ONLY a valid JSON object. Do not write markdown.
                    Required JSON schema:
                    {"summary":"Concise operational summary","findings":[
                    {"severity":"HIGH|MEDIUM|LOW","title":"Short title","description":"Specific finding",
                    "locationId":123,"locationCode":"LOCATION_CODE","suggestedAction":"Safe next step"}
                    ]}
                    Rules:
                    - Use only supplied location IDs and codes.
                    - Do not invent staff, location counts, or codes.
                    - Findings must be actionable and not claim that an AI write was made.
                    - Prefer hierarchy, inactive-node, empty-location, duplicate-name and excessive-depth findings.
                    - Suggested actions must require human confirmation before changing data.
                    - Return at most 8 findings.
                    """;

            String user = """
                    Analyze this location organization snapshot:
                    %s
                    """.formatted(objectMapper.valueToTree(buildSnapshot(locations, roots)).toPrettyString());

            JsonNode response = ai.generateRecommendationJson(
                    system,
                    List.of(new AiTextClient.Turn("user", user))
            );
            Analysis analysis = objectMapper.treeToValue(response, Analysis.class);
            if (analysis == null || analysis.findings() == null) {
                throw new IllegalArgumentException("Missing AI findings");
            }

            List<Finding> findings = analysis.findings().stream()
                    .limit(8)
                    .filter(finding -> finding != null
                            && finding.title() != null
                            && finding.description() != null)
                    .toList();
            String summary = analysis.summary() == null || analysis.summary().isBlank()
                    ? "AI analyzed the current location hierarchy."
                    : analysis.summary();
            return new Analysis(true, summary, findings.isEmpty() ? deterministic : findings);
        } catch (Exception exception) {
            return new Analysis(true,
                    "AI analysis returned an unreadable result. Deterministic checks are shown instead.",
                    deterministic);
        }
    }

    private List<Finding> buildDeterministicFindings(List<Location> locations) {
        List<Finding> findings = new ArrayList<>();

        long inactiveCount = locations.stream()
                .filter(location -> location.getStatus() == LocationStatus.INACTIVE)
                .count();
        if (inactiveCount > 0) {
            findings.add(new Finding(
                    "MEDIUM",
                    "Inactive locations",
                    inactiveCount + " location(s) are inactive and may need reassignment or cleanup.",
                    null,
                    null,
                    "Review inactive locations and decide whether to reactivate or archive them."
            ));
        }

        for (Location location : locations) {
            if ((location.getUsers() == null || location.getUsers().isEmpty())
                    && (location.getChildren() == null || location.getChildren().isEmpty())) {
                findings.add(new Finding(
                        "LOW",
                        "Empty location",
                        "Location '" + location.getName() + "' has no direct staff and no child locations.",
                        location.getId(),
                        location.getCode(),
                        "Assign staff, add a child location, or confirm that this location is intentionally unused."
                ));
            }
        }

        int maxDepth = 0;
        Location deepest = null;
        Deque<LocationDepth> stack = new ArrayDeque<>();
        for (Location location : locations) {
            if (location.getParentLocation() == null) {
                stack.push(new LocationDepth(location, 0));
            }
        }
        while (!stack.isEmpty()) {
            LocationDepth current = stack.pop();
            if (current.depth() > maxDepth) {
                maxDepth = current.depth();
                deepest = current.location();
            }
            if (current.location().getChildren() != null) {
                for (Location child : current.location().getChildren()) {
                    stack.push(new LocationDepth(child, current.depth() + 1));
                }
            }
        }
        if (deepest != null && maxDepth >= 5) {
            findings.add(new Finding(
                    "MEDIUM",
                    "Deep hierarchy",
                    "The location hierarchy reaches level " + (maxDepth + 1)
                            + "; near '" + deepest.getName() + "'.",
                    deepest.getId(),
                    deepest.getCode(),
                    "Review the deepest branches for redundant hierarchy levels."
            ));
        }

        if (findings.size() > 8) {
            return findings.subList(0, 8);
        }
        return findings;
    }

    private LocationSnapshot buildSnapshot(List<Location> locations, List<Location> roots) {
        List<LocationSnapshotNode> nodes = locations.stream()
                .limit(150)
                .map(location -> new LocationSnapshotNode(
                        location.getId(),
                        location.getCode(),
                        location.getName(),
                        location.getStatus() == null ? null : location.getStatus().name(),
                        location.getLevel(),
                        location.getParentLocation() == null ? null : location.getParentLocation().getId(),
                        location.getUsers() == null ? 0 : location.getUsers().size(),
                        location.getChildren() == null ? 0 : location.getChildren().size()
                ))
                .toList();
        return new LocationSnapshot(nodes, roots.size());
    }

    private record LocationDepth(Location location, int depth) {}

    private record LocationSnapshot(List<LocationSnapshotNode> locations, int rootCount) {}

    private record LocationSnapshotNode(
            Long id,
            String code,
            String name,
            String status,
            Integer level,
            Long parentLocationId,
            int directUserCount,
            int childLocationCount
    ) {}
}
