package com.example.starter_project_2025.init;

import com.example.starter_project_2025.system.demo.course.Course;
import com.example.starter_project_2025.system.demo.course.CourseRepository;
import com.example.starter_project_2025.system.demo.lesson.Lesson;
import com.example.starter_project_2025.system.demo.lesson.LessonRepository;
import com.example.starter_project_2025.system.demo.qna.LessonAnswer;
import com.example.starter_project_2025.system.demo.qna.LessonAnswerRepository;
import com.example.starter_project_2025.system.demo.qna.LessonQuestion;
import com.example.starter_project_2025.system.demo.qna.LessonQuestionRepository;
import com.example.starter_project_2025.system.rbac.user.User;
import com.example.starter_project_2025.system.rbac.user.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * Demo student questions on the "Java Fundamentals" course so the AI "Where students get stuck" analysis has something to show:
 * - "Inheritance and polymorphism": 9 questions in 3 clear topics (overriding vs overloading, super/constructors, reference vs object type)
 * - "Variables and data types":     7 questions (integer division, String vs char, constants)
 * - "Classes and objects":          4 questions (class vs object, constructors)
 * - "Install Java ...":             1 question (too few to analyse on purpose)
 * Safe to run on every start: a question that already exists is skipped. Disable with app.demo.qna-insight=false.
 */
@Slf4j
@Order(30)
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(name = "app.demo.qna-insight", havingValue = "true", matchIfMissing = true)
public class QnaInsightDemoDataInitializer implements CommandLineRunner {

    private static final String COURSE_NAME = "Java Fundamentals";
    private static final String TEACHER_EMAIL = "teacher@example.com";

    /** lesson title, question, upvotes, teacher answer (null = still unanswered). */
    private record Seed(String lesson, String content, int upvotes, String answer) {
    }

    private static final List<Seed> SEEDS = List.of(
            // ---- Inheritance and polymorphism: 9 questions, 7 unanswered ----
            new Seed("Inheritance and polymorphism", "What is the difference between method overriding and overloading?", 6, null),
            new Seed("Inheritance and polymorphism", "If I change the parameters of a method in the child class, is that still overriding?", 4, null),
            new Seed("Inheritance and polymorphism", "Why does the @Override annotation give me a compile error?", 3, null),
            new Seed("Inheritance and polymorphism", "Can I override a static method in a subclass?", 2,
                    "Static methods belong to the class, so they are hidden, not overridden. Call them through the class name."),
            new Seed("Inheritance and polymorphism", "Overloading vs overriding: which one is decided at runtime?", 5, null),
            new Seed("Inheritance and polymorphism", "When do I need to call super() in a constructor?", 2, null),
            new Seed("Inheritance and polymorphism", "Why do I get 'constructor Animal() is undefined' in my subclass?", 3,
                    "If the parent class has no no-argument constructor, the child must call super(...) with the right arguments."),
            new Seed("Inheritance and polymorphism", "If Animal a = new Dog(), why can't I call the methods that only Dog has?", 4, null),
            new Seed("Inheritance and polymorphism", "Which version of the method runs: the one in Animal or the one in Dog?", 2, null),

            // ---- Variables and data types: 7 questions, 3 unanswered ----
            new Seed("Variables and data types", "Why does 5 / 2 print 2 instead of 2.5 in Java?", 5,
                    "Both operands are int, so Java uses integer division. Make one of them a double, for example 5 / 2.0."),
            new Seed("Variables and data types", "I wrote double result = 7 / 2; and got 3.0. How do I get 3.5?", 4, null),
            new Seed("Variables and data types", "Is there a difference between 10 / 4 and 10 / 4.0?", 2,
                    "Yes. The first is integer division (2), the second is floating-point division (2.5)."),
            new Seed("Variables and data types", "Why is my average calculation wrong when both numbers are int?", 3, null),
            new Seed("Variables and data types", "What is the difference between 'a' and \"a\" in Java?", 1,
                    "'a' is a single char. \"a\" is a String object with one character."),
            new Seed("Variables and data types", "Can I store a whole word in a char variable?", 1, null),
            new Seed("Variables and data types", "Do I always have to write final for constants?", 0,
                    "It is not forced by the compiler, but final prevents accidental changes and shows your intent."),

            // ---- Classes and objects: 4 questions, 1 unanswered ----
            new Seed("Classes and objects", "What is the difference between a class and an object?", 3,
                    "A class is the blueprint. An object is one thing created from that blueprint with new."),
            new Seed("Classes and objects", "Is an object the same thing as an instance?", 1,
                    "Yes. An instance is simply an object of a particular class."),
            new Seed("Classes and objects", "Why do we write new before the constructor name?", 2, null),
            new Seed("Classes and objects", "Can a class have more than one constructor?", 1,
                    "Yes, as long as their parameter lists differ (constructor overloading)."),

            // ---- Only one question: below the analysis threshold on purpose ----
            new Seed("Install Java and write your first program", "JAVA_HOME is not set. What should I do on Windows?", 2, null)
    );

    private final CourseRepository courseRepository;
    private final LessonRepository lessonRepository;
    private final UserRepository userRepository;
    private final LessonQuestionRepository questionRepository;
    private final LessonAnswerRepository answerRepository;

    @Override
    @Transactional
    public void run(String... args) {
        Optional<Course> course = courseRepository.findByName(COURSE_NAME);
        Optional<User> teacher = userRepository.findByEmail(TEACHER_EMAIL);
        if (course.isEmpty() || teacher.isEmpty()) {
            log.info("Q&A insight demo data skipped: course '{}' or teacher '{}' not found.", COURSE_NAME, TEACHER_EMAIL);
            return;
        }

        List<User> students = new ArrayList<>();
        userRepository.findByEmail("student@example.com").ifPresent(students::add);
        for (int i = 1; i <= 12; i++) {
            userRepository.findByEmail(String.format("student%02d@example.com", i)).ifPresent(students::add);
        }
        if (students.isEmpty()) {
            log.info("Q&A insight demo data skipped: no seed students found.");
            return;
        }

        Map<String, Lesson> lessonsByTitle = new HashMap<>();
        for (Lesson lesson : lessonRepository.findByCourseIdOrdered(course.get().getId())) {
            lessonsByTitle.putIfAbsent(lesson.getTitle(), lesson);
        }

        int created = 0;
        for (int i = 0; i < SEEDS.size(); i++) {
            Seed seed = SEEDS.get(i);
            Lesson lesson = lessonsByTitle.get(seed.lesson());
            if (lesson == null) continue;

            User author = students.get(i % students.size());
            if (questionRepository.existsByLesson_IdAndAuthor_IdAndContentIgnoreCase(
                    lesson.getId(), author.getId(), seed.content())) {
                continue;
            }

            LessonQuestion question = questionRepository.save(LessonQuestion.builder()
                    .lesson(lesson)
                    .author(author)
                    .content(seed.content())
                    .upvoteCount(seed.upvotes())
                    .build());
            if (seed.answer() != null) {
                answerRepository.save(LessonAnswer.builder()
                        .question(question)
                        .author(teacher.get())
                        .content(seed.answer())
                        .build());
            }
            created++;
        }
        log.info("Q&A insight demo data ensured for '{}': {} new question(s).", COURSE_NAME, created);
    }
}