import {
	Box,
	Chip,
	Table,
	TableBody,
	TableCell,
	TableContainer,
	TableHead,
	TableRow,
	Typography,
} from "@mui/material"
import parse from "html-react-parser"
import generalImg from "assets/general.png"
import advisorImg from "assets/advisor.png"
import elephantImg from "assets/elephant.png"
import chariotImg from "assets/chariot.png"	
import horseImg from "assets/horse.png"
import cannonImg from "assets/cannon.png"
import soldierImg from "assets/soldier.png"
import { TTypography } from "components/TranslationTag"
import { translate } from "locales/translate"
import "./Guide.scss"

export const Guide = () => {
	const pieceSymbols = [
		{ red: "將", black: "帥", name: translate("guide.piece.general"), count: 1 },
		{ red: "士", black: "仕", name: translate("guide.piece.advisor"), count: 2 },
		{ red: "象", black: "相", name: translate("guide.piece.elephant"), count: 2 },
		{ red: "馬", black: "傌", name: translate("guide.piece.horse"), count: 2 },
		{ red: "車", black: "俥", name: translate("guide.piece.chariot"), count: 2 },
		{ red: "砲", black: "炮", name: translate("guide.piece.cannon"), count: 2 },
		{ red: "卒", black: "兵", name: translate("guide.piece.soldier"), count: 5 }
	]

	return (
		<Box className="guide-popup">
			{/* Objective */}
			<TTypography variant="h5" className="section" content="guide.section.objective" />
			<Typography component="div">
				{parse(translate("guide.objective.paragraph1"))}
			</Typography>

			{/* Pieces */}
			<TTypography variant="h5" className="section" content="guide.section.pieces" />
			<Typography component="div">
				{parse(translate("guide.pieces.paragraph1"))}
			</Typography>
			<TableContainer className="piece-table">
				<Table border={1}>
					<TableHead>
						<TableRow className="table-header">
							<TableCell>{translate("guide.table.piece")}</TableCell>
							<TableCell>{translate("guide.table.symbol")}</TableCell>
							<TableCell>{translate("guide.table.quantity")}</TableCell>
						</TableRow>
					</TableHead>
					<TableBody>
						{pieceSymbols.map(piece => (
							<TableRow key={piece.name}>
								<TableCell>{piece.name}</TableCell>
								<TableCell>
									<Box className="piece-chip">
										<Chip
											label={piece.red}
											className="piece-red sample"
											title={piece.name}
										/>
										<Chip
											label={piece.black}
											className="piece-black sample"
											title={piece.name}
										/>
									</Box>
								</TableCell>
								<TableCell>{piece.count}</TableCell>
							</TableRow>
						))}
					</TableBody>
				</Table>
			</TableContainer>

			{/* Moving Pieces */}
			<TTypography variant="h5" className="section" content="guide.section.moving-pieces" />
			<Typography component="div">
				{parse(translate("guide.moving-pieces.paragraph1"))}
			</Typography>

			{/* General */}
			<TTypography variant="subtitle1" className="paragraph" content="guide.general.paragraph1" />
			<Typography component="div">
				{parse(translate("guide.general.paragraph2"))}
			</Typography>
			<Box component="img" src={generalImg} alt="General" className="image" />

			{/* Advisor */}
			<TTypography variant="subtitle1" className="paragraph" content="guide.advisor.paragraph1" />
			<Typography component="div">
				{parse(translate("guide.advisor.paragraph2"))}
			</Typography>
			<Box component="img" src={advisorImg} alt="Advisor" className="image" />

			{/* Elephant */}
			<TTypography variant="subtitle1" className="paragraph" content="guide.elephant.paragraph1" />
			<Typography component="div">
				{parse(translate("guide.elephant.paragraph2"))}
			</Typography>
			<Box component="img" src={elephantImg} alt="Elephant" className="image" />

			{/* Chariot */}
			<TTypography variant="subtitle1" className="paragraph" content="guide.chariot.paragraph1" />
			<Typography component="div">
				{parse(translate("guide.chariot.paragraph2"))}
			</Typography>
			<Box component="img" src={chariotImg} alt="Chariot" className="image" />

			{/* Horse */}
			<TTypography variant="subtitle1" className="paragraph" content="guide.horse.paragraph1" />
			<Typography component="div">
				{parse(translate("guide.horse.paragraph2"))}
			</Typography>
			<Box component="img" src={horseImg} alt="Horse" className="image" />

			<TTypography variant="subtitle1" className="paragraph" content="guide.cannon.paragraph1" />
			<Typography component="div">
				{parse(translate("guide.cannon.paragraph2"))}
			</Typography>
			<Box component="img" src={cannonImg} alt="Cannon" className="image" />

			{/* Soldier */}
			<TTypography variant="subtitle1" className="paragraph" content="guide.soldier.paragraph1" />
			<Typography component="div">
				{parse(translate("guide.soldier.paragraph2"))}
			</Typography>
			<Box component="img" src={soldierImg} alt="Soldier" className="image" />

			{/* Capturing */}
			<TTypography variant="h5" className="section" content="guide.section.capturing" />
			<Typography component="div" className="list-item">
				{parse(translate("guide.capturing.paragraph1"))}
			</Typography>
			<Typography component="div" className="list-item">
				{parse(translate("guide.capturing.paragraph2"))}
			</Typography>
			<Typography component="div" className="list-item">
				{parse(translate("guide.capturing.paragraph3"))}
			</Typography>

			{/* Check */}
			<TTypography variant="h5" className="section" content="guide.section.check" />
			<Typography component="div">
				{parse(translate("guide.check.paragraph1"))}
			</Typography>
			<Typography component="div">
				{parse(translate("guide.check.paragraph2"))}
			</Typography>
			<Typography component="div" className="list-item">
				{parse(translate("guide.check.paragraph3"))}
			</Typography>
			<Typography component="div" className="list-item">
				{parse(translate("guide.check.paragraph4"))}
			</Typography>
			<Typography component="div" className="list-item">
				{parse(translate("guide.check.paragraph5"))}
			</Typography>
			<Typography component="div" className="list-item">
				{parse(translate("guide.check.paragraph6"))}
			</Typography>

			{/* Result */}
			<TTypography variant="h5" className="section" content="guide.section.result" />
			<Typography component="div" className="list-item">
				{parse(translate("guide.result.paragraph1"))}
			</Typography>
			<Typography component="div" className="list-item">
				{parse(translate("guide.result.paragraph2"))}
			</Typography>
			<Typography component="div" className="list-item">
				{parse(translate("guide.result.paragraph3"))}
			</Typography>
			<Typography component="div" className="list-item">
				{parse(translate("guide.result.paragraph4"))}
			</Typography>
			<Typography component="div" className="list-item">
				{parse(translate("guide.result.paragraph5"))}
			</Typography>
		</Box>
	)
}
