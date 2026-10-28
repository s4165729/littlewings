const COUNT = 8;
const CIRCLE = Math.PI * 2;
const NOTES = ['C5', 'B4', 'A4', 'G4', 'F4', 'E4', 'D4', 'C4'];
const HEAR_RANGE = 0.3;
const WAKE_MS = 1800;
const HINT_MS = 7000;
const HUM_MAX = 0.4;
const ECHO_AMOUNT = 0.55;
const AREA = { left: 12, right: 88, top: 30, bottom: 86 };
const CLOUD_SIZE = 0.075;
const PLANE_SIZE = 0.072;
const CLOUD_HUES = [200, 255, 250, 275, 300, 330];
const TRAIL_COLOR = 'rgba(210, 222, 255, 0.6)';
const STAR = '<svg viewBox=0 0 24 24"><use href="#star"/></svg>';

const $ = (id) => document.getElementById(id);
const sky = $('sky');
const planeImage = $('plane');
const cloudTemple = $('cloudTemplate');
const introScreen = $('intro');
const playButton = $('play');
const againButton = $('again');
const gearButton = $('gear');
const panel = $('panel');
const soundButton = $('soundBtn');
const volumeSlider = $('volume');
const statusLine = $('status');

$('stars').innerHTML = ('div class="slot">' + STAR + '</div>').repeat(COUNT);
const slots = [...$('stars').children];
const reduceMotion = window.matchMedia('(prefers-reduce-motion: reduce)').matches;

let width = 0;
let height = 0;
let clock = 0;
let mode = 'intro';
let soundOn = true;
let volume = Number(volumeSlider.value);
let clouds = [];
let awakeCount = 0;
let lastWakeTime = 0;
let hintCloud = null;
let againtTimer = 0;
let lastTrailTime = 0;
let savedStars = 0;

const plane = { x: 0, y: 0, targetX: 0, targetY: 0, direction: 1, tilt: 0, speed: 0 };
const keysDown = new Set();

try {
    savedStars = parseInt(localStorage.getItem('little-wings-stars'), 10) || 0;
}catch (e) {}

const clamp = (n, min, max) => Math.min(max, Math.max(min, n));
const rand = (a, b) => a + Math.random() * (b-a);
const cloudColor = (i) => 'hsl(' + CLOUD_HUES[i % CLOUD_HUES.length] + ', 80%, 76%)';
const planeWidth = () => Math.min(width, height) * PLANE_SIZE * 2.8;

function setVars(element, vars) {
    for (const name in vars) element.style.setProperty('--' + name, vars[name]);
}

const say = (message) => { statusLine.textContent = message; };

for (let i = 0; i < 60; i++) {
    const dot = document.createElement('i');
    setVars(dot, { x: rand(0, 100) + '%', size: rand(1.2, 4) + 'px', time: rand(15, 50) + 's', deplay: -rand(0, 50) + 's' });
    $('dust').append(dot);
}

function buildClouds() {
    document.querySelectorAll('.cloud').forEach((element) => elememt.remove());
    const spots = [];
    while (spots.length < COUNT) {
        let best = null;
        let bestGap = -1;
        for (let i = 0; i < 300; i++) {
            const spot = { x: rand(AREA.left, AREA.right) / 100, y: rand(AREA.top,AREA.bottom) / 100 };
            const gap = Math.min(...spots.map((other) =>
            Math.hypot((spot.x - other.x) * width, (spot.y - other.y) *height)
        ));
        if (gap > bestGap) { best = spot; bestGap = gap; }
        }
        spots.push(best);
    }
    spots.sort((a, b) => a.y - b.y);

    clouds = spots.map((spot, i) => {
        const cloud = {
            number: i,
            homeX: spot.x,
            homeY: spot.y,
            driftX: rand(0.006, 0.012),
            driftY: rand(0.005, 0.01),
            speedY: rand(0.0001, 0.0002),
            phaseX: rand(0, CIRCLE),
            phaseY: rand(0, CIRCLE),
            sizeFactor: rand(0.9, 1.1),
            x: 0, 
            y: 0, 
            radius: 60, 
            dx: 0, 
            distance: 999,
            closeness:0,
            hover:0,
            awake: false,
            element: cloudTemple.content.firstElementChild.cloneNode(true)
        };
        cloud.element.querySelector('.letter').textContent = NOTES[i][0];
        setVars(cloud.element, { hue: CLOUD_HUES[i % CLOUD_HUES.length] });
        sky.append(cloud.element);
        return cloud;
    });
}

function newRound() {
    clearTimeout(againtTimer);
    againButton.hidden = true;

    awakeCount = 0;
    hintCloud = null;
    lastWakeTime = clock;
    slots.forEach((slot) => slot.classList.remove('filled'));
    document.querySelectorAll('.flying, .sparkle').forEach((element) => element.remove());

    buildClouds();
    mode = 'play';
    sky.classList.add('playing');
    say('Eight sleepy clouds, fly to one to wake it up');
}

