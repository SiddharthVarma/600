// iPhone Safari wouldn't turn finger swipes into scrolling on the game's scroll areas, even though scrolling them from code
// worked (found with Safari Web Inspector on the device). On phones these scroll themselves instead: drag to scroll,
// flick to glide. A touch that barely moves is still a tap, and `skip` lets a page leave some touches alone (game boards).
const TAP_SLOP = 6; // px a finger can wander and still count as a tap
const FRICTION = 0.95; // momentum kept each frame after a flick

export function touchScroll(target, scroller = target, skip = () => false) {
  let startY = 0,
    startTop = 0,
    lastY = 0,
    lastT = 0,
    velocity = 0,
    active = false,
    dragging = false,
    raf = 0;
  const start = e => {
    active = e.touches.length === 1 && !skip(e.target);
    if (!active) return;
    cancelAnimationFrame(raf);
    startY = lastY = e.touches[0].clientY;
    startTop = scroller.scrollTop;
    lastT = e.timeStamp;
    velocity = 0;
    dragging = false;
  };
  const move = e => {
    if (!active || e.touches.length !== 1) return;
    const y = e.touches[0].clientY;
    if (!dragging && Math.abs(y - startY) < TAP_SLOP) return;
    dragging = true;
    e.preventDefault(); // this gesture is ours; also stops a browser that does scroll natively from scrolling twice
    scroller.scrollTop = startTop - (y - startY);
    velocity = (lastY - y) / Math.max(1, e.timeStamp - lastT); // px per ms
    lastY = y;
    lastT = e.timeStamp;
  };
  const end = () => {
    if (!active || !dragging) return;
    let v = velocity * 16; // px per frame
    const glide = () => {
      if (Math.abs(v) < 0.3) return;
      scroller.scrollTop += v;
      v *= FRICTION;
      raf = requestAnimationFrame(glide);
    };
    raf = requestAnimationFrame(glide);
  };
  target.addEventListener('touchstart', start, { passive: true });
  target.addEventListener('touchmove', move, { passive: false });
  target.addEventListener('touchend', end, { passive: true });
  return () => {
    target.removeEventListener('touchstart', start);
    target.removeEventListener('touchmove', move);
    target.removeEventListener('touchend', end);
    cancelAnimationFrame(raf);
  };
}
