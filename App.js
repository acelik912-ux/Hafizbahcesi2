import React, { useRef, useState, useEffect, useMemo } from 'react';
import { View, Text, Image, Pressable, Animated, Easing, StyleSheet, Dimensions, StatusBar, ScrollView } from 'react-native';
import DATA from './src/data.json';
import TREES_XY from './src/trees.json';
import { TREE_IMG, GARDEN_IMG, SCENE, IMG } from './src/assets';

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
// meyveler YUKARIDAN ASAGI: 1. ayet agacin en ustunde, sonuncusu en altta
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

// ---------------------------------------------------------------- agac ekrani: altindan bakis, butun meyveler gorunur
// meyve dizilimi ustten alta: 2, 3, 4, 3 ... ; her satirda SAGDAN SOLA (1. meyve ust satirin en sagi)
const PAT = { 1: [1], 2: [2], 3: [3], 4: [2, 2], 5: [2, 3], 6: [2, 4], 7: [2, 3, 2], 8: [2, 3, 3], 9: [2, 3, 4], 10: [2, 3, 3, 2], 11: [2, 3, 4, 2], 12: [2, 3, 4, 3] };
const FD = Math.min(66, W * 0.165);               // meyve capi
const PLW = W * 0.235;                            // plaka genisligi
const FOCUS_S = 1.9;                              // yakinlasma
function fruitLayout(n) {
  const rows = PAT[n] || [Math.ceil(n / 2), n - Math.ceil(n / 2)];
  const rowStep = FD + 44, y0 = H * 0.19, out = [];
  rows.forEach((c, r) => { for (let j = 0; j < c; j++) out.push({ x: W / 2 + ((c - 1) / 2 - j) * PLW * 1.02, y: y0 + r * rowStep }); });
  return out;
}

