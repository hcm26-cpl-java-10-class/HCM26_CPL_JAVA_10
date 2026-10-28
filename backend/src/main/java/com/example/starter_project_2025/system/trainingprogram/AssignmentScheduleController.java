package com.example.starter_project_2025.system.trainingprogram;

import com.example.starter_project_2025.system.schedule.ScheduleEntryKey;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping("/api/schedule-checks/scoped")
@RequiredArgsConstructor
public class AssignmentScheduleController {
    private final AssignmentScheduleValidation validation;
    public record Request(@jakarta.validation.constraints.NotEmpty @jakarta.validation.constraints.Size(max=200)
                          List<@jakarta.validation.constraints.NotNull @jakarta.validation.Valid AssignmentScheduleProposal> sessions) {}
    @PostMapping
    @PreAuthorize("hasAnyAuthority('SESSION_CREATE','SESSION_UPDATE','STUDY_SESSION_CREATE','STUDY_SESSION_UPDATE')")
    public AssignmentScheduleValidation.Result preview(@jakarta.validation.Valid @RequestBody Request request) {
        if(request.sessions()!=null) for(var p:request.sessions()) if(p!=null) {
            var authorities=SecurityContextHolder.getContext().getAuthentication().getAuthorities();
            if(p.replacedKey()==null) {
                if(authorities.stream().noneMatch(a->a.getAuthority().equals("SESSION_CREATE") || a.getAuthority().equals("STUDY_SESSION_CREATE")))
                    throw new AccessDeniedException("Missing session creation permission.");
                continue;
            }
            String prefix=p.replacedKey()!=null && p.replacedKey().source()==ScheduleEntryKey.Source.DEMO_SESSION ? "SESSION" : "STUDY_SESSION";
            String permission=prefix+(p.replacedKey()==null?"_CREATE":"_UPDATE");
            if(authorities.stream().noneMatch(a->a.getAuthority().equals(permission)))
                throw new AccessDeniedException("Missing permission: "+permission);
        }
        return validation.preview(request.sessions());
    }
}
