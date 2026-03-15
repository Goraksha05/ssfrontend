// src/components/AppBackgroundWrapper.js
// ─────────────────────────────────────────────────────────────────────────────
//  DOPAMINE BACKGROUNDS — 6 animated wallpaper themes, auto-rotated per session
//  Effects: aurora mesh, neon pulse, cosmic bokeh, solar flare, bioluminescence,
//           crystalline prism — all pure CSS animations, zero external deps.
// ─────────────────────────────────────────────────────────────────────────────
import React, { useMemo } from 'react';

// ── Pick a background variant ─────────────────────────────────────────────────
// Change FORCE_THEME to a number 0-5 to pin one, or leave null for auto-rotation
const FORCE_THEME = null;

const THEMES = [
  'aurora',        // 0 — shifting northern-lights mesh
  'neon-pulse',    // 1 — deep dark with glowing rings
  'cosmic',        // 2 — space bokeh with nebula clouds
  'solar',         // 3 — warm golden-hour plasma
  'bioluminescence', // 4 — ocean-depth glowing orbs
  'prism',         // 5 — refracted crystal light
];

const pickTheme = () => {
  if (FORCE_THEME !== null) return THEMES[FORCE_THEME];
  // Daily rotation so it changes every day but stays consistent per session
  const day = Math.floor(Date.now() / (1000 * 60 * 60 * 24));
  return THEMES[day % THEMES.length];
};

// ── Shared wrapper style ──────────────────────────────────────────────────────
const baseWrapper = {
  minHeight: '100vh',
  backgroundSize: 'cover',
  backgroundRepeat: 'no-repeat',
  backgroundPosition: 'center',
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'flex-start',
  paddingTop: '58px',
  color: '#f0f8ff',
  position: 'relative',
  overflow: 'hidden',
};

// ── Per-theme gradient configs ────────────────────────────────────────────────
const gradients = {
  aurora: `
    radial-gradient(ellipse 160% 80% at 20% 0%,   #0d1b2a 0%, transparent 60%),
    radial-gradient(ellipse 120% 60% at 80% 100%,  #0d1b2a 0%, transparent 60%),
    linear-gradient(135deg, #020c18 0%, #041528 40%, #050f22 100%)
  `,
  'neon-pulse': `
    radial-gradient(ellipse 200% 100% at 50% -20%, #0a001f 0%, transparent 65%),
    linear-gradient(160deg, #03000f 0%, #07001a 50%, #000510 100%)
  `,
  cosmic: `
    radial-gradient(ellipse 180% 90% at 30% 20%,  #060015 0%, transparent 60%),
    radial-gradient(ellipse 150% 70% at 70% 80%,  #000a20 0%, transparent 60%),
    linear-gradient(180deg, #02000d 0%, #040018 60%, #000e1c 100%)
  `,
  solar: `
    radial-gradient(ellipse 200% 80% at 50% 110%, #1a0800 0%, transparent 60%),
    radial-gradient(ellipse 120% 60% at 90% 0%,   #180500 0%, transparent 55%),
    linear-gradient(160deg, #0d0200 0%, #1c0600 50%, #100300 100%)
  `,
  bioluminescence: `
    radial-gradient(ellipse 180% 80% at 20% 80%,  #000d15 0%, transparent 60%),
    radial-gradient(ellipse 140% 60% at 80% 20%,  #00100a 0%, transparent 60%),
    linear-gradient(160deg, #000810 0%, #000d1a 50%, #000a0f 100%)
  `,
  prism: `
    radial-gradient(ellipse 200% 100% at 50% 0%,  #08001a 0%, transparent 65%),
    linear-gradient(135deg, #060010 0%, #0a001c 50%, #04000e 100%)
  `,
};

