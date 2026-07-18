import { useNavigate } from "react-router-dom"
import {
	Box,
	Container,
	Stack,
} from "@mui/material"
import { HOME_PATH } from "common/constant"
import { TButton, TSpan } from "components/TranslationTag"
import useAutoTitle from "hooks/useAutoTitle"
import "./NotFound.scss"
import { translate } from "locales/translate"

export default function NotFoundPage() {
	useAutoTitle("notfound.title")
	const navigate = useNavigate()

	return (
		<Container maxWidth="sm" className="not-found-container">
			<Stack spacing={4} className="not-found-content">
				<Box className="not-found-decoration">
					<TSpan className="not-found-code" content="404" />
					<div className="not-found-title data-content" data-content={translate("notfound.title")}>
						<i className="fas fa-face-sad-tear mr-16" />
					</div>
				</Box>

				<TSpan className="not-found-description" content="notfound.description" />

				<Stack direction="row" spacing={2} className="not-found-actions">
					<TButton
						variant="contained"
						size="large"
						onClick={() => navigate(HOME_PATH)}
						value="notfound.home"
					/>
					<TButton
						variant="outlined"
						size="large"
						onClick={() => navigate(-1)}
						value="notfound.back"
					/>
				</Stack>

				<Box className="not-found-spinner-wrap">
					<i className="fas fa-circle-notch fa-spin not-found-spinner" />
				</Box>
			</Stack>
		</Container>
	)
}
