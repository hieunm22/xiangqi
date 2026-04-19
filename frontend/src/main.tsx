import { createRoot } from "react-dom/client"
import { BrowserRouter } from "react-router-dom"
import "@fortawesome/fontawesome-pro/css/all.css"
import "bootstrap/dist/css/bootstrap.min.css"
import App from "./App.tsx"
import { Provider } from "react-redux"
import { store } from "toolkit/store.ts"

const root = document.getElementById("root") as HTMLElement
createRoot(root).render(
	<BrowserRouter>
		<Provider store={store}>
			<App />
		</Provider>
	</BrowserRouter>
)
