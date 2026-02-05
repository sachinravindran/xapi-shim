import express from "express";
import fetch from "node-fetch";

const app = express();

const TARGET = (process.env.TARGET_BASE_URL || "http://lrsql:8080").replace(/\/$/, "");
const AUTH = process.env.LRS_BASIC_AUTH; // "Basic base64(key:secret)"

app.use(express.raw({ type: "*/*", limit: "10mb" }));

function copyHeaders(req) {
  const h = {};
  for (const [k, v] of Object.entries(req.headers)) {
    const lk = k.toLowerCase();

    // Strip incoming Authorization entirely
    if (lk === "authorization") continue;

    if (["host", "content-length", "connection", "accept-encoding"].includes(lk)) continue;
    h[k] = v;
  }

  // Always use shim's own credentials to talk to SQL-LRS
  if (AUTH) {
    h["Authorization"] = AUTH;
  }

  return h;
}


async function forward(method, url, headers, body) {
  const options = { method, headers };

  // Only attach body for methods that allow it
  if (!["GET", "HEAD"].includes(method)) {
    options.body = body;
  }

  const r = await fetch(url, options);
  const buf = Buffer.from(await r.arrayBuffer());
  return { r, buf };
}


app.all("/xapi/*", async (req, res) => {
  const targetUrl = `${TARGET}${req.originalUrl}`;
  const isStatePut =
    req.method === "PUT" &&
    req.path === "/xapi/activities/state";

  try {
    const headers = copyHeaders(req);

    if (isStatePut) {
      const g = await fetch(targetUrl, {
        method: "GET",
        headers
      });

      if (g.status === 200) {
        const etag = g.headers.get("etag");
        if (etag) headers["If-Match"] = etag;
      } else if (g.status === 404) {
        headers["If-None-Match"] = "*";
      }
    }

    const { r, buf } = await forward(req.method, targetUrl, headers, req.body);

    r.headers.forEach((v, k) => {
      if (!["content-encoding", "transfer-encoding", "connection"].includes(k.toLowerCase())) {
        res.setHeader(k, v);
      }
    });

    res.status(r.status).send(buf);
  } catch (e) {
    res.status(502).send(`xapi-shim error: ${e.message}`);
  }
});

app.get("/health", (_, res) => res.send("ok"));

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`xapi-shim running on :${port}`));
