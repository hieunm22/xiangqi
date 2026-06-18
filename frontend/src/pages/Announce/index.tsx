import { useState } from "react"
import {
	Box,
	Divider,
	Stack,
} from "@mui/material"
import { TI, TTextField, TTypography } from "components/TranslationTag"
import useAutoTitle from "hooks/useAutoTitle"
import "./Announce.scss"

export default function AnnouncePage() {
	useAutoTitle("announce.title")
	const [messageContent, setMessageContent] = useState("")

	return (
		<Box className="announce-page">
			<TTypography
				variant="h6"
				className="announce-title"
				content="announce.title"
				/>
			<Divider sx={{ borderColor: "primary.main" }} />

			<Box className="announce-messages-box">
				<Stack spacing={1} className="announce-messages-empty">
					<TTypography variant="body2" color="text.secondary" content="announce.empty" />
				</Stack>
			</Box>

			<Box className="announce-input-row">
				<TTextField
					value={messageContent}
					onChange={e => setMessageContent(e.target.value)}
					placeholder="announce.placeholder"
					size="small"
					fullWidth
					multiline
					maxRows={3}
					slotProps={{
						input: {
							endAdornment: (
								<TI className="fas fa-paper-plane announce-send-icon" />
							)
						}
					}}
				/>
			</Box>
		</Box>
	)
}
