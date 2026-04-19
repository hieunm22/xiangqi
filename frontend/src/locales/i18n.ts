import i18n from "i18next"
import { initReactI18next } from "react-i18next"
import en from "./en.json"
import vi from "./vi.json"

i18n.use(initReactI18next).init({
	resources: {
		en: { translation: en },
		vi: { translation: vi }
	},
	detection: {
		lookupLocalStorage: "language",
		caches: ["localStorage"]
	},
	// cache user language on
	cache: ["localStorage"],
	fallbackLng: "en",
	interpolation: {
		escapeValue: false
	}
})

export default i18n
