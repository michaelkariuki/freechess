document.addEventListener("DOMContentLoaded", async () => {
    const gamesList = document.getElementById("games-list");
    gamesList.innerHTML = "Loading games...";

    try {
        const res = await fetch("/api/games");
        const data = await res.json();
        if (!data.games || data.games.length === 0) {
            gamesList.innerHTML = "No games found.";
            return;
        }
        gamesList.innerHTML = "";
        data.games.forEach(game => {
            const div = document.createElement("div");
            div.className = "game-listing";
            div.innerHTML = `
                <b>${game.white} vs ${game.black}</b>
                <span>${game.date} | ${game.result}</span>
            `;
            div.onclick = () => {
                window.location.href = `/?game=${game.id}`;
            };
            gamesList.appendChild(div);
        });
    } catch (e) {
        gamesList.innerHTML = "Failed to load games.";
    }
}); 