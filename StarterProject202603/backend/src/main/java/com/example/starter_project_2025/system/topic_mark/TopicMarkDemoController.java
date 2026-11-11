package com.example.starter_project_2025.system.topic_mark;

import com.example.starter_project_2025.system.topic_mark.dto.ScoreHistoryResponse;
import com.example.starter_project_2025.system.topic_mark.dto.TopicMarkDetailResponse;
import com.example.starter_project_2025.system.topic_mark.dto.TopicMarkGradebookResponse;
import com.example.starter_project_2025.system.topic_mark.dto.TopicMarkGradebookSearchResponse;
import com.example.starter_project_2025.system.topic_mark.dto.UpdateTopicMarkRequest;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/topic-marks")
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
@Tag(name = "Topic Mark Demo", description = "Demo APIs for dynamic gradebook DTO shape")
public class TopicMarkDemoController {

    TopicMarkDemoService topicMarkDemoService;

    @GetMapping("/gradebook")
    @Operation(summary = "Get non-paginated gradebook")
    public TopicMarkGradebookResponse getGradebook() {
        return topicMarkDemoService.getGradebook();
    }

    @GetMapping("/gradebook/search")
    @Operation(summary = "Search paginated gradebook")
    public TopicMarkGradebookSearchResponse searchGradebook(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size,
            @RequestParam(defaultValue = "fullName,asc") String sort,
            @RequestParam(required = false) String keyword
    ) {
        return topicMarkDemoService.searchGradebook(keyword, page, size, sort);
    }

    @GetMapping("/students/{userId}")
    @Operation(summary = "Get detailed topic marks for one student")
    public TopicMarkDetailResponse getStudentDetail(@PathVariable UUID userId) {
        return topicMarkDemoService.getStudentDetail(userId);
    }

    @PutMapping("/students/{userId}")
    @Operation(summary = "Update one student marks with reason")
    public TopicMarkDetailResponse updateStudentMarks(
            @PathVariable UUID userId,
            @Valid @RequestBody UpdateTopicMarkRequest request
    ) {
        return topicMarkDemoService.updateStudentMarks(userId, request);
    }

    @GetMapping("/history")
    @Operation(summary = "Get paginated score change history")
    public ScoreHistoryResponse getHistory(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size,
            @RequestParam(defaultValue = "updatedAt,desc") String sort
    ) {
        return topicMarkDemoService.getHistory(page, size, sort);
    }
}
