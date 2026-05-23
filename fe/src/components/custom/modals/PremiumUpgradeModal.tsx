import { useState, useMemo, useCallback, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Crown, Zap, Users, Clock, AlertCircle } from "lucide-react";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { toast } from "sonner";
import {
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
  Transaction,
} from "@solana/web3.js";
import { useConnection } from "@solana/wallet-adapter-react";
import { getToken } from "@/services/auth.service";
import { be_url, phantom_pub_key } from "@/env/e";

interface PremiumUpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUpgradeSuccess?: () => void;
}

const PREMIUM_PRICE_SOL = 0.1;

const PREMIUM_FEATURES = [
  { icon: Clock, label: "24h Room TTL" },
  { icon: Users, label: "200 Users / Room" },
  { icon: Zap, label: "Unlimited AI" },
  { icon: Crown, label: "Persistent Saves" },
];

export const PremiumUpgradeModal = ({
  isOpen,
  onClose,
  onUpgradeSuccess,
}: PremiumUpgradeModalProps) => {
  const wallet = useWallet();
  const { connection } = useConnection();
  const [isProcessing, setIsProcessing] = useState(false);

  const displayPrice = useMemo(() => {
    return `${PREMIUM_PRICE_SOL.toFixed(1)} SOL`;
  }, []);

  /**
   * Radix Dialog sets the `inert` HTML attribute on all sibling DOM nodes
   * to trap focus. The Solana wallet-adapter modal renders as a sibling
   * portal, so it gets inerted and becomes completely non-interactive.
   * This observer strips `inert` from wallet modal elements as soon as
   * Radix adds it, keeping the wallet list clickable.
   */
  useEffect(() => {
    if (!isOpen) return;

    const strip = () => {
      document
        .querySelectorAll(".wallet-adapter-modal[inert]")
        .forEach((el) => el.removeAttribute("inert"));
    };

    // Strip immediately in case modal is already present
    strip();

    const observer = new MutationObserver((mutations) => {
      for (const m of mutations) {
        if (
          m.type === "attributes" &&
          m.attributeName === "inert" &&
          (m.target as HTMLElement).classList?.contains("wallet-adapter-modal")
        ) {
          (m.target as HTMLElement).removeAttribute("inert");
        }
        // Also handle newly added wallet modal nodes
        if (m.type === "childList") {
          strip();
        }
      }
    });

    observer.observe(document.body, {
      attributes: true,
      attributeFilter: ["inert"],
      childList: true,
      subtree: true,
    });

    return () => observer.disconnect();
  }, [isOpen]);

  /** Prevent Radix from closing the dialog when clicking on the wallet modal */
  const isWalletModalEvent = useCallback((e: Event) => {
    const target = e.target as HTMLElement | null;
    if (target?.closest?.(".wallet-adapter-modal")) {
      e.preventDefault();
    }
  }, []);

  const handleUpgrade = async () => {
    if (!wallet.connected || !wallet.publicKey || !wallet.sendTransaction) {
      toast.error("Please connect your Solana wallet first.");
      return;
    }

    const token = getToken();
    if (!token) {
      toast.error("Please authenticate your wallet first.");
      return;
    }

    try {
      setIsProcessing(true);
      toast.loading("Initiating transaction...", { id: "upgrade" });

      // Devnet treasury address
      const treasuryPubkey = new PublicKey(phantom_pub_key);
      const transaction = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: wallet.publicKey,
          toPubkey: treasuryPubkey,
          lamports: PREMIUM_PRICE_SOL * LAMPORTS_PER_SOL,
        }),
      );

      toast.loading("Please approve the transaction in your wallet...", {
        id: "upgrade",
      });

      const { blockhash, lastValidBlockHeight } =
        await connection.getLatestBlockhash();

      transaction.recentBlockhash = blockhash;
      transaction.feePayer = wallet.publicKey;

      const signature = await wallet.sendTransaction(transaction, connection);

      toast.loading(
        `Transaction sent! Waiting for confirmation... (${signature.slice(0, 8)}...)`,
        { id: "upgrade" },
      );

      await connection.confirmTransaction({
        signature,
        blockhash,
        lastValidBlockHeight,
      });

      toast.loading("Transaction confirmed! Upgrading account...", {
        id: "upgrade",
      });

      // Verify on backend
      const API_BASE = `${be_url}/api`;
      const verifyRes = await fetch(`${API_BASE}/payment/verify-upgrade`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ signature }),
      });

      if (!verifyRes.ok) {
        const errData = await verifyRes.json();
        console.error("Backend verify error:", errData);

        throw new Error(errData.error || JSON.stringify(errData));
      }

      toast.success("Successfully upgraded to Premium! Enjoy!", {
        id: "upgrade",
      });
      onClose();
      onUpgradeSuccess?.();
      window.location.reload();
    } catch (error: unknown) {
      console.error("Upgrade error:", error);
      const message = error instanceof Error ? error.message : String(error);
      toast.error(`Upgrade failed: ${message || "Unknown error"}`, {
        id: "upgrade",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent
        className="sm:max-w-[420px] border-border bg-card text-card-foreground shadow-lg p-5 gap-3"
        onPointerDownOutside={isWalletModalEvent}
        onInteractOutside={isWalletModalEvent}
        onFocusOutside={isWalletModalEvent}
      >
        <DialogHeader className="gap-1">
          <div className="flex items-center gap-2">
            <Crown className="h-4 w-4 text-amber-500" />
            <DialogTitle className="text-lg font-bold">
              Upgrade to Premium
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs text-muted-foreground">
            Unlock extended rooms, larger teams & unlimited AI
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {/* Pricing + Features row */}
          <div className="flex items-center justify-between bg-primary/5 border border-primary/15 rounded-lg px-3 py-2.5">
            <div className="flex items-baseline gap-1.5">
              <span className="text-xl font-bold text-foreground">
                {displayPrice}
              </span>
              <span className="text-[10px] text-muted-foreground">
                ≈ ${(PREMIUM_PRICE_SOL * 150).toFixed(0)} · /month
              </span>
            </div>
            <Badge
              variant="outline"
              className="border-primary/30 bg-primary/10 text-[10px] px-1.5 py-0.5"
            >
              <Zap className="h-2.5 w-2.5 mr-0.5" />
              Premium
            </Badge>
          </div>

          {/* Compact feature chips */}
          <div className="grid grid-cols-2 gap-1.5">
            {PREMIUM_FEATURES.map((f) => {
              const Icon = f.icon;
              return (
                <div
                  key={f.label}
                  className="flex items-center gap-1.5 rounded-md bg-muted/40 px-2 py-1.5"
                >
                  <Icon className="h-3 w-3 text-primary shrink-0" />
                  <span className="text-xs font-medium text-foreground truncate">
                    {f.label}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Wallet Connection — compact */}
          <div className="rounded-lg border border-border/50 bg-muted/20 p-3">
            {!wallet.connected ? (
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs text-muted-foreground">
                  Connect wallet to pay
                </p>
                <div className="[&_.wallet-adapter-button]:!h-8 [&_.wallet-adapter-button]:!text-xs [&_.wallet-adapter-button]:!rounded-md [&_.wallet-adapter-button]:!px-3 [&_.wallet-adapter-button]:!font-medium">
                  <WalletMultiButton />
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="h-6 w-6 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
                    <Crown className="h-3 w-3 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-foreground truncate">
                      {wallet.wallet?.adapter.name}
                    </p>
                    <p className="text-[10px] text-muted-foreground font-mono truncate">
                      {wallet.publicKey?.toString().slice(0, 6)}…
                      {wallet.publicKey?.toString().slice(-4)}
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs px-2"
                  onClick={() => wallet.disconnect()}
                >
                  Change
                </Button>
              </div>
            )}
          </div>

          {/* Compact info note */}
          <div className="flex gap-2 items-start text-[10px] text-muted-foreground px-1">
            <AlertCircle className="h-3 w-3 text-amber-500 shrink-0 mt-px" />
            <span>
              Premium lasts 30 days, then reverts to Free. Tied to your wallet —
              works across devices.
            </span>
          </div>
        </div>

        <DialogFooter className="gap-2 mt-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            disabled={isProcessing}
            className="h-8 text-xs"
          >
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleUpgrade}
            disabled={!wallet.connected || isProcessing}
            className="h-8 text-xs bg-primary hover:bg-primary/90"
          >
            {isProcessing ? (
              <>
                <span className="inline-block animate-spin mr-1.5 text-sm">
                  ⏳
                </span>
                Processing…
              </>
            ) : (
              <>
                <Crown className="h-3.5 w-3.5 mr-1.5" />
                Pay {displayPrice}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
