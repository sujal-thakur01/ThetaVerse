package com.interview.backend.entity;

import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "interviewer_personas")
@Inheritance(strategy = InheritanceType.SINGLE_TABLE)
@DiscriminatorColumn(name = "persona_type", discriminatorType = DiscriminatorType.STRING)
@Data
@NoArgsConstructor
public abstract class InterviewerPersona {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String baseMood;
    private Integer followUpDepth;

    public InterviewerPersona(String baseMood, Integer followUpDepth) {
        this.baseMood = baseMood;
        this.followUpDepth = followUpDepth;
    }
}
