package com.example.starter_project_2025.system.exam.report;

import com.example.starter_project_2025.security.UserPrincipal;
import com.example.starter_project_2025.system.exam.analytics.dto.ExamItemAnalysisDTO;
import com.example.starter_project_2025.system.exam.analytics.service.ExamItemAnalysisService;
import com.example.starter_project_2025.system.exam.gradebook.GradebookDTOs.ColumnDto;
import com.example.starter_project_2025.system.exam.gradebook.GradebookDTOs.Gradebook;
import com.example.starter_project_2025.system.exam.gradebook.GradebookDTOs.StudentRow;
import com.example.starter_project_2025.system.exam.gradebook.GradebookService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.List;

/** Builds the tables behind the item-analysis and gradebook report downloads. */
@Service
@RequiredArgsConstructor
public class ExamReportService {

    private final ExamItemAnalysisService itemAnalysisService;
    private final GradebookService gradebookService;

    public ReportTable itemAnalysis(Long examId) {
        ExamItemAnalysisDTO dto = itemAnalysisService.analyze(examId);
        List<List<String>> rows = new ArrayList<>();
        for (ExamItemAnalysisDTO.ItemDTO i : dto.items()) {
            rows.add(List.of(
                    String.valueOf(i.order()),
                    str(i.content()),
                    i.type() == null ? "" : i.type().name(),
                    String.valueOf(i.points()),
                    String.valueOf(i.attempts()),
                    String.valueOf(i.answered()),
                    pct(i.correctRate()),
                    num(i.difficultyIndex()),
                    str(i.difficultyLevel()),
                    num(i.discrimination()),
                    str(i.discriminationLevel()),
                    i.flags() == null ? "" : String.join(", ", i.flags())));
        }
        List<String> sub = new ArrayList<>();
        sub.add("Exam: " + str(dto.examTitle()));
        sub.add("Analyzed attempts: " + dto.analyzedAttempts() + " | Flagged items: " + dto.flaggedItems()
                + " | Average difficulty: " + num(dto.averageDifficultyIndex()));
        if (dto.completion() != null) {
            sub.add("Started: " + dto.completion().started() + " | Submitted: " + dto.completion().submitted()
                    + " | Completion rate: " + pct(dto.completion().completionRate()));
        }
        return new ReportTable("Item Analysis",
                sub,
                List.of("#", "Question", "Type", "Points", "Attempts", "Answered", "Correct rate",
                        "Difficulty (p)", "Level", "Discrimination (D)", "Level", "Flags"),
                rows);
    }

    public ReportTable gradebook(Long courseId, UserPrincipal principal) {
        Gradebook gb = gradebookService.getGradebook(courseId, principal);
        List<String> headers = new ArrayList<>(List.of("Code", "Student", "Email"));
        for (ColumnDto c : gb.columns()) {
            headers.add(str(c.name()) + " (" + plain(c.weightPercent()) + "%)");
        }
        headers.add("Final");
        List<List<String>> rows = new ArrayList<>();
        for (StudentRow s : gb.students()) {
            List<String> row = new ArrayList<>(List.of(str(s.code()), str(s.name()), str(s.email())));
            for (ColumnDto c : gb.columns()) {
                BigDecimal score = s.scores() == null ? null : s.scores().get(c.id());
                BigDecimal bonus = s.bonuses() == null ? null : s.bonuses().get(c.id());
                String cell = score == null ? "" : plain(score);
                if (bonus != null && bonus.signum() != 0) {
                    cell += (cell.isEmpty() ? "" : " ") + "(+" + plain(bonus) + ")";
                }
                row.add(cell);
            }
            row.add(plain(s.finalScore()));
            rows.add(row);
        }
        return new ReportTable("Gradebook",
                List.of("Course: " + str(gb.courseName()), "Total weight: " + plain(gb.totalWeight()) + "%"
                        + (gb.unsaved() ? " | Not saved yet" : "")),
                headers, rows);
    }

    private static String str(String s) {
        return s == null ? "" : s;
    }

    private static String num(Double d) {
        return d == null ? "" : BigDecimal.valueOf(d).setScale(2, RoundingMode.HALF_UP).toPlainString();
    }

    private static String pct(Double d) {
        return d == null ? "" : BigDecimal.valueOf(d * 100).setScale(1, RoundingMode.HALF_UP).toPlainString() + "%";
    }

    private static String plain(BigDecimal b) {
        return b == null ? "" : b.stripTrailingZeros().toPlainString();
    }
}
