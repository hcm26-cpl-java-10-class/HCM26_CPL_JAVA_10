package com.example.starter_project_2025.system.demo.book;

import com.example.starter_project_2025.base.crud.controller.BaseCrudDataIoController;
import com.example.starter_project_2025.base.crud.domain.BaseCrudRepository;
import com.example.starter_project_2025.base.crud.service.BaseCrudService;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/books")
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
@Tag(name = "Book", description = "APIs for managing books")
public class BookController
        extends BaseCrudDataIoController<Book, Long, BookDTO, BookFilter> {

    BookService bookService;
    BookRepository bookRepository;

    @Override
    protected BaseCrudService<Long, BookDTO, BookFilter> getService() {
        return bookService;
    }

    @Override
    protected BaseCrudRepository<Book, Long> getRepository() {
        return bookRepository;
    }

    @Override
    protected Class<Book> getEntityClass() {
        return Book.class;
    }
}
