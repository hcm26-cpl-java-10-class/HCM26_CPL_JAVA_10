package com.example.starter_project_2025.system.study_session;

import com.fasterxml.jackson.core.JsonParser;
import com.fasterxml.jackson.core.JsonToken;
import com.fasterxml.jackson.databind.DeserializationContext;
import com.fasterxml.jackson.databind.deser.std.StdDeserializer;

import java.io.IOException;

/** Prevent Jackson from silently truncating fractional IDs or coercing strings/booleans. */
public class StudySessionIdDeserializer extends StdDeserializer<Long> {
    public StudySessionIdDeserializer() {
        super(Long.class);
    }

    @Override
    public Long deserialize(JsonParser parser, DeserializationContext context) throws IOException {
        if (!parser.hasToken(JsonToken.VALUE_NUMBER_INT)) {
            return (Long) context.handleUnexpectedToken(Long.class, parser);
        }
        return parser.getLongValue();
    }
}
