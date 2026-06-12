@echo off
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0index-docs.ps1" %*
