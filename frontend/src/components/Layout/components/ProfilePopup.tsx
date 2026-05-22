import {
	Box,
	Dialog,
	DialogContent,
	DialogTitle,
	Divider,
	Grid
} from "@mui/material"
import { TButton, TSpan, TTooltip } from "components/TranslationTag"
import { usePopups } from "hooks/useAppContext"
import { translate } from "locales/translate"
import { getClaimsFromLocalStorage } from "common/helper"

export const ProfilePopup = () => {
	const { openProfilePopup, setOpenProfilePopup, profileUser: user } = usePopups()

	const handleCloseProfilePopup = () => {
		setOpenProfilePopup(false)
	}

	const handleChangePassword = () => {
		// TODO: open change password dialog
	}

	const claims = getClaimsFromLocalStorage()
	const currentUserId = claims?.sub
	const isOwnProfile = user?.id === currentUserId

	return (
		<Dialog
			open={openProfilePopup}
			onClose={handleCloseProfilePopup}
			maxWidth="xs"
			fullWidth
			disableRestoreFocus
		>
			<DialogTitle className="pt-8 pb-8">{translate("menu.profile")}</DialogTitle>
			<Divider className="profile-dialog-divider" />
			<DialogContent>
				{user && (
					<Box className="profile-user-info">
						<TTooltip title="register.username.label" arrow placement="left">
							<i className="fas fa-user mr-20" />
						</TTooltip>
						<span>{user.user_name || "-"}</span>
						<TTooltip title="register.display-name.label" arrow placement="left">
							<i className="fas fa-tag" />
						</TTooltip>
						<span>{user.display_name || "-"}</span>
						<TTooltip title="register.gender.label" arrow placement="left">
							<i className="fas fa-venus-mars" />
						</TTooltip>
						<TSpan content={user.gender ? "register.gender.male" : "register.gender.female"} />
						<TTooltip title="register.email.label" arrow placement="left">
							<i className="fas fa-envelope" />
						</TTooltip>
						<a href={`mailto:${user.email}`}>{user.email}</a>
					</Box>
				)}

				<Grid container className="profile-dialog-actions">
					<TButton
						variant="outlined"
						size="medium"
						onClick={handleCloseProfilePopup}
						value="settings.close"
					/>
					{isOwnProfile
						&& (
						<TButton
							variant="contained"
							size="small"
							onClick={handleChangePassword}
							value="settings.change-password"
						/>
					)}
				</Grid>
			</DialogContent>
		</Dialog>
	)
}
