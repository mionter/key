# OKX AI ASP Server — Full Setup Guide

An always-on MCP server that registers as an **Agent Service Provider (ASP)** on [OKX.AI](https://okx.ai), powered by **AgentRouter** (your $175 credit). Earns USDT from other agents that call your services.

---

## Architecture

```
GitHub Repo
    │
    └─► Render (auto-deploy on push)
              │
              ├─► /health  ◄── UptimeRobot pings every 5 min (prevents sleep)
              │
              └─► /mcp     ◄── OKX AI sends tasks here
                        │
                        └─► AgentRouter API (Claude) → result returned → USDT earned
```

---

## Step 1 — Push to GitHub

```bash
git init
git add .
git commit -m "initial ASP server"
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git
git push -u origin main
```

---

## Step 2 — Deploy on Render (free tier)

1. Go to **[render.com](https://render.com)** → "New +" → **Web Service**
2. Connect your GitHub account and select your repo
3. Render auto-detects `render.yaml` — confirm these settings:
   - **Build command:** `npm install`
   - **Start command:** `node server.js`
   - **Node version:** 18+
4. Under **Environment Variables**, add:
   ```
   AGENTROUTER_API_KEY = your_key_from_agentrouter.org
   ```
5. Click **Deploy**. You'll get a URL like `https://okx-asp-server.onrender.com`

> ⚠️ **Free tier note:** Render's free tier sleeps after 15 min of inactivity. Fix this in Step 3.

---

## Step 3 — UptimeRobot (keeps server awake, free)

1. Go to **[uptimerobot.com](https://uptimerobot.com)** → Create Free Account
2. Click **"+ Add New Monitor"**
3. Settings:
   - **Monitor Type:** HTTP(s)
   - **Friendly Name:** OKX ASP Server
   - **URL:** `https://your-render-url.onrender.com/health`
   - **Monitoring Interval:** Every **5 minutes**
4. Click **Create Monitor**

UptimeRobot now pings `/health` every 5 minutes. Render never sleeps. ✅

---

## Step 4 — AgentRouter API Key

1. Go to **[agentrouter.org](https://agentrouter.org)** → sign in
2. Dashboard → **Console → Token** → copy your API key
3. Check your balance — you should see ~$175
4. Check available models (look for `claude-sonnet-*` or `claude-opus-*`)
5. Paste your key into Render's environment variables (already done in Step 2)

---

## Step 5 — Install OKX OnchainOS (on your local machine or Claude Code)

Open **Claude Code** (or any supported agent: OpenClaw, Codex, Hermes) and send:

```
npx skills add okx/onchainos-skills --yes -g
```

After installation completes, **open a new session**, then:

```
Log in to Agentic Wallet on Onchain OS with my email
```

Follow the prompts — you get a login URL, enter your email, verify, done. No OKX account needed.

---

## Step 6 — Register as A2MCP ASP

Your Render server URL is your MCP endpoint. Send this to your agent:

```
Help me register an A2MCP ASP on OKX.AI using OKX Agent Identity from Onchain OS
```

The agent will ask for:
- **Name:** e.g. "Claude AI Research & Writing ASP"
- **Description:** e.g. "Deep research, technical writing, market analysis, SQL generation — powered by Claude"
- **Endpoint URL:** `https://your-render-url.onrender.com/mcp`
- **Services & pricing:** free (to start) or paid per call

---

## Step 7 — List on Marketplace

```
Help me list my ASP on OKX.AI using Onchain OS
```

OKX reviews within 24 hours. Check your email for approval.

---

## Step 8 — Start Earning

Once approved, other agents on OKX.AI will discover your services and call your `/mcp` endpoint. Each call routes through AgentRouter → Claude, uses your $175 credit, and your USDT balance grows.

---

## Services This Server Offers

| Tool | What It Does |
|------|-------------|
| `research` | Deep research on any topic with citations |
| `write` | Technical articles, reports, blog posts |
| `analyze` | Trading strategy & market analysis (supports HYPE, BTC, etc.) |
| `sql` | Plain-English → SQL query (Postgres, MySQL, etc.) |

---

## Test Your Server Locally

```bash
cp .env.example .env
# Fill in AGENTROUTER_API_KEY in .env

npm install
npm run dev

# Test health
curl http://localhost:3000/health

# Test a tool call
curl -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/call",
    "params": {
      "name": "research",
      "arguments": { "topic": "x402 payment protocol for AI agents" }
    }
  }'
```

---

## Credit Management

Your $175 AgentRouter credit goes further if you:
- Use `claude-sonnet-*` instead of `claude-opus-*` (4–5x cheaper per token)
- Set `max_tokens` to 4096 (already configured)
- Check usage at agentrouter.org dashboard

---

## File Structure

```
okx-asp-server/
├── server.js       ← Main MCP server (edit tools/prompts here)
├── package.json
├── render.yaml     ← Render auto-deploy config
├── .env.example    ← Copy to .env for local dev
├── .gitignore      ← Excludes .env and node_modules
└── README.md
```

---

## OKX AI Links

- Marketplace: https://okx.ai/agents
- Task board: https://okx.ai/tasks
- ASP tutorial: https://okx.ai/tutorial/asp
- OnchainOS docs: https://web3.okx.com/onchainos
