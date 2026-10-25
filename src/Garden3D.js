// Hafiz Bahcesi - kodla sifirdan kurulan GERCEK 3B bahce (three.js + expo-gl).
// Gokyuzu, daglar, cimen, kivrimli tas yol, kir cicekleri, golgeler hepsi kodla uretilir.
// Sadece agaclar bizim gorsellerimizdir (billboard olarak yola dizilir).
import React, { useRef, useEffect, useImperativeHandle, forwardRef } from 'react';
import { View, PanResponder, Dimensions } from 'react-native';
import { GLView } from 'expo-gl';
import { Renderer, TextureLoader } from 'expo-three';
import * as THREE from 'three';
import { GARDEN_IMG } from './assets';

THREE.ColorManagement.enabled = false;
const { width: SW, height: SH } = Dimensions.get('window');

export const pathX = (d) => Math.sin(d * 0.055) * 4.2 + Math.cos(d * 0.025) * 1.8;     // d: yol uzerinde ilerleme (m)
export const treeDist = (i) => 12 + i * 7.5;
const treeSide = (i) => (i % 2 === 0 ? 1 : -1);                                            // 1. agac SAGDA
const treeLat = (i) => treeSide(i) * (5.0 + (i % 3) * 1.5);
const treeX = (i) => pathX(treeDist(i)) + treeLat(i);
const TV = (i) => 0.92 + ((i * 37) % 21) / 100;
const EYE = 1.9, WALK_BACK = 10.5, NEAR_BACK = 5.6;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const rnd = (() => { let s = 12345; return () => { s = (s * 16807) % 2147483647; return s / 2147483647; }; })();

function grassTexture() {
  const N = 128, data = new Uint8Array(N * N * 4);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const o = (y * N + x) * 4, c = Math.sin(x * 0.35) * Math.cos(y * 0.28) * 10 + rnd() * 34 - 17;
    data[o] = clamp(76 + c * 0.7, 0, 255); data[o + 1] = clamp(128 + c * 1.5, 0, 255); data[o + 2] = clamp(44 + c * 0.5, 0, 255); data[o + 3] = 255;
  }
  const t = new THREE.DataTexture(data, N, N, THREE.RGBAFormat);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(220, 220); t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter; t.generateMipmaps = true; t.needsUpdate = true;
  return t;
}

