package com.interview.backend.entity;

import jakarta.persistence.DiscriminatorValue;
import jakarta.persistence.Entity;

@Entity
@DiscriminatorValue("MEDIUM")
public class MediumPersona extends InterviewerPersona {
    public MediumPersona() {
        super("Medium", 2);
    }
}
