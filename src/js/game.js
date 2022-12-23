var isTouch = 'ontouchstart' in window || navigator.msMaxTouchPoints;
// prevent some touch ios events
if (isTouch) {
    document.addEventListener('touchmove', function (event) {
        if (event.scale !== 1) { event.preventDefault(); }
    }, false);
    var lastTouchEnd = 0;
    document.addEventListener('touchend', function (event) {
        var now = (new Date()).getTime();
        if (now - lastTouchEnd <= 300) {
            event.preventDefault();
        }
        lastTouchEnd = now;
    }, false);
}

var logged = false;
function log_next() {
    logged = true;
}

var hero_cords = { x: 0, y: 0 }, joymap = { x: 0, y: 0 }, speed = 25;

var keymap = {};
onkeydown = onkeyup = (e) => {
    e = e || event;
    keymap[e.keyCode] = e.type == 'keydown';
}

window.addEventListener('load', () => {
    setInterval(() => {
        if (logged) {
            checkkey();
            if (isTouch) {
                checkjoy();
            }
        }
    }, speed)
    if (isTouch) {
        joystick_init();
    }
    console.log("Loaded!");
});

window.addEventListener('unload', () => {

})

function checkkey() {
    if (keymap[87] || keymap[38]) {
        moveHero(1, 0);
    }
    if (keymap[65] || keymap[37]) {
        moveHero(0, 1);
    }
    if (keymap[68] || keymap[39]) {
        moveHero(0, 0);
    }
    if (keymap[83] || keymap[40]) {
        moveHero(1, 1);
    }
}
function checkjoy() {
    if (joymap.y > 0) {
        moveHero(1, 0);
    }
    if (joymap.x < 0) {
        moveHero(0, 1);
    }
    if (joymap.x > 0) {
        moveHero(0, 0);
    }
    if (joymap.y < 0) {
        moveHero(1, 1);
    }
}

function moveHero(axis, dir) {
    const main = document.getElementById("main");
    const hero = document.getElementById("hero");
    if (axis == 0) {
        if (dir == 0) {
            hero_cords.x += 8;
        } else {
            hero_cords.x -= 8;
        }
        hero.style.left = `calc(50% - ${-hero_cords.x + 32}px)`;
        main.style.left = `calc(50vw + ${-hero_cords.x - 1280}px)`
    } else {
        if (dir == 0) {
            hero_cords.y += 8;
        } else {
            hero_cords.y -= 8;
        }
        hero.style.top = `calc(50% - ${hero_cords.y + 48}px)`;
        main.style.top = `calc(50vh + ${hero_cords.y - 720}px)`;
    }
    return console.log(db_uname, hero_cords);
}

// ---------- Joystick ---------- \\
var width, height, radius, x_orig, y_orig;

function joystick_init() {
    canvas = document.getElementById("joystick");
    canvas.style.display = "block";
    ctx = canvas.getContext('2d');
    resize();
    document.addEventListener('mousedown', startDrawing);
    document.addEventListener('mouseup', stopDrawing);
    document.addEventListener('mousemove', Draw);
    document.addEventListener('touchstart', startDrawing);
    document.addEventListener('touchend', stopDrawing);
    document.addEventListener('touchcancel', stopDrawing);
    document.addEventListener('touchmove', Draw);
    window.addEventListener('resize', resize);
}

function resize() {
    width = window.innerWidth;
    radius = 32;
    height = radius * 6.5;
    ctx.canvas.width = width;
    ctx.canvas.height = height;
    background();
    joystick(width / 2, height / 3);
}

function background() {
    x_orig = width / 2;
    y_orig = height / 3;
    ctx.beginPath();
    ctx.arc(x_orig, y_orig, radius + 20, 0, Math.PI * 2, true);
    ctx.fillStyle = 'rgba(217, 217, 217, 0.5)';
    ctx.fill();
}

function joystick(width, height) {
    ctx.beginPath();
    ctx.arc(width, height, radius, 0, Math.PI * 2, true);
    ctx.fillStyle = '#f2f2f2';
    ctx.fill();
    ctx.strokeStyle = 'rgba(217, 217, 217, 0.5)';
    ctx.lineWidth = 8;
    ctx.stroke();
}

let abs_joy_coord = { x: 0, y: 0 };
let paint = false;

function getPosition(event) {
    var mouse_x = event.clientX || event.touches[0].clientX;
    var mouse_y = event.clientY || event.touches[0].clientY;
    abs_joy_coord.x = mouse_x - canvas.offsetLeft;
    abs_joy_coord.y = mouse_y - canvas.offsetTop;
}

function is_it_in_the_circle() {
    var current_radius = Math.sqrt(Math.pow(abs_joy_coord.x - x_orig, 2) + Math.pow(abs_joy_coord.y - y_orig, 2));
    if (radius >= current_radius) return true
    else return false
}

function startDrawing(event) {
    paint = true;
    getPosition(event);
    if (is_it_in_the_circle()) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        background();
        joystick(abs_joy_coord.x, abs_joy_coord.y);
        Draw(event);
    }
}

function stopDrawing() {
    paint = false;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    background();
    joystick(width / 2, height / 3);
    joymap = { x: 0, y: 0};
}

function Draw(event) {
    if (paint) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        background();
        var x, y;
        var angle = Math.atan2((abs_joy_coord.y - y_orig), (abs_joy_coord.x - x_orig));
        if (Math.sign(angle) == -1) {
            angle_in_degrees = Math.round(-angle * 180 / Math.PI);
        }
        else {
            angle_in_degrees =Math.round( 360 - angle * 180 / Math.PI);
        }
        if (is_it_in_the_circle()) {
            joystick(abs_joy_coord.x, abs_joy_coord.y);
            x = abs_joy_coord.x;
            y = abs_joy_coord.y;
        }
        else {
            x = radius * Math.cos(angle) + x_orig;
            y = radius * Math.sin(angle) + y_orig;
            joystick(x, y);
        }
        getPosition(event);
        var x_relative = Math.round(x - x_orig);
        var y_relative = -Math.round(y - y_orig);
        joymap = { x: x_relative, y: y_relative};
    }
} 