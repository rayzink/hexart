/**
 * HexCraft 3D - Voxel Hex World Builder
 * A Three.js based 3D hexagonal voxel building game
 */

// ============================================================================
// Configuration
// ============================================================================

const CONFIG = {
    gridSize: 15,           // Grid radius
    hexRadius: 1,           // Hex tile radius
    hexHeight: 0.4,         // Hex tile height
    maxHeight: 20,          // Max stack height
    cameraDistance: 25,
    flySpeed: 0.15,
    sprintMultiplier: 2.5,
    soundEnabled: true
};

// Color palette with special materials
const MATERIALS = [
    { name: 'Stone', color: '#6b7280', behavior: null },
    { name: 'Grass', color: '#22c55e', behavior: null },
    { name: 'Water', color: '#0ea5e9', behavior: 'flows' },
    { name: 'Lava', color: '#ef4444', behavior: 'converts_water' },
    { name: 'Fire', color: '#f97316', behavior: 'destroys' },
    { name: 'Sand', color: '#fbbf24', behavior: 'falls' },
    { name: 'Wood', color: '#92400e', behavior: null },
    { name: 'Ice', color: '#67e8f9', behavior: null },
    { name: 'Purple', color: '#a855f7', behavior: null },
    { name: 'Pink', color: '#ec4899', behavior: null },
    { name: 'White', color: '#f5f5f5', behavior: null },
    { name: 'Black', color: '#1f2937', behavior: null },
];

// ============================================================================
// State
// ============================================================================

const STATE = {
    mode: 'orbit',          // 'orbit' or 'fly'
    currentMaterial: 0,
    brushSize: 1,
    blocks: new Map(),      // "x,y,z" -> materialIndex
    hoveredBlock: null,
    hoveredFace: null,
    isPlacing: false,
    history: [],
    historyIndex: -1,

    // Fly mode
    moveForward: false,
    moveBackward: false,
    moveLeft: false,
    moveRight: false,
    moveUp: false,
    moveDown: false,
    sprint: false,

    // Camera
    yaw: 0,
    pitch: 0
};

// ============================================================================
// Three.js Setup
// ============================================================================

let scene, camera, renderer, controls;
let raycaster, mouse;
let hexGeometry, groundMesh;
let blockMeshes = new Map();
let highlightMesh;
let audio;

function init() {
    // Scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a1a2e);
    scene.fog = new THREE.Fog(0x1a1a2e, 30, 80);

    // Camera
    camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(15, 20, 15);
    camera.lookAt(0, 0, 0);

    // Renderer
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    document.getElementById('canvas-container').appendChild(renderer.domElement);

    // Orbit Controls
    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.maxPolarAngle = Math.PI / 2.1;
    controls.minDistance = 5;
    controls.maxDistance = 50;
    controls.target.set(0, 0, 0);

    // Lighting
    const ambientLight = new THREE.AmbientLight(0x404060, 0.5);
    scene.add(ambientLight);

    const sunLight = new THREE.DirectionalLight(0xffffff, 1);
    sunLight.position.set(20, 40, 20);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
    sunLight.shadow.camera.near = 1;
    sunLight.shadow.camera.far = 100;
    sunLight.shadow.camera.left = -30;
    sunLight.shadow.camera.right = 30;
    sunLight.shadow.camera.top = 30;
    sunLight.shadow.camera.bottom = -30;
    scene.add(sunLight);

    const fillLight = new THREE.DirectionalLight(0x6366f1, 0.3);
    fillLight.position.set(-10, 10, -10);
    scene.add(fillLight);

    // Raycaster
    raycaster = new THREE.Raycaster();
    mouse = new THREE.Vector2();

    // Create hex geometry
    createHexGeometry();

    // Create ground
    createGround();

    // Create highlight mesh
    createHighlight();

    // Initialize audio
    audio = new AudioSystem();

    // Create starter blocks
    createStarterBlocks();

    // Events
    setupEventListeners();

    // UI
    setupUI();

    // Start render loop
    animate();
}

// ============================================================================
// Geometry Creation
// ============================================================================

