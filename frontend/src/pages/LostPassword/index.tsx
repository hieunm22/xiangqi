import { Link as RouterLink } from "react-router-dom"
import { Box, Link, Stack, Typography } from "@mui/material"
import { LOGIN_PATH } from "common/constant"

export default function LostPasswordPage() {
	return (
		<Box
			sx={{
				minHeight: "100vh",
				display: "flex",
				alignItems: "center",
				width: "100%",
				justifyContent: "center",
			}}
		>
			<Stack spacing={1.5} alignItems="center">
				<Typography variant="h5" component="h1" fontWeight={700}>
					Lost Password
				</Typography>
				<Typography color="text.secondary">Reset password flow is not implemented yet.</Typography>
				<Link component={RouterLink} to={LOGIN_PATH} underline="hover">
					Back to login
				</Link>
			</Stack>
		</Box>
	)
}
