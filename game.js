/* CITY DRIVE - Game Engine | Developed by Jyotish */

const CONFIG = {
    cars: [
        { name: 'AVENTADOR', file: 'car1.glb', speed: 95, handling: 85, power: 90, maxSpeed: 220, accel: 55 },
        { name: 'LAMBORGHINI', file: 'car2.glb', speed: 88, handling: 92, power: 82, maxSpeed: 200, accel: 50 },
        { name: 'MONSTER TRUCK', file: 'car3.glb', speed: 55, handling: 70, power: 95, maxSpeed: 140, accel: 35 }
    ],
    map: { size: 2000, roadWidth: 15 },
    camera: { distance: 12, height: 6, smooth: 0.08 },
    sounds: {
        engine: 'https://assets.mixkit.co/active_storage/sfx/2571/2571-preview.mp3',
        horn: 'https://assets.mixkit.co/active_storage/sfx/2578/2578-preview.mp3'
    }
};

const State = {
    screen: 'splash', carIndex: 0, paused: false, speed: 0, steering: 0,
    gas: false, brake: false, cameraAngleX: 0, cameraAngleY: 0.3,
    garageScene: null, garageCamera: null, garageRenderer: null, garageControls: null, garageCar: null,
    gameScene: null, gameCamera: null, gameRenderer: null, carModel: null, carBody: null, world: null,
    engineSound: null, hornSound: null
};

const $ = id => document.getElementById(id);
const screens = { splash: $('splash-screen'), loading: $('loading-screen'), menu: $('main-menu'), garage: $('garage-screen'), game: $('game-screen') };

const showScreen = name => {
    Object.values(screens).forEach(s => s.classList.remove('active'));
    screens[name]?.classList.add('active');
    State.screen = name;
};

const progress = (p, t) => {
    $('progress-bar').style.width = p + '%';
    $('progress-text').textContent = t || `Loading... ${p}%`;
};

const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

const Audio = {
    init() {
        State.engineSound = new window.Audio(CONFIG.sounds.engine);
        State.engineSound.loop = true;
        State.engineSound.volume = 0.3;
        State.hornSound = new window.Audio(CONFIG.sounds.horn);
        State.hornSound.volume = 0.5;
    },
    playEngine() { State.engineSound?.play().catch(()=>{}); },
    stopEngine() { State.engineSound?.pause(); },
    updateEngine(speed) {
        if (State.engineSound) State.engineSound.playbackRate = 0.8 + (Math.abs(speed) / 200) * 0.6;
    },
    horn() {
        if (State.hornSound) { State.hornSound.currentTime = 0; State.hornSound.play().catch(()=>{}); }
    }
};

