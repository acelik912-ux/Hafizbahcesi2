import React, { useRef, useState, useEffect, useMemo } from 'react';
import { View, Text, Image, Pressable, Animated, Easing, StyleSheet, Dimensions, StatusBar, ScrollView } from 'react-native';
import DATA from './src/data.json';
import TREES_XY from './src/trees.json';
import { TREE_IMG, SCENE, IMG } from './src/assets';

const { width: W, height: H } = Dimensions.get('window');
const IMG_RATIO_HANDS = 1601 / 900;            // el gorselleri 900x1601
const ease = Easing.inOut(Easing.cubic);
const T = (v, to, ms, extra = {}) => Animated.timing(v, { toValue: to, duration: ms, easing: ease, useNativeDriver: true, ...extra });

// 5 renk sistemi: 1 siyah, 2 kirmizi, 3 sari, 4 yesil, 5 lacivert, tekrar
const COLORS = [
  { name: 'Siyah', base: '#1d1d22', dark: '#000000', tx: '#ffffff' },
  { name: 'Kırmızı', base: '#d32f2f', dark: '#8e1b1b', tx: '#ffffff' },
  { name: 'Sarı', base: '#f4c430', dark: '#b8860b', tx: '#3a2a00' },
  { name: 'Yeşil', base: '#4caf50', dark: '#2e7d32', tx: '#ffffff' },
  { name: 'Lacivert', base: '#1c3573', dark: '#0d1b40', tx: '#ffffff' },
];
const TREES = TREES_XY.map((t) => ({ ...t, page: DATA.pages[t.n - 1] }));

// ---------------------------------------------------------------- meyve
function FruitBall({ D, k, state }) {
  const c = COLORS[k % 5];
  return (
    <View style={{ width: D, height: D }}>
      <View style={{ position: 'absolute', left: D * 0.46, top: -D * 0.16, width: D * 0.3, height: D * 0.18, borderRadius: D, backgroundColor: '#3f8f3a', transform: [{ rotate: '-28deg' }] }} />
      <View style={{ width: D, height: D, borderRadius: D / 2, backgroundColor: c.base, borderWidth: Math.max(2, D * 0.04), borderColor: c.dark, alignItems: 'center', justifyContent: 'center',
        shadowColor: '#000', shadowOpacity: 0.5, shadowRadius: 6, shadowOffset: { width: 0, height: 4 }, elevation: 6 }}>
        <View style={{ position: 'absolute', left: D * 0.17, top: D * 0.12, width: D * 0.32, height: D * 0.2, borderRadius: D, backgroundColor: 'rgba(255,255,255,0.5)', transform: [{ rotate: '-30deg' }] }} />
        <Text style={{ color: c.tx, fontWeight: '800', fontSize: D * 0.34 }}>{k + 1}</Text>
        {state === 'done' && (
          <View style={{ position: 'absolute', right: -2, top: -2, width: D * 0.38, height: D * 0.38, borderRadius: D, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ color: '#2e7d32', fontWeight: '900', fontSize: D * 0.26 }}>✓</Text>
          </View>
        )}
      </View>
    </View>
  );
}

