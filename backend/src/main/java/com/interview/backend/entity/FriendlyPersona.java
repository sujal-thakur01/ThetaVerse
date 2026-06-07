package com.interview.backend.entity;

import jakarta.persistence.DiscriminatorValue;
import jakarta.persistence.Entity;

@Entity
@DiscriminatorValue("FRIENDLY")
public class FriendlyPersona extends InterviewerPersona {
    public FriendlyPersona() {
        super("Friendly", 1);
    }
}