const Garage = {
    init() {
        const container = $('garage-container');
        State.garageScene = new THREE.Scene();
        State.garageScene.background = new THREE.Color(0x0a0a15);
        State.garageCamera = new THREE.PerspectiveCamera(50, window.innerWidth/window.innerHeight, 0.1, 1000);
        State.garageCamera.position.set(5, 2.5, 5);
        State.garageRenderer = new THREE.WebGLRenderer({ antialias: true });
        State.garageRenderer.setSize(window.innerWidth, window.innerHeight);
        State.garageRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        container.innerHTML = '';
        container.appendChild(State.garageRenderer.domElement);

        State.garageControls = new THREE.OrbitControls(State.garageCamera, State.garageRenderer.domElement);
        State.garageControls.enableZoom = false;
        State.garageControls.enablePan = false;
        State.garageControls.minPolarAngle = Math.PI/4;
        State.garageControls.maxPolarAngle = Math.PI/2.2;
        State.garageControls.autoRotate = true;
        State.garageControls.autoRotateSpeed = 1.5;

        State.garageScene.add(new THREE.AmbientLight(0xffffff, 0.5));
        const spot1 = new THREE.SpotLight(0x00ff88, 1.5); spot1.position.set(5, 10, 5); State.garageScene.add(spot1);
        const spot2 = new THREE.SpotLight(0x00d4ff, 0.8); spot2.position.set(-5, 8, -5); State.garageScene.add(spot2);

        const floor = new THREE.Mesh(new THREE.CircleGeometry(8, 64), new THREE.MeshStandardMaterial({ color: 0x111118, metalness: 0.9, roughness: 0.1 }));
        floor.rotation.x = -Math.PI/2;
        State.garageScene.add(floor);

        this.loadCar(State.carIndex);
        this.animate();
    },

    loadCar(index) {
        const car = CONFIG.cars[index];
        if (State.garageCar) State.garageScene.remove(State.garageCar);

        const loader = new THREE.GLTFLoader();
        loader.load(car.file, gltf => {
            State.garageCar = gltf.scene;
            const box = new THREE.Box3().setFromObject(State.garageCar);
            const size = box.getSize(new THREE.Vector3());
            const scale = 2.5 / Math.max(size.x, size.y, size.z);
            State.garageCar.scale.setScalar(scale);
            State.garageCar.position.y = 0;
            State.garageScene.add(State.garageCar);
            this.updateUI(index);
        }, undefined, () => {
            State.garageCar = new THREE.Mesh(new THREE.BoxGeometry(2, 1, 4), new THREE.MeshStandardMaterial({ color: 0xff0044 }));
            State.garageCar.position.y = 0.5;
            State.garageScene.add(State.garageCar);
            this.updateUI(index);
        });
    },

    updateUI(i) {
        const c = CONFIG.cars[i];
        $('car-name').textContent = c.name;
        $('stat-speed').style.width = c.speed + '%';
        $('stat-handling').style.width = c.handling + '%';
        $('stat-power').style.width = c.power + '%';
    },

    next() { State.carIndex = (State.carIndex + 1) % CONFIG.cars.length; this.loadCar(State.carIndex); },
    prev() { State.carIndex = (State.carIndex - 1 + CONFIG.cars.length) % CONFIG.cars.length; this.loadCar(State.carIndex); },

    animate() {
        if (State.screen !== 'garage') return;
        requestAnimationFrame(() => this.animate());
        State.garageControls?.update();
        State.garageRenderer?.render(State.garageScene, State.garageCamera);
    },

    destroy() { $('garage-container').innerHTML = ''; State.garageRenderer?.dispose(); }
};

