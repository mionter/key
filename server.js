/**
 * OKX AI Agent Service Provider — MCP-Compatible Server
 * Powered by AgentRouter → Claude
 *
 * Services offered:
 *  - research  : Deep research with citations
 *  - write     : Technical article / report writing
 *  - analyze   : Trading strategy & market analysis
 *  - sql       : Plain-English → SQL query
 */

const express = require('express');
const cors    = require('cors');

const app = express();
app.use(cors());
app.use(express.json({ limit: '5mb' }));

// ── Config ────────────────────────────────────────────────────────────────────
const PORT       = process.env.PORT          || 3000;
const AR_KEY     = process.env.AGENTROUTER_API_KEY;          // required
const AI_MODEL   = process.env.AI_MODEL      || 'claude-sonnet-4-5-20250929';
const ASP_NAME   = process.env.ASP_NAME      || 'Claude AI Research & Writing ASP';
const ASP_DESC   = process.env.ASP_DESC      || 'AI-powered research, writing, market analysis, and SQL generation. Backed by Claude via AgentRouter.';

// ── Tool Definitions (MCP schema) ─────────────────────────────────────────────
const TOOLS = [
  {
    name: 'research',
    description: 'Research any topic and return a comprehensive, well-cited report.',
    inputSchema: {
      type: 'object',
      properties: {
        topic:  { type: 'string', description: 'The topic or question to research' },
        depth:  { type: 'string', enum: ['brief', 'standard', 'deep'], description: 'How thorough the research should be (default: standard)' }
      },
      required: ['topic']
    }
  },
  {
    name: 'write',
    description: 'Write a technical article, essay, or professional report.',
    inputSchema: {
      type: 'object',
      properties: {
        prompt:  { type: 'string', description: 'What to write about, including any requirements' },
        format:  { type: 'string', description: 'Output format: article, report, summary, blog_post, etc.' },
        length:  { type: 'string', enum: ['short', 'medium', 'long'], description: 'Approximate length (default: medium)' }
      },
      required: ['prompt']
    }
  },
  {
    name: 'analyze',
    description: 'Analyze a trading strategy, token, or market setup. Returns technical analysis, support/resistance, sentiment, and recommendations.',
    inputSchema: {
      type: 'object',
      properties: {
        asset:      { type: 'string', description: 'Token, ticker, or asset name (e.g. HYPE, BTC, ETH)' },
        data:       { type: 'string', description: 'Additional data, chart description, or context to analyze' },
        type:       { type: 'string', enum: ['swing', 'scalp', 'long_term', 'general'], description: 'Type of analysis (default: general)' }
      },
      required: ['asset']
    }
  },
  {
    name: 'sql',
    description: 'Convert a plain-English description into a correct SQL query.',
    inputSchema: {
      type: 'object',
      properties: {
        request:  { type: 'string', description: 'Plain-English description of what the SQL should do' },
        dialect:  { type: 'string', description: 'SQL dialect: postgres, mysql, sqlite, bigquery, etc. (default: postgres)' }
      },
      required: ['request']
    }
  }
];

// ── AgentRouter Call ──────────────────────────────────────────────────────────
async function callAgentRouter(systemPrompt, userContent) {
  if (!AR_KEY) throw new Error('AGENTROUTER_API_KEY environment variable is not set.');

  const resp = await fetch('https://agentrouter.org/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${AR_KEY}`
    },
    body: JSON.stringify({
      model:      AI_MODEL,
      max_tokens: 4096,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user',   content: userContent  }
      ]
    })
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`AgentRouter ${resp.status}: ${text.slice(0, 300)}`);
  }

  const data = await resp.json();
  return data.choices?.[0]?.message?.content || '';
}

