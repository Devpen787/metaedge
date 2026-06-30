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
