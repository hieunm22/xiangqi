import { Grid, Skeleton, Stack } from "@mui/material"

export const SkeletonRoom = () => (
	<Grid size={{ xs: 6, sm: 4, md: 4 }} className="dashboard__room-card">
		<Stack spacing={1.5}>
			<Skeleton variant="text" height={32} width="100%" />
			<Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "center" }}>
				<Skeleton variant="text" height={28} width={88} />
				<Skeleton variant="circular" width={28} height={28} />
			</Stack>
			<Skeleton variant="rounded" height={28} width="100%" />
		</Stack>
	</Grid>
)
