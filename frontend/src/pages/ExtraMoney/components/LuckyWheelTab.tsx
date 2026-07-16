import { useEffect, useRef, useState } from "react"
import classnames from "classnames"
import { Box } from "@mui/material"
import { LUCKY_WHEEL_SLOT_HOURS } from "common/constant"
import { TTypography } from "components/TranslationTag"
import { getTimeToNextSlot, getToken, logger } from "common/helper"
import { useAPI } from "hooks/useAPI"
import { formatCountdown } from "../rewardHelpers"

const REWARDS = [50, 300, 75, 750, 2000, 200, 1000, 1500, 150, 250, 300, 100]

export default function LuckyWheelTab() {
	const { claimLuckySpins, spinLuckyWheel } = useAPI()
	const [isSpinning, setIsSpinning] = useState(false)
	const [rotation, setRotation] = useState(0)
	const [spinDuration, setSpinDuration] = useState(0)
	const [lastNewRotation, setLastNewRotation] = useState(0)
	const [spinsRemaining, setSpinsRemaining] = useState(0)
	const [timeLeft, setTimeLeft] = useState(() => getTimeToNextSlot(LUCKY_WHEEL_SLOT_HOURS))
	const wheelRef = useRef<HTMLDivElement>(null)

	// Randomize starting position when page opens
	useEffect(() => {
		const randomOffset = Math.floor(Math.random() * 12)
		setRotation(randomOffset * 30)
	}, [])

	// Tick the countdown to the next 6h wheel refresh every second.
	useEffect(() => {
		const timer = setInterval(() => setTimeLeft(getTimeToNextSlot(LUCKY_WHEEL_SLOT_HOURS)), 1000)
		return () => clearInterval(timer)
	}, [])

	// Claim the current slot bonus on entry and load the persisted remaining spins
	// Refreshing re-claims harmlessly: the server only grants once per slot
	useEffect(() => {
		const loadSpins = async () => {
			const token = getToken()
			if (!token) return

			try {
				const response = await claimLuckySpins(token)
				if (response?.success && response.data) {
					setSpinsRemaining(response.data.spins)
				}
			} catch (error) {
				logger.error("Failed to claim lucky spins:", error)
			}
		}

		loadSpins()
	}, [])

	// Handle spin completion via transitionend event
	useEffect(() => {
		const handleTransitionEnd = async () => {
			if (!isSpinning) return

			setIsSpinning(false)
			setSpinDuration(0)

			// Calculate which segment is at the pointer (top)
			const normalizedRotation = ((lastNewRotation % 360) + 360) % 360
			// Fix negative modulo: ensure segmentIndex is always positive (0-11)
			const segmentIndex = (Math.round((270 - normalizedRotation) / 30) % 12 + 12) % 12
			const spinReward = REWARDS[segmentIndex]

			// Consume one spin and credit its reward in a single atomic call.
			const token = getToken()
			if (token) {
				try {
					const response = await spinLuckyWheel(token, spinReward)
					if (response?.success && response.data) {
						setSpinsRemaining(response.data.spins)
					} else {
						setSpinsRemaining(prev => Math.max(0, prev - 1))
					}
				} catch (error) {
					logger.error("Failed to spin lucky wheel:", error)
					setSpinsRemaining(prev => Math.max(0, prev - 1))
				}
			} else {
				setSpinsRemaining(prev => Math.max(0, prev - 1))
			}
		}

		const element = wheelRef.current
		if (element && isSpinning) {
			element.addEventListener("transitionend", handleTransitionEnd)
			return () => element.removeEventListener("transitionend", handleTransitionEnd)
		}
	}, [isSpinning, lastNewRotation])

	const handleSpin = async () => {
		if (isSpinning || spinsRemaining === 0) return

		setIsSpinning(true)

		// Random spin duration between 3-5 seconds
		const duration = 3 + Math.random() * 2
		setSpinDuration(duration)

		// Minimum 2 rotations (720°) + random offset (0-360°)
		const minRotations = 360 * 2
		const randomOffset = Math.random() * 360
		const randomDegrees = minRotations + randomOffset
		const newRotation = rotation + randomDegrees

		setLastNewRotation(newRotation)
		setRotation(newRotation)
		// transitionend event will handle the completion
	}

	const wheelHubCls = classnames("wheel-hub data-content", {
		"attention-blink": spinsRemaining > 0 && !isSpinning,
		"spinable": spinsRemaining > 0 && !isSpinning,
		"not-spinable": spinsRemaining === 0 || isSpinning
	})

	const transitionStyle = `transform ${spinDuration}s cubic-bezier(0.25, 0.46, 0.45, 0.94)`

	return (
		<Box className="lucky-wheel-tab">
			<Box className="page-content">
				<Box className="lucky-wheel-container">
					<Box
						ref={wheelRef}
						className="lucky-wheel"
						sx={{
							transform: `rotate(${rotation}deg)`,
							transition: isSpinning ? transitionStyle : "none"
						}}
					>
						<svg
							width="300"
							height="300"
							viewBox="0 0 300 300"
							className="wheel-svg"
						>
							{/* Red and white segments */}
							<circle cx="150" cy="150" r="140" fill="none" stroke="#c9a961" strokeWidth="4" />

							{/* Generate 12 segments with rewards */}
							{Array.from({ length: 12 }).map((_, i) => {
								const angle = (i * 360) / 12
								const isRed = i % 2 === 0
								const color = isRed ? "#c92a2a" : "#fff9f0"

								const rad1 = ((angle - 15) * Math.PI) / 180
								const rad2 = ((angle + 15) * Math.PI) / 180
								const r = 140

								const x1 = 150 + r * Math.cos(rad1)
								const y1 = 150 + r * Math.sin(rad1)
								const x2 = 150 + r * Math.cos(rad2)
								const y2 = 150 + r * Math.sin(rad2)

								const path = `M 150 150 L ${x1} ${y1} A ${r} ${r} 0 0 1 ${x2} ${y2} Z`

								// Calculate text position (middle of segment at distance 105 from center)
								const textAngle = angle * (Math.PI / 180)
								const textDistance = 105
								const textX = 150 + textDistance * Math.cos(textAngle)
								const textY = 150 + textDistance * Math.sin(textAngle)

								const textColor = isRed ? "#fff9f0" : "#c92a2a"

								return (
									<g key={i}>
										<path
											d={path}
											fill={color}
											stroke="#c9a961"
											strokeWidth="2"
										/>
										<text
											x={textX}
											y={textY}
											textAnchor="middle"
											dominantBaseline="middle"
											fontSize="14"
											fontWeight="bold"
											fill={textColor}
											pointerEvents="none"
											transform={`rotate(${angle + 90} ${textX} ${textY})`}
										>
											{REWARDS[i]}
										</text>
									</g>
								)
							})}
						</svg>
					</Box>

					<Box
						className={wheelHubCls}
						onClick={handleSpin}
						data-content={spinsRemaining}
					/>

					{/* Pointer at top */}
					<Box className="wheel-pointer" />
				</Box>
			</Box>

			<Box className="bonus-next">
				<TTypography
					component="span"
					variant="h6"
					content="extra-money.bonus-coin.next-in"
				/>
				<span className="bonus-next-time">{formatCountdown(timeLeft)}</span>
			</Box>
		</Box>
	)
}