// ---------------------------------------------------------------- agac ekrani (tirmanma)
function TreeStage({ tree, startK, onBack, onProgress, onNext, hasNext }) {
  const n = tree.page.ayat.length;
  const [k, setK] = useState(Math.min(startK, n));        // sirada olan meyve (n = hepsi toplandi)
  const [open, setOpen] = useState(null);                  // acik ayet indeksi
  const [inHand, setInHand] = useState(false);             // meyve avucta mi
  const [msg, setMsg] = useState(null);
  const busy = useRef(false);

  // olculer
  const { TW, TH, D } = useMemo(() => {
    let th = H * 1.12, tw = th * tree.aspect;
    if (tw < W * 1.3) { tw = W * 1.3; th = tw / tree.aspect; }
    return { TW: tw, TH: th, D: Math.max(56, Math.min(80, tw * 0.09)) };
  }, [tree]);
  const s0 = Math.min((W * 0.96) / TW, (H * 0.64) / TH);
  const tx = useRef(new Animated.Value((W - s0 * TW) / 2)).current;
  const ty = useRef(new Animated.Value(H * 0.14 + (H * 0.68 - s0 * TH) / 2)).current;
  const sc = useRef(new Animated.Value(s0)).current;
  const fade = useRef(new Animated.Value(0)).current;
  const hy = useRef(new Animated.Value(0)).current;        // el yukselmesi
  const palmOp = useRef(new Animated.Value(1)).current;
  const fistOp = useRef(new Animated.Value(0)).current;
  const cardOp = useRef(new Animated.Value(0)).current;
  const finOp = useRef(new Animated.Value(0)).current;

  const focus = (idx, ms = 1300, s = 1, cb) => {
    const [x, y] = tree.anch[Math.min(idx, n - 1)];
    Animated.parallel([T(tx, W / 2 - s * x * TW, ms), T(ty, H * 0.42 - s * y * TH, ms), T(sc, s, ms)]).start(cb);
  };
  const overview = (ms = 1200, cb) =>
    Animated.parallel([T(tx, (W - s0 * TW) / 2, ms), T(ty, H * 0.14 + (H * 0.68 - s0 * TH) / 2, ms), T(sc, s0, ms)]).start(cb);

  // tirmanis: yumruk eller yukari uzanir, kamera meyveye cikar
  const climbTo = (idx, cb) => {
    busy.current = true;
    Animated.parallel([T(palmOp, 0, 250), T(fistOp, 1, 250), Animated.sequence([T(hy, -H * 0.1, 650), T(hy, 0, 650)])]).start();
    focus(idx, 1300, 1, () => {
      Animated.parallel([T(fistOp, 0, 250), T(palmOp, 1, 250)]).start(() => { busy.current = false; cb && cb(); });
    });
  };

  useEffect(() => {
    T(fade, 1, 600).start();
    if (k >= n) { overview(900); Animated.timing(finOp, { toValue: 1, duration: 500, useNativeDriver: true }).start(); return; }
    const t = setTimeout(() => climbTo(k), 1100);          // once butun agac, sonra alt meyveye yaklas
    return () => clearTimeout(t);
  }, []);

  const hint = k >= n ? null : `Parlayan ${k + 1}. meyveyi (${COLORS[k % 5].name.toLowerCase()}) kopar`;

  const pressFruit = (i) => {
    if (busy.current) return;
    if (i < k) { setInHand(false); setOpen(i); Animated.timing(cardOp, { toValue: 1, duration: 300, useNativeDriver: true }).start(); return; }
    if (i > k) { setMsg('Önce alttaki meyveyi topla'); setTimeout(() => setMsg(null), 1400); return; }
    // i === k : meyveyi kopar
    busy.current = true;
    Animated.parallel([T(palmOp, 1, 100), T(hy, -H * 0.26, 650)]).start(() => {
      setInHand(true); setOpen(i);
      Animated.timing(cardOp, { toValue: 1, duration: 350, useNativeDriver: true }).start(() => { busy.current = false; });
    });
  };

  const closeCard = () => {
    if (busy.current) return;
    const wasHand = inHand;
    Animated.timing(cardOp, { toValue: 0, duration: 220, useNativeDriver: true }).start(() => {
      setOpen(null);
      if (!wasHand) return;
      setInHand(false);
      const nk = k + 1; setK(nk); onProgress(tree.n, nk);
      Animated.timing(hy, { toValue: 0, duration: 450, easing: ease, useNativeDriver: true }).start(() => {
        if (nk < n) climbTo(nk);
        else { overview(1400); Animated.timing(finOp, { toValue: 1, duration: 600, useNativeDriver: true }).start(); }
      });
    });
  };

  const a = open != null ? tree.page.ayat[open] : null;
  const handsTop = H * 0.82 - 0.39 * W * IMG_RATIO_HANDS;
  const fistTop = H * 0.74 - 0.17 * W * IMG_RATIO_HANDS;

  return (
    <Animated.View style={[StyleSheet.absoluteFill, { opacity: fade, backgroundColor: '#12210f' }]}>
      <Image source={SCENE.ground} blurRadius={6} style={[StyleSheet.absoluteFill, { width: W, height: H, transform: [{ scale: 1.35 }, { translateY: H * 0.06 }] }]} resizeMode="cover" />
      <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(8,20,6,0.28)' }]} />

      {/* agac + meyveler */}
      <Animated.View style={{ position: 'absolute', left: 0, top: 0, width: TW, height: TH, transformOrigin: '0% 0%', transform: [{ translateX: tx }, { translateY: ty }, { scale: sc }] }}>
        <View style={{ position: 'absolute', left: TW * 0.05, width: TW * 0.9, top: TH * 0.965, height: TH * 0.06, borderRadius: TH, backgroundColor: 'rgba(0,0,0,0.35)' }} />
        <Image source={TREE_IMG[tree.n]} style={{ width: TW, height: TH }} resizeMode="stretch" />
        {tree.page.ayat.map((ay, i) => {
          const [x, y] = tree.anch[i];
          const state = i < k ? 'done' : i === k ? 'active' : 'locked';
          if (inHand && i === k) return null;
          return (
            <Pressable key={i} onPress={() => pressFruit(i)} hitSlop={10}
              style={{ position: 'absolute', left: x * TW - 56, top: y * TH - D / 2, width: 112, alignItems: 'center', opacity: state === 'locked' ? 0.6 : 1, zIndex: state === 'active' ? 5 : 1 }}>
              <View style={state === 'active' ? { padding: 5, borderRadius: D, borderWidth: 3, borderColor: '#ffd54f', backgroundColor: 'rgba(255,213,79,0.25)' } : null}>
                <FruitBall D={D} k={i} state={state} />
              </View>
              <View style={[S.plate, state === 'active' && { borderColor: '#ffd54f', borderWidth: 2 }]}>
                <Image source={IMG[ay.start.file]} style={{ width: 98, height: 26 }} resizeMode="contain" />
              </View>
            </Pressable>
          );
        })}
      </Animated.View>

      {/* eller */}
      <Animated.Image pointerEvents="none" source={SCENE.palms} style={{ position: 'absolute', left: 0, top: handsTop, width: W, height: W * IMG_RATIO_HANDS, opacity: palmOp, transform: [{ translateY: hy }] }} />
      <Animated.Image pointerEvents="none" source={SCENE.fists} style={{ position: 'absolute', left: 0, top: fistTop, width: W, height: W * IMG_RATIO_HANDS, opacity: fistOp, transform: [{ translateY: hy }] }} />
      {inHand && (
        <View pointerEvents="none" style={{ position: 'absolute', left: W / 2 - D * 0.8, top: H * 0.66 - D * 0.8 }}>
          <FruitBall D={D * 1.6} k={open} state="active" />
        </View>
      )}

      {/* ust cubuk */}
      <View style={S.hud}>
        <Pressable style={S.hudBtn} onPress={onBack}><Text style={S.hudBtnTx}>← Bahçe</Text></Pressable>
        <Text style={S.hudTitle} numberOfLines={1}>{tree.n}. {tree.name}</Text>
        <Text style={S.hudCount}>{Math.min(k, n)}/{n}</Text>
      </View>
      {hint && !open && <View style={S.hintBox} pointerEvents="none"><Text style={S.hintTx}>{hint}</Text></View>}
      {msg && <View style={S.hintBox} pointerEvents="none"><Text style={S.hintTx}>{msg}</Text></View>}

      {/* ayet karti */}
      {a && (
        <Animated.View style={[S.cardWrap, { opacity: cardOp }]}>
          <View style={S.card}>
            <Text style={S.cardTitle}>{a.sname} · {a.no}. ayet</Text>
            <ScrollView style={{ maxHeight: H * 0.36 }} contentContainerStyle={{ alignItems: 'center' }}>
              <Image source={IMG[a.full.file]} style={{ width: W - 70, height: (W - 70) * a.full.h / a.full.w }} resizeMode="contain" />
              <Text style={S.meal}>{a.meal}</Text>
            </ScrollView>
            <Pressable style={S.okBtn} onPress={closeCard}>
              <Text style={S.okTx}>{inHand ? 'Okudum, devam ▲' : 'Kapat'}</Text>
            </Pressable>
          </View>
        </Animated.View>
      )}

      {/* bitis */}
      {k >= n && !open && (
        <Animated.View style={[S.finish, { opacity: finOp }]}>
          <Text style={S.finTitle}>Ağaç tamamlandı 🌿</Text>
          <Text style={S.finSub}>{n} meyvenin hepsini topladın</Text>
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
            <Pressable style={[S.okBtn, { flex: 1, backgroundColor: '#6b4226' }]} onPress={onBack}><Text style={S.okTx}>Bahçeye dön</Text></Pressable>
            {hasNext && <Pressable style={[S.okBtn, { flex: 1 }]} onPress={onNext}><Text style={S.okTx}>Sonraki ağaç ▶</Text></Pressable>}
          </View>
        </Animated.View>
      )}
    </Animated.View>
  );
}

