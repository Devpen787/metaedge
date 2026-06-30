import { Router } from 'express';
import { execFile } from 'child_process';
import util from 'util';
import { generateId, readDatabase, writeDatabase } from './storage.js';

export const metamaskRouter = Router();
const execFileAsync = util.promisify(execFile);

const MM_PACKAGE = '@metamask/agentic-cli@3';
const LIVE_EXECUTION_ENABLED = process.env.LIVE_EXECUTION_ENABLED === 'true';
const ALLOW_BROWSER_LOGIN = process.env.METAEDGE_ALLOW_MM_BROWSER_LOGIN === 'true';
const SAFE_SYMBOL_RE = /^[A-Z0-9._:-]{1,32}$/;
const SAFE_CHAIN_RE = /^[0-9]{1,10}$/;
const SAFE_ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;
const SAFE_QUOTE_ID_RE = /^[A-Za-z0-9._:-]{8,256}$/;
const SAFE_TOKEN_ID_RE = /^[A-Za-z0-9._:-]{8,256}$/;

type MmCheckStatus = 'ready' | 'blocked' | 'unknown';

interface MmCheck {
  id: string;
  label: string;
  status: MmCheckStatus;
  summary: string;
  command?: string;
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function parseJsonOrText(stdout: string) {
  const trimmed = stdout.trim();
  if (!trimmed) return null;
  try {
    return JSON.parse(trimmed);
  } catch {
    return { text: trimmed };
  }
}

function productSafeError(error: unknown): string {
  const raw = asString((error as any)?.message);
  if (raw.includes('timed out')) return 'The MetaMask check timed out.';
  if (raw.includes('not found') || raw.includes('ENOENT')) return 'MetaMask Agent Wallet CLI is not available locally.';
  return 'Needs MetaMask approval or local Agent Wallet setup.';
}

function cliCommand(args: string[]) {
  return `mm ${args.filter((arg) => arg !== '--json').join(' ')}`;
}

async function runMm(args: string[], timeout = 12_000) {
  try {
    const { stdout } = await execFileAsync('npx', ['-y', MM_PACKAGE, ...args], {
      timeout,
      maxBuffer: 1024 * 1024,
      shell: false
    });
    return {
      ok: true,
      command: cliCommand(args),
      data: parseJsonOrText(stdout),
      summary: 'Ready'
    };
  } catch (error) {
    return {
      ok: false,
      command: cliCommand(args),
      data: null,
      summary: productSafeError(error)
    };
  }
}

function isCommandOk(result: Awaited<ReturnType<typeof runMm>>) {
  const payload = result.data as any;
  if (!result.ok) return false;
  if (payload && typeof payload.ok === 'boolean') return payload.ok;
  return true;
}

function extractText(result: Awaited<ReturnType<typeof runMm>>) {
  const payload = result.data as any;
  if (!payload) return '';
  if (typeof payload === 'string') return payload;
  if (typeof payload.text === 'string') return payload.text;
  return JSON.stringify(payload);
}

function makeCheck(
  id: string,
  label: string,
  result: Awaited<ReturnType<typeof runMm>>,
  readySummary: string,
  blockedSummary = result.summary
): MmCheck {
  const ready = isCommandOk(result);
  return {
    id,
    label,
    status: ready ? 'ready' : 'blocked',
    summary: ready ? readySummary : blockedSummary,
    command: result.command
  };
}

function validatePositiveAmount(value: unknown, label: string) {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error(`${label} must be a positive number.`);
  }
  return String(value);
}

function validateSymbol(value: unknown, label: string) {
  const symbol = asString(value).trim().toUpperCase();
  if (!SAFE_SYMBOL_RE.test(symbol)) {
    throw new Error(`${label} is not supported.`);
  }
  return symbol;
}

function validateChain(value: unknown, fallback: string) {
  const chain = asString(value || fallback).trim();
  if (!SAFE_CHAIN_RE.test(chain)) {
    throw new Error('Chain is not supported.');
  }
  return chain;
}

function validateAddress(value: unknown) {
  const address = asString(value).trim();
  if (!SAFE_ADDRESS_RE.test(address)) {
    throw new Error('Destination address is not valid.');
  }
  return address;
}

function validateQuoteId(value: unknown) {
  const quoteId = asString(value).trim();
  if (!SAFE_QUOTE_ID_RE.test(quoteId)) {
    throw new Error('Quote preview is missing or expired.');
  }
  return quoteId;
}

