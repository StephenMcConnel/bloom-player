var kCellsInEachDimension = 10;

var frameCount;
var minDimension;
var grid;
var snake;
var canvas;
var context;
var apple;
var startX;
var startY;
var running;

// When our page is not the selected one, the bloom-player calls this.
// We need to connect any listeners, start animation, etc. It's important
// to think about what you want reset, too, in case the user is either
// coming back to this page, or going to another instance of this activity
// in a subsequent page.
export function start() {
    //alert("start(snake)");
    running = true;
    frameCount = 0;
    canvas = document.getElementById("game");
    minDimension = Math.min(canvas.width, canvas.height);
    grid = minDimension / kCellsInEachDimension; // 16;
    context = canvas.getContext("2d");
    startX = 0;
    startY = 0;

    snake = {
        x: 160,
        y: 160,
        dx: grid,
        dy: 0,
        cells: [],
        maxCells: 4
    };

    apple = {
        x: grid * 3,
        y: grid * 3
    };

    document.addEventListener("touchstart", handleTouchStart);
    document.addEventListener("touchmove", handleTouchMove);
    document.addEventListener("touchend", handleTouchEnd);
    document.addEventListener("keydown", handleKeydown);

    requestAnimationFrame(loop);
}

// When our page is not the selected one, the bloom-player calls this.
// We need to disconnect any listeners.
export function stop() {
    running = false;
    document.removeEventListener("touchstart", handleTouchStart);
    document.removeEventListener("touchmove", handleTouchMove);
    document.removeEventListener("touchend", handleTouchEnd);
    document.removeEventListener("keydown", handleKeydown);
}

function handleKeydown(e) {
    // prevent snake from backtracking on itself
    if (e.which === 37 && snake.dx === 0) {
        snake.dx = -grid;
        snake.dy = 0;
    } else if (e.which === 38 && snake.dy === 0) {
        snake.dy = -grid;
        snake.dx = 0;
    } else if (e.which === 39 && snake.dx === 0) {
        snake.dx = grid;
        snake.dy = 0;
    } else if (e.which === 40 && snake.dy === 0) {
        snake.dy = grid;
        snake.dx = 0;
    }
}

function handleTouchEnd(e) {
    var touch = e.changedTouches[0];
    distX = touch.pageX - startX;
    distY = touch.pageY - startY;
    if (Math.abs(distX) > Math.abs(distY)) {
        if (distX > 0 && snake.dx === 0) {
            snake.dx = grid;
            snake.dy = 0;
        } else if (distX < 0 && snake.dx === 0) {
            snake.dx = -grid;
            snake.dy = 0;
        }
    } else {
        if (distY > 0 && snake.dy === 0) {
            snake.dy = grid;
            snake.dx = 0;
        } else if (distY < 0 && snake.dy === 0) {
            snake.dy = -grid;
            snake.dx = 0;
        }
    }
    e.preventDefault();
}

function handleTouchMove(e) {
    e.preventDefault();
}

function handleTouchStart(e) {
    var touch = e.changedTouches[0];
    startX = touch.pageX;
    startY = touch.pageY;
    startTime = new Date().getTime();
    e.preventDefault();
}

function getRandomInt(min, max) {
    return Math.floor(Math.random() * (max - min)) + min;
}

// game loop
function loop() {
    if (running) {
        requestAnimationFrame(loop);
    }

    // slow game loop to 15 fps instead of 60 - 60/15 = 4
    if (++frameCount < 8) {
        return;
    }

    frameCount = 0;
    context.clearRect(0, 0, canvas.width, canvas.height);

    snake.x += snake.dx;
    snake.y += snake.dy;

    // wrap snake position on edge of screen
    if (snake.x < 0) {
        snake.x = canvas.width - grid;
    } else if (snake.x >= canvas.width) {
        snake.x = 0;
    }

    if (snake.y < 0) {
        snake.y = canvas.height - grid;
    } else if (snake.y >= canvas.height) {
        snake.y = 0;
    }

    // keep track of where snake has been. front of the array is always the head
    snake.cells.unshift({ x: snake.x, y: snake.y });

    // remove cells as we move away from them
    if (snake.cells.length > snake.maxCells) {
        snake.cells.pop();
    }

    // draw apple
    context.fillStyle = "red";
    context.fillRect(apple.x, apple.y, grid - 1, grid - 1);

    // draw snake
    context.fillStyle = "green";
    snake.cells.forEach(function(cell, index) {
        context.fillRect(cell.x, cell.y, grid - 1, grid - 1);

        // snake ate apple
        if (cell.x === apple.x && cell.y === apple.y) {
            snake.maxCells++;

            apple.x = getRandomInt(0, kCellsInEachDimension - 1) * grid;
            apple.y = getRandomInt(0, kCellsInEachDimension - 1) * grid;
        }

        // check collision with all cells after this one (modified bubble sort)
        for (var i = index + 1; i < snake.cells.length; i++) {
            // collision. reset game
            if (cell.x === snake.cells[i].x && cell.y === snake.cells[i].y) {
                snake.x = grid * 10;
                snake.y = grid * 10;
                snake.cells = [];
                snake.maxCells = 4;
                snake.dx = grid;
                snake.dy = 0;

                apple.x = getRandomInt(0, kCellsInEachDimension - 1) * grid;
                apple.y = getRandomInt(0, kCellsInEachDimension - 1) * grid;
            }
        }
    });
}
