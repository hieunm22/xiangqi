import { Grid } from "@mui/material"
import { GRID_SIZE } from "../constants"
import { TTooltip } from "components/TranslationTag"
import { EmptyVoid } from "types/Common"

export const CreateRoomCard = ({ click }: { click: EmptyVoid }) => (
	<Grid
		className="dashboard__create-card-content"
		size={GRID_SIZE}
		onClick={click}
	>
		<TTooltip title="dashboard.room.create" placement="top">
			<i className="fas fa-plus fa-4x" />
		</TTooltip>
	</Grid>
)
