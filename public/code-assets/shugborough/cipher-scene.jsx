/* global React, CompositionStage, useComposition, Easing, animate, interpolate, clamp,
   useTweaks, TweaksPanel, TweakSection, TweakToggle */

var W = 1920, H = 1080;
var BG = '#161826';
var INK = '#e9e9ed';
var DIM = '#5b5e73';
var ACCENT = '#9184d9';
var MUTED = '#8f92a6';

var MOTION = {
  enter: function (start, dur) { return animate({ from: 0, to: 1, start: start, end: start + (dur || 0.7), ease: Easing.easeOutCubic }); },
  draw: function (start, dur) { return animate({ from: 0, to: 1, start: start, end: start + (dur || 1.1), ease: Easing.easeInOutQuart }); },
  pop: function (start, dur) { return animate({ from: 0, to: 1, start: start, end: start + (dur || 0.55), ease: Easing.easeOutBack }); }
};

var CIPHER = ['O', 'U', 'O', 'S', 'V', 'A', 'V', 'V'];
var SLOT = 118, GAP = 30;
var PITCH = SLOT + GAP;
var ROW_W = CIPHER.length * SLOT + (CIPHER.length - 1) * GAP;
var ROW_X = (W - ROW_W) / 2;
var ROW_Y = 232;
function cx(i) { return ROW_X + SLOT / 2 + i * PITCH; }

function Glow() {
  return (
    <div style={{
      position: 'absolute', inset: 0, pointerEvents: 'none',
      background: 'radial-gradient(120% 90% at 50% 28%, rgba(145,132,217,0.10) 0%, rgba(22,24,38,0) 62%)'
    }} />
  );
}

function CipherLetter(props) {
  var T = props.T, i = props.i, events = props.events;
  var appear = MOTION.enter(props.at, 0.8)(T);
  var on = 0, pulse = 0;
  for (var k = 0; k < events.length; k++) {
    var e = events[k];
    if (e.indices.indexOf(i) < 0) continue;
    var up = clamp(MOTION.enter(e.from, 0.45)(T), 0, 1);
    var down = clamp(MOTION.enter(e.to, 0.4)(T), 0, 1);
    on = Math.max(on, up * (1 - down));
    var pw = clamp((T - e.from) / 0.5, 0, 1);
    pulse = Math.max(pulse, Math.sin(pw * Math.PI) * (T >= e.from ? 1 : 0) * (1 - down));
  }
  var color = on > 0 ? 'color-mix(in oklab, ' + INK + ' ' + (100 - on * 100) + '%, ' + ACCENT + ')' : INK;
  return (
    <div style={{
      position: 'absolute', left: ROW_X + i * PITCH, top: 0,
      width: SLOT, textAlign: 'center',
      opacity: appear,
      transform: 'translateY(' + (1 - appear) * 44 + 'px) scale(' + (0.94 + appear * 0.06 + pulse * 0.07) + ')',
      font: '500 172px/0.9 Inter, system-ui, sans-serif',
      letterSpacing: '0.02em',
      color: color,
      textShadow: '0 0 ' + (40 + 44 * on) + 'px rgba(145,132,217,' + (0.16 + 0.42 * on) + ')'
    }}>
      {CIPHER[i]}
    </div>
  );
}

function AnchorLetter(props) {
  var p = clamp(MOTION.pop(props.at, 0.6)(props.T), 0, 1);
  var mark = MOTION.draw(props.at + 0.25, 0.8)(props.T);
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18,
      opacity: p,
      transform: 'translateY(' + (1 - p) * 26 + 'px) scale(' + (0.8 + p * 0.2) + ')'
    }}>
      <div style={{
        font: '500 132px/0.9 Inter, system-ui, sans-serif',
        letterSpacing: '0.02em', color: ACCENT,
        textShadow: '0 0 48px rgba(145,132,217,0.35)'
      }}>{props.ch}</div>
      <div style={{ width: 96 * mark, height: 2, background: ACCENT, opacity: 0.85, borderRadius: 2 }} />
    </div>
  );
}

