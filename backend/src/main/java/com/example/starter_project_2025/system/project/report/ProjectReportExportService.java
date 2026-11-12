package com.example.starter_project_2025.system.project.report;

import com.example.starter_project_2025.system.project.task.TaskRequestContext;
import com.example.starter_project_2025.system.rbac.user.User;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.persistence.EntityManager;
import jakarta.persistence.LockModeType;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.server.ResponseStatusException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.format.DateTimeFormatter;
import java.util.Arrays;
import java.util.HexFormat;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import static com.example.starter_project_2025.system.project.report.ProjectReportDtos.*;
import static com.example.starter_project_2025.system.project.report.ProjectReportExportJob.State;

@Service @RequiredArgsConstructor @Slf4j
public class ProjectReportExportService {
    public record Download(String fileName,String contentType,byte[] bytes) { }
    private record Attempt(Download download,ResponseStatusException error) { }
    private record Claim(UUID id,Long actor,Long tenant,String filters) { }
    private final ProjectReportScopeService scope;
    private final ProjectReportService reports;
    private final ProjectReportSettings settings;
    private final ProjectReportExportRepository jobs;
    private final ProjectReportExcelWriter writer;
    private final EntityManager em;
    private final ObjectMapper json;
    private final PlatformTransactionManager transactions;
    @Autowired @Qualifier("projectReportClock") private Clock clock;

    @Transactional
    public ExportView request(UUID key,ExportRequest request) {
        var actor=scope.current(ProjectReportScopeService.EXPORT);
        if(key==null||request==null)throw error(422,"Idempotency-Key và nội dung yêu cầu là bắt buộc");
        String format=request.format()==null?"EXCEL":request.format().trim().toUpperCase(Locale.ROOT);
        if(!"EXCEL".equals(format))throw error(422,"Báo cáo chỉ hỗ trợ xuất Excel (.xlsx)");
        Filter raw=(request.filters()==null?Filter.empty():request.filters()).normalized();
        Filter filter=new Filter(raw.programId(),raw.cohortId(),raw.classId(),raw.mentorId(),raw.templateId(),raw.sourceVersionId(),raw.teamId(),raw.projectId(),
                raw.status(),raw.risk(),raw.includeCancelled(),raw.createdFrom(),raw.createdTo(),raw.q(),0,10,raw.masterStatus(),raw.masterId(),raw.workSprintId());
        String encoded=encode(filter),fingerprint=hash(format+":"+encoded);
        em.find(User.class,actor.id(),LockModeType.PESSIMISTIC_WRITE);
        var existing=jobs.findByActorIdAndRequestId(actor.id(),key);
        if(existing.isPresent()) {
            if(!existing.get().getFingerprint().equals(fingerprint))throw error(409,"Yêu cầu xuất này đã được dùng với bộ lọc khác");
            if(!existing.get().getTenantId().equals(actor.tenantId()))throw error(403,"Báo cáo nằm ngoài tenant hiện tại");
            return view(existing.get());
        }
        reports.validateExport(actor.id(),filter); // Validate all filters, including the work-only Sprint, before creating a job.
        var job=new ProjectReportExportJob();job.setId(UUID.randomUUID());job.setActorId(actor.id());job.setTenantId(actor.tenantId());
        job.setRequestId(key);job.setFingerprint(fingerprint);job.setFiltersJson(encoded);job.setFormat(format);job.setStatus(State.QUEUED);
        job.setCorrelationId(TaskRequestContext.currentCorrelationId());job.setCreatedAt(clock.instant());jobs.saveAndFlush(job);audit(job,"REQUESTED");
        return view(job);
    }
    @Transactional(readOnly=true)
    public List<ExportView> list() {
        var actor=scope.current(ProjectReportScopeService.EXPORT);
        return jobs.summaries(actor.id(),actor.tenantId(),PageRequest.of(0,20)).stream().map(j->new ExportView(j.getId(),
                expired(j.getStatus(),j.getExpiresAt())?State.EXPIRED.name():j.getStatus().name(),j.getFormat(),j.getFileName(),j.getCreatedAt(),
                j.getGeneratedAt(),j.getExpiresAt(),j.getRowCount(),j.getMessage())).toList();
    }
    @Transactional(readOnly=true)
    public ExportView get(UUID id) {return view(owned(id,scope.current(ProjectReportScopeService.EXPORT),false));}