function validateTokenId(value: unknown) {
  const tokenId = asString(value).trim();
  if (!SAFE_TOKEN_ID_RE.test(tokenId)) {
    throw new Error('Prediction market token is not supported.');
  }
  return tokenId;
}

function recordMetaMaskEvent(req: any, action: string, details: string) {
  const userId = req.userId;
  if (!userId) return;
  const db = readDatabase();
  const user = db.users[userId];
  if (!user) return;

  db.auditEvents.push({
    id: 'aud_' + generateId(),
    userId,
    username: user.username,
    action,
    details,
    timestamp: Date.now()
  });

  db.graphEvents.push({
    id: 'gph_' + generateId(),
    type: action === 'METAMASK_BLOCKED_ACTION' ? 'blocked_action' : 'metamask_check',
    userId,
    targetId: userId,
    targetType: 'User',
    metadata: { label: details },
    timestamp: Date.now()
  });

  writeDatabase(db);
}

function requireLiveExecution(req: any, res: any, next: any) {
  if (!LIVE_EXECUTION_ENABLED) {
    recordMetaMaskEvent(req, 'METAMASK_BLOCKED_ACTION', 'Live locked: real execution remains disabled.');
    return res.status(403).json({
      error: 'Live locked',
      message: 'Real execution is locked. Review readiness, policy, preview, and MetaMask approval before any live action.',
      liveModeGlobalLock: true
    });
  }
  next();
}

metamaskRouter.get('/api/mm/readiness', async (req: any, res) => {
  const [doctor, auth, init, address, balance, tradingMode, policy] = await Promise.all([
    runMm(['doctor', '--json']),
    runMm(['auth', 'status', '--json']),
    runMm(['init', 'show', '--json']),
    runMm(['wallet', 'address']),
    runMm(['wallet', 'balance', '--chain', '8453', '--json']),
    runMm(['wallet', 'trading-mode', 'get', '--json']),
    runMm(['wallet', 'policy', 'get'], 10_000)
  ]);

  const policyText = extractText(policy).toLowerCase();
  const tradingModeText = extractText(tradingMode).toLowerCase();
  const policyConfigured = isCommandOk(policy) && policyText.length > 0;
  const isGuardMode = tradingModeText.includes('guard');
  const isBeastMode = tradingModeText.includes('beast');

  const checks: MmCheck[] = [
    makeCheck('cli_v3', 'Agent Wallet v3', doctor, 'Agent Wallet CLI v3 responded to health check.'),
    makeCheck('browser_login', 'Browser login', auth, 'MetaMask browser login is active.', 'Run MetaMask browser login before live review.'),
    makeCheck('wallet_init', 'Wallet setup', init, 'Wallet mode and trading mode are initialized.'),
    makeCheck('wallet_address', 'Wallet address', address, 'Active wallet address is available.'),
    makeCheck('base_balance', 'Base balance', balance, 'Base balance check completed.'),
    {
      id: 'trading_mode',
      label: 'Trading mode',
      status: isGuardMode || isBeastMode ? 'ready' : 'blocked',
      summary: isGuardMode
        ? 'Guard Mode is active.'
        : isBeastMode
          ? 'Beast Mode is active. Use smaller limits and stricter review.'
          : 'Select Guard Mode before live review.',
      command: tradingMode.command
    },
    {
      id: 'policy',
      label: 'Policy limits',
      status: policyConfigured ? 'ready' : 'blocked',
      summary: policyConfigured
        ? 'Policy file is configured. Raw policy is hidden from the app.'
        : 'Set policy limits before live review.',
      command: policy.command
    },
    {
      id: 'outflow_24h',
      label: '24h outflow limit',
      status: policyConfigured && policyText.includes('outflow') ? 'ready' : 'blocked',
      summary: policyConfigured && policyText.includes('outflow')
        ? '24h outflow policy is present.'
        : 'Add a 24h outflow limit before live review.',
      command: policy.command
    },
    {
      id: 'two_factor',
      label: '2FA approval',
      status: policyConfigured && /2fa|two[-_\s]?factor/.test(policyText) ? 'ready' : 'blocked',
      summary: policyConfigured && /2fa|two[-_\s]?factor/.test(policyText)
        ? '2FA policy is present.'
        : 'Needs MetaMask approval when policy limits are exceeded.',
      command: policy.command
    },
    {
      id: 'live_lock',
      label: 'Live locked',
      status: LIVE_EXECUTION_ENABLED ? 'ready' : 'blocked',
      summary: LIVE_EXECUTION_ENABLED
        ? 'Live execution flag is enabled for this environment.'
        : 'Live execution is globally locked in this environment.'
    }
  ];

  recordMetaMaskEvent(req, 'METAMASK_READINESS_CHECK', 'Checked MetaMask Agent Wallet readiness.');

  res.json({
    liveModeGlobalLock: !LIVE_EXECUTION_ENABLED,
    loginCommand: 'mm login browser',
    package: MM_PACKAGE,
    recommendedMode: 'Guard Mode',
    checks,
    wallet: {
      address: isCommandOk(address) ? extractText(address).trim() : null,
      baseBalanceReady: isCommandOk(balance)
    },
    capabilities: {
      swaps: {
        quoteBeforeExecute: true,
        refuelSupported: true,
        executeLocked: !LIVE_EXECUTION_ENABLED
      },
      perps: {
        venuesCommand: 'mm perps list-venues',
        depositRequired: true,
        quoteBeforeOpen: true,
        openLocked: !LIVE_EXECUTION_ENABLED
      },
      predictionMarkets: {
        setupRequired: true,
        quoteBeforePlace: true,
        placeLocked: !LIVE_EXECUTION_ENABLED
      }
    }
  });
});

