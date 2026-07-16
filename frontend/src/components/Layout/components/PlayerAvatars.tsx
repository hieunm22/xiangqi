import { Avatar, Stack, Tooltip } from "@mui/material"
import { requireImage } from "common/helper"
import { PlayerAvatarsProps } from "../types"

export const PlayerAvatars = ({ game }: PlayerAvatarsProps) => {
	const winnerUserId = game.game.winner_id

	return (
		<Stack direction="row" spacing={1} sx={{ alignItems: "center", justifyContent: "flex-start" }}>
			{game.users.slice(0, 2).map(user => {
				const isWinner = winnerUserId === user.id

				return (
					<Tooltip key={user.id} title={user.display_name} arrow placement="top">
						<Avatar
							src={requireImage(user.avatar_url)}
							alt={user.display_name}
							sx={{
								width: 40,
								height: 40,
								boxShadow: isWinner ? "0 0 0 2px #d0461c, 0 4px 10px rgba(0,0,0,0.25)" : "none",
								opacity: isWinner ? 1 : 0.3
							}}
						>
							{user.display_name.trim().charAt(0).toUpperCase() || "U"}
						</Avatar>
					</Tooltip>
				)
			})}
		</Stack>
	)
}