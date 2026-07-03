import { useEffect, useState } from "react"
import { Box, Divider, Skeleton, Tab, Tabs } from "@mui/material"
import { TTypography } from "components/TranslationTag"
import { getToken } from "common/helper"
import { translate as t } from "locales/translate"
import useAutoTitle from "hooks/useAutoTitle"
import { useAPI } from "hooks/useAPI"
import BonusCoinTab from "./components/BonusCoinTab"
import DailyBonusTab from "./components/DailyBonusTab"
import LuckyWheelTab from "./components/LuckyWheelTab"
import RewardGridSkeleton from "./components/RewardGridSkeleton"
import "./ExtraMoney.scss"

export default function ExtraMoneyPage() {
	useAutoTitle("extra-money.title")
	const { getSelectedTab, updateSelectedTab } = useAPI()
	const [activeTab, setActiveTab] = useState<number>(-1)

	// Restore the last-selected tab on entry.
	useEffect(() => {
		const loadSelectedTab = async () => {
			const token = getToken()
			if (!token) {
				setActiveTab(0)
				return
			}

			try {
				const response = await getSelectedTab(token)
				const tab = response?.success && response.data ? response.data.selected_tab : 0
				// Ignore the restored value if the user already switched while loading.
				setActiveTab((prev) => (prev === -1 ? tab : prev))
			} catch (error) {
				console.error("Failed to load selected tab:", error)
				setActiveTab((prev) => (prev === -1 ? 0 : prev))
			}
		}

		loadSelectedTab()
	}, [])

	const handleTabChange = (value: number) => {
		setActiveTab(value)

		const token = getToken()
		if (!token) return
		updateSelectedTab(token, value).catch((error) => {
			console.error("Failed to persist selected tab:", error)
		})
	}

	return (
		<Box className="extra-money-page">
			<TTypography
				variant="h6"
				className="page-title"
				content="extra-money.title"
			/>
			<Divider sx={{ borderColor: "primary.main" }} />

			{activeTab === -1
				? (
					<Box className="extra-money-tabs extra-money-tabs--skeleton" sx={{ display: "flex", gap: 1 }}>
						{Array.from({ length: 3 }).map((_, index) => (
							<Skeleton key={index} variant="rounded" height={48} sx={{ flex: 1 }} />
						))}
					</Box>
				)
				: (
					<Tabs
						className="extra-money-tabs"
						value={activeTab}
						onChange={(_, value) => handleTabChange(value)}
						variant="fullWidth"
						textColor="primary"
						indicatorColor="primary"
					>
						<Tab
							icon={<i className="fas fa-dharmachakra" />}
							iconPosition="start"
							label={t("extra-money.tab.lucky-wheel")}
						/>
						<Tab
							icon={<i className="fas fa-coins" />}
							iconPosition="start"
							label={t("extra-money.tab.bonus-coin")}
						/>
						<Tab
							icon={<i className="fas fa-gift" />}
							iconPosition="start"
							label={t("extra-money.tab.daily-bonus")}
						/>
					</Tabs>
				)}

			<Box className="tab-content">
				{activeTab === -1 && <RewardGridSkeleton isDaily={false} />}
				{activeTab === 0 && <LuckyWheelTab />}
				{activeTab === 1 && <BonusCoinTab />}
				{activeTab === 2 && <DailyBonusTab />}
			</Box>
		</Box>
	)
}
