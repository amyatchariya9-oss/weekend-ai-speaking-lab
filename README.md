# Weekend AI Speaking Lab — Voice MVP

This is a real microphone-based browser MVP.

## What it does
- Requests microphone access.
- Connects the browser to OpenAI Realtime over WebRTC.
- AI speaks out loud.
- Learner answers by voice.
- User speech is transcribed on screen.
- AI corrects important grammar/natural-English mistakes verbally and asks the learner to repeat them.
- AI continues a Weekend conversation after an acceptable repeat.
- Lets you choose an AI voice before the session begins.

## What it does NOT do yet
- No detailed pronunciation score.
- No login/database/progress history yet.
- No Tevello/Shopify embedding yet.

## Run locally

1. Install Node.js 18+.
2. Open this folder in Terminal.
3. Run:
   npm install
4. Copy `.env.example` to `.env`.
5. Put your OpenAI API key in `.env`:
   OPENAI_API_KEY=...
6. Run:
   npm start
7. Open:
   http://localhost:3000

For phone testing, deploy to an HTTPS host. Browser microphone access generally requires a secure context (HTTPS), except localhost.

## Security
Never put your OpenAI API key inside public/app.js or any browser-side file. This project keeps the key on the server.

## Next build
Add pronunciation assessment (accuracy / fluency / prosody and word-level feedback), then store lesson progress.