function createHexGeometry() {
    // Create a hexagonal prism geometry
    const shape = new THREE.Shape();
    const sides = 6;
    const radius = CONFIG.hexRadius;

    for (let i = 0; i < sides; i++) {
        const angle = (i / sides) * Math.PI * 2 - Math.PI / 2;
        const x = Math.cos(angle) * radius;
        const y = Math.sin(angle) * radius;
        if (i === 0) {
            shape.moveTo(x, y);
        } else {
            shape.lineTo(x, y);
        }
    }
    shape.closePath();

    const extrudeSettings = {
        depth: CONFIG.hexHeight,
        bevelEnabled: true,
        bevelThickness: 0.05,
        bevelSize: 0.05,
        bevelSegments: 2
    };

    hexGeometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);
    hexGeometry.rotateX(-Math.PI / 2);
    hexGeometry.translate(0, CONFIG.hexHeight / 2, 0);
}

function createGround() {
    // Create a large hex grid ground plane
    const groundGeo = new THREE.PlaneGeometry(100, 100);
    const groundMat = new THREE.MeshStandardMaterial({
        color: 0x1f2937,
        roughness: 0.9,
        metalness: 0.1
    });
    groundMesh = new THREE.Mesh(groundGeo, groundMat);
    groundMesh.rotation.x = -Math.PI / 2;
    groundMesh.position.y = -0.01;
    groundMesh.receiveShadow = true;
    scene.add(groundMesh);

    // Add grid helper
    const gridHelper = new THREE.GridHelper(50, 50, 0x3f3f5f, 0x2a2a4a);
    gridHelper.position.y = 0;
    scene.add(gridHelper);
}

function createHighlight() {
    const highlightGeo = hexGeometry.clone();
    const highlightMat = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.3,
        side: THREE.DoubleSide
    });
    highlightMesh = new THREE.Mesh(highlightGeo, highlightMat);
    highlightMesh.visible = false;
    scene.add(highlightMesh);
}

function createStarterBlocks() {
    // Create a small starter platform
    const positions = [
        [0, 0, 0], [1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1],
        [1, 0, 1], [-1, 0, -1], [1, 0, -1], [-1, 0, 1]
    ];

    positions.forEach(([x, y, z]) => {
        addBlock(x, y, z, 0); // Stone
    });

    saveState();
}

// ============================================================================
// Block Management
// ============================================================================

function hexToWorld(q, r) {
    // Convert hex coordinates to world position (pointy-top orientation)
    const x = CONFIG.hexRadius * Math.sqrt(3) * (q + r / 2);
    const z = CONFIG.hexRadius * 1.5 * r;
    return { x, z };
}

function worldToHex(x, z) {
    // Convert world position to hex coordinates
    const q = (Math.sqrt(3) / 3 * x - 1 / 3 * z) / CONFIG.hexRadius;
    const r = (2 / 3 * z) / CONFIG.hexRadius;
    return { q: Math.round(q), r: Math.round(r) };
}

function getBlockKey(x, y, z) {
    return `${x},${y},${z}`;
}

