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



