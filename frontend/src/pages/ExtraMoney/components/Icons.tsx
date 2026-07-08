import { CircularProgress } from "@mui/material"
import { ClaimButtonIconProps } from "../types"

function ClaimIcon() {
	return (
		<CircularProgress size={20} color="inherit" />
	)
}

export function ClaimIconButton(props: ClaimButtonIconProps) {
	const { isClaiming, icon } = props
	return isClaiming ? <ClaimIcon /> : <i className={`fas ${icon}`} />
}
