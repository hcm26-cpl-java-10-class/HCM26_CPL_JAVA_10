package com.example.starter_project_2025.system.question.version;

import com.example.starter_project_2025.system.question.core.dto.QuestionDTO;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/questions/{questionId}/versions")
@RequiredArgsConstructor
public class QuestionVersionController {

    private final QuestionVersionService versionService;
    private final QuestionRestoreService restoreService;

    @GetMapping
    @PreAuthorize("hasAuthority('QUESTION_READ')")
    public List<QuestionVersionDTO> history(@PathVariable Long questionId) {
        return versionService.history(questionId);
    }

    @GetMapping("/compare")
    @PreAuthorize("hasAuthority('QUESTION_READ')")
    public QuestionVersionCompareDTO compare(@PathVariable Long questionId, @RequestParam int from, @RequestParam int to) {
        return versionService.compare(questionId, from, to);
    }

    @GetMapping("/{versionNumber}")
    @PreAuthorize("hasAuthority('QUESTION_READ')")
    public QuestionVersionDTO get(@PathVariable Long questionId, @PathVariable int versionNumber) {
        return versionService.get(questionId, versionNumber);
    }

    @PostMapping("/{versionNumber}/restore")
    @PreAuthorize("hasAuthority('QUESTION_UPDATE')")
    public QuestionDTO restore(@PathVariable Long questionId, @PathVariable int versionNumber) {
        return restoreService.restore(questionId, versionNumber);
    }
}
