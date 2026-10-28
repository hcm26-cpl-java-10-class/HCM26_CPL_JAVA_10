package com.example.starter_project_2025.system.demo.student_score;

import com.example.starter_project_2025.base.crud.controller.BaseCrudDataIoController;
import com.example.starter_project_2025.base.crud.domain.BaseCrudRepository;
import com.example.starter_project_2025.base.crud.service.BaseCrudService;
import com.example.starter_project_2025.base.dataio.common.FileFormat;
import com.example.starter_project_2025.base.dataio.importer.result.ImportResult;
import com.example.starter_project_2025.init.annotation.ResourceMenu;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.web.multipart.MultipartFile;
import java.io.IOException;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/student-scores")
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
@Tag(name = "Student Score", description = "APIs for managing student scores")
@PreAuthorize("hasAuthority('STUDENT_SCORE_READ')")
@ResourceMenu(
        title = "My Scores",
        group = "Exam",
        icon = "bar-chart",
        url = "/my-scores",
        order = 3,
        permission = "STUDENT_SCORE_VIEW_OWN"
)
public class StudentScoreController
        extends BaseCrudDataIoController<StudentScore, Long, StudentScoreDTO, StudentScoreFilter> {

    StudentScoreServiceImpl studentScoreService;
    StudentScoreRepository studentScoreRepository;

    @Override
    protected BaseCrudService<Long, StudentScoreDTO, StudentScoreFilter> getService() {
        return studentScoreService;
    }

    @Override
    protected BaseCrudRepository<StudentScore, Long> getRepository() {
        return studentScoreRepository;
    }

    @Override
    protected Class<StudentScore> getEntityClass() {
        return StudentScore.class;
    }

    @Override
    @GetMapping("/export")
    @PreAuthorize("hasAuthority('STUDENT_SCORE_READ')")
    public void exportFile(
            @RequestParam(defaultValue = "EXCEL") FileFormat format,
            HttpServletResponse response
    ) throws IOException {
        super.exportFile(format, response);
    }

    @Override
    @PostMapping(value = "/import", consumes = "multipart/form-data")
    @PreAuthorize("hasAuthority('STUDENT_SCORE_CREATE')")
    public ImportResult importFile(@RequestParam("file") MultipartFile file) {
        return super.importFile(file);
    }

    public record AdjustRequest(@NotBlank String reason, @NotEmpty Map<String, BigDecimal> scores) {}

    @PostMapping("/{id}/review")
    @PreAuthorize("hasAuthority('STUDENT_SCORE_UPDATE')")
    public ResponseEntity<StudentScoreDTO> review(@PathVariable Long id) {
        return ResponseEntity.ok(studentScoreService.review(id));
    }

    @PostMapping("/{id}/release")
    @PreAuthorize("hasAuthority('STUDENT_SCORE_RELEASE')")
    public ResponseEntity<StudentScoreDTO> release(@PathVariable Long id) {
        return ResponseEntity.ok(studentScoreService.release(id));
    }

    @PostMapping("/{id}/adjustments")
    @PreAuthorize("hasAuthority('STUDENT_SCORE_RELEASE')")
    public ResponseEntity<StudentScoreDTO> adjust(@PathVariable Long id, @Valid @RequestBody AdjustRequest req) {
        return ResponseEntity.ok(studentScoreService.adjust(id, req.scores(), req.reason()));
    }

    @GetMapping("/me")
    @PreAuthorize("hasAuthority('STUDENT_SCORE_VIEW_OWN')")
    public ResponseEntity<List<StudentScoreDTO>> myScores() {
        return ResponseEntity.ok(studentScoreService.findMine());
    }
}
