import {
	Card,
	CardContent,
	Grid,
} from "@mui/material"
import { TI } from "components/TranslationTag"
import { EmptyVoid } from "types/Common"

export const CreateGameCard = ({ click }: { click: EmptyVoid }) => (
	<Grid key="create-game" size={{ xs: 6, sm: 4, md: 4 }}>
		<Card
			variant="outlined"
			className="dashboard__game-card dashboard__game-card create"
			onClick={click}
		>
			<CardContent className="dashboard__create-card-content">
				<TI className="fas fa-plus fa-3x" title="dashboard.game.create" />
			</CardContent>
		</Card>
	</Grid>
)
