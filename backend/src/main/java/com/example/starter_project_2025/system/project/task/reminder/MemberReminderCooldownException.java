package com.example.starter_project_2025.system.project.task.reminder;
import com.example.starter_project_2025.system.project.task.TaskValidationException;
import java.util.*;
public class MemberReminderCooldownException extends TaskValidationException {
    private final List<MemberReminderDtos.CooldownMember> members;
    public MemberReminderCooldownException(List<MemberReminderDtos.CooldownMember> members){
        super(Map.of("recipientUserIds",members.stream().map(member->member.displayName()
                +(member.userCode()==null?"":" ("+member.userCode()+")")+" was reminded recently. Please try again later.").toList()));
        this.members=List.copyOf(members);
    }
    public List<MemberReminderDtos.CooldownMember> getMembers(){return members;}
    @Override public String getMessage(){return "These members were reminded recently. Please try again later.";}
}
