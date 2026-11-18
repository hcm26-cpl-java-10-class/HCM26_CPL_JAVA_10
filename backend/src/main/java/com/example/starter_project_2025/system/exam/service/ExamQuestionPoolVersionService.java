package com.example.starter_project_2025.system.exam.service;

import com.example.starter_project_2025.system.exam.domain.*;
import com.example.starter_project_2025.system.question.domain.Question;
import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import com.example.starter_project_2025.system.exam.dto.ExamQuestionPoolConfigResponse;
import com.example.starter_project_2025.system.exam.dto.ExamQuestionPoolVersionHistoryResponse;
import com.example.starter_project_2025.system.exam.dto.ExamQuestionPoolConfigRequest;
import com.example.starter_project_2025.exception.BadRequestException;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

@Service
@RequiredArgsConstructor
public class ExamQuestionPoolVersionService {

    private final ExamQuestionPoolVersionRepository versionRepository;
    private final ExamPoolSnapshotService snapshotService;
    private final ExamServiceImpl examService;
    private final ExamAttemptRepository examAttemptRepository;

    /**
     * Tạo phiên bản đầu tiên nếu Exam chưa có Question Pool Version.
     * Nếu đã có version thì giữ nguyên version hiện tại.
     */
    @Transactional
    public ExamQuestionPoolVersion ensureInitialVersion(Exam exam) {
        if (exam == null || exam.getId() == null) {
            throw new IllegalArgumentException(
                    "Saved exam is required"
            );
        }

        return versionRepository
                .findTopByExam_IdOrderByVersionNumberDesc(exam.getId())
                .orElseGet(() -> createVersion(
                        exam,
                        getExamQuestions(exam),
                        false,
                        1,
                        true
                ));
    }

    /**
     * Tạo version mới từ danh sách câu hỏi được cung cấp.
     * Không cập nhật hoặc xóa version cũ.
     */
    @Transactional
    public ExamQuestionPoolVersion createVersion(
            Exam exam,
            List<Question> questions,
            boolean randomSelectionEnabled,
            int randomQuestionCount,
            boolean shuffleQuestionOrder
    ) {
        if (exam == null || exam.getId() == null) {
            throw new IllegalArgumentException(
                    "Saved exam is required"
            );
        }

        if (randomSelectionEnabled && randomQuestionCount < 1) {
            throw new IllegalArgumentException(
                    "Số lượng câu hỏi random phải lớn hơn 0"
            );
        }

        List<Question> uniqueQuestions = normalizeQuestions(questions);

        if (uniqueQuestions.isEmpty()) {
            throw new BadRequestException(
                    "Question Pool phải có ít nhất một câu hỏi"
            );
        }

        if (randomSelectionEnabled
                && randomQuestionCount > uniqueQuestions.size()) {
            throw new BadRequestException(
                    "Số lượng câu hỏi random không được vượt quá Question Pool"
            );
        }

        Integer latestVersion = versionRepository
                .findTopByExam_IdOrderByVersionNumberDesc(exam.getId())
                .map(ExamQuestionPoolVersion::getVersionNumber)
                .orElse(0);

        ExamQuestionPoolVersion version =
                new ExamQuestionPoolVersion();

        version.setExam(exam);
        version.setVersionNumber(latestVersion + 1);
        version.setRandomSelectionEnabled(randomSelectionEnabled);
        version.setRandomQuestionCount(randomQuestionCount);
        version.setShuffleQuestionOrder(shuffleQuestionOrder);

        // Lưu version trước để có ID.
        version = versionRepository.save(version);

        List<ExamPoolQuestion> snapshots = new ArrayList<>();

        for (int i = 0; i < uniqueQuestions.size(); i++) {
            ExamPoolQuestion snapshot = snapshotService.createSnapshot(
                    uniqueQuestions.get(i),
                    version,
                    i
            );

            snapshots.add(snapshot);
        }

        version.setQuestions(snapshots);

        // Cascade ALL sẽ lưu các snapshot và option.
        return versionRepository.save(version);
    }

