import { Skeleton } from "@mui/material"
import { GameType } from "common/variants"

/**
 * Loading placeholder shown until the game history
 */
export default function BoardSkeleton({ variant }: { variant: GameType }) {
	if (variant === "chess") {
		return (
			<div className="chess-board board-skeleton">
				<div className="chess-board-frame">
					<Skeleton variant="rounded" animation="wave" className="board-skeleton-fill" />
				</div>
			</div>
		)
	}

	return (
		<div className="xiangqi-board board-skeleton">
			<div className="board-frame">
				<Skeleton variant="rounded" animation="wave" className="board-skeleton-fill" />
			</div>
		</div>
	)
}
