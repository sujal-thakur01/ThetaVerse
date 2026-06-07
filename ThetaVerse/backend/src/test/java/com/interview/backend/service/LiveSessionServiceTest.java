package com.interview.backend.service;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class LiveSessionServiceTest {

    @Test
    void createSession_generatesCodeAndHost() {
        LiveSessionService service = new LiveSessionService();

        String code = service.createSession("Host One");

        assertNotNull(code);
        assertEquals(10, code.length());
        assertNotNull(service.getHostParticipant(code));
        assertEquals("ADMITTED", service.getHostParticipant(code).getStatus());
        assertEquals("HOST", service.getHostParticipant(code).getRole());
    }

    @Test
    void admitStudent_respectsCapacityLimit() {
        LiveSessionService service = new LiveSessionService();
        String code = service.createSession("Host One");

        LiveSessionService.Participant s1 = service.addStudent(code, "Student 1", null);
        LiveSessionService.Participant s2 = service.addStudent(code, "Student 2", null);

        assertNotNull(s1);
        assertNotNull(s2);

        service.setSessionCapacity(code, 1);

        assertTrue(service.admitStudent(code, s1.getId()));
        assertFalse(service.admitStudent(code, s2.getId()));
        assertEquals(1, service.countAdmittedStudents(code));

        service.setSessionCapacity(code, 2);
        assertTrue(service.admitStudent(code, s2.getId()));
        assertEquals(2, service.countAdmittedStudents(code));
    }

    @Test
    void canSignalBetween_allowsOnlyHostAndAdmittedStudent() {
        LiveSessionService service = new LiveSessionService();
        String code = service.createSession("Host One");
        String hostId = service.getHostParticipant(code).getId();

        LiveSessionService.Participant admitted = service.addStudent(code, "Admitted", null);
        LiveSessionService.Participant waiting = service.addStudent(code, "Waiting", null);
        LiveSessionService.Participant waitingTwo = service.addStudent(code, "Waiting 2", null);

        assertNotNull(admitted);
        assertNotNull(waiting);
        assertNotNull(waitingTwo);

        service.admitStudent(code, admitted.getId());

        assertTrue(service.canSignalBetween(code, hostId, admitted.getId()));
        assertTrue(service.canSignalBetween(code, admitted.getId(), hostId));

        assertFalse(service.canSignalBetween(code, hostId, waiting.getId()));
        assertFalse(service.canSignalBetween(code, waiting.getId(), hostId));

        assertFalse(service.canSignalBetween(code, admitted.getId(), waiting.getId()));
        assertFalse(service.canSignalBetween(code, waiting.getId(), waitingTwo.getId()));
    }
}