// ---------------------------------------------------------------- bahce (yuruyus)
const SP = [2.1, 1, 0.55, 0.38, 0.29, 0.235];             // derinlik olcegi: d = -1 ... 4
const OPA = [0, 1, 0.95, 0.85, 0.7, 0.5];
const BASE_Y = H * 0.86, TREE_H = H * 0.46;

function GardenTree({ t, i, pos, st, ap, onApproach }) {
  const inR = [i - 1, i, i + 1, i + 2, i + 3, i + 4];
  const side = i % 2 === 0 ? -1 : 1;
  const w = Math.min(W * 0.95, TREE_H * t.aspect), h = w / t.aspect;
  const scale = pos.interpolate({ inputRange: inR, outputRange: SP, extrapolate: 'clamp' });
  const x = pos.interpolate({ inputRange: inR, outputRange: SP.map((s) => side * W * 0.27 * s), extrapolate: 'clamp' });
  const y = pos.interpolate({ inputRange: inR, outputRange: SP.map((s) => (0.4 + 0.46 * s - 0.86) * H), extrapolate: 'clamp' });
  const op = pos.interpolate({ inputRange: inR, outputRange: OPA, extrapolate: 'clamp' });
  const cur = i === st;
  const innerScale = cur ? ap.interpolate({ inputRange: [0, 1], outputRange: [1, 1.7] }) : 1;
  const innerOp = cur ? 1 : ap.interpolate({ inputRange: [0, 1], outputRange: [1, 0] });
  return (
    <Animated.View pointerEvents={cur ? 'auto' : 'none'}
      style={{ position: 'absolute', left: W / 2 - w / 2, top: BASE_Y - h, width: w, height: h, opacity: op, zIndex: 50 - i, transformOrigin: '50% 100%', transform: [{ translateX: x }, { translateY: y }, { scale }] }}>
      <Animated.View style={{ width: w, height: h, opacity: innerOp, transformOrigin: '50% 100%', transform: [{ scale: innerScale }] }}>
        <View style={{ position: 'absolute', left: w * 0.08, width: w * 0.84, bottom: -h * 0.02, height: h * 0.07, borderRadius: h, backgroundColor: 'rgba(10,20,5,0.38)' }} />
        <Pressable onPress={cur ? onApproach : undefined} style={{ width: w, height: h }}>
          <Image source={TREE_IMG[t.n]} style={{ width: w, height: h }} resizeMode="stretch" />
        </Pressable>
      </Animated.View>
    </Animated.View>
  );
}

