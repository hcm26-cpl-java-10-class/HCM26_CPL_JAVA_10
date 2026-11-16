package com.example.starter_project_2025.system.demo.recommendation;
import com.example.starter_project_2025.system.demo.course.*;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.test.context.ActiveProfiles;
import jakarta.persistence.EntityManager;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;

@DataJpaTest @ActiveProfiles("test")
class RecommendationPersistenceTest {
    @Autowired RecommendationPreferenceRepository preferences;
    @Autowired CourseRepository courses;
    @Autowired EntityManager em;
    @Test void persistsInterestsAndDismissalsPerAccountAndResetOnlyDeletesOneAccount() {
        var a=RecommendationData.fresh(11L);a.setGoals("Java");a.getInterests().add("Backend");a.getDismissed().add(9L);
        var b=RecommendationData.fresh(22L);b.setGoals("Art");
        preferences.save(a);preferences.save(b);em.flush();em.clear();
        assertEquals(Set.of(9L),preferences.findById(11L).orElseThrow().getDismissed());
        assertEquals(Set.of("Backend"),preferences.findById(11L).orElseThrow().getInterests());
        assertTrue(preferences.findById(22L).orElseThrow().getDismissed().isEmpty());
        preferences.deleteById(11L);em.flush();em.clear();
        assertTrue(preferences.findById(11L).isEmpty());assertEquals("Art",preferences.findById(22L).orElseThrow().getGoals());
    }
    @Test void actualCandidateQueryOnlyReturnsActivePublishedCourses() {
        var visible=Course.builder().name("Visible").status(CourseStatus.PUBLISHED).isActive(true).build();
        var inactive=Course.builder().name("Inactive").status(CourseStatus.PUBLISHED).isActive(false).build();
        var draft=Course.builder().name("Draft").status(CourseStatus.DRAFT).isActive(true).build();
        var archived=Course.builder().name("Archived").status(CourseStatus.ARCHIVED).isActive(true).build();
        courses.saveAll(List.of(visible,inactive,draft,archived));em.flush();em.clear();
        assertEquals(List.of("Visible"),courses.findRecommendationCatalog().stream().map(Course::getName).toList());
    }
}
