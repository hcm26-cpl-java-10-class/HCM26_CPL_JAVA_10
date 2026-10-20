package com.example.starter_project_2025.system.schedule.calendar.dto;

import com.fasterxml.jackson.annotation.JsonAnySetter;
import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.databind.JsonNode;

import java.util.LinkedHashSet;
import java.util.Set;

public class UpdateCalendarVersionRequest {

    private Object name;
    private Object description;
    private boolean nameProvided;
    private boolean descriptionProvided;

    @JsonIgnore
    private final Set<String> unsupportedFields = new LinkedHashSet<>();

    @JsonProperty("name")
    public void setName(Object name){
        this.nameProvided = true;
        this.name = name;
    }

    @JsonProperty("description")
    public void setDescription(Object description) {
        this.descriptionProvided = true;
        this.description = description;
    }

    @JsonAnySetter
    public void handleUnknown(String key, JsonNode value) {
        unsupportedFields.add(key);
    }

    @JsonIgnore
    public Object getName() {
        return name;
    }

    @JsonIgnore
    public Object getDescription() {
        return description;
    }

    @JsonIgnore
    public boolean isNameProvided() {
        return nameProvided;
    }

    @JsonIgnore
    public boolean isDescriptionProvided() {
        return descriptionProvided;
    }

    @JsonIgnore
    public Set<String> getUnsupportedFields() {
        return unsupportedFields;
    }

    @JsonIgnore
    public boolean hasUpdates() {
        return nameProvided || descriptionProvided;
    }
}