// ---------------------------------------------------------------- ana uygulama
export default function App() {
  const [mode, setMode] = useState('gate');         // gate | garden | tree
  const [st, setSt] = useState(0);
  const [tree, setTree] = useState(null);
  const [prog, setProg] = useState({});             // {agacNo: toplanan}
  const pos = useRef(new Animated.Value(0)).current;
  const ap = useRef(new Animated.Value(0)).current;
  const walking = useRef(false);
  // kapi
  const gs = useRef(new Animated.Value(1)).current;
  const go = useRef(new Animated.Value(1)).current;
  const zs = useRef(new Animated.Value(1.22)).current;
  const ui = useRef(new Animated.Value(1)).current;
  const hh = useRef(new Animated.Value(0)).current;
  const gfade = useRef(new Animated.Value(0)).current;

  useEffect(() => { Animated.timing(gfade, { toValue: 1, duration: 1000, useNativeDriver: true }).start(); }, []);

  const enter = () => {
    setMode('entering');
    Animated.parallel([
      T(ui, 0, 400), T(gs, 2.3, 2600, { easing: Easing.in(Easing.quad) }), T(go, 0, 1500, { delay: 1100 }),
      T(zs, 1, 2600), T(hh, -H * 0.12, 1600),
    ]).start(() => setMode('garden'));
  };

  const walk = (dir) => {
    if (walking.current) return;
    const ns = Math.max(0, Math.min(TREES.length - 1, st + dir));
    if (ns === st) return;
    walking.current = true; setSt(ns);
    T(pos, ns, 1500).start(() => { walking.current = false; });
  };
  const approach = () => {
    if (walking.current) return;
    walking.current = true;
    T(ap, 1, 900).start(() => { setTree(TREES[st]); setMode('tree'); walking.current = false; });
  };
  const backToGarden = () => { ap.setValue(0); setMode('garden'); };
  const nextTree = () => {
    const ns = Math.min(TREES.length - 1, tree.n);    // sonraki agac = indeks tree.n
    ap.setValue(0); pos.setValue(ns); setSt(ns); setMode('garden');
  };
  const onProgress = (n, c) => setProg((p) => ({ ...p, [n]: c }));

  const bgScale = pos.interpolate({ inputRange: [0, TREES.length - 1], outputRange: [1, 1.12] });
  const cur = TREES[st];
  const done = prog[cur.n] || 0;
  const handsTop = H * 0.82 - 0.39 * W * IMG_RATIO_HANDS;

  return (
    <View style={{ flex: 1, backgroundColor: '#12210f' }}>
      <StatusBar hidden />
      {/* zemin: kapi sahnesinde ve bahcede */}
      {mode !== 'tree' && (
        <Animated.Image source={SCENE.ground} resizeMode="cover"
          style={[StyleSheet.absoluteFill, { width: W, height: H, transform: [{ scale: mode === 'garden' ? bgScale : zs }] }]} />
      )}
      {mode !== 'tree' && mode !== 'gate' && mode !== 'entering' && (
        <>
          {TREES.map((t, i) => (i >= st - 1 && i <= st + 4) ? <GardenTree key={t.n} t={t} i={i} pos={pos} st={st} ap={ap} onApproach={approach} /> : null)}
          <Animated.View style={[S.gardenTop, { opacity: ap.interpolate({ inputRange: [0, 0.5], outputRange: [1, 0] }) }]} pointerEvents="none">
            <Text style={S.gTitle}>Cüz 1 · Hafız Bahçesi</Text>
            <Text style={S.gSub}>{cur.n}. {cur.name} ağacı  ·  {done}/{cur.page.ayat.length}{done >= cur.page.ayat.length ? '  ✓' : ''}</Text>
          </Animated.View>
          <Animated.View style={[S.walkBar, { opacity: ap.interpolate({ inputRange: [0, 0.5], outputRange: [1, 0] }) }]}>
            <Pressable style={[S.walkB, st === 0 && { opacity: 0.35 }]} onPress={() => walk(-1)}><Text style={S.walkTx}>▼ Geri</Text></Pressable>
            <Pressable style={[S.walkB, S.walkMain]} onPress={approach}><Text style={[S.walkTx, { fontSize: 16 }]}>Ağaca yaklaş</Text></Pressable>
            <Pressable style={[S.walkB, st === TREES.length - 1 && { opacity: 0.35 }]} onPress={() => walk(1)}><Text style={S.walkTx}>İleri ▲</Text></Pressable>
          </Animated.View>
        </>
      )}

      {/* kapi */}
      {(mode === 'gate' || mode === 'entering') && (
        <>
          <Animated.Image source={SCENE.gate} resizeMode="cover"
            style={[StyleSheet.absoluteFill, { width: W, height: H, opacity: Animated.multiply(go, gfade), transform: [{ scale: gs }] }]} />
          <Animated.Image pointerEvents="none" source={SCENE.palms}
            style={{ position: 'absolute', left: 0, top: handsTop, width: W, height: W * IMG_RATIO_HANDS, opacity: Animated.multiply(go, gfade), transform: [{ translateY: hh }] }} />
          <Animated.View style={[S.intro, { opacity: Animated.multiply(ui, gfade) }]}>
            <Text style={S.introTitle}>Hafız Bahçesi</Text>
            <Text style={S.introSub}>Cüz 1 · 20 ağaç</Text>
            <Pressable style={S.enterBtn} onPress={mode === 'gate' ? enter : undefined}><Text style={S.enterTx}>Bahçeye gir</Text></Pressable>
          </Animated.View>
        </>
      )}

      {mode === 'tree' && tree && (
        <TreeStage key={tree.n} tree={tree} startK={prog[tree.n] || 0} onBack={backToGarden} onProgress={onProgress}
          onNext={nextTree} hasNext={tree.n < TREES.length} />
      )}
    </View>
  );
}