// ── Layered pseudo-element blobs injected via <style> ─────────────────────────
const getKeyframes = (theme) => `
/* ── AURORA ─────────────────────────────────────────────────────────── */
@keyframes aurora1 {
  0%   { transform: translate(0,   0)   scale(1)   rotate(0deg);   }
  33%  { transform: translate(6%,  4%)  scale(1.1) rotate(12deg);  }
  66%  { transform: translate(-4%, 8%)  scale(0.95) rotate(-8deg); }
  100% { transform: translate(0,   0)   scale(1)   rotate(0deg);   }
}
@keyframes aurora2 {
  0%   { transform: translate(0,   0)   scale(1)    rotate(0deg);  }
  25%  { transform: translate(-8%, -5%) scale(1.15) rotate(-15deg);}
  75%  { transform: translate(5%,  10%) scale(0.9)  rotate(10deg); }
  100% { transform: translate(0,   0)   scale(1)    rotate(0deg);  }
}
@keyframes aurora3 {
  0%,100%{ transform: translate(0,0) scale(1); }
  50%    { transform: translate(4%,-6%) scale(1.2); }
}

/* ── NEON PULSE ──────────────────────────────────────────────────────── */
@keyframes neonRing1 {
  0%,100%{ transform: scale(1);   opacity: 0.6; }
  50%    { transform: scale(1.18); opacity: 1;   }
}
@keyframes neonRing2 {
  0%,100%{ transform: scale(1);   opacity: 0.4; }
  50%    { transform: scale(1.25); opacity: 0.8; }
}
@keyframes neonDrift {
  0%   { transform: translate(0,0) rotate(0deg);   }
  50%  { transform: translate(3%,5%) rotate(180deg); }
  100% { transform: translate(0,0) rotate(360deg);  }
}

/* ── COSMIC ──────────────────────────────────────────────────────────── */
@keyframes cosmicFloat1 {
  0%,100%{ transform: translate(0,0)    scale(1);    }
  33%    { transform: translate(3%,5%)  scale(1.1);  }
  66%    { transform: translate(-4%,2%) scale(0.95); }
}
@keyframes cosmicFloat2 {
  0%,100%{ transform: translate(0,0)    scale(1);    }
  50%    { transform: translate(-5%,-4%) scale(1.15); }
}
@keyframes twinkle {
  0%,100%{ opacity:0.2; transform:scale(0.8); }
  50%    { opacity:1;   transform:scale(1.4); }
}

/* ── SOLAR ───────────────────────────────────────────────────────────── */
@keyframes solarPulse {
  0%,100%{ transform: scale(1);    opacity:0.8; }
  50%    { transform: scale(1.22); opacity:1;   }
}
@keyframes solarDrift {
  0%   { transform: translate(0,0) rotate(0deg); }
  100% { transform: translate(2%,3%) rotate(360deg); }
}
@keyframes coronaFlare {
  0%,100%{ clip-path: polygon(50% 0%,100% 30%,80% 100%,20% 100%,0% 30%); opacity:0.6; }
  50%    { clip-path: polygon(50% 5%,95% 25%,85% 95%,15% 95%,5% 25%);    opacity:0.9; }
}

/* ── BIOLUMINESCENCE ─────────────────────────────────────────────────── */
@keyframes bioFloat1 {
  0%,100%{ transform: translate(0,0)    scale(1);   opacity:0.5; }
  33%    { transform: translate(4%,-6%) scale(1.1); opacity:0.9; }
  66%    { transform: translate(-3%,5%) scale(0.9); opacity:0.6; }
}
@keyframes bioFloat2 {
  0%,100%{ transform: translate(0,0)    scale(1);   }
  50%    { transform: translate(-5%,4%) scale(1.2); }
}
@keyframes bioGlow {
  0%,100%{ filter: blur(40px) brightness(1);   }
  50%    { filter: blur(30px) brightness(1.6);  }
}

/* ── PRISM ───────────────────────────────────────────────────────────── */
@keyframes prismRotate {
  from { transform: rotate(0deg)   scale(1);   }
  to   { transform: rotate(360deg) scale(1.1); }
}
@keyframes prismShift {
  0%,100%{ hue-rotate: 0deg; }
  50%    { hue-rotate: 60deg; }
}
@keyframes prismPulse {
  0%,100%{ opacity:0.5; transform:scale(1);    }
  50%    { opacity:1;   transform:scale(1.15); }
}

/* ── PARTICLE DRIFT ──────────────────────────────────────────────────── */
@keyframes particleDrift {
  0%   { transform: translateY(100vh) translateX(0)    scale(0);   opacity:0; }
  10%  { opacity:1; transform: translateY(85vh)  translateX(2%)  scale(1);   }
  90%  { opacity:0.6; }
  100% { transform: translateY(-10vh) translateX(-5%) scale(0.5); opacity:0; }
}
`;

