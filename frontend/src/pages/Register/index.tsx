import { Box, Link, Stack, Typography } from "@mui/material"
import { Link as RouterLink } from "react-router-dom"

export default function RegisterPage() {
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
					Register
				</Typography>
				<Typography color="text.secondary">Registration flow is not implemented yet.</Typography>
				<Link component={RouterLink} to="/login" underline="hover">
					Back to login
				</Link>
			</Stack>
		</Box>
	)
}
