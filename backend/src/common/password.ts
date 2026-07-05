// Server-side password policy — mirrors the client rules in `frontend/src/common/password.ts`

export const PASSWORD_POLICY = {
	minLength: 8,
	lowercase: /[a-z]/,
	uppercase: /[A-Z]/,
	numeric: /[0-9]/,
	special: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/
}

export const isPasswordPolicyMet = (value: string): boolean =>
	value.length >= PASSWORD_POLICY.minLength
	&& PASSWORD_POLICY.lowercase.test(value)
	&& PASSWORD_POLICY.uppercase.test(value)
	&& PASSWORD_POLICY.numeric.test(value)
	&& PASSWORD_POLICY.special.test(value)
