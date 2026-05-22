import { useTier } from "@/contexts/tier/useTier";
import { BadgeDollarSign, Crown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { PremiumUpgradeModal } from "@/components/custom/modals/PremiumUpgradeModal";

/**
 * In free mode: a "Get Premium" CTA button.
 * In premium mode: a subtle "Premium" badge.
 */
export const TierBadge = () => {
  const { isPremium } = useTier();
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);

  if (isPremium) {
    return (
      <div className="inline-flex h-9 items-center gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 text-xs font-medium text-amber-600 dark:text-amber-400 select-none">
        <Crown className="h-4 w-4" />
        Premium
      </div>
    );
  }

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setIsUpgradeModalOpen(true)}
        className="gap-2 border-primary/20 bg-primary/10 text-primary hover:bg-primary hover:text-accent transition-all duration-300"
      >
        <BadgeDollarSign className="h-4 w-4" />
        Get Premium
      </Button>

      <PremiumUpgradeModal
        isOpen={isUpgradeModalOpen}
        onClose={() => setIsUpgradeModalOpen(false)}
      />
    </>
  );
};