// ── Canvas layer content per theme ────────────────────────────────────────────
const BlobLayer = ({ theme }) => {
  const blobs = useMemo(() => {
    switch (theme) {
      case 'aurora':
        return (
          <>
            {/* Teal-green aurora band */}
            <div style={{
              position:'absolute', width:'90vw', height:'55vh',
              borderRadius:'50%',
              background: 'radial-gradient(ellipse, rgba(0,255,180,0.28) 0%, rgba(0,200,140,0.12) 40%, transparent 70%)',
              top:'5%', left:'-15%',
              filter:'blur(60px)',
              animation:'aurora1 18s ease-in-out infinite',
              mixBlendMode:'screen',
            }}/>
            {/* Purple aurora */}
            <div style={{
              position:'absolute', width:'80vw', height:'50vh',
              borderRadius:'50%',
              background: 'radial-gradient(ellipse, rgba(120,40,255,0.32) 0%, rgba(80,0,200,0.15) 45%, transparent 70%)',
              top:'20%', right:'-10%',
              filter:'blur(70px)',
              animation:'aurora2 22s ease-in-out infinite',
              mixBlendMode:'screen',
            }}/>
            {/* Cyan shimmer */}
            <div style={{
              position:'absolute', width:'60vw', height:'40vh',
              borderRadius:'50%',
              background: 'radial-gradient(ellipse, rgba(0,200,255,0.2) 0%, rgba(0,150,230,0.08) 50%, transparent 70%)',
              bottom:'10%', left:'20%',
              filter:'blur(80px)',
              animation:'aurora3 14s ease-in-out infinite',
              mixBlendMode:'screen',
            }}/>
            {/* Pink hint */}
            <div style={{
              position:'absolute', width:'50vw', height:'30vh',
              borderRadius:'50%',
              background: 'radial-gradient(ellipse, rgba(255,80,160,0.18) 0%, transparent 65%)',
              top:'40%', left:'35%',
              filter:'blur(90px)',
              animation:'aurora1 26s ease-in-out infinite reverse',
              mixBlendMode:'screen',
            }}/>
            {/* Stars */}
            {[...Array(60)].map((_,i) => (
              <div key={i} style={{
                position:'absolute',
                width: i%5===0 ? 3 : 2,
                height: i%5===0 ? 3 : 2,
                borderRadius:'50%',
                background:'#fff',
                top:`${(i*17+7)%95}%`,
                left:`${(i*23+11)%98}%`,
                opacity: 0.1 + (i%4)*0.15,
                animation:`twinkle ${2.5+(i%4)*1.2}s ease-in-out infinite`,
                animationDelay:`${(i%8)*0.4}s`,
              }}/>
            ))}
          </>
        );

      case 'neon-pulse':
        return (
          <>
            {/* Primary neon ring — cyan */}
            <div style={{
              position:'absolute', width:'70vmin', height:'70vmin',
              borderRadius:'50%',
              border:'2px solid rgba(0,255,255,0.2)',
              boxShadow:'0 0 60px rgba(0,255,255,0.25), inset 0 0 60px rgba(0,255,255,0.08)',
              top:'50%', left:'50%',
              transform:'translate(-50%,-50%)',
              animation:'neonRing1 4s ease-in-out infinite',
              mixBlendMode:'screen',
            }}/>
            <div style={{
              position:'absolute', width:'50vmin', height:'50vmin',
              borderRadius:'50%',
              border:'1.5px solid rgba(0,255,255,0.35)',
              boxShadow:'0 0 40px rgba(0,255,255,0.4)',
              top:'50%', left:'50%',
              transform:'translate(-50%,-50%)',
              animation:'neonRing1 4s ease-in-out infinite 0.5s',
            }}/>
            {/* Magenta ring */}
            <div style={{
              position:'absolute', width:'85vmin', height:'85vmin',
              borderRadius:'50%',
              border:'1px solid rgba(255,0,200,0.18)',
              boxShadow:'0 0 80px rgba(255,0,200,0.2), inset 0 0 80px rgba(255,0,200,0.06)',
              top:'50%', left:'50%',
              transform:'translate(-50%,-50%)',
              animation:'neonRing2 6s ease-in-out infinite',
            }}/>
            {/* Core glow */}
            <div style={{
              position:'absolute', width:'30vmin', height:'30vmin',
              borderRadius:'50%',
              background:'radial-gradient(circle, rgba(0,255,255,0.25) 0%, rgba(0,200,255,0.08) 50%, transparent 70%)',
              top:'50%', left:'50%',
              transform:'translate(-50%,-50%)',
              filter:'blur(20px)',
              animation:'neonRing1 3s ease-in-out infinite',
            }}/>
            {/* Corner glows */}
            {[
              { top:'-5%', left:'-5%', color:'rgba(120,0,255,0.35)', s:'45vmin' },
              { bottom:'-5%', right:'-5%', color:'rgba(0,255,180,0.3)', s:'40vmin' },
              { top:'-5%', right:'-5%', color:'rgba(255,100,0,0.2)', s:'35vmin' },
              { bottom:'-5%', left:'-5%', color:'rgba(0,100,255,0.3)', s:'38vmin' },
            ].map((c,i) => (
              <div key={i} style={{
                position:'absolute',
                width:c.s, height:c.s,
                borderRadius:'50%',
                background:`radial-gradient(circle, ${c.color} 0%, transparent 70%)`,
                ...c,
                filter:'blur(50px)',
                animation:`neonDrift ${12+i*3}s linear infinite ${i%2===0 ? '' : 'reverse'}`,
                mixBlendMode:'screen',
              }}/>
            ))}
            {/* Scan lines */}
            <div style={{
              position:'absolute', inset:0,
              backgroundImage:'repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(0,255,255,0.012) 3px, rgba(0,255,255,0.012) 4px)',
              pointerEvents:'none',
            }}/>
          </>
        );

      case 'cosmic':
        return (
          <>
            {/* Nebula cloud 1 — blue-purple */}
            <div style={{
              position:'absolute', width:'80vw', height:'60vh',
              borderRadius:'40% 60% 55% 45% / 45% 55% 60% 40%',
              background:'radial-gradient(ellipse, rgba(80,0,200,0.35) 0%, rgba(40,0,120,0.15) 40%, transparent 70%)',
              top:'-10%', left:'-10%',
              filter:'blur(70px)',
              animation:'cosmicFloat1 20s ease-in-out infinite',
              mixBlendMode:'screen',
            }}/>
            {/* Nebula cloud 2 — pink */}
            <div style={{
              position:'absolute', width:'70vw', height:'50vh',
              borderRadius:'55% 45% 40% 60% / 50% 60% 40% 50%',
              background:'radial-gradient(ellipse, rgba(220,0,120,0.25) 0%, rgba(160,0,80,0.1) 40%, transparent 70%)',
              bottom:'-5%', right:'-5%',
              filter:'blur(80px)',
              animation:'cosmicFloat2 24s ease-in-out infinite',
              mixBlendMode:'screen',
            }}/>
            {/* Galaxy core */}
            <div style={{
              position:'absolute', width:'40vmin', height:'40vmin',
              borderRadius:'50%',
              background:'radial-gradient(circle, rgba(255,220,100,0.15) 0%, rgba(255,160,0,0.06) 30%, transparent 65%)',
              top:'35%', left:'55%',
              filter:'blur(40px)',
              animation:'cosmicFloat1 16s ease-in-out infinite reverse',
              mixBlendMode:'screen',
            }}/>
            {/* Star field */}
            {[...Array(120)].map((_,i) => (
              <div key={i} style={{
                position:'absolute',
                width: i%8===0 ? 4 : i%4===0 ? 3 : 2,
                height: i%8===0 ? 4 : i%4===0 ? 3 : 2,
                borderRadius:'50%',
                background: i%8===0 ? '#fff9e0' : i%4===0 ? '#d0e8ff' : '#ffffff',
                top:`${(i*13+5)%97}%`,
                left:`${(i*19+3)%99}%`,
                opacity: 0.05 + (i%5)*0.18,
                boxShadow: i%8===0 ? `0 0 ${4+i%4}px rgba(255,240,180,0.8)` : 'none',
                animation:`twinkle ${1.5+(i%5)*0.8}s ease-in-out infinite`,
                animationDelay:`${(i%12)*0.3}s`,
              }}/>
            ))}
            {/* Shooting star particles */}
            {[0,1,2].map(i => (
              <div key={i} style={{
                position:'absolute',
                width:60, height:1,
                background:'linear-gradient(90deg, transparent, rgba(255,255,255,0.8), transparent)',
                top:`${20+i*25}%`,
                left:'-5%',
                transform:`rotate(${-10+i*5}deg)`,
                animation:`particleDrift ${8+i*4}s linear infinite`,
                animationDelay:`${i*3}s`,
                opacity:0,
              }}/>
            ))}
          </>
        );

      case 'solar':
        return (
          <>
            {/* Solar core */}
            <div style={{
              position:'absolute', width:'50vmin', height:'50vmin',
              borderRadius:'50%',
              background:'radial-gradient(circle, rgba(255,220,0,0.5) 0%, rgba(255,140,0,0.3) 30%, rgba(255,60,0,0.15) 60%, transparent 80%)',
              top:'30%', left:'50%',
              transform:'translateX(-50%)',
              filter:'blur(30px)',
              animation:'solarPulse 3s ease-in-out infinite',
              mixBlendMode:'screen',
            }}/>
            {/* Corona ring 1 */}
            <div style={{
              position:'absolute', width:'70vmin', height:'70vmin',
              borderRadius:'50%',
              background:'radial-gradient(circle, transparent 45%, rgba(255,120,0,0.2) 50%, rgba(255,80,0,0.08) 65%, transparent 75%)',
              top:'30%', left:'50%',
              transform:'translateX(-50%) translateY(-10%)',
              filter:'blur(20px)',
              animation:'solarPulse 4s ease-in-out infinite 0.5s',
              mixBlendMode:'screen',
            }}/>
            {/* Solar flare — top right */}
            <div style={{
              position:'absolute', width:'60vw', height:'30vh',
              borderRadius:'0 100% 40% 0',
              background:'radial-gradient(ellipse at 0% 50%, rgba(255,180,0,0.3) 0%, rgba(255,100,0,0.1) 40%, transparent 70%)',
              top:'5%', right:'-10%',
              filter:'blur(50px)',
              animation:'solarDrift 30s linear infinite',
              mixBlendMode:'screen',
            }}/>
            {/* Warm ember glow — bottom */}
            <div style={{
              position:'absolute', width:'100vw', height:'50vh',
              borderRadius:'50% 50% 0 0',
              background:'radial-gradient(ellipse at 50% 100%, rgba(255,80,0,0.3) 0%, rgba(180,40,0,0.12) 40%, transparent 70%)',
              bottom:'-20%',
              filter:'blur(60px)',
              animation:'solarPulse 6s ease-in-out infinite 1s',
              mixBlendMode:'screen',
            }}/>
            {/* Gold particle sparks */}
            {[...Array(25)].map((_,i) => (
              <div key={i} style={{
                position:'absolute',
                width: 2+i%3,
                height: 2+i%3,
                borderRadius:'50%',
                background: i%3===0 ? '#ffee00' : i%3===1 ? '#ff9900' : '#ff5500',
                boxShadow:`0 0 ${4+i%4}px currentColor`,
                top:`${(i*31+10)%90}%`,
                left:`${(i*43+5)%95}%`,
                opacity: 0.3 + (i%3)*0.3,
                animation:`twinkle ${1+i%3}s ease-in-out infinite`,
                animationDelay:`${(i%6)*0.5}s`,
              }}/>
            ))}
          </>
        );

      case 'bioluminescence':
        return (
          <>
            {/* Deep cyan bloom */}
            <div style={{
              position:'absolute', width:'75vw', height:'55vh',
              borderRadius:'40% 60% 50% 50% / 55% 45% 60% 40%',
              background:'radial-gradient(ellipse, rgba(0,220,255,0.28) 0%, rgba(0,160,200,0.1) 40%, transparent 70%)',
              bottom:'-10%', left:'-5%',
              filter:'blur(65px)',
              animation:'bioFloat1 16s ease-in-out infinite',
              mixBlendMode:'screen',
            }}/>
            {/* Green bioluminescence */}
            <div style={{
              position:'absolute', width:'60vw', height:'45vh',
              borderRadius:'55% 45% 40% 60% / 50% 60% 40% 50%',
              background:'radial-gradient(ellipse, rgba(0,255,160,0.22) 0%, rgba(0,200,100,0.08) 45%, transparent 70%)',
              top:'10%', right:'-10%',
              filter:'blur(75px)',
              animation:'bioFloat2 20s ease-in-out infinite',
              mixBlendMode:'screen',
            }}/>
            {/* Jellyfish glow orbs */}
            {[
              { w:'20vmin', c:'rgba(0,200,255,0.5)', t:'20%', l:'20%', d:'8s' },
              { w:'15vmin', c:'rgba(0,255,180,0.45)', t:'60%', l:'65%', d:'11s' },
              { w:'12vmin', c:'rgba(100,0,255,0.35)', t:'40%', l:'40%', d:'9s' },
              { w:'18vmin', c:'rgba(0,180,255,0.4)', t:'75%', l:'15%', d:'13s' },
              { w:'10vmin', c:'rgba(0,255,150,0.4)', t:'15%', l:'75%', d:'7s' },
            ].map((o,i) => (
              <div key={i} style={{
                position:'absolute', width:o.w, height:o.w,
                borderRadius:'50%',
                background:`radial-gradient(circle, ${o.c} 0%, transparent 70%)`,
                top:o.t, left:o.l,
                filter:'blur(25px)',
                animation:`bioFloat1 ${o.d} ease-in-out infinite`,
                animationDelay:`${i*1.5}s`,
                mixBlendMode:'screen',
              }}/>
            ))}
            {/* Plankton particles */}
            {[...Array(50)].map((_,i) => (
              <div key={i} style={{
                position:'absolute',
                width: 1+(i%3),
                height: 1+(i%3),
                borderRadius:'50%',
                background: i%3===0 ? '#00ffcc' : i%3===1 ? '#00ccff' : '#80ffcc',
                top:`${(i*17+8)%95}%`,
                left:`${(i*29+4)%97}%`,
                opacity: 0.15 + (i%4)*0.2,
                boxShadow:`0 0 ${2+i%3}px currentColor`,
                animation:`twinkle ${2+(i%5)*0.7}s ease-in-out infinite`,
                animationDelay:`${(i%10)*0.4}s`,
              }}/>
            ))}
          </>
        );

      case 'prism':
        return (
          <>
            {/* Spinning prism blades */}
            {[
              { color:'rgba(255,0,128,0.3)',  deg:0   },
              { color:'rgba(0,100,255,0.3)',  deg:60  },
              { color:'rgba(0,255,150,0.28)', deg:120 },
              { color:'rgba(255,200,0,0.25)', deg:180 },
              { color:'rgba(180,0,255,0.28)', deg:240 },
              { color:'rgba(0,220,255,0.25)', deg:300 },
            ].map((b,i) => (
              <div key={i} style={{
                position:'absolute',
                width:'50vw', height:'200vh',
                background:`linear-gradient(90deg, transparent, ${b.color}, transparent)`,
                top:'-50vh', left:'50%',
                transformOrigin:'0 50%',
                transform:`rotate(${b.deg}deg)`,
                filter:'blur(40px)',
                animation:`prismRotate ${60+i*10}s linear infinite ${i%2===0?'':'reverse'}`,
                mixBlendMode:'screen',
              }}/>
            ))}
            {/* Central lens flare */}
            <div style={{
              position:'absolute', width:'20vmin', height:'20vmin',
              borderRadius:'50%',
              background:'radial-gradient(circle, rgba(255,255,255,0.4) 0%, rgba(200,100,255,0.2) 30%, transparent 70%)',
              top:'45%', left:'50%',
              transform:'translate(-50%,-50%)',
              filter:'blur(15px)',
              animation:'prismPulse 2.5s ease-in-out infinite',
              mixBlendMode:'screen',
            }}/>
            {/* Rainbow refraction specks */}
            {[...Array(40)].map((_,i) => {
              const hue = (i*9)%360;
              return (
                <div key={i} style={{
                  position:'absolute',
                  width: 3+(i%3),
                  height: 3+(i%3),
                  borderRadius: i%4===0 ? '0' : '50%',
                  background:`hsl(${hue},100%,65%)`,
                  boxShadow:`0 0 ${4+i%4}px hsl(${hue},100%,65%)`,
                  top:`${(i*23+7)%93}%`,
                  left:`${(i*37+13)%96}%`,
                  opacity: 0.3 + (i%3)*0.25,
                  animation:`twinkle ${1.2+(i%4)*0.8}s ease-in-out infinite`,
                  animationDelay:`${(i%8)*0.35}s`,
                }}/>
              );
            })}
          </>
        );

      default:
        return null;
    }
  }, [theme]);

  return blobs;
};

