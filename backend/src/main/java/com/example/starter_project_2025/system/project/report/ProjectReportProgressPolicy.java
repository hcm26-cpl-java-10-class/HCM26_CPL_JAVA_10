package com.example.starter_project_2025.system.project.report;

import com.example.starter_project_2025.system.project.milestone.domain.MilestoneLifecycleStatus;
import org.springframework.stereotype.Component;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.Collection;
import java.util.List;
import static com.example.starter_project_2025.system.project.report.ProjectReportDtos.*;

@Component
public class ProjectReportProgressPolicy {
    public record Stage(BigDecimal progress, BigDecimal weight) { }
    public record Progress(BigDecimal value, String mode, List<String> notes) { }
    private static final BigDecimal HUNDRED = BigDecimal.valueOf(100);

    public BigDecimal milestone(MilestoneLifecycleStatus state, long done, long total) {
        return state==MilestoneLifecycleStatus.ACCEPTED?HUNDRED:ratio(done,total);
    }
    public BigDecimal ratio(long done,long total) {
        return total==0?BigDecimal.ZERO:BigDecimal.valueOf(done).multiply(HUNDRED)
                .divide(BigDecimal.valueOf(total),8,RoundingMode.HALF_UP).min(HUNDRED).max(BigDecimal.ZERO);
    }
    public Progress project(Status state,List<Stage> stages,ProjectReportQueryRepository.TaskCount fallback) {
        if(state==Status.DONE)return new Progress(HUNDRED,"COMPLETED",List.of());
        if(stages.isEmpty())return new Progress(round(ratio(fallback.done(),fallback.total())),"TASKS",
                List.of("Chưa có milestone; tiến độ dựa trên backlog item của Project."));
        boolean allMissing=stages.stream().allMatch(s->s.weight()==null||s.weight().signum()==0);
        if(allMissing)return new Progress(round(average(stages.stream().map(Stage::progress).toList())),"EQUAL",
                List.of("Các milestone chưa có trọng số; báo cáo chia đều trọng số."));
        if(stages.stream().anyMatch(s->s.weight()==null||s.weight().signum()<=0))
            return new Progress(null,"INCOMPLETE",List.of("Thiếu cấu hình trọng số ở một phần milestone."));
        BigDecimal total=stages.stream().map(Stage::weight).reduce(BigDecimal.ZERO,BigDecimal::add);
        if(total.compareTo(HUNDRED)!=0)return new Progress(null,"INVALID",List.of("Tổng trọng số milestone khác 100%; cần hoàn thiện cấu hình."));
        BigDecimal value=stages.stream().map(s->s.progress().multiply(s.weight())).reduce(BigDecimal.ZERO,BigDecimal::add)
                .divide(HUNDRED,8,RoundingMode.HALF_UP);
        return new Progress(round(value),"WEIGHTED",List.of());
    }
    public BigDecimal average(Collection<BigDecimal> values) {
        if(values.isEmpty()||values.stream().anyMatch(java.util.Objects::isNull))return null;
        return values.stream().reduce(BigDecimal.ZERO,BigDecimal::add).divide(BigDecimal.valueOf(values.size()),8,RoundingMode.HALF_UP);
    }
    public BigDecimal round(BigDecimal value) {return value==null?null:value.setScale(2,RoundingMode.HALF_UP);}
}
