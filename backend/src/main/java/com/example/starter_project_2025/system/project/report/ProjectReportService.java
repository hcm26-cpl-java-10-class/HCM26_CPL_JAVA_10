package com.example.starter_project_2025.system.project.report;

import com.example.starter_project_2025.system.project.ProjectTeam;
import com.example.starter_project_2025.system.project.milestone.domain.Milestone;
import com.example.starter_project_2025.system.project.milestone.domain.MilestoneLifecycleStatus;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;
import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.EnumMap;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.function.Function;
import java.util.stream.Collectors;
import static com.example.starter_project_2025.system.project.report.ProjectReportDtos.*;

@Service
@RequiredArgsConstructor
@Transactional(readOnly=true)
public class ProjectReportService {
    public record Snapshot(ProjectReportScopeService.Actor actor,Filter filter,List<SubProject> all,
                           List<SubProject> matching,Instant asOf) { }
    private final ProjectReportScopeService scope;
    private final ProjectReportQueryRepository queries;
    private final ProjectReportStatusPolicy statuses;
    private final ProjectReportProgressPolicy progress;
    private final ProjectReportRiskPolicy risks;
    private final ProjectReportSettings settings;
    @org.springframework.beans.factory.annotation.Autowired @Qualifier("projectReportClock") private Clock clock;

