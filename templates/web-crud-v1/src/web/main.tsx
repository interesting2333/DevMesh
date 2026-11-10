import React from 'react';
import { createRoot } from 'react-dom/client';
import { Board } from './Board.js';
import './style.css';
createRoot(document.getElementById('root')!).render(<React.StrictMode><Board /></React.StrictMode>);
