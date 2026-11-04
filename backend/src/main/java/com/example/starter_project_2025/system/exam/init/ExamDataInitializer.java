package com.example.starter_project_2025.system.exam.init;

import com.example.starter_project_2025.system.exam.domain.Exam;
import com.example.starter_project_2025.system.exam.domain.ExamCategory;
import com.example.starter_project_2025.system.exam.domain.ExamRepository;
import com.example.starter_project_2025.system.exam.domain.ExamType;
import com.example.starter_project_2025.system.exam.domain.ResultVisibility;
import com.example.starter_project_2025.system.question.domain.EssayGradingCriterion;
import com.example.starter_project_2025.system.question.domain.Question;
import com.example.starter_project_2025.system.question.domain.QuestionOption;
import com.example.starter_project_2025.system.question.domain.QuestionRepository;
import com.example.starter_project_2025.system.question.domain.QuestionType;
import com.example.starter_project_2025.system.rbac.user.User;
import com.example.starter_project_2025.system.rbac.user.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Tao san mot bo de thi mau (Assessment) tu ngan hang cau hoi mau.
 * Chay sau khi ung dung khoi dong xong (de ngan hang cau hoi da duoc tao) va chi tao de nao chua co (theo tieu de),
 * nen khong ghi de du lieu da co. De thi mau khong dat lich (khong co gio mo/dong).
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class ExamDataInitializer {

    private final ExamRepository examRepository;
    private final QuestionRepository questionRepository;
    private final UserRepository userRepository;

    @EventListener(ApplicationReadyEvent.class)
    @Transactional
    public void seed() {
        List<Question> bank = questionRepository.findAll().stream()
                .filter(q -> q.getSourceQuestionId() == null && Boolean.TRUE.equals(q.getIsActive()))
                .sorted((a, b) -> Long.compare(a.getId(), b.getId()))
                .collect(Collectors.toList());
        if (bank.isEmpty()) {
            log.info("Skip sample assessments: question bank is empty.");
            return;
        }
        List<Question> mc = byType(bank, QuestionType.MULTIPLE_CHOICE);
        List<Question> essay = byType(bank, QuestionType.ESSAY);
        List<Question> coding = byType(bank, QuestionType.CODING);

        Set<String> existing = examRepository.findAll().stream().map(Exam::getTitle).collect(Collectors.toSet());
        Long creatorId = userRepository.findByEmail("admin@example.com").map(User::getId).orElse(null);
        int created = 0;

        created += create(existing, creatorId, "Java Core - Quiz trắc nghiệm 15 phút (mẫu)", 15,
                ExamCategory.QUIZ, ExamType.MULTIPLE_CHOICE, ResultVisibility.IMMEDIATE, true, "5", false,
                head(mc, 10)) ? 1 : 0;
        created += create(existing, creatorId, "Java OOP - Giữa kỳ (mẫu)", 45,
                ExamCategory.MIDTERM, ExamType.MIXED, ResultVisibility.MANUAL_RELEASE, false, "5", false,
                join(head(mc, 8), head(essay, 2))) ? 1 : 0;
        created += create(existing, creatorId, "Java - Bài tự luận (mẫu)", 60,
                ExamCategory.ASSESSMENT, ExamType.ESSAY, ResultVisibility.MANUAL_RELEASE, false, "5", false,
                head(essay, 4)) ? 1 : 0;
        created += create(existing, creatorId, "Lập trình Java - Thuật toán cơ bản (mẫu)", 45,
                ExamCategory.ASSESSMENT, ExamType.CODING, ResultVisibility.AFTER_EXAM_CLOSED, true, "5", false,
                head(coding, 5)) ? 1 : 0;
        created += create(existing, creatorId, "Java tổng hợp - Cuối kỳ (mẫu)", 90,
                ExamCategory.FINAL_TEST, ExamType.MIXED, ResultVisibility.MANUAL_RELEASE, false, "5", true,
                join(head(mc, 6), head(essay, 2), head(coding, 2))) ? 1 : 0;

        if (created > 0) {
            log.info("Created {} sample assessments.", created);
        }
    }

    private boolean create(Set<String> existing, Long creatorId, String title, int minutes, ExamCategory category,
                           ExamType type, ResultVisibility visibility, boolean showAnswers, String passScore,
                           boolean antiCheat, List<Question> sources) {
        if (existing.contains(title) || sources.isEmpty()) return false;
        Exam exam = new Exam();
        exam.setIsActive(true);
        exam.setTitle(title);
        exam.setDurationMinutes(minutes);
        exam.setCategory(category);
        exam.setExamType(type);
        exam.setResultVisibility(visibility);
        exam.setShowAnswersAfterExam(showAnswers);
        exam.setMaxScore(BigDecimal.TEN);
        exam.setPassScore(new BigDecimal(passScore));
        exam.setMaxAttempts(2);
        exam.setShuffleQuestions(true);
        exam.setShuffleOptions(true);
        exam.setAntiCheatEnabled(antiCheat);
        exam.setDetectTabSwitch(antiCheat);
        exam.setBlockCopyPaste(antiCheat);
        if (creatorId != null) exam.setCreatedBy(creatorId);
        Set<Question> copies = new LinkedHashSet<>();
        for (Question source : sources) {
            copies.add(questionRepository.save(copyOf(source)));
        }
        exam.setQuestions(copies);
        examRepository.save(exam);
        return true;
    }

    private static List<Question> byType(List<Question> bank, QuestionType type) {
        return bank.stream().filter(q -> q.getType() == type).collect(Collectors.toList());
    }

    private static List<Question> head(List<Question> list, int n) {
        return new ArrayList<>(list.subList(0, Math.min(n, list.size())));
    }

    @SafeVarargs
    private static List<Question> join(List<Question>... lists) {
        List<Question> all = new ArrayList<>();
        for (List<Question> l : lists) all.addAll(l);
        return all;
    }

    /** Ban sao rieng cua cau hoi trong de (giong cach ExamServiceImpl them cau hoi vao de). */
    private static Question copyOf(Question source) {
        Question copy = new Question();
        copy.setIsActive(Boolean.TRUE);
        copy.setContent(source.getContent());
        copy.setType(source.getType());
        copy.setDifficulty(source.getDifficulty());
        copy.setTopic(source.getTopic());
        copy.setImageUrl(source.getImageUrl());
        copy.setPoints(source.getPoints());
        copy.setCodeSpec(source.getCodeSpec());
        copy.setSourceQuestionId(source.getId());
        source.getGradingCriteria().forEach(sc -> {
            EssayGradingCriterion c = new EssayGradingCriterion();
            c.setName(sc.getName());
            c.setDescription(sc.getDescription());
            c.setWeightPercentage(sc.getWeightPercentage());
            copy.getGradingCriteria().add(c);
        });
        for (QuestionOption o : source.getOptions()) {
            QuestionOption oc = new QuestionOption();
            oc.setContent(o.getContent());
            oc.setCorrect(o.isCorrect());
            oc.setImageUrl(o.getImageUrl());
            oc.setQuestion(copy);
            copy.getOptions().add(oc);
        }
        return copy;
    }
}
