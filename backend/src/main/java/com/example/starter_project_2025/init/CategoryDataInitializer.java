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

/** Seed danh mục mẫu (idempotent: khớp theo code). */
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
        Category programming = upsert("PROGRAMMING", "Programming", "Software development courses", null);
        upsert("WEB_DEV", "Web Development", "Frontend, backend and full-stack web", programming);
        upsert("MOBILE_DEV", "Mobile Development", "Android, iOS and cross-platform apps", programming);
        upsert("JAVA", "Java", "Java language and the Spring ecosystem", programming);

        Category data = upsert("DATA_AI", "Data & AI", "Data analysis and artificial intelligence", null);
        upsert("MACHINE_LEARNING", "Machine Learning", "Classical ML and deep learning", data);
        upsert("DATA_ANALYSIS", "Data Analysis", "SQL, statistics and visualization", data);

        Category design = upsert("DESIGN", "Design", "Visual and product design", null);
        upsert("UI_UX", "UI/UX Design", "User interface and experience design", design);

        Category business = upsert("BUSINESS", "Business", "Business and soft skills", null);
        upsert("MARKETING", "Marketing", "Digital marketing and branding", business);

        upsert("LANGUAGE", "Languages", "Foreign language learning", null);

        log.info("Ensured sample categories.");
    }

    private Category upsert(String code, String name, String description, Category parent) {
        Category category = categoryRepository.findByCodeIgnoreCase(code).orElseGet(Category::new);
        category.setCode(code);
        category.setName(name);
        category.setDescription(description);
        category.setParent(parent);
        category.setIsActive(true);
        return categoryRepository.save(category);
    }
}