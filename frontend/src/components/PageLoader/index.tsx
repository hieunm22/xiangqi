import { CircularProgress } from "@mui/material"
import "./PageLoader.scss"

const PageLoader = () => {
	return (
		<div className="page-loader">
			<CircularProgress />
		</div>
	)
}

export default PageLoader
