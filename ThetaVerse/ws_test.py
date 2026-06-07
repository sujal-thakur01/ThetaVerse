import asyncio
import websockets
import json
import uuid

async def test():
    uri = "ws://localhost:8080/ws/live"
    try:
        # Create a session via HTTP first (since the backend generates hostId and sessionCode)
        import urllib.request
        req = urllib.request.Request('http://localhost:8080/api/live-sessions/create', 
            data=json.dumps({"hostName":"Test"}).encode('utf-8'),
            headers={'Content-Type': 'application/json'})
        with urllib.request.urlopen(req) as response:
            res = json.loads(response.read().decode())
            sessionCode = res['sessionCode']
            hostId = res['hostId']
            print(f"Created session {sessionCode} with hostId {hostId}")
            
        async with websockets.connect(uri) as ws_host:
            # Host joins
            await ws_host.send(json.dumps({
                "type": "HOST_JOIN",
                "sessionCode": sessionCode,
                "participantId": hostId,
                "participantName": "Test Host"
            }))
            
            # Wait a bit
            await asyncio.sleep(0.5)
            
            # Set capacity to 2
            await ws_host.send(json.dumps({
                "type": "SET_CAPACITY",
                "sessionCode": sessionCode,
                "participantId": hostId,
                "payload": {"capacity": 2}
            }))
            
            # Student 1 joins
            ws_student1 = await websockets.connect(uri)
            await ws_student1.send(json.dumps({
                "type": "STUDENT_JOIN",
                "sessionCode": sessionCode,
                "participantName": "Student 1"
            }))
            
            # Student 2 joins
            ws_student2 = await websockets.connect(uri)
            await ws_student2.send(json.dumps({
                "type": "STUDENT_JOIN",
                "sessionCode": sessionCode,
                "participantName": "Student 2"
            }))
            
            student_ids = []
            
            while len(student_ids) < 2:
                msg = await ws_host.recv()
                data = json.loads(msg)
                print("Host recv:", data)
                if data['type'] == 'PARTICIPANTS_UPDATE':
                    for p in data['payload']:
                        if p['id'] not in student_ids and p['role'] == 'STUDENT':
                            student_ids.append(p['id'])
                            
            print("Students:", student_ids)
            
            for sid in student_ids:
                # Admit
                await ws_host.send(json.dumps({
                    "type": "ADMIT",
                    "sessionCode": sessionCode,
                    "participantId": hostId,
                    "targetId": sid
                }))
                print(f"Admitted {sid}")
            
            await asyncio.sleep(1)
            
            # Reject Student 1
            print(f"Rejecting {student_ids[0]}")
            await ws_host.send(json.dumps({
                "type": "REJECT",
                "sessionCode": sessionCode,
                "participantId": hostId,
                "targetId": student_ids[0]
            }))
            
            await asyncio.sleep(1)
            
            # Reject Student 2
            print(f"Rejecting {student_ids[1]}")
            await ws_host.send(json.dumps({
                "type": "REJECT",
                "sessionCode": sessionCode,
                "participantId": hostId,
                "targetId": student_ids[1]
            }))
            
            await asyncio.sleep(1)
            
            await ws_student1.close()
            await ws_student2.close()
            
    except Exception as e:
        print("Error:", e)

asyncio.run(test())
