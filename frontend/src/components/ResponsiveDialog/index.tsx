import {
	Dialog,
	DialogProps,
	Drawer,
	useMediaQuery,
	useTheme
} from "@mui/material"
import classnames from "classnames"
import "./ResponsiveDialog.scss"

type ResponsiveDialogProps = DialogProps & {
	drawerAnchor: "top" | "bottom"
}

export const ResponsiveDialog = (props: ResponsiveDialogProps) => {
	const { drawerAnchor, ...dialogProps } = props
	const theme = useTheme()
	const isMobile = useMediaQuery(theme.breakpoints.down("sm"))

	if (!isMobile) {
		return <Dialog {...dialogProps} />
	}

	const {
		children,
		className,
		disableEnforceFocus,
		open,
		slotProps,

		onClose,
	} = dialogProps

	const handleDrawerClose = () => onClose?.({}, "escapeKeyDown")

	const paperSlotProps = slotProps?.paper as { className?: string } | undefined
	const paperClassName = classnames(
		"responsive-drawer-paper",
		drawerAnchor,
		paperSlotProps?.className
	)

	return (
		<Drawer
			anchor={drawerAnchor}
			open={open}
			onClose={handleDrawerClose}
			className={classnames("responsive-drawer", className)}
			disableEnforceFocus={disableEnforceFocus}
			slotProps={{
				paper: {
					...paperSlotProps,
					className: paperClassName
				}
			}}
		>
			{children}
		</Drawer>
	)
}
