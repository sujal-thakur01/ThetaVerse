const WebSocket = require('ws');

const hostId = "HOST-test";
const sessionCode = "ABCDEF1234";

const wsHost = new WebSocket('ws://localhost:8080/ws/live');

wsHost.on('open', () => {
    wsHost.send(JSON.stringify({
        type: 'HOST_JOIN',
        sessionCode: sessionCode,
        participantId: hostId,
        participantName: 'Test Host'
    }));
    
    // Connect student
    const wsStudent = new WebSocket('ws://localhost:8080/ws/live');
    wsStudent.on('open', () => {
        wsStudent.send(JSON.stringify({
            type: 'STUDENT_JOIN',
            sessionCode: sessionCode,
            participantName: 'Test Student'
        }));
    });
    
    wsStudent.on('message', (data) => {
        const msg = JSON.parse(data);
        if (msg.type === 'JOIN_SUCCESS') {
            console.log("Student joined:", msg.targetId);
            
            // Host admits student
            wsHost.send(JSON.stringify({
                type: 'ADMIT',
                sessionCode: sessionCode,
                participantId: hostId,
                targetId: msg.targetId
            }));
            
            // Wait a sec then reject
            setTimeout(() => {
                console.log("Host rejecting student:", msg.targetId);
                wsHost.send(JSON.stringify({
                    type: 'REJECT',
                    sessionCode: sessionCode,
                    participantId: hostId,
                    targetId: msg.targetId
                }));
            }, 1000);
        }
    });
});

wsHost.on('message', (data) => {
    console.log("Host received:", JSON.parse(data));
});
