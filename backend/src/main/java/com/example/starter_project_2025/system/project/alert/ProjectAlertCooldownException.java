package com.example.starter_project_2025.system.project.alert;
import com.example.starter_project_2025.system.project.task.TaskValidationException;
import java.util.*;
public class ProjectAlertCooldownException extends TaskValidationException {
    private final List<ProjectAlertDtos.CooldownMember> members;
    public ProjectAlertCooldownException(List<ProjectAlertDtos.CooldownMember> members) {
        super(Map.of("selections",members.stream().map(m->m.displayName()+
                (m.userCode()==null?"":" ("+m.userCode()+")")+" was reminded recently. Try again after "+m.nextReminderAt()).toList()));
        this.members=List.copyOf(members);
    }
    public List<ProjectAlertDtos.CooldownMember> getMembers() {return members;}
}
