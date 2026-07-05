import { Menu, MenuItem } from "@mui/material"
import { Empty } from "components/Common"
import { TI } from "components/TranslationTag"
import { GameMenuActionContext } from "hooks/useAppContext"
import { translate } from "locales/translate"
import { GameMenuActionContextValue } from "../types"

export const GameMenu = (props: GameMenuActionContextValue) => {
	const {
		actionMenuItems,
		isActionMenuOpen,
		menuAnchorEl,

		closeActionMenu,
		handleMenuItemClick,
		openActionMenu
	} = props

	return (
		<GameMenuActionContext.Provider value={props}>
			<TI className="room-more-action fas fa-ellipsis-h" onClick={openActionMenu} />
			<Menu
				anchorEl={menuAnchorEl}
				open={isActionMenuOpen}
				onClose={closeActionMenu}
				anchorOrigin={{ vertical: "top", horizontal: "left" }}
				transformOrigin={{ vertical: "center", horizontal: "right" }}
				slotProps={{
					root: {
						"aria-hidden": false
					}
				}}
			>
				{actionMenuItems.map(item => {
					if (!item.visible) return <Empty key={item.key} />
					return (
						<MenuItem
							key={item.key}
							onClick={handleMenuItemClick(item.onClick)}
							disabled={!item.enabled}
						>
							<i className={`${item.icon} action-menu-icon`} />
							{translate(item.label)}
						</MenuItem>
					)
				})}
			</Menu>
		</GameMenuActionContext.Provider>
	)
}