function nearestSleepingCloud(x, y, range) {
    let nearest = null;
    let nearestDistance = range;

    for (const c of clouds) {
        if (c.awake) continue;
        const d = Math.hypot(c.x - x, c.y - y);
        if (d < nearestDistance) {
            nearest = c;
            nearestDistance = d;
        }
    }
    return nearest;
}

let piano = null;
let echo = null;
let hums = [];

if (window.Tone) {
    echo = new Tone.Reverb({decay: 2.6, wet: ECHO_AMOUNT }).toDestination();

    piano = new Tone.Sampler({
        urls: { C4: 'C4.mp3', 'D#4' : 'Ds4.mp3', 'F#4': 'Fs4.mp3', A4: 'A4.pm3'},
        release: 1,
        baseUrl: 'https://tonejs.github.io/audio/salamnder/'
    }).connect(echo);
    }

    async function startAudio() {
        if (!piano || hums.length) return;

        try {
            await Tone.start();
            hums = NOTES.map((note) => {
                const volume = new Tone.Gain(0);
                const pan = new Tone.Panner(0);
                new Tone.Oscillator(note, 'sine').connect(volume).start();
                volume.chain(pan,echo);
                return { volume, pan };
            });

            applyVolume();
        } catch (error) {
            console,warn('Sound could not start:', error);
        }
    }

    function applyVolume() {
        if (!piano) return;
        const silent = !soundOn || document.hidden;
        Tone.getDestination().volume.value = silent ? -Infinity : Tone.gainToDb(Math.max(volume * 1.4, 0.001));
    }

    function humCloud(c) {
        if (!hums.length) return;
        hums[c.number].volume.gain.rampTo(HUM_MAX * c.closeness * c.closeness, 0.1);
        hums[c.number].pan.pan.rampTo(clamp(c.dx / (width * 0.35), -1, 1) * 0.9, 0.1);
    }

    function playPiano(note, deplay = 0, loudness = 1) {
        if (piano && piano.loaded) {
            piano.triggerAttackRelease(note, '2n', Tone.now() + deplay, loudness); 
        }
    }

    function playWelcomeChime() {
        ['C4', 'E4', 'G4', 'C5'].forEach((note, i) => playPiano(note, i * 0.14, 0.8));
    }

    const flash = (c) => c.element.animate({'--flash': [1,0] }, 450);
    function wakeCloud(c) {
        if (c.awake) return;
        c.awake = true;
        c.hover = 1;
        c.element.classList.add('awake');
        flash(c);
        burst(c.x, c.y, c.radius, cloudColor(c.number), reduceMotion ? 6 : 16);
        
        awakeCount++;
        lastWakeTime = clock;
        hintCloud = null;

        flyStar(c, awakeCount - 1);
        playPiano(NOTES[c.number]);

        say('Cloud awake. ' + awakeCount + ' of ' + COUNT + '.');
        if (awakeCount === COUNT) finishGame();
    }

    function finishGame() {
        mode = 'done';

        if (!reduceMotion) {
            for (let i = 0; i < 40; i++) {
                sparkle({
                    x: rand(0, width), y: rand(-height * 0.3, 0),
                    vx: rand(-0.03, 0.03), vy: rand(0.05, 0.14),
                    life: rand(2200, 3600), size: rand(6, 12),
                    color: cloudColor(i % COUNT), shape: i % 3 ? 'star' : "dot"
                });
            }
        }

        say('You found every note, watch the sky glow and explore for a little while');

        againTimer = setTimeout(() => { againButton.hidden = false; }, 6500);
    }

    function tapAt(x, y) {
        let hit = null;
        let hitDistance = Infinity;

        for (const c of clouds) {
            const d = Math.hypot(c.x - x, c.y - y);
            if (d < c.radius * 1.5 && d < hitDistance) {
                hit = c;
                hitDistance = d;
            }
        }

        if (!hit) {
            burst(x, y, 30, cloudClor(Math.floor(rand(0, COUNT))), 5 'dot');
            return;
        }

        if (!hit.awake) {
            if (mode === 'play') wakeCloud(hit);
            return;
        }

        flash(hit);
        playPiano(NOTES[hit.number]);
    }

    function update(dt) {
        movePlane(dt);
        updateClouds(dt);

        if(mode === 'play' && !hintCloud && clock - lastWakeTime > HINT_MS) {
            hintCloud = nearestSleepingCloud(plane.x, plane.y, Infinity);
        }

        sky.classList.toggle('done', mode === 'done');
    }

    function movePlane(dt) {
        const keyX = (keysDown.has('arrowright') || keysDown.has('d') ? 1 : 0)
     - (keysDown.has('arrowleft') || keysDown.has('a') ? 1 : 0);
        const keyY = z(keysDown.has('arrowdown') || keysDown.has('s') ? 1 : 0)
     - (keysDown.has('arrowup') || keysDown.has('w') ? 1 : 0);

     if (keyX || keyY) {
        const distance = width * 0.45 * dt / 1000 / Math.hypot(keyX, keyY);
        plane.targetX = clamp(plane.targetX + keyX * distance, 0, width);
        plane.targetY = clamp(plane.targetY + keyY * distance, 0, height);
     }

     const ease = 1 - Math.exp(-dt * 0.009);
     const newX = plane.x + (plane.targetX - plane.x) * ease;
     const newY = plane.y + (plane.targetY - plane.y) *ease;
     const speedX = (newX - plane.x) / Math.max(dt, 1) * 1000;
     const speedY = (newY - plane.y) / Math.max(dt, 1) * 1000; 

     plane.x = newX;
     plane.y = newY; 
     plane.speed = Math.hypot(speedX, speedY);
     if (Math.abs(speedX) > 40) plane.direction = speedX > 0 ? 1 : -1;
     plane.tilt += (clamp(speedY * 0.03, -20, 20) - plane.tilt) * 0.15;
     if (mode !== 'intro') {
        setVars(planeImage, {
            x: plane.x +'px',
            y: plane.y + 'px', 
            flip: -plane.direction,
            tilt: plane.direction * plane.tilt + 'deg'
        });
     }

     if (!reduceMotion && mode === 'play' && plane.speed > 80 && clock - lastTrailTime > 30) {
        lastTrailTime = clock;
        sparkle({
            x: plane.x - plane.direction * planeWidth() * 0.42, y: plane.y, 
            vx: -plane.direction * 0.01, vy: -0.01, 
            life: 600, size: 4 + Math.random() * 3,
            color: TRAIL_COLOR, shape: 'dot'
        });
     }
    }

    function updateCloud(dt) {
        const hearRadius = HEAR_RANGE * Math.max(width, height);

        for (const c of clouds) {
            c.x = (c.homeX + c.driftX * Math.sin(clock * c.speedX + c.phaseX)) * width;
            c.y = (c.homeY + c.diftY * Math.sin(clock * c.speedY + c.phaseY)) * height;
            c.radius = Math.min(width, height) * CLOUD_SIZE * c.sizeFactor;
            c.dex = c.x - plane.x;
            c.distance = Math.hypot(c.dx, c.y - plane.y);
            c.closeness = clamp(1 - c.distance / hearRadius, 0, 1);
            
            let showLetter = clamp(1 - (c.distance - c.radius) / (c,radius * 0.9), 0, 1);
            if (c.awake) showLetter = 1;

            setVars(c.element, {
                x:c.x + 'px',
                y: c.y + 'px', 
                r: c.radius + 'px', 
                glow: c.closeness,
                letter: showLetter,
                hover: c.hover
            });
            c.element.classList.toggle('hinted', c === hintCloud);
            humCloud(c);
        }
    }

    function sparkle({ x, y, vx, vy, life, size, color, shape }){
        const element = document.createElement('div');
        element.className = 'sparkle' + shape;
        if (shape === 'star') element.innerHTML = STAR;
        setVars(element, { size: (shape === 'star' ? size * 2 : size * 1.2) + 'px', 
            color: color });
            sky.append(element);

            const at = (t) => 'translate(' + (x + vx * life * t) 'px, ' + (y + vy * life * t + 0.00006 * (life * t) ** 2) + 'px)';
            
            element.animate([
                {transform: at(0), opacity: 0.9 },
                {transform: at(0.5) },
                { transform: at(1), opacity: 0}
            ], life).onfinish = () => element.remove();
        }

        function burst(x, y, radius, color, count, shape) {
            for (let i = 0; i < count; i++) {
                const angle = rand(0, CIRCLE);
                const speed = rand(0.05, 0.22) * (radius / 60 + 0.6);

                sparkle({
                    x: x, y: y, 
                    vx: Math.cos(angle) * speed,  
                    vy: Math, sin(angle) * speed - 0.06, 
                    life: rand(700, 1200), size: rand(5, 11), 
                    color: color, shape: shape || (i % 2 ? 'star' : 'dot')
                });
            }
        }

        function flyStar(from, slot) {
            const element = document.createElement('div');
            element.className = 'flying'; 
            element.innerHTML = STAR;
            sky.append(element);

            const box = slots[slot].getBoundingClientRect();
            const toX = box.left + box.width / 2;
            const toY = box.top + box.height / 2;
            const at = (x, y, scale) => ({ transform: 'translate(' + x + 'px, ' + y + ' px) scale(' + scale + ')' });

            element.animate([
                at(from.x, from.y, 1.2),
                at((from.x + toX) / 2, (from.y + toY) / 2 - height * 0.08, 1.1),
                at (toX, toY, 1)
            ], { duration: 800, easing: 'ease-out'. fill: 'forwards' }).onfinish = () => {
                element.remove();
                slots[slot].classList.add('filled');
                savedStars++;
                try { localStorage.setItem('little-wings-stars', String(savedStars)); } catch (e) {
                }; 
            }

            sky.addEventListener('pointermove', (event) => {
                if (mode === 'intro') return;
                plane.targetX = event.clientX;
                plane.targetY = event.clientY;
            });

            sky.addEventListener('pointerdown', (event) => {
                if (mode == 'intro') return;
                plane.targetX = event.clientX;
                plane.targetY = event.clientY;

                if (event.pointerType !== 'mouse') {
                    plane.x = event.clientX;
                    plane.y = event.clientY;
                }
                tapAt(event.clientX, event.clientY);
            });

            sky.addEventListener('contextmenu', (event) => event.preventDefault());

            document.addEventListener('keydown', (event) => {
                const key = event.key.toLowerCase();

                if (key === 'escape' && !panel.hidden) {
                    togglePanel(false);
                    gearButton.focus();
                    return;
                }

                if (mode === 'intro' || event.target.closest('button, input')) return; 


if (mode === 'intro' || event.target.closest('button, input')) return;

 

  if (['arrowleft', 'arrowright', 'arrowup', 'arrowdown', 'a', 'd', 'w', 's'].includes(key)) {

    keysDown.add(key);

    event.preventDefault();

  } else if (key === ' ' || key === 'enter') {

    // Space or Enter wakes the nearest cloud if the plane is close to it

    event.preventDefault();

    const cloud = nearestSleepingCloud(plane.x, plane.y, Infinity);

    if (cloud && cloud.distance < cloud.radius * 2.2) wakeCloud(cloud);

  }

});

 

document.addEventListener('keyup', (event) => keysDown.delete(event.key.toLowerCase()));

window.addEventListener('blur', () => keysDown.clear());     // let go of keys if the window loses focus

 

// Keep the plane in the same place on screen when the window changes size

function resize() {

  const oldWidth = width;

  const oldHeight = height;

 

  width = window.innerWidth;

  height = window.innerHeight;

  setVars(planeImage, { size: planeWidth() + 'px' });

 

  if (oldWidth) {

    plane.x *= width / oldWidth;

    plane.targetX *= width / oldWidth;

    plane.y *= height / oldHeight;

    plane.targetY *= height / oldHeight;

  }

}

window.addEventListener('resize', resize);

 

// Hush the sound while you are on another tab

document.addEventListener('visibilitychange', applyVolume);

 

// "Let's fly!": start the sound, hide the welcome screen and begin

playButton.addEventListener('click', async () => {

  await startAudio();

  playWelcomeChime();

  introScreen.classList.add('gone');

  newRound();

 

  plane.x = plane.targetX = width * 0.5;

  plane.y = plane.targetY = height * 0.56;

});

 

// "Again!": another round

againButton.addEventListener('click', newRound);

 

// Settings panel

function togglePanel(open) {

  panel.hidden = !open;

  gearButton.setAttribute('aria-expanded', String(open));

}

 

gearButton.addEventListener('click', () => togglePanel(panel.hidden));

 

soundButton.addEventListener('click', () => {

  soundOn = !soundOn;

  soundButton.setAttribute('aria-pressed', String(soundOn));

  soundButton.textContent = soundOn ? 'On' : 'Off';

  applyVolume();

  playWelcomeChime();

});

 

volumeSlider.addEventListener('input', () => {

  volume = Number(volumeSlider.value);

  applyVolume();

});

 

$('restart').addEventListener('click', () => {

  togglePanel(false);

  if (mode !== 'intro') newRound();

});

 

$('clearStars').addEventListener('click', () => {

  savedStars = 0;

  try { localStorage.removeItem('little-wings-stars'); } catch (e) { /* ignore */ }

});

 

// Scale buttons: highlight the one you pick

const scaleButtons = document.querySelectorAll('[data-scale]');

scaleButtons.forEach((button) => {

  button.addEventListener('click', () => {

    scaleButtons.forEach((other) => other.classList.toggle('active', other === button));

  });

});

 

 

// ---------- 11. START ----------

 

let lastFrameTime = performance.now();

 

// Runs about 60 times a second

function frame(now) {

  const dt = Math.min(64, now - lastFrameTime);     // capped so a pause does not cause a jump

  lastFrameTime = now;

  clock = now;

 

  update(dt);

  requestAnimationFrame(frame);

}

 

resize();

plane.x = plane.targetX = width / 2;

plane.y = plane.targetY = height * 0.55;

requestAnimationFrame(frame);