package com.example.starter_project_2025.system.project.task.reminder;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;
import org.springframework.http.ResponseEntity;
import java.util.*;
@RestController @RequiredArgsConstructor
@RequestMapping("/api/projects/{projectId}/inactive-members")
public class MemberReminderController {
    private final MemberReminderService service;
    @GetMapping public MemberReminderDtos.Page list(@PathVariable UUID projectId,
            @RequestParam(defaultValue="true") boolean inactiveOnly){return service.list(projectId,inactiveOnly);}
    @PostMapping("/reminders") public ResponseEntity<MemberReminderDtos.Result> send(@PathVariable UUID projectId,
            @RequestHeader(value="Idempotency-Key",required=false) UUID key,
            @RequestHeader(value="X-Correlation-ID",required=false) String correlation,
            @RequestBody MemberReminderDtos.Send request){
        var result=service.send(projectId,key,correlation,request);
        return ResponseEntity.accepted().header("X-Correlation-ID",result.correlationId()).body(result);
    }
    @GetMapping("/{userId}/reminders") public List<MemberReminderDtos.History> history(@PathVariable UUID projectId,@PathVariable Long userId){
        return service.history(projectId,userId);
    }
}
