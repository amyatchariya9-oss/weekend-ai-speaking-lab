const $ = (id) => document.getElementById(id);
const startBtn = $("start");
const endBtn = $("end");
const micBtn = $("mic");
const micHint = $("micHint");
const status = $("status");
const transcript = $("transcript");
const aiBubble = $("aiBubble");
const coachState = $("coachState");
const voiceSelect = $("voice");
const remoteAudio = $("remoteAudio");

let pc = null;
let dc = null;
let localStream = null;
let connected = false;
let aiDraft = "";

function setStatus(text) {
  status.textContent = text;
}

function addMessage(who, text, cls) {
  if (!text?.trim()) return;
  const el = document.createElement("div");
  el.className = `msg ${cls}`;
  const label = document.createElement("div");
  label.className = "who";
  label.textContent = who;
  const body = document.createElement("div");
  body.textContent = text.trim();
  el.append(label, body);
  transcript.appendChild(el);
  el.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function resetUi() {
  startBtn.classList.remove("hidden");
  micBtn.classList.add("hidden");
  micHint.classList.add("hidden");
  endBtn.classList.add("hidden");
  voiceSelect.disabled = false;
  micBtn.classList.remove("live");
  coachState.textContent = "Ready when you are";
  connected = false;
}

async function stopSession() {
  try { dc?.close(); } catch {}
  try { pc?.close(); } catch {}
  if (localStream) localStream.getTracks().forEach(t => t.stop());
  pc = dc = localStream = null;
  remoteAudio.srcObject = null;
  setStatus("Conversation ended.");
  resetUi();
}

function handleEvent(event) {
  if (event.type === "input_audio_buffer.speech_started") {
    coachState.textContent = "Listening…";
    setStatus("Listening to you…");
  }

  if (event.type === "input_audio_buffer.speech_stopped") {
    coachState.textContent = "Thinking…";
    setStatus("Got it. AI is thinking…");
  }

  if (event.type === "conversation.item.input_audio_transcription.completed") {
    addMessage("YOU SAID", event.transcript || "", "user");
  }

  if (event.type === "response.output_audio_transcript.delta") {
    aiDraft += event.delta || "";
    aiBubble.textContent = aiDraft;
  }

  if (event.type === "response.output_audio_transcript.done") {
    const text = event.transcript || aiDraft;
    aiBubble.textContent = text;
    addMessage("AI COACH", text, "ai");
    aiDraft = "";
    coachState.textContent = "Your turn";
    setStatus("Your turn — speak when you're ready.");
  }

  if (event.type === "error") {
    console.error(event);
    setStatus("There was an AI connection error. Check the server/API key.");
  }
}

async function startSession() {
  startBtn.disabled = true;
  setStatus("Requesting microphone permission…");

  try {
    localStream = await navigator.mediaDevices.getUserMedia({ audio: true });

    pc = new RTCPeerConnection();
    pc.ontrack = (e) => {
      remoteAudio.srcObject = e.streams[0];
      remoteAudio.play().catch(() => {});
    };

    localStream.getTracks().forEach(track => pc.addTrack(track, localStream));

    dc = pc.createDataChannel("oai-events");
    dc.addEventListener("message", (e) => {
      try { handleEvent(JSON.parse(e.data)); } catch (err) { console.error(err); }
    });

    dc.addEventListener("open", () => {
      connected = true;
      setStatus("Connected. AI is starting the Weekend conversation…");
      coachState.textContent = "Speaking…";

      dc.send(JSON.stringify({
        type: "response.create",
        response: {
          instructions: 'Start now. Say exactly: "Hey! How was your weekend?"'
        }
      }));
    });

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    const voice = encodeURIComponent(voiceSelect.value);
    const r = await fetch(`/session?voice=${voice}`, {
      method: "POST",
      body: offer.sdp,
      headers: { "Content-Type": "application/sdp" }
    });

    if (!r.ok) {
      throw new Error(await r.text());
    }

    const answer = {
      type: "answer",
      sdp: await r.text()
    };
    await pc.setRemoteDescription(answer);

    startBtn.classList.add("hidden");
    micBtn.classList.remove("hidden");
    micHint.classList.remove("hidden");
    endBtn.classList.remove("hidden");
    micBtn.classList.add("live");
    voiceSelect.disabled = true;
  } catch (err) {
    console.error(err);
    setStatus(
      err?.name === "NotAllowedError"
        ? "Microphone permission was denied. Allow microphone access and try again."
        : "Could not start. Check your API key, HTTPS, and server logs."
    );
    await stopSession();
  } finally {
    startBtn.disabled = false;
  }
}

startBtn.addEventListener("click", startSession);
endBtn.addEventListener("click", stopSession);

window.addEventListener("beforeunload", () => {
  if (connected) {
    try { pc?.close(); } catch {}
    localStream?.getTracks().forEach(t => t.stop());
  }
});
