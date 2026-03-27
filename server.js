const path = require("path");
const express = require("express");

const app = express();
const PORT = process.env.PORT || 3000;

const campaignApiBase =
  process.env.CAMPAIGN_API_BASE || "https://campaign-manager-api-8zjt.onrender.com";

app.use(express.static(path.join(__dirname, "public")));

app.get("/healthz", (_req, res) => {
  res.status(200).json({ ok: true });
});

app.get("/config.js", (_req, res) => {
  res.type("application/javascript");
  res.send(`window.__APP_CONFIG__ = ${JSON.stringify({
    apiBase: campaignApiBase,
  })};`);
});

app.get("*", (_req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, () => {
  console.log(`friendsforever is running on port ${PORT}`);
});
