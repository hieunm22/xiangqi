import i18n from "./i18n"

export const translate = (key?: string) => i18n.t(key || "", { nsSeparator: false }) as string

export const translateMany = (keys: string, separator = " ") => {
	const split = keys.split(separator)
	const mapCallback = (key: string) => i18n.t(key, { nsSeparator: false })
	const translated = split.map(mapCallback).join(separator)
	return translated
}

export const translateManyJoin = (keys: string[], separator = " ") => {
	const mapCallback = (key: string) => i18n.t(key, { nsSeparator: false })
	const translated = keys.map(mapCallback).join(separator)
	return translated
}
