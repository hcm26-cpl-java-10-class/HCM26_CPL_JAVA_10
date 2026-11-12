package com.example.starter_project_2025.init;
import org.h2.jdbcx.JdbcDataSource;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.env.MockEnvironment;
import static org.junit.jupiter.api.Assertions.*;
class LessonContentTypeSchemaUpdateTest {
    @Test void widensLegacyCheckWithoutLosingRowsAndCanRunTwice() throws Exception {
        JdbcDataSource source=new JdbcDataSource(); source.setURL("jdbc:h2:mem:lesson-types;DB_CLOSE_DELAY=-1");
        JdbcTemplate jdbc=new JdbcTemplate(source);
        jdbc.execute("create table lessons (id int primary key, content_type varchar(20) check (content_type in ('VIDEO','AUDIO','TEXT','DOCUMENT','LINK')))");
        jdbc.execute("insert into lessons values (1,'VIDEO')");
        var updater=new LessonContentTypeSchemaUpdate(source,jdbc,new MockEnvironment());
        updater.run(null); updater.run(null);
        jdbc.execute("insert into lessons values (2,'QUIZ'),(3,'EXAM'),(4,'ASSIGNMENT')");
        assertEquals(4,jdbc.queryForObject("select count(*) from lessons",Integer.class));
        assertThrows(org.springframework.dao.DataAccessException.class,()->jdbc.execute("insert into lessons values (5,'UNKNOWN')"));
    }
}
