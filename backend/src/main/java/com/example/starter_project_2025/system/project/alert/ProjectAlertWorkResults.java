package com.example.starter_project_2025.system.project.alert;

import com.example.starter_project_2025.system.project.sprint_backlog.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import java.math.*;
import java.time.*;
import java.util.*;
import static com.example.starter_project_2025.system.project.alert.ProjectAlertDtos.MemberWorkSummary;

/** Current assigned parent backlog work; these results never decide inactivity. */
@Component
@RequiredArgsConstructor
public class ProjectAlertWorkResults {
    private final ProjectAlertReadStore store;

    public List<SprintBacklog> assigned(ProjectAlertReadStore.Scope scope,Long teamId,Long userId) {
        Set<Long> membershipIds=new HashSet<>();
        scope.members().values().stream().filter(member->teamId.equals(member.getTeam().getId())
                        &&userId.equals(member.getClassMember().getUser().getId()))
                .forEach(member->membershipIds.add(member.getId()));
        return scope.items().stream().filter(item->membershipIds.contains(item.getAssigneeProjectMemberId()))
                .filter(item->{var team=store.owner(scope,item);return team!=null&&teamId.equals(team.getId());}).toList();
    }

    public MemberWorkSummary summarize(List<SprintBacklog> items,Instant now,ZoneId zone) {
        long done=items.stream().filter(item->item.getStatus()==SprintBacklogStatus.DONE).count();
        long overdue=items.stream().filter(item->item.getStatus()==SprintBacklogStatus.TODO
                        ||item.getStatus()==SprintBacklogStatus.IN_PROGRESS)
                .filter(item->item.getEndDate()!=null&&item.getEndDate().atZone(zone).toInstant().isBefore(now)).count();
        long review=items.stream().filter(item->item.getStatus()==SprintBacklogStatus.REVIEW).count();
        long undated=items.stream().filter(item->item.getEndDate()==null).count();
        BigDecimal percentage=items.isEmpty()?null:BigDecimal.valueOf(done).multiply(BigDecimal.valueOf(100))
                .divide(BigDecimal.valueOf(items.size()),2,RoundingMode.HALF_UP);
        return new MemberWorkSummary(items.size(),done,overdue,review,undated,percentage);
    }
}
