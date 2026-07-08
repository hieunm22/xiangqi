import { Response, Router } from "express"
import prisma from "prisma"
import { emitRoomUsersSnapshot, markPostGameReady } from "common/game/post-game.helper"
import { requireAuth, AuthenticatedRequest } from "middleware/auth"
import { BackToRoomRequest } from "types/game.type"

const router = Router()

router.post("/game/back-to-room", requireAuth(), async (req: AuthenticatedRequest, res: Response) => {
	const userId = req.auth?.userId
	const { gameId, roomId } = req.body as BackToRoomRequest

	if (!userId) {
		res.status(401).json({
			success: false,
			message: "auth-middleware.messages.token-required",
			status_code: 401
		})
		return
	}

	if (!Number.isInteger(roomId) || roomId <= 0) {
		res.status(400).json({
			success: false,
			message: "back-to-room.messages.invalid-room-id",
			status_code: 400
		})
		return
	}

	if (!gameId || typeof gameId !== "string") {
		res.status(400).json({
			success: false,
			message: "back-to-room.messages.invalid-game-id",
			status_code: 400
		})
		return
	}

	try {
		const userIdNumber = Number(userId)
		if (!Number.isInteger(userIdNumber) || userIdNumber <= 0) {
			res.status(401).json({
				success: false,
				message: "auth-middleware.messages.token-required",
				status_code: 401
			})
			return
		}

		const roomIdBigInt = BigInt(roomId)
		const userIdBigInt = BigInt(userIdNumber)
		const roomUser = await prisma.roomUser.findUnique({
			where: {
				room_id_user_id: {
					room_id: roomIdBigInt,
					user_id: userIdBigInt
				}
			},
			select: { team: true }
		})

		if (!roomUser) {
			res.status(403).json({
				success: false,
				message: "back-to-room.messages.not-in-room",
				status_code: 403
			})
			return
		}

		if (roomUser.team === null) {
			res.status(400).json({
				success: false,
				message: "back-to-room.messages.spectator-cannot-back",
				status_code: 400
			})
			return
		}

		markPostGameReady({
			roomId,
			gameId,
			userId: userIdNumber
		})

		await emitRoomUsersSnapshot(roomIdBigInt)

		res.status(200).json({
			success: true,
			message: "back-to-room.messages.success",
			status_code: 200
		})
	} catch (err) {
		console.error("Back to room error:", err)
		res.status(500).json({
			success: false,
			message: "back-to-room.messages.internal-server-error",
			status_code: 500
		})
	}
})

export default router
