import {
	Grid,
	Tooltip,
} from "@mui/material"
import { GRID_SIZE } from "../constants"
import { translate } from "locales/translate"
import { EmptyVoid } from "types/Common"

export const CreateRoomCard = ({ click }: { click: EmptyVoid }) => (
	<Grid
		className="dashboard__create-card-content"
		size={GRID_SIZE}
		onClick={click}
	>
		<Tooltip title={translate("dashboard.room.create")} placement="top">
			<i className="fas fa-plus fa-4x" />
		</Tooltip>
	</Grid>
)