const S = StyleSheet.create({
  intro: { position: 'absolute', top: H * 0.16, left: 0, right: 0, alignItems: 'center' },
  introTitle: { color: '#fff', fontSize: 40, fontWeight: '800', textShadowColor: 'rgba(0,0,0,0.6)', textShadowRadius: 10 },
  introSub: { color: '#fff', fontSize: 16, marginTop: 4, textShadowColor: 'rgba(0,0,0,0.6)', textShadowRadius: 8 },
  enterBtn: { marginTop: H * 0.07, backgroundColor: 'rgba(107,66,38,0.95)', borderColor: '#f5deb3', borderWidth: 2, paddingVertical: 14, paddingHorizontal: 34, borderRadius: 30 },
  enterTx: { color: '#fff8dc', fontSize: 18, fontWeight: '800' },
  gardenTop: { position: 'absolute', top: 46, left: 16, right: 16, alignItems: 'center', backgroundColor: 'rgba(30,20,10,0.55)', borderRadius: 16, paddingVertical: 8 },
  gTitle: { color: '#f5deb3', fontSize: 13, fontWeight: '700' },
  gSub: { color: '#fff', fontSize: 17, fontWeight: '800', marginTop: 2 },
  walkBar: { position: 'absolute', bottom: 34, left: 14, right: 14, flexDirection: 'row', gap: 8, justifyContent: 'center', zIndex: 200 },
  walkB: { backgroundColor: 'rgba(107,66,38,0.92)', borderColor: '#f5deb3', borderWidth: 2, paddingVertical: 12, paddingHorizontal: 16, borderRadius: 26, justifyContent: 'center' },
  walkMain: { backgroundColor: '#e65100', flex: 1, alignItems: 'center' },
  walkTx: { color: '#fff', fontWeight: '800', fontSize: 14 },
  hud: { position: 'absolute', top: 40, left: 12, right: 12, flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(30,20,10,0.65)', borderRadius: 16, paddingVertical: 8, paddingHorizontal: 10 },
  hudBtn: { backgroundColor: '#6b4226', borderRadius: 10, paddingVertical: 6, paddingHorizontal: 10 },
  hudBtnTx: { color: '#fff8dc', fontWeight: '700', fontSize: 13 },
  hudTitle: { flex: 1, color: '#fff', fontWeight: '800', fontSize: 17, textAlign: 'center' },
  hudCount: { color: '#ffd54f', fontWeight: '800', fontSize: 16, minWidth: 44, textAlign: 'right' },
  hintBox: { position: 'absolute', top: 100, left: 20, right: 20, alignItems: 'center' },
  hintTx: { backgroundColor: 'rgba(0,0,0,0.72)', color: '#fff', paddingVertical: 8, paddingHorizontal: 16, borderRadius: 18, fontSize: 14, fontWeight: '700', overflow: 'hidden' },
  plate: { marginTop: 3, backgroundColor: '#fff8e7', borderColor: '#6b4226', borderWidth: 1.5, borderRadius: 8, paddingVertical: 2, paddingHorizontal: 4 },
  cardWrap: { position: 'absolute', top: H * 0.08, left: 0, right: 0, alignItems: 'center' },
  card: { width: W - 30, backgroundColor: '#fff8e7', borderColor: '#6b4226', borderWidth: 3, borderRadius: 18, padding: 14, shadowColor: '#000', shadowOpacity: 0.5, shadowRadius: 12, elevation: 12 },
  cardTitle: { color: '#d84315', fontWeight: '800', fontSize: 16, textAlign: 'center', marginBottom: 6 },
  meal: { color: '#333', fontSize: 16, marginTop: 8, lineHeight: 22 },
  okBtn: { backgroundColor: '#e65100', borderRadius: 24, paddingVertical: 12, alignItems: 'center', marginTop: 10 },
  okTx: { color: '#fff', fontWeight: '800', fontSize: 16 },
  finish: { position: 'absolute', left: 16, right: 16, bottom: 40, backgroundColor: 'rgba(255,248,231,0.96)', borderColor: '#6b4226', borderWidth: 3, borderRadius: 20, padding: 16, alignItems: 'center' },
  finTitle: { color: '#2e7d32', fontWeight: '800', fontSize: 22 },
  finSub: { color: '#3e2723', fontSize: 14, marginTop: 4 },
});