// ── Prompt Templates ──────────────────────────────────────────────────────────
function buildSystemPrompt(toolName) {
  const systems = {
    research: `You are an expert researcher and analyst. Produce comprehensive, factual, well-structured research reports.
Always include: Executive Summary → Key Findings (with citations where possible) → Detailed Analysis → Conclusion.
Be thorough. Support all claims with reasoning or evidence.`,

    write: `You are a professional technical writer and content strategist.
Produce high-quality, well-structured documents that are clear, engaging, and accurate.
Use proper headings, logical flow, and concrete examples.`,

    analyze: `You are a professional financial analyst and crypto market strategist.
Provide structured technical analysis including: asset overview, technical indicators, support/resistance levels,
market sentiment, catalyst analysis, risk factors, and a concrete strategic recommendation with entry/target/stop guidance.`,

    sql: `You are an expert database engineer and SQL specialist.
Convert plain-English requests into correct, optimized SQL queries.
Always output: (1) the complete SQL query in a code block, (2) a plain-English explanation of what it does, (3) any assumptions made.`
  };
  return systems[toolName] || 'You are a highly capable AI assistant. Complete the task thoroughly and professionally.';
}

function buildUserContent(toolName, args) {
  switch (toolName) {
    case 'research':
      return `Research Topic: ${args.topic}\nDepth: ${args.depth || 'standard'}\n\nProvide a comprehensive research report.`;
    case 'write':
      return `Writing Request: ${args.prompt}\nFormat: ${args.format || 'article'}\nLength: ${args.length || 'medium'}\n\nWrite this document now.`;
    case 'analyze':
      return `Asset: ${args.asset}\nAnalysis Type: ${args.type || 'general'}\n${args.data ? `\nAdditional Context:\n${args.data}` : ''}\n\nProvide a complete analysis.`;
    case 'sql':
      return `Request: ${args.request}\nSQL Dialect: ${args.dialect || 'postgres'}\n\nGenerate the SQL query.`;
    default:
      return JSON.stringify(args);
  }
}

// ── Routes ────────────────────────────────────────────────────────────────────

// Health — UptimeRobot pings this
app.get('/health', (_req, res) => {
  res.json({
    status:    'ok',
    name:       ASP_NAME,
    model:      AI_MODEL,
    uptime_sec: Math.floor(process.uptime()),
    timestamp:  new Date().toISOString()
  });
});

// MCP: initialize
app.post('/mcp', async (req, res) => {
  const { jsonrpc, id, method, params } = req.body;

  // ── tools/list ────────────────────────────────────────────
  if (method === 'tools/list') {
    return res.json({ jsonrpc: '2.0', id, result: { tools: TOOLS } });
  }

  // ── initialize ────────────────────────────────────────────
  if (method === 'initialize') {
    return res.json({
      jsonrpc: '2.0', id,
      result: {
        protocolVersion: '2024-11-05',
        capabilities:    { tools: {} },
        serverInfo:      { name: ASP_NAME, version: '1.0.0' }
      }
    });
  }

  // ── tools/call ────────────────────────────────────────────
  if (method === 'tools/call') {
    const { name: toolName, arguments: args } = params || {};
    const tool = TOOLS.find(t => t.name === toolName);

    if (!tool) {
      return res.json({
        jsonrpc: '2.0', id,
        error: { code: -32601, message: `Unknown tool: ${toolName}` }
      });
    }

    try {
      const result = await callAgentRouter(
        buildSystemPrompt(toolName),
        buildUserContent(toolName, args || {})
      );
      return res.json({
        jsonrpc: '2.0', id,
        result: { content: [{ type: 'text', text: result }] }
      });
    } catch (err) {
      console.error(`[tools/call] ${toolName}:`, err.message);
      return res.json({
        jsonrpc: '2.0', id,
        error: { code: -32000, message: err.message }
      });
    }
  }

  // ── unknown method ────────────────────────────────────────
  res.json({ jsonrpc: '2.0', id, error: { code: -32601, message: 'Method not found' } });
});

// Root — human-readable ASP info (also works as an OKX discovery endpoint)
app.get('/', (_req, res) => {
  res.json({
    name:        ASP_NAME,
    description: ASP_DESC,
    version:     '1.0.0',
    mcp_endpoint: '/mcp',
    tools:       TOOLS.map(t => ({ name: t.name, description: t.description }))
  });
});

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🚀  ${ASP_NAME}`);
  console.log(`📡  MCP endpoint : http://localhost:${PORT}/mcp`);
  console.log(`💚  Health check : http://localhost:${PORT}/health`);
  console.log(`🤖  AI model     : ${AI_MODEL}`);
  console.log(`🔑  AgentRouter  : ${AR_KEY ? '✓ key loaded' : '✗ AGENTROUTER_API_KEY not set!'}\n`);
});
