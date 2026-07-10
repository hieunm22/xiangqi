import { useEffect, useState } from "react"
import { Avatar, Box, Snackbar, useMediaQuery } from "@mui/material"
import { useTheme } from "@mui/material/styles"
import { requireImage } from "common/helper"
import { ComponentWithChild } from "types/Common"
import {
	SnackbarOptions,
	SnackbarQueueItem
} from "./types"
import { setSnackbarHandler } from "./helper"
import "./SnackBarProvider.scss"

export const SnackbarProvider = (props: ComponentWithChild) => {
	const theme = useTheme()
	const [queue, setQueue] = useState<SnackbarQueueItem[]>([])
	const isMobile = useMediaQuery(theme.breakpoints.down("sm"))
	const horizontal = isMobile ? "center" : "right"

	useEffect(() => {
		setSnackbarHandler((options: SnackbarOptions) => {
			setQueue(prev => [
				...prev,
				{
					id: Date.now() + Math.random(),
					options
				}
			])
		})

		return () => {
			setSnackbarHandler(null)
		}
	}, [])

	const current = queue[0] ?? null

	const handleClose = () => {
		setQueue(prev => prev.slice(1))
	}

	return (
		<>
			{props.children}
			<Snackbar
				open={!!current}
				autoHideDuration={current?.options.duration ?? 3000}
				onClose={handleClose}
				anchorOrigin={{ vertical: "top", horizontal }}
			>
				<Box
					className="snackbar-content"
				>
					<Avatar className="snackbar-avatar" src={requireImage(current?.options.avatar || "")} />
					<span className="snackbar-message">{current?.options.message}</span>
				</Box>
			</Snackbar>
		</>
	)
}

export default SnackbarProvider
