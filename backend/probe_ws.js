const WebSocket = require('ws');

const sessionCode = '967EAACYEK';
const hostId = 'HOST-aa4357a0-edde-4c2e-85a5-1e1345830c24';
const url = 'ws://localhost:8080/ws/live';

const hostWs = new WebSocket(url);

hostWs.on('open', () => {
    console.log('Host connected');
    hostWs.send(JSON.stringify({
        type: 'HOST_JOIN',
        sessionCode: sessionCode,
        participantId: hostId,
        participantName: 'ProbeHost'
    }));
});

let studentStarted = false;
hostWs.on('message', (data) => {
    console.log('Host Received:', data.toString());
    const msg = JSON.parse(data.toString());
    if (msg.type === 'PARTICIPANTS_UPDATE' && !studentStarted) {
        studentStarted = true;
        console.log('Host join confirmed. Connecting student...');
        const studentWs = new WebSocket(url);
        studentWs.on('open', () => {
            console.log('Student connected');
            studentWs.send(JSON.stringify({
                type: 'STUDENT_JOIN',
                sessionCode: sessionCode,
                participantId: '',
                participantName: 'ProbeStudent'
            }));
        });
        studentWs.on('message', (sdata) => {
            console.log('Student Received:', sdata.toString());
        });
    }
});

setTimeout(() => {
    console.log('Finished 5s probe.');
    process.exit(0);
}, 5000);