    public Options options() {
        var actor=scope.current(ProjectReportScopeService.READ);var rows=rows(queries.load(actor),clock.instant());
        return new Options(options(rows,SubProject::programId,SubProject::programName),options(rows,SubProject::cohortId,SubProject::cohortName),
                rows.stream().collect(Collectors.toMap(SubProject::classId,r->new ClassOption(r.classId(),r.className(),r.programId(),r.cohortId()),(a,b)->a)).values()
                        .stream().sorted(Comparator.comparing(ClassOption::name)).toList(),
                options(rows,SubProject::mentorId,SubProject::mentorName),options(rows,SubProject::templateId,SubProject::templateName),
                rows.stream().filter(r->r.sourceVersionId()!=null).collect(Collectors.toMap(SubProject::sourceVersionId,r->new VersionOption(r.sourceVersionId(),r.sourceVersion(),r.templateId()),(a,b)->a))
                        .values().stream().sorted(Comparator.comparing(VersionOption::name)).toList(),
                rows.stream().map(r->new TeamOption(r.teamId(),r.teamName(),r.classId())).toList(),actor.canExport(),settings.getTimeZone(),settings.getAtRiskHours(),settings.getAtRiskThreshold());
    }
    private List<Option> options(List<SubProject> rows,Function<SubProject,Long> id,Function<SubProject,String> name) {
        Map<Long,String> values=new HashMap<>();rows.forEach(row->{if(id.apply(row)!=null)values.putIfAbsent(id.apply(row),name.apply(row)==null?String.valueOf(id.apply(row)):name.apply(row));});
        return values.entrySet().stream().map(e->new Option(e.getKey(),e.getValue())).sorted(Comparator.comparing(Option::name)).toList();
    }
    public Dashboard dashboard(Filter request) {
        return dashboard(snapshot(scope.current(ProjectReportScopeService.READ),request));
    }
    public Snapshot exportSnapshot(Long actorId,Filter request) {
        return snapshot(scope.actor(actorId,ProjectReportScopeService.EXPORT),request);
    }
    private Snapshot snapshot(ProjectReportScopeService.Actor actor,Filter request) {
        Filter filter=(request==null?Filter.empty():request).normalized();validate(filter);
        Instant now=clock.instant();List<SubProject> all=rows(queries.load(actor),now);validateScope(filter,all);
        return new Snapshot(actor,filter,all,all.stream().filter(row->matches(row,filter)).toList(),now);
    }
    private Dashboard dashboard(Snapshot snapshot) {
        var matched=snapshot.matching();Map<String,List<SubProject>> full=snapshot.all().stream().collect(Collectors.groupingBy(SubProject::masterKey));
        var masters=matched.stream().collect(Collectors.groupingBy(SubProject::masterKey)).entrySet().stream().map(entry->{
            var visible=full.get(entry.getKey());var first=visible.getFirst();var eligible=visible.stream().filter(r->r.status()!=Status.CANCELLED).toList();
            Status status=eligible.isEmpty()?Status.CANCELLED:eligible.stream().allMatch(r->r.status()==Status.DONE)?Status.DONE:
                    eligible.stream().allMatch(r->r.status()==Status.NOT_STARTED)?Status.NOT_STARTED:
                    eligible.stream().allMatch(r->r.status()==Status.DONE||r.status()==Status.SUBMITTED)?Status.SUBMITTED:Status.IN_PROGRESS;
            return new Master(entry.getKey(),first.classId(),first.className(),first.templateId(),first.templateName(),first.sourceVersionId(),first.sourceVersion(),
                    status,progress.round(progress.average(eligible.stream().map(SubProject::progress).toList())),visible.size(),entry.getValue().size(),
                    (int)eligible.stream().filter(r->r.progress()==null).count(),entry.getValue());
        }).sorted(Comparator.comparing(Master::className).thenComparing(Master::templateName).thenComparing(Master::key)).toList();
        Map<Status,Long> counts=new EnumMap<>(Status.class);for(Status status:Status.values())counts.put(status,matched.stream().filter(r->r.status()==status).count());
        long denominator=counts.get(Status.IN_PROGRESS)+counts.get(Status.SUBMITTED)+counts.get(Status.DONE);
        var eligible=matched.stream().filter(r->r.status()!=Status.CANCELLED).toList();
        Summary summary=new Summary(masters.size(),masters.stream().filter(m->m.status()==Status.IN_PROGRESS||m.status()==Status.SUBMITTED).count(),
                matched.stream().map(SubProject::classId).distinct().count(),matched.stream().map(SubProject::cohortId).filter(Objects::nonNull).distinct().count(),
                matched.stream().map(SubProject::teamId).distinct().count(),matched.size(),denominator==0?null:progress.round(progress.ratio(counts.get(Status.DONE),denominator)),
                progress.round(progress.average(eligible.stream().map(SubProject::progress).toList())),matched.stream().filter(r->r.overdueMilestones()>0).count(),
                matched.stream().filter(r->r.atRiskMilestones()>0).count(),matched.stream().filter(r->r.lateMilestones()>0).count(),eligible.stream().filter(r->r.progress()==null).count());
        Filter filter=snapshot.filter();long offset=(long)filter.page()*filter.size();int from=(int)Math.min(offset,masters.size());int to=Math.min(from+filter.size(),masters.size());
        return new Dashboard(summary,counts,masters.subList(from,to),masters.size(),filter.page(),filter.size(),snapshot.asOf(),settings.getTimeZone(),settings.getAtRiskHours(),settings.getAtRiskThreshold());
    }
    private List<SubProject> rows(ProjectReportQueryRepository.Source source,Instant now) {
        Map<Long,List<Milestone>> grouped=source.milestones().stream().collect(Collectors.groupingBy(Milestone::getProjectId));
        List<SubProject> result=new ArrayList<>();
        for(ProjectTeam team:source.teams()) {
            var project=team.getProject();var school=team.getTrainingClass();var stages=grouped.getOrDefault(project.getId(),List.of());
            Status status=statuses.evaluate(project.getStatus(),stages.stream().map(Milestone::lifecycleStatus).toList());
            List<MilestoneRow> milestoneRows=new ArrayList<>();List<ProjectReportProgressPolicy.Stage> weights=new ArrayList<>();
            for(Milestone stage:stages) {
                var tasks=source.milestoneTasks().getOrDefault(stage.getId(),ProjectReportQueryRepository.TaskCount.empty());
                BigDecimal percent=progress.milestone(stage.lifecycleStatus(),tasks.done(),tasks.total());weights.add(new ProjectReportProgressPolicy.Stage(percent,stage.getWeight()));
                var submission=source.submissions().get(stage.getId());
                var flags=risks.evaluate(stage.lifecycleStatus(),stage.getDeadline(),percent,submission!=null&&submission.late(),status==Status.CANCELLED||status==Status.DONE,now);
                milestoneRows.add(new MilestoneRow(stage.getId(),stage.getTitle(),stage.lifecycleStatus().name(),stage.isMandatory(),stage.getDeadline(),stage.getWeight(),
                        progress.round(percent),tasks.done(),tasks.total(),submission==null?null:submission.latestAt(),flags.overdue(),flags.late(),flags.atRisk()));
            }
            milestoneRows.sort(Comparator.comparing(MilestoneRow::deadline,Comparator.nullsLast(Comparator.naturalOrder())).thenComparing(MilestoneRow::title));
            var calculated=progress.project(status,weights,source.projectTasks().getOrDefault(project.getId(),ProjectReportQueryRepository.TaskCount.empty()));
            var notes=new ArrayList<>(calculated.notes());var assignment=source.snapshots().get(project.getTemplateSnapshotId());
            Long templateId=team.getProjectTemplateId();Long versionId=team.getProjectTemplateVersionId();
            if(templateId==null&&assignment!=null)templateId=assignment.getTemplateId();
            if(versionId==null)versionId=queries.sourceVersionId(assignment);
            var version=source.snapshots().get(versionId);
            if(version==null||!Objects.equals(templateId,version.getTemplateId())){versionId=null;version=null;}
            String versionName=version==null?"Chưa xác định phiên bản":version.getVersion();
            String templateName=team.getProjectTemplate()==null?project.getName():team.getProjectTemplateName();
            String key=school.getTenantId()+":"+school.getId()+":"+templateId+":"+(versionId==null?"legacy-"+project.getId():versionId);
            if(versionId==null)notes.add("Thiếu phiên bản đề bài nguồn; Project được hiển thị riêng để tránh gộp nhầm.");
            result.add(new SubProject(project.getId(),project.getCode(),project.getName(),key,school.getId(),school.getName(),school.getCohortId(),school.getCohortName(),school.getProgramId(),school.getProgramName(),
                    team.getId(),team.getTeamName(),team.getAssignedMentorId(),source.mentors().getOrDefault(team.getAssignedMentorId(),"Chưa gán Mentor"),templateId,
                    templateName,versionId,versionName,source.workspaces().get(team.getId()),status,calculated.value(),calculated.mode(),List.copyOf(notes),
                    (int)stages.stream().filter(m->m.lifecycleStatus()==MilestoneLifecycleStatus.ACCEPTED).count(),List.copyOf(milestoneRows),
                    (int)milestoneRows.stream().filter(MilestoneRow::overdue).count(),(int)milestoneRows.stream().filter(MilestoneRow::lateSubmission).count(),
                    (int)milestoneRows.stream().filter(MilestoneRow::atRisk).count(),project.getCreatedAt()==null?null:project.getCreatedAt().atZone(settings.zone()).toInstant()));
        }
        result.sort(Comparator.comparing(SubProject::className).thenComparing(SubProject::teamName).thenComparing(SubProject::id));return List.copyOf(result);
    }
    private boolean matches(SubProject row,Filter f) {
        if(!eq(f.programId(),row.programId())||!eq(f.cohortId(),row.cohortId())||!eq(f.classId(),row.classId())||!eq(f.mentorId(),row.mentorId())
                ||!eq(f.templateId(),row.templateId())||!eq(f.sourceVersionId(),row.sourceVersionId())||!eq(f.teamId(),row.teamId())||!eq(f.projectId(),row.id()))return false;
        if(!f.includeCancelled()&&row.status()==Status.CANCELLED||f.status()!=null&&f.status()!=row.status())return false;
        if(f.createdFrom()!=null&&(row.createdAt()==null||row.createdAt().atZone(settings.zone()).toLocalDate().isBefore(f.createdFrom())))return false;
        if(f.createdTo()!=null&&(row.createdAt()==null||row.createdAt().atZone(settings.zone()).toLocalDate().isAfter(f.createdTo())))return false;
        if(!f.q().isEmpty()&&!String.join(" ",row.name(),row.code(),row.className(),row.teamName(),row.templateName(),row.mentorName()).toLowerCase(Locale.ROOT).contains(f.q().toLowerCase(Locale.ROOT)))return false;
        return switch(f.risk()) {case ALL->true;case OVERDUE->row.overdueMilestones()>0||row.lateMilestones()>0;
            case AT_RISK->row.atRiskMilestones()>0;case LATE_SUBMISSION->row.lateMilestones()>0;
            case NEEDS_ATTENTION->row.overdueMilestones()>0||row.atRiskMilestones()>0;};
    }
    private boolean eq(Long wanted,Long actual) {return wanted==null||Objects.equals(wanted,actual);}
    private void validate(Filter f) {
        if(f.page()<0||f.size()<1||f.size()>50||f.q().length()>120)throw invalid("Invalid page, page size or search text");
        if(f.createdFrom()!=null&&f.createdTo()!=null&&f.createdFrom().isAfter(f.createdTo()))throw invalid("Ngày bắt đầu phải trước hoặc bằng ngày kết thúc");
        if(f.status()==Status.CANCELLED&&!f.includeCancelled())throw invalid("Bật hiển thị Project đã hủy trước khi lọc CANCELLED");
        for(Long id:new Long[]{f.programId(),f.cohortId(),f.classId(),f.mentorId(),f.templateId(),f.sourceVersionId(),f.teamId(),f.projectId()})
            if(id!=null&&id<=0)throw invalid("Filter IDs must be positive");
    }
    private void validateScope(Filter f,List<SubProject> rows) {
        check(f.programId(),rows,SubProject::programId);check(f.cohortId(),rows,SubProject::cohortId);check(f.classId(),rows,SubProject::classId);
        check(f.mentorId(),rows,SubProject::mentorId);check(f.templateId(),rows,SubProject::templateId);check(f.sourceVersionId(),rows,SubProject::sourceVersionId);
        check(f.teamId(),rows,SubProject::teamId);check(f.projectId(),rows,SubProject::id);
    }
    private void check(Long id,List<SubProject> rows,Function<SubProject,Long> field) {
        if(id!=null&&rows.stream().noneMatch(row->id.equals(field.apply(row))))throw new AccessDeniedException("Bộ lọc nằm ngoài dữ liệu báo cáo được phép xem");
    }
    private ResponseStatusException invalid(String message) {return new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY,message);}
}
