import { useEffect, useRef, useState, useCallback } from 'react';

const ICE_SERVERS: RTCConfiguration = {
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
};

type Participant = {
  id: string;
  name: string;
  role: 'HOST' | 'STUDENT';
  status: 'WAITING' | 'ADMITTED';
};

type HostMediaPermissions = {
  videoEnabled: boolean;
  audioEnabled: boolean;
  screenEnabled: boolean;
};

type SessionCapacityState = {
  capacity: number;
  admittedCount: number;
};

export const useLiveSession = (
  sessionCode: string,
  participantName: string,
  isHost: boolean,
  hostId?: string
) => {
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [myStatus, setMyStatus] = useState<'WAITING' | 'ADMITTED' | 'REJECTED'>(
    isHost ? 'ADMITTED' : 'WAITING'
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStreams, setRemoteStreams] = useState<Record<string, MediaStream>>({});
  const [hostMediaPermissions, setHostMediaPermissions] = useState<HostMediaPermissions>({
    videoEnabled: false,
    audioEnabled: false,
    screenEnabled: false,
  });
  const [sessionCapacity, setSessionCapacity] = useState<SessionCapacityState>({
    capacity: 1,
    admittedCount: 0,
  });
  
  const wsRef = useRef<WebSocket | null>(null);
  const peerConnections = useRef<Record<string, RTCPeerConnection>>({});
  // Per-peer flag: true while a manual offer/answer cycle is in flight
  // (callStudent). Suppresses the onnegotiationneeded double-offer race.
  const pcNegotiating = useRef<Record<string, boolean>>({});
  const myParticipantId = useRef<string>(isHost ? (hostId || '') : '');
  const screenTrackRef = useRef<MediaStreamTrack | null>(null);
  const hostPeerIdRef = useRef<string | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const hostMediaPermissionsRef = useRef<HostMediaPermissions>({
    videoEnabled: false,
    audioEnabled: false,
    screenEnabled: false,
  });

  useEffect(() => {
    localStreamRef.current = localStream;
  }, [localStream]);

  useEffect(() => {
    hostMediaPermissionsRef.current = hostMediaPermissions;
  }, [hostMediaPermissions]);

  const sendMessage = useCallback((type: string, targetId: string | null = null, payload: any = null) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type,
          sessionCode,
          participantId: myParticipantId.current,
          participantName,
          targetId,
          payload,
        })
      );
    }
  }, [participantName, sessionCode]);

  const sendToPeer = useCallback(async (peerId: string, pc: RTCPeerConnection) => {
    if (pc.signalingState !== 'stable') {
      return;
    }
    pcNegotiating.current[peerId] = true;
    try {
      const offer = await pc.createOffer();
      if (pc.signalingState !== 'stable') {
        pcNegotiating.current[peerId] = false;
        return;
      }
      await pc.setLocalDescription(offer);
      sendMessage('OFFER', peerId, offer);
    } catch (error) {
      console.error('Forced renegotiation failed', error);
      pcNegotiating.current[peerId] = false;
    }
  }, [sendMessage]);

  const removePeerConnection = useCallback((participantId: string) => {
    const pc = peerConnections.current[participantId];
    if (pc) {
      pc.close();
      delete peerConnections.current[participantId];
    }
    delete pcNegotiating.current[participantId];
    setRemoteStreams((prev) => {
      const next = { ...prev };
      delete next[participantId];
      return next;
    });
  }, []);

  const stopTrack = (track: MediaStreamTrack | undefined) => {
    if (track) {
      track.stop();
    }
  };

  const getMedia = useCallback(async (video = true, audio = true) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video, audio });
      setLocalStream((previousStream) => {
        if (previousStream && previousStream !== stream) {
          previousStream.getTracks().forEach((track) => track.stop());
        }
        return stream;
      });
      return stream;
    } catch (err) {
      console.error('Error accessing media devices.', err);
      return null;
    }
  }, []);

  const getHostOutboundTracks = (stream: MediaStream | null) => {
    if (!stream) {
      return [] as MediaStreamTrack[];
    }

    const permissions = hostMediaPermissionsRef.current;
    const tracks: MediaStreamTrack[] = [];
    const cameraTrack = stream.getVideoTracks().find((track) => track !== screenTrackRef.current);

    if (permissions.videoEnabled && cameraTrack) {
      tracks.push(cameraTrack);
    }
    if (permissions.audioEnabled) {
      const audioTrack = stream.getAudioTracks()[0];
      if (audioTrack) {
        tracks.push(audioTrack);
      }
    }
    if (permissions.screenEnabled && screenTrackRef.current) {
      tracks.push(screenTrackRef.current);
    }

    return tracks;
  };

  const createPeerConnection = useCallback((targetId: string, stream: MediaStream | null) => {
    if (peerConnections.current[targetId]) return peerConnections.current[targetId];

    const pc = new RTCPeerConnection(ICE_SERVERS);
    peerConnections.current[targetId] = pc;
    const remoteStream = new MediaStream();

    const tracksToAdd = isHost ? getHostOutboundTracks(stream) : (stream ? stream.getTracks() : []);
    if (tracksToAdd.length) {
      tracksToAdd.forEach((track) => pc.addTrack(track, stream as MediaStream));
    } else {
      if (isHost) {
        // Host starts with explicit media sections so tracks can be attached later
        // without creating unstable transceiver topologies.
        pc.addTransceiver('video', { direction: 'sendrecv' });
        pc.addTransceiver('audio', { direction: 'sendrecv' });
      } else {
        pc.addTransceiver('video', { direction: 'recvonly' });
        pc.addTransceiver('audio', { direction: 'recvonly' });
      }
    }

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        sendMessage('ICE_CANDIDATE', targetId, event.candidate);
      }
    };

    pc.ontrack = (event) => {
      const incomingStream = event.streams[0];

      if (incomingStream) {
        setRemoteStreams((prev) => ({
          ...prev,
          [targetId]: incomingStream,
        }));
        return;
      }

      remoteStream.addTrack(event.track);
      event.track.onended = () => {
        remoteStream.removeTrack(event.track);
        setRemoteStreams((prev) => ({
          ...prev,
          [targetId]: new MediaStream(remoteStream.getTracks()),
        }));
      };
      setRemoteStreams((prev) => ({
        ...prev,
        [targetId]: new MediaStream(remoteStream.getTracks()),
      }));
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'failed' || pc.connectionState === 'closed' || pc.connectionState === 'disconnected') {
        setRemoteStreams((prev) => {
          const next = { ...prev };
          delete next[targetId];
          return next;
        });
      }
    };

    // Automatically send a renegotiation OFFER when new tracks are added
    // (e.g. when the student enables camera/screenshare mid-session).
    // Guard: only fire when the PC is fully settled AND no manual
    // offer/answer cycle (callStudent) is already in flight — prevents GLARE.
    pc.onnegotiationneeded = async () => {
      if (pc.signalingState !== 'stable') return;
      if (pcNegotiating.current[targetId]) return;
      try {
        const offer = await pc.createOffer();
        if (pc.signalingState !== 'stable') return; // recheck after async gap
        await pc.setLocalDescription(offer);
        sendMessage('OFFER', targetId, offer);
      } catch (err) {
        console.error('onnegotiationneeded: failed to create offer', err);
      }
    };

    return pc;
  }, [isHost, sendMessage]);

  useEffect(() => {
    if (isHost && hostId) {
      myParticipantId.current = hostId;
    }
  }, [hostId, isHost]);

  useEffect(() => {
    if (!sessionCode) return;
    if (isHost && !hostId) return;

    const ws = new WebSocket('ws://localhost:8080/ws/live');
    wsRef.current = ws;

    ws.onopen = () => {
      if (isHost) {
        sendMessage('HOST_JOIN');
      } else {
        sendMessage('STUDENT_JOIN');
      }
    };

    ws.onmessage = async (event) => {
      const sm = JSON.parse(event.data);

      switch (sm.type) {
        case 'JOIN_SUCCESS':
          myParticipantId.current = sm.targetId;
          break;
        case 'PARTICIPANTS_UPDATE':
          setParticipants(sm.payload ?? []);
          if (isHost) {
            const admittedCount = (sm.payload ?? []).filter((p: Participant) => p.status === 'ADMITTED').length;
            setSessionCapacity((prev) => ({ ...prev, admittedCount }));
          }
          break;
        case 'SESSION_CAPACITY_UPDATE':
          setSessionCapacity({
            capacity: sm.payload?.capacity ?? 1,
            admittedCount: sm.payload?.admittedCount ?? 0,
          });
          break;
        case 'HOST_MEDIA_PERMISSION_UPDATE':
          setHostMediaPermissions({
            videoEnabled: Boolean(sm.payload?.videoEnabled),
            audioEnabled: Boolean(sm.payload?.audioEnabled),
            screenEnabled: Boolean(sm.payload?.screenEnabled),
          });
          break;
        case 'ADMITTED':
          setMyStatus('ADMITTED');
          break;
        case 'REJECTED':
          setMyStatus('REJECTED');
          break;
        case 'ERROR':
          setErrorMessage(typeof sm.payload === 'string' ? sm.payload : 'Unknown signaling error');
          break;
        case 'OFFER':
          await handleOffer(sm);
          break;
        case 'ANSWER':
          await handleAnswer(sm);
          break;
        case 'ICE_CANDIDATE':
          await handleIceCandidate(sm);
          break;
        case 'PEER_DISCONNECTED': {
          const participantId = typeof sm.participantId === 'string' ? sm.participantId : null;
          if (!participantId) {
            break;
          }
          removePeerConnection(participantId);
          if (isHost) {
            setParticipants((prev) => prev.filter((p) => p.id !== participantId));
          }
          break;
        }
      }
    };

    return () => {
      ws.close();
      if (wsRef.current === ws) {
        wsRef.current = null;
      }
      Object.values(peerConnections.current).forEach((pc) => pc.close());
      peerConnections.current = {};
      pcNegotiating.current = {};
      if (screenTrackRef.current) {
        stopTrack(screenTrackRef.current);
        screenTrackRef.current = null;
      }
    };
  }, [sessionCode, isHost, hostId]);

  const handleOffer = async (sm: any) => {
    if (!isHost) {
      hostPeerIdRef.current = sm.participantId;
    }
    // IMPORTANT: use localStreamRef.current — not `localStream` state, which is
    // a stale closure captured when the WebSocket effect ran (typically null).
    const stream = localStreamRef.current;
    // Use existing PC for renegotiation; create a new one for initial setup.
    const pc = peerConnections.current[sm.participantId] ?? createPeerConnection(sm.participantId, stream);

    // If this is a fresh PC AND the student has live tracks that weren't added
    // yet (because localStream was null at createPeerConnection time), add them now
    // before answering so the host receives the student's media.
    if (!isHost && stream) {
      const senders = pc.getSenders();
      const hasVideoSender = senders.some((s) => s.track?.kind === 'video');
      const hasAudioSender = senders.some((s) => s.track?.kind === 'audio');
      // Suppress onnegotiationneeded during this controlled setup
      pcNegotiating.current[sm.participantId] = true;
      if (!hasVideoSender) {
        const vt = stream.getVideoTracks()[0];
        if (vt) pc.addTrack(vt, stream);
      }
      if (!hasAudioSender) {
        const at = stream.getAudioTracks()[0];
        if (at) pc.addTrack(at, stream);
      }
    }

    await pc.setRemoteDescription(new RTCSessionDescription(sm.payload));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    sendMessage('ANSWER', sm.participantId, answer);
    // Release the negotiation lock — onnegotiationneeded can fire again
    pcNegotiating.current[sm.participantId] = false;
  };

  const handleAnswer = async (sm: any) => {
    const pc = peerConnections.current[sm.participantId];
    if (pc) {
      await pc.setRemoteDescription(new RTCSessionDescription(sm.payload));
      // Release the negotiation lock set in callStudent.
      pcNegotiating.current[sm.participantId] = false;
    }
  };

  const handleIceCandidate = async (sm: any) => {
    const pc = peerConnections.current[sm.participantId];
    if (pc) {
      await pc.addIceCandidate(new RTCIceCandidate(sm.payload));
    }
  };

  const syncStudentOutboundTracks = useCallback(async () => {
    const stream = localStreamRef.current;
    if (isHost || !stream) {
      return;
    }

    const audioTrack = stream.getAudioTracks()[0] ?? null;
    const videoTrack = stream.getVideoTracks()[0] ?? null;

    for (const [, pc] of Object.entries(peerConnections.current)) {
      const senders = pc.getSenders();
      const audioSender = senders.find((sender) => sender.track?.kind === 'audio');
      const videoSender = senders.find((sender) => sender.track?.kind === 'video');

      if (audioTrack) {
        if (audioSender) {
          if (audioSender.track !== audioTrack) {
            await audioSender.replaceTrack(audioTrack);
          }
        } else {
          pc.addTrack(audioTrack, stream);
        }
      }

      if (videoTrack) {
        if (videoSender) {
          if (videoSender.track !== videoTrack) {
            await videoSender.replaceTrack(videoTrack);
          }
        } else {
          pc.addTrack(videoTrack, stream);
        }
      }
    }
  }, [isHost, sendToPeer]);

  const syncHostOutboundTracks = useCallback(async () => {
    if (!isHost) {
      return;
    }

    const stream = localStreamRef.current;
    if (!stream) {
      return;
    }

    const permissions = hostMediaPermissionsRef.current;
    const screenTrack = screenTrackRef.current;
    const cameraTrack = stream.getVideoTracks().find((track) => track !== screenTrack) ?? null;
    const activeVideoTrack = permissions.screenEnabled
      ? (screenTrack ?? null)
      : (permissions.videoEnabled ? cameraTrack : null);
    const activeAudioTrack = permissions.audioEnabled
      ? (stream.getAudioTracks()[0] ?? null)
      : null;

    for (const [peerId, pc] of Object.entries(peerConnections.current)) {
      const transceivers = pc.getTransceivers();
      const videoTransceiver = transceivers.find((transceiver) => {
        const senderKind = transceiver.sender.track?.kind;
        const receiverKind = transceiver.receiver.track?.kind;
        return senderKind === 'video' || receiverKind === 'video';
      }) ?? null;
      const audioTransceiver = transceivers.find((transceiver) => {
        const senderKind = transceiver.sender.track?.kind;
        const receiverKind = transceiver.receiver.track?.kind;
        return senderKind === 'audio' || receiverKind === 'audio';
      }) ?? null;

      const videoSender = videoTransceiver?.sender ?? null;
      const audioSender = audioTransceiver?.sender ?? null;
      let changed = false;

      if (videoSender) {
        if (videoSender.track !== activeVideoTrack) {
          await videoSender.replaceTrack(activeVideoTrack);
          changed = true;
        }
      } else if (activeVideoTrack) {
        pc.addTrack(activeVideoTrack, stream);
        changed = true;
      }

      if (audioSender) {
        if (audioSender.track !== activeAudioTrack) {
          await audioSender.replaceTrack(activeAudioTrack);
          changed = true;
        }
      } else if (activeAudioTrack) {
        pc.addTrack(activeAudioTrack, stream);
        changed = true;
      }

      if (changed) {
        await sendToPeer(peerId, pc);
      }
    }
  }, [isHost, sendToPeer]);

  const notifyStudentMediaState = useCallback(() => {
    if (isHost) {
      return;
    }

    const hostTargetId = hostPeerIdRef.current;
    const stream = localStreamRef.current;
    if (!hostTargetId || !stream) {
      return;
    }

    const videoTrack = stream.getVideoTracks()[0] ?? null;
    const audioTrack = stream.getAudioTracks()[0] ?? null;
    const screenTrack = screenTrackRef.current;

    sendMessage('MEDIA_TOGGLE', hostTargetId, {
      video: Boolean(videoTrack && videoTrack.enabled),
      audio: Boolean(audioTrack && audioTrack.enabled),
      screen: Boolean(screenTrack && screenTrack.enabled),
    });
  }, [isHost, sendMessage]);

  const callStudent = async (targetId: string) => {
    const stream = localStreamRef.current;
    const pc = createPeerConnection(targetId, stream);
    // Lock out onnegotiationneeded for this PC while we manually drive the
    // offer/answer cycle — prevents a duplicate OFFER from the handler.
    pcNegotiating.current[targetId] = true;
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    sendMessage('OFFER', targetId, offer);
    // Lock is released in handleAnswer once the remote description is set.
  };

  const admitStudent = (studentId: string) => {
    sendMessage('ADMIT', studentId);
    setTimeout(() => callStudent(studentId), 1000);
  };

  const rejectStudent = (studentId: string) => {
    sendMessage('REJECT', studentId);
  };

  const removeAdmittedStudent = (studentId: string) => {
    sendMessage('REMOVE_STUDENT', studentId);
  };

  const setAdmitCapacity = (capacity: number) => {
    sendMessage('SET_CAPACITY', null, { capacity });
  };

  const updateHostVisibilityPermissions = (nextPermissions: HostMediaPermissions) => {
    setHostMediaPermissions(nextPermissions);
    sendMessage('HOST_MEDIA_PERMISSION', null, nextPermissions);
  };

  const ensureStudentTrack = useCallback(async (type: 'video' | 'audio') => {
    if (!localStream) {
      return null;
    }

    const existingTrack =
      type === 'video' ? localStream.getVideoTracks()[0] ?? null : localStream.getAudioTracks()[0] ?? null;
    if (existingTrack) {
      return existingTrack;
    }

    try {
      const requested = await navigator.mediaDevices.getUserMedia({
        video: type === 'video',
        audio: type === 'audio',
      });

      const newTrack =
        type === 'video' ? requested.getVideoTracks()[0] ?? null : requested.getAudioTracks()[0] ?? null;

      if (!newTrack) {
        requested.getTracks().forEach((track) => track.stop());
        return null;
      }

      const merged = new MediaStream([...localStream.getTracks(), newTrack]);
      setLocalStream(merged);

      requested.getTracks().forEach((track) => {
        if (track.id !== newTrack.id) {
          track.stop();
        }
      });

      return newTrack;
    } catch (error) {
      console.error(`Unable to acquire ${type} track`, error);
      return null;
    }
  }, [localStream]);

  const toggleMedia = useCallback(async (type: 'video' | 'audio', forceEnabled?: boolean) => {
    let stream = localStream;
    if (!stream) {
      stream = await getMedia(type === 'video', type === 'audio');
      if (!stream) {
        return false;
      }
    }

    let track: MediaStreamTrack | null =
      type === 'video' ? stream.getVideoTracks()[0] ?? null : stream.getAudioTracks()[0] ?? null;
    if (!track) {
      track = await ensureStudentTrack(type);
      if (!track) {
        return false;
      }
    }

    track.enabled = typeof forceEnabled === 'boolean' ? forceEnabled : !track.enabled;

    if (!isHost) {
      await syncStudentOutboundTracks();
      notifyStudentMediaState();
    }
    return true;
  }, [ensureStudentTrack, getMedia, isHost, localStream, notifyStudentMediaState, syncStudentOutboundTracks]);

  const startScreenShare = async () => {
    try {
      const displayStream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          width: { ideal: 1920 },
          height: { ideal: 1080 },
          frameRate: { ideal: 30 },
          displaySurface: 'monitor',
        },
        audio: false,
      });
      const displayTrack = displayStream.getVideoTracks()[0];
      if (!displayTrack) {
        return false;
      }

      screenTrackRef.current = displayTrack;
      displayTrack.onended = () => {
        screenTrackRef.current = null;
      };

      if (localStream) {
        // Replace the camera video track in all peer connections with the screen track
        // WITHOUT touching the MediaStream object (which would recreate senders).
        for (const [peerId, pc] of Object.entries(peerConnections.current)) {
          const videoSender = pc.getSenders().find((s) => s.track?.kind === 'video');
          if (videoSender) {
            await videoSender.replaceTrack(displayTrack);
            await sendToPeer(peerId, pc);
          } else {
            pc.addTrack(displayTrack, localStream);
            // onnegotiationneeded fires automatically
          }
        }
        // Update local preview stream for UI
        const cameraTrack = localStream.getVideoTracks().find((t) => t !== displayTrack);
        if (cameraTrack) {
          stopTrack(cameraTrack);
          localStream.removeTrack(cameraTrack);
        }
        localStream.addTrack(displayTrack);
        setLocalStream(new MediaStream(localStream.getTracks()));
      } else {
        const audioTrack = (await getMedia(false, true))?.getAudioTracks()[0];
        const next = new MediaStream(audioTrack ? [displayTrack, audioTrack] : [displayTrack]);
        setLocalStream(next);
      }

      if (!isHost) {
        notifyStudentMediaState();
      }

      return true;
    } catch (error) {
      console.error('Unable to start screen share', error);
      return false;
    }
  };

  const stopScreenShare = async () => {
    const screenTrack = screenTrackRef.current;
    if (!screenTrack) {
      return false;
    }

    try {
      // Acquire a new camera track BEFORE stopping the screen track
      // so we can replaceTrack without any gap.
      const cameraStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      const cameraTrack = cameraStream.getVideoTracks()[0];

      // Replace screen track with camera track in all peer connections.
      for (const [peerId, pc] of Object.entries(peerConnections.current)) {
        const videoSender = pc.getSenders().find((s) => s.track === screenTrack);
        if (videoSender && cameraTrack) {
          await videoSender.replaceTrack(cameraTrack);
          await sendToPeer(peerId, pc);
        } else if (videoSender) {
          await videoSender.replaceTrack(null);
        }
      }

      stopTrack(screenTrack);
      screenTrackRef.current = null;

      // Update the local stream for UI preview.
      if (localStream) {
        localStream.removeTrack(screenTrack);
        if (cameraTrack) {
          localStream.addTrack(cameraTrack);
        }
        setLocalStream(new MediaStream(localStream.getTracks()));
      }

      if (!isHost) {
        notifyStudentMediaState();
      }

      return true;
    } catch (error) {
      console.error('Unable to stop screen share', error);
      // Fallback: just stop the screen track
      stopTrack(screenTrack);
      screenTrackRef.current = null;
      return false;
    }
  };

  const connectNewlyAdmittedPeers = useCallback(async () => {
    if (!isHost) {
      return;
    }

    const admitted = participants.filter((p) => p.role === 'STUDENT' && p.status === 'ADMITTED');
    for (const participant of admitted) {
      const existing = peerConnections.current[participant.id];
      // Only initiate a call for students who don't already have an active/connecting PC.
      // Never tear down an existing connection — that causes the "Connecting to..." freeze.
      if (
        !existing ||
        existing.connectionState === 'failed' ||
        existing.connectionState === 'closed'
      ) {
        await callStudent(participant.id);
      }
    }
  }, [isHost, participants]);

  useEffect(() => {
    if (isHost) {
      void connectNewlyAdmittedPeers();
    }
  }, [isHost, participants, connectNewlyAdmittedPeers]);

  useEffect(() => {
    if (isHost) {
      void syncHostOutboundTracks();
    }
  }, [isHost, hostMediaPermissions, localStream, participants, syncHostOutboundTracks]);

  // NOTE: syncStudentOutboundTracks is called explicitly from toggleMedia,
  // startScreenShare, and stopScreenShare. The onnegotiationneeded handler on
  // each RTCPeerConnection fires automatically when pc.addTrack() is called,
  // so a reactive useEffect here would cause duplicate renegotiation offers.

  return {
    participants,
    myStatus,
    errorMessage,
    localStream,
    remoteStreams,
    hostMediaPermissions,
    sessionCapacity,
    getMedia,
    callStudent,
    admitStudent,
    rejectStudent,
    removeAdmittedStudent,
    setAdmitCapacity,
    updateHostVisibilityPermissions,
    toggleMedia,
    startScreenShare,
    stopScreenShare,
    myParticipantId: myParticipantId.current,
  };
};