/* bracket above the two O's, with its little explainer */
function OhsCallout(props) {
  var T = props.T, at = props.at;
  var a = cx(0), b = cx(2);
  var draw = MOTION.draw(at, 0.8)(T);
  var lab = clamp(MOTION.enter(at + 0.4, 0.6)(T), 0, 1);
  var out = 1 - clamp(MOTION.enter(props.out, 0.5)(T), 0, 1);
  var y = ROW_Y - 44;
  return (
    <div style={{ position: 'absolute', left: 0, top: 0, width: W, height: H, pointerEvents: 'none', opacity: out }}>
      <div style={{ position: 'absolute', left: a, top: y, width: (b - a) * draw, height: 2, background: ACCENT, opacity: 0.8 }} />
      <div style={{ position: 'absolute', left: a, top: y, width: 2, height: 22 * draw, background: ACCENT, opacity: 0.8 * clamp(draw * 8, 0, 1) }} />
      <div style={{ position: 'absolute', left: b, top: y, width: 2, height: 22 * draw, background: ACCENT, opacity: 0.8 * clamp((draw - 0.85) / 0.15, 0, 1) }} />
      <div style={{
        position: 'absolute', left: (a + b) / 2, top: y - 62,
        transform: 'translate(-50%, ' + (1 - lab) * 10 + 'px)', opacity: lab,
        font: '500 40px/1 Inter, system-ui, sans-serif', letterSpacing: '0.04em', color: ACCENT,
        whiteSpace: 'nowrap'
      }}>2 OO's</div>
    </div>
  );
}

/* arrow under the S and the O, read right to left */
function BackwardCallout(props) {
  var T = props.T, at = props.at;
  var right = cx(3), left = cx(2);
  var draw = MOTION.draw(at, 0.9)(T);
  var head = clamp(MOTION.pop(at + 0.7, 0.5)(T), 0, 1);
  var out = 1 - clamp(MOTION.enter(props.out, 0.5)(T), 0, 1);
  var y = ROW_Y + 244;
  var span = (right - left) * draw;
  return (
    <div style={{ position: 'absolute', left: 0, top: 0, width: W, height: H, pointerEvents: 'none', opacity: out }}>
      <div style={{ position: 'absolute', left: right - span, top: y, width: span, height: 2, background: ACCENT, opacity: 0.85 }} />
      <div style={{ position: 'absolute', left: right, top: y - 26 * clamp(draw * 8, 0, 1), width: 2, height: 26 * clamp(draw * 8, 0, 1), background: ACCENT, opacity: 0.85 * clamp(draw * 8, 0, 1) }} />
      <div style={{ position: 'absolute', left: left, top: y - 26, width: 2, height: 26, background: ACCENT, opacity: 0.85 * clamp((draw - 0.8) / 0.2, 0, 1) }} />
      <div style={{
        position: 'absolute', left: left, top: y + 1,
        transform: 'translate(-100%, -50%) scale(' + head + ')',
        width: 0, height: 0,
        borderTop: '9px solid transparent', borderBottom: '9px solid transparent',
        borderRight: '15px solid ' + ACCENT, opacity: head
      }} />
    </div>
  );
}

function Message(props) {
  var T = props.T;
  return (
    <div style={{
      position: 'absolute', left: 180, right: 180, top: 820,
      display: 'flex', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'baseline',
      columnGap: 24, rowGap: 14
    }}>
      {props.words.map(function (w, i) {
        var p = clamp(MOTION.enter(w.at, 0.7)(T), 0, 1);
        var settle = clamp(MOTION.enter(w.at + 0.7, 0.9)(T), 0, 1);
        return (
          <div key={i} style={{
            opacity: p,
            transform: 'translateY(' + (1 - p) * 16 + 'px)',
            font: '400 66px/1.1 Inter, system-ui, sans-serif',
            letterSpacing: '0.01em',
            color: 'color-mix(in oklab, ' + ACCENT + ' ' + (100 - settle * 100) + '%, ' + INK + ')',
            whiteSpace: 'nowrap'
          }}>{w.text}</div>
        );
      })}
    </div>
  );
}

