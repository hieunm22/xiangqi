/**
 * Piece code conversion between this project's FEN dialect and standard xiangqi FEN
 * (the one fairy-stockfish understands).
 *
 * Project FEN:   lowercase = red, uppercase = black.
 *                Pieces: r,h,e,a,g,c,s (chariot, horse, elephant, advisor, general, cannon, soldier).
 *
 * Standard FEN:  uppercase = red, lowercase = black.
 *                Pieces: r,n,b,a,k,c,p (rook, knight, bishop, advisor, king, cannon, pawn).
 */

const projectToStandardLetter: Record<string, string> = {
	r: "r",
	h: "n",
	e: "b",
	a: "a",
	g: "k",
	c: "c",
	s: "p"
}

const standardToProjectLetter: Record<string, string> = {
	r: "r",
	n: "h",
	b: "e",
	a: "a",
	k: "g",
	c: "c",
	p: "s"
}

export const projectPieceToStandard = (projectChar: string): string => {
	const lower = projectChar.toLowerCase()
	const standardLetter = projectToStandardLetter[lower]
	if (!standardLetter) {
		throw new Error(`Unknown project piece char: '${projectChar}'`)
	}
	// Project lowercase = red → standard uppercase = red
	const isRed = projectChar === lower
	return isRed ? standardLetter.toUpperCase() : standardLetter
}

export const standardPieceToProject = (standardChar: string): string => {
	const lower = standardChar.toLowerCase()
	const projectLetter = standardToProjectLetter[lower]
	if (!projectLetter) {
		throw new Error(`Unknown standard piece char: '${standardChar}'`)
	}
	// Standard uppercase = red → project lowercase = red
	const isRed = standardChar !== lower
	return isRed ? projectLetter.toLowerCase() : projectLetter.toUpperCase()
}