function TreeStage({ tree, startK, onLeave, onDone, onProgress, onNext, hasNext }) {
  const n = tree.page.ayat.length;
  const [k, setK] = useState(Math.min(startK, n));        // sirada olan meyve (n = hepsi toplandi)
  const [open, setOpen] = useState(null);                  // acik ayet indeksi
  const [inHand, setInHand] = useState(false);             // meyve avucta mi
  const [focus, setFocus] = useState(null);                // yakinlastirilan meyve
  const [menu, setMenu] = useState(false);
  const [msg, setMsg] = useState(null);
  const busy = useRef(false);
  const fade = useRef(new Animated.Value(0)).current;
  const hy = useRef(new Animated.Value(0)).current;        // el yukselmesi
  const cardOp = useRef(new Animated.Value(0)).current;
  const finOp = useRef(new Animated.Value(0)).current;
  const cs = useRef(new Animated.Value(1)).current;        // kamera olcegi
  const cx = useRef(new Animated.Value(0)).current;        // kamera kaydirma
  const cy = useRef(new Animated.Value(0)).current;
  const leave = (then) => { if (busy.current) return; busy.current = true; onLeave(then === 'next'); Animated.timing(fade, { toValue: 0, duration: 400, useNativeDriver: true }).start(() => onDone(then === 'next')); };
  const onBack = () => { setMenu(false); leave('back'); };
  const flash = (t) => { setMsg(t); setTimeout(() => setMsg(null), 1500); };

  const view = useMemo(() => {
    const TW = W, TH = W / tree.aspect;
    const [ccx, ccy, cw, ch] = tree.crown;
    const s = Math.min(1.12 / cw, (H * 0.62) / (ch * TH));
    return { TW, TH, s, tx: W / 2 - s * ccx * TW, ty: H * 0.34 - s * ccy * TH };
  }, [tree]);
  const pos = useMemo(() => fruitLayout(n), [n]);

  useEffect(() => {
    T(fade, 1, 700).start();
    if (k >= n) Animated.timing(finOp, { toValue: 1, duration: 500, useNativeDriver: true }).start();
  }, []);

  // kamera: meyveyi ekranin ust-ortasina getirip yakinlastir / geri cik
  const camTo = (i, ms = 600) => {
    if (i == null) return Animated.parallel([T(cs, 1, ms), T(cx, 0, ms), T(cy, 0, ms)]);
    const p = pos[i], fx = p.x, fy = p.y + FD * 0.8;
    return Animated.parallel([T(cs, FOCUS_S, ms), T(cx, W / 2 - FOCUS_S * fx, ms), T(cy, H * 0.36 - FOCUS_S * fy, ms)]);
  };
  const zoomOn = (i, cb) => { setFocus(i); camTo(i).start(() => { if (cb) cb(); }); };

  const hint = k >= n ? null
    : focus === k ? `Meyveye bir daha dokun: eline alacaksın`
    : `Parlayan ${k + 1}. meyveye (${COLORS[k % 5].name.toLowerCase()}) dokun`;

  const pressFruit = (i) => {
    if (busy.current) return;
    if (i > k) { flash('Önce sıradaki meyveyi topla'); return; }
    if (focus !== i) { busy.current = true; zoomOn(i, () => { busy.current = false; }); return; }   // 1. dokunus: yakinlas
    busy.current = true;                                    // 2. dokunus
    if (i < k) {
      camTo(null, 450).start(); setFocus(null); setInHand(false); setOpen(i);
      Animated.timing(cardOp, { toValue: 1, duration: 300, useNativeDriver: true }).start(() => { busy.current = false; });
      return;
    }
    setFocus(null);                                         // i === k : meyve ele gelir
    Animated.parallel([T(hy, -H * 0.26, 650), camTo(null, 650)]).start(() => {
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
      T(hy, 0, 450).start(() => { if (nk >= n) Animated.timing(finOp, { toValue: 1, duration: 600, useNativeDriver: true }).start(); });
    });
  };

  // menu: onceki / sonraki ayet, hepsini goster
  const base = open != null ? open : focus;
  const prevT = base == null ? k - 1 : base - 1;
  const nextT = base == null ? Math.min(k, n) : base + 1;
  const goAyah = (t) => {
    if (busy.current) return;
    setMenu(false);
    if (t < 0) { flash('Bu ilk ayet'); return; }
    if (t >= n) { flash('Bu son ayet'); return; }
    if (t > k) { flash('Önce sıradaki meyveyi topla'); return; }
    busy.current = true;
    const go = () => zoomOn(t, () => { busy.current = false; });
    if (open != null) {                                     // acik kart / avuctaki meyve: ilerleme saymadan kapat
      Animated.timing(cardOp, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => { setOpen(null); setInHand(false); T(hy, 0, 350).start(); go(); });
    } else go();
  };
  const showAll = () => {
    setMenu(false);
    if (busy.current) return;
    if (open != null) { Animated.timing(cardOp, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => { setOpen(null); setInHand(false); T(hy, 0, 350).start(); }); }
    setFocus(null); camTo(null).start();
  };

  const a = open != null ? tree.page.ayat[open] : null;
  const handsTop = H * 0.82 - 0.39 * W * IMG_RATIO_HANDS;

  return (
    <Animated.View style={[StyleSheet.absoluteFill, { opacity: fade, backgroundColor: '#12210f' }]}>
      <Image source={SCENE.backdrop} style={[StyleSheet.absoluteFill, { width: W, height: H }]} resizeMode="cover" />
      <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(8,20,6,0.28)' }]} />

      {/* kamera: agac + meyveler birlikte yakinlasir */}
      <Animated.View pointerEvents="box-none" style={[StyleSheet.absoluteFill, { transformOrigin: [0, 0, 0], transform: [{ translateX: cx }, { translateY: cy }, { scale: cs }] }]}>
        <View pointerEvents="none" style={{ position: 'absolute', left: 0, top: 0, width: view.TW, height: view.TH, transformOrigin: [0, 0, 0], transform: [{ translateX: view.tx }, { translateY: view.ty }, { scale: view.s }] }}>
          <Image source={TREE_IMG[tree.n]} style={{ width: view.TW, height: view.TH }} resizeMode="stretch" />
        </View>
        {tree.page.ayat.map((ay, i) => {
          const p = pos[i];
          const state = i < k ? 'done' : i === k ? 'active' : 'locked';
          if (inHand && i === k) return null;
          return (
            <Pressable key={i} onPress={() => pressFruit(i)} hitSlop={6}
              style={{ position: 'absolute', left: p.x - PLW / 2, top: p.y, width: PLW, alignItems: 'center', opacity: state === 'locked' ? 0.72 : 1, zIndex: state === 'active' ? 5 : 1 }}>
              <View style={state === 'active' || focus === i ? { padding: 4, borderRadius: FD, borderWidth: 3, borderColor: '#ffd54f', backgroundColor: 'rgba(255,213,79,0.25)' } : { padding: 7 }}>
                <FruitBall D={FD} k={i} state={state} />
              </View>
              <View style={[S.plate, (state === 'active' || focus === i) && { borderColor: '#ffd54f', borderWidth: 2 }]}>
                <Image source={IMG[ay.start.file]} style={{ width: PLW - 14, height: 24 }} resizeMode="contain" />
              </View>
            </Pressable>
          );
        })}
      </Animated.View>

      {/* eller */}
      <Animated.Image pointerEvents="none" source={SCENE.palms} style={{ position: 'absolute', left: 0, top: handsTop, width: W, height: W * IMG_RATIO_HANDS, transform: [{ translateY: hy }] }} />
      {inHand && (
        <View pointerEvents="none" style={{ position: 'absolute', left: W / 2 - FD * 0.8, top: H * 0.66 - FD * 0.8 }}>
          <FruitBall D={FD * 1.6} k={open} state="active" />
        </View>
      )}

      {/* ust cubuk: tek menu dugmesi */}
      <View style={S.hud}>
        <Pressable style={S.hudBtn} onPress={() => setMenu(!menu)}><Text style={S.hudBtnTx}>☰ Git</Text></Pressable>
        <Text style={S.hudTitle} numberOfLines={1}>{tree.n}. {tree.name}</Text>
        <Text style={S.hudCount}>{Math.min(k, n)}/{n}</Text>
      </View>
      {hint && !open && !menu && <View style={S.hintBox} pointerEvents="none"><Text style={S.hintTx}>{hint}</Text></View>}
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
              <Text style={S.okTx}>{inHand ? 'Okudum, devam ▼' : 'Kapat'}</Text>
            </Pressable>
          </View>
        </Animated.View>
      )}

      {/* bitis */}
      {k >= n && !open && !menu && (
        <Animated.View style={[S.finish, { opacity: finOp }]}>
          <Text style={S.finTitle}>Ağaç tamamlandı 🌿</Text>
          <Text style={S.finSub}>{n} meyvenin hepsini topladın</Text>
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
            <Pressable style={[S.okBtn, { flex: 1, backgroundColor: '#6b4226' }]} onPress={onBack}><Text style={S.okTx}>Bahçeye dön</Text></Pressable>
            {hasNext && <Pressable style={[S.okBtn, { flex: 1 }]} onPress={() => leave('next')}><Text style={S.okTx}>Sonraki ağaç ▶</Text></Pressable>}
          </View>
        </Animated.View>
      )}

      {/* "nereye gitmek istersin" menusu */}
      {menu && (
        <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.45)', zIndex: 300 }]} onPress={() => setMenu(false)}>
          <View style={S.menu}>
            <Text style={S.menuTitle}>Nereye gitmek istersin?</Text>
            <Pressable style={[S.menuB, { backgroundColor: '#6b4226' }]} onPress={onBack}><Text style={S.menuTx}>🌳  Ana bahçeye dön</Text></Pressable>
            <Pressable style={S.menuB} onPress={() => goAyah(prevT)}><Text style={S.menuTx}>◀  Önceki ayet{prevT >= 0 && prevT < n ? `  (${prevT + 1})` : ''}</Text></Pressable>
            <Pressable style={S.menuB} onPress={() => goAyah(nextT)}><Text style={S.menuTx}>Sonraki ayet  ▶{nextT >= 0 && nextT < n ? `  (${nextT + 1})` : ''}</Text></Pressable>
            <Pressable style={S.menuB} onPress={showAll}><Text style={S.menuTx}>🍎  Tüm meyveleri göster</Text></Pressable>
            {hasNext && <Pressable style={S.menuB} onPress={() => { setMenu(false); leave('next'); }}><Text style={S.menuTx}>Sonraki ağaç  ⏭</Text></Pressable>}
            <Pressable style={[S.menuB, { backgroundColor: 'transparent', borderColor: '#999' }]} onPress={() => setMenu(false)}><Text style={[S.menuTx, { color: '#ddd' }]}>Vazgeç</Text></Pressable>
          </View>
        </Pressable>
      )}
    </Animated.View>
  );
}

