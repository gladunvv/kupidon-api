#!/bin/bash

echo "🌱 Тестирование Seed Service"
echo "=========================="

echo ""
echo "1. Запуск полного заполнения..."
npm run seed

echo ""
echo "2. Получение статистики через API..."
curl -s http://localhost:3000/seed/stats | jq '.'

echo ""
echo "3. Получение списка доступных моделей..."
curl -s http://localhost:3000/seed/models | jq '.'

echo ""
echo "4. Заполнение только интересов (без очистки)..."
curl -s -X POST "http://localhost:3000/seed/quick?clear=false&models=interests&verbose=true" | jq '.'

echo ""
echo "✅ Тестирование завершено!"
