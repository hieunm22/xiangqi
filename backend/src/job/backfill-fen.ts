// npx ts-node -r tsconfig-paths/register src/job/backfill-fen.ts --fix
import { getGameHistoryCollection } from "common/mongodb"

/**
 * One-off backfill: rewrite board-only xiangqi FENs in `game_history` to standard 6-field form.
 * Idempotent; skips chess games and already-converted records. Dry-run by default; pass `--fix` to write.
 */

const XIANGQI_ROWS = 10
const SAMPLE_LIMIT = 5

export interface HistoryDoc {
	_id: unknown
	game_id?: string
	gameId?: string
	fen: string
	team: string
	capture?: string | null
	time_stamp?: number
}

export interface PlannedUpdate {
	id: unknown
	oldFen: string
	newFen: string
}

export interface BackfillResult {
	applied: boolean
	gamesScanned: number
	xiangqiGames: number
	skippedNonXiangqiGames: number
	recordsUpdated: number
	recordsAlreadySixField: number
	recordsSkippedUnknownTeam: number
	samples: PlannedUpdate[]
}

/**
 * Red moves first (plays the "white" role), so red -> "w", black -> "b".
 */
export function teamToSide(team: string): "w" | "b" | null {
	if (team === "red") return "w"
	if (team === "black") return "b"
	return null
}

const placementOf = (fen: string): string => fen.trim().split(/\s+/)[0]
const isBoardOnly = (fen: string): boolean => !/\s/.test(fen.trim())
const rowCount = (fen: string): number => placementOf(fen).split("/").length

/**
 * Plan the 6-field FEN rewrite for one game's history (oldest-first).
 * Returns [] for chess/unknown games; already-converted records are skipped but advance counters.
 */
export function planGameUpdates(records: HistoryDoc[]): PlannedUpdate[] {
	if (records.length === 0 || rowCount(records[0].fen) !== XIANGQI_ROWS) {
		return []
	}

	const updates: PlannedUpdate[] = []
	let halfmove = 0
	records.forEach((rec, i) => {
		// Xiangqi's 60-move rule counts moves without a capture: reset on a capturing
		// move, otherwise increment. The initial position starts the clock at 0.
		if (i > 0) {
			halfmove = rec.capture ? 0 : halfmove + 1
		}
		const fullmove = Math.floor(i / 2) + 1

		// Leave already-migrated records as-is (keeps the run idempotent).
		if (!isBoardOnly(rec.fen)) {
			return
		}
		const side = teamToSide(rec.team)
		if (!side) {
			return
		}

		const newFen = `${placementOf(rec.fen)} ${side} - - ${halfmove} ${fullmove}`
		updates.push({ id: rec._id, oldFen: rec.fen, newFen })
	})

	return updates
}

/**
 * Oldest-first, matching the app's replay order (time_stamp asc, _id as tiebreak).
 */
function byChronology(a: HistoryDoc, b: HistoryDoc): number {
	const ta = a.time_stamp ?? 0
	const tb = b.time_stamp ?? 0
	if (ta !== tb) {
		return ta - tb
	}
	return String(a._id) < String(b._id) ? -1 : 1
}

export async function backfillFen(opts: { apply: boolean; gameId?: string }): Promise<BackfillResult> {
	const collection = await getGameHistoryCollection()
	const query = opts.gameId
		? { $or: [{ game_id: opts.gameId }, { gameId: opts.gameId }] }
		: {}
	const docs = (await collection.find(query).toArray()) as unknown as HistoryDoc[]

	// Group by normalized game id (legacy docs may key it as `gameId`).
	const groups = new Map<string, HistoryDoc[]>()
	for (const doc of docs) {
		const gid = doc.game_id ?? doc.gameId
		if (!gid) {
			continue
		}
		const list = groups.get(gid) ?? []
		list.push(doc)
		groups.set(gid, list)
	}

	const result: BackfillResult = {
		applied: opts.apply,
		gamesScanned: groups.size,
		xiangqiGames: 0,
		skippedNonXiangqiGames: 0,
		recordsUpdated: 0,
		recordsAlreadySixField: 0,
		recordsSkippedUnknownTeam: 0,
		samples: []
	}

	const ops: any[] = []
	for (const records of groups.values()) {
		records.sort(byChronology)

		if (rowCount(records[0].fen) !== XIANGQI_ROWS) {
			result.skippedNonXiangqiGames += 1
			continue
		}
		result.xiangqiGames += 1
		result.recordsAlreadySixField += records.filter(r => !isBoardOnly(r.fen)).length
		result.recordsSkippedUnknownTeam += records.filter(
			r => isBoardOnly(r.fen) && teamToSide(r.team) === null
		).length

		for (const update of planGameUpdates(records)) {
			if (result.samples.length < SAMPLE_LIMIT) {
				result.samples.push(update)
			}
			ops.push({ updateOne: { filter: { _id: update.id }, update: { $set: { fen: update.newFen } } } })
		}
	}

	result.recordsUpdated = ops.length

	if (opts.apply && ops.length > 0) {
		await collection.bulkWrite(ops, { ordered: false })
	}

	return result
}

// CLI entry: `ts-node -r tsconfig-paths/register src/job/backfill-fen.ts [--fix] [--game=<id>]`
// (or the compiled `node dist/job/backfill-fen.js ...`).
if (require.main === module) {
	// Load env files like the server does, but only inside the CLI branch
	// so test imports don't trigger env.ts (which throws on missing env vars).
	require("../env")

	const apply = process.argv.includes("--fix")
	const gameId = process.argv.find(arg => arg.startsWith("--game="))?.split("=")[1]

	backfillFen({ apply, gameId })
		.then(result => {
			console.log("[backfill-fen] summary:", { ...result, samples: undefined })
			for (const sample of result.samples) {
				console.log(`[backfill-fen] e.g. ${sample.oldFen}  ->  ${sample.newFen}`)
			}
			if (!apply) {
				console.log("[backfill-fen] DRY RUN — no changes written. Re-run with --fix to apply.")
			}
			process.exit(0)
		})
		.catch(err => {
			console.error("[backfill-fen] failed:", err)
			process.exit(1)
		})
}
