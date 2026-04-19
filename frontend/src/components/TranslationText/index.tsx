import { Trans } from "react-i18next"

const TranslationText = ({ text }: { text?: string }) => {
	return <Trans i18nKey={text} />
}

export default TranslationText
