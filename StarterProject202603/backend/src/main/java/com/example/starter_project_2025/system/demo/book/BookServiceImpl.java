package com.example.starter_project_2025.system.demo.book;

import com.example.starter_project_2025.base.crud.domain.BaseCrudRepository;
import com.example.starter_project_2025.base.crud.mapper.BaseCrudMapper;
import com.example.starter_project_2025.base.crud.service.BaseCrudServiceImpl;
import com.example.starter_project_2025.base.crud.validation.ValidationContext;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class BookServiceImpl
        extends BaseCrudServiceImpl<Book, Long, BookDTO, BookFilter>
        implements BookService {

    BookMapper bookMapper;
    BookRepository bookRepository;

    @Override
    protected BaseCrudRepository<Book, Long> getRepository() {
        return bookRepository;
    }

    @Override
    protected BaseCrudMapper<Book, BookDTO> getMapper() {
        return bookMapper;
    }

    @Override
    protected String[] searchableFields() {
        return new String[]{"name", "description"};
    }

    @Override
    protected void beforeCreate(Book book, BookDTO request, ValidationContext ctx) {

        if (bookRepository.existsByName(request.getName())) {
            ctx.add("name", "Book name already exists");
        }
    }

    @Override
    protected void beforeUpdate(Book book, BookDTO request, ValidationContext ctx) {

        if (request.getName() != null &&
                !request.getName().equals(book.getName()) &&
                bookRepository.existsByName(request.getName())) {

            ctx.add( "name", "Book name already exists");
        }
    }
}
