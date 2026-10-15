package com.example.starter_project_2025.init;

import com.example.starter_project_2025.system.demo.category.Category;
import com.example.starter_project_2025.system.demo.category.CategoryRepository;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * Seeds sample course categories (idempotent: matched by code, never overwrites existing rows).
 */
@Slf4j
@Order(12)
@Component
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class CategoryDataInitializer implements CommandLineRunner {

    CategoryRepository categoryRepository;

    @Override
    @Transactional
    public void run(String... args) {

        // ---- Roots ----
        Category programming = seed("PROGRAMMING", "Programming", "Software development courses", null);
        Category design = seed("DESIGN", "Design", "Design and creative courses", null);
        Category business = seed("BUSINESS", "Business", "Business and management courses", null);
        Category language = seed("LANGUAGE", "Language", "Foreign language courses", null);
        Category dataAi = seed("DATA_AI", "Data & AI", "Data analysis and artificial intelligence", null);

        // ---- Programming ----
        seed("WEB_DEV", "Web Development", "HTML, CSS, JavaScript, React and more", programming);
        seed("MOBILE_DEV", "Mobile Development", "Android, iOS and cross-platform apps", programming);
        seed("JAVA", "Java", "Java core and Spring Boot", programming);
        seed("PYTHON", "Python", "Python programming and scripting", programming);
        seed("DATABASE", "Database", "SQL, database design and administration", programming);

        // ---- Design ----
        seed("UI_UX", "UI/UX Design", "User interface and user experience design", design);
        seed("GRAPHIC_DESIGN", "Graphic Design", "Photoshop, Illustrator and visual design", design);
        seed("VIDEO_EDITING", "Video Editing", "Video production and editing", design);

        // ---- Business ----
        seed("MARKETING", "Marketing", "Digital marketing and branding", business);
        seed("MANAGEMENT", "Management", "Leadership and project management", business);
        seed("FINANCE", "Finance", "Accounting and personal finance", business);

        // ---- Language ----
        seed("ENGLISH", "English", "English communication and exam preparation", language);
        seed("JAPANESE", "Japanese", "Japanese language and JLPT", language);
        seed("KOREAN", "Korean", "Korean language and TOPIK", language);

        // ---- Data & AI ----
        seed("DATA_ANALYSIS", "Data Analysis", "Excel, Power BI and data visualization", dataAi);
        seed("MACHINE_LEARNING", "Machine Learning", "Machine learning and deep learning", dataAi);

        log.info("Ensured sample course categories.");
    }

    private Category seed(String code, String name, String description, Category parent) {

        return categoryRepository.findByCodeIgnoreCase(code).orElseGet(() ->
                categoryRepository.save(Category.builder()
                        .code(code)
                        .name(name)
                        .description(description)
                        .parent(parent)
                        .isActive(true)
                        .build()));
    }
}