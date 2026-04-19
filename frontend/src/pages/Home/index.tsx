import classnames from "classnames"
import useAutoTitle from "hooks/useAutoTitle"
import "./Home.scss"

export default function HomePage() {
	useAutoTitle("page.home.title")

	const columns = 9
	const rows = 10
	const cellSize = 60

	const boardWidth = (columns - 1) * cellSize
	const boardHeight = (rows - 1) * cellSize

	const xAt = (col: number) => col * cellSize
	const yAt = (row: number) => row * cellSize

	const markerPositions: Array<[number, number]> = [
		[1, 2],
		[7, 2],
		[0, 3],
		[2, 3],
		[4, 3],
		[6, 3],
		[8, 3],
		[0, 6],
		[2, 6],
		[4, 6],
		[6, 6],
		[8, 6],
		[1, 7],
		[7, 7],
	]

  const markerClass = (col: number) => classnames("marker", {
    "left-edge": col === 0,
    "right-edge": col === columns - 1,
  })

	return (
		<div className="game-container">
			<div
				className="xiangqi-board"
				role="img"
				aria-label="Xiangqi board"
				style={
					{
						"--board-width": `${boardWidth + 6}px`,
						"--board-height": `${boardHeight + 6}px`,
						"--cell-size": `${cellSize}px`,
					} as React.CSSProperties
				}
			>
				<div className="board-frame">
					{Array.from({ length: rows - 2 }, (_, index) => index + 1).map((row) => (
						<i key={`h-${row}`} className="line horizontal" style={{ top: `${yAt(row)}px` }} />
					))}

					{Array.from({ length: columns - 2 }, (_, index) => index + 1).map((col) => (
						<div key={`v-${col}`}>
							<i className="line vertical top" style={{ left: `${xAt(col)}px` }} />
							<i className="line vertical bottom" style={{ left: `${xAt(col)}px`, top: "300px" }} />
						</div>
					))}

					<i
						className="palace-line"
						style={{ left: `${xAt(3)}px`, top: `${yAt(0)}px`, width: `${Math.sqrt(2) * cellSize * 2}px`, transform: "rotate(45deg)" }}
					/>
					<i
						className="palace-line"
						style={{ left: `${xAt(5)}px`, top: `${yAt(0)}px`, width: `${Math.sqrt(2) * cellSize * 2}px`, transform: "rotate(135deg)" }}
					/>
					<i
						className="palace-line"
						style={{ left: `${xAt(3)}px`, top: `${yAt(7)}px`, width: `${Math.sqrt(2) * cellSize * 2}px`, transform: "rotate(45deg)" }}
					/>
					<i
						className="palace-line"
						style={{ left: `${xAt(5)}px`, top: `${yAt(7)}px`, width: `${Math.sqrt(2) * cellSize * 2}px`, transform: "rotate(135deg)" }}
					/>

					<p className="river-text left" style={{ left: `${xAt(2)}px` }}>
						楚河
					</p>
					<p className="river-text right" style={{ left: `${xAt(6)}px` }}>
						漢界
					</p>

					{markerPositions.map(([col, row]) => (
						<span
							key={`marker-${col}-${row}`}
							className={markerClass(col)}
							style={{ left: `${xAt(col)}px`, top: `${yAt(row)}px` }}
						>
							<i className="corner top-left" />
							<i className="corner top-right" />
							<i className="corner bottom-left" />
							<i className="corner bottom-right" />
						</span>
					))}
				</div>
			</div>
		</div>
	)
}