// ---------------------------------------------------------------- bahce: yolun iki yaninda agac sirasi (giris fotografi)
// Fotograftaki yakin agaclar dokunma alanidir (sagda kayisi, arkasinda incir; solda elma, armut, portakal).
// Diger agaclar yolun uzak kismina kucuk olarak dizilir.
const BGW = 1438, BGH = 2576, BSC = Math.max(W / BGW, H / BGH), BOX = (W - BGW * BSC) / 2, BOY = (H - BGH * BSC) / 2;
const bx = (f) => BOX + f * BGW * BSC, by = (f) => BOY + f * BGH * BSC;
const SPOTS = {                                   // agac indeksi -> fotograf uzerindeki alan [sol, ust, sag, alt] (oran)
  0: [0.66, 0.02, 1.0, 0.70],                     // kayisi (sagda yakin)
  1: [0.54, 0.30, 0.80, 0.58],                    // incir (kayisinin arkasi)
  4: [0.0, 0.08, 0.20, 0.55],                     // elma (solda yakin)
  7: [0.14, 0.20, 0.42, 0.42],                    // armut
  9: [0.22, 0.42, 0.50, 0.53],                    // portakal
};
const FAR = [2, 3, 5, 6, 8, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19];      // uzak siradakiler (yaklastikca yakin)
const geo = (t, i) => {
  const sp = SPOTS[i];
  if (sp) { const l = bx(sp[0]), r = bx(sp[2]), tp = by(sp[1]), bt = by(sp[3]); return { spot: true, w: r - l, h: bt - tp, x: (l + r) / 2, baseY: bt }; }
  const m = FAR.indexOf(i), row = Math.floor(m / 2), left = m % 2 === 0, u = 1 - row / 7;      // u: 1 yakin .. 0 uzak
  const h = H * (0.034 + 0.05 * u), w = h * t.aspect;
  return { spot: false, w, h, x: bx(0.5) + (left ? -1 : 1) * W * (0.05 + 0.2 * u), baseY: by(0.535 + 0.105 * u) };
};

