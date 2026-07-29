// The "bank" side of MetaEdge: the user's everyday MetaMask, connected via the
// injected EIP-1193 provider. It is read-only here (address, balance, chain)
// except for funding, which is a transaction the user approves in their own
// MetaMask. MetaEdge never sees a key or a seed — the extension does all signing.

export const BASE_CHAIN_ID_HEX = '0x2105'; // 8453
export const BASE_ADD_PARAMS = {
  chainId: BASE_CHAIN_ID_HEX,
  chainName: 'Base',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: ['https://mainnet.base.org'],
  blockExplorerUrls: ['https://basescan.org']
};

// Pick the MetaMask provider even when several wallets inject themselves.
export function getEthProvider(): EthereumProvider | null {
  const eth = typeof window !== 'undefined' ? window.ethereum : undefined;
  if (!eth) return null;
  if (Array.isArray(eth.providers) && eth.providers.length) {
    return eth.providers.find((p) => p.isMetaMask) || eth.providers[0];
  }
  return eth;
}

export function hasMetaMask(): boolean {
  const p = getEthProvider();
  return !!p?.isMetaMask || !!p;
}

// hex wei -> human ETH string (4 dp), using BigInt so there's no float drift.
export function weiHexToEth(hex: string): string {
  try {
    const wei = BigInt(hex);
    const whole = wei / 10n ** 18n;
    const frac = (wei % 10n ** 18n).toString().padStart(18, '0').slice(0, 4);
    return `${whole}.${frac}`;
  } catch {
    return '0';
  }
}

// decimal ETH string -> hex wei, again avoiding float precision loss.
export function ethToWeiHex(eth: string): string {
  const [whole, frac = ''] = String(eth).trim().split('.');
  const fracPadded = (frac + '0'.repeat(18)).slice(0, 18);
  const wei = BigInt(whole || '0') * 10n ** 18n + BigInt(fracPadded || '0');
  return '0x' + wei.toString(16);
}

export interface BankConnection {
  address: string;
  chainId: string;
  balanceEth: string;
}

export async function connectBank(): Promise<BankConnection> {
  const p = getEthProvider();
  if (!p) throw new Error('MetaMask extension not detected. Install it from metamask.io, then try again.');
  const accounts: string[] = await p.request({ method: 'eth_requestAccounts' });
  const address = accounts?.[0];
  if (!address) throw new Error('No account returned by MetaMask.');
  const chainId: string = await p.request({ method: 'eth_chainId' });
  const balHex: string = await p.request({ method: 'eth_getBalance', params: [address, 'latest'] });
  return { address, chainId, balanceEth: weiHexToEth(balHex) };
}

export async function refreshBalance(address: string): Promise<string> {
  const p = getEthProvider();
  if (!p) return '0';
  const balHex: string = await p.request({ method: 'eth_getBalance', params: [address, 'latest'] });
  return weiHexToEth(balHex);
}

export async function ensureBaseChain(currentChainId: string): Promise<void> {
  if (currentChainId === BASE_CHAIN_ID_HEX) return;
  const p = getEthProvider();
  if (!p) throw new Error('MetaMask not available.');
  try {
    await p.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: BASE_CHAIN_ID_HEX }] });
  } catch (err: any) {
    // 4902 = chain not added to the wallet yet; offer to add Base.
    if (err?.code === 4902) {
      await p.request({ method: 'wallet_addEthereumChain', params: [BASE_ADD_PARAMS] });
    } else {
      throw err;
    }
  }
}

// Fund the agent wallet from the bank. This is a REAL transfer the user signs in
// their own MetaMask — callers must confirm intent before invoking.
export async function fundAgentWallet(
  from: string,
  agentAddress: string,
  amountEth: string,
  currentChainId: string
): Promise<string> {
  const p = getEthProvider();
  if (!p) throw new Error('MetaMask not available.');
  if (!/^0x[a-fA-F0-9]{40}$/.test(agentAddress)) throw new Error('Agent wallet address is not available yet.');
  const amt = Number(amountEth);
  if (!Number.isFinite(amt) || amt <= 0) throw new Error('Enter an amount greater than 0.');
  await ensureBaseChain(currentChainId);
  const txHash: string = await p.request({
    method: 'eth_sendTransaction',
    params: [{ from, to: agentAddress, value: ethToWeiHex(amountEth) }]
  });
  return txHash;
}
