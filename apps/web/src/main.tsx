import React from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import App from './App';
import { AuthProvider } from './auth';
import './theme.css';

const root = document.getElementById('root');
if (!root) throw new Error('Elemento #root mancante');

// HashRouter perché GitHub Pages serve file statici: un percorso come
// /CiaoCorea/corso/hangul non esiste su disco, quindi la rotta vive dopo `#`.
ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <HashRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </HashRouter>
  </React.StrictMode>,
);
