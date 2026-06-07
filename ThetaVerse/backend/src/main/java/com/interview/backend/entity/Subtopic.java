package com.interview.backend.entity;

import jakarta.persistence.Embeddable;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Embeddable
@Data
@NoArgsConstructor
@AllArgsConstructor
public class Subtopic {
    private String title;
    private Boolean isCompleted = false;
    private Integer sequenceOrder = 0; // Order within the topic's subtopics
}
