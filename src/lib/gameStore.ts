import fs from "fs";
import path from "path";
import pgnParser from "pgn-parser";

export interface StoredGame {
    id: number;
    white: string;
    black: string;
    result: string;
    date: string;
    pgn: string;
}

const PGN_PATH = path.resolve("data/chess_com_games_2025-04-17.pgn");
let games: StoredGame[] = [];

function reconstructPGN(game: any): string {
    // Safely handle headers and moves
    const headers = (game.headers ?? [])
        .map((h: any) => `[${h.name} "${h.value}"]`)
        .join("\n");
    const moves = (game.moves ?? [])
        .map((m: any) => m.move)
        .join(" ");
    const result = (game.headers ?? []).find((h: any) => h.name === "Result")?.value || "*";
    return `${headers}\n\n${moves} ${result}`.trim();
}

function loadGames() {
    try {
        const pgnText = fs.readFileSync(PGN_PATH, "utf8");
        const parsed = pgnParser.parse(pgnText);
        games = parsed.map((game: any, idx: number) => {
            const headers = game.headers ?? [];
            return {
                id: idx,
                white: headers.find((h: any) => h.name === "White")?.value || "White",
                black: headers.find((h: any) => h.name === "Black")?.value || "Black",
                result: headers.find((h: any) => h.name === "Result")?.value || "*",
                date: headers.find((h: any) => h.name === "Date")?.value || "",
                pgn: reconstructPGN(game)
            };
        });
        console.log(`[gameStore] Loaded ${games.length} games from PGN.`);
    } catch (err) {
        console.error(`[gameStore] Failed to load PGN file:`, err);
        games = [];
    }
}

export function getAllGamesMeta() {
    return games.map(({ id, white, black, result, date }) => ({ id, white, black, result, date }));
}

export function getGameById(id: number): StoredGame | undefined {
    return games.find(g => g.id === id);
}

// Load games on module import
loadGames(); 