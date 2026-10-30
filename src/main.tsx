import { createRoot } from 'react-dom/client'

// Scaffold only. The game is built from DESIGN.md using public/assets.
function App() {
  return (
    <div style={{ background: '#1a1230', minHeight: '100vh', display: 'grid', placeItems: 'center' }}>
      <img src="./assets/keyart/title_keyart.webp" alt="Squeek Deep" style={{ maxWidth: '90vw', imageRendering: 'pixelated' }} />
    </div>
  )
}

createRoot(document.getElementById('root')!).render(<App />)
