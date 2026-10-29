package com.example.starter_project_2025.system.subject;

import com.fasterxml.jackson.core.JsonParser;
import com.fasterxml.jackson.core.JsonToken;
import com.fasterxml.jackson.databind.DeserializationContext;
import com.fasterxml.jackson.databind.deser.std.StdDeserializer;
import com.fasterxml.jackson.databind.exc.InvalidFormatException;

import java.io.IOException;
import java.math.BigDecimal;

/** Preserve fractional hours rather than truncating them to a whole number. */
public class SubjectHoursDeserializer extends StdDeserializer<BigDecimal> {
    public SubjectHoursDeserializer() { super(BigDecimal.class); }

    @Override
    public BigDecimal deserialize(JsonParser parser, DeserializationContext context) throws IOException {
        try {
            if (parser.currentToken() == JsonToken.VALUE_NUMBER_INT || parser.currentToken() == JsonToken.VALUE_NUMBER_FLOAT
                    || parser.currentToken() == JsonToken.VALUE_STRING) {
                return new BigDecimal(parser.getText().trim()).stripTrailingZeros();
            }
        } catch (NumberFormatException | ArithmeticException ignored) {
            // Malformed/nonfinite numbers must never become an empty or truncated duration.
        }
        throw InvalidFormatException.from(parser, "Enter a valid numeric duration in hours", parser.getText(), BigDecimal.class);
    }
}
