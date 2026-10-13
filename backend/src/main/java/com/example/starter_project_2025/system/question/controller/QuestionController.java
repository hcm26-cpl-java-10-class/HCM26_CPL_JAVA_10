package com.example.starter_project_2025.system.question.controller;

import com.example.starter_project_2025.base.crud.controller.BaseCrudController;
import com.example.starter_project_2025.base.crud.service.BaseCrudService;
import com.example.starter_project_2025.system.question.domain.Question;
import com.example.starter_project_2025.system.question.dto.QuestionDTO;
import com.example.starter_project_2025.system.question.dto.QuestionFilter;
import com.example.starter_project_2025.system.question.service.QuestionServiceImpl;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/questions")
@RequiredArgsConstructor
public class QuestionController extends BaseCrudController<Long, QuestionDTO, QuestionFilter> {

    private final QuestionServiceImpl service;

    @Override
    protected BaseCrudService<Long, QuestionDTO, QuestionFilter> getService() { return service; }

    @PutMapping("/{id}")
    public ResponseEntity<QuestionDTO> updateQuestion(
            @PathVariable Long id,
            @Valid @RequestBody QuestionDTO dto) {

        QuestionDTO updated = service.update(id, dto);

        return ResponseEntity.ok(updated);
    }
}