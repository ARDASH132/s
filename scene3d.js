import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

let scene, camera, renderer, controls;
let generatedObjects = [];

const COLORS = {
    asphalt: 0x303336,
    roadLine: 0xf2f2f2,
    ground: 0xbfc8bc,
    grass: 0x5f7f4f,
    grassDark: 0x436d3e,
    concrete: 0xc8c8c8,
    factoryWall: 0xd8dada,
    roof: 0x9fa6a8,
    warehouseBlue: 0x2e6f9f,
    brick: 0xc48b65,
    redRoof: 0x8f3a32,
    glass: 0x5ca7d8,
    metal: 0x8e9396,
    tree: 0x236b38,
    trunk: 0x6b4423,
    white: 0xffffff,
    black: 0x222222,
    yellow: 0xe0b84f
};

function rand(min, max) {
    return Math.random() * (max - min) + min;
}

function pick(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

function add(obj) {
    scene.add(obj);
    generatedObjects.push(obj);
    return obj;
}

function clearScene() {
    generatedObjects.forEach(obj => scene.remove(obj));
    generatedObjects = [];
}

function mat(color, roughness = 0.8) {
    return new THREE.MeshStandardMaterial({ color, roughness });
}

function box(x, y, z, w, h, d, color) {
    const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(w, h, d),
        mat(color)
    );

    mesh.position.set(x, y + h / 2, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;

    return add(mesh);
}

function cyl(x, y, z, r, h, color, segments = 24) {
    const mesh = new THREE.Mesh(
        new THREE.CylinderGeometry(r, r, h, segments),
        mat(color)
    );

    mesh.position.set(x, y + h / 2, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;

    return add(mesh);
}

function road(x, z, w, d) {
    box(x, 0.02, z, w, 0.12, d, COLORS.asphalt);
}

function roadLine(x, z, w, d) {
    box(x, 0.12, z, w, 0.03, d, COLORS.roadLine);
}

function grass(x, z, w, d, color = COLORS.grass) {
    box(x, 0.01, z, w, 0.06, d, color);
}

function car(x, z, rot = 0) {
    const color = pick([0xffffff, 0x333333, 0x777777, 0x1d5fa8, 0x9a2e2e]);
    const g = new THREE.Group();

    const body = new THREE.Mesh(new THREE.BoxGeometry(4.3, 1.2, 7), mat(color));
    body.position.y = 0.8;

    const cabin = new THREE.Mesh(new THREE.BoxGeometry(3.2, 1.1, 3.4), mat(0x202020));
    cabin.position.set(0, 1.6, -0.4);

    g.add(body, cabin);
    g.position.set(x, 0, z);
    g.rotation.y = rot;

    g.traverse(o => {
        if (o.isMesh) {
            o.castShadow = true;
            o.receiveShadow = true;
        }
    });

    return add(g);
}

function truck(x, z, rot = 0) {
    const g = new THREE.Group();

    const cab = new THREE.Mesh(new THREE.BoxGeometry(7, 4, 7), mat(0xffffff));
    cab.position.set(-6, 2, 0);

    const trailer = new THREE.Mesh(new THREE.BoxGeometry(18, 5, 8), mat(0xcfcfcf));
    trailer.position.set(7, 2.5, 0);

    g.add(cab, trailer);
    g.position.set(x, 0, z);
    g.rotation.y = rot;

    g.traverse(o => {
        if (o.isMesh) {
            o.castShadow = true;
            o.receiveShadow = true;
        }
    });

    return add(g);
}

function tree(x, z, scale = 1) {
    cyl(x, 0, z, 0.75 * scale, 5 * scale, COLORS.trunk, 10);

    const crown1 = new THREE.Mesh(
        new THREE.ConeGeometry(4.5 * scale, 10 * scale, 14),
        mat(COLORS.tree)
    );
    crown1.position.set(x, 8 * scale, z);
    crown1.castShadow = true;
    crown1.receiveShadow = true;
    add(crown1);

    const crown2 = new THREE.Mesh(
        new THREE.ConeGeometry(3.4 * scale, 8 * scale, 14),
        mat(COLORS.tree)
    );
    crown2.position.set(x, 14 * scale, z);
    crown2.castShadow = true;
    crown2.receiveShadow = true;
    add(crown2);
}

function lamp(x, z) {
    cyl(x, 0, z, 0.18, 8, 0x222222, 12);
    box(x, 8, z, 1.8, 0.8, 1.8, 0xffeaa0);
}

function bench(x, z, rot = 0) {
    const g = new THREE.Group();

    const seat = new THREE.Mesh(new THREE.BoxGeometry(7, 0.5, 1.6), mat(0x7a4a2a));
    seat.position.y = 1.1;

    const back = new THREE.Mesh(new THREE.BoxGeometry(7, 0.5, 1.6), mat(0x7a4a2a));
    back.position.set(0, 2.1, 0.9);

    g.add(seat, back);
    g.position.set(x, 0, z);
    g.rotation.y = rot;

    return add(g);
}

function parkingLot(x, z, rows = 2, cols = 7) {
    const w = cols * 9 + 12;
    const d = rows * 16 + 12;

    box(x, 0.03, z, w, 0.12, d, 0x4a4a4a);

    for (let c = 0; c <= cols; c++) {
        roadLine(x - w / 2 + 6 + c * 9, z, 0.25, d - 5);
    }

    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            if (Math.random() > 0.25) {
                car(
                    x - w / 2 + 10 + c * 9,
                    z - d / 2 + 10 + r * 16,
                    0
                );
            }
        }
    }
}

