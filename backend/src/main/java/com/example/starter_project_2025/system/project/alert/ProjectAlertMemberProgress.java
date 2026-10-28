package com.example.starter_project_2025.system.project.alert;

import com.example.starter_project_2025.system.project.ProjectMember;
import com.example.starter_project_2025.system.project.sprint_backlog.*;
import org.springframework.stereotype.Component;
import java.math.*;
import java.util.*;
import static com.example.starter_project_2025.system.project.alert.ProjectAlertDtos.MemberProgress;

/** Per-student work progress uses the same linked backlog as the milestone total. */
@Component
public class ProjectAlertMemberProgress {
    public record Breakdown(List<MemberProgress> members,long workWithoutCurrentStudent) { }

    public Breakdown calculate(Long teamId,ProjectAlertReadStore.Scope scope,List<SprintBacklog> linkedItems) {
        Map<Long,List<ProjectMember>> students=new HashMap<>();
        scope.members().values().stream().filter(m->teamId.equals(m.getTeam().getId()))
                .filter(m->m.getClassMember().getUser().getRoles().stream().anyMatch(role->Boolean.TRUE.equals(role.getIsActive())
                        &&Set.of("STUDENT","TRAINEE").contains(role.getName())))
                .forEach(m->students.computeIfAbsent(m.getClassMember().getUser().getId(),ignored->new ArrayList<>()).add(m));
        List<MemberProgress> result=new ArrayList<>();long assignedTotal=0;
        for(var entry:students.entrySet()) {
            var member=entry.getValue().getFirst();var user=member.getClassMember().getUser();
            Set<Long> membershipIds=new HashSet<>();entry.getValue().forEach(m->membershipIds.add(m.getId()));
            var assigned=linkedItems.stream().filter(item->membershipIds.contains(item.getAssigneeProjectMemberId())).toList();
            long done=assigned.stream().filter(item->item.getStatus()==SprintBacklogStatus.DONE).count();
            BigDecimal percentage=assigned.isEmpty()?null:BigDecimal.valueOf(done).multiply(BigDecimal.valueOf(100))
                    .divide(BigDecimal.valueOf(assigned.size()),2,RoundingMode.HALF_UP);
            result.add(new MemberProgress(user.getId(),user.getUserCode(),user.getFullName(),member.getRole(),assigned.size(),done,percentage));
            assignedTotal+=assigned.size();
        }
        result.sort(Comparator.comparing(MemberProgress::displayName,String.CASE_INSENSITIVE_ORDER).thenComparing(MemberProgress::userId));
        return new Breakdown(result,linkedItems.size()-assignedTotal);
    }
}
