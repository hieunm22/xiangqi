import { useNavigate } from "react-router-dom"
import { Box, Button, Container, Stack, Typography } from "@mui/material"
import useAutoTitle from "hooks/useAutoTitle"
import { translate } from "locales/translate"
import "./NotFound.scss"

export default function NotFoundPage() {
	useAutoTitle("Page Not Found")
	const navigate = useNavigate()

	return (
		<Container maxWidth="sm" sx={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
			<Stack spacing={4} alignItems="center" textAlign="center">
				<Box className="not-found-decoration">
					<Typography variant="h1" sx={{ fontSize: 120, fontWeight: 900, lineHeight: 1, color: "primary.main" }}>
						404
					</Typography>
					<Typography variant="h3" sx={{ fontSize: 48, fontWeight: 700, mt: -2 }}>
						<i className="fas fa-face-sad-tear" style={{ marginRight: 16 }} />
						{translate("notfound.title")}
					</Typography>
				</Box>

				<Typography variant="body1" sx={{ fontSize: 16, color: "text.secondary", maxWidth: 400 }}>
					{translate("notfound.description")}
				</Typography>

				<Stack direction="row" spacing={2} justifyContent="center">
					<Button variant="contained" size="large" onClick={() => navigate("/dashboard")}>
						{translate("notfound.home")}
					</Button>
					<Button variant="outlined" size="large" onClick={() => navigate(-1)}>
						{translate("notfound.back")}
					</Button>
				</Stack>

				<Box sx={{ mt: 4 }}>
					<i className="fas fa-circle-notch" style={{ fontSize: 64, opacity: 0.1 }} />
				</Box>
			</Stack>
		</Container>
	)
}
