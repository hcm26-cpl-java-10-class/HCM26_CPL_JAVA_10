package com.example.starter_project_2025.system.project.report;

import com.example.starter_project_2025.init.annotation.ResourceMenu;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.UUID;
import static com.example.starter_project_2025.system.project.report.ProjectReportDtos.*;

@RestController @RequiredArgsConstructor @RequestMapping("/api/project-reports")
@ResourceMenu(title="Project Dashboard",group="Project Management",icon="bar-chart",url="/management/reports/projects",order=7,permission="PROJECT_REPORT_READ")
public class ProjectReportController {
    private final ProjectReportService reports;
    private final ProjectReportExportService exports;
    @GetMapping("/options") public Options options(){return reports.options();}
    @GetMapping public Dashboard dashboard(@ModelAttribute Filter filter){return reports.dashboard(filter);}
    @GetMapping("/activities") public ActivityPage activities(@ModelAttribute Filter filter,
            @RequestParam(defaultValue="0") int offset, @RequestParam(defaultValue="10") int limit,
            @RequestParam(required=false) java.time.Instant before) { return reports.activities(filter, offset, limit, before); }
    @GetMapping("/activities/history") public ActivityHistory activityHistory(@ModelAttribute Filter filter,
            @RequestParam(defaultValue="0", name="historyPage") int page,
            @RequestParam(defaultValue="20", name="historySize") int size,
            @RequestParam(required=false) @org.springframework.format.annotation.DateTimeFormat(iso=org.springframework.format.annotation.DateTimeFormat.ISO.DATE) java.time.LocalDate activityFrom,
            @RequestParam(required=false) @org.springframework.format.annotation.DateTimeFormat(iso=org.springframework.format.annotation.DateTimeFormat.ISO.DATE) java.time.LocalDate activityTo,
            @RequestParam(required=false) java.time.Instant before) {
        return reports.activityHistory(filter, page, size, activityFrom, activityTo, before);
    }
    @PostMapping("/exports") public ResponseEntity<ExportView> request(@RequestHeader(value="Idempotency-Key",required=false)UUID key,@RequestBody ExportRequest request){
        return ResponseEntity.accepted().body(exports.request(key,request));}
    @GetMapping("/exports") public List<ExportView> list(){return exports.list();}
    @GetMapping("/exports/{id}") public ExportView get(@PathVariable UUID id){return exports.get(id);}
    @GetMapping("/exports/{id}/download") public ResponseEntity<byte[]> download(@PathVariable UUID id){
        var file=exports.download(id);return ResponseEntity.ok().header(HttpHeaders.CONTENT_TYPE,file.contentType())
                .header(HttpHeaders.CONTENT_DISPOSITION,ContentDisposition.attachment().filename(file.fileName(),StandardCharsets.UTF_8).build().toString())
                .header(HttpHeaders.ACCESS_CONTROL_EXPOSE_HEADERS,HttpHeaders.CONTENT_DISPOSITION).header(HttpHeaders.CACHE_CONTROL,"no-store")
                .header("X-Content-Type-Options","nosniff").body(file.bytes());}
}
