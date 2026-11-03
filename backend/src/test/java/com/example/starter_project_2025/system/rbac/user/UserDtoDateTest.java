package com.example.starter_project_2025.system.rbac.user;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;

/** The date of birth sent by a form: month and day may omit the leading zero, the date must exist. */
class UserDtoDateTest {

    private final ObjectMapper mapper = new ObjectMapper().registerModule(new JavaTimeModule());

    private LocalDate read(String date) throws Exception {
        return mapper.readValue("{\"dateOfBirth\":\"" + date + "\"}", UserDTO.class).getDateOfBirth();
    }

    @Test
    void withAndWithoutTheLeadingZero_isTheSameDate() throws Exception {
        assertEquals(LocalDate.of(2000, 1, 11), read("2000-01-11"));
        assertEquals(LocalDate.of(2000, 1, 11), read("2000-1-11"));
        assertEquals(LocalDate.of(2000, 1, 5), read("2000-1-5"));
    }

    @Test
    void aLeapDay_isAcceptedOnlyInALeapYear() throws Exception {
        assertEquals(LocalDate.of(2000, 2, 29), read("2000-2-29"));
        assertThrows(JsonProcessingException.class, () -> read("2001-2-29"));
    }

    @Test
    void datesThatDoNotExistOrHaveTheWrongShape_areRejected() {
        for (String date : new String[]{"2000-1-32", "2000-13-1", "2000-0-5", "2000-001-5", "31/01/2000"}) {
            assertThrows(JsonProcessingException.class, () -> read(date), date);
        }
    }

    @Test
    void aBlankDate_isNull() throws Exception {
        assertNull(read(""));
    }
}
