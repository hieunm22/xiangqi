// Shared password policy — single source of truth for client-side password validation

export const PASSWORD_POLICY = {
	minLength: 8,
	lowercase: /[a-z]/,
	uppercase: /[A-Z]/,
	numeric: /[0-9]/,
	special: /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/,
	message: "register.password.error1"
}

export const getPasswordPolicyStatus = (value: string) => ({
	hasLowercase: PASSWORD_POLICY.lowercase.test(value),
	hasUppercase: PASSWORD_POLICY.uppercase.test(value),
	hasNumeric: PASSWORD_POLICY.numeric.test(value),
	hasSpecial: PASSWORD_POLICY.special.test(value),
	hasMinLength: value.length >= PASSWORD_POLICY.minLength
})

// Ordered list used to render the policy checklist. Keys map to the
// `common.password.policy-*` localization entries.
export const getPasswordPolicyItems = (value: string) => {
	const status = getPasswordPolicyStatus(value)
	return [
		{ key: "common.password.policy-1", matched: status.hasLowercase },
		{ key: "common.password.policy-2", matched: status.hasUppercase },
		{ key: "common.password.policy-3", matched: status.hasNumeric },
		{ key: "common.password.policy-4", matched: status.hasSpecial },
		{ key: "common.password.policy-5", matched: status.hasMinLength }
	]
}

export const isPasswordPolicyMet = (value: string) =>
	Object.values(getPasswordPolicyStatus(value)).every(Boolean)
