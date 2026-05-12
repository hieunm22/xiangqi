import { Link } from "react-router-dom"
import { LOGIN_PATH } from "../../common/constant"
import { translate } from "../../locales/translate"
import { TButton } from "../TranslationTag"
import { MessageScreenProps } from "./types"
import "./MessageScreen.scss"

const Buttons = (props: MessageScreenProps) => {
	// const pageName = props.message === "UNAUTHORIZED_MUST_LOGIN"
	// 	? translate("constant.login")
	// 	: translate("constant.home")
	if (props.data && props.data.length > 0) {
		return (
		<>
			<Link to={LOGIN_PATH}>
				{translate("reset-password.action.back-to-login")/*.format(pageName)*/}
			</Link>
			<Link to={props.data[0]}>
				{translate("constant.request-new-token")}
			</Link>
		</>)
	}

	return (
		<Link className="return-btn" to={LOGIN_PATH}>
			{translate("reset-password.action.back-to-login")/*.format(pageName)*/}
		</Link>)
}

const MessageScreen = (props: MessageScreenProps) => {
	const logout = () => {
		props.action && props.action()
	}

	const icon = props.icon ? props.icon : "fa-check"
	const translateMessage = translate(props.message)

	return (
		<div className="message__container">
			<div className="message__header">{translate("constant.message-screen-title")}</div>
			<div className="message__content">
				<div className="message__content-panel">
					<i className={`fas ${icon}`} />
					{translateMessage}
				</div>
			</div>
			<div className="message__actions">
				{props.actionMessage ? (
					<TButton
						className="logout-action"
						onClick={logout}
						value={props.actionMessage}
					/>
				) : <Buttons {...props} />}
			</div>
		</div>
	)
}

export default MessageScreen
