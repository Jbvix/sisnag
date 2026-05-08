RELATÓRIO DE ESTRUTURA ATUALIZADA DE DIRETÓRIOS – SISNAG

Data/Hora: Sexta-feira, 08 de Maio de 2026 – 14:50 (UTC-3)

Versão do Projeto: 0.7.0

Autor: Jossian Costa de Brito – Engenheiro de Software Sênior / Chefe de Máquinas

Capitão,

Conforme sua ordem, apresento a estrutura completa e atualizada de diretórios e arquivos do SISNAG (versão 0.7.0), já refletindo todas as decisões implementadas até o momento:



Remoção total do AISSTREAM

Grok Vision como única fonte de alvos (Marine Traffic)

Grok Vision para previsão Windy + integração com API Sealagom

XTE + Cone de Segurança

Camadas sincronizadas (OpenSeaMap + Windy + Marine Traffic)

Captura automática de tela a cada 5 minutos







sisnag/

├── .github/

│   └── workflows/

│       └── deploy.yml                          # CI/CD Netlify + Railway

├── backend/                                    # ← Railway (Backend dedicado)

│   ├── src/

│   │   ├── controllers/

│   │   │   └── screenshot.controller.js        # Grok Vision (Marine Traffic + Windy + Sealagom)

│   │   ├── services/

│   │   │   ├── geofence.service.js             # Geofences + Turf.js

│   │   │   └── colregs.service.js              # Alertas COLREGs

│   │   └── sockets/

│   │       └── sensorSocketHandler.js          # Sensores do celular

│   ├── package.json

│   └── railway.json

├── frontend/                                   # ← Netlify (PWA)

│   ├── public/

│   │   ├── js/

│   │   │   ├── main.js                         # Inicialização principal

│   │   │   ├── layerManager.js                 # Sobreposição sincronizada de camadas

│   │   │   ├── map.js                          # OpenSeaMap + Windy

│   │   │   ├── marine-traffic-monitor.js       # Captura automática Marine Traffic (5 min)

│   │   │   ├── windy-forecast-monitor.js       # Captura Windy + Grok Vision + Sealagom

│   │   │   ├── sensors.js                      # GPS, bússola, roll/pitch/yaw

│   │   │   ├── camera-upload.js                # Captura de tela (reutilizado)

│   │   │   ├── chat.js                         # Chat IA

│   │   │   └── dashboard.js                    # Dashboard de performance

│   │   ├── manifest.json                       # PWA

│   │   └── service-worker.js                   # Offline-first + cache

│   └── netlify.toml

├── docs/

│   └── SISNAG-Documentacao-Completa.md         # Documentação oficial (PDF-ready)

├── .env.example

├── .gitignore

├── LICENSE

├── README.md                                   # Atualizado com todas as funcionalidades

├── package.json                                # Raiz (fallback)

└── server.js                                   # Entry point Express + Socket.io







\- Funcionalidade: Grok Vision (Marine Traffic)  

&#x20; - Arquivo Principal: marine-traffic-monitor.js + controller  

&#x20; - Localização: frontend + backend  



\- Funcionalidade: Grok Vision (Windy + Sealagom)  

&#x20; - Arquivo Principal: windy-forecast-monitor.js + controller  

&#x20; - Localização: frontend + backend  



\- Funcionalidade: Camadas sincronizadas  

&#x20; - Arquivo Principal: layerManager.js + map.js  

&#x20; - Localização: frontend/public/js  



\- Funcionalidade: XTE + Cone de Segurança  

&#x20; - Arquivo Principal: layerManager.js + colregs.service.js  

&#x20; - Localização: frontend + backend  



\- Funcionalidade: Sensores do celular  

&#x20; - Arquivo Principal: sensors.js + sensorSocketHandler.js  

&#x20; - Localização: frontend + backend  



\- Funcionalidade: Dashboard de performance  

&#x20; - Arquivo Principal: dashboard.js  

&#x20; - Localização: frontend/public/js  



\- Funcionalidade: PWA + Offline  

&#x20; - Arquivo Principal: service-worker.js + manifest.json  

&#x20; - Localização: frontend/public