metamaskRouter.get('/api/mm/status', async (_req, res) => {
  const auth = await runMm(['auth', 'status', '--json']);
  res.status(isCommandOk(auth) ? 200 : 503).json({
    isAuthenticated: isCommandOk(auth),
    loginCommand: 'mm login browser',
    message: isCommandOk(auth) ? 'MetaMask browser login is active.' : 'Needs MetaMask approval.',
    command: auth.command
  });
});

metamaskRouter.post('/api/mm/login-browser', async (req: any, res) => {
  recordMetaMaskEvent(req, 'METAMASK_READINESS_CHECK', 'Requested MetaMask browser login guidance.');
  if (!ALLOW_BROWSER_LOGIN) {
    return res.status(409).json({
      success: false,
      command: 'mm login browser',
      message: 'Run MetaMask browser login locally. This app never accepts or stores wallet secrets.'
    });
  }

  const result = await runMm(['login', 'browser'], 120_000);
  res.status(isCommandOk(result) ? 200 : 503).json({
    success: isCommandOk(result),
    command: result.command,
    message: isCommandOk(result) ? 'MetaMask browser login completed.' : result.summary
  });
});

metamaskRouter.post('/api/mm/login', (_req, res) => {
  res.status(410).json({
    error: 'Token login removed',
    message: 'Use MetaMask browser login. MetaEdge never accepts wallet secrets.'
  });
});

metamaskRouter.get('/api/mm/address', async (_req, res) => {
  const result = await runMm(['wallet', 'address']);
  res.status(isCommandOk(result) ? 200 : 503).json({
    address: isCommandOk(result) ? extractText(result).trim() : null,
    message: isCommandOk(result) ? 'Wallet address available.' : result.summary
  });
});

