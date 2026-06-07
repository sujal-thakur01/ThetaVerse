import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  Activity,
  Bot,
  LineChart,
  Mic,
  MicOff,
  Send,
  Volume2,
  VolumeX,
} from "lucide-react";
import toast from "react-hot-toast";
import apiClient from "../../api/apiClient";
import { logExecution, withExecutionLog } from "../../utils/executionLogger";

interface InterviewSessionInfo {
  id: number;
  companyName: string;
  position: string;
  roundTypes: string;
  mood: string;
  mode?: "AI" | "HUMAN";
  startTime: string;
  endTime: string | null;
  scheduledAt?: string | null;
  durationMinutes?: number | null;
  interviewerName?: string | null;
  interviewerEmail?: string | null;
  resumeText: string | null;
}

interface SessionQuestion {
  id: number;
  topic: string;
  questionText: string;
  userAnswer?: string | null;
  aiResponse?: string | null;
}

interface TranscriptEntry {
  role: "question" | "response" | "evaluation" | "final";
  content: string;
}

const QUESTIONS_PER_TOPIC = 5;

const sanitizeForSpeech = (text: string) => {
  return text
    .replace(/[`*_#~>|\[\]{}()]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
};

const selectPreferredVoice = (voices: SpeechSynthesisVoice[]) => {
  const preferredNames = [
    "Google US English",
    "Samantha",
    "Microsoft Aria Online (Natural) - English (United States)",
    "Microsoft Jenny Online (Natural) - English (United States)",
  ];

  for (const preferredName of preferredNames) {
    const found = voices.find((voice) => voice.name === preferredName);
    if (found) {
      return found;
    }
  }

  return voices.find((voice) => voice.lang.startsWith("en")) || voices[0];
};

export default function InterviewUI() {
  const { sessionId } = useParams();
  const navigate = useNavigate();

  const [sessionInfo, setSessionInfo] = useState<InterviewSessionInfo | null>(
    null,
  );
  const [topics, setTopics] = useState<string[]>(["Technical"]);
  const [logs, setLogs] = useState<TranscriptEntry[]>([]);
  const [inputMessage, setInputMessage] = useState("");
  const [currentQuestion, setCurrentQuestion] =
    useState<SessionQuestion | null>(null);
  const [currentQuestionNumber, setCurrentQuestionNumber] = useState(0);
  const [currentTopicIndex, setCurrentTopicIndex] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [interviewStarted, setInterviewStarted] = useState(false);
  const [postureFeedback, setPostureFeedback] = useState("Posture looks good");
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [availableVoices, setAvailableVoices] = useState<
    SpeechSynthesisVoice[]
  >([]);
  const [selectedVoiceURI, setSelectedVoiceURI] = useState("");

  const scrollRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const recognitionRef = useRef<any>(null);
  const poseRef = useRef<any>(null);
  const cameraRef = useRef<any>(null);
  const activeSessionRef = useRef(true);
  const inputMessageRef = useRef("");
  const dictatedFinalRef = useRef("");

  const currentTopic = useMemo(() => {
    return topics[currentTopicIndex] || topics[0] || "Technical";
  }, [currentTopicIndex, topics]);

  const appendLog = (role: TranscriptEntry["role"], content: string) => {
    setLogs((prev) => [...prev, { role, content }]);
  };

  useEffect(() => {
    inputMessageRef.current = inputMessage;
  }, [inputMessage]);

  useEffect(() => {
    const loadVoices = () => {
      const voices = window.speechSynthesis.getVoices();
      if (!voices.length) {
        return;
      }

      setAvailableVoices(voices);
      setSelectedVoiceURI((previous) => {
        if (previous) {
          return previous;
        }
        const preferred = selectPreferredVoice(voices);
        return preferred?.voiceURI || "";
      });
    };

    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;

    return () => {
      window.speechSynthesis.onvoiceschanged = null;
    };
  }, []);

  useEffect(() => {
    activeSessionRef.current = true;
    let poseTimer: number | null = null;

    const loadSession = async () => {
      if (!sessionId) {
        return;
      }

      try {
        const response = await apiClient.get(`/interviews/${sessionId}`);
        const info: InterviewSessionInfo = response.data;
        const parsedTopics = (info.roundTypes || "Technical")
          .split(",")
          .map((topic) => topic.trim())
          .filter(Boolean);

        setSessionInfo(info);
        setTopics(parsedTopics.length > 0 ? parsedTopics : ["Technical"]);
        setCurrentTopicIndex(0);

        if (info.mode !== "HUMAN") {
          await startWebcam();
          initSpeechRecognition();
          poseTimer = window.setTimeout(() => {
            void initPoseTracking();
          }, 1200);
        }

        logExecution("InterviewUI.loadSession", "session loaded", {
          sessionId,
          topics: parsedTopics.length,
        });
      } catch (error) {
        console.error("Failed to load interview session", error);
        toast.error("Failed to load interview session");
      }
    };

    const startWebcam = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false,
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (error) {
        console.error("Webcam access denied", error);
      }
    };

    const initSpeechRecognition = () => {
      const SpeechRecognitionClass =
        (window as any).SpeechRecognition ||
        (window as any).webkitSpeechRecognition;

      if (!SpeechRecognitionClass) {
        return;
      }

      const recognition = new SpeechRecognitionClass();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = "en-US";

      recognition.onstart = () => {
        dictatedFinalRef.current = inputMessageRef.current.trim();
        setIsRecording(true);
      };

      recognition.onresult = (event: any) => {
        let finalizedChunk = "";
        let interimChunk = "";

        for (let i = event.resultIndex; i < event.results.length; i += 1) {
          const segment = (event.results[i]?.[0]?.transcript || "").trim();
          if (!segment) {
            continue;
          }

          if (event.results[i].isFinal) {
            finalizedChunk += `${segment} `;
          } else {
            interimChunk += `${segment} `;
          }
        }

        if (finalizedChunk.trim()) {
          dictatedFinalRef.current =
            `${dictatedFinalRef.current} ${finalizedChunk}`.trim();
        }

        const nextInput = `${dictatedFinalRef.current} ${interimChunk}`.trim();
        if (nextInput) {
          setInputMessage(nextInput);
        }
      };

      recognition.onerror = (event: any) => {
        console.error("Speech recognition error", event.error);
        setIsRecording(false);
      };

      recognition.onend = () => {
        setIsRecording(false);
      };

      recognitionRef.current = recognition;
    };

    const initPoseTracking = async () => {
      if (!(window as any).Pose) {
        await new Promise<void>((resolve) => {
          const script1 = document.createElement("script");
          script1.src =
            "https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils/camera_utils.js";
          document.head.appendChild(script1);

          const script2 = document.createElement("script");
          script2.src = "https://cdn.jsdelivr.net/npm/@mediapipe/pose/pose.js";
          script2.onload = () => resolve();
          document.head.appendChild(script2);
        });
      }

      const winAny = window as any;
      if (!winAny.Pose || !videoRef.current) {
        return;
      }

      const pose = new winAny.Pose({
        locateFile: (file: string) =>
          `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`,
      });

      pose.setOptions({
        modelComplexity: 1,
        smoothLandmarks: true,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5,
      });

      pose.onResults((results: any) => {
        if (!results.poseLandmarks) {
          return;
        }

        const leftShoulder = results.poseLandmarks[11];
        const rightShoulder = results.poseLandmarks[12];

        if (!leftShoulder || !rightShoulder) {
          return;
        }

        const postureTilt = Math.abs(leftShoulder.y - rightShoulder.y);
        const postureWarning =
          postureTilt > 0.1 || leftShoulder.y > 0.8 || rightShoulder.y > 0.8;

        if (postureWarning) {
          setPostureFeedback(
            "Candidate posture looks slouched. Remind them to sit upright.",
          );
        } else {
          setPostureFeedback("Candidate posture looks confident and upright.");
        }
      });

      poseRef.current = pose;

      if (videoRef.current) {
        const camera = new winAny.Camera(videoRef.current, {
          onFrame: async () => {
            if (poseRef.current && videoRef.current) {
              await poseRef.current.send({ image: videoRef.current });
            }
          },
          width: 640,
          height: 480,
        });

        camera.start();
        cameraRef.current = camera;
      }
    };

    void loadSession();

    return () => {
      activeSessionRef.current = false;
      if (poseTimer) {
        window.clearTimeout(poseTimer);
      }
      if (cameraRef.current) cameraRef.current.stop();
      if (poseRef.current) poseRef.current.close();
      if (videoRef.current?.srcObject) {
        const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
        tracks.forEach((track) => track.stop());
      }
      window.speechSynthesis.cancel();
      recognitionRef.current?.stop?.();
    };
  }, [sessionId]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  const speakText = async (text: string) => {
    if (!activeSessionRef.current || !voiceEnabled || !text.trim()) {
      return;
    }

    const cleanText = sanitizeForSpeech(text);
    if (!cleanText) {
      return;
    }

    window.speechSynthesis.cancel();
    const sentences = cleanText.match(/[^.!?]+[.!?]*/g) || [cleanText];

    const selectedVoice = availableVoices.find(
      (voice) => voice.voiceURI === selectedVoiceURI,
    );

    for (const sentence of sentences) {
      if (!activeSessionRef.current || !voiceEnabled) {
        return;
      }

      const chunk = sentence.trim();
      if (!chunk) {
        continue;
      }

      await new Promise<void>((resolve) => {
        const utterance = new SpeechSynthesisUtterance(chunk);
        utterance.lang = "en-US";
        utterance.rate = 0.95;
        utterance.pitch = 1.02;
        if (selectedVoice) {
          utterance.voice = selectedVoice;
        }
        utterance.onend = () => resolve();
        utterance.onerror = () => resolve();
        window.speechSynthesis.speak(utterance);
      });
    }
  };

  const askQuestion = async (topic: string, questionNumber: number) => {
    if (!sessionId || !activeSessionRef.current) {
      return;
    }

    setIsProcessing(true);
    try {
      const response = await apiClient.post(
        `/interviews/${sessionId}/question?topic=${encodeURIComponent(topic)}`,
      );

      const question: SessionQuestion = response.data;
      setCurrentQuestion(question);
      setCurrentQuestionNumber(questionNumber);
      appendLog("question", question.questionText);

      await speakText(question.questionText);
    } catch (error) {
      console.error("Failed to ask next question", error);
      toast.error("Failed to load the next question");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleStartInterview = withExecutionLog(
    "InterviewUI.handleStartInterview",
    async () => {
      if (!topics.length) {
        toast.error("Interview topics are not ready yet");
        return;
      }

      activeSessionRef.current = true;
      setInterviewStarted(true);
      setCurrentTopicIndex(0);
      await askQuestion(topics[0], 1);
    },
  );

  const toggleRecording = withExecutionLog(
    "InterviewUI.toggleRecording",
    () => {
      if (isRecording) {
        recognitionRef.current?.stop?.();
        return;
      }

      recognitionRef.current?.start?.();
    },
  );

  const toggleVoice = withExecutionLog("InterviewUI.toggleVoice", () => {
    const nextValue = !voiceEnabled;
    setVoiceEnabled(nextValue);
    if (!nextValue) {
      window.speechSynthesis.cancel();
    }
  });

  const handleSendMessage = withExecutionLog(
    "InterviewUI.handleSendMessage",
    async (e: React.FormEvent) => {
      e.preventDefault();

      if (!currentQuestion || !inputMessage.trim() || isProcessing) {
        return;
      }

      const userText = inputMessage.trim();
      setInputMessage("");
      setIsProcessing(true);
      appendLog("response", userText);

      try {
        const response = await apiClient.post(
          `/interviews/question/${currentQuestion.id}/evaluate`,
          {
            userAnswer: userText,
            postureFeedback,
          },
        );

        const evaluatedQuestion: SessionQuestion = response.data;
        const evaluationText =
          evaluatedQuestion.aiResponse || "No evaluation returned.";
        appendLog("evaluation", evaluationText);

        const nextQuestionNumber = currentQuestionNumber + 1;
        const nextTopicIndex =
          Math.floor((nextQuestionNumber - 1) / QUESTIONS_PER_TOPIC) %
          topics.length;

        setCurrentTopicIndex(nextTopicIndex);
        await askQuestion(topics[nextTopicIndex], nextQuestionNumber);
      } catch (error) {
        console.error("Failed to submit interview answer", error);
        toast.error("Failed to send the answer to AI");
      } finally {
        setIsProcessing(false);
      }
    },
  );

  const endSession = withExecutionLog("InterviewUI.endSession", async () => {
    activeSessionRef.current = false;
    window.speechSynthesis.cancel();
    recognitionRef.current?.stop?.();

    try {
      await apiClient.post(`/interviews/${sessionId}/end`);
      toast.success("Interview ended. Opening logs.");
    } catch (error) {
      console.error("Failed to end interview session", error);
      toast.error("Failed to finalize interview session");
    } finally {
      navigate(`/interview/logs/${sessionId}`);
    }
  });

  return (
    <main className="mx-auto h-[calc(100vh-92px)] min-h-155 w-full max-w-7xl overflow-hidden px-6 py-5">
      <div className="relative flex h-full min-h-0 flex-col overflow-hidden rounded-3xl border border-neutral-800 bg-neutral-900/30 shadow-2xl md:flex-row">
        <section className="relative flex h-full min-h-0 w-full flex-col border-r border-neutral-800 bg-linear-to-b from-neutral-800 to-neutral-900 md:w-2/3">
          <div className="absolute left-5 top-5 z-10 flex flex-wrap gap-2">
            <span className="flex items-center gap-1.5 rounded-full border border-neutral-700 bg-neutral-800/80 px-3 py-1 text-xs font-semibold text-neutral-300">
              <span className="h-1.5 w-1.5 rounded-full bg-rose-500 animate-pulse"></span>
              Interview in Progress
            </span>
            {sessionInfo && (
              <span className="rounded-full border border-indigo-500/20 bg-indigo-500/10 px-3 py-1 text-xs font-semibold text-indigo-300">
                {sessionInfo.position} at {sessionInfo.companyName}
              </span>
            )}
          </div>

          <div className="relative flex-1 bg-black">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="absolute inset-0 h-full w-full object-cover opacity-65"
            />

            {!interviewStarted ? (
              <div className="relative z-10 mx-auto mt-24 flex max-w-sm flex-col items-center rounded-3xl border border-neutral-700/50 bg-neutral-900/80 p-8 text-center backdrop-blur-md">
                <Bot className="mb-4 h-16 w-16 text-indigo-400" />
                <h3 className="mb-2 text-xl font-bold text-white">
                  Ready to begin?
                </h3>
                <p className="mb-6 text-sm text-neutral-400">
                  Start the interview to hear the first AI question.
                </p>
                <button
                  onClick={handleStartInterview}
                  disabled={!sessionInfo || isProcessing}
                  className="rounded-full bg-indigo-500 px-8 py-3 font-semibold text-white transition-colors hover:bg-indigo-600 disabled:opacity-50"
                >
                  Start Interview
                </button>
              </div>
            ) : (
              <div
                className={`relative z-10 flex h-full items-center justify-center transition-opacity duration-300 ${isProcessing ? "opacity-100" : "opacity-0"}`}
              >
                <div className="flex h-24 w-24 items-center justify-center rounded-full bg-indigo-500/20 animate-ping">
                  <Bot className="h-8 w-8 text-indigo-300" />
                </div>
              </div>
            )}
          </div>

          <div className="flex h-24 items-center justify-between gap-4 border-t border-neutral-800 bg-neutral-950/85 px-5">
            <button className="group flex h-11 w-11 items-center justify-center rounded-full bg-neutral-800 transition-colors hover:bg-neutral-700">
              <Activity className="h-5 w-5 text-white transition group-hover:text-indigo-400" />
            </button>
            <div className="text-sm text-neutral-300">
              Topic:{" "}
              <span className="font-semibold text-white">{currentTopic}</span>
              <span className="mx-2 text-neutral-600">|</span>
              Question{" "}
              <span className="font-semibold text-white">
                {currentQuestionNumber || 0}
              </span>
            </div>
            <button
              onClick={endSession}
              className="h-11 rounded-full border border-rose-500/30 bg-rose-500/10 px-6 font-semibold text-rose-400 transition-colors hover:bg-rose-500/20"
            >
              End Session
            </button>
          </div>
        </section>

        <section className="flex h-full min-h-0 w-full flex-col bg-neutral-900/60 md:w-1/3">
          <div className="border-b border-neutral-800 bg-neutral-900/85 p-4 backdrop-blur-sm">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="flex items-center gap-2 font-semibold text-white">
                <LineChart className="h-4 w-4 text-indigo-400" />
                Live Transcript
              </h3>
              <span className="text-xs text-neutral-400">
                {Math.min(currentQuestionNumber, QUESTIONS_PER_TOPIC)} /{" "}
                {QUESTIONS_PER_TOPIC} in topic
              </span>
            </div>

            <div className="grid grid-cols-1 gap-2">
              <button
                type="button"
                onClick={toggleVoice}
                className={`inline-flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold transition ${voiceEnabled ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30" : "bg-neutral-800 text-neutral-300 border border-neutral-700"}`}
              >
                {voiceEnabled ? (
                  <Volume2 className="h-4 w-4" />
                ) : (
                  <VolumeX className="h-4 w-4" />
                )}
                {voiceEnabled ? "AI Voice On" : "AI Voice Off"}
              </button>

              <select
                value={selectedVoiceURI}
                onChange={(e) => setSelectedVoiceURI(e.target.value)}
                className="rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-2 text-xs text-neutral-200"
              >
                {availableVoices.map((voice) => (
                  <option key={voice.voiceURI} value={voice.voiceURI}>
                    {voice.name} ({voice.lang})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto p-4">
            {logs.map((log, index) => {
              const isUser = log.role === "response";
              const roleLabel =
                log.role === "question"
                  ? "AI Question"
                  : log.role === "response"
                    ? "Your Response"
                    : log.role === "evaluation"
                      ? "Evaluation"
                      : "Final Evaluation";

              return (
                <div key={`${log.role}-${index}`} className="space-y-1.5">
                  <div className="text-[11px] font-semibold uppercase tracking-widest text-neutral-500">
                    {roleLabel}
                  </div>
                  <div
                    className={`rounded-2xl border px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${isUser ? "border-indigo-400/30 bg-indigo-500/12 text-indigo-100" : "border-neutral-700 bg-neutral-850/80 text-neutral-200"}`}
                  >
                    {log.content}
                  </div>
                </div>
              );
            })}

            {isProcessing && (
              <div className="flex w-fit items-center gap-2 rounded-xl border border-neutral-700 bg-neutral-900/80 px-3 py-2">
                <div className="h-2 w-2 rounded-full bg-neutral-500 animate-bounce" />
                <div className="h-2 w-2 rounded-full bg-neutral-500 animate-bounce [animation-delay:120ms]" />
                <div className="h-2 w-2 rounded-full bg-neutral-500 animate-bounce [animation-delay:240ms]" />
              </div>
            )}
          </div>

          <div className="space-y-3 border-t border-neutral-800 bg-neutral-900/90 p-4">
            <div className="rounded-xl border border-indigo-500/20 bg-indigo-500/10 px-3 py-2 text-xs text-indigo-100">
              <div className="mb-1 font-semibold">Posture signal</div>
              <div>{postureFeedback}</div>
            </div>

            <textarea
              rows={4}
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              placeholder="Open mic and speak, or type your response here..."
              className="w-full resize-none rounded-2xl border border-neutral-700 bg-neutral-950/80 px-4 py-3 text-sm text-neutral-100 placeholder:text-neutral-500 focus:border-indigo-500 focus:outline-none"
            />

            <form onSubmit={handleSendMessage} className="flex w-full gap-3">
              <button
                type="button"
                onClick={toggleRecording}
                disabled={isProcessing || !interviewStarted}
                className={`flex h-12 flex-1 items-center justify-center gap-2 rounded-full border font-semibold transition ${isRecording ? "border-rose-500 bg-rose-500 text-white" : "border-neutral-700 bg-neutral-800 text-white hover:bg-neutral-700 disabled:opacity-50"}`}
              >
                {isRecording ? (
                  <>
                    <MicOff className="h-4 w-4" />
                    Listening...
                  </>
                ) : (
                  <>
                    <Mic className="h-4 w-4 text-indigo-300" />
                    Open Mic
                  </>
                )}
              </button>

              <button
                type="submit"
                disabled={
                  !inputMessage.trim() ||
                  isProcessing ||
                  isRecording ||
                  !interviewStarted
                }
                className="flex h-12 w-12 items-center justify-center rounded-full bg-indigo-500 text-white transition hover:bg-indigo-600 disabled:bg-neutral-800 disabled:text-neutral-500"
              >
                <Send className="h-4 w-4" />
              </button>
            </form>
          </div>
        </section>
      </div>
    </main>
  );
}
