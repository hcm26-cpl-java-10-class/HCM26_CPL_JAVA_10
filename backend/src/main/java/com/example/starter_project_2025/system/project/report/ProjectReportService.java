package com.example.starter_project_2025.system.project.report;

import com.example.starter_project_2025.system.project.milestone.domain.MilestoneLifecycleStatus;
import com.example.starter_project_2025.system.project.project_template_version.ProjectTemplateSnapshot;
import com.example.starter_project_2025.system.project.task.reminder.MemberReminderSettings;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;
import java.time.Clock;
import java.time.Instant;
import java.util.*;
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
    private final ProjectReportRiskPolicy risks;
    private final ProjectReportActivityService activity;
    private final MemberReminderSettings inactivity;
    private final ProjectReportSettings settings;
    @org.springframework.beans.factory.annotation.Autowired @Qualifier("projectReportClock") private Clock clock;

    public Options options() {
        var actor=scope.current(ProjectReportScopeService.READ);
        var rows=rows(queries.load(actor),clock.instant(),false);
        return new Options(options(rows,SubProject::programId,SubProject::programName),
                options(rows,SubProject::cohortId,SubProject::cohortName),
                rows.stream().collect(Collectors.toMap(SubProject::classId,r->new ClassOption(r.classId(),r.className(),r.programId(),r.cohortId()),(a,b)->a))
                        .values().stream().sorted(Comparator.comparing(ClassOption::name)).toList(),
                options(rows,SubProject::mentorId,SubProject::mentorName),options(rows,SubProject::templateId,SubProject::templateName),
                rows.stream().filter(r->r.sourceVersionId()!=null).collect(Collectors.toMap(SubProject::sourceVersionId,
                        r->new VersionOption(r.sourceVersionId(),r.sourceVersion(),r.templateId()),(a,b)->a))
                        .values().stream().sorted(Comparator.comparing(VersionOption::name)).toList(),
                rows.stream().filter(r->r.teamId()!=null).collect(Collectors.toMap(SubProject::teamId,
                        r->new TeamOption(r.teamId(),r.teamName(),r.classId()),(a,b)->a)).values().stream()
                        .sorted(Comparator.comparing(TeamOption::name)).toList(),
                actor.canExport(),settings.getTimeZone(),inactivity.inactiveWindow().toDays());
    }
    private List<Option> options(List<SubProject> rows,Function<SubProject,Long> id,Function<SubProject,String> name) {
        Map<Long,String> values=new HashMap<>();
        rows.forEach(row->{if(id.apply(row)!=null) values.putIfAbsent(id.apply(row),Objects.toString(name.apply(row),String.valueOf(id.apply(row))));});
        return values.entrySet().stream().map(e->new Option(e.getKey(),e.getValue())).sorted(Comparator.comparing(Option::name)).toList();
    }
    public Dashboard dashboard(Filter request) { return dashboard(snapshot(scope.current(ProjectReportScopeService.READ),request)); }
    public Snapshot exportSnapshot(Long actorId,Filter request) { return snapshot(scope.actor(actorId,ProjectReportScopeService.EXPORT),request); }
    public Set<Long> readableProjectIds(ProjectReportScopeService.Actor actor) {
        return queries.load(actor).entries().values().stream().filter(entry->!entry.contextOnly())
                .map(entry->entry.project().getId()).collect(Collectors.toSet());
    }
    private Snapshot snapshot(ProjectReportScopeService.Actor actor,Filter request) {
        Filter filter=(request==null?Filter.empty():request).normalized();validate(filter);
        Instant now=clock.instant();
        List<SubProject> all=rows(queries.load(actor),now,true);
        validateScope(filter,all);
        var matching=all.stream().filter(row->!row.contextOnly())
                .filter(row->filter.status()==null||row.parentProjectId()!=null)
                .filter(row->matches(row,filter)).toList();
        return new Snapshot(actor,filter,all,matching,now);
    }
    public List<Master> masters(Snapshot snapshot) {
        Map<String,List<SubProject>> full=snapshot.all().stream().collect(Collectors.groupingBy(SubProject::masterKey));
        return snapshot.matching().stream().collect(Collectors.groupingBy(SubProject::masterKey)).entrySet().stream().map(entry->{
            var visible=full.get(entry.getKey());
            var root=visible.stream().filter(row->row.id().equals(row.masterId())).findFirst().orElseThrow();
            var matching=entry.getValue();
            BacklogCounts backlog=visible.stream().filter(row->!row.contextOnly()).map(SubProject::backlog).reduce(BacklogCounts.empty(),BacklogCounts::plus);
            return new Master(root.masterKey(),root.id(),root.code(),root.name(),root.classId(),root.className(),
                    root.templateId(),root.templateName(),root.sourceVersionId(),root.sourceVersion(),root.status(),backlog,
                    (int)visible.stream().map(SubProject::teamId).filter(Objects::nonNull).distinct().count(),
                    (int)matching.stream().map(SubProject::teamId).filter(Objects::nonNull).distinct().count(),
                    (int)visible.stream().filter(row->!row.id().equals(root.id())).count(),
                    (int)matching.stream().filter(row->!row.id().equals(root.id())).count(),root,
                    matching.stream().filter(row->!row.id().equals(root.id())).sorted(Comparator.comparing(SubProject::depth).thenComparing(SubProject::code)).toList());
        }).sorted(Comparator.comparing(Master::className).thenComparing(Master::name).thenComparing(Master::id)).toList();
    }
    private Dashboard dashboard(Snapshot snapshot) {
        var masters=masters(snapshot);var matching=snapshot.matching();
        Map<Status,Long> counts=new EnumMap<>(Status.class);
        for(Status status:Status.values()) counts.put(status,masters.stream().filter(master->master.status()==status).count());
        Set<Long> teams=matching.stream().map(SubProject::teamId).filter(Objects::nonNull).collect(Collectors.toSet());
        Set<Long> shared=matching.stream().filter(row->row.id().equals(row.masterId())&&row.teamId()==null).map(SubProject::masterId).collect(Collectors.toSet());
        snapshot.all().stream().filter(row->shared.contains(row.masterId())).map(SubProject::teamId).filter(Objects::nonNull).forEach(teams::add);
        var summary=new Summary(masters.size(),counts.get(Status.ACTIVE),
                masters.stream().map(Master::classId).distinct().count(),
                matching.stream().map(SubProject::cohortId).filter(Objects::nonNull).distinct().count(),teams.size(),
                matching.stream().filter(row->row.parentProjectId()!=null).count(),
                masters.stream().map(Master::backlog).reduce(BacklogCounts.empty(),BacklogCounts::plus),
                matching.stream().filter(row->row.overdueMilestones()>0).count(),
                matching.stream().filter(row->!row.inactiveMembers().isEmpty()).count(),
                matching.stream().flatMap(row->row.inactiveMembers().stream()).map(InactiveMember::userId).distinct().count(),
                matching.stream().filter(row->row.lateMilestones()>0).count());
        Filter filter=snapshot.filter();int from=(int)Math.min((long)filter.page()*filter.size(),masters.size());
        return new Dashboard(summary,counts,masters.subList(from,Math.min(from+filter.size(),masters.size())),
                masters.size(),filter.page(),filter.size(),snapshot.asOf(),settings.getTimeZone(),inactivity.inactiveWindow().toDays());
    }
    private List<SubProject> rows(ProjectReportQueryRepository.Source source,Instant now,boolean includeActivity) {
        Map<Long,List<InactiveMember>> inactive=includeActivity?activity.load(source,now):Map.of();
        List<SubProject> result=new ArrayList<>();
        for(var entry:source.entries().values()) {
            var project=entry.project();var root=entry.root();var school=entry.school();var owner=entry.owner();
            var stages=source.milestones().getOrDefault(project.getId(),List.of());
            var items=source.backlogs().getOrDefault(project.getId(),List.of());
            List<MilestoneRow> milestoneRows=new ArrayList<>();
            for(var stage:stages) {
                var submitted=source.submissions().get(stage.getId());
                var flags=risks.evaluate(stage.lifecycleStatus(),stage.getDeadline(),submitted!=null&&submitted.late(),project.getStatus(),now);
                var taskCounts=ProjectReportQueryRepository.counts(items.stream().filter(item->item.getMilestone()!=null&&stage.getId().equals(item.getMilestone().getId())).toList());
                milestoneRows.add(new MilestoneRow(stage.getId(),stage.getTitle(),stage.lifecycleStatus().name(),stage.isMandatory(),stage.getDeadline(),
                        taskCounts,submitted==null?null:submitted.latestAt(),flags.overdue(),flags.late()));
            }
            milestoneRows.sort(Comparator.comparing(MilestoneRow::deadline,Comparator.nullsLast(Comparator.naturalOrder())).thenComparing(MilestoneRow::title));
            var assignment=root.getTemplateSnapshotId()==null?null:source.snapshots().get(root.getTemplateSnapshotId());
            Long templateId=assignment==null?null:assignment.getTemplateId();
            Long versionId=queries.sourceVersionId(assignment);
            String templateName=assignment==null||assignment.getTemplate()==null?root.getName():assignment.getTemplate().getName();
            if(assignment==null) {
                var rootEntry=source.entries().get(root.getId());
                var rootOwner=rootEntry==null?null:rootEntry.owner();
                if(rootOwner!=null&&root.getId().equals(rootOwner.getProjectId())) {
                    var template=rootOwner.getProjectTemplate();
                    if(template!=null&&(template.getTenantId()==null||school.getTenantId().equals(template.getTenantId()))) {
                        templateId=template.getId();templateName=template.getName();versionId=rootOwner.getProjectTemplateVersionId();
                    }
                }
            }
            ProjectTemplateSnapshot version=versionId==null?null:source.snapshots().get(versionId);
            if(version==null||!Objects.equals(templateId,version.getTemplateId())) {versionId=null;version=null;}
            Long mentorId=owner==null?school.getMentorId():owner.getAssignedMentorId();
            result.add(new SubProject(project.getId(),project.getCode(),project.getName(),
                    project.getParentProject()==null?null:project.getParentProject().getId(),entry.depth(),
                    root.getId(),root.getCode(),root.getName(),"project:"+root.getId(),
                    school.getId(),school.getName(),school.getCohortId(),school.getCohortName(),school.getProgramId(),school.getProgramName(),
                    owner==null?null:owner.getId(),owner==null?null:owner.getTeamName(),mentorId,source.mentors().getOrDefault(mentorId,"Chưa gán Mentor"),
                    templateId,templateName,versionId,version==null?"Chưa xác định phiên bản":version.getVersion(),
                    entry.workspaceId(),statuses.evaluate(project.getStatus()),statuses.evaluate(root.getStatus()),
                    ProjectReportQueryRepository.counts(items),(int)stages.stream().filter(stage->stage.lifecycleStatus()==MilestoneLifecycleStatus.ACCEPTED).count(),
                    List.copyOf(milestoneRows),(int)milestoneRows.stream().filter(MilestoneRow::overdue).count(),
                    (int)milestoneRows.stream().filter(MilestoneRow::lateSubmission).count(),inactive.getOrDefault(project.getId(),List.of()),
                    project.getCreatedAt()==null?null:project.getCreatedAt().atZone(settings.zone()).toInstant(),entry.contextOnly()));
        }
        result.sort(Comparator.comparing(SubProject::className).thenComparing(SubProject::masterId).thenComparing(SubProject::depth).thenComparing(SubProject::id));
        return List.copyOf(result);
    }
    private boolean matches(SubProject row,Filter filter) {
        if(!eq(filter.programId(),row.programId())||!eq(filter.cohortId(),row.cohortId())||!eq(filter.classId(),row.classId())
                ||!eq(filter.mentorId(),row.mentorId())||!eq(filter.templateId(),row.templateId())
                ||!eq(filter.sourceVersionId(),row.sourceVersionId())||!eq(filter.teamId(),row.teamId())||!eq(filter.projectId(),row.id()))return false;
        if(!filter.includeCancelled()&&(row.status()==Status.CANCELLED||row.masterStatus()==Status.CANCELLED)
                ||filter.status()!=null&&filter.status()!=row.status()||filter.masterStatus()!=null&&filter.masterStatus()!=row.masterStatus())return false;
        if(filter.createdFrom()!=null&&(row.createdAt()==null||row.createdAt().atZone(settings.zone()).toLocalDate().isBefore(filter.createdFrom())))return false;
        if(filter.createdTo()!=null&&(row.createdAt()==null||row.createdAt().atZone(settings.zone()).toLocalDate().isAfter(filter.createdTo())))return false;
        if(!filter.q().isEmpty()&&!String.join(" ",row.name(),row.code(),row.masterName(),row.masterCode(),row.className(),
                Objects.toString(row.teamName(),""),row.templateName(),row.mentorName()).toLowerCase(Locale.ROOT).contains(filter.q().toLowerCase(Locale.ROOT)))return false;
        return switch(filter.risk()) {case ALL->true;case OVERDUE->row.overdueMilestones()>0;
            case INACTIVE_MEMBERS->!row.inactiveMembers().isEmpty();case LATE_SUBMISSION->row.lateMilestones()>0;
            case NEEDS_ATTENTION->row.overdueMilestones()>0||!row.inactiveMembers().isEmpty();};
    }
    private boolean eq(Long wanted,Long actual){return wanted==null||Objects.equals(wanted,actual);}
    private void validate(Filter filter) {
        if(filter.page()<0||filter.size()<1||filter.size()>50||filter.q().length()>120)throw invalid("Invalid page, page size or search text");
        if(filter.createdFrom()!=null&&filter.createdTo()!=null&&filter.createdFrom().isAfter(filter.createdTo()))throw invalid("Ngày bắt đầu phải trước hoặc bằng ngày kết thúc");
        if((filter.status()==Status.CANCELLED||filter.masterStatus()==Status.CANCELLED)&&!filter.includeCancelled())throw invalid("Bật hiển thị Project đã hủy trước khi lọc CANCELLED");
        for(Long id:new Long[]{filter.programId(),filter.cohortId(),filter.classId(),filter.mentorId(),filter.templateId(),filter.sourceVersionId(),filter.teamId(),filter.projectId()})
            if(id!=null&&id<=0)throw invalid("Filter IDs must be positive");
    }
    private void validateScope(Filter filter,List<SubProject> rows) {
        check(filter.programId(),rows,SubProject::programId);check(filter.cohortId(),rows,SubProject::cohortId);check(filter.classId(),rows,SubProject::classId);
        check(filter.mentorId(),rows,SubProject::mentorId);check(filter.templateId(),rows,SubProject::templateId);
        check(filter.sourceVersionId(),rows,SubProject::sourceVersionId);check(filter.teamId(),rows,SubProject::teamId);check(filter.projectId(),rows,SubProject::id);
    }
    private void check(Long id,List<SubProject> rows,Function<SubProject,Long> field) {
        if(id!=null&&rows.stream().noneMatch(row->id.equals(field.apply(row))))throw new AccessDeniedException("Bộ lọc nằm ngoài dữ liệu báo cáo được phép xem");
    }
    private ResponseStatusException invalid(String message){return new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY,message);}
}
