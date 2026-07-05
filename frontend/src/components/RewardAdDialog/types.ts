export type AdStatus = "loading" | "playing" | "error"

export interface RewardAdDialogProps {
  open: boolean
  onClose: () => void
  // Called once when the ad plays through to completion. Skips, closes and load
  // failures never call it, so the caller only rewards a genuine full view.
  onReward: () => void
}