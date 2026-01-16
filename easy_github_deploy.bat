@echo off
echo ===================================================
echo   TecHub Agent - Sincronizacao Github Simplificada
echo ===================================================
echo.

:: Check for Git
git --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERRO] O GIT NAO ESTA INSTALADO!
    echo Por favor, instale o Git for Windows: https://git-scm.com/download/win
    echo Depois de instalar, feche e abra o terminal novamente.
    echo.
    pause
    exit /b
)

echo 1. Adicionando todos os arquivos (incluindo .env para EasyPanel)...
git add .
git add .env -f

echo.
echo 2. Salvando alteracoes (Commit)...
git commit -m "feat: config plug-and-play easypanel"

echo.
echo 3. Enviando para o GitHub...
echo Digite o link do seu repositorio (ex: https://github.com/seu-usuario/techub-agent.git):
set /p REPO_URL=

git remote remove origin 2>nul
git remote add origin %REPO_URL%
git push -u origin main --force

echo.
echo ===================================================
echo   PRONTO! Agora va no EasyPanel.
echo ===================================================
pause
