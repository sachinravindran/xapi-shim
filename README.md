# xapi-shim

A small compatibility layer that helps xAPI content players (like iSpring) work reliably with strict, spec-correct LRS implementations (such as SQL-LRS by Yet Analytics).

This project exists because sometimes *everything is correct*, yet things still don’t work together.

---

## Why this exists

While integrating **iSpring xAPI content** with **SQL-LRS**, I ran into repeated issues with:

- `PUT /activities/state` failing after the first attempt
- `409 Conflict` and `401 Unauthorized` responses
- Resume / bookmarking breaking
- The infamous “Introduce yourself” dialog reappearing unexpectedly

After digging through network traces and the xAPI spec, it became clear that:

- SQL-LRS is correctly enforcing **ETag-based state concurrency**
- Some xAPI clients do not fully implement this part of the spec
- The failure happens in the **browser → LRS** interaction layer, outside of Moodle or any LMS control

Rather than relaxing the LRS (which felt wrong), I added a small shim that adapts client behavior while keeping the LRS strict.

That shim is this project.

---

## What xapi-shim does

`xapi-shim` sits between an xAPI client and the LRS and:

- Transparently handles **ETag negotiation** for `activities/state`
- Performs a GET-before-PUT when required
- Injects `If-Match` or `If-None-Match` headers as appropriate
- Enforces a clean **authentication boundary**
  - Browser-supplied Authorization headers are ignored
  - The shim authenticates to the LRS using its own credentials

No changes are required to:
- iSpring exports
- Moodle
- SQL-LRS configuration

---

## Typical architecture


Browser (iSpring content)
|
xapi-shim
|
SQL-LRS


Recommended usage:

- **iSpring** → xapi-shim  
- **Moodle / other platforms** → SQL-LRS directly

This keeps responsibilities clear and avoids weakening the LRS.

---

## How it works (high level)

For `PUT /xapi/activities/state` requests:

1. The shim performs a `GET` to the target LRS
2. If the state exists:
   - Reads the `ETag`
   - Forwards the `PUT` with `If-Match`
3. If the state does not exist:
   - Forwards the `PUT` with `If-None-Match: *`
4. The shim always authenticates using its own LRS credentials

All other xAPI endpoints are passed through unchanged.

---

## Configuration

### Environment variables

```env
TARGET_BASE_URL=https://lrs.example.com
LRS_BASIC_AUTH=Basic BASE64(key:secret)
````

Notes:
```
- Do **not** include < >
- Do **not** include base64(...)
- The value must be literal: Basic <actual-base64-string>
```

## **Running locally**

```
npm install
node server.js
```

Health check:

```
curl http://localhost:3000/health
```

---

## **Docker usage**

```
FROM node:20-alpine
WORKDIR /app
COPY package.json .
RUN npm install --omit=dev
COPY server.js .
EXPOSE 3000
CMD ["node", "server.js"]
```

---

## **Quick verification**

```
curl -i \
  -X PUT \
  -H "Content-Type: application/json" \
  -H "X-Experience-API-Version: 1.0.3" \
  --data '[1]' \
  "https://xapi-proxy.example.com/xapi/activities/state?activityId=..."
```

Expected result:

```
HTTP/2 204 No Content
```

---

## **Why not relax SQL-LRS?**

Because this is a **client-side compatibility issue**, not a server bug.
SQL-LRS is doing the right thing by enforcing concurrency rules.
This shim allows imperfect clients to work without compromising the LRS.

---

## **License**
MIT

---

## **Author**
Sachin Ravindran
https://theinfiniteloop.com
https://github.com/sachinravindran
