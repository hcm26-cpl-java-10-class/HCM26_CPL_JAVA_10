package com.example.starter_project_2025.system.schedule.trainingclass.dto;

import com.fasterxml.jackson.core.JsonParser;
import com.fasterxml.jackson.core.JsonToken;
import com.fasterxml.jackson.databind.DeserializationContext;
import com.fasterxml.jackson.databind.JsonDeserializer;
import com.fasterxml.jackson.databind.exc.InvalidFormatException;

import java.io.IOException;

/** Prevent Jackson from silently converting a decimal such as 25.5 to integer 25. */
public class ClassCapacityDeserializer extends JsonDeserializer<Integer> {
    @Override
    public Integer deserialize(JsonParser parser, DeserializationContext context) throws IOException {
        if (parser.currentToken() != JsonToken.VALUE_NUMBER_INT) {
            throw InvalidFormatException.from(parser, "Capacity must be a whole number from 1 to 50",
                    parser.getValueAsString(), Integer.class);
        }
        return parser.getIntValue();
    }
}
