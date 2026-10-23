package com.example.starter_project_2025.system.exam.controller;

import com.example.starter_project_2025.init.annotation.ResourceMenu;
import com.example.starter_project_2025.base.crud.controller.BaseCrudController;
import com.example.starter_project_2025.base.crud.service.BaseCrudService;
import com.example.starter_project_2025.base.crud.dto.OnUpdate;
import com.example.starter_project_2025.system.question.dto.QuestionDTO;
import org.springframework.validation.annotation.Validated;
import com.example.starter_project_2025.system.exam.dto.ExamDTO;
import com.example.starter_project_2025.system.exam.dto.ExamFilter;
import com.example.starter_project_2025.system.exam.service.ExamServiceImpl;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/exams")
@RequiredArgsConstructor
@ResourceMenu(
        title = "Lịch Thi",
        url = "/student/exams",
        group = "Student",
        icon = "calendar",
        order = 2,
        permission = "EXAM_READ"
)
public class ExamController extends BaseCrudController<Long, ExamDTO, ExamFilter> {

    private final ExamServiceImpl service;

    @Override
    protected BaseCrudService<Long, ExamDTO, ExamFilter> getService() { return service; }

    public record AddQuestionsRequest(@NotEmpty List<Long> questionIds) {}

    @PostMapping("/{id}/questions")
    public ResponseEntity<ExamDTO> addQuestions(@PathVariable Long id,
                                                @Valid @RequestBody AddQuestionsRequest req) {
        return ResponseEntity.ok(service.addQuestions(id, req.questionIds()));
    }

    @DeleteMapping("/{id}/questions/{questionId}")
    public ResponseEntity<ExamDTO> removeQuestion(@PathVariable Long id,
                                                  @PathVariable Long questionId) {
        return ResponseEntity.ok(service.removeQuestion(id, questionId));
    }

    @PutMapping("/{id}/questions/{questionId}")
    public ResponseEntity<ExamDTO> updateQuestion(@PathVariable Long id,
                                                  @PathVariable Long questionId,
                                                  @Validated(OnUpdate.class) @RequestBody QuestionDTO request) {
        return ResponseEntity.ok(service.updateQuestion(id, questionId, request));
    }

}