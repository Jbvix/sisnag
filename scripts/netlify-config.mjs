/**
 * Gera public/js/config.public.js a partir de variáveis do Netlify (build).
 * Defina SISNAG_API_ORIGIN = URL do backend Railway (sem barra no fim), ex. https://sisnag.up.railway.app
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const outFile = path.join(root, 'public', 'js', 'config.public.js');

const origin = (process.env.SISNAG_API_ORIGIN || '').trim().replace(/\/$/, '');
const body = `/* Gerado em build (Netlify). Não edite à mão em CI. */\nwindow.__SISNAG_API_ORIGIN__ = ${JSON.stringify(origin)};\n`;

fs.mkdirSync(path.dirname(outFile), { recursive: true });
fs.writeFileSync(outFile, body, 'utf8');
console.log('[netlify-config] wrote', path.relative(root, outFile), origin ? `origin=${origin}` : '(vazio = mesmo host)');
