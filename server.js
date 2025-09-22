import express from "express";
import bodyParser from "body-parser";
import webpush from "web-push";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(bodyParser.json());

// VAPID ayarları
webpush.setVapidDetails(
  "mailto:you@parpar.it",
  process.env.VAPID_PUBLIC,
  process.env.VAPID_PRIVATE
);

const subscriptions = {};

// Abonelik kaydet
app.post("/api/register", (req, res) => {
  const { phone, subscription } = req.body;
  subscriptions[phone] = subscription;
  res.json({ ok: true });
});

// Bildirim gönder
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
app.listen(PORT, () => console.log("Server running on port", PORT));
