const FACEBOOK_APP_ID = process.env.FACEBOOK_APP_ID
const FACEBOOK_APP_SECRET = process.env.FACEBOOK_APP_SECRET
const GRAPH_API = "https://graph.facebook.com/v19.0"

export interface FacebookProfile {
	id: string
	name?: string
	email?: string
}

interface DebugTokenResponse {
	data?: {
		is_valid?: boolean
		app_id?: string
		expires_at?: number
	}
}

/**
 * Verify a Facebook user access token and return the profile.
 * Returns null when the token is invalid, foreign, or the profile has no id.
 */
export const verifyFacebookAccessToken = async (accessToken: string): Promise<FacebookProfile | null> => {
	const appAccessToken = `${FACEBOOK_APP_ID}|${FACEBOOK_APP_SECRET}`

	const debugUrl = `${GRAPH_API}/debug_token`
		+ `?input_token=${encodeURIComponent(accessToken)}`
		+ `&access_token=${encodeURIComponent(appAccessToken)}`

	const debugRes = await fetch(debugUrl)
	if (!debugRes.ok) return null

	const debugJson = await debugRes.json() as DebugTokenResponse
	const data = debugJson.data
	if (!data?.is_valid || data.app_id !== FACEBOOK_APP_ID) return null

	const meUrl = `${GRAPH_API}/me`
		+ `?fields=id,name,email`
		+ `&access_token=${encodeURIComponent(accessToken)}`

	const meRes = await fetch(meUrl)
	if (!meRes.ok) return null

	const profile = await meRes.json() as { id?: string; name?: string; email?: string }
	if (!profile.id) return null

	return { id: profile.id, name: profile.name, email: profile.email }
}
