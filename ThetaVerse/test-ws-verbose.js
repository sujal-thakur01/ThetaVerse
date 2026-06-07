const WebSocket = require('ws');

const sessionCode = '48HUU5QFT6';
const hostId = 'HOST-6216c689-59d3-4163-9ea6-7b460b2c1bad';
const url = 'ws://localhost:8080/ws/live';

const hostWs = new WebSocket(url);
const studentWs = new WebSocket(url);

hostWs.on('open', () => {
    console.log('Host socket open');
    const payload = JSON.stringify({
        type: 'HOST_JOIN',
        hostId: hostId,
        sessionCode: sessionCode
    });
    console.log('Host sending:', payload);
    hostWs.send(payload);
});

hostWs.on('message', (data) => {
    console.log('Host received raw:', data.toString());
});

hostWs.on('error', (err) => {
    console.log('Host error:', err.message);
});

studentWs.on('open', () => {
    console.log('Student socket open');
    const payload = JSON.stringify({
        type: 'STUDENT_JOIN',
        sessionCode: sessionCode,
        name: 'ProbeStudent'
    });
    console.log('Student sending:', payload);
    studentWs.send(payload);
});

studentWs.on('message', (data) => {
    console.log('Student received raw:', data.toString());
});

studentWs.on('error', (err) => {
    console.log('Student error:', err.message);
});

setTimeout(() => {
    console.log('Closing...');
    process.exit(0);
}, 5000);
