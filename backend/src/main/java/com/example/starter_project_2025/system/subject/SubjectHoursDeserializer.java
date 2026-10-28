package com.example.starter_project_2025.system.subject;

import com.fasterxml.jackson.core.JsonParser;
import com.fasterxml.jackson.core.JsonToken;
import com.fasterxml.jackson.databind.DeserializationContext;
import com.fasterxml.jackson.databind.deser.std.StdDeserializer;
import com.fasterxml.jackson.databind.exc.InvalidFormatException;

import java.io.IOException;
import java.math.BigDecimal;

/** Prevent Jackson's default fractional-number-to-integer truncation for subject hours. */
public class SubjectHoursDeserializer extends StdDeserializer<Integer> {
    public SubjectHoursDeserializer() { super(Integer.class); }

    @Override
    public Integer deserialize(JsonParser parser, DeserializationContext context) throws IOException {
        try {
            if (parser.currentToken() == JsonToken.VALUE_NUMBER_INT || parser.currentToken() == JsonToken.VALUE_NUMBER_FLOAT
                    || parser.currentToken() == JsonToken.VALUE_STRING) {
                return new BigDecimal(parser.getText().trim()).intValueExact();
            }
        } catch (NumberFormatException | ArithmeticException ignored) {
            // Return the same field message for fractional, nonnumeric and overflowing values.
        }
        throw InvalidFormatException.from(parser, "Hours must be a whole number within the supported range", parser.getText(), Integer.class);
    }
}
