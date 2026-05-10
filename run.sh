#!/bin/bash
cd "$(dirname "$0")"
echo "BTC Dashboard 起動中..."
echo "PC:      http://localhost:8080"
echo "スマホ:  http://192.168.1.20:8080"
.venv/bin/streamlit run app.py --server.port 8080 --server.headless true --server.address 0.0.0.0
