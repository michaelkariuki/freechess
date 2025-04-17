const ctx = $<HTMLCanvasElement>("#board").get(0)!.getContext("2d")!;

const BOARD_SIZE = 1280;

const startingPositionFen = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

const classificationColours: {[key: string]: string} = {
    "brilliant": "#1baaa6",
    "great": "#5b8baf",
    "best": "#98bc49",
    "excellent": "#98bc49",
    "good": "#97af8b",
    "inaccuracy": "#f4bf44",
    "mistake": "#e28c28",
    "blunder": "#c93230",
    "forced": "#97af8b",
    "book": "#a88764"
};

let currentMoveIndex = 0;

let boardFlipped = false;

let lastEvaluation = {
    type: "cp",
    value: 0
};

let whitePlayer: Profile = {
    username: "White Player",
    rating: "?"
};
let blackPlayer: Profile = {
    username: "Black Player",
    rating: "?"
};

// Add fast-forward highlights feature
let fastForwarding = false;
let fastForwardInterval: number | null = null;

// Add dynamic highlight index set and helpers
let dynamicHighlightSet: Set<number> = new Set();

function selectCount(len: number): number {
    return Math.max(1, Math.floor(len * 0.5));
}

function computeDynamicHighlights() {
    dynamicHighlightSet.clear();
    if (!reportResults) return;
    const positions = reportResults.positions;
    const bestList: {idx:number; magnitude:number;}[] = [];
    const inaccuracyList: {idx:number; magnitude:number;}[] = [];
    const mistakeList: {idx:number; magnitude:number;}[] = [];
    for (let i = 1; i < positions.length; i++) {
        const pos = positions[i];
        const prevEval = positions[i - 1].topLines?.find(line => line.id == 1)?.evaluation?.value ?? 0;
        const currEval = pos.topLines?.find(line => line.id == 1)?.evaluation?.value ?? 0;
        const magnitude = Math.abs(currEval - prevEval);
        switch (pos.classification) {
            case "best": bestList.push({idx:i, magnitude}); break;
            case "inaccuracy": inaccuracyList.push({idx:i, magnitude}); break;
            case "mistake":
            case "blunder": mistakeList.push({idx:i, magnitude}); break;
            case "great":
            case "brilliant": dynamicHighlightSet.add(i); break;
        }
    }
    bestList.sort((a,b) => b.magnitude - a.magnitude);
    inaccuracyList.sort((a,b) => b.magnitude - a.magnitude);
    mistakeList.sort((a,b) => b.magnitude - a.magnitude);
    for (let j = 0; j < selectCount(bestList.length); j++) dynamicHighlightSet.add(bestList[j].idx);
    for (let j = 0; j < selectCount(inaccuracyList.length); j++) dynamicHighlightSet.add(inaccuracyList[j].idx);
    for (let j = 0; j < selectCount(mistakeList.length); j++) dynamicHighlightSet.add(mistakeList[j].idx);
    // Always include the final move of the game
    dynamicHighlightSet.add(positions.length - 1);
}

// Inject CSS for highlights button
;(function() {
    const style = document.createElement("style");
    style.innerHTML = `
    #highlights-button {
        transition: transform 0.5s ease-in-out;
        cursor: pointer;
    }
    #highlights-button:hover {
        transform: rotate(360deg);
    }
    `;
    document.head.appendChild(style);
})();

// Create highlights button in toolbar
;(function() {
    const btn = $("<i>")
        .attr("id", "highlights-button")
        .addClass("fa-solid fa-star")
        .css("color", "#ffffff")
        .attr("data-tooltip", "Highlights");
    $("#back-move-button").after(btn);
    btn.on("click", () => {
        if (fastForwarding) {
            fastForwarding = false;
            if (fastForwardInterval) {
                clearInterval(fastForwardInterval);
                fastForwardInterval = null;
            }
            return;
        }
        fastForwarding = true;
        // prepare dynamic highlights based on engine evaluation differences
        computeDynamicHighlights();
        fastForwardInterval = window.setInterval(async () => {
            if (!reportResults) return;
            // wait for animation and board update
            await traverseMoves(1);
            // only highlight moves in our dynamic set
            if (dynamicHighlightSet.has(currentMoveIndex)) {
                // stop fast-forwarding on highlight
                fastForwarding = false;
                if (fastForwardInterval) {
                    clearInterval(fastForwardInterval);
                    fastForwardInterval = null;
                }
                // show classification dialog and popover at highlight after animation
                updateClassificationMessage(reportResults.positions[currentMoveIndex - 1], reportResults.positions[currentMoveIndex]);
                renderFloatingChatIcons();
            }
        }, 300);
    });
})();

