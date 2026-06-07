%%{init: {'theme': 'neutral'}}%%
classDiagram

    %% Classes with OIDs removed (as per the PDF's instructions)
    class User {
        name
        email
        experienceLevel
    }

    class TargetProfile {
        companyName
        roleName
        dailyHourLimit
        maxDailyThreshold
    }

    class Roadmap {
        startDate
        endDate
    }

    class RoadmapTopic {
        title
        sequenceOrder
        priority
    }

    class GhostPerformance {
        initialFixedVelocity
        lastSyncedTopicIndex
    }

    class InterviewSession {
        techScore
        focusScore
        startTime
        endTime
    }

    class InterviewLog {
        role
        content
        timestamp
    }

    class FocusAlert {
        alertTime
        alertType
    }

    class InterviewerPersona {
        <<abstract>>
        baseMood
        followUpDepth
    }
    
    class StrictPersona {
        followUpDepth = 4
    }
    
    class MediumPersona {
        followUpDepth = 2
    }
    
    class FriendlyPersona {
        followUpDepth = 1
    }

    %% Generalization (Inheritance)
    StrictPersona --|> InterviewerPersona 
    MediumPersona --|> InterviewerPersona 
    FriendlyPersona --|> InterviewerPersona 

    %% Associations with Names and Multiplicities
    User "1" -- "*" TargetProfile : Manages
    User "1" -- "*" InterviewSession : ParticipatesIn
    
    TargetProfile "1" -- "1" Roadmap : Generates
    
    Roadmap "1" -- "1..*" RoadmapTopic : Contains
    Roadmap "1" -- "1" GhostPerformance : BenchmarkedBy
    
    InterviewSession "1" -- "1" InterviewerPersona : UsesMood
    InterviewSession "1" -- "*" InterviewLog : Records
    InterviewSession "1" -- "*" FocusAlert : Monitors