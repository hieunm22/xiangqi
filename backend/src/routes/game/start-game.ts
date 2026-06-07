import { Response, Router } from "express"
import prisma from "prisma"
import { BOT_USER_ID, isValidDifficulty } from "common/bot-engine"
import { playBotMove } from "common/bot-engine/play-bot-move"
import { INITIAL_FEN_BLACK_BOTTOM, INITIAL_FEN_BLACK_TOP } from "common/constant"
import { getAvatarUrl } from "common/helper"
import { getGameHistoryCollection } from "common/mongodb"
import { emitGameStarted, emitRoomUsersUpdated } from "common/socket"
import { requireAuth, AuthenticatedRequest } from "middleware/auth"
import { RoomStatus, StartGameRequest } from "types/room.type"

const router = Router()

/**
 * @swagger
 * /api/room/start:
 *   post:
 *     summary: Start a game in a room
 *     tags:
 *       - Room
 *     security:
 *       - basicAuth: []
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - id
 *             properties:
 *               id:
 *                 type: integer
 *                 format: int64
 *               botDifficulty:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 5
 *                 description: |
 *                   When provided, starts a PvE game against the bot at the given level
 *                   (1 = Beginner, 2 = Amateur, 3 = Intermediate, 4 = Advanced, 5 = Master).
 *                   The bot is auto-seated on the team opposite to the requester.
 *     responses:
 *       201:
 *         description: Game started successfully
 *       400:
 *         description: Invalid request body
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Room not found
 *       500:
 *         description: Internal server error
 */
router.post("/room/start", requireAuth(), async (req: AuthenticatedRequest, res: Response) => {
	const { id, botDifficulty } = req.body as StartGameRequest

	if (!Number.isInteger(id) || id <= 0) {
		res.status(400).json({
			success: false,
			message: "start-game.messages.invalid-room-id",
			status_code: 400
		})
		return
	}

	const roomIdBigInt = BigInt(id)

	const existingRoom = await prisma.room.findUnique({
		where: { id: roomIdBigInt },
		select: { id: true }
	})
	if (!existingRoom) {
		res.status(404).json({
			success: false,
			message: "start-game.messages.room-not-found",
			status_code: 404
		})
		return
	}

	const requestedDifficulty: number | null
		= botDifficulty === undefined || botDifficulty === null ? null : botDifficulty
	if (requestedDifficulty !== null && !isValidDifficulty(requestedDifficulty)) {
		res.status(400).json({
			success: false,
			message: "start-game.messages.invalid-difficulty",
			status_code: 400
		})
		return
	}

	const userId = req.auth?.userId
	if (requestedDifficulty !== null && !userId) {
		res.status(401).json({
			success: false,
			message: "auth-middleware.messages.token-required",
			status_code: 401
		})
		return
	}

	try {
		let botTeam: "red" | "black" | null = null
		if (requestedDifficulty !== null) {
			const userIdBigInt = BigInt(userId!)
			const requester = await prisma.roomUser.findUnique({
				where: {
					room_id_user_id: { room_id: roomIdBigInt, user_id: userIdBigInt }
				},
				select: { team: true }
			})
			if (!requester?.team) {
				res.status(400).json({
					success: false,
					message: "start-game.messages.requester-must-pick-team",
					status_code: 400
				})
				return
			}
			botTeam = requester.team === "red" ? "black" : "red"
		}

		const existingRoom = await prisma.room.findUnique({
			where: { id: roomIdBigInt },
			select: { id: true }
		})
		if (!existingRoom) {
			res.status(404).json({
				success: false,
				message: "start-game.messages.room-not-found",
				status_code: 404
			})
			return
		}

		const { game, room } = await prisma.$transaction(async tx => {
			const updatedRoom = await tx.room.update({
				where: { id: roomIdBigInt },
				data: { updated_at: new Date(), status: RoomStatus.Playing },
				select: { id: true, status: true, red_first: true }
			})

			if (requestedDifficulty !== null && botTeam) {
				await tx.roomUser.upsert({
					where: {
						room_id_user_id: { room_id: roomIdBigInt, user_id: BOT_USER_ID }
					},
					create: { room_id: roomIdBigInt, user_id: BOT_USER_ID, team: botTeam },
					update: { team: botTeam }
				})
			}

			const createdGame = await tx.game.create({
				data: {
					status: 1,
					room_id: roomIdBigInt,
					bot_difficulty: requestedDifficulty
				},
				select: { id: true, status: true, room_id: true, bot_difficulty: true }
			})

			// Add game_users records for the 2 active players (with assigned teams)
			const roomPlayers = await tx.roomUser.findMany({
				where: { room_id: roomIdBigInt, team: { not: null } },
				select: { user_id: true }
			})

			for (const player of roomPlayers) {
				await tx.gameUser.create({
					data: {
						game_id: createdGame.id,
						user_id: player.user_id
					}
				})
			}

			return { game: createdGame, room: updatedRoom }
		})

		const collection = await getGameHistoryCollection()
		const initialFen = room.red_first ? INITIAL_FEN_BLACK_TOP : INITIAL_FEN_BLACK_BOTTOM
		const firstTeam: "red" | "black" = room.red_first ? "red" : "black"
		const startRecord = {
			game_id: game.id,
			team: firstTeam,
			fen: initialFen,
			time_stamp: ~~(new Date().getTime() / 1000)
		}
		await collection.insertOne(startRecord)

		res.status(201).json({
			success: true,
			message: "start-game.messages.success",
			status_code: 201,
			data: {
				game: {
					id: game.id,
					status: game.status,
					room_id: Number(game.room_id),
					bot_difficulty: game.bot_difficulty ?? null
				},
				room: {
					id: Number(room.id),
					status: room.status
				}
			}
		})

		// Notify everyone in the room about the updated user list (includes bot if PvE)
		if (requestedDifficulty !== null) {
			const roomUsers = await prisma.roomUser.findMany({
				where: { room_id: roomIdBigInt },
				select: {
					user_id: true,
					team: true,
					users: {
						select: {
							id: true,
							display_name: true,
							avatar_seq: true
						}
					}
				}
			})

			const users = roomUsers.map((ru: any) => ({
				id: Number(ru.user_id),
				display_name: ru.users?.display_name ?? (Number(ru.user_id) === 0 ? "Bot" : "Unknown"),
				avatar_url: getAvatarUrl(ru.users?.id ?? 0, ru.users?.avatar_seq ?? 0),
				team: ru.team,
				joined_at: new Date().toISOString()
			}))

			emitRoomUsersUpdated(Number(room.id), users)
		}

		// Notify everyone in the room (host, opponent, spectators) that the game began,
		// so each client can play the start sound and initialize the board in real time.
		emitGameStarted(Number(room.id), {
			gameId: game.id,
			status: room.status,
			bot_difficulty: game.bot_difficulty
		})

		// If the bot is on the move first, kick off its opening reply after responding.
		if (requestedDifficulty !== null && botTeam && firstTeam === botTeam) {
			playBotMove({
				gameId: game.id,
				roomId: Number(room.id),
				projectFen: initialFen,
				redFirst: room.red_first,
				botTeam,
				difficulty: requestedDifficulty
			}).catch(err => {
				console.error(`[start-game] bot opening move failed for game ${game.id}:`, err)
			})
		}
	} catch (err: any) {
		if (err?.code === "P2025") {
			res.status(404).json({
				success: false,
				message: "start-game.messages.room-not-found",
				status_code: 404
			})
			return
		}

		console.error("Start game error:", err)
		res.status(500).json({
			success: false,
			message: "start-game.messages.internal-server-error",
			status_code: 500
		})
	}
})

export default router