    private ExamQuestionPoolVersion updateCurrentVersion(
            ExamQuestionPoolVersion version,
            List<Question> questions,
            boolean randomSelectionEnabled,
            int randomQuestionCount,
            boolean shuffleQuestionOrder
    ) {
        version.setRandomSelectionEnabled(randomSelectionEnabled);
        version.setRandomQuestionCount(randomQuestionCount);
        version.setShuffleQuestionOrder(shuffleQuestionOrder);

        // Giữ collection hiện tại để Hibernate quản lý orphanRemoval.
        if (version.getQuestions() == null) {
            version.setQuestions(new ArrayList<>());
        } else {
            version.getQuestions().clear();

            // Buộc Hibernate xóa snapshot cũ trước khi thêm snapshot mới.
            versionRepository.saveAndFlush(version);
        }

        List<Question> uniqueQuestions = normalizeQuestions(questions);

        for (int i = 0; i < uniqueQuestions.size(); i++) {
            ExamPoolQuestion snapshot = snapshotService.createSnapshot(
                    uniqueQuestions.get(i),
                    version,
                    i
            );

            version.getQuestions().add(snapshot);
        }

        return versionRepository.save(version);
    }

    @Transactional(readOnly = true)
    public ExamQuestionPoolVersion getCurrentVersion(Long examId) {
        return versionRepository
                .findTopByExam_IdOrderByVersionNumberDesc(examId)
                .orElseThrow(() -> new EntityNotFoundException(
                        "Question Pool Version not found for exam: " + examId
                ));
    }

    private List<Question> getExamQuestions(Exam exam) {
        if (exam.getQuestions() == null) {
            return List.of();
        }

        return exam.getQuestions()
                .stream()
                .sorted(Comparator.comparing(Question::getId))
                .toList();
    }

    private List<Question> normalizeQuestions(List<Question> questions) {
        if (questions == null || questions.isEmpty()) {
            return List.of();
        }

        Set<Long> seenIds = new LinkedHashSet<>();
        List<Question> result = new ArrayList<>();

        for (Question question : questions) {
            if (question == null || question.getId() == null) {
                throw new IllegalArgumentException(
                        "Question and question ID are required"
                );
            }

            if (seenIds.add(question.getId())) {
                result.add(question);
            }
        }

        return result;
    }

    @Transactional(readOnly = true)
    public ExamQuestionPoolConfigResponse getCurrentConfig(Long examId) {
        examService.getExamForPoolConfiguration(examId);

        ExamQuestionPoolVersion version = getCurrentVersion(examId);

        ExamQuestionPoolConfigResponse response =
                new ExamQuestionPoolConfigResponse();

        response.setExamId(examId);
        response.setPoolVersionId(version.getId());
        response.setVersionNumber(version.getVersionNumber());
        response.setRandomSelectionEnabled(
                version.getRandomSelectionEnabled()
        );
        response.setRandomQuestionCount(
                version.getRandomQuestionCount()
        );
        response.setShuffleQuestionOrder(
                version.getShuffleQuestionOrder()
        );

        List<ExamPoolQuestion> questions = version.getQuestions();

        response.setTotalQuestions(
                questions == null ? 0 : questions.size()
        );

        response.setQuestionIds(
                questions == null
                        ? List.of()
                        : questions.stream()
                          .map(ExamPoolQuestion::getQuestionId)
                          .toList()
        );

        return response;
    }