const GardenTree = React.memo(function GardenTree({ t, i, onTap, sel, done }) {
  const { w, h, x, baseY, spot } = geo(t, i);
  const full = done >= t.page.ayat.length;
  return (
    <Pressable onPress={() => onTap(i)} hitSlop={4} style={{ position: 'absolute', left: x - w / 2, top: baseY - h, width: w, height: h, zIndex: sel ? 900 : spot ? (i === 1 ? 700 : 600) : Math.round(baseY) }}>
      {spot
        ? <View style={[{ flex: 1, borderRadius: 26 }, sel && { borderWidth: 3, borderColor: '#ffd54f', backgroundColor: 'rgba(255,213,79,0.12)' }]} />
        : (<>
            <View style={{ position: 'absolute', left: w * 0.05, width: w * 0.9, bottom: -h * 0.03, height: h * 0.09, borderRadius: h, backgroundColor: sel ? 'rgba(255,213,79,0.85)' : 'rgba(10,20,5,0.34)' }} />
            <Image source={GARDEN_IMG[t.n]} style={{ width: w, height: h }} resizeMode="stretch" fadeDuration={0} />
          </>)}
      <View style={[spot ? S.tagSpot : S.tagN, sel && { backgroundColor: '#e65100' }, full && { backgroundColor: '#2e7d32' }]}><Text style={S.tagTx}>{full ? '✓' : t.n}</Text></View>
      {sel && <View style={S.tagName}><Text style={S.tagNameTx} numberOfLines={1}>{t.name}</Text></View>}
    </Pressable>
  );
});

