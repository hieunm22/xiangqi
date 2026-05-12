import {
	Grid,
	Tooltip,
} from "@mui/material"
import { translate } from "locales/translate"
import { EmptyVoid } from "types/Common"

export const CreateRoomCard = ({ click }: { click: EmptyVoid }) => (
	<Grid
		className="dashboard__create-card-content"
		size={{ xs: 6, sm: 4, md: 4 }}
		onClick={click}
	>
		<Tooltip title={translate("dashboard.room.create")} placement="top">
			<i className="fas fa-plus fa-4x" />
		</Tooltip>
	</Grid>
)
