package com.example.starter_project_2025.system.project.report;

import com.example.starter_project_2025.system.project.ProjectTeam;
import com.example.starter_project_2025.system.project.alert.ProjectAlertActivityService;
import com.example.starter_project_2025.system.project.alert.ProjectAlertReadStore;
import com.example.starter_project_2025.system.project.domain.ProjectStatus;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import java.time.Instant;
import java.util.*;
import static com.example.starter_project_2025.system.project.report.ProjectReportDtos.InactiveMember;

/** Reuse Alerts' inactivity rule on each assigned project without changing any managed Team entity. */
@Service
@RequiredArgsConstructor
public class ProjectReportActivityService {
    private final ProjectAlertReadStore store;
    private final ProjectAlertActivityService activity;

    public Map<Long,List<InactiveMember>> load(ProjectReportQueryRepository.Source source,Instant now) {
        var roster=store.load(source.teams()).members();
        Map<Long,List<InactiveMember>> result=new HashMap<>();
        for(var entry:source.entries().values()) {
            if(entry.contextOnly()||entry.owner()==null||entry.project().getStatus()!=ProjectStatus.ACTIVE)continue;
            ProjectTeam owner=entry.owner();
            // Alerts reads a team's primary project. WHOLE requires the same check for every owned module.
            ProjectTeam view=new ProjectTeam();view.setId(owner.getId());view.setTeamName(owner.getTeamName());
            view.setTrainingClass(owner.getTrainingClass());view.setProject(entry.project());
            view.setAssignedMentorId(owner.getAssignedMentorId());
            var candidates=new ProjectAlertReadStore.Scope(Map.of(view.getId(),view),roster,
                    source.backlogs().getOrDefault(entry.project().getId(),List.of()));
            // Reports counts every project item, while Alerts' activity reader expects only items with a team owner.
            // Unassigned direct backlog remains in the report totals but cannot establish a member's inactivity.
            var attributable=candidates.items().stream().filter(item->store.owner(candidates,item)!=null).toList();
            var single=new ProjectAlertReadStore.Scope(candidates.teams(),candidates.members(),attributable);
            var inactive=activity.members(view,single,now).stream().filter(member->member.inactive())
                    .map(member->new InactiveMember(Long.valueOf(member.id()),member.userCode(),member.displayName(),
                            member.joinedAt(),member.lastTaskStartedAt(),member.pendingSince())).toList();
            result.put(entry.project().getId(),inactive);
        }
        return result;
    }
}
