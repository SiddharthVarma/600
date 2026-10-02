import { createRoot } from 'react-dom/client';
import { touchScroll } from '../shared/touchscroll.js';
import { App } from './App.jsx';
import './styles.css';

createRoot(document.getElementById('root')).render(<App />);

// On phones a game taller than the screen scrolls by finger. Drags that start on a game board (touch-action: none) stay
// with the game.
if (matchMedia('(max-width: 600px) and (pointer: coarse)').matches) {
  touchScroll(document, document.scrollingElement, el => el instanceof Element && el.closest('[style*="touch-action: none"]'));
}