// ---------------------------------------------------------------- ana uygulama
export default function App() {
  const [mode, setMode] = useState('gate');         // gate | entering | garden | tree
  const [st, setSt] = useState(0);                  // secili agac indeksi (0 = en sagdaki kayisi)
  const [tree, setTree] = useState(null);
  const [org, setOrg] = useState(null);             // yaklasma odak noktasi
  const [prog, setProg] = useState({});             // {agacNo: toplanan}
  const ap = useRef(new Animated.Value(0)).current;     // yaklasma 0..1
  const busy = useRef(false);
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
  const step = (dir) => { if (busy.current) return; setSt((s) => Math.max(0, Math.min(TREES.length - 1, s + dir))); };
  const approachAt = useRef(null);
  approachAt.current = (i) => {
    if (busy.current || mode !== 'garden') return;
    busy.current = true; setSt(i);
    const g = geo(TREES[i], i);
    setOrg([g.x, g.baseY - g.h * 0.5, 0]);
    requestAnimationFrame(() => T(ap, 1, 1100, { easing: Easing.in(Easing.cubic) }).start(() => { setTree(TREES[i]); setMode('tree'); busy.current = false; }));
  };
  const tapTree = useRef(null);
  tapTree.current = (i) => { if (i === st) approachAt.current(i); else setSt(i); };      // once sec, sonra yaklas
  const onTap = useRef((i) => tapTree.current(i)).current;
  const onLeave = (next) => {
    if (next) setSt(Math.min(TREES.length - 1, tree.n));
    ap.setValue(0); setOrg(null);
  };
  const onDone = () => { setMode('garden'); busy.current = false; };
  const onProgress = (n, c) => setProg((p) => ({ ...p, [n]: c }));

  const cur = TREES[st];
  const done = prog[cur.n] || 0;
  const handsTop = H * 0.82 - 0.39 * W * IMG_RATIO_HANDS;
  const showTrees = mode !== 'gate';
  const dolly = ap.interpolate({ inputRange: [0, 1], outputRange: [1, 5] });
  const camScale = Animated.multiply(dolly, zs);

  return (
    <View style={{ flex: 1, backgroundColor: '#12210f' }}>
      <StatusBar hidden />
      {/* bahce: zemin + C seklinde agaclar */}
      <Animated.View style={[StyleSheet.absoluteFill, { transformOrigin: org || [W / 2, H / 2, 0], transform: [{ scale: camScale }] }]}>
        <Image source={SCENE.entry} resizeMode="cover" fadeDuration={0} style={{ position: 'absolute', left: 0, top: 0, width: W, height: H }} />
        {showTrees && TREES.map((t, i) => <GardenTree key={t.n} t={t} i={i} onTap={onTap} sel={mode === 'garden' && i === st} done={prog[t.n] || 0} />)}
      </Animated.View>
      {mode === 'garden' && (
        <>
          <View style={S.gardenTop} pointerEvents="none">
            <Text style={S.gTitle}>Cüz 1 · Hafız Bahçesi · sağdaki kayısıdan başla</Text>
            <Text style={S.gSub}>{cur.n}. {cur.name} ağacı  ·  {done}/{cur.page.ayat.length}{done >= cur.page.ayat.length ? '  ✓' : ''}</Text>
          </View>
          <View style={S.walkBar}>
            <Pressable style={[S.walkB, st === 0 && { opacity: 0.35 }]} onPress={() => step(-1)}><Text style={S.walkTx}>‹ Önceki</Text></Pressable>
            <Pressable style={[S.walkB, S.walkMain]} onPress={() => approachAt.current(st)}><Text style={[S.walkTx, { fontSize: 16 }]}>Ağaca yaklaş</Text></Pressable>
            <Pressable style={[S.walkB, st === TREES.length - 1 && { opacity: 0.35 }]} onPress={() => step(1)}><Text style={S.walkTx}>Sonraki ›</Text></Pressable>
          </View>
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
        <TreeStage key={tree.n} tree={tree} startK={prog[tree.n] || 0} onLeave={onLeave} onDone={onDone} onProgress={onProgress}
          onNext={() => {}} hasNext={tree.n < TREES.length} />
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
  viewBtn: { position: 'absolute', top: 112, right: 16, backgroundColor: 'rgba(107,66,38,0.92)', borderColor: '#f5deb3', borderWidth: 2, borderRadius: 18, paddingVertical: 7, paddingHorizontal: 12 },
  menu: { position: 'absolute', left: 24, right: 24, top: H * 0.16, backgroundColor: 'rgba(255,248,231,0.97)', borderColor: '#6b4226', borderWidth: 3, borderRadius: 20, padding: 14 },
  menuTitle: { color: '#3e2723', fontWeight: '800', fontSize: 17, textAlign: 'center', marginBottom: 8 },
  menuB: { backgroundColor: '#e65100', borderRadius: 14, paddingVertical: 13, paddingHorizontal: 14, marginTop: 8, borderWidth: 1.5, borderColor: '#6b4226' },
  menuTx: { color: '#fff', fontWeight: '800', fontSize: 16, textAlign: 'center' },
  tagN: { position: 'absolute', left: '50%', marginLeft: -9, top: '38%', minWidth: 18, height: 18, borderRadius: 9, backgroundColor: 'rgba(30,20,10,0.75)', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 },
  tagTx: { color: '#fff', fontSize: 10, fontWeight: '800' },
  tagSpot: { position: 'absolute', right: 8, top: 8, minWidth: 22, height: 22, borderRadius: 11, backgroundColor: 'rgba(30,20,10,0.75)', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  tagName: { position: 'absolute', top: '102%', alignSelf: 'center', backgroundColor: '#e65100', borderRadius: 9, paddingHorizontal: 7, paddingVertical: 2, minWidth: 54, alignItems: 'center' },
  tagNameTx: { color: '#fff', fontSize: 11, fontWeight: '800' },
  finTitle: { color: '#2e7d32', fontWeight: '800', fontSize: 22 },
  finSub: { color: '#3e2723', fontSize: 14, marginTop: 4 },
});
