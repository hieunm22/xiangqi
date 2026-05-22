import React from "react"
import classnames from "classnames"
import { Menu, MenuItem } from "@mui/material"
import { BOARD_COLUMNS, BOARD_ROWS } from "common/constant"
import { markerPositions, pieceSymbolByType } from "./constant"
import { TI } from "components/TranslationTag"
import PieceItem from "./components/Piece"
import PlayerInfoCard from "./components/PlayerInfoCard"
import { translate } from "locales/translate"
import useRoomHook from "./hook"
import { Empty } from "components/Common"
import { Piece } from "types/GameState"
import "./Room.scss"

export default function RoomPage() {
	const {
		actionMenuItems,
		currentTurn,
		firstJoinedUser,
		isActionMenuOpen,
		menuAnchorEl,
		secondJoinedUser,
		state,

		closeActionMenu,
		handleMenuItemClick,
		markerClass,
		onAnimateEnd,
		onPieceClick,
		openActionMenu
	} = useRoomHook()

	return (
		<div className="room-container">
			<div className="player-info-row view">
				<PlayerInfoCard
					username={firstJoinedUser?.display_name || translate("room.info.waiting-user")}
					team={firstJoinedUser?.team === "red" ? "red" : "black"}
					active={currentTurn === firstJoinedUser?.team}
					avatarUrl={firstJoinedUser?.avatar_url || null}
					capturedPieces={state.capturedPieces.black}
					userId={firstJoinedUser?.id}
				/>
				<PlayerInfoCard
					username={secondJoinedUser?.display_name || translate("room.info.waiting-user")}
					team={secondJoinedUser?.team === "black" ? "black" : "red"}
					active={currentTurn === secondJoinedUser?.team}
					avatarUrl={secondJoinedUser?.avatar_url || null}
					capturedPieces={state.capturedPieces.red}
					isEmpty={!secondJoinedUser}
					userId={secondJoinedUser?.id}
				/>
			</div>
			<div className="xiangqi-board">
				<div className="board-frame">
					{Array.from({ length: BOARD_ROWS - 2 }, (_, i) => i + 1).map(row => (
						<i className={`line horizontal row-${row}`} key={`h-${row}`} />
					))}

					{Array.from({ length: BOARD_COLUMNS - 2 }, (_, i) => i + 1).map(col => (
						<React.Fragment key={`v-${col}`}>
							<i className={`line vertical top col-${col}`} />
							<i className={`line vertical bottom col-${col}`} />
						</React.Fragment>
					))}
					<i className="palace-line line1" />
					<i className="palace-line line2" />
					<i className="palace-line line3" />
					<i className="palace-line line4" />

					<span className="river-text left">楚河</span>
					<span className="river-text right">漢界</span>

					{markerPositions.map(([col, row]) => (
						<div className={markerClass(col, row)} key={`marker-${col}-${row}`}>
							<i className="corner top-left" />
							<i className="corner top-right" />
							<i className="corner bottom-left" />
							<i className="corner bottom-right" />
						</div>
					))}

					{state.board
						.map((cell, id) => {
							const col = id % BOARD_COLUMNS
							const row = ~~(id / BOARD_COLUMNS)
							if (!cell) {
								const isAvailable = state.availableMoves.includes(id)
								const emptyClass = classnames({
									"piece-wrapper-empty": true,
									[`row-${row}-piece`]: true,
									[`col-${col}-piece`]: true,
									// [`row-${row}-empty`]: true,
									// [`col-${col}-empty`]: true,
									"available": isAvailable,
									// "available-empty": isAvailable,
									"cursor-pointer": isAvailable && state.selected !== null
								})
								return (
									<div
										key={`empty-${id}`}
										className={emptyClass}
										onClick={onPieceClick(id)}
									/>)
							}

							const piece = cell.piece as Piece

							return (
								<PieceItem
									key={cell.id}
									$cell={cell}
									$left={col}
									$top={row}
									$available={state.availableMoves.includes(cell.id)}
									$selectedId={state.selected}
									$turn={state.teamTurn}
									$click={onPieceClick(cell.id)}
									$animateEnd={onAnimateEnd}
								>
									{pieceSymbolByType[cell.team][piece]}
								</PieceItem>
							)
						})}
				</div>
			</div>
			<div className="room-action-row view">
				<TI className="room-more-action fas fa-ellipsis-h" onClick={openActionMenu} />
				<Menu
					anchorEl={menuAnchorEl}
					open={isActionMenuOpen}
					onClose={closeActionMenu}
					anchorOrigin={{ vertical: "top", horizontal: "left" }}
					transformOrigin={{ vertical: "center", horizontal: "right" }}
					slotProps={{
						root: {
							"aria-hidden": false
						}
					}}
				>
					{actionMenuItems.map(item => {
						if (!item.visible) return <Empty key={item.key} />
						return (
							<MenuItem
								key={item.key}
								onClick={item.onClick && handleMenuItemClick(item.onClick)}
								disabled={!item.enabled}
							>
								<i className={`${item.icon} action-menu-icon`} />
								{item.label}
							</MenuItem>
						)
					})}
				</Menu>
			</div>
		</div>
	)
}
