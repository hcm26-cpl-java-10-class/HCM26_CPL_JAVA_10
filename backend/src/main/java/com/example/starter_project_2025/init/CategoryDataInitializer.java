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
        // Lập trình
        Category programming = upsert("PROGRAMMING", "Lập trình & Công nghệ", "Các khóa học phát triển phần mềm và lập trình", null, 10);
        upsert("WEB_DEV", "Lập trình Web", "Phát triển ứng dụng Web với Frontend, Backend và Full-stack", programming, 10);
        upsert("MOBILE_DEV", "Lập trình Di động", "Phát triển ứng dụng Android, iOS và Đa nền tảng", programming, 20);
        upsert("JAVA", "Lập trình Java", "Ngôn ngữ lập trình Java và hệ sinh thái Spring Framework", programming, 30);

        // Dữ liệu & AI
        Category data = upsert("DATA_AI", "Dữ liệu & AI", "Phân tích dữ liệu và Trí tuệ nhân tạo", null, 20);
        upsert("MACHINE_LEARNING", "Học máy (Machine Learning)", "Học máy truyền thống và Học sâu (Deep Learning)", data, 10);
        upsert("DATA_ANALYSIS", "Phân tích dữ liệu", "Truy vấn SQL, thống kê và trực quan hóa dữ liệu", data, 20);

        // Thiết kế
        Category design = upsert("DESIGN", "Thiết kế & Đồ họa", "Thiết kế hình ảnh và thiết kế sản phẩm", null, 30);
        upsert("UI_UX", "Thiết kế UI/UX", "Thiết kế giao diện và trải nghiệm người dùng", design, 10);

        // Kinh doanh
        Category business = upsert("BUSINESS", "Kinh doanh & Quản lý", "Kỹ năng kinh doanh, quản lý và kỹ năng mềm", null, 40);
        upsert("MARKETING", "Marketing & Truyền thông", "Marketing kỹ thuật số (Digital Marketing) và xây dựng thương hiệu", business, 10);

        // Ngoại ngữ
        upsert("LANGUAGE", "Ngoại ngữ", "Các khóa học luyện thi và giao tiếp ngoại ngữ", null, 50);

        log.info("Ensured sample categories in Vietnamese.");
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