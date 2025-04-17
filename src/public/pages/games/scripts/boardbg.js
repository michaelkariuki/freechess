// Draw a responsive chessboard background with square-like cells
(function() {
    const light = '#f6dfc0';
    const dark = '#b88767';
    const minSquares = 8;
    const canvas = document.getElementById('background-board');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    function resizeAndDraw() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        // Calculate columns and rows for square cells
        const aspect = canvas.width / canvas.height;
        let rows = minSquares;
        let cols = Math.round(rows * aspect);
        if (cols < minSquares) cols = minSquares;
        // Recalculate rows if height is much greater than width
        if (canvas.height > canvas.width) {
            cols = minSquares;
            rows = Math.round(cols / aspect);
            if (rows < minSquares) rows = minSquares;
        }
        const squareWidth = canvas.width / cols;
        const squareHeight = canvas.height / rows;

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        for (let y = 0; y < rows; y++) {
            for (let x = 0; x < cols; x++) {
                ctx.fillStyle = (x + y) % 2 === 0 ? light : dark;
                ctx.fillRect(x * squareWidth, y * squareHeight, squareWidth, squareHeight);
            }
        }
    }

    window.addEventListener('resize', resizeAndDraw);
    resizeAndDraw();
})(); 