function Piece() {
  var c = useComposition();
  var T = c.T, CUES = c.CUES;

  var END = c.authoredTotal + 5;
  var events = [
    // "o you," — the O then the U, lit until the backward reading takes over
    { indices: [0], from: CUES.ReadOU + 0.3, to: CUES.Backward + 0.15 },
    { indices: [1], from: CUES.ReadOU + 1.6, to: CUES.Backward + 0.15 },
    // "to those" — both O's and the S
    { indices: [2, 3], from: CUES.TwoOhs + 0.4, to: CUES.Backward + 0.15 },
    // "backward so" — the S then the O, right to left
    { indices: [3], from: CUES.Backward + 0.45, to: CUES.ReadVs + 0.2 },
    { indices: [2], from: CUES.Backward + 0.95, to: CUES.ReadVs + 0.2 },
    // "you off" — the U, then the end O and the V round on the other side
    { indices: [1], from: CUES.ReadVs + 0.5, to: CUES.Enclosed + 0.15 },
    { indices: [0, 7], from: CUES.ReadVs + 1.3, to: CUES.Enclosed + 0.15 },
    // "to be" — the two V's that enclose the A
    { indices: [4, 6], from: CUES.Enclosed + 0.4, to: END },
    // "as" — the A and the S together
    { indices: [3, 5], from: CUES.Enclosed + 2.2, to: END }
  ];
  var words = [
    { text: 'o', at: CUES.ReadOU + 0.55 },
    { text: 'you,', at: CUES.ReadOU + 1.85 },
    { text: 'to those', at: CUES.TwoOhs + 1.5 },
    { text: 'backward', at: CUES.Backward + 1.6 },
    { text: 'so', at: CUES.Backward + 2.3 },
    { text: 'you', at: CUES.ReadVs + 0.7 },
    { text: 'off', at: CUES.ReadVs + 1.5 },
    { text: 'to be', at: CUES.Enclosed + 0.7 },
    { text: 'as', at: CUES.Enclosed + 2.5 }
  ];

  var zoom = interpolate(T, [0, c.authoredTotal], [1.05, 1.0], Easing.easeOutSine);
  var driftY = interpolate(T, [0, c.authoredTotal], [16, -8], Easing.linear);

  return (
    <div style={{ position: 'absolute', inset: 0, background: BG, overflow: 'hidden' }}>
      <Glow />
      <div style={{
        position: 'absolute', inset: 0,
        transform: 'scale(' + zoom + ') translateY(' + driftY + 'px)',
        transformOrigin: '50% 44%'
      }}>
        <div style={{ position: 'absolute', left: 0, top: ROW_Y, width: W, height: 200 }}>
          {CIPHER.map(function (ch, i) {
            return <CipherLetter key={i} i={i} T={T} at={CUES.Opening + 0.4 + i * 0.16} events={events} />;
          })}
        </div>

        <OhsCallout T={T} at={CUES.TwoOhs + 0.7} out={CUES.Backward - 0.2} />
        <BackwardCallout T={T} at={CUES.Backward + 0.55} out={CUES.ReadVs + 0.1} />

        <div style={{ position: 'absolute', left: 0, right: 0, top: 596 }}>
          <div style={{ position: 'absolute', left: 250, top: 0, transform: 'translateX(-50%)' }}>
            <AnchorLetter T={T} ch="D" at={CUES.Anchors + 0.2} />
          </div>
          <div style={{ position: 'absolute', left: 1670, top: 0, transform: 'translateX(-50%)' }}>
            <AnchorLetter T={T} ch="M" at={CUES.Anchors + 0.55} />
          </div>
        </div>

        <Message T={T} words={words} />
      </div>
    </div>
  );
}

function CipherStage() {
  var tw = useTweaks(window.TWEAK_DEFAULTS);
  var t = tw[0], setTweak = tw[1];
  return (
    <React.Fragment>
      <CompositionStage width={W} height={H} bg={BG}
                        scenes={window.OM_SCENES} playback={window.OM_PLAYBACK}>
        <Piece />
      </CompositionStage>
      <TweaksPanel>
        <TweakSection label="Editing" />
        <TweakToggle label="Motion editor" value={t.motionEditor}
                     onChange={function (v) { setTweak('motionEditor', v); }} />
      </TweaksPanel>
    </React.Fragment>
  );
}

window.CipherStage = CipherStage;