function getBoardCoordinates(square: string): Coordinate {
    if (boardFlipped) {
        return {
            x: 7 - "abcdefgh".split("").indexOf(square.slice(0, 1)),
            y: parseInt(square.slice(1)) - 1
        }
    } else {
        return {
            x: "abcdefgh".split("").indexOf(square.slice(0, 1)),
            y: 8 - parseInt(square.slice(1))
        }
    }
}

function drawArrow(fromX: number, fromY: number, toX: number, toY: number, width: number) {
    let arrowCtx = $<HTMLCanvasElement>("<canvas>").get(0)?.getContext("2d");
    if (!arrowCtx) return;

    arrowCtx.canvas.width = 1280;
    arrowCtx.canvas.height = 1280;

    let headlen = 15;
    let angle = Math.atan2(toY - fromY, toX - fromX);
    toX -= Math.cos(angle) * ((width * 1.15));
    toY -= Math.sin(angle) * ((width * 1.15));
    
    arrowCtx.beginPath();
    arrowCtx.moveTo(fromX, fromY);
    arrowCtx.lineTo(toX, toY);
    arrowCtx.strokeStyle = classificationColours.best;
    arrowCtx.lineWidth = width;
    arrowCtx.stroke();
    
    arrowCtx.beginPath();
    arrowCtx.moveTo(toX, toY);
    arrowCtx.lineTo(toX - headlen * Math.cos(angle - Math.PI / 7), toY - headlen * Math.sin(angle - Math.PI / 7));
    
    arrowCtx.lineTo(toX - headlen * Math.cos(angle + Math.PI / 7), toY - headlen * Math.sin(angle + Math.PI / 7));
    
    arrowCtx.lineTo(toX, toY);
    arrowCtx.lineTo(toX - headlen * Math.cos(angle - Math.PI / 7),toY - headlen * Math.sin(angle - Math.PI / 7));

    arrowCtx.strokeStyle = classificationColours.best;
    arrowCtx.lineWidth = width;
    arrowCtx.stroke();
    arrowCtx.fillStyle = classificationColours.best;
    arrowCtx.fill();

    return arrowCtx.canvas;
}

