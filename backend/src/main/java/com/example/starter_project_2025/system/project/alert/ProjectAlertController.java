package com.example.starter_project_2025.system.project.alert;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;
import org.springframework.http.ResponseEntity;
import java.util.*;
import static com.example.starter_project_2025.system.project.alert.ProjectAlertDtos.*;
@RestController @RequestMapping("/api/project-alerts") @RequiredArgsConstructor
public class ProjectAlertController {
    private final ProjectAlertService service;
    @GetMapping("/options") public Options options() {return service.options();}
    @GetMapping("/backlog") public Page<BacklogRow> backlog(FilterRequest query) {return service.backlog(query.filter());}
    @GetMapping("/milestones") public Page<MilestoneRow> milestones(FilterRequest query) {return service.milestones(query.filter());}
    @GetMapping("/inactive-members") public Page<MemberRow> inactive(FilterRequest query,@RequestParam(defaultValue="true") boolean inactiveOnly) {return service.inactive(query.filter(),inactiveOnly);}
    @GetMapping("/teams/{teamId}/members/{userId}/work-results")
    public MemberWorkDetail memberWork(@PathVariable Long teamId,@PathVariable Long userId) {return service.memberWork(teamId,userId);}
    @GetMapping("/teams/{teamId}/history") public List<History> history(@PathVariable Long teamId,@RequestParam Kind kind) {return service.history(teamId,kind);}
    @GetMapping("/teams/{teamId}/milestones/{milestoneId}/backlog-items")
    public LinkOptions links(@PathVariable Long teamId,@PathVariable UUID milestoneId) {return service.links(teamId,milestoneId);}
    @PutMapping("/teams/{teamId}/milestones/{milestoneId}/backlog-items")
    public LinkOptions link(@PathVariable Long teamId,@PathVariable UUID milestoneId,@RequestBody Links request) {return service.link(teamId,milestoneId,request);}
    @PostMapping("/send") public ResponseEntity<Result> send(@RequestHeader(value="Idempotency-Key",required=false) UUID key,
            @RequestHeader(value="X-Correlation-ID",required=false) String correlation,@RequestBody Send request) {
        Result result=service.send(key,correlation,request);return ResponseEntity.accepted().header("X-Correlation-ID",result.correlationId()).body(result);
    }
    @lombok.Getter @lombok.Setter
    public static class FilterRequest {
        private Long programId,cohortId,classId,teamId;
        private String teamSearch="",deadlineStatus="ALL";
        private int windowHours=48,page=0,size=50;
        public Filter filter() {return new Filter(programId,cohortId,classId,teamId,teamSearch,deadlineStatus,windowHours,page,size);}
    }
}