// ── Floating particles overlay (shared across all themes) ─────────────────────
const FloatingParticles = ({ theme }) => {
  const count = 12;
  const colors = {
    aurora:           ['#00ffb4','#7b2fff','#00ccff'],
    'neon-pulse':     ['#00ffff','#ff00cc','#8800ff'],
    cosmic:           ['#ffffff','#aabbff','#ffddaa'],
    solar:            ['#ffee00','#ff8800','#ff3300'],
    bioluminescence:  ['#00ffcc','#00ccff','#80ff99'],
    prism:            ['#ff66aa','#00aaff','#aaff66'],
  };
  const palette = colors[theme] || colors.aurora;

  return (
    <>
      {[...Array(count)].map((_,i) => (
        <div key={i} style={{
          position:'absolute',
          width: 3+(i%3),
          height: 20+(i%4)*15,
          borderRadius:'50%',
          background:`linear-gradient(180deg, ${palette[i%3]}, transparent)`,
          left:`${(i*8+5)}%`,
          bottom:'-5%',
          opacity:0,
          animation:`particleDrift ${10+(i%5)*3}s ease-in-out infinite`,
          animationDelay:`${i*1.8}s`,
          filter:'blur(1px)',
        }}/>
      ))}
    </>
  );
};

// ── Noise grain overlay ───────────────────────────────────────────────────────
const grainStyle = {
  position:'absolute', inset:0, pointerEvents:'none', zIndex:2,
  backgroundImage:`url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
  opacity:0.025,
};

// ── Main Component ────────────────────────────────────────────────────────────
const AppBackgroundWrapper = ({ children }) => {
  const theme = useMemo(() => pickTheme(), []);

  return (
    <>
      {/* Inject keyframe animations once */}
      <style>{getKeyframes(theme)}</style>

      <div style={{ ...baseWrapper, background: gradients[theme], backgroundSize:'cover' }}>
        {/* Animated blob layers */}
        <BlobLayer theme={theme} />

        {/* Floating particles */}
        <FloatingParticles theme={theme} />

        {/* Subtle film grain */}
        <div style={grainStyle} aria-hidden="true" />

        {/* Vignette */}
        <div style={{
          position:'absolute', inset:0, pointerEvents:'none', zIndex:1,
          background:'radial-gradient(ellipse 120% 100% at 50% 50%, transparent 40%, rgba(0,0,0,0.55) 100%)',
        }} aria-hidden="true" />

        {/* Content */}
        <div style={{ position:'relative', zIndex:5, width:'100%' }}>
          {children}
        </div>
      </div>
    </>
  );
};

export default AppBackgroundWrapper;