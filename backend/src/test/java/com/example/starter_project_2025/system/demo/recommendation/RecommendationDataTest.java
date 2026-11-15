package com.example.starter_project_2025.system.demo.recommendation;
import com.example.starter_project_2025.system.demo.lesson.*;
import com.example.starter_project_2025.system.demo.course.*;
import com.example.starter_project_2025.system.demo.category.Category;
import com.example.starter_project_2025.system.demo.certificate.*;
import com.example.starter_project_2025.system.demo.enrollment.*;
import org.junit.jupiter.api.Test;
import java.time.LocalDateTime;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import static com.example.starter_project_2025.system.demo.recommendation.RecommendationModels.*;

class RecommendationDataTest {
    CourseCatalogService catalog=mock(CourseCatalogService.class);
    CourseEnrollmentRepository enrollments=mock(CourseEnrollmentRepository.class);
    CertificateRepository certificates=mock(CertificateRepository.class);
    RecommendationPreferenceRepository preferences=mock(RecommendationPreferenceRepository.class);
    RecommendationData data=new RecommendationData(catalog,enrollments,certificates,preferences);
    @Test void enrolledCompletedDismissedAndDuplicateCoursesAreExcluded() {
        var pref=RecommendationData.fresh(1L);pref.getDismissed().add(3L);when(preferences.findById(1L)).thenReturn(Optional.of(pref));
        when(catalog.recommendationCatalog(1L)).thenReturn(java.util.stream.LongStream.of(1,2,3,4,4).mapToObj(i->RecommendationServiceTest.item(i).course()).toList());
        when(enrollments.findRecommendationHistory(1L)).thenReturn(List.of(CourseEnrollment.builder().course(Course.builder().id(1L).build()).build()));
        when(certificates.findAllByUser_Id(1L)).thenReturn(List.of(Certificate.builder().course(Course.builder().id(2L).build()).build()));
        assertEquals(List.of(4L),data.automatic(1L).recommendations().stream().map(i->i.course().id()).toList());
    }
    @Test void recentActualLearningOutweighsOldEnrollment() {
        var java=Category.builder().name("Java").build();var art=Category.builder().name("Art").build();
        var recent=CourseEnrollment.builder().course(Course.builder().id(10L).categories(Set.of(java)).build()).lastAccessedAt(LocalDateTime.now()).build();
        var old=CourseEnrollment.builder().course(Course.builder().id(11L).categories(Set.of(art)).build()).createdAt(LocalDateTime.now().minusYears(2)).build();
        when(enrollments.findRecommendationHistory(1L)).thenReturn(List.of(old,recent));
        when(catalog.recommendationCatalog(1L)).thenReturn(List.of(RecommendationServiceTest.course(1,"Art",CourseLevel.BEGINNER,100),RecommendationServiceTest.course(2,"Java",CourseLevel.BEGINNER,100)));
        assertEquals(2L,data.automatic(1L).recommendations().getFirst().course().id());
    }
    @Test void newAccountPrefersIntroductoryAndVariesTopics() {
        var courses=new ArrayList<CatalogCourseDTO>();
        for(long id=1;id<7;id++) courses.add(RecommendationServiceTest.course(id,"Java",CourseLevel.BEGINNER,100));
        courses.add(RecommendationServiceTest.course(8,"Art",CourseLevel.BEGINNER,100));courses.add(RecommendationServiceTest.course(9,"Art",CourseLevel.ADVANCED,100));
        var ranked=RecommendationData.rank(courses,Set.of(),RecommendationData.fresh(1L),Map.of(),0,Map.of());
        assertEquals(CourseLevel.BEGINNER,ranked.getFirst().course().level());assertEquals("Art",ranked.get(1).course().categoryName());
        assertFalse(ranked.getFirst().reason().contains("prerequisite"));
    }
    @Test void savedInterestsAndGoalsChangeRanking() {
        var p=RecommendationData.fresh(1L);p.setGoals("learn Java");
        var ranked=RecommendationData.rank(List.of(RecommendationServiceTest.course(1,"Art",CourseLevel.BEGINNER,100),RecommendationServiceTest.course(2,"Java",CourseLevel.BEGINNER,100)),Set.of(),p,Map.of(),0,Map.of());
        assertEquals(2L,ranked.getFirst().course().id());assertTrue(ranked.getFirst().reason().startsWith("Matches"));
        var generic=new CatalogCourseDTO(1L,"Learn drawing","Learn skills in this course",null,null,1L,"Art",CourseLevel.BEGINNER,1,100,true,false,4,10);
        assertEquals(2L,RecommendationData.rank(List.of(generic,RecommendationServiceTest.course(2,"Java",CourseLevel.BEGINNER,100)),Set.of(),p,Map.of(),0,Map.of()).getFirst().course().id());
    }
    @Test void savedJavaGoalExcludesUnrelatedCoursesRegardlessOfOtherRankingSignals() {
        var p=RecommendationData.fresh(1L);p.setGoals("Java");
        var sql=new CatalogCourseDTO(1L,"Database Design","SQL and relational design",null,null,1L,"Data Analysis",CourseLevel.BEGINNER,10,100,true,false,5,1000);
        var java=RecommendationServiceTest.course(2,"Java Programming",CourseLevel.INTERMEDIATE,100);
        var ranked=RecommendationData.rank(List.of(sql,java),Set.of(),p,Map.of("data analysis",100.0),0,Map.of(1L,100000L));
        assertEquals(List.of(2L),ranked.stream().map(i->i.course().id()).toList());
    }
    @Test void topicInterestsFilterAndJavaDoesNotMatchJavascript() {
        var p=RecommendationData.fresh(1L);p.setInterests(Set.of(" java "));
        var js=new CatalogCourseDTO(1L,"JavaScript basics",null,null,null,1L,"Web",CourseLevel.BEGINNER,1,10,true,false,5,100);
        var ranked=RecommendationData.rank(List.of(js,RecommendationServiceTest.course(2,"JAVA",CourseLevel.BEGINNER,100)),Set.of(),p,Map.of(),0,Map.of());
        assertEquals(List.of(2L),ranked.stream().map(i->i.course().id()).toList());
    }
    @Test void unmatchedPreferencesReturnNoMatchesAndResetRestoresDiscovery() {
        var p=RecommendationData.fresh(1L);p.setGoals("Java");
        var art=RecommendationServiceTest.course(1,"Art",CourseLevel.BEGINNER,100);
        when(preferences.findById(1L)).thenReturn(Optional.of(p));
        when(catalog.recommendationCatalog(1L)).thenReturn(List.of(art));
        assertEquals("NO_MATCHES",data.automatic(1L).state());assertTrue(data.automatic(1L).recommendations().isEmpty());
        data.reset(1L);verify(preferences).delete(p);
        when(preferences.findById(1L)).thenReturn(Optional.empty());
        assertEquals("READY",data.automatic(1L).state());assertEquals(1,data.automatic(1L).recommendations().size());
    }
    @Test void popularityAndReviewSupportRankingWithoutOverridingSuitability() {
        var ranked=RecommendationData.rank(List.of(RecommendationServiceTest.item(1).course(),RecommendationServiceTest.item(2).course()),Set.of(),RecommendationData.fresh(1L),Map.of(),0,Map.of(2L,100L));
        assertEquals(2L,ranked.getFirst().course().id());
        var singleFive=new CatalogCourseDTO(3L,"One review",null,null,null,1L,"Java",CourseLevel.BEGINNER,1,10,true,false,5,1);
        var reliable=new CatalogCourseDTO(4L,"Many reviews",null,null,null,1L,"Java",CourseLevel.BEGINNER,1,10,true,false,4.5,100);
        assertEquals(4L,RecommendationData.rank(List.of(singleFive,reliable),Set.of(),RecommendationData.fresh(1L),Map.of(),0,Map.of()).getFirst().course().id());
    }
    @Test void preferencesAndResetsAlwaysUseAuthenticatedAccountKey() {
        when(preferences.save(any())).thenAnswer(c->c.getArgument(0));
        data.save(7L,new Preferences("My goals",Set.of("Java")));data.dismiss(8L,3L);data.reset(7L);
        var captor=org.mockito.ArgumentCaptor.forClass(RecommendationPreference.class);verify(preferences,times(2)).save(captor.capture());
        assertEquals(7L,captor.getAllValues().get(0).getUserId());assertEquals(8L,captor.getAllValues().get(1).getUserId());
        assertTrue(captor.getAllValues().get(0).getDismissed().isEmpty());assertEquals("",captor.getAllValues().get(1).getGoals());
    }
}
