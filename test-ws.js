const WebSocket = require('ws');

const sessionCode = '48HUU5QFT6';
const hostId = 'HOST-6216c689-59d3-4163-9ea6-7b460b2c1bad';
const url = 'ws://localhost:8080/ws/live';

const hostWs = new WebSocket(url);
const studentWs = new WebSocket(url);

let hostGotParticipantsUpdate = false;
let studentGotJoinSuccess = false;

hostWs.on('open', () => {
    console.log('Host connected');
    hostWs.send(JSON.stringify({
        type: 'HOST_JOIN',
        hostId: hostId,
        sessionCode: sessionCode
    }));
});

hostWs.on('message', (data) => {
    const msg = JSON.parse(data.toString());
    console.log('Host received:', msg);
    if (msg.type === 'PARTICIPANTS_UPDATE') {
        const hasStudent = msg.participants && msg.participants.some(p => p.name === 'ProbeStudent');
        if (hasStudent) hostGotParticipantsUpdate = true;
    }
});

studentWs.on('open', () => {
    console.log('Student connected');
    studentWs.send(JSON.stringify({
        type: 'STUDENT_JOIN',
        sessionCode: sessionCode,
        name: 'ProbeStudent'
    }));
});

studentWs.on('message', (data) => {
    const msg = JSON.parse(data.toString());
    console.log('Student received:', msg);
    if (msg.type === 'JOIN_SUCCESS') {
        studentGotJoinSuccess = true;
    }
});

setTimeout(() => {
    console.log('\n--- Final Status ---');
    console.log('Host PARTICIPANTS_UPDATE (with student):', hostGotParticipantsUpdate);
    console.log('Student JOIN_SUCCESS:', studentGotJoinSuccess);
    process.exit(0);
}, 5000);
