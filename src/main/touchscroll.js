// On an iPhone the side panel would not turn finger swipes into scrolling, even though scrolling it from code worked
// (found with Safari Web Inspector on the device). So on phones the panel scrolls itself: drag to scroll, flick to glide.
// A touch that barely moves is still a tap, so buttons and terminal files keep working.
const TAP_SLOP = 6; // px a finger can wander and still count as a tap
const FRICTION = 0.95; // momentum kept each frame after a flick

export function touchScroll(el) {
  let startY = 0,
    startTop = 0,
    lastY = 0,
    lastT = 0,
    velocity = 0,
    dragging = false,
    raf = 0;
  el.addEventListener(
    'touchstart',
    e => {
      if (e.touches.length !== 1) return;
      cancelAnimationFrame(raf);
      startY = lastY = e.touches[0].clientY;
      startTop = el.scrollTop;
      lastT = e.timeStamp;
      velocity = 0;
      dragging = false;
    },
    { passive: true },
  );
  el.addEventListener(
    'touchmove',
    e => {
      if (e.touches.length !== 1) return;
      const y = e.touches[0].clientY;
      if (!dragging && Math.abs(y - startY) < TAP_SLOP) return;
      dragging = true;
      e.preventDefault(); // this gesture is ours; also stops a browser that does scroll natively from scrolling twice
      el.scrollTop = startTop - (y - startY);
      velocity = (lastY - y) / Math.max(1, e.timeStamp - lastT); // px per ms
      lastY = y;
      lastT = e.timeStamp;
    },
    { passive: false },
  );
  el.addEventListener(
    'touchend',
    () => {
      if (!dragging) return;
      let v = velocity * 16; // px per frame
      const glide = () => {
        if (Math.abs(v) < 0.3) return;
        el.scrollTop += v;
        v *= FRICTION;
        raf = requestAnimationFrame(glide);
      };
      raf = requestAnimationFrame(glide);
    },
    { passive: true },
  );
}
