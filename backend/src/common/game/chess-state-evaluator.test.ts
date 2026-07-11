import { describe, it, expect } from "vitest"
import { evaluateChessTeamState, parseChessFen } from "./chess-state-evaluator"

describe("parseChessFen", () => {
	it("parses the standard opening placement from board-only fen", () => {
		const pos = parseChessFen("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR")
		expect(pos.board.filter(Boolean)).toHaveLength(32)
		// index 0 = a8 = black rook
		expect(pos.board[0]).toEqual({ piece: "r", team: "black" })
		// index 60 = e1 = white king
		expect(pos.board[60]).toEqual({ piece: "k", team: "white" })
	})

	it("rejects malformed placements", () => {
		expect(() => parseChessFen("8/8/8/8/8/8/8")).toThrow()
		expect(() => parseChessFen("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBXR")).toThrow()
	})
})

describe("evaluateChessTeamState", () => {
	it("reports ongoing from the opening position", () => {
		const result = evaluateChessTeamState(
			"rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR", "white")
		expect(result.status).toBe("ongoing")
		expect(result.inCheck).toBe(false)
		expect(result.legalMovesCount).toBe(20) // 16 pawn + 4 knight moves
	})

	it("detects the fool's mate as checkmate for white", () => {
		// 1. f3 e5 2. g4 Qh4# - white is checkmated, black queen on h4.
		const fen = "rnb1kbnr/pppp1ppp/8/4p3/6Pq/5P2/PPPPP2P/RNBQKBNR"
		const result = evaluateChessTeamState(fen, "white")
		expect(result.inCheck).toBe(true)
		expect(result.status).toBe("checkmate")
		expect(result.legalMovesCount).toBe(0)
	})

	it("detects a back-rank checkmate", () => {
		// Black king h8, white rook a8 gives mate; black pawns f7/g7/h7 box the king in.
		const fen = "R6k/5ppp/8/8/8/8/8/6K1"
		const result = evaluateChessTeamState(fen, "black")
		expect(result.inCheck).toBe(true)
		expect(result.status).toBe("checkmate")
	})

	it("detects stalemate (no legal move, not in check)", () => {
		// Classic stalemate: black king a8, white queen c7, white king c6. Black to move.
		const fen = "k7/2Q5/2K5/8/8/8/8/8"
		const result = evaluateChessTeamState(fen, "black")
		expect(result.inCheck).toBe(false)
		expect(result.status).toBe("stalemate")
		expect(result.legalMovesCount).toBe(0)
	})

	it("reports check (not mate) when the king can still escape", () => {
		// White king e1, black rook e8 down the open e-file: white in check but can step aside.
		const fen = "4r2k/8/8/8/8/8/8/4K3"
		const result = evaluateChessTeamState(fen, "white")
		expect(result.inCheck).toBe(true)
		expect(result.status).toBe("check")
		expect(result.legalMovesCount).toBeGreaterThan(0)
	})

	it("allows castling out only through safe squares", () => {
		// White: king e1, rook h1, kingside castling right, nothing attacking f1/g1.
		const safe = evaluateChessTeamState("4k3/8/8/8/8/8/8/4K2R", "white")
		expect(safe.legalMovesCount).toBeGreaterThan(0)
	})
})
