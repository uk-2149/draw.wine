import { useEffect, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import {
  loginWithWallet,
  logoutWallet,
  getToken,
} from "../services/auth.service";
import { toast } from "sonner";

export const useWalletAuth = () => {
  const wallet = useWallet();
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(!!getToken());
  const [isAuthenticating, setIsAuthenticating] = useState<boolean>(false);

  useEffect(() => {
    const handleAuth = async () => {
      if (wallet.connected && wallet.publicKey) {
        // Only login if we don't have a token, or the token doesn't match the current wallet
        // For simplicity, if we have a token, assume it's good.
        // In a real app we'd decode it and check the wallet address.
        if (!isAuthenticated) {
          setIsAuthenticating(true);
          toast.loading("Authenticating wallet...", { id: "wallet-auth" });
          const token = await loginWithWallet(wallet);
          if (token) {
            setIsAuthenticated(true);
            toast.success("Wallet authenticated successfully!", {
              id: "wallet-auth",
            });
            // Reload the page to reset context and socket connection with new token
            window.location.reload();
          } else {
            toast.error("Failed to authenticate wallet", { id: "wallet-auth" });
            wallet.disconnect();
          }
          setIsAuthenticating(false);
        }
      } else if (!wallet.connected && isAuthenticated) {
        // Disconnected
        logoutWallet();
        setIsAuthenticated(false);
        window.location.reload();
      }
    };

    handleAuth();
  }, [wallet, isAuthenticated]);

  return { isAuthenticated, isAuthenticating };
};