async function drawBoard(fen: string) {
    // Draw surface of board
    let colours = ["#f6dfc0", "#b88767"];

    for (let y = 0; y < 8; y++) {
        for (let x = 0; x < 8; x++) {
            ctx.fillStyle = colours[(x + y) % 2];

            ctx.fillRect(
                x * (BOARD_SIZE / 8), 
                y * (BOARD_SIZE / 8), 
                (BOARD_SIZE / 8), 
                (BOARD_SIZE / 8)
            );
        }
    }

    // Draw coordinates
    ctx.font = "24px Arial";
    
    let files = "abcdefgh".split("");
    for (let x = 0; x < 8; x++) {
        ctx.fillStyle = colours[x % 2];
        ctx.fillText(boardFlipped ? files[7 - x] : files[x], x * (BOARD_SIZE / 8) + 5, BOARD_SIZE - 5);
    }
    for (let y = 0; y < 8; y++) {
        ctx.fillStyle = colours[(y + 1) % 2];
        ctx.fillText(boardFlipped ? (y + 1).toString() : (8 - y).toString(), 5, y * (BOARD_SIZE / 8) + 24);
    }

    // Draw last move highlight
    let lastMove = reportResults?.positions[currentMoveIndex];
    
    let lastMoveCoordinates = {
        from: { x: 0, y: 0 },
        to: { x: 0, y: 0 }
    };

    if (currentMoveIndex > 0 && lastMove) {
        let lastMoveUCI = lastMove.move?.uci;
        if (!lastMoveUCI) return;

        lastMoveCoordinates.from = getBoardCoordinates(lastMoveUCI.slice(0, 2));
        lastMoveCoordinates.to = getBoardCoordinates(lastMoveUCI.slice(2, 4));

        ctx.globalAlpha = 0.7;
        ctx.fillStyle = classificationColours[reportResults?.positions[currentMoveIndex].classification ?? "book"];
        ctx.fillRect(
            lastMoveCoordinates.from.x * (BOARD_SIZE / 8), 
            lastMoveCoordinates.from.y * (BOARD_SIZE / 8), 
            (BOARD_SIZE / 8),
            (BOARD_SIZE / 8)
        );
        ctx.fillRect(
            lastMoveCoordinates.to.x * (BOARD_SIZE / 8), 
            lastMoveCoordinates.to.y * (BOARD_SIZE / 8), 
            (BOARD_SIZE / 8),
            (BOARD_SIZE / 8)
        );
        ctx.globalAlpha = 1;
    }

    // Draw pieces
    let fenBoard = fen.split(" ")[0];
    let x = boardFlipped ? 7 : 0, y = x;
    
    for (let character of fenBoard) {
        if (character == "/") {
            x = boardFlipped ? 7 : 0;
            y += boardFlipped ? -1 : 1;
        } else if (/\d/g.test(character)) {
            x += parseInt(character) * (boardFlipped ? -1 : 1);
        } else {
            ctx.drawImage(
                pieceImages[character], x * (BOARD_SIZE / 8),
                y * (BOARD_SIZE / 8),
                (BOARD_SIZE / 8),
                (BOARD_SIZE / 8)
            );
            x += boardFlipped ? -1 : 1;
        }
    }

    // Draw last move classification
    if (currentMoveIndex > 0 && reportResults) {
        let classification = reportResults?.positions[currentMoveIndex]?.classification;

        if (!classification) return;
        ctx.drawImage(
            classificationIcons[classification]!,
            lastMoveCoordinates.to.x * (BOARD_SIZE / 8) + ((68 / 90) * (BOARD_SIZE / 8)), 
            lastMoveCoordinates.to.y * (BOARD_SIZE / 8) - ((10 / 90) * (BOARD_SIZE / 8)), 
            56, 56
        );
    }

    // Draw engine suggestion arrows
    if ($<HTMLInputElement>("#suggestion-arrows-setting").get(0)?.checked) {
        let arrowAttributes = [
            {
                width: 35,
                opacity: 0.8
            },
            {
                width: 21,
                opacity: 0.55
            }
        ];
        
        let topLineIndex = -1;
        for (let topLine of lastMove?.topLines ?? []) {
            topLineIndex++;
    
            let from = getBoardCoordinates(topLine.moveUCI.slice(0, 2));
            let to = getBoardCoordinates(topLine.moveUCI.slice(2, 4));
    
            let arrow = drawArrow(
                from.x * (BOARD_SIZE / 8) + (BOARD_SIZE / 16), 
                from.y * (BOARD_SIZE / 8) + (BOARD_SIZE / 16), 
                to.x * (BOARD_SIZE / 8) + (BOARD_SIZE / 16), 
                to.y * (BOARD_SIZE / 8) + (BOARD_SIZE / 16), 
                arrowAttributes[topLineIndex].width
            );
            if (!arrow) continue;
    
            ctx.globalAlpha = arrowAttributes[topLineIndex].opacity;
            ctx.drawImage(arrow, 0, 0);
            ctx.globalAlpha = 1;
        }
    }

    renderFloatingChatIcons();
}

