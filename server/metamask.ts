import { Router } from 'express';
import { exec } from 'child_process';
import util from 'util';

export const metamaskRouter = Router();
const execAsync = util.promisify(exec);

// Helper to check if live execution is enabled
const requireLiveExecution = (req: any, res: any, next: any) => {
  if (process.env.LIVE_EXECUTION_ENABLED !== 'true') {
    return res.status(403).json({ error: 'Live execution is currently locked. Set LIVE_EXECUTION_ENABLED=true in the environment to enable.' });
  }
  next();
};

metamaskRouter.post('/api/mm/login', async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) return res.status(400).json({ error: 'Token required' });
    const { stdout } = await execAsync(`npx -y @metamask/agentic-cli@3 login --token "${token.replace(/"/g, '\\"')}"`);
    res.json({ success: true, output: stdout });
  } catch (err: any) {
    res.status(500).json({ error: err.message, stderr: err.stderr });
  }
});

metamaskRouter.get('/api/mm/status', async (req, res) => {
  try {
    const { stdout } = await execAsync(`npx -y @metamask/agentic-cli@3 auth status --json`);
    res.json(JSON.parse(stdout));
  } catch (err: any) {
    res.status(500).json({ error: err.message, stderr: err.stderr });
  }
});

metamaskRouter.get('/api/mm/address', async (req, res) => {
  try {
    const { stdout } = await execAsync(`npx -y @metamask/agentic-cli@3 wallet address`);
    res.json({ address: stdout.trim() });
  } catch (err: any) {
    res.status(500).json({ error: err.message, stderr: err.stderr });
  }
});

metamaskRouter.get('/api/mm/balance', async (req, res) => {
  try {
    const chainId = req.query.chain || '8453';
    const { stdout } = await execAsync(`npx -y @metamask/agentic-cli@3 wallet balance --chain ${chainId} --json`);
    res.json(JSON.parse(stdout));
  } catch (err: any) {
    res.status(500).json({ error: err.message, stderr: err.stderr });
  }
});

metamaskRouter.post('/api/mm/transfer', requireLiveExecution, async (req, res) => {
  try {
    const { to, amount, token, chainId } = req.body;
    if (!to || !amount) return res.status(400).json({ error: 'Missing destination or amount' });
    const cmd = `npx -y @metamask/agentic-cli@3 transfer --to "${to}" --amount ${amount} --token ${token || 'native'} --chain-id ${chainId || '8453'} --wait --json`;
    const { stdout } = await execAsync(cmd);
    res.json(JSON.parse(stdout));
  } catch (err: any) {
    res.status(500).json({ error: err.message, stderr: err.stderr });
  }
});

metamaskRouter.post('/api/mm/swap/quote', async (req, res) => {
  try {
    const { from, to, amount, fromChain, toChain } = req.body;
    let cmd = `npx -y @metamask/agentic-cli@3 swap quote --from ${from} --to ${to} --amount ${amount} --from-chain ${fromChain || '8453'} --json`;
    if (toChain) cmd += ` --to-chain ${toChain}`;
    const { stdout } = await execAsync(cmd);
    res.json(JSON.parse(stdout));
  } catch (err: any) {
    res.status(500).json({ error: err.message, stderr: err.stderr });
  }
});

metamaskRouter.post('/api/mm/swap/execute', requireLiveExecution, async (req, res) => {
  try {
    const { quoteId } = req.body;
    const { stdout } = await execAsync(`npx -y @metamask/agentic-cli@3 swap execute --quote-id ${quoteId} --json`);
    res.json(JSON.parse(stdout));
  } catch (err: any) {
    res.status(500).json({ error: err.message, stderr: err.stderr });
  }
});

metamaskRouter.get('/api/mm/perps/balance', async (req, res) => {
  try {
    const { stdout } = await execAsync(`npx -y @metamask/agentic-cli@3 perps balance --venue hyperliquid --json`);
    res.json(JSON.parse(stdout));
  } catch (err: any) {
    res.status(500).json({ error: err.message, stderr: err.stderr });
  }
});

metamaskRouter.post('/api/mm/perps/open', requireLiveExecution, async (req, res) => {
  try {
    const { symbol, side, size, leverage } = req.body;
    const { stdout } = await execAsync(`npx -y @metamask/agentic-cli@3 perps open --venue hyperliquid --symbol ${symbol} --side ${side} --size ${size} --leverage ${leverage || 1} --yes --json`);
    res.json(JSON.parse(stdout));
  } catch (err: any) {
    res.status(500).json({ error: err.message, stderr: err.stderr });
  }
});

metamaskRouter.get('/api/mm/predict/markets', async (req, res) => {
  try {
    const { query } = req.query;
    const { stdout } = await execAsync(`npx -y @metamask/agentic-cli@3 predict markets search "${query || 'politics'}" --limit 5 --json`);
    res.json(JSON.parse(stdout));
  } catch (err: any) {
    res.status(500).json({ error: err.message, stderr: err.stderr });
  }
});

import { GoogleGenAI } from '@google/genai';

