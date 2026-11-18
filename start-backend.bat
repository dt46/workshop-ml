@echo off
echo =============================================
echo  Workshop ML - Backend
echo =============================================
cd /d "%~dp0backend"
if not exist ".env" (
    copy .env.example .env
    echo [INFO] File .env dibuat dari .env.example
    echo [INFO] Edit .env jika perlu mengubah konfigurasi
)
echo [INFO] Menginstall dependencies...
pip install -r requirements.txt
echo.
echo [INFO] Menjalankan backend di http://localhost:8000
echo [INFO] Tekan Ctrl+C untuk berhenti
echo.
python -m uvicorn main:app --reload
pause