function factory(x, z, scale = 1) {
    box(x, 0, z, 95 * scale, 22 * scale, 56 * scale, COLORS.factoryWall);
    box(x, 22 * scale, z, 95 * scale, 5 * scale, 56 * scale, COLORS.roof);

    box(x - 25 * scale, 27 * scale, z, 35 * scale, 14 * scale, 56 * scale, 0xc9cecc);
    box(x + 28 * scale, 27 * scale, z, 25 * scale, 12 * scale, 42 * scale, 0xbfc5c3);

    for (let i = -35; i <= 35; i += 18) {
        box(x + i * scale, 43 * scale, z - 18 * scale, 9 * scale, 2 * scale, 7 * scale, 0xa9b0af);
        box(x + i * scale, 43 * scale, z + 18 * scale, 9 * scale, 2 * scale, 7 * scale, 0xa9b0af);
    }

    for (let i = -25; i <= 25; i += 20) {
        box(x + i * scale, 0.2, z - 28.5 * scale, 10 * scale, 10 * scale, 1, 0x5b6266);
    }

    cyl(x + 18 * scale, 39 * scale, z + 12 * scale, 3.1 * scale, 40 * scale, 0xaaaaaa);
    cyl(x + 31 * scale, 39 * scale, z + 12 * scale, 2.8 * scale, 48 * scale, 0xb4b4b4);

    box(x + 18 * scale, 75 * scale, z + 12 * scale, 6 * scale, 5 * scale, 6 * scale, 0xb43a3a);
    box(x + 31 * scale, 83 * scale, z + 12 * scale, 6 * scale, 5 * scale, 6 * scale, 0xb43a3a);
}

function warehouse(x, z, scale = 1) {
    box(x, 0, z, 75 * scale, 19 * scale, 45 * scale, COLORS.warehouseBlue);
    box(x, 19 * scale, z, 75 * scale, 5 * scale, 45 * scale, 0xa9bdcc);

    for (let i = -22; i <= 22; i += 15) {
        box(x + i * scale, 24 * scale, z - 15 * scale, 9 * scale, 1.5 * scale, 14 * scale, 0xdce8ef);
    }

    for (let i = -24; i <= 24; i += 16) {
        box(x + i * scale, 0.2, z - 23 * scale, 10 * scale, 9 * scale, 1, 0xf5f5f5);
    }
}

