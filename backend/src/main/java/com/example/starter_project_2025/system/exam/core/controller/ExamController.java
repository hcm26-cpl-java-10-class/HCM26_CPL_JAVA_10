package com.example.starter_project_2025.system.exam.core.controller;

import com.example.starter_project_2025.init.annotation.ResourceMenu;
import com.example.starter_project_2025.base.crud.controller.BaseCrudController;
import com.example.starter_project_2025.base.crud.service.BaseCrudService;
import com.example.starter_project_2025.base.crud.dto.OnUpdate;
import com.example.starter_project_2025.security.UserPrincipal;
import com.example.starter_project_2025.system.question.core.dto.QuestionDTO;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.validation.annotation.Validated;
import com.example.starter_project_2025.system.exam.core.dto.ExamDTO;
import com.example.starter_project_2025.system.exam.core.dto.ExamFilter;
import com.example.starter_project_2025.system.exam.invitation.dto.ExamInvitationOverviewDTO;
import com.example.starter_project_2025.system.exam.core.service.ExamServiceImpl;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/exams")
@RequiredArgsConstructor
@ResourceMenu(
        title = "My Exams",
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

    @PostMapping("/{id}/duplicate")
    public ResponseEntity<ExamDTO> duplicate(@PathVariable Long id) {
        return ResponseEntity.ok(service.duplicate(id));
    }

    @GetMapping("/invitations/overview")
    @PreAuthorize("hasAuthority('INVITATION_READ')")
    public ResponseEntity<List<ExamInvitationOverviewDTO>> listInvitationOverviews(
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        return ResponseEntity.ok(service.listInvitationOverviews(principal));
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