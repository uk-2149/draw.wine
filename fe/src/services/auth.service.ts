import bs58 from "bs58";
import type { WalletContextState } from "@solana/wallet-adapter-react";
// Assuming similar constant exists or we use relative paths
// Wait, we can just use relative fetch API calls since it's the same domain or proxied.
const API_BASE = import.meta.env.VITE_API_URL || "/api";

export const loginWithWallet = async (
  wallet: WalletContextState,
): Promise<string | null> => {
  if (!wallet.publicKey || !wallet.signMessage) {
    console.error("Wallet not ready for signing");
    return null;
  }

  try {
    // 1. Get Nonce
    const nonceRes = await fetch(`${API_BASE}/auth/nonce`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ publicKey: wallet.publicKey.toBase58() }),
    });

    if (!nonceRes.ok) throw new Error("Failed to fetch nonce");

    const { nonce } = await nonceRes.json();

    // 2. Create message
    const message = `Login to Draw.wine\nNonce: ${nonce}`;
    const encodedMessage = new TextEncoder().encode(message);

    // 3. Sign message
    const signature = await wallet.signMessage(encodedMessage);

    // 4. Verify signature
    const verifyRes = await fetch(`${API_BASE}/auth/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        publicKey: wallet.publicKey.toBase58(),
        signature: bs58.encode(signature),
        message,
      }),
    });

    if (!verifyRes.ok) throw new Error("Verification failed");

    const { token } = await verifyRes.json();

    // 5. Save JWT
    localStorage.setItem("draw_wine_token", token);
    return token;
  } catch (error) {
    console.error("Wallet login error:", error);
    return null;
  }
};

export const logoutWallet = () => {
  localStorage.removeItem("draw_wine_token");
};

export const getToken = () => localStorage.getItem("draw_wine_token");
