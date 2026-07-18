import { useEffect, useRef, useState } from "react"
import {
	Box,
	CircularProgress,
	Dialog,
	DialogContent
} from "@mui/material"
import { AD_TAG_URL } from "common/constant"
import { TButton, TTypography } from "components/TranslationTag"
import { useIMASdk } from "hooks/useIMASdk"
import { AdStatus, RewardAdDialogProps } from "./types"
import "./RewardAdDialog.scss"
import { logger } from "common/helper"

export default function RewardAdDialog({ open, onClose, onReward }: RewardAdDialogProps) {
	const loadImaSdk = useIMASdk()
	const videoRef = useRef<HTMLVideoElement>(null)
	const adContainerRef = useRef<HTMLDivElement>(null)
	const [status, setStatus] = useState<AdStatus>("loading")
	// Bumped to re-request the ad when the user retries after a load error.
	const [attempt, setAttempt] = useState(0)

	useEffect(() => {
		if (!open) return

		let cancelled = false
		let done = false
		let adsManager: any = null
		let adsLoader: any = null
		let adDisplayContainer: any = null

		setStatus("loading")

		// grants the reward
		const finish = (rewarded: boolean) => {
			if (done) return
			done = true
			if (rewarded) onReward()
			onClose()
		}

		const handleError = (e?: any) => {
			// Surface the real reason (SDK blocked, VAST error code, autoplay, etc.)
			// so failures are diagnosable from the console instead of a silent overlay.
			logger.error("Reward ad failed:", e?.getError?.() ?? e)
			if (!cancelled) setStatus("error")
		}

		loadImaSdk()
			.then(() => {
				if (cancelled) return

				const ima = window.google.ima
				const video = videoRef.current
				const container = adContainerRef.current
				if (!video || !container) return

				const width = container.clientWidth || 640
				const height = container.clientHeight || 360

				adDisplayContainer = new ima.AdDisplayContainer(container, video)
				adDisplayContainer.initialize()

				adsLoader = new ima.AdsLoader(adDisplayContainer)
				adsLoader.addEventListener(ima.AdErrorEvent.Type.AD_ERROR, handleError, false)
				adsLoader.addEventListener(
					ima.AdsManagerLoadedEvent.Type.ADS_MANAGER_LOADED,
					(event: any) => {
						if (cancelled) return

						adsManager = event.getAdsManager(video)
						adsManager.addEventListener(ima.AdErrorEvent.Type.AD_ERROR, handleError)
						adsManager.addEventListener(ima.AdEvent.Type.COMPLETE, () => finish(true))
						adsManager.addEventListener(ima.AdEvent.Type.ALL_ADS_COMPLETED, () => finish(true))
						adsManager.addEventListener(ima.AdEvent.Type.SKIPPED, () => finish(false))

						try {
							adsManager.init(width, height, ima.ViewMode.NORMAL)
							adsManager.start()
							setStatus("playing")
						} catch {
							handleError()
						}
					},
					false
				)

				const adsRequest = new ima.AdsRequest()
				adsRequest.adTagUrl = AD_TAG_URL
				adsRequest.linearAdSlotWidth = width
				adsRequest.linearAdSlotHeight = height
				adsRequest.nonLinearAdSlotWidth = width
				adsRequest.nonLinearAdSlotHeight = Math.round(height / 3)
				adsLoader.requestAds(adsRequest)
			})
			.catch(handleError)

		return () => {
			cancelled = true
			try { adsManager?.destroy() } catch { /* ignore teardown errors */ }
			try { adsLoader?.destroy?.() } catch { /* ignore teardown errors */ }
			try { adDisplayContainer?.destroy?.() } catch { /* ignore teardown errors */ }
		}
	}, [open, attempt])

	const onDialogClose = (_: any, reason?: "backdropClick" | "escapeKeyDown") => {
		if (reason === "backdropClick") return
		onClose()
	}

	return (
		<Dialog
			open={open}
			onClose={onDialogClose}
			maxWidth="sm"
			fullWidth
			className="reward-ad-dialog"
			disableEnforceFocus
		>
			<DialogContent className="reward-ad-content">
				<Box className="reward-ad-player">
					<video ref={videoRef} className="reward-ad-video" playsInline />
					<div ref={adContainerRef} className="reward-ad-container" />

					{status === "loading" && (
						<Box className="reward-ad-overlay">
							<CircularProgress color="inherit" />
							<TTypography component="span" content="extra-money.reward-ad.loading" />
						</Box>
					)}

					{status === "error" && (
						<Box className="reward-ad-overlay">
							<TTypography component="span" content="extra-money.reward-ad.error" />
							<Box className="reward-ad-actions">
								<TButton
									variant="contained"
									size="small"
									value="extra-money.reward-ad.retry"
									onClick={() => setAttempt(val => val + 1)}
									startIcon={<i className="fas fa-rotate-right" />}
								/>
								<TButton
									variant="outlined"
									size="small"
									value="extra-money.reward-ad.close"
									onClick={onClose}
									startIcon={<i className="fas fa-xmark" />}
								/>
							</Box>
						</Box>
					)}
				</Box>
			</DialogContent>
		</Dialog>
	)
}