metamaskRouter.get('/api/mm/balance', async (req, res) => {
  try {
    const chainId = validateChain(req.query.chain, '8453');
    const result = await runMm(['wallet', 'balance', '--chain', chainId, '--json']);
    res.status(isCommandOk(result) ? 200 : 503).json({
      balance: result.data,
      message: isCommandOk(result) ? 'Balance check completed.' : result.summary
    });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

metamaskRouter.post('/api/mm/transfer', requireLiveExecution, async (req, res) => {
  try {
    const to = validateAddress(req.body.to);
    const amount = validatePositiveAmount(req.body.amount, 'Amount');
    const token = req.body.token ? validateSymbol(req.body.token, 'Token') : 'native';
    const chainId = validateChain(req.body.chainId, '8453');
    const result = await runMm(['transfer', '--to', to, '--amount', amount, '--token', token, '--chain-id', chainId, '--wait', '--json'], 60_000);
    res.status(isCommandOk(result) ? 200 : 502).json(result.data);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

metamaskRouter.post('/api/mm/swap/quote', async (req, res) => {
  try {
    const from = validateSymbol(req.body.from, 'Source token');
    const to = validateSymbol(req.body.to, 'Destination token');
    const amount = validatePositiveAmount(req.body.amount, 'Amount');
    const fromChain = validateChain(req.body.fromChain, '8453');
    const args = ['swap', 'quote', '--from', from, '--to', to, '--amount', amount, '--from-chain', fromChain, '--json'];
    if (req.body.toChain) args.push('--to-chain', validateChain(req.body.toChain, fromChain));
    if (req.body.slippage) args.push('--slippage', validatePositiveAmount(req.body.slippage, 'Slippage'));
    if (req.body.refuel === true) args.push('--refuel');
    const result = await runMm(args, 30_000);
    res.status(isCommandOk(result) ? 200 : 503).json({
      quote: result.data,
      executeLocked: !LIVE_EXECUTION_ENABLED,
      message: isCommandOk(result) ? 'Swap preview ready.' : result.summary
    });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

metamaskRouter.post('/api/mm/swap/execute', requireLiveExecution, async (req, res) => {
  try {
    const quoteId = validateQuoteId(req.body.quoteId);
    const result = await runMm(['swap', 'execute', '--quote-id', quoteId, '--json'], 120_000);
    res.status(isCommandOk(result) ? 200 : 502).json(result.data);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

metamaskRouter.get('/api/mm/perps/balance', async (_req, res) => {
  const result = await runMm(['perps', 'balance', '--venue', 'hyperliquid', '--json']);
  res.status(isCommandOk(result) ? 200 : 503).json({
    balance: result.data,
    message: isCommandOk(result) ? 'Perps balance check completed.' : result.summary
  });
});

metamaskRouter.post('/api/mm/perps/quote', async (req, res) => {
  try {
    const symbol = validateSymbol(req.body.symbol, 'Symbol');
    const side = asString(req.body.side).trim().toLowerCase();
    if (side !== 'long' && side !== 'short') throw new Error('Side must be long or short.');
    const size = validatePositiveAmount(req.body.size, 'Size');
    const leverage = validatePositiveAmount(req.body.leverage || 1, 'Leverage');
    const type = req.body.type === 'limit' ? 'limit' : 'market';
    const args = ['perps', 'quote', '--venue', 'hyperliquid', '--symbol', symbol, '--side', side, '--size', size, '--leverage', leverage, '--type', type, '--json'];
    if (type === 'limit') args.push('--limit-px', validatePositiveAmount(req.body.limitPx, 'Limit price'));
    const result = await runMm(args, 30_000);
    res.status(isCommandOk(result) ? 200 : 503).json({
      quote: result.data,
      openLocked: !LIVE_EXECUTION_ENABLED,
      message: isCommandOk(result) ? 'Perps preview ready.' : result.summary
    });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

metamaskRouter.post('/api/mm/perps/open', requireLiveExecution, async (req, res) => {
  try {
    const symbol = validateSymbol(req.body.symbol, 'Symbol');
    const side = asString(req.body.side).trim().toLowerCase();
    if (side !== 'long' && side !== 'short') throw new Error('Side must be long or short.');
    const size = validatePositiveAmount(req.body.size, 'Size');
    const leverage = validatePositiveAmount(req.body.leverage || 1, 'Leverage');
    const result = await runMm(['perps', 'open', '--venue', 'hyperliquid', '--symbol', symbol, '--side', side, '--size', size, '--leverage', leverage, '--json'], 120_000);
    res.status(isCommandOk(result) ? 200 : 502).json(result.data);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

metamaskRouter.get('/api/mm/predict/markets', async (req, res) => {
  const query = asString(req.query.query || 'crypto').replace(/[^\w\s-]/g, '').trim().slice(0, 80) || 'crypto';
  const result = await runMm(['predict', 'markets', 'search', query, '--limit', '5', '--json'], 20_000);
  res.status(isCommandOk(result) ? 200 : 503).json({
    markets: result.data,
    message: isCommandOk(result) ? 'Prediction markets loaded.' : result.summary
  });
});

metamaskRouter.post('/api/mm/predict/quote', async (req, res) => {
  try {
    const tokenId = validateTokenId(req.body.tokenId);
    const side = asString(req.body.side).trim().toLowerCase();
    if (side !== 'buy' && side !== 'sell') throw new Error('Side must be buy or sell.');
    const size = validatePositiveAmount(req.body.size, 'Size');
    const args = ['predict', 'quote', '--token-id', tokenId, '--side', side, '--size', size, '--json'];
    if (req.body.limitPrice) args.push('--limit-price', validatePositiveAmount(req.body.limitPrice, 'Limit price'));
    const result = await runMm(args, 30_000);
    res.status(isCommandOk(result) ? 200 : 503).json({
      quote: result.data,
      placeLocked: !LIVE_EXECUTION_ENABLED,
      message: isCommandOk(result) ? 'Prediction market preview ready.' : result.summary
    });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});