    public void process(UUID id) {
        Claim claim=tx().execute(status->{var job=em.find(ProjectReportExportJob.class,id,LockModeType.PESSIMISTIC_WRITE);
            if(job==null||job.getStatus()!=State.QUEUED||!"EXCEL".equals(job.getFormat()))return null;
            job.setStatus(State.RUNNING);job.setStartedAt(clock.instant());audit(job,"STARTED");
            return new Claim(id,job.getActorId(),job.getTenantId(),job.getFiltersJson());});
        if(claim==null)return;
        try {
            var data=reports.exportData(claim.actor(),json.readValue(claim.filters(),Filter.class));
            var snapshot=data.snapshot();
            if(!claim.tenant().equals(snapshot.actor().tenantId()))throw error(403,"Tenant đã thay đổi");
            byte[] bytes=writer.write(data);
            Set<String> includedMasters=snapshot.matching().stream().map(SubProject::masterKey).collect(Collectors.toSet());
            // Recheck the authorized hierarchy used to build the report at download time.
            String contributors=encode(snapshot.all().stream().filter(r->!r.contextOnly()&&includedMasters.contains(r.masterKey())).map(SubProject::id).toList());
            tx().executeWithoutResult(status->{var job=em.find(ProjectReportExportJob.class,id,LockModeType.PESSIMISTIC_WRITE);
                if(job==null||job.getStatus()!=State.RUNNING)return;
                Instant now=clock.instant();job.setFileContent(bytes);job.setProjectIds(contributors);job.setGeneratedAt(snapshot.asOf());
                job.setExpiresAt(now.plus(Duration.ofHours(settings.getExportTtlHours())));job.setRowCount((long)snapshot.matching().size());
                job.setFileName("project-reports-"+DateTimeFormatter.ofPattern("uuuuMMdd-HHmmss").withZone(settings.zone()).format(now)
                        +"-"+id.toString().substring(0,8)+".xlsx");
                job.setStatus(State.READY);audit(job,"READY");audit(job,"EXPORT_MOCK_PROJECT_DASHBOARD");});
        } catch(Exception failure) {
            log.warn("Project report export {} failed",id,failure);
            tx().executeWithoutResult(status->{var job=em.find(ProjectReportExportJob.class,id,LockModeType.PESSIMISTIC_WRITE);
                if(job!=null&&job.getStatus()==State.RUNNING){job.setStatus(State.FAILED);job.setFileContent(null);
                    job.setMessage("Không thể tạo báo cáo. Quyền, phạm vi hoặc dữ liệu có thể đã thay đổi; hãy tạo lại yêu cầu.");audit(job,"FAILED");}});
        }
    }
    public Download download(UUID id) {
        Attempt attempt=tx().execute(status->{var actor=scope.current(ProjectReportScopeService.EXPORT);var job=owned(id,actor,true);
            if(expired(job.getStatus(),job.getExpiresAt())||job.getStatus()==State.EXPIRED){
                if(job.getStatus()!=State.EXPIRED){job.setStatus(State.EXPIRED);job.setFileContent(null);audit(job,"EXPIRED");}
                return new Attempt(null,error(410,"Báo cáo đã hết hạn; hãy tạo báo cáo mới"));
            }
            if(job.getStatus()!=State.READY||job.getFileContent()==null)return new Attempt(null,error(409,"Báo cáo chưa sẵn sàng tải"));
            try {
                Set<Long> current=reports.readableProjectIds(actor);
                List<Long> contributors=Arrays.asList(json.readValue(job.getProjectIds(),Long[].class));
                if(!current.containsAll(contributors)){audit(job,"DOWNLOAD_DENIED");return new Attempt(null,error(403,"Phạm vi xem báo cáo đã thay đổi; hãy tạo lại báo cáo"));}
            } catch(ResponseStatusException failure){throw failure;} catch(Exception invalid){return new Attempt(null,error(409,"Không thể kiểm tra phạm vi của báo cáo; hãy tạo lại"));}
            audit(job,"DOWNLOADED");return new Attempt(new Download(job.getFileName(),
                    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",job.getFileContent()),null);
        });
        if(attempt.error()!=null)throw attempt.error();return attempt.download();
    }
    public void expireAndRecover() {
        Instant now=clock.instant(),stale=now.minus(Duration.ofMinutes(10));
        for(UUID id:jobs.stale(now,stale,State.READY,State.RUNNING))tx().executeWithoutResult(status->{
            var job=em.find(ProjectReportExportJob.class,id,LockModeType.PESSIMISTIC_WRITE);if(job==null)return;
            if(expired(job.getStatus(),job.getExpiresAt())){job.setStatus(State.EXPIRED);job.setFileContent(null);audit(job,"EXPIRED");}
            else if(job.getStatus()==State.RUNNING&&job.getStartedAt().isBefore(stale)){
                job.setStatus(State.FAILED);job.setMessage("Quá thời gian tạo báo cáo; hãy tạo lại yêu cầu.");audit(job,"FAILED");}
        });
    }
    private ProjectReportExportJob owned(UUID id,ProjectReportScopeService.Actor actor,boolean lock) {
        var job=lock?em.find(ProjectReportExportJob.class,id,LockModeType.PESSIMISTIC_WRITE):em.find(ProjectReportExportJob.class,id);
        if(job==null||!"EXCEL".equals(job.getFormat())||!job.getActorId().equals(actor.id())||!job.getTenantId().equals(actor.tenantId()))throw error(404,"Không tìm thấy báo cáo");return job;
    }
    private boolean expired(State state,Instant at){return state==State.READY&&at!=null&&!clock.instant().isBefore(at);}
    private ExportView view(ProjectReportExportJob job){return new ExportView(job.getId(),expired(job.getStatus(),job.getExpiresAt())?State.EXPIRED.name():job.getStatus().name(),
            job.getFormat(),job.getFileName(),job.getCreatedAt(),job.getGeneratedAt(),job.getExpiresAt(),job.getRowCount(),job.getMessage());}
    private void audit(ProjectReportExportJob job,String action){var audit=new ProjectReportExportAudit();audit.setId(UUID.randomUUID());audit.setJobId(job.getId());
        audit.setActorId(job.getActorId());audit.setTenantId(job.getTenantId());audit.setAction(action);audit.setOccurredAt(clock.instant());audit.setCorrelationId(job.getCorrelationId());em.persist(audit);}
    private TransactionTemplate tx(){return new TransactionTemplate(transactions);}
    private String encode(Object value){try{return json.writeValueAsString(value);}catch(Exception failure){throw new IllegalStateException("Unable to serialize report request",failure);}}
    private String hash(String value){try{return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8)));}
        catch(Exception failure){throw new IllegalStateException(failure);}}
    private ResponseStatusException error(int status,String message){return new ResponseStatusException(HttpStatus.valueOf(status),message);}
}
