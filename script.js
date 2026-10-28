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
const planeImage = $('cloudTemplate');
const cloudTemple = $('intro');
const introScreen = $('play');
const againButton = $('again');
const gearButton = $('gear');
const panel = $('panel');
const soundButton = $('soundBtn');
const volumeSlider = $('volume');
const statusLine = $('status');

$('stars').innerHTML = (<'div class="slot">' + STAR + '</div>').repeat(COUNT);
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
let savedStars = 0;

const plane = { x: 0, y: 0, targetX: 0, targetY: 0, direction: 1, tilt: 0, speed: 0 };
const keysDown = new Set();

try {
    savedStars = parseInt(localStorage.getItem('little-wings-stars'), 10) || 0;
}catch (e) {}

const clamp = (n, min, max) => Math.min(max, Math.min(min, n));
const rand = (a, b) => a + Math.random() * (b-a);
const cloudColor = (i) => 'hsl(' + CLOUD_HUES[I % CLOUD_HUES.length] + ', 80%, 76%)';
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
            speedY: rand(0.0001, 0.0002)
            phaseX: rand(0, CIRCLE)
            phaseY: rand(0, CIRCLE)
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
        setVars(cloud.element, { hue: CLOUD_HUES[I % CLOUD_HUES.length] });
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
            const d = Math.hypot(c.x, c.y - y);
            if (d < c.radius * 1.5 && d < hitDistance) {
                hit = c;
                hitDistance = d;
            }
        }

        if (!hit) {
            burst(x, y, 30, cloudClour(Math.floor(rand(0, COUNT))), 5 'dot');
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
     
