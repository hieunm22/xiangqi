import { Box, Skeleton } from "@mui/material"

const LEFT_CELLS = 6
interface RewardGridSkeletonCellProps {
	isTreasure: boolean
	isDaily: boolean
}

// One placeholder cell: a rectangular block for the icon and a text line for
// the amount, matching the real cell's layout.
const SkeletonCell = ({ isTreasure, isDaily }: RewardGridSkeletonCellProps) => {
	const iconSize = isTreasure ? 64 : 40

	return (
		<Box className={`bonus-cell${isTreasure ? " bonus-cell--treasure" : ""}`}>
			{isDaily && <Skeleton variant="text" width="40%" />}
			<Skeleton variant="rectangular" width={iconSize} height={iconSize} />
			<Skeleton variant="text" width="60%" />
		</Box>
	)
}

export default function RewardGridSkeleton(props: Pick<RewardGridSkeletonCellProps, "isDaily">) {
	return (
		<Box className="bonus-grid">
			{Array.from({ length: LEFT_CELLS }).map((_, index) => (
				<SkeletonCell key={index} isTreasure={false} isDaily={props.isDaily} />
			))}
			<SkeletonCell isTreasure isDaily={props.isDaily} />
		</Box>
	)
}
