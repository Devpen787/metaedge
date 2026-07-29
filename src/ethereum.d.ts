// Minimal typing for the injected MetaMask (EIP-1193) provider. MetaEdge only
// ever asks the user's own extension for their address, balance, chain, and to
// sign transactions they approve themselves — it never sees keys.
interface EthereumProvider {
  isMetaMask?: boolean;
  providers?: EthereumProvider[];
  request: (args: { method: string; params?: unknown[] | object }) => Promise<any>;
  on?: (event: string, handler: (...args: any[]) => void) => void;
  removeListener?: (event: string, handler: (...args: any[]) => void) => void;
}

interface Window {
  ethereum?: EthereumProvider;
}