function addBlock(q, r, y, materialIndex, animate = true) {
    const key = getBlockKey(q, r, y);
    if (STATE.blocks.has(key)) return false;

    STATE.blocks.set(key, materialIndex);

    // Create mesh
    const material = MATERIALS[materialIndex];
    const mat = new THREE.MeshStandardMaterial({
        color: material.color,
        roughness: 0.7,
        metalness: 0.1
    });

    const mesh = new THREE.Mesh(hexGeometry, mat);
    const worldPos = hexToWorld(q, r);
    mesh.position.set(worldPos.x, y * CONFIG.hexHeight, worldPos.z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData = { q, r, y, materialIndex };

    // Animation
    if (animate) {
        mesh.scale.set(0.01, 0.01, 0.01);
        animateScale(mesh, { x: 1, y: 1, z: 1 }, 200, 'bounceOut');
        audio.playPlace();
    }

    scene.add(mesh);
    blockMeshes.set(key, mesh);

    return true;
}

function removeBlock(q, r, y, animate = true) {
    const key = getBlockKey(q, r, y);
    if (!STATE.blocks.has(key)) return false;

    STATE.blocks.delete(key);
    const mesh = blockMeshes.get(key);

    if (mesh) {
        if (animate) {
            audio.playRemove();
            animateScale(mesh, { x: 0.01, y: 0.01, z: 0.01 }, 150, 'easeIn', () => {
                scene.remove(mesh);
                mesh.geometry.dispose();
                mesh.material.dispose();
            });
        } else {
            scene.remove(mesh);
            mesh.geometry.dispose();
            mesh.material.dispose();
        }
        blockMeshes.delete(key);
    }

    return true;
}

function getTopBlockAt(q, r) {
    for (let y = CONFIG.maxHeight; y >= 0; y--) {
        if (STATE.blocks.has(getBlockKey(q, r, y))) {
            return y;
        }
    }
    return -1;
}

// ============================================================================
// Animation System
// ============================================================================

const animations = [];

function animateScale(mesh, target, duration, easing, onComplete) {
    const start = { x: mesh.scale.x, y: mesh.scale.y, z: mesh.scale.z };
    const startTime = performance.now();

    animations.push({
        mesh,
        start,
        target,
        duration,
        easing,
        startTime,
        onComplete
    });
}

function updateAnimations() {
    const now = performance.now();

    for (let i = animations.length - 1; i >= 0; i--) {
        const anim = animations[i];
        const elapsed = now - anim.startTime;
        let t = Math.min(elapsed / anim.duration, 1);

        // Apply easing
        if (anim.easing === 'bounceOut') {
            t = bounceOut(t);
        } else if (anim.easing === 'easeIn') {
            t = t * t;
        }

        anim.mesh.scale.x = anim.start.x + (anim.target.x - anim.start.x) * t;
        anim.mesh.scale.y = anim.start.y + (anim.target.y - anim.start.y) * t;
        anim.mesh.scale.z = anim.start.z + (anim.target.z - anim.start.z) * t;

        if (elapsed >= anim.duration) {
            animations.splice(i, 1);
            if (anim.onComplete) anim.onComplete();
        }
    }
}

function bounceOut(t) {
    const n1 = 7.5625;
    const d1 = 2.75;
    if (t < 1 / d1) {
        return n1 * t * t;
    } else if (t < 2 / d1) {
        return n1 * (t -= 1.5 / d1) * t + 0.75;
    } else if (t < 2.5 / d1) {
        return n1 * (t -= 2.25 / d1) * t + 0.9375;
    } else {
        return n1 * (t -= 2.625 / d1) * t + 0.984375;
    }
}

// ============================================================================
// Audio System
// ============================================================================

class AudioSystem {
    constructor() {
        this.enabled = CONFIG.soundEnabled;
        this.ctx = null;
    }

    init() {
        if (this.ctx) return;
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    }

    playTone(freq, duration, type = 'sine', volume = 0.1) {
        if (!this.enabled) return;
        this.init();

        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = type;
        osc.frequency.setValueAtTime(freq, this.ctx.currentTime);

        gain.gain.setValueAtTime(volume, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start();
        osc.stop(this.ctx.currentTime + duration);
    }

    playPlace() {
        const freq = 400 + Math.random() * 200;
        this.playTone(freq, 0.1, 'sine', 0.15);
        setTimeout(() => this.playTone(freq * 1.5, 0.08, 'sine', 0.1), 30);
    }

    playRemove() {
        this.playTone(300, 0.15, 'sawtooth', 0.08);
    }

    playSelect() {
        this.playTone(800, 0.05, 'sine', 0.1);
    }

    playModeSwitch() {
        this.playTone(600, 0.1, 'triangle', 0.12);
        setTimeout(() => this.playTone(800, 0.1, 'triangle', 0.1), 80);
    }

    toggle() {
        this.enabled = !this.enabled;
        if (this.enabled) this.playSelect();
        return this.enabled;
    }
}

// ============================================================================
// Input Handling
// ============================================================================

function setupEventListeners() {
    const canvas = renderer.domElement;

    // Mouse
    canvas.addEventListener('mousemove', onMouseMove);
    canvas.addEventListener('mousedown', onMouseDown);
    canvas.addEventListener('mouseup', onMouseUp);
    canvas.addEventListener('contextmenu', e => e.preventDefault());

    // Touch
    canvas.addEventListener('touchstart', onTouchStart, { passive: false });
    canvas.addEventListener('touchmove', onTouchMove, { passive: false });
    canvas.addEventListener('touchend', onTouchEnd);

    // Keyboard
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup', onKeyUp);

    // Resize
    window.addEventListener('resize', onResize);

    // Pointer lock for fly mode
    canvas.addEventListener('click', () => {
        if (STATE.mode === 'fly') {
            canvas.requestPointerLock();
        }
    });

    document.addEventListener('pointerlockchange', () => {
        if (document.pointerLockElement !== canvas && STATE.mode === 'fly') {
            setMode('orbit');
        }
    });
}

function onMouseMove(event) {
    // Update mouse position
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    // Fly mode look
    if (STATE.mode === 'fly' && document.pointerLockElement) {
        STATE.yaw -= event.movementX * 0.002;
        STATE.pitch -= event.movementY * 0.002;
        STATE.pitch = Math.max(-Math.PI / 2 + 0.1, Math.min(Math.PI / 2 - 0.1, STATE.pitch));
    }

    // Update raycast
    updateRaycast();
}

function onMouseDown(event) {
    if (STATE.mode === 'fly' && !document.pointerLockElement) return;

    audio.init();

    if (event.button === 0) { // Left click - place
        STATE.isPlacing = true;
        placeBlock();
    } else if (event.button === 2) { // Right click - remove
        removeBlockAtCursor();
    }
}

function onMouseUp(event) {
    if (event.button === 0) {
        STATE.isPlacing = false;
    }
}

function onTouchStart(event) {
    event.preventDefault();
    audio.init();

    if (event.touches.length === 1) {
        const touch = event.touches[0];
        mouse.x = (touch.clientX / window.innerWidth) * 2 - 1;
        mouse.y = -(touch.clientY / window.innerHeight) * 2 + 1;
        updateRaycast();
    }
}

function onTouchMove(event) {
    if (event.touches.length === 1) {
        const touch = event.touches[0];
        mouse.x = (touch.clientX / window.innerWidth) * 2 - 1;
        mouse.y = -(touch.clientY / window.innerHeight) * 2 + 1;
        updateRaycast();
    }
}

function onTouchEnd(event) {
    if (event.changedTouches.length === 1) {
        placeBlock();
    }
}

function onKeyDown(event) {
    switch (event.code) {
        case 'KeyW': STATE.moveForward = true; break;
        case 'KeyS': STATE.moveBackward = true; break;
        case 'KeyA': STATE.moveLeft = true; break;
        case 'KeyD': STATE.moveRight = true; break;
        case 'Space': STATE.moveUp = true; event.preventDefault(); break;
        case 'ShiftLeft': STATE.moveDown = true; break;
        case 'ControlLeft': STATE.sprint = true; break;

        case 'KeyF':
            toggleMode();
            break;

        case 'KeyM':
            const enabled = audio.toggle();
            updateSoundButton(enabled);
            break;

        case 'KeyQ':
            STATE.brushSize = Math.max(1, STATE.brushSize - 1);
            updateBrushDisplay();
            audio.playSelect();
            break;

        case 'KeyE':
            STATE.brushSize = Math.min(5, STATE.brushSize + 1);
            updateBrushDisplay();
            audio.playSelect();
            break;

        case 'KeyZ':
            if (event.ctrlKey || event.metaKey) {
                undo();
                event.preventDefault();
            }
            break;

        case 'KeyY':
            if (event.ctrlKey || event.metaKey) {
                redo();
                event.preventDefault();
            }
            break;

        // Number keys for material selection
        case 'Digit1': case 'Digit2': case 'Digit3': case 'Digit4':
        case 'Digit5': case 'Digit6': case 'Digit7': case 'Digit8':
        case 'Digit9': case 'Digit0':
            const num = event.code === 'Digit0' ? 9 : parseInt(event.code.slice(-1)) - 1;
            if (num < MATERIALS.length) {
                selectMaterial(num);
            }
            break;
    }
}

function onKeyUp(event) {
    switch (event.code) {
        case 'KeyW': STATE.moveForward = false; break;
        case 'KeyS': STATE.moveBackward = false; break;
        case 'KeyA': STATE.moveLeft = false; break;
        case 'KeyD': STATE.moveRight = false; break;
        case 'Space': STATE.moveUp = false; break;
        case 'ShiftLeft': STATE.moveDown = false; break;
        case 'ControlLeft': STATE.sprint = false; break;
    }
}

function onResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

// ============================================================================
// Game Logic
// ============================================================================

function updateRaycast() {
    raycaster.setFromCamera(mouse, camera);

    // Get all block meshes
    const meshes = Array.from(blockMeshes.values());
    meshes.push(groundMesh);

    const intersects = raycaster.intersectObjects(meshes);

    if (intersects.length > 0) {
        const hit = intersects[0];

        if (hit.object === groundMesh) {
            // Hit ground - show placement position
            const hex = worldToHex(hit.point.x, hit.point.z);
            const worldPos = hexToWorld(hex.q, hex.r);
            highlightMesh.position.set(worldPos.x, 0, worldPos.z);
            highlightMesh.visible = true;
            STATE.hoveredBlock = { q: hex.q, r: hex.r, y: -1 };
            STATE.hoveredFace = 'top';
        } else {
            // Hit block - show next position
            const block = hit.object.userData;
            const normal = hit.face.normal.clone();
            hit.object.localToWorld(normal.add(hit.object.position)).sub(hit.object.position);

            let newQ = block.q;
            let newR = block.r;
            let newY = block.y;

            if (Math.abs(normal.y) > 0.5) {
                newY = normal.y > 0 ? block.y + 1 : block.y - 1;
            } else {
                // Side placement - approximate hex neighbor
                const angle = Math.atan2(normal.z, normal.x);
                const dir = Math.round(angle / (Math.PI / 3));
                const neighbors = [
                    [1, 0], [0, 1], [-1, 1], [-1, 0], [0, -1], [1, -1]
                ];
                const idx = ((dir % 6) + 6) % 6;
                newQ += neighbors[idx][0];
                newR += neighbors[idx][1];
            }

            const worldPos = hexToWorld(newQ, newR);
            highlightMesh.position.set(worldPos.x, newY * CONFIG.hexHeight, worldPos.z);
            highlightMesh.visible = true;
            STATE.hoveredBlock = { q: newQ, r: newR, y: newY };
            STATE.hoveredFace = normal.y > 0.5 ? 'top' : 'side';
        }
    } else {
        highlightMesh.visible = false;
        STATE.hoveredBlock = null;
    }
}

function placeBlock() {
    if (!STATE.hoveredBlock) return;

    const { q, r, y } = STATE.hoveredBlock;
    const placeY = y === -1 ? 0 : y;

    if (placeY >= 0 && placeY < CONFIG.maxHeight) {
        if (addBlock(q, r, placeY, STATE.currentMaterial)) {
            saveState();
        }
    }
}

function removeBlockAtCursor() {
    raycaster.setFromCamera(mouse, camera);
    const meshes = Array.from(blockMeshes.values());
    const intersects = raycaster.intersectObjects(meshes);

    if (intersects.length > 0) {
        const block = intersects[0].object.userData;
        if (removeBlock(block.q, block.r, block.y)) {
            saveState();
        }
    }
}

function toggleMode() {
    setMode(STATE.mode === 'orbit' ? 'fly' : 'orbit');
}

function setMode(mode) {
    STATE.mode = mode;
    audio.playModeSwitch();

    if (mode === 'orbit') {
        controls.enabled = true;
        document.exitPointerLock();
        document.getElementById('crosshair').style.display = 'none';
        document.getElementById('mode-indicator').textContent = 'Orbit Mode';
    } else {
        controls.enabled = false;
        document.getElementById('crosshair').style.display = 'block';
        document.getElementById('mode-indicator').textContent = 'Fly Mode (ESC to exit)';
        // Store current camera orientation
        const dir = new THREE.Vector3();
        camera.getWorldDirection(dir);
        STATE.yaw = Math.atan2(-dir.x, -dir.z);
        STATE.pitch = Math.asin(dir.y);
    }

    updateModeButton();
}

function updateFlyMovement() {
    if (STATE.mode !== 'fly') return;

    const speed = CONFIG.flySpeed * (STATE.sprint ? CONFIG.sprintMultiplier : 1);

    // Direction vectors
    const forward = new THREE.Vector3(
        -Math.sin(STATE.yaw) * Math.cos(STATE.pitch),
        Math.sin(STATE.pitch),
        -Math.cos(STATE.yaw) * Math.cos(STATE.pitch)
    );

    const right = new THREE.Vector3(
        Math.cos(STATE.yaw),
        0,
        -Math.sin(STATE.yaw)
    );

    const velocity = new THREE.Vector3();

    if (STATE.moveForward) velocity.add(forward);
    if (STATE.moveBackward) velocity.sub(forward);
    if (STATE.moveRight) velocity.add(right);
    if (STATE.moveLeft) velocity.sub(right);
    if (STATE.moveUp) velocity.y += 1;
    if (STATE.moveDown) velocity.y -= 1;

    if (velocity.length() > 0) {
        velocity.normalize().multiplyScalar(speed);
        camera.position.add(velocity);
    }

    // Update camera look direction
    camera.rotation.order = 'YXZ';
    camera.rotation.y = STATE.yaw;
    camera.rotation.x = STATE.pitch;
}

// ============================================================================
// History (Undo/Redo)
// ============================================================================

function saveState() {
    // Remove future states if we're not at the end
    if (STATE.historyIndex < STATE.history.length - 1) {
        STATE.history = STATE.history.slice(0, STATE.historyIndex + 1);
    }

    // Save current state
    const snapshot = new Map(STATE.blocks);
    STATE.history.push(snapshot);
    STATE.historyIndex = STATE.history.length - 1;

    // Limit history
    if (STATE.history.length > 50) {
        STATE.history.shift();
        STATE.historyIndex--;
    }
}

function undo() {
    if (STATE.historyIndex <= 0) return;
    STATE.historyIndex--;
    loadState(STATE.history[STATE.historyIndex]);
    audio.playSelect();
}

function redo() {
    if (STATE.historyIndex >= STATE.history.length - 1) return;
    STATE.historyIndex++;
    loadState(STATE.history[STATE.historyIndex]);
    audio.playSelect();
}

function loadState(snapshot) {
    // Remove all current blocks
    for (const [key, mesh] of blockMeshes) {
        scene.remove(mesh);
        mesh.geometry.dispose();
        mesh.material.dispose();
    }
    blockMeshes.clear();
    STATE.blocks.clear();

    // Add blocks from snapshot
    for (const [key, materialIndex] of snapshot) {
        const [q, r, y] = key.split(',').map(Number);
        addBlock(q, r, y, materialIndex, false);
    }
}

// ============================================================================
// UI
// ============================================================================

function setupUI() {
    createMaterialPalette();
    updateBrushDisplay();
    updateModeButton();
}

function createMaterialPalette() {
    const palette = document.getElementById('material-palette');
    if (!palette) return;

    palette.innerHTML = '';

    MATERIALS.forEach((mat, index) => {
        const btn = document.createElement('button');
        btn.className = 'material-btn' + (index === STATE.currentMaterial ? ' active' : '');
        btn.style.background = mat.color;
        btn.title = `${mat.name} (${index + 1})${mat.behavior ? ' - ' + mat.behavior : ''}`;
        btn.onclick = () => selectMaterial(index);

        // Add number indicator
        if (index < 10) {
            const num = document.createElement('span');
            num.className = 'material-num';
            num.textContent = index + 1;
            btn.appendChild(num);
        }

        palette.appendChild(btn);
    });
}

function selectMaterial(index) {
    STATE.currentMaterial = index;
    audio.playSelect();

    // Update UI
    document.querySelectorAll('.material-btn').forEach((btn, i) => {
        btn.classList.toggle('active', i === index);
    });

    document.getElementById('current-material').textContent = MATERIALS[index].name;
    document.getElementById('current-material').style.color = MATERIALS[index].color;
}

function updateBrushDisplay() {
    const el = document.getElementById('brush-size');
    if (el) el.textContent = STATE.brushSize;
}

function updateModeButton() {
    const btn = document.getElementById('mode-btn');
    if (btn) {
        btn.textContent = STATE.mode === 'orbit' ? 'Fly (F)' : 'Orbit (F)';
    }
}

function updateSoundButton(enabled) {
    const btn = document.getElementById('sound-btn');
    if (btn) {
        btn.innerHTML = enabled ?
            '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z"/></svg>' :
            '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/></svg>';
    }
}

// ============================================================================
// Main Loop
// ============================================================================

function animate() {
    requestAnimationFrame(animate);

    // Update controls
    if (STATE.mode === 'orbit') {
        controls.update();
    } else {
        updateFlyMovement();
    }

    // Update animations
    updateAnimations();

    // Render
    renderer.render(scene, camera);
}

// ============================================================================
// Initialize
// ============================================================================

// Wait for DOM and Three.js
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