const Garden3D = forwardRef(function Garden3D({ trees, enabled, onNear, onTap, onLabel, onFail, onReady, onWarn }, ref) {
  const S = useRef({ cb: {}, enabled: true, trees }).current;
  S.cb = { onNear, onTap, onLabel, onFail, onReady, onWarn }; S.enabled = enabled;

  const api = {
    walkTo(i, cb) { const g = S.g; if (!g) return; g.mode = 'walk'; g.tgt.d = treeDist(i) - WALK_BACK; g.tgt.h = EYE; g.tgt.pitch = 0.1; g.tgt.yaw = g.faceYaw(i, g.tgt.d); g.tgt.free = false; g.sel = i; g.done = cb ? [{ at: () => Math.abs(g.cur.d - g.tgt.d) < 0.12 && Math.abs(g.cur.yaw - g.tgt.yaw) < 0.02, fn: cb }] : []; g.dirty = true; },
    approach(i, cb) { const g = S.g; if (!g) return; g.tgt.d = treeDist(i) - NEAR_BACK; g.tgt.h = 1.7; g.tgt.pitch = 0.32; g.tgt.yaw = g.faceYaw(i, g.tgt.d); g.sel = i; g.done = [{ at: () => Math.abs(g.cur.d - g.tgt.d) < 0.12, fn: cb }]; g.dirty = true; },
    snapTo(i) { const g = S.g; if (!g) return; g.sel = i; g.tgt.d = treeDist(i) - WALK_BACK; g.tgt.h = EYE; g.tgt.pitch = 0.1; g.tgt.yaw = g.faceYaw(i, g.tgt.d); Object.assign(g.cur, g.tgt); g.dirty = true; },
    overview() { const g = S.g; if (!g) return; g.tgt.d = -16; g.tgt.h = 15; g.tgt.pitch = -0.3; g.tgt.yaw = 0; g.done = []; g.dirty = true; },
    atTree(i) { const g = S.g; return !!g && Math.abs(g.cur.d - (treeDist(i) - WALK_BACK)) < 0.6; },
  };
  useImperativeHandle(ref, () => api, []);

  const pan = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => S.enabled,
    onMoveShouldSetPanResponder: () => S.enabled,
    onPanResponderGrant: (e) => { S.t = { x: e.nativeEvent.pageX, y: e.nativeEvent.pageY, moved: false, lx: e.nativeEvent.locationX, ly: e.nativeEvent.locationY }; },
    onPanResponderMove: (e, gs) => {
      const g = S.g; if (!g || !S.t) return;
      if (Math.abs(gs.dx) > 6 || Math.abs(gs.dy) > 6) S.t.moved = true;
      const px = e.nativeEvent.pageX, py = e.nativeEvent.pageY, dx = px - S.t.x, dy = py - S.t.y; S.t.x = px; S.t.y = py;
      g.tgt.yaw = clamp(g.tgt.yaw + dx * 0.0045, -1.3, 1.3);                  // sag/sol: etrafa bak
      g.tgt.d = clamp(g.tgt.d - dy * 0.13, -16, treeDist(S.trees.length - 1) - 4);   // yukari kaydir: ileri yuru
      g.tgt.h = EYE; g.tgt.pitch = 0.05; g.done = []; g.dirty = true;
    },
    onPanResponderRelease: () => {
      const g = S.g, t = S.t; if (!g || !t) return;
      if (!t.moved) { const i = g.pick(t.lx, t.ly); if (i >= 0) S.cb.onTap && S.cb.onTap(i); }
    },
  })).current;

  useEffect(() => () => { if (S.g) S.g.stop = true; }, []);

  const onContext = async (gl) => {
    try {
      const W = gl.drawingBufferWidth, H = gl.drawingBufferHeight;
      const renderer = new Renderer({ gl, antialias: true });
      renderer.setSize(W, H); renderer.setPixelRatio(1);
      renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
      const FOG = 0xf1e2bd;
      const scene = new THREE.Scene(); scene.fog = new THREE.Fog(FOG, 26, 200);
      const camera = new THREE.PerspectiveCamera(58, W / H, 0.1, 700); camera.rotation.order = 'YXZ';

      // ---- gokyuzu (gradyan kure)
      const sg = new THREE.SphereGeometry(450, 24, 16), sc = [], sp = sg.attributes.position, top = new THREE.Color(0x6f9fd0), mid = new THREE.Color(0xcfe0e6), hor = new THREE.Color(0xffe7b4);
      for (let k = 0; k < sp.count; k++) { const y = clamp(sp.getY(k) / 450, 0, 1), c = y < 0.25 ? hor.clone().lerp(mid, y / 0.25) : mid.clone().lerp(top, (y - 0.25) / 0.75); sc.push(c.r, c.g, c.b); }
      sg.setAttribute('color', new THREE.Float32BufferAttribute(sc, 3));
      const sky = new THREE.Mesh(sg, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false })); sky.renderOrder = -10; scene.add(sky);
      // gunes
      const sun = new THREE.Group();
      [[26, 0.95, 0xfff6d6], [60, 0.28, 0xffe3a0], [120, 0.14, 0xffdc92]].forEach(([r, o, c]) => { const m = new THREE.Mesh(new THREE.CircleGeometry(r, 28), new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: o, fog: false, depthWrite: false, blending: THREE.AdditiveBlending })); sun.add(m); });
      sun.position.set(-150, 70, -330); sun.renderOrder = -9; scene.add(sun);

      // ---- daglar + uzak orman (kamerayi izler: sonsuz uzaklik hissi)
      const far = new THREE.Group(); scene.add(far);
      [[0xa9bba7, 255, 62], [0x84a082, 235, 42], [0x5f7f5a, 215, 26]].forEach(([col, R, A], li) => {
        const pos = [], n = 72;
        for (let k = 0; k <= n; k++) { const a = (k / n) * Math.PI * 2, h = Math.abs(Math.sin(a * 5 + li) * A + Math.cos(a * 11 + li * 2) * A * 0.45) + 6; pos.push(Math.cos(a) * R, -6, Math.sin(a) * R, Math.cos(a) * R, h, Math.sin(a) * R); }
        const idx = []; for (let k = 0; k < n; k++) { const b = k * 2; idx.push(b, b + 1, b + 2, b + 1, b + 3, b + 2); }
        const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx);
        far.add(new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: col, side: THREE.DoubleSide, fog: false })));
      });
      const pines = new THREE.InstancedMesh(new THREE.ConeGeometry(4.5, 17, 6), new THREE.MeshBasicMaterial({ color: 0x3f5f35, fog: false }), 220), dm = new THREE.Object3D(), pc = new THREE.Color();
      for (let k = 0; k < 220; k++) { const a = rnd() * Math.PI * 2, R = 150 + rnd() * 40, s = 0.7 + rnd() * 0.9; dm.position.set(Math.cos(a) * R, 7 * s, Math.sin(a) * R); dm.scale.set(s, s, s); dm.updateMatrix(); pines.setMatrixAt(k, dm.matrix); pc.setRGB(0.20 + rnd() * 0.08, 0.34 + rnd() * 0.1, 0.20 + rnd() * 0.05); pines.setColorAt(k, pc); }
      far.add(pines);

      // ---- cimen zemini (dokulu + tepecikli, renkli)
      const GS = 900, gg = new THREE.PlaneGeometry(GS, GS, 60, 60); gg.rotateX(-Math.PI / 2);
      const gp = gg.attributes.position, gc = [];
      for (let k = 0; k < gp.count; k++) { const x = gp.getX(k), z = gp.getZ(k), v = 0.9 + 0.14 * Math.sin(x * 0.07) * Math.cos(z * 0.06) + rnd() * 0.05, fadeC = clamp((Math.hypot(x, z + 80) - 120) / 200, 0, 0.5); gc.push(v + fadeC * 0.1, v + fadeC * 0.12, v - fadeC * 0.05); }
      gg.setAttribute('color', new THREE.Float32BufferAttribute(gc, 3));
      const ground = new THREE.Mesh(gg, new THREE.MeshBasicMaterial({ map: grassTexture(), vertexColors: true })); ground.position.set(0, 0, -80); scene.add(ground);

      // ---- kivrimli yol: toprak serit + tas dosemeler
      const PL = 200, segs = [], pi = [];
      for (let d = -20; d <= PL; d += 2) { const x = pathX(d), nx = Math.cos(Math.atan(0.055 * Math.cos(d * 0.055) * 4.2)); segs.push(x - 2.2, 0.015, -d, x + 2.2, 0.015, -d); }
      for (let k = 0; k < segs.length / 6 - 1; k++) { const b = k * 2; pi.push(b, b + 1, b + 2, b + 1, b + 3, b + 2); }
      const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.Float32BufferAttribute(segs, 3)); pg.setIndex(pi);
      scene.add(new THREE.Mesh(pg, new THREE.MeshBasicMaterial({ color: 0x6a5b45, side: THREE.DoubleSide })));
      const stones = [], ROWS = Math.floor((PL + 20) / 0.78), COLS = 4;
      const st = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 0.14, 1), new THREE.MeshBasicMaterial({ color: 0xffffff }), ROWS * COLS), sc2 = new THREE.Color();
      let q = 0;
      for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
        const d = -20 + r * 0.78 + (c % 2) * 0.35, x = pathX(d) + (c - 1.5) * 0.98 + (rnd() - 0.5) * 0.14, w = 0.62 + rnd() * 0.3, l = 0.5 + rnd() * 0.25;
        dm.position.set(x, 0.07, -d); dm.rotation.set(0, (rnd() - 0.5) * 0.5, 0); dm.scale.set(w, 1, l); dm.updateMatrix(); st.setMatrixAt(q, dm.matrix);
        const v = 0.50 + rnd() * 0.16; sc2.setRGB(v + 0.06, v + 0.03, v - 0.04); st.setColorAt(q, sc2); q++;
      }
      dm.rotation.set(0, 0, 0); scene.add(st);

      // ---- cimen tutamlari + kir cicekleri
      const tuf = new THREE.InstancedMesh(new THREE.ConeGeometry(0.09, 0.55, 4), new THREE.MeshBasicMaterial({ color: 0xffffff }), 2600);
      for (let k = 0; k < 2600; k++) { const d = -10 + rnd() * 190, side = rnd() > 0.5 ? 1 : -1, off = 2.4 + Math.pow(rnd(), 1.6) * 22, s = 0.7 + rnd() * 1.1; dm.position.set(pathX(d) + side * off, 0.25 * s, -d); dm.scale.set(s, s, s); dm.rotation.set((rnd() - 0.5) * 0.4, 0, (rnd() - 0.5) * 0.4); dm.updateMatrix(); tuf.setMatrixAt(k, dm.matrix); sc2.setRGB(0.22 + rnd() * 0.15, 0.45 + rnd() * 0.2, 0.15 + rnd() * 0.08); tuf.setColorAt(k, sc2); }
      scene.add(tuf);
      const fl = new THREE.InstancedMesh(new THREE.SphereGeometry(0.1, 6, 4), new THREE.MeshBasicMaterial({ color: 0xffffff }), 700), FC = [[1, 0.84, 0.1], [1, 1, 0.95], [0.72, 0.38, 0.9], [1, 0.62, 0.1], [0.95, 0.4, 0.55]];
      for (let k = 0; k < 700; k++) { const d = -6 + rnd() * 180, side = rnd() > 0.5 ? 1 : -1, off = 2.3 + Math.pow(rnd(), 1.5) * 16; dm.position.set(pathX(d) + side * off, 0.34, -d); dm.scale.setScalar(0.7 + rnd() * 0.8); dm.rotation.set(0, 0, 0); dm.updateMatrix(); fl.setMatrixAt(k, dm.matrix); const f = FC[k % 5]; sc2.setRGB(f[0], f[1], f[2]); fl.setColorAt(k, sc2); }
      scene.add(fl);

      // ---- AGACLAR: bizim gorseller, billboard + golge + secim halkasi
      const loader = new TextureLoader(), meshes = [], pickList = [], phs = [], g0 = { dirty: true };
      S.trees.forEach((t, i) => {
        const h = 6.4 * TV(i), w = h * t.aspect, d = treeDist(i), x = treeX(i), z = -d;
        const geo = new THREE.PlaneGeometry(w, h); geo.translate(0, h / 2, 0);
        const mat = new THREE.MeshBasicMaterial({ transparent: true, alphaTest: 0.35, side: THREE.DoubleSide, color: 0xfff4de });
        const m = new THREE.Mesh(geo, mat); m.position.set(x, 0, z); m.userData = { i, h, w }; m.visible = false; scene.add(m); meshes.push(m); pickList.push(m);
        // yedek: gorsel yuklenene kadar (veya yuklenemezse) kodla uretilmis basit agac
        const ph = new THREE.Group(); ph.position.set(x, 0, z);
        const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.4, h * 0.45, 7), new THREE.MeshBasicMaterial({ color: 0x6b4a2b })); trunk.position.y = h * 0.22; ph.add(trunk);
        const lc = [0x2f6b1f, 0x3f8a2a, 0x57a63a][i % 3];
        [[0, 0.62, 0.34], [-0.2, 0.52, 0.26], [0.2, 0.55, 0.27]].forEach(([ox, oy, r]) => { const b = new THREE.Mesh(new THREE.IcosahedronGeometry(h * r, 1), new THREE.MeshBasicMaterial({ color: lc })); b.position.set(ox * h, oy * h, 0); ph.add(b); });
        scene.add(ph); phs.push(ph);
        const shown = () => { m.visible = true; ph.visible = false; g0.dirty = true; };
        try {
          const tex0 = loader.load(GARDEN_IMG[t.n], (tex) => { mat.map = tex; mat.needsUpdate = true; shown(); }, undefined, (e) => { S.cb.onWarn && S.cb.onWarn('Agac gorseli yuklenemedi: ' + String(e && e.message || e)); });
          setTimeout(() => { if (!m.visible && tex0 && tex0.image) { mat.map = tex0; mat.needsUpdate = true; shown(); } }, 5000);
        } catch (e) { S.cb.onWarn && S.cb.onWarn('Agac gorseli hatasi: ' + String(e && e.message || e)); }
        // yumusak zemin golgesi (3 halka)
        [[0.46, 0.14], [0.34, 0.14], [0.2, 0.18]].forEach(([r, o]) => {
          const sh = new THREE.Mesh(new THREE.CircleGeometry(w * r * 1.4, 20), new THREE.MeshBasicMaterial({ color: 0x0c1a06, transparent: true, opacity: o, depthWrite: false }));
          sh.rotation.x = -Math.PI / 2; sh.position.set(x + 0.4, 0.04, z + 0.15); sh.scale.set(1, 0.55, 1); scene.add(sh);
        });
      });
      const ring = new THREE.Mesh(new THREE.RingGeometry(1.5, 1.85, 40), new THREE.MeshBasicMaterial({ color: 0xffd54f, transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false })); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.06; ring.visible = false; scene.add(ring);

      // ---- kamera durumu
      const g = Object.assign(g0, {
        cur: { d: -4, yaw: 0, pitch: 0.05, h: EYE }, tgt: { d: treeDist(0) - WALK_BACK, yaw: 0, pitch: 0.1, h: EYE }, sel: 0, done: [], dirty: true, stop: false, nearIdx: -1, last: Date.now(), keep: Date.now() + 8000,
        faceYaw: (i, d) => { const cx = pathX(d), dx = treeX(i) - cx, dz = -treeDist(i) + d; return Math.atan2(-dx, -dz); },
        pick: (lx, ly) => {
          const rc = new THREE.Raycaster(); rc.setFromCamera(new THREE.Vector2((lx / SW) * 2 - 1, -(ly / SH) * 2 + 1), camera);
          const hit = rc.intersectObjects(pickList.filter((o) => o.visible).concat(phs.filter((p) => p.visible).flatMap((p) => p.children)), false);
          if (!hit.length) return -1; let o = hit[0].object; while (o && o.userData.i === undefined && o.parent) o = o.parent; return o && o.userData.i !== undefined ? o.userData.i : phs.findIndex((p) => p.children.includes(hit[0].object));
        },
      });
      g.tgt.yaw = g.faceYaw(0, g.tgt.d); S.g = g; S.cb.onReady && S.cb.onReady();

      const v3 = new THREE.Vector3();
      const loop = () => {
        if (g.stop) return;
        requestAnimationFrame(loop);
        const now = Date.now(), dt = Math.min(0.05, (now - g.last) / 1000); g.last = now;
        const k = 1 - Math.exp(-dt * 4.2);
        let moving = false;
        for (const key of ['d', 'yaw', 'pitch', 'h']) { const df = g.tgt[key] - g.cur[key]; if (Math.abs(df) > 0.0008) { g.cur[key] += df * k; moving = true; } }
        if (!moving && !g.dirty && now > g.keep) return;
        g.dirty = false;
        const px = pathX(g.cur.d);
        camera.position.set(px, g.cur.h, -g.cur.d); camera.rotation.set(g.cur.pitch, g.cur.yaw, 0);
        camera.updateMatrixWorld();
        sky.position.copy(camera.position); far.position.set(camera.position.x, 0, camera.position.z); sun.position.set(camera.position.x - 150, 70, camera.position.z - 330); sun.lookAt(camera.position);
        phs.forEach((p, k) => { p.rotation.y = 0; });
        meshes.forEach((m) => { m.rotation.y = Math.atan2(camera.position.x - m.position.x, camera.position.z - m.position.z); });
        const sm = meshes[g.sel]; if (sm) { ring.visible = S.enabled && g.cur.pitch < 0.2 && g.cur.h < 5; ring.position.x = sm.position.x; ring.position.z = sm.position.z; }
        renderer.render(scene, camera); gl.endFrameEXP();
        // en yakin ileri agac (secili)
        if (g.cur.h < 5) { const ni = clamp(Math.round((g.cur.d + WALK_BACK - 12) / 7.5), 0, S.trees.length - 1); if (ni !== g.nearIdx && g.mode !== 'walkLock') { g.nearIdx = ni; if (!g.done.length) { g.sel = ni; S.cb.onNear && S.cb.onNear(ni); } } }
        // secili agacin ekrandaki yeri (etiket)
        if (sm && S.cb.onLabel) { v3.set(sm.position.x, sm.userData.h * 1.03, sm.position.z).project(camera); S.cb.onLabel(v3.z < 1 && v3.z > -1 ? (v3.x * 0.5 + 0.5) * SW : -999, (-v3.y * 0.5 + 0.5) * SH); }
        // bekleyen tamamlama isleri
        if (g.done.length) { const list = g.done; g.done = []; list.forEach((o) => { if (o.at()) { o.fn && o.fn(); } else g.done.push(o); }); }
      };
      loop();
    } catch (err) { S.cb.onFail && S.cb.onFail(String(err && err.message || err)); }
  };

  return (
    <View style={{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0 }} {...pan.panHandlers}>
      <GLView style={{ flex: 1 }} onContextCreate={onContext} pointerEvents="none" />
    </View>
  );
});
export default Garden3D;
