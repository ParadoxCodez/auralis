import * as THREE from 'three';

function halton(index, base) {
    let f = 1;
    let r = 0;
    let i = index;
    while (i > 0) {
        f = f / base;
        r = r + f * (i % base);
        i = Math.floor(i / base);
    }
    return r;
}

export function getSpherePoints(count) {
    const points = [];
    const radius = 4.0;
    const golden = Math.PI * (3 - Math.sqrt(5));

    for (let i = 0; i < count; i++) {
        const y = 1 - (i / (count - 1)) * 2; 
        const r = Math.sqrt(Math.max(0, 1 - y * y));
        const theta = golden * i;
        const jitter = 0.86 + 0.14 * halton(i + 1, 3);

        const x = Math.cos(theta) * r * radius * jitter;
        const yy = y * radius * jitter;
        const z = Math.sin(theta) * r * radius * jitter;

        points.push(x, yy, z);
    }
    return points;
}

export function getHeartPoints(count) {
    const points = [];
    for (let i = 0; i < count; i++) {
        const t = Math.random() * Math.PI * 2;
        const xBase = 16 * Math.pow(Math.sin(t), 3);
        const yBase = 13 * Math.cos(t) - 5 * Math.cos(2*t) - 2 * Math.cos(3*t) - Math.cos(4*t);
        const scale = 0.25;
        const thickness = 2.0 * (1 - Math.abs(t - Math.PI) / Math.PI);
        const z = (Math.random() - 0.5) * thickness * 4.0; 
        const x = xBase * scale;
        const y = yBase * scale;
        points.push(x, y, z);
    }
    return points;
}

export function getFlowerPoints(count) {
    const points = [];
    const k = 5; 
    for (let i = 0; i < count; i++) {
        const u = halton(i + 1, 2) * Math.PI * 2;
        const v = halton(i + 1, 3) * Math.PI;
        const r = 2 + Math.cos(k * u) + Math.sin(v);
        const jitter = (halton(i + 1, 5) - 0.5) * 0.38;
        const jitter2 = (halton(i + 1, 7) - 0.5) * 0.38;
        const x = r * Math.sin(v) * Math.cos(u) + jitter;
        const y = r * Math.sin(v) * Math.sin(u) + jitter2;
        const z = (halton(i + 1, 11) - 0.5) * 0.9;
        points.push(x, y, z);
    }
    return points;
}

export function getSaturnPoints(count) {
    const points = [];
    const planetRatio = 0.42;
    const planetCount = Math.floor(count * planetRatio);
    const ringCount = count - planetCount;

    const golden = Math.PI * (3 - Math.sqrt(5));
    for (let i = 0; i < planetCount; i++) {
        const y = 1 - (i / Math.max(1, (planetCount - 1))) * 2;
        const r = Math.sqrt(Math.max(0, 1 - y * y));
        const theta = golden * i;
        const jitter = 0.86 + 0.14 * halton(i + 1, 3);
        const x = Math.cos(theta) * r * 2.05 * jitter;
        const yy = y * 2.05 * jitter;
        const z = Math.sin(theta) * r * 2.05 * jitter;
        points.push(x, yy, z);
    }

    for (let i = 0; i < ringCount; i++) {
        const angle = halton(i + 1, 2) * Math.PI * 2;
        const t = halton(i + 1, 5);
        const dist = 3.0 + t * 2.6;
        const x = dist * Math.cos(angle);
        const y = (halton(i + 1, 3) - 0.5) * 0.14;
        const z = dist * Math.sin(angle);
        const tilt = 0.45;
        const xr = x;
        const yr = y * Math.cos(tilt) - z * Math.sin(tilt);
        const zr = y * Math.sin(tilt) + z * Math.cos(tilt);
        points.push(xr, yr, zr);
    }
    return points;
}

export function getFireworksPoints(count) {
    const points = [];
    const golden = Math.PI * (3 - Math.sqrt(5));
    for (let i = 0; i < count; i++) {
        const y = 1 - (i / Math.max(1, (count - 1))) * 2;
        const r = Math.sqrt(Math.max(0, 1 - y * y));
        const theta = golden * i;
        const shell = 4.05 + 0.55 * halton(i + 1, 3);
        const trail = 0.18 + 0.82 * halton(i + 1, 5);
        const finalR = shell * trail;
        const x = Math.cos(theta) * r * finalR;
        const yy = y * finalR;
        const z = Math.sin(theta) * r * finalR;
        points.push(x, yy, z);
    }
    return points;
}

export const ShapeGenerators = {
    sphere: getSpherePoints,
    heart: getHeartPoints,
    flower: getFlowerPoints,
    saturn: getSaturnPoints,
    fireworks: getFireworksPoints
};