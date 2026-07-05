import classnames from "classnames"
import { Stack } from "@mui/material"
import { TSpan } from "components/TranslationTag"
import { getPasswordPolicyItems } from "common/password"
import "./PasswordPolicyChecklist.scss"

interface PasswordPolicyChecklistProps {
	value: string
}

const policyIconClass = (matched: boolean) => classnames("fas password-policy-icon", {
	"fa-times": !matched,
	"fa-check": matched
})

const policyLineClass = (matched: boolean) => classnames("password-policy-line", { matched })

export const PasswordPolicyChecklist = ({ value }: PasswordPolicyChecklistProps) => (
	<Stack component="span" spacing={0.5} className="password-policy-helper">
		{getPasswordPolicyItems(value).map(item => (
			<span key={item.key} className={policyLineClass(item.matched)}>
				<i className={policyIconClass(item.matched)} />
				<TSpan content={item.key} />
			</span>
		))}
	</Stack>
)
