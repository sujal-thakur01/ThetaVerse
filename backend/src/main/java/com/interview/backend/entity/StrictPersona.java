package com.interview.backend.entity;

import jakarta.persistence.DiscriminatorValue;
import jakarta.persistence.Entity;

@Entity
@DiscriminatorValue("STRICT")
public class StrictPersona extends InterviewerPersona {
    public StrictPersona() {
        super("Strict", 4);
    }
}
