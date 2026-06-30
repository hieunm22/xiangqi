import express, { Request, Response } from "express"
import swaggerUi from "swagger-ui-express"
import swaggerSpec from "./swagger"
import cors from "cors"
import cookieParser from "cookie-parser"

import getUsersRoutes from "./routes/auth/get-user"
import forgotPasswordRoutes from "./routes/auth/forgot-password"
import resetPasswordRoutes from "./routes/auth/reset-password"
import loginRoutes from "./routes/auth/login"
import logoutRoutes from "./routes/auth/logout"
import makeExpiredRoutes from "./routes/auth/make-expired"
import refreshTokenRoutes from "./routes/auth/refresh-token"
import registerRoutes from "./routes/auth/register"
import validateTokenRoutes from "./routes/auth/validate-token"

import searchUserRoutes from "./routes/user/search-user"

import createRoomRoutes from "./routes/room/create-room"
import fetchRoomsRoutes from "./routes/room/fetch-rooms"
import joinRoomRoutes from "./routes/room/join-room"
import kickUserRoutes from "./routes/room/kick-user"
import leaveRoomRoutes from "./routes/room/leave-room"
import loadRoomRoutes from "./routes/room/load-room"
import updateRoomRoutes from "./routes/room/update-room"

import changeTeamRoutes from "./routes/game/change-team"
import drawGameRoutes from "./routes/game/draw-game"
import getGameHistoryRoutes from "./routes/game/get-history"
import getOnlineRoutes from "./routes/game/get-online"
import movePieceRoutes from "./routes/game/move-piece"
import playerHistoryRoutes from "./routes/game/player-history"
import startGameRoutes from "./routes/game/start-game"
import surrenderGameRoutes from "./routes/game/surrender"
import undoRoutes from "./routes/game/undo"

import recalculatePointsRoutes from "./routes/tool/recalculate-points"
import resetGameRoutes from "./routes/tool/reset-game"
import sequenceRoutes from "./routes/tool/sequence"

import getAnnouncementRoutes from "./routes/message/get-announcement"
import getPrivateConversationsRoutes from "./routes/message/get-private-conversations"
import getPrivateMessageRoutes from "./routes/message/get-private"
import getRoomMessageRoutes from "./routes/message/get-room-message"
import markAnnouncementAsReadRoutes from "./routes/message/mark-announcement-as-read"
import markPrivateMessageAsReadRoutes from "./routes/message/mark-private-message-as-read"
import markRoomMessageAsReadRoutes from "./routes/message/mark-room-as-read"
import sendAnnouncementRoutes from "./routes/message/send-announcement"
import sendPrivateMessageRoutes from "./routes/message/send-private"
import sendRoomMessageRoutes from "./routes/message/send-room-message"
import unreadCountRoutes from "./routes/message/unread-count"

const app = express()

const rawOrigins = process.env.CORS_ORIGINS ?? "http://localhost:3004"
const allowedOrigins = rawOrigins.split(",").map(o => o.trim()).filter(Boolean)

// Allow Swagger UI (same host as the API server) to make requests
const port = process.env.PORT ?? "8000"
const swaggerOrigin = `http://localhost:${port}`
if (!allowedOrigins.includes(swaggerOrigin)) {
	allowedOrigins.push(swaggerOrigin)
}

app.use(
	cors({
		origin: (requestOrigin, callback) => {
			// Allow server-to-server calls (no origin) or whitelisted origins
			if (!requestOrigin || allowedOrigins.includes(requestOrigin)) {
				callback(null, requestOrigin || true)
			} else {
				callback(new Error(`CORS: origin '${requestOrigin}' is not allowed`))
			}
		},
		credentials: true,
	})
)
app.use(express.json())
app.use(cookieParser())

app.get("/", (_req: Request, res: Response) => {
	res.redirect("/docs")
})

app.use("/api", getUsersRoutes)
app.use("/api", forgotPasswordRoutes)
app.use("/api", resetPasswordRoutes)
app.use("/api", loginRoutes)
app.use("/api", logoutRoutes)
app.use("/api", makeExpiredRoutes)
app.use("/api", registerRoutes)
app.use("/api", validateTokenRoutes)
app.use("/api", refreshTokenRoutes)

app.use("/api", searchUserRoutes)

app.use("/api", createRoomRoutes)
app.use("/api", fetchRoomsRoutes)
app.use("/api", getGameHistoryRoutes)
app.use("/api", joinRoomRoutes)
app.use("/api", kickUserRoutes)
app.use("/api", leaveRoomRoutes)
app.use("/api", loadRoomRoutes)
app.use("/api", updateRoomRoutes)

app.use("/api", changeTeamRoutes)
app.use("/api", drawGameRoutes)
app.use("/api", getOnlineRoutes)
app.use("/api", movePieceRoutes)
app.use("/api", playerHistoryRoutes)
app.use("/api", startGameRoutes)
app.use("/api", surrenderGameRoutes)
app.use("/api", undoRoutes)

app.use("/api", recalculatePointsRoutes)
app.use("/api", resetGameRoutes)
app.use("/api", sequenceRoutes)

app.use("/api", getAnnouncementRoutes)
app.use("/api", getPrivateConversationsRoutes)
app.use("/api", getPrivateMessageRoutes)
app.use("/api", getRoomMessageRoutes)
app.use("/api", markAnnouncementAsReadRoutes)
app.use("/api", markRoomMessageAsReadRoutes)
app.use("/api", markPrivateMessageAsReadRoutes)
app.use("/api", sendAnnouncementRoutes)
app.use("/api", sendPrivateMessageRoutes)
app.use("/api", sendRoomMessageRoutes)
app.use("/api", unreadCountRoutes)

app.use("/docs", swaggerUi.serve)
app.get("/docs", swaggerUi.setup(swaggerSpec, {
	swaggerOptions: {
		persistAuthorization: true
	}
}))

export default app