function renderFloatingChatIcons() {
    // Suppress popovers during fast-forward
    if (fastForwarding) {
        const popover = document.getElementById("chat-popover");
        if (popover) popover.style.display = "none";
        return;
    }
    // Automatically display analysis popover anchored to classification icon
    const popover = document.getElementById("chat-popover");
    const board = document.getElementById("board");
    if (!popover || !board || !reportResults || currentMoveIndex === 0) return;
    // Clear any overlay icons
    const overlay = document.getElementById("board-overlay");
    if (overlay) {
        overlay.innerHTML = "";
        overlay.style.pointerEvents = "none";
    }
    const pos = reportResults.positions[currentMoveIndex];
    if (!pos.move) return;
    const move = pos.move!;
    const classification = pos.classification;
    if (!classification) return;
    // Compute destination square coordinates
    const to = move.uci.slice(2, 4);
    const coord = getBoardCoordinates(to);
    // Get board size and square dimensions
    const boardRect = board.getBoundingClientRect();
    const squareSizeX = boardRect.width / 8;
    const squareSizeY = boardRect.height / 8;
    // Calculate classification icon offsets and size
    const classOffsetX = (68 / 90) * squareSizeX;
    const classOffsetY = (-10 / 90) * squareSizeY;
    const classIconScale = 56 / (BOARD_SIZE / 8);
    const classIconWidth = classIconScale * squareSizeX;
    const classIconHeight = classIconScale * squareSizeY;
    // Determine anchor position in viewport space
    const anchorX = boardRect.left + coord.x * squareSizeX + classOffsetX + classIconWidth;
    const anchorY = boardRect.top + coord.y * squareSizeY + classOffsetY;
    // Compute analysis text directly to stay in sync
    const classificationMessages: { [key: string]: string } = {
        "great": "a great move",
        "good": "an okay move",
        "inaccuracy": "an inaccuracy",
        "mistake": "a mistake",
        "blunder": "a blunder",
        "book": "theory"
    };
    const messageDesc = classificationMessages[classification] ?? classification;
    popover.innerHTML = `${move.san} is ${messageDesc}`;
    // Style the popover for visibility
    popover.style.backgroundColor = "#fff";
    popover.style.color = "#000";
    popover.style.border = "1px solid #ccc";
    popover.style.borderRadius = "8px";
    popover.style.padding = "8px";
    popover.style.boxShadow = "0 2px 12px rgba(0,0,0,0.18)";
    popover.style.zIndex = "200";
    // Position popover right next to classification icon and center vertically
    const margin = 2; // minimal gap
    popover.style.position = "fixed";
    popover.style.display = "block";
    // After display, measure popover height to center
    const popHeight = popover.offsetHeight;
    const topPosition = anchorY + classIconHeight / 2 - popHeight / 2;
    popover.style.left = `${anchorX + margin}px`;
    popover.style.top = `${topPosition}px`;
}

function updateBoardPlayers() {
    // Get profiles depending on board orientation
    let bottomPlayerProfile = boardFlipped ? blackPlayer : whitePlayer;
    let topPlayerProfile = boardFlipped ? whitePlayer : blackPlayer;

    // Remove <> characters to prevent XSS
    topPlayerProfile.username = topPlayerProfile.username.replace(/[<>]/g, "");
    topPlayerProfile.rating = topPlayerProfile.rating.replace(/[<>]/g, "");

    bottomPlayerProfile.username = bottomPlayerProfile.username.replace(/[<>]/g, "");
    bottomPlayerProfile.rating = bottomPlayerProfile.rating.replace(/[<>]/g, "");

    // Apply profiles to board
    $("#top-player-profile").html(`${topPlayerProfile.username} (${topPlayerProfile.rating})`);
    $("#bottom-player-profile").html(`${bottomPlayerProfile.username} (${bottomPlayerProfile.rating})`);
}

// Add helper to parse FEN into a 2D board array
function parseFenToBoard(fen: string): (string|null)[][] {
    const rows = fen.split(' ')[0].split('/');
    const board: (string|null)[][] = [];
    for (let r = 0; r < 8; r++) {
        const row: (string|null)[] = [];
        const fenRow = rows[r];
        for (let char of fenRow) {
            if (/\d/.test(char)) {
                const emptyCount = parseInt(char, 10);
                for (let i = 0; i < emptyCount; i++) row.push(null);
            } else {
                row.push(char);
            }
        }
        board.push(row);
    }
    return board;
}

