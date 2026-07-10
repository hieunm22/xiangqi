import { useEffect, useState } from "react"
import { Box, Divider, Skeleton, Tabs } from "@mui/material"
import { TTab, TTypography } from "components/TranslationTag"
import { getToken, tabIconClassBuilder } from "common/helper"
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
			} catch {
				setActiveTab((prev) => (prev === -1 ? 0 : prev))
			}
		}

		loadSelectedTab()
	}, [])

	const handleTabChange = async (value: number) => {
		setActiveTab(value)

		const token = getToken()
		if (!token) return
		await updateSelectedTab(token, value)
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
					<Box className="extra-money-tabs skeleton">
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
						<TTab
							icon={<i className={tabIconClassBuilder(0, activeTab, "dharmachakra")} />}
							iconPosition="start"
							label="extra-money.tab.lucky-wheel"
						/>
						<TTab
							icon={<i className={tabIconClassBuilder(1, activeTab, "coins")} />}
							iconPosition="start"
							label="extra-money.tab.bonus-coin"
						/>
						<TTab
							icon={<i className={tabIconClassBuilder(2, activeTab, "gift")} />}
							iconPosition="start"
							label="extra-money.tab.daily-bonus"
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
