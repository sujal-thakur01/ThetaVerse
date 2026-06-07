package com.interview.backend.dto;

import lombok.Data;

@Data
public class SignalingMessage {
    private String type;
    private String sessionCode;
    private String participantId;
    private String participantName;
    private String hostId;
    private String name;
    private String targetId;
    private Object payload;
}
