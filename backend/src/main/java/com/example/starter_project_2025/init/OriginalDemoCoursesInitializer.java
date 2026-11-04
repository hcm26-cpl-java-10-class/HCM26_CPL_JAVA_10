package com.example.starter_project_2025.init;

import com.example.starter_project_2025.system.demo.course.*;
import com.example.starter_project_2025.system.demo.category.*;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.CommandLineRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Profile;
import org.springframework.core.annotation.Order;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import javax.sql.DataSource;
import java.util.*;

/** Repairs only the four explicitly requested demo records, preserving other courses and enrollments. */
@Component @Order(30) @Profile("!prod & !production")
@ConditionalOnProperty(name="course.demo.seed.enabled",havingValue="true",matchIfMissing=true)
@RequiredArgsConstructor
public class OriginalDemoCoursesInitializer implements CommandLineRunner {
    private final CourseRepository repository;
    private final CourseService service;
    private final CategoryRepository categories;
    private final DataSource dataSource;
    private record Demo(String name,String category,String categoryName,String level,String description,String video) {}
    private static final List<Demo> DEMOS=List.of(
        new Demo("Java Fundamentals","JAVA","Java Programming","BEGINNER","Introduction to Java, OOP, and basic programming concepts.","iCYoaTvE9vo"),
        new Demo("Spring Boot for Beginners","JAVA","Java Programming","INTERMEDIATE","Learn backend APIs, Spring Boot architecture, and database integration.","efC0Nw5rdA4"),
        new Demo("Java Spring Boot","JAVA","Java Programming","INTERMEDIATE","Khóa học Java và phát triển backend với Spring Boot","RksqUNiIQwc"),
        new Demo("Database Design","DATA_ANALYSIS","Data Analysis","BEGINNER","ER diagrams, SQL, and relational design fundamentals.","LuVEozf3wnU")
    );
    @Override @Transactional
    public void run(String... args) throws Exception {
        try(var connection=dataSource.getConnection()) {
            if(!"H2".equalsIgnoreCase(connection.getMetaData().getDatabaseProductName())) return;
        }
        var previous=SecurityContextHolder.getContext();
        var context=SecurityContextHolder.createEmptyContext();
        context.setAuthentication(new UsernamePasswordAuthenticationToken("original-course-demo-seed",null,List.of(
            new SimpleGrantedAuthority("COURSE_READ"),new SimpleGrantedAuthority("COURSE_CREATE"),new SimpleGrantedAuthority("COURSE_UPDATE"))));
        SecurityContextHolder.setContext(context);
        try {
            for(var demo:DEMOS) {
                var category=categories.findByCodeIgnoreCase(demo.category()).orElseGet(()->Category.builder().code(demo.category()).build());
                category.setName(demo.categoryName()); category.setIsActive(true);categories.save(category);
                var matches=repository.findAll().stream().filter(c->normalize(c.getName()).equals(normalize(demo.name()))).toList();
                if(matches.size()>1)throw new IllegalStateException("Ambiguous demo Course name: "+demo.name());
                var request=CourseDTO.builder().name(demo.name()).instructor("Teacher User").instructorEmail("teacher@example.com")
                    .category(demo.category()).courseLevel(demo.level()).publicationStatus("PUBLISHED")
                    .description(demo.description()).thumbnailUrl("https://img.youtube.com/vi/"+demo.video()+"/hqdefault.jpg").build();
                request.setIsActive(true);
                if(matches.isEmpty())service.create(request);else service.update(matches.getFirst().getId(),request);
            }
        } finally {SecurityContextHolder.setContext(previous);}
    }
    private static String normalize(String name){return java.text.Normalizer.normalize(name,java.text.Normalizer.Form.NFKC).strip().replaceAll("\\s+"," ").toLowerCase(Locale.ROOT);}
}
