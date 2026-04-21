const express = require("express");

const app = express();

app.use(express.json({ limit: "2mb" }));

const port = Number(process.env.PORT) || 3000;
const host = process.env.HOST || "0.0.0.0";
const verifyToken = process.env.VERIFY_TOKEN;

app.get("/healthz", (_req, res) => {
  return res.status(200).json({ ok: true });
});

app.get("/", (req, res) => {
  const mode = req.query["hub.mode"];
  const challenge = req.query["hub.challenge"];
  const token = req.query["hub.verify_token"];

  if (mode === "subscribe" && token === verifyToken) {
    console.log("WEBHOOK VERIFIED");
    return res.status(200).send(challenge);
  }

  console.warn("WEBHOOK VERIFICATION FAILED", {
    mode,
    hasChallenge: typeof challenge !== "undefined",
    hasToken: typeof token !== "undefined" && token !== "",
    verifyTokenConfigured: Boolean(verifyToken),
    tokenMatches: token === verifyToken,
  });

  return res.status(403).end();
});

app.post("/", (req, res) => {
  const timestamp = new Date().toISOString().replace("T", " ").slice(0, 19);

  console.log(`\n\nWebhook received ${timestamp}\n`);
  console.log(JSON.stringify(req.body, null, 2));

  return res.status(200).end();
});

app.listen(port, host, () => {
  if (!verifyToken) {
    console.warn(
      "\nWARNING: VERIFY_TOKEN is not set. GET verification requests will fail.\n",
    );
  }

  console.log(`\nListening on ${host}:${port}\n`);
});
