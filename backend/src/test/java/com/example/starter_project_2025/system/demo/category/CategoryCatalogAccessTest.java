package com.example.starter_project_2025.system.demo.category;

import com.example.starter_project_2025.system.demo.course.CourseRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import java.util.List;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class CategoryCatalogAccessTest {
    final CategoryRepository categories=mock(CategoryRepository.class);
    final CourseRepository courses=mock(CourseRepository.class);
    final CategoryServiceImpl service=new CategoryServiceImpl(mock(CategoryMapper.class),categories,courses);
    void authenticate(String permission) {
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken("student","",List.of(new SimpleGrantedAuthority(permission))));
    }
    @AfterEach void clear(){SecurityContextHolder.clearContext();}
    @Test void courseReadAllowsAllActiveCatalogCategoriesIncludingEmptyOnes() {
        authenticate("COURSE_READ");
        var parent=Category.builder().id(1L).name("Programming").code("PROGRAMMING").isActive(true).build();
        var child=Category.builder().id(2L).name("Mobile").code("MOBILE_DEV").parent(parent).isActive(true).build();
        var empty=Category.builder().id(3L).name("Empty").isActive(true).build();
        var inactive=Category.builder().id(4L).name("Inactive").isActive(false).build();
        when(categories.findAll()).thenReturn(List.of(parent,child,empty,inactive));
        when(courses.findPublishedCourseCategoryIds()).thenReturn(List.of(new Object[]{10L,1L}, new Object[]{10L,2L}));
        var tree=service.getCatalogTree();assertEquals(2,tree.size());var programming=tree.stream().filter(c -> "PROGRAMMING".equals(c.getCode())).findFirst().orElseThrow();assertEquals(1,programming.getTotalCourseCount());assertEquals("MOBILE_DEV",programming.getChildren().getFirst().getCode());assertTrue(tree.stream().anyMatch(c -> "Empty".equals(c.getName()) && c.getTotalCourseCount()==0));
        assertThrows(AccessDeniedException.class,()->service.getTree(false));
        assertThrows(AccessDeniedException.class,()->service.create(new CategoryDTO()));
    }
    @Test void categoryReadDoesNotSubstituteForCourseRead() {
        authenticate("CATEGORY_READ");when(categories.findAll()).thenReturn(List.of());when(courses.findPublishedCourseCategoryIds()).thenReturn(List.of());
        assertTrue(service.getTree(false).isEmpty());assertThrows(AccessDeniedException.class,service::getCatalogTree);
    }
    @Test void unauthenticatedAccessIsDenied() {assertThrows(AccessDeniedException.class,service::getCatalogTree);}
}