    @Transactional(readOnly = true)
    public List<ExamQuestionPoolVersionHistoryResponse> getVersionHistory(
            Long examId
    ) {
        examService.getExamForPoolConfiguration(examId);

        return versionRepository
                .findByExam_IdOrderByVersionNumberDesc(examId)
                .stream()
                .map(version -> {
                    ExamQuestionPoolVersionHistoryResponse response =
                            new ExamQuestionPoolVersionHistoryResponse();

                    response.setPoolVersionId(version.getId());
                    response.setVersionNumber(version.getVersionNumber());
                    response.setRandomSelectionEnabled(
                            version.getRandomSelectionEnabled()
                    );
                    response.setRandomQuestionCount(
                            version.getRandomQuestionCount()
                    );
                    response.setShuffleQuestionOrder(
                            version.getShuffleQuestionOrder()
                    );
                    response.setTotalQuestions(
                            version.getQuestions() == null
                                    ? 0
                                    : version.getQuestions().size()
                    );

                    return response;
                })
                .toList();
    }

    @Transactional
    public ExamQuestionPoolConfigResponse saveConfig(
            Long examId,
            ExamQuestionPoolConfigRequest request
    ) {
        if (request == null) {
            throw new BadRequestException("Question Pool config không được để trống");
        }

        if (request.getRandomSelectionEnabled() == null) {
            throw new BadRequestException("Phải xác định chế độ Random Selection");
        }

        if (request.getShuffleQuestionOrder() == null) {
            throw new BadRequestException("Phải xác định chế độ trộn thứ tự câu hỏi");
        }

        // Chỉ lấy câu hỏi đã thuộc Exam, không tạo bản sao mới.
        List<Question> questions =
                examService.getQuestionsForPoolConfiguration(
                        examId,
                        request.getQuestionIds()
                );

        boolean randomEnabled = request.getRandomSelectionEnabled();

        int randomCount;

        if (randomEnabled) {
            if (request.getRandomQuestionCount() == null
                    || request.getRandomQuestionCount() < 1) {
                throw new BadRequestException(
                        "Số lượng câu hỏi random phải lớn hơn 0"
                );
            }

            if (request.getRandomQuestionCount() > questions.size()) {
                throw new BadRequestException(
                        "Số lượng câu hỏi random không được vượt quá Question Pool"
                );
            }

            randomCount = request.getRandomQuestionCount();
        } else {
            // Khi không random, Attempt sử dụng toàn bộ câu hỏi hợp lệ.
            randomCount = questions.size();
        }

        Exam exam = examService.getExamForPoolConfiguration(examId);

        ExamQuestionPoolVersion currentVersion = versionRepository
                .findTopByExam_IdOrderByVersionNumberDesc(examId)
                .orElse(null);

        ExamQuestionPoolVersion version;

        if (currentVersion == null) {
            // Chưa có Version: tạo Version đầu tiên.
            version = createVersion(
                    exam,
                    questions,
                    randomEnabled,
                    randomCount,
                    request.getShuffleQuestionOrder()
            );
        } else {
            boolean alreadyUsed = examAttemptRepository
                    .existsByPoolVersion_Id(currentVersion.getId());

            if (alreadyUsed) {
                // Version đã được Attempt sử dụng: giữ nguyên Version cũ.
                version = createVersion(
                        exam,
                        questions,
                        randomEnabled,
                        randomCount,
                        request.getShuffleQuestionOrder()
                );
            } else {
                // Version chưa được sử dụng: cập nhật ngay Version hiện tại.
                version = updateCurrentVersion(
                        currentVersion,
                        questions,
                        randomEnabled,
                        randomCount,
                        request.getShuffleQuestionOrder()
                );
            }
        }

        ExamQuestionPoolConfigResponse response =
                new ExamQuestionPoolConfigResponse();

        response.setExamId(examId);
        response.setPoolVersionId(version.getId());
        response.setVersionNumber(version.getVersionNumber());
        response.setRandomSelectionEnabled(version.getRandomSelectionEnabled());
        response.setRandomQuestionCount(version.getRandomQuestionCount());
        response.setShuffleQuestionOrder(version.getShuffleQuestionOrder());
        response.setTotalQuestions(version.getQuestions().size());

        response.setQuestionIds(
                version.getQuestions().stream()
                        .map(ExamPoolQuestion::getQuestionId)
                        .toList()
        );

        return response;
    }
}
