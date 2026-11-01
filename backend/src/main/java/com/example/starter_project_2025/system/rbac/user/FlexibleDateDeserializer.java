package com.example.starter_project_2025.system.rbac.user;

import com.fasterxml.jackson.core.JsonParser;
import com.fasterxml.jackson.databind.DeserializationContext;
import com.fasterxml.jackson.databind.JsonDeserializer;
import com.fasterxml.jackson.databind.exc.InvalidFormatException;

import java.io.IOException;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.time.format.ResolverStyle;
import java.util.regex.Pattern;

/**
 * Reads a date written as yyyy-MM-dd where the month and day may omit the leading zero
 * (2000-01-05 and 2000-1-5 are the same date). The date must exist. Output stays ISO.
 */
public class FlexibleDateDeserializer extends JsonDeserializer<LocalDate> {

    private static final Pattern SHAPE = Pattern.compile("\\d{4}-\\d{1,2}-\\d{1,2}");
    private static final DateTimeFormatter FORMAT =
            DateTimeFormatter.ofPattern("uuuu-M-d").withResolverStyle(ResolverStyle.STRICT);

    @Override
    public LocalDate deserialize(JsonParser parser, DeserializationContext context) throws IOException {
        String text = parser.getValueAsString();
        if (text == null || text.isBlank()) {
            return null;
        }

        text = text.trim();
        try {
            if (SHAPE.matcher(text).matches()) {
                return LocalDate.parse(text, FORMAT);
            }
        } catch (DateTimeParseException ignored) {
            // falls through to the error below
        }

        throw InvalidFormatException.from(parser,
                "Date must be in the format yyyy-MM-dd, for example 2000-01-31", text, LocalDate.class);
    }
}
