package com.example.starter_project_2025.system.question.init;

import com.example.starter_project_2025.system.question.domain.*;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;

import java.util.Set;

@Component
@RequiredArgsConstructor
public class QuestionDataInitializer implements CommandLineRunner {

    private final QuestionRepository repository;

    @Override
    public void run(String... args) {
        if (repository.count() > 0) return;

        repository.save(make("Java là ngôn ngữ như thế nào?", QuestionType.SINGLE_CHOICE, Difficulty.EASY,
                "java", Set.of(2), "Chỉ biên dịch", "Chỉ thông dịch",
                "Biên dịch ra bytecode rồi chạy trên JVM", "Không phải ngôn ngữ lập trình"));

        repository.save(make("Những kiểu nào là kiểu nguyên thủy trong Java?", QuestionType.MULTI_CHOICE,
                Difficulty.MEDIUM, "java", Set.of(0, 2), "int", "String", "boolean", "List"));

        repository.save(make("HTTP status 404 nghĩa là gì?", QuestionType.SINGLE_CHOICE, Difficulty.EASY,
                "web", Set.of(1), "Lỗi server", "Không tìm thấy tài nguyên", "Thành công", "Chưa đăng nhập"));
    }

    private Question make(String content, QuestionType type, Difficulty diff, String topic,
                          Set<Integer> correct, String... opts) {
        Question q = new Question();
        q.setIsActive(true);
        q.setContent(content);
        q.setType(type);
        q.setDifficulty(diff);
        q.setTopic(topic);
        for (int i = 0; i < opts.length; i++) {
            QuestionOption o = new QuestionOption();
            o.setContent(opts[i]);
            o.setCorrect(correct.contains(i));
            o.setQuestion(q);
            q.getOptions().add(o);
        }
        return q;
    }
}