function office(x, z, scale = 1) {
    box(x, 0, z, 42 * scale, 28 * scale, 30 * scale, 0xd7dde3);
    box(x, 28 * scale, z, 42 * scale, 2 * scale, 30 * scale, COLORS.roof);

    for (let floor = 0; floor < 4; floor++) {
        for (let i = -13; i <= 13; i += 9) {
            box(x + i * scale, 6 * scale + floor * 6 * scale, z - 15.2 * scale, 4.8 * scale, 3 * scale, 0.35, COLORS.glass);
        }
    }
}

function apartment(x, z, floors = 9, scale = 1) {
    const h = floors * 4.2 * scale;

    box(x, 0, z, 32 * scale, h, 23 * scale, 0xd7d7d7);
    box(x, h, z, 32 * scale, 2 * scale, 23 * scale, 0x8fa7bd);

    for (let f = 0; f < floors; f++) {
        for (let i = -10; i <= 10; i += 10) {
            box(x + i * scale, 4 * scale + f * 4.2 * scale, z - 11.8 * scale, 4.2 * scale, 2.4 * scale, 0.35, COLORS.glass);
        }
    }
}

function house(x, z, scale = 1) {
    box(x, 0, z, 23 * scale, 9 * scale, 17 * scale, 0xd7c0a5);
    box(x, 9 * scale, z, 25 * scale, 4 * scale, 19 * scale, COLORS.redRoof);
}

function kindergarten(x, z, scale = 1) {
    box(x, 0, z, 58 * scale, 15 * scale, 34 * scale, COLORS.brick);
    box(x, 15 * scale, z, 58 * scale, 3 * scale, 34 * scale, COLORS.redRoof);

    for (let i = -20; i <= 20; i += 12) {
        box(x + i * scale, 6 * scale, z - 17.2 * scale, 7 * scale, 4 * scale, 0.35, COLORS.glass);
    }

    grass(x, z + 32 * scale, 58 * scale, 24 * scale);
}

function college(x, z, scale = 1) {
    box(x, 0, z, 70 * scale, 22 * scale, 38 * scale, 0xd6d0c5);
    box(x, 22 * scale, z, 70 * scale, 3 * scale, 38 * scale, 0x909090);

    for (let i = -25; i <= 25; i += 12) {
        box(x + i * scale, 8 * scale, z - 19.2 * scale, 7 * scale, 5 * scale, 0.35, COLORS.glass);
    }
}

function sportsField(x, z) {
    grass(x, z, 80, 48, 0x2d8b57);
    roadLine(x, z, 2, 48);
    roadLine(x, z, 80, 2);
    roadLine(x - 35, z, 2, 34);
    roadLine(x + 35, z, 2, 34);
}

function substation(x, z) {
    box(x, 0, z, 44, 5, 30, 0x777777);

    for (let i = -14; i <= 14; i += 14) {
        cyl(x + i, 5, z, 1.4, 14, 0x777777);
        box(x + i, 19, z, 7, 3, 7, 0xaaaaaa);
    }

    cyl(x - 32, 0, z - 18, 1.5, 32, 0x888888);
    cyl(x + 32, 0, z - 18, 1.5, 32, 0x888888);
}

function createRoads() {
    road(0, -120, 520, 18);
    road(0, 45, 520, 16);
    road(-170, -20, 16, 330);
    road(170, -20, 16, 330);
    road(0, -20, 16, 260);

    road(-80, -55, 180, 13);
    road(90, -55, 170, 13);
    road(90, 5, 170, 13);
    road(-90, 130, 190, 13);
    road(105, 130, 170, 13);

    roadLine(0, -120, 480, 0.5);
    roadLine(0, 45, 480, 0.45);
    roadLine(-170, -20, 0.45, 300);
    roadLine(170, -20, 0.45, 300);
}

function addIndustrial(userChoice) {
    const volume = Number(userChoice.volume || 400);
    const scale = volume >= 700 ? 1.15 : volume >= 350 ? 1 : 0.82;

    factory(0, -10, scale);
    warehouse(125, -15, 0.85);
    office(-125, -65, 0.9);

    parkingLot(-70, -160, 2, 7);
    parkingLot(45, -160, 2, 7);

    substation(210, -125);

    for (let i = 0; i < 6; i++) {
        truck(70 + i * 15, -65, Math.PI / 2);
    }
}

