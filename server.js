const express = require("express");
const bodyParser = require("body-parser");
const webpush = require("web-push");

const app = express();
app.use(bodyParser.json());

webpush.setVapidDetails(
  "mailto:you@parpar.it",
  process.env.VAPID_PUBLIC,
  process.env.VAPID_PRIVATE
);

const subscriptions = {};

app.post("/api/register", (req, res) => {
  const { phone, subscription } = req.body;
  subscriptions[phone] = subscription;
  res.json({ ok: true });
});

app.post("/api/send", async (req, res) => {
  const { toPhone, fromPhone, message } = req.body;
  const sub = subscriptions[toPhone];
  if (!sub) return res.status(404).json({ error: "No subscription" });

  try {
    await webpush.sendNotification(
      sub,
      JSON.stringify({
        title: "Yeni mesaj",
        body: `${fromPhone}: ${message}`,
        fromPhone,
      })
    );
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Push failed" });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Push server running on :" + PORT));
