var x = 0, y = 0;

// window.addEventListener('load', (event) => {
//     for (i = 0; i < 18; i++) {
//         setTimeout(() => {  moveHero("0", 0); }, i * 1000);
//     }
// });

function moveHero(axis, dir) {
    const main = document.getElementById("main");
    const hero = document.getElementById("hero");
    if (axis == 0) {
        if (dir == 0) {
            x += 64;
        } else {
            x -= 64;
        }
        hero.style.left = `calc(50% - ${-x + 32}px)`;
        main.style.left = `calc(50vw + ${-x - 1280}px)`
    } else {
        if (dir == 0) {
            y += 64;
        } else {
            y -= 64;
        }
        hero.style.top = `calc(50% - ${y + 32}px)`;
        main.style.top = `calc(50vh + ${y - 720}px)`;
    }
    return console.log(`x, y: ${x}, ${y}`)
}