// Add function to draw static board (squares, coordinates, and pieces, optionally skipping one square)
function drawStaticBoard(fen: string, excludeSquare?: string) {
    const colours = ["#f6dfc0", "#b88767"];
    // Draw squares
    for (let y = 0; y < 8; y++) {
        for (let x = 0; x < 8; x++) {
            ctx.fillStyle = colours[(x + y) % 2];
            ctx.fillRect(x * (BOARD_SIZE / 8), y * (BOARD_SIZE / 8), BOARD_SIZE / 8, BOARD_SIZE / 8);
        }
    }
    // Draw coordinates
    ctx.font = "24px Arial";
    const files = "abcdefgh".split("");
    for (let x = 0; x < 8; x++) {
        ctx.fillStyle = colours[x % 2];
        ctx.fillText(boardFlipped ? files[7 - x] : files[x], x * (BOARD_SIZE / 8) + 5, BOARD_SIZE - 5);
    }
    for (let y = 0; y < 8; y++) {
        ctx.fillStyle = colours[(y + 1) % 2];
        ctx.fillText(boardFlipped ? (y + 1).toString() : (8 - y).toString(), 5, y * (BOARD_SIZE / 8) + 24);
    }
    // Draw pieces
    const boardArray = parseFenToBoard(fen);
    for (let rank = 0; rank < 8; rank++) {
        for (let file = 0; file < 8; file++) {
            const piece = boardArray[rank][file];
            if (!piece) continue;
            const square = `${"abcdefgh"[file]}${8 - rank}`;
            if (excludeSquare === square) continue;
            const coord = getBoardCoordinates(square);
            ctx.drawImage(pieceImages[piece], coord.x * (BOARD_SIZE / 8), coord.y * (BOARD_SIZE / 8), BOARD_SIZE / 8, BOARD_SIZE / 8);
        }
    }
}

// Add function to animate a single piece moving between squares
async function animatePieceMove(prevFen: string, newFen: string, moveUci: string) {
    const [fromSq, toSq] = [moveUci.slice(0,2), moveUci.slice(2,4)];
    const boardArray = parseFenToBoard(prevFen);
    const fileIdx = fromSq.charCodeAt(0) - 'a'.charCodeAt(0);
    const rankIdx = 8 - parseInt(fromSq[1], 10);
    const piece = boardArray[rankIdx][fileIdx];
    if (!piece) {
        drawBoard(newFen);
        return;
    }
    const fromCoord = getBoardCoordinates(fromSq);
    const toCoord = getBoardCoordinates(toSq);
    const fromPx = { x: fromCoord.x * (BOARD_SIZE / 8), y: fromCoord.y * (BOARD_SIZE / 8) };
    const toPx = { x: toCoord.x * (BOARD_SIZE / 8), y: toCoord.y * (BOARD_SIZE / 8) };
    const duration = 300;
    const frameCount = 10;
    const frameTime = duration / frameCount;
    for (let frame = 0; frame <= frameCount; frame++) {
        const t = frame / frameCount;
        const currentX = fromPx.x + (toPx.x - fromPx.x) * t;
        const currentY = fromPx.y + (toPx.y - fromPx.y) * t;
        drawStaticBoard(prevFen, fromSq);
        ctx.drawImage(pieceImages[piece], currentX, currentY, BOARD_SIZE / 8, BOARD_SIZE / 8);
        await new Promise(r => setTimeout(r, frameTime));
    }
    drawBoard(newFen);
}

// Replace traverseMoves with async version to include animation
async function traverseMoves(moveCount: number) {
    if (ongoingEvaluation || !reportResults) return;
    const positions = reportResults.positions;
    const prevIndex = currentMoveIndex;
    currentMoveIndex = Math.max(
        Math.min(currentMoveIndex + moveCount, positions.length - 1),
        0
    );
    const prevPos = positions[prevIndex];
    const currPos = positions[currentMoveIndex];
    const currFen = currPos?.fen ?? startingPositionFen;
    const prevFen = prevPos?.fen ?? startingPositionFen;
    if (prevIndex !== currentMoveIndex && currPos.move?.uci) {
        await animatePieceMove(prevFen, currFen, currPos.move.uci);
    } else {
        drawBoard(currFen);
    }
    const topLine = currPos?.topLines?.find(line => line.id == 1);
    lastEvaluation = topLine?.evaluation ?? { type: "cp", value: 0 };
    const movedPlayer = getMovedPlayer();
    drawEvaluationBar(lastEvaluation, boardFlipped, movedPlayer);
    drawEvaluationGraph();
    if (!fastForwarding) {
        updateClassificationMessage(prevPos, currPos);
    } else {
        $("#classification-message-container").css("display", "none");
        $("#top-alternative-message").css("display", "none");
    }
    updateEngineSuggestions(currPos.topLines ?? []);
    if (currPos.opening) {
        $("#opening-name").html(currPos.opening);
    }
    // Do not play board audio if trying to traverse outside of game
    if (
        (prevIndex == 0 && moveCount < 0) 
        || (prevIndex == positions.length - 1 && moveCount > 0)
    ) return;
    // Stop all playing board audio
    for (const el of $(".sound-fx-board").get()) {
        const boardSound = el as HTMLAudioElement;
        boardSound.pause();
        boardSound.currentTime = 0;
    }
    // Play new audio based on move type
    let moveSAN = positions[currentMoveIndex + (moveCount == -1 ? 1 : 0)].move?.san ?? "";
    if (moveSAN.endsWith("#")) {
        const checkAudio = $("#sound-fx-check").get(0) as HTMLAudioElement | undefined;
        const endAudio = $("#sound-fx-game-end").get(0) as HTMLAudioElement | undefined;
        checkAudio?.play();
        endAudio?.play();
    } else if (moveSAN.endsWith("+")) {
        const checkAudio = $("#sound-fx-check").get(0) as HTMLAudioElement | undefined;
        checkAudio?.play();
    } else if (/=[QRBN]/g.test(moveSAN)) {
        const promoAudio = $("#sound-fx-promote").get(0) as HTMLAudioElement | undefined;
        promoAudio?.play();
    } else if (moveSAN.includes("O-O")) {
        const castleAudio = $("#sound-fx-castle").get(0) as HTMLAudioElement | undefined;
        castleAudio?.play();
    } else if (moveSAN.includes("x")) {
        const captureAudio = $("#sound-fx-capture").get(0) as HTMLAudioElement | undefined;
        captureAudio?.play();
    } else {
        const moveAudio = $("#sound-fx-move").get(0) as HTMLAudioElement | undefined;
        moveAudio?.play();
    }
}

function getMovedPlayer() {
    return (currentMoveIndex % 2) === 0 ? "black" : "white";
 }

$("#back-start-move-button").on("click", () => {
    traverseMoves(-Infinity);
});

$("#back-move-button").on("click", () => {
    traverseMoves(-1);
});

$("#next-move-button").on("click", () => {
    traverseMoves(1);
});

$("#go-end-move-button").on("click", () => {
    traverseMoves(Infinity);
});

$(window).on("keydown", (event) => {
    let key = event.key;

    switch (key) {
        case "ArrowDown":
            traverseMoves(-Infinity);
            break;
        case "ArrowLeft":
            traverseMoves(-1);
            break;
        case "ArrowRight":
            traverseMoves(1);
            break;
        case "ArrowUp":
            traverseMoves(Infinity);
            break;
    }
});

$("#board").on("click", event => {
    let boardBoundingBox = $<HTMLCanvasElement>("#board").get(0)?.getBoundingClientRect();
    if (!boardBoundingBox) return;

    traverseMoves(event.clientX > boardBoundingBox.left + boardBoundingBox.width / 2 ? 1 : -1);
});

$("#flip-board-button").on("click", () => {
    boardFlipped = !boardFlipped;
    
    const movedPlayer = getMovedPlayer();

    drawEvaluationBar(lastEvaluation, boardFlipped, movedPlayer);
    drawEvaluationGraph();
    drawBoard(reportResults?.positions[currentMoveIndex]?.fen ?? startingPositionFen); 
    updateBoardPlayers();
});

$("#suggestion-arrows-setting").on("input", () => {
    drawBoard(reportResults?.positions[currentMoveIndex]?.fen ?? startingPositionFen); 
});

Promise.all(pieceLoaders).then(() => {
    drawBoard(startingPositionFen);
    drawEvaluationBar(lastEvaluation, boardFlipped, "black");
});