import { KeyboardEvent, useEffect, useState } from "react"
import classnames from "classnames"
import { TButton, TSpan } from "components/TranslationTag"
import { translate } from "locales/translate"
import { ComponentWithChild } from "types/Common"
import { ConfirmOptions, InternalHandler, QueueProps } from "./types"

let handler: InternalHandler | null = null

// Called by consumers: returns a Promise that resolves to true (OK) or false (Cancel)
export function openPopup(options: ConfirmOptions = {}): Promise<boolean> {
	if (!handler) {
		// If provider not mounted, create a temporary portal dialog
		return new Promise<boolean>(resolve => {
			resolve(false)
		})
	}
	return handler(options)
}

// Provider-based implementation (recommended)
export const ConfirmProvider = ({ children }: ComponentWithChild) => {
	const [queue, setQueue] = useState<QueueProps[]>([])

	useEffect(() => {
		// register handler
		handler = (options: ConfirmOptions) => {
			return new Promise<boolean>(resolve => {
				const id = Date.now() + Math.random()
				setQueue([{ id, options, resolve }])
			})
		}

		return () => {
			handler = null
		}
	}, [])

	const current = queue[0] ?? null

	useEffect(() => {
		const bg = window.getComputedStyle(document.body).backgroundColor
		const rgb = bg.match(/\d+/g)
		if (rgb) {
			const rgba = `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, 1)`
			const modalContent = document.querySelector(".modal-content")
			if (modalContent instanceof HTMLElement) {
				modalContent.style.backgroundColor = rgba
			}
		}
	}, [current])

	const clsName = classnames(
		"modal-content",
		{ "fade-in-up": queue.length > 0 },
		{ "fade-in-down": queue.length === 0 }
	)

	const onCancel = () => {
		if (!current) {
			return
		}
		current.resolve(false)
		setQueue([])
	}

	const onOkClicked = () => {
		if (!current) {
			return
		}
		current.resolve(true)
		setQueue([])
	}

	const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
		if (e.code === "Escape") {
			onCancel()
		} else if (e.code === "Enter") {
			onOkClicked()
		}
	}

	return (
		<ConfirmProvider>
			{children}

			{current && (
				<div className="modal-dialog">
					<div className={clsName}>
						<div className="modal-header">
							<TSpan className="popup-header" content="popup.confirm.title" />
						</div>
						<div className="modal-body custom-scrollbar">
							<span className="alert-icon">
								<i className="fas fa-question-circle" />
							</span>
							&nbsp;
							{current.options.description && translate(current.options.description)}
						</div>
						<div className="modal-footer flex evenly custom-footer-popup">
							<TButton
								className="btn btn-primary ok"
								value="popup.button-ok"
								onClick={onOkClicked}
								onKeyDown={onKeyDown}
							/>
							<TButton
								className="btn btn-outline-secondary cancel"
								value="popup.button-cancel"
								onClick={onCancel}
							/>
						</div>
					</div>
				</div>
			)}
		</ConfirmProvider>
	)
}

export default ConfirmProvider
