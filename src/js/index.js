var x = 0, y = 0;

var map = {};
onkeydown = onkeyup = (e) => {
    e = e || event;
    map[e.keyCode] = e.type == 'keydown';
}

window.addEventListener('load', (event) => {
    setInterval(() => {
        checkkey();
    }, 25)
    console.log("Loaded!");
});

function checkkey() {
    if (map[87] == true || map[38] == true) {
        moveHero(1, 0);
    }
    if (map[65] == true || map[37] == true) {
        moveHero(0, 1);
    }
    if (map[68] == true || map[39] == true) {
        moveHero(0, 0);
    }
    if (map[83] == true || map[40] == true) {
        moveHero(1, 1);
    }
}

function startMoving(axis, dir) {
    interval = setInterval(() => {
        moveHero(axis, dir);
    }, 25);
}
function stopMoving() {
    if (typeof interval !== 'undefined') {
        clearInterval(interval);
    }
}

function moveHero(axis, dir) {
    const main = document.getElementById("main");
    const hero = document.getElementById("hero");
    if (axis == 0) {
        if (dir == 0) {
            x += 16;
        } else {
            x -= 16;
        }
        hero.style.left = `calc(50% - ${-x + 32}px)`;
        main.style.left = `calc(50vw + ${-x - 1280}px)`
    } else {
        if (dir == 0) {
            y += 16;
        } else {
            y -= 16;
        }
        hero.style.top = `calc(50% - ${y + 32}px)`;
        main.style.top = `calc(50vh + ${y - 720}px)`;
    }
    return console.log(`x, y: ${x}, ${y}`);
}