function addResidential(userChoice) {
    const housingPct = Number(userChoice.housingPct || 0);
    if (housingPct <= 0) return;

    const employees = Number(userChoice.employees || 80);
    const count = Math.min(8, Math.max(2, Math.ceil((employees * housingPct / 100) / 35)));

    for (let i = 0; i < count; i++) {
        const row = Math.floor(i / 4);
        const col = i % 4;

        const x = -190 + col * 62 + rand(-3, 3);
        const z = 120 + row * 58 + rand(-3, 3);

        if (userChoice.housingType === "Общежитие") {
            house(x, z, 0.9);
        } else {
            apartment(x, z, Math.random() > 0.45 ? 9 : 5, 0.75);
        }
    }
}

function addSocial(userChoice) {
    if (Number(userChoice.kinderPlaces || 0) > 0) {
        kindergarten(75, 140, 0.86);
    }

    if ((userChoice.employees || 0) >= 90) {
        college(170, 135, 0.75);
    }

    if ((userChoice.sportsList || []).length > 0) {
        sportsField(165, 205);
        bench(115, 230, 0);
        bench(140, 230, 0);
    }
}

function addGreenery(userChoice) {
    const count = 85 + (userChoice.landscapingList || []).length * 15;

    for (let i = 0; i < count; i++) {
        let x, z;

        if (i < count * 0.3) {
            x = rand(-250, 250);
            z = rand(230, 265);
        } else if (i < count * 0.52) {
            x = rand(-250, 250);
            z = rand(-260, -230);
        } else if (i < count * 0.75) {
            x = rand(-260, -230);
            z = rand(-225, 225);
        } else {
            x = rand(230, 260);
            z = rand(-225, 225);
        }

        tree(x, z, rand(0.65, 1.05));
    }

    for (let x = -220; x <= 220; x += 45) {
        lamp(x, -118);
        lamp(x, 45);
    }

    bench(-210, 95, 0);
    bench(-185, 95, 0.2);
    bench(95, 185, 0);
}

function addGroundZones() {
    grass(-155, 150, 220, 135);
    grass(145, 165, 160, 115);
    grass(-205, -190, 110, 70);
    grass(210, -190, 95, 70);
}

export function initScene(containerId = "scene3d") {
    const container = document.getElementById(containerId);

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0xdce6eb);

    camera = new THREE.PerspectiveCamera(
        45,
        container.clientWidth / container.clientHeight,
        0.1,
        3000
    );

    camera.position.set(215, 165, 215);

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio || 1);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    container.innerHTML = "";
    container.appendChild(renderer.domElement);

    controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 0, 25);
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.minDistance = 70;
    controls.maxDistance = 430;
    controls.update();

    scene.add(new THREE.AmbientLight(0xffffff, 1.15));

    const sun = new THREE.DirectionalLight(0xffffff, 2.4);
    sun.position.set(180, 260, 150);
    sun.castShadow = true;
    scene.add(sun);

    const ground = new THREE.Mesh(
        new THREE.PlaneGeometry(560, 520),
        mat(COLORS.ground, 1)
    );

    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    animate();

    window.addEventListener("resize", () => {
        camera.aspect = container.clientWidth / container.clientHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(container.clientWidth, container.clientHeight);
    });
}

function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
}

export function renderIndustrialScene(userChoice = {}) {
    if (!scene) initScene();

    clearScene();

    const safeChoice = {
        volume: Number(userChoice.volume || 400),
        employees: Number(userChoice.employees || 80),
        housingPct: Number(userChoice.housingPct || 0),
        housingType: userChoice.housingType || "Квартиры",
        kinderPlaces: Number(userChoice.kinderPlaces || 0),
        sportsList: userChoice.sportsList || [],
        landscapingList: userChoice.landscapingList || []
    };

    addGroundZones();
    createRoads();
    addIndustrial(safeChoice);
    addResidential(safeChoice);
    addSocial(safeChoice);
    addGreenery(safeChoice);

    console.log("Реалистичная сцена создана по параметрам:", safeChoice);
}