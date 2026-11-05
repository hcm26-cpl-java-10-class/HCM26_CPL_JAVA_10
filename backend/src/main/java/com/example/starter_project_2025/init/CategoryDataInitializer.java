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

/** Seed sample categories (idempotent: matched by code). */
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
        Category programming = upsert("PROGRAMMING", "Programming & Technology", "Software development and programming courses", null, 10);
        upsert("WEB_DEV", "Web Development", "Frontend, backend, and full-stack web development", programming, 10);
        upsert("MOBILE_DEV", "Mobile Development", "Android, iOS, and cross-platform application development", programming, 20);
        upsert("JAVA", "Java Programming", "Java language and the Spring ecosystem", programming, 30);

        Category data = upsert("DATA_AI", "Data & AI", "Data analysis and artificial intelligence", null, 20);
        upsert("MACHINE_LEARNING", "Machine Learning", "Traditional machine learning and deep learning", data, 10);
        upsert("DATA_ANALYSIS", "Data Analysis", "SQL, statistics, and data visualization", data, 20);

        Category design = upsert("DESIGN", "Design & Graphics", "Visual and product design", null, 30);
        upsert("UI_UX", "UI/UX Design", "User interface and user experience design", design, 10);

        Category business = upsert("BUSINESS", "Business & Management", "Business, management, and professional skills", null, 40);
        upsert("MARKETING", "Marketing & Communications", "Digital marketing and brand development", business, 10);

        upsert("LANGUAGE", "Languages", "Language communication and exam preparation", null, 50);

        log.info("Ensured sample categories in English.");
    }

    private Category upsert(String code, String name, String description, Category parent, int displayOrder) {
        Category category = categoryRepository.findByCodeIgnoreCase(code).orElseGet(Category::new);
        category.setCode(code);
        category.setName(name);
        category.setDescription(description);
        category.setParent(parent);
        category.setDisplayOrder(displayOrder);
        category.setIsActive(true);
        return categoryRepository.save(category);
    }
}
