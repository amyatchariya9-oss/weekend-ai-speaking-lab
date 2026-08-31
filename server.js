import "dotenv/config";
import express from "express";

const app = express();
const port = process.env.PORT || 3000;

app.use(express.static("public"));
app.use("/session", express.text({ type: ["application/sdp", "text/plain"], limit: "1mb" }));

const allowedVoices = new Set([
  "alloy", "ash", "ballad", "coral", "echo",
  "sage", "shimmer", "verse", "marin", "cedar"
]);

app.post("/session", async (req, res) => {
  if (!process.env.OPENAI_API_KEY) {
    return res.status(500).send("Missing OPENAI_API_KEY on the server.");
  }

  const voice = allowedVoices.has(req.query.voice) ? req.query.voice : "coral";

  const instructions = `
You are Amy, a warm English speaking coach for Thai beginner learners.

LESSON: My Weekend
GOAL: Help the learner talk naturally about their most recent weekend.

Conversation rules:
- Speak in friendly, simple English at a beginner-friendly speed.
- Keep each response short: usually 1–2 sentences.
- Ask only ONE question at a time.
- The learner must answer by voice.
- Do not ask them to type.
- Focus on useful spoken English, not textbook perfection.
- Do not interrupt for tiny mistakes that do not affect communication.
- If the learner makes an important grammar or natural-English mistake:
  1. Briefly acknowledge the meaning.
  2. Say exactly: "Try this:" followed by ONE improved sentence.
  3. Give at most one very short Thai explanation when useful.
  4. Say: "Say it again."
  5. Wait for the learner to repeat it.
  6. If the repeat is good enough, praise briefly and continue.
- If their answer is already natural enough, do not invent a correction.
- Never shame the learner or say their English is bad.
- Keep the conversation about the weekend.
- Useful follow-ups may include: how it was, what they did, who they were with,
  where they went, what they ate/bought, favorite part, and next weekend.
- Aim for about five meaningful learner turns before a short closing message.
- Do not give numeric pronunciation scores in this version.
- If the learner asks what a word means, explain briefly and return to the conversation.

Begin the session by saying exactly:
"Hey! How was your weekend?"
`.trim();

  const session = {
    type: "realtime",
    model: "gpt-realtime",
    output_modalities: ["audio"],
    instructions,
    audio: {
      input: {
        transcription: {
          model: "gpt-4o-mini-transcribe",
          language: "en",
          prompt: "English learner speaking about their weekend."
        },
        noise_reduction: { type: "near_field" },
        turn_detection: {
          type: "semantic_vad"
        }
      },
      output: {
        voice,
        speed: 0.92
      }
    }
  };

  try {
    const form = new FormData();
form.set("sdp", req.body);
form.set("session", JSON.stringify(session));
    const r = await fetch("https://api.openai.com/v1/realtime/calls", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: form
    });

    const body = await r.text();
    if (!r.ok) {
      console.error("OpenAI realtime error:", r.status, body);
      return res.status(r.status).send(body);
    }

    res.status(200).type("application/sdp").send(body);
  } catch (err) {
    console.error(err);
    res.status(500).send("Could not create realtime session.");
  }
});

app.listen(port, () => {
  console.log(`Weekend AI Speaking Lab running at http://localhost:${port}`);
});
