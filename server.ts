import express from "express";
import { createServer as createViteServer } from "vite";
import { google } from "googleapis";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import Database from "better-sqlite3";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const db = new Database("sessions.db");
db.exec(`
  CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    tokens TEXT
  )
`);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    `${process.env.APP_URL}/auth/callback`
  );

  // Auth Routes
  app.get("/api/auth/url", (req, res) => {
    const url = oauth2Client.generateAuthUrl({
      access_type: "offline",
      scope: [
        "https://www.googleapis.com/auth/spreadsheets",
        "https://www.googleapis.com/auth/drive.file",
      ],
      prompt: "consent",
    });
    res.json({ url });
  });

  app.get("/auth/callback", async (req, res) => {
    const { code, state } = req.query;
    try {
      const { tokens } = await oauth2Client.getToken(code as string);
      // In a real app, we'd use a proper session ID. 
      // For this demo, we'll use a simple 'default' session or a query param if provided.
      db.prepare("INSERT OR REPLACE INTO sessions (id, tokens) VALUES (?, ?)").run(
        "default_user",
        JSON.stringify(tokens)
      );

      res.send(`
        <html>
          <body>
            <script>
              if (window.opener) {
                window.opener.postMessage({ type: 'OAUTH_AUTH_SUCCESS' }, '*');
                window.close();
              } else {
                window.location.href = '/';
              }
            </script>
            <p>Authentication successful. This window should close automatically.</p>
          </body>
        </html>
      `);
    } catch (error) {
      console.error("OAuth Error:", error);
      res.status(500).send("Authentication failed.");
    }
  });

  app.get("/api/auth/status", (req, res) => {
    const session = db.prepare("SELECT tokens FROM sessions WHERE id = ?").get("default_user") as any;
    res.json({ authenticated: !!session });
  });

  // Google Sheets Logging
  app.post("/api/log", async (req, res) => {
    const { title, fileLink, status } = req.body;
    const session = db.prepare("SELECT tokens FROM sessions WHERE id = ?").get("default_user") as any;

    if (!session) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    try {
      const tokens = JSON.parse(session.tokens);
      oauth2Client.setCredentials(tokens);
      const sheets = google.sheets({ version: "v4", auth: oauth2Client });

      // Create a new sheet if it doesn't exist or use a specific one
      // For simplicity, we'll try to find a sheet named "Video Transformer Log"
      const drive = google.drive({ version: "v3", auth: oauth2Client });
      const files = await drive.files.list({
        q: "name = 'Video Transformer AI Log' and mimeType = 'application/vnd.google-apps.spreadsheet'",
        fields: "files(id, name)",
      });

      let spreadsheetId;
      if (files.data.files && files.data.files.length > 0) {
        spreadsheetId = files.data.files[0].id;
      } else {
        const resource = {
          properties: {
            title: "Video Transformer AI Log",
          },
        };
        const spreadsheet = await sheets.spreadsheets.create({
          requestBody: resource,
          fields: "spreadsheetId",
        });
        spreadsheetId = spreadsheet.data.spreadsheetId;
        
        // Add headers
        await sheets.spreadsheets.values.append({
          spreadsheetId,
          range: "Sheet1!A1",
          valueInputOption: "RAW",
          requestBody: {
            values: [["Title", "File Link", "Date Created", "Status"]],
          },
        });
      }

      await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: "Sheet1!A1",
        valueInputOption: "RAW",
        requestBody: {
          values: [[title, fileLink, new Date().toISOString().split('T')[0], status]],
        },
      });

      res.json({ success: true, spreadsheetId });
    } catch (error) {
      console.error("Logging Error:", error);
      res.status(500).json({ error: "Failed to log to Google Sheets" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