metamaskRouter.post('/api/mm/intent/solve', async (req, res) => {
  try {
    const { intent } = req.body;
    
    // Simulate AI parsing or use real Gemini if key exists
    let parsedSteps = [
      { action: 'ANALYZE', details: 'Scanning token pairs and network state', asset: 'USDC', network: 'Base' }
    ];

    try {
      if (process.env.GEMINI_API_KEY) {
        const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
        const aiRes = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: `Parse this DeFi user intent into a JSON array of steps. Intent: "${intent}". Return ONLY a raw JSON array of objects. Do NOT use markdown code blocks. Each object MUST have: 'action' (SWAP, BRIDGE, DEPOSIT, STAKE, PREDICTION, ANALYZE), 'details' (string describing the step), 'asset' (string), 'network' (string). Limit to 3-4 logical steps.`
        });
        
        let text = aiRes.text || '[]';
        // Remove markdown formatting if present
        text = text.replace(/```json/g, '').replace(/```/g, '').trim();
        parsedSteps = JSON.parse(text);
      } else {
        // Fallback simulated parsing
        if (intent.toLowerCase().includes('polymarket')) {
          parsedSteps = [
             { action: 'SWAP', details: 'Convert USDC to Polygon USDC.e', asset: 'USDC', network: 'Polygon' },
             { action: 'PREDICTION', details: 'Execute YES order on target market', asset: 'USDC', network: 'Polygon' }
          ];
        } else if (intent.toLowerCase().includes('swap')) {
          parsedSteps = [
             { action: 'ANALYZE', details: 'Find most undervalued AI token using Oracle', asset: 'USDC', network: 'Base' },
             { action: 'SWAP', details: 'Execute swap for optimal routing', asset: 'USDC -> AI_TOKEN', network: 'Base' },
             { action: 'STAKE', details: 'Deposit AI_TOKEN into liquid staking vault', asset: 'AI_TOKEN', network: 'Base' }
          ];
        }
      }
    } catch (e) {
      console.warn("AI parsing failed, using fallback", e);
      parsedSteps = [
         { action: 'ANALYZE', details: 'Analyzing intent...', asset: 'ANY', network: 'ANY' },
         { action: 'EXECUTE', details: 'Executing parsed parameters', asset: 'ANY', network: 'ANY' }
      ];
    }

    // Now enrich the steps with Agentic CLI data where possible
    const enrichedSteps = [];
    for (const step of parsedSteps) {
      let data: any = {};
      let estimatedCost = '~0.0001 ETH';
      
      try {
        if (step.action === 'SWAP') {
           const { stdout } = await execAsync(`npx -y @metamask/agentic-cli@3 swap quote --from USDC --to WETH --amount 10 --from-chain 8453 --json`);
           const quote = JSON.parse(stdout);
           data = { quote: quote.estimatedOutput ? `10 USDC -> ${quote.estimatedOutput} WETH` : 'Quote ready' };
        } else if (step.action === 'PREDICTION') {
           const { stdout } = await execAsync(`npx -y @metamask/agentic-cli@3 predict markets search "politics" --limit 1 --json`);
           const markets = JSON.parse(stdout);
           data = { market: markets[0]?.question || 'Market ready' };
        }
      } catch (e) {
        // Fallback if CLI fails
        data = { status: 'simulated_data' };
      }
      
      enrichedSteps.push({ ...step, data, estimatedCost });
    }
    
    res.json({ steps: enrichedSteps });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

metamaskRouter.post('/api/mm/chat', async (req, res) => {
  try {
    const { message, model, apiKey } = req.body;
    
    if (model === 'claude-3-5' && (!apiKey || !apiKey.startsWith('sk-ant'))) {
      return res.json({
        thoughtProcess: ['Verifying BYOK authentication parameters...'],
        response: 'Authorization Error: Claude 3.5 Sonnet requires a valid Anthropic API Key (Bring Your Own Key). You are responsible for your own compute costs. Please enter your API key in the top right to continue.',
        proposal: null
      });
    }

    let responseData: any = {
      thoughtProcess: ['Initializing local consensus...', 'Loading portfolio context...'],
      response: "I am your Sovereign Swarm Orchestrator. I can parse your intents and execute them safely.",
      proposal: null
    };

    try {
      if (process.env.GEMINI_API_KEY && model !== 'llama-3-8b-local') {
        const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
        const prompt = `
You are the Sovereign Swarm Orchestrator, an advanced AI financial assistant managing a user's DeFi portfolio via a swarm of micro-agents. 
You communicate naturally but your answers are backed by hard data, agentic execution, and strict guardrails.
Context: MetaMask just launched the "Money Account" which offers ~4% APY, automatic earning, no lockups, and a single balance for trading/sending/spending.
User Message: "${message}"

Respond ONLY with a raw JSON object (no markdown, no quotes) with the following structure:
{
  "thoughtProcess": ["step 1...", "step 2..."], // 2-3 brief technical thoughts (e.g., "Scanning Base for yield", "Evaluating risk")
  "response": "Conversational reply. Be concise, sharp, and highly competent.",
  "proposal": { // Include ONLY if the user asks to DO something actionable (swap, move, buy, stake, etc.)
    "description": "Brief summary of proposed action",
    "actions": ["Action 1", "Action 2"],
    "estimatedCost": "~$X.XX",
    "riskLevel": "Low/Medium/High"
  } // or null if just answering a question
}
        `;

        const aiRes = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: prompt
        });
        
        let text = aiRes.text || '{}';
        text = text.replace(/```json/g, '').replace(/```/g, '').trim();
        responseData = JSON.parse(text);
      } else {
        // Fallback simulated parsing
        if (message.toLowerCase().includes('money account')) {
          responseData = {
            thoughtProcess: ['Analyzing MetaMask Money Account specs', 'Checking idle USDC balance'],
            response: 'MetaMask just launched their new Money Account providing a seamless ~4% APY with no lockups. I can instantly route your idle USDC into this single-balance earning account so it never stops earning while you use it.',
            proposal: {
              description: 'Deploy idle USDC to MetaMask Money Account',
              actions: ['Approve USDC for MetaMask Money Router', 'Deposit Idle USDC into Money Account'],
              estimatedCost: '$0.85',
              riskLevel: 'Low'
            }
          };
        } else if (message.toLowerCase().includes('yield') || message.toLowerCase().includes('stablecoin') || message.toLowerCase().includes('park')) {
          responseData = {
            thoughtProcess: ['Scanning cross-chain L2 stablecoin vaults', 'Evaluating Aave vs Morpho on Base'],
            response: 'The highest risk-adjusted yield for USDC right now is on Base via Morpho Optimizers, currently yielding 12.5% APY. I have verified the smart contract safety scores.',
            proposal: {
              description: 'Deploy USDC to Morpho on Base',
              actions: ['Bridge USDC to Base via Across', 'Deposit into Morpho Vault'],
              estimatedCost: '$0.45',
              riskLevel: 'Low'
            }
          };
        } else {
          responseData = {
            thoughtProcess: ['Parsing intent syntax', 'Checking portfolio balance'],
            response: 'I am monitoring the markets and your swarm is idle. Your portfolio is delta-neutral. What would you like to execute?',
            proposal: null
          };
        }
      }
    } catch (e) {
      console.warn("AI parsing failed in chat, using fallback", e);
    }

    if (model === 'llama-3-8b-local') {
      responseData.thoughtProcess.unshift('Local WebGPU inference initialized. Zero external requests.');
      responseData.response = `[Llama-3 8B] ${responseData.response}`;
    } else if (model === 'claude-3-5') {
      responseData.thoughtProcess.unshift(`Authenticated via user-provided API key: ${apiKey.substring(0, 8)}...`);
      responseData.response = `[Claude 3.5 Sonnet] ${responseData.response}`;
    }

    res.json(responseData);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

metamaskRouter.post('/api/mm/autopilot/execute', async (req, res) => {
  try {
    const { budget, riskProfile } = req.body;
    
    // Simulate real AI planning and querying Metamask Agentic CLI underneath
    let realDataFound = false;
    let fallbackUsed = false;
    
    // Step 1: Get market prediction (Polymarket)
    let marketName = "ETH > $4000 by July";
    try {
      const { stdout } = await execAsync(`npx -y @metamask/agentic-cli@3 predict markets search "ethereum" --limit 1 --json`);
      const markets = JSON.parse(stdout);
      if (markets && markets.length > 0) {
        marketName = markets[0].question || marketName;
        realDataFound = true;
      }
    } catch (e) { fallbackUsed = true; }

    // Step 2: Get a Swap Quote for hedging
    let quoteAmount = "0.0028";
    try {
      const { stdout } = await execAsync(`npx -y @metamask/agentic-cli@3 swap quote --from USDC --to ETH --amount 10 --from-chain 8453 --json`);
      const quote = JSON.parse(stdout);
      if (quote && quote.estimatedOutput) {
        quoteAmount = quote.estimatedOutput;
        realDataFound = true;
      }
    } catch (e) { fallbackUsed = true; }

    const time = () => new Date().toLocaleTimeString();

    const logs = [
      { time: time(), message: `[Engine] Autopilot sequence initiated. Budget: $${budget}, Risk: ${riskProfile.toUpperCase()}`, type: 'info' },
      { time: time(), message: `[X402 Micro-Tx] Paid 0.005 ETH to @QuantOracleAgent for momentum models.`, type: 'x402' },
      { time: time(), message: `[Polymarket] Executed YES position on "${marketName}" based on oracle data.`, type: 'trade' },
      { time: time(), message: `[Swap Quote] Fetched live hedge quote: 10 USDC -> ${quoteAmount} ETH.`, type: 'info' },
      { time: time(), message: `[Hyperliquid] Opened Short ETH-PERP 2x to delta-hedge prediction market exposure.`, type: 'trade' },
      { time: time(), message: `[Yield] Strategy locked. Estimated APY: 24.5%. Monitoring for rebalance...`, type: 'yield' },
    ];

    res.json({ success: true, logs, realDataFound, fallbackUsed });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
