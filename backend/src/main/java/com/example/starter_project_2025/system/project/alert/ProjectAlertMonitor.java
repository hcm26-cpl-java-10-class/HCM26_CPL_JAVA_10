package com.example.starter_project_2025.system.project.alert;

import com.example.starter_project_2025.system.project.milestone.domain.Milestone;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.*;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import static com.example.starter_project_2025.system.project.alert.ProjectAlertDtos.*;

/** Detect candidates in the background; sending is always an explicit, freshly validated action. */
@Service @RequiredArgsConstructor @Transactional(readOnly=true)
public class ProjectAlertMonitor {
    private final ProjectAlertReadStore store;
    private final AlertMilestoneProgressSource progressSource;
    private final ProjectAlertMilestonePolicy policy;
    private final ProjectAlertBacklogPolicy backlogPolicy;
    public record Candidate(Milestone milestone,Progress progress) { }
    public record TeamAlerts(Instant checkedAt,Set<Long> overdueBacklogs,Set<UUID> milestones,Set<Long> inactiveMembers) { }
    private final Map<Long,TeamAlerts> detected=new ConcurrentHashMap<>();

    public List<Candidate> milestones(ProjectAlertReadStore.Scope scope,Instant now) {
        List<Candidate> result=new ArrayList<>();
        for(var milestone:store.milestones(scope.teams())) {
            var ids=progressSource.backlogItemIds(milestone.getId(),milestone.getTeamId(),milestone.getTenantId()).orElse(Set.of());
            var items=scope.items().stream().filter(item->ids.contains(item.getId())
                    &&milestone.getTeamId().equals(store.owner(scope,item).getId())).toList();
            var progress=policy.evaluate(milestone,items,now);
            if(progress.atRisk())result.add(new Candidate(milestone,progress));
        }
        return result;
    }
    public void scan(Instant now,ZoneId zone) {
        var teams=store.monitoringTeams();Set<Long> current=new HashSet<>();
        for(var team:teams) {
            current.add(team.getId());var scope=store.load(List.of(team));
            Set<Long> overdue=new HashSet<>();
            scope.items().stream().filter(item->backlogPolicy.eligible(item,now,zone))
                    .forEach(item->overdue.add(item.getId()));
            Set<UUID> milestoneIds=new HashSet<>();milestones(scope,now).forEach(item->milestoneIds.add(item.milestone().getId()));
            detected.put(team.getId(),new TeamAlerts(now,Set.copyOf(overdue),Set.copyOf(milestoneIds),Set.of()));
        }
        detected.keySet().retainAll(current);
    }
    public Optional<TeamAlerts> latest(Long teamId) {return Optional.ofNullable(detected.get(teamId));}
}