const Game = {
    init() {
        this.initPhysics();
        this.initGraphics();
        this.createMap();
        this.initControls();
    },

    initPhysics() {
        State.world = new CANNON.World();
        State.world.gravity.set(0, -30, 0);
        State.world.broadphase = new CANNON.SAPBroadphase(State.world);
        const ground = new CANNON.Body({ mass: 0, shape: new CANNON.Plane() });
        ground.quaternion.setFromAxisAngle(new CANNON.Vec3(1,0,0), -Math.PI/2);
        State.world.addBody(ground);
    },

    initGraphics() {
        const container = $('game-container');
        State.gameScene = new THREE.Scene();
        State.gameScene.background = new THREE.Color(0x87ceeb);
        State.gameScene.fog = new THREE.Fog(0x87ceeb, 100, 800);
        State.gameCamera = new THREE.PerspectiveCamera(65, window.innerWidth/window.innerHeight, 0.1, 2000);
        State.gameRenderer = new THREE.WebGLRenderer({ antialias: true });
        State.gameRenderer.setSize(window.innerWidth, window.innerHeight);
        State.gameRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        State.gameRenderer.shadowMap.enabled = true;
        container.innerHTML = '';
        container.appendChild(State.gameRenderer.domElement);

        State.gameScene.add(new THREE.AmbientLight(0xffffff, 0.6));
        const sun = new THREE.DirectionalLight(0xffffff, 1);
        sun.position.set(100, 150, 100);
        sun.castShadow = true;
        sun.shadow.mapSize.set(2048, 2048);
        sun.shadow.camera.far = 500;
        sun.shadow.camera.left = sun.shadow.camera.bottom = -200;
        sun.shadow.camera.right = sun.shadow.camera.top = 200;
        State.gameScene.add(sun);
    },

    createMap() {
        const S = CONFIG.map.size;
        const ground = new THREE.Mesh(new THREE.PlaneGeometry(S, S, 50, 50), new THREE.MeshStandardMaterial({ color: 0xc2956e, roughness: 0.9 }));
        ground.rotation.x = -Math.PI/2; ground.receiveShadow = true; State.gameScene.add(ground);

        const roadMat = new THREE.MeshStandardMaterial({ color: 0x333333 });
        const roadW = CONFIG.map.roadWidth;
        const outerRadius = 600;

        const roadRing = new THREE.Mesh(new THREE.RingGeometry(outerRadius - roadW, outerRadius + roadW, 64), roadMat);
        roadRing.rotation.x = -Math.PI/2; roadRing.position.y = 0.1; State.gameScene.add(roadRing);

        const crossRoad1 = new THREE.Mesh(new THREE.PlaneGeometry(roadW*2, S*0.8), roadMat);
        crossRoad1.rotation.x = -Math.PI/2; crossRoad1.position.y = 0.1; State.gameScene.add(crossRoad1);

        const crossRoad2 = new THREE.Mesh(new THREE.PlaneGeometry(S*0.8, roadW*2), roadMat);
        crossRoad2.rotation.x = -Math.PI/2; crossRoad2.position.y = 0.1; State.gameScene.add(crossRoad2);

        const innerRing = new THREE.Mesh(new THREE.RingGeometry(250 - roadW/2, 250 + roadW/2, 48), roadMat);
        innerRing.rotation.x = -Math.PI/2; innerRing.position.y = 0.1; State.gameScene.add(innerRing);

        const markMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
        for (let a = 0; a < Math.PI * 2; a += 0.15) {
            const mark = new THREE.Mesh(new THREE.PlaneGeometry(3, 0.5), markMat);
            mark.rotation.x = -Math.PI/2; mark.rotation.z = a;
            mark.position.set(Math.cos(a) * outerRadius, 0.15, Math.sin(a) * outerRadius);
            State.gameScene.add(mark);
        }

        const hillMat = new THREE.MeshStandardMaterial({ color: 0x8b7355 });
        for (let i = 0; i < 30; i++) {
            const angle = Math.random() * Math.PI * 2;
            const dist = 700 + Math.random() * 200;
            const hill = new THREE.Mesh(new THREE.ConeGeometry(30 + Math.random()*50, 40 + Math.random()*80, 8), hillMat);
            hill.position.set(Math.cos(angle)*dist, 0, Math.sin(angle)*dist);
            hill.castShadow = true; State.gameScene.add(hill);
        }

        const rockMat = new THREE.MeshStandardMaterial({ color: 0x666666 });
        for (let i = 0; i < 100; i++) {
            const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(2 + Math.random()*5), rockMat);
            rock.position.set((Math.random()-0.5)*S*0.7, Math.random()*2, (Math.random()-0.5)*S*0.7);
            rock.rotation.set(Math.random(), Math.random(), Math.random());
            rock.castShadow = true; State.gameScene.add(rock);
        }

        const treeTrunk = new THREE.MeshStandardMaterial({ color: 0x4a3728 });
        const treeLeaves = new THREE.MeshStandardMaterial({ color: 0x2d5a27 });
        for (let i = 0; i < 60; i++) {
            const x = (Math.random()-0.5)*S*0.6, z = (Math.random()-0.5)*S*0.6;
            const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.8, 5), treeTrunk);
            trunk.position.set(x, 2.5, z); trunk.castShadow = true; State.gameScene.add(trunk);
            const leaves = new THREE.Mesh(new THREE.ConeGeometry(4, 8, 8), treeLeaves);
            leaves.position.set(x, 8, z); leaves.castShadow = true; State.gameScene.add(leaves);
        }

        const barrierMat = new THREE.MeshStandardMaterial({ color: 0xff4444 });
        const barrierSize = S/2 - 50;
        [[-barrierSize,0], [barrierSize,0], [0,-barrierSize], [0,barrierSize]].forEach(([x,z], i) => {
            const barrier = new THREE.Mesh(new THREE.BoxGeometry(i<2 ? 10 : S, 5, i<2 ? S : 10), barrierMat);
            barrier.position.set(x, 2.5, z); State.gameScene.add(barrier);
            const wallBody = new CANNON.Body({ mass: 0, shape: new CANNON.Box(new CANNON.Vec3(i<2 ? 5 : S/2, 5, i<2 ? S/2 : 5)) });
            wallBody.position.set(x, 2.5, z); State.world.addBody(wallBody);
        });
    },

    async loadCar() {
        const car = CONFIG.cars[State.carIndex];
        return new Promise(resolve => {
            const loader = new THREE.GLTFLoader();
            loader.load(car.file, gltf => {
                State.carModel = gltf.scene;
                const box = new THREE.Box3().setFromObject(State.carModel);
                const size = box.getSize(new THREE.Vector3());
                const scale = 2 / Math.max(size.x, size.y, size.z);
                State.carModel.scale.setScalar(scale);
                State.carModel.traverse(c => { if(c.isMesh) { c.castShadow = true; c.receiveShadow = true; }});
                State.gameScene.add(State.carModel);
                State.carBody = new CANNON.Body({ mass: 800, shape: new CANNON.Box(new CANNON.Vec3(1, 0.5, 2)), position: new CANNON.Vec3(0, 2, 0), linearDamping: 0.4, angularDamping: 0.6 });
                State.world.addBody(State.carBody);
                resolve();
            }, undefined, () => {
                State.carModel = new THREE.Mesh(new THREE.BoxGeometry(2, 1, 4), new THREE.MeshStandardMaterial({ color: 0xff0044 }));
                State.carModel.castShadow = true; State.gameScene.add(State.carModel);
                State.carBody = new CANNON.Body({ mass: 800, shape: new CANNON.Box(new CANNON.Vec3(1, 0.5, 2)), position: new CANNON.Vec3(0, 2, 0) });
                State.world.addBody(State.carBody);
                resolve();
            });
        });
    },

    initControls() {
        const steer = $('steering-wheel');
        let startAngle = 0, currentAngle = 0;
        const getAngle = (cx, cy, px, py) => Math.atan2(py - cy, px - cx);

        steer.addEventListener('touchstart', e => {
            e.preventDefault();
            const t = e.touches[0], r = steer.getBoundingClientRect();
            startAngle = getAngle(r.left + r.width/2, r.top + r.height/2, t.clientX, t.clientY) - currentAngle;
        });
        steer.addEventListener('touchmove', e => {
            e.preventDefault();
            const t = e.touches[0], r = steer.getBoundingClientRect();
            currentAngle = getAngle(r.left + r.width/2, r.top + r.height/2, t.clientX, t.clientY) - startAngle;
            currentAngle = clamp(currentAngle, -Math.PI/2, Math.PI/2);
            steer.style.transform = `rotate(${currentAngle * 57.3}deg)`;
            State.steering = currentAngle / (Math.PI/2);
        });
        steer.addEventListener('touchend', () => { currentAngle = 0; steer.style.transform = 'rotate(0deg)'; State.steering = 0; });

        const setupPedal = (id, key) => {
            const btn = $(id);
            btn.addEventListener('touchstart', e => { e.preventDefault(); State[key] = true; });
            btn.addEventListener('touchend', () => State[key] = false);
            btn.addEventListener('mousedown', () => State[key] = true);
            btn.addEventListener('mouseup', () => State[key] = false);
            btn.addEventListener('mouseleave', () => State[key] = false);
        };
        setupPedal('gas-btn', 'gas');
        setupPedal('brake-btn', 'brake');

        $('horn-btn').addEventListener('touchstart', e => { e.preventDefault(); Audio.horn(); });
        $('horn-btn').addEventListener('click', Audio.horn);
        $('pause-btn').addEventListener('click', () => this.togglePause());
        $('resume-btn').addEventListener('click', () => this.togglePause());
        $('reset-btn').addEventListener('click', () => { this.resetCar(); this.togglePause(); });
        $('change-car-btn').addEventListener('click', () => { this.togglePause(); Audio.stopEngine(); showScreen('garage'); Garage.init(); });

        let camTouchId = null, camLastX = 0, camLastY = 0;
        const gameContainer = $('game-container');
        gameContainer.addEventListener('touchstart', e => { if (camTouchId !== null) return; const t = e.changedTouches[0]; camTouchId = t.identifier; camLastX = t.clientX; camLastY = t.clientY; });
        gameContainer.addEventListener('touchmove', e => { for (let t of e.changedTouches) { if (t.identifier === camTouchId) { State.cameraAngleX -= (t.clientX - camLastX) * 0.005; State.cameraAngleY = clamp(State.cameraAngleY + (t.clientY - camLastY) * 0.003, 0.1, 0.8); camLastX = t.clientX; camLastY = t.clientY; } } });
        gameContainer.addEventListener('touchend', e => { for (let t of e.changedTouches) { if (t.identifier === camTouchId) camTouchId = null; } });

        document.addEventListener('keydown', e => {
            if (State.screen !== 'game') return;
            if (e.key === 'ArrowUp' || e.key === 'w') State.gas = true;
            if (e.key === 'ArrowDown' || e.key === 's') State.brake = true;
            if (e.key === 'ArrowLeft' || e.key === 'a') State.steering = -1;
            if (e.key === 'ArrowRight' || e.key === 'd') State.steering = 1;
            if (e.key === 'h') Audio.horn();
            if (e.key === 'Escape') this.togglePause();
        });
        document.addEventListener('keyup', e => {
            if (e.key === 'ArrowUp' || e.key === 'w') State.gas = false;
            if (e.key === 'ArrowDown' || e.key === 's') State.brake = false;
            if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'ArrowRight' || e.key === 'd') State.steering = 0;
        });
    },

    async start() {
        showScreen('loading');
        progress(10, 'Initializing...');
        this.init();
        progress(40, 'Loading car...');
        await this.loadCar();
        progress(80, 'Preparing world...');
        await new Promise(r => setTimeout(r, 500));
        progress(100, 'Ready!');
        await new Promise(r => setTimeout(r, 400));
        showScreen('game');
        $('camera-hint').classList.add('show');
        setTimeout(() => $('camera-hint').classList.remove('show'), 4000);
        this.requestFullscreen();
        Audio.playEngine();
        this.loop();
    },

    loop() {
        if (State.screen !== 'game') return;
        requestAnimationFrame(() => this.loop());
        if (State.paused) return;
        State.world.step(1/60);
        this.updateCar();
        this.updateCamera();
        this.updateUI();
        Audio.updateEngine(State.speed);
        State.gameRenderer.render(State.gameScene, State.gameCamera);
    },

    updateCar() {
        if (!State.carBody) return;
        const car = CONFIG.cars[State.carIndex];
        const fwd = new CANNON.Vec3(0, 0, 1);
        State.carBody.quaternion.vmult(fwd, fwd);
        State.speed = State.carBody.velocity.length() * 3.6;

        if (State.gas && State.speed < car.maxSpeed) {
            State.carBody.applyForce(fwd.scale(car.accel * 100), State.carBody.position);
        }
        if (State.brake) {
            State.carBody.applyForce(fwd.scale(State.speed > 5 ? -car.accel * 150 : -car.accel * 60), State.carBody.position);
        }
        if (Math.abs(State.steering) > 0.05 && State.speed > 2) {
            State.carBody.angularVelocity.y = -State.steering * (car.handling / 100) * 4;
        }
        State.carModel.position.copy(State.carBody.position);
        State.carModel.quaternion.copy(State.carBody.quaternion);
    },

    updateCamera() {
        if (!State.carModel) return;
        const offset = new THREE.Vector3(Math.sin(State.cameraAngleX) * CONFIG.camera.distance, CONFIG.camera.height + State.cameraAngleY * 5, Math.cos(State.cameraAngleX) * CONFIG.camera.distance);
        offset.applyQuaternion(State.carModel.quaternion);
        State.gameCamera.position.lerp(State.carModel.position.clone().add(offset), CONFIG.camera.smooth);
        const lookAt = State.carModel.position.clone(); lookAt.y += 1;
        State.gameCamera.lookAt(lookAt);
    },

    updateUI() {
        const speed = Math.round(Math.abs(State.speed));
        $('speed-val').textContent = speed;
        $('speed-arc').setAttribute('stroke-dasharray', `${(speed / CONFIG.cars[State.carIndex].maxSpeed) * 251} 251`);

        const canvas = $('minimap-canvas'), ctx = canvas.getContext('2d');
        canvas.width = 100; canvas.height = 100;
        ctx.fillStyle = '#1a1a2e'; ctx.fillRect(0, 0, 100, 100);
        ctx.strokeStyle = '#333'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(50, 50, 30, 0, Math.PI * 2); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(50, 10); ctx.lineTo(50, 90); ctx.moveTo(10, 50); ctx.lineTo(90, 50); ctx.stroke();

        if (State.carModel) {
            const mapScale = 40 / CONFIG.map.size;
            ctx.save();
            ctx.translate(clamp(50 + State.carModel.position.x * mapScale, 8, 92), clamp(50 + State.carModel.position.z * mapScale, 8, 92));
            ctx.rotate(State.carModel.rotation.y);
            ctx.fillStyle = '#00ff88';
            ctx.beginPath(); ctx.moveTo(0, -6); ctx.lineTo(-4, 4); ctx.lineTo(4, 4); ctx.closePath(); ctx.fill();
            ctx.restore();
        }
    },

    togglePause() {
        State.paused = !State.paused;
        $('pause-menu').classList.toggle('active', State.paused);
        if (State.paused) Audio.stopEngine(); else Audio.playEngine();
    },

    resetCar() {
        if (State.carBody) {
            State.carBody.position.set(0, 3, 0);
            State.carBody.velocity.set(0, 0, 0);
            State.carBody.angularVelocity.set(0, 0, 0);
            State.carBody.quaternion.set(0, 0, 0, 1);
        }
    },

    requestFullscreen() {
        const el = document.documentElement;
        (el.requestFullscreen || el.webkitRequestFullscreen)?.call(el).catch(()=>{});
        screen.orientation?.lock?.('landscape').catch(()=>{});
    }
};

$('play-btn').addEventListener('click', () => { showScreen('garage'); Garage.init(); });
$('prev-car').addEventListener('click', () => Garage.prev());
$('next-car').addEventListener('click', () => Garage.next());
$('select-car').addEventListener('click', () => { Garage.destroy(); Game.start(); });
$('garage-back').addEventListener('click', () => { Garage.destroy(); showScreen('menu'); });

window.addEventListener('resize', () => {
    const w = window.innerWidth, h = window.innerHeight;
    if (State.garageCamera) { State.garageCamera.aspect = w/h; State.garageCamera.updateProjectionMatrix(); State.garageRenderer?.setSize(w, h); }
    if (State.gameCamera) { State.gameCamera.aspect = w/h; State.gameCamera.updateProjectionMatrix(); State.gameRenderer?.setSize(w, h); }
});

(async () => { Audio.init(); await new Promise(r => setTimeout(r, 2500)); showScreen('menu'); })();
