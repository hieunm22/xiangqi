import classnames from "classnames"
import { Alert as MuiAlert, AlertProps } from "@mui/material"
import { TI } from "components/TranslationTag"
import { translate } from "locales/translate"
import "./AlertWithIcon.scss"

export default function Alert(props: AlertProps) {
	const iconMap: Record<string, string> = {
		success: "far fa-check-circle",
		error: "far fa-exclamation-circle",
		warning: "far fa-exclamation-triangle",
		info: "far fa-info-circle"
	}

	const severity = props.severity || "info"
	const severityIcon = iconMap[severity]
	const iconClass = classnames("alert-icon", severityIcon)
	const icon = <TI className={iconClass} title={severity} />

	const translatedChildren = typeof props.children === "string"
		? translate(props.children)
		: props.children

	return (
		<MuiAlert
			{...props}
			icon={icon}
			title={props.title}
		>
			{translatedChildren}
		</MuiAlert>
	)
}
