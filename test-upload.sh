#!/bin/bash

# Тестирование API загрузки фотографий
# Убедитесь, что сервер запущен на localhost:8000

BASE_URL="http://localhost:8000"
TOKEN="your-jwt-token-here"

echo "🚀 Тестирование API загрузки фотографий"
echo "======================================"

# Создаем тестовые изображения (если нет)
for i in {1..3}; do
    if [ ! -f "test-image-$i.jpg" ]; then
        echo "📸 Создаем тестовое изображение $i..."
        # Создаем простые изображения разных цветов
        case $i in
            1) color="red" ;;
            2) color="green" ;;
            3) color="blue" ;;
        esac
        convert -size 100x100 xc:$color test-image-$i.jpg 2>/dev/null || {
            echo "⚠️  ImageMagick не установлен. Создайте файлы test-image-1.jpg, test-image-2.jpg, test-image-3.jpg вручную"
            exit 1
        }
    fi
done

echo ""
echo "1️⃣ Загрузка множественных фотографий..."
curl -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -F "photos[]=@test-image-1.jpg" \
  -F "photos[]=@test-image-2.jpg" \
  -F "photos[]=@test-image-3.jpg" \
  "$BASE_URL/upload/photos" | jq '.'

echo ""
echo "2️⃣ Получение списка фотографий пользователя..."
PHOTOS_RESPONSE=$(curl -s -X GET \
  -H "Authorization: Bearer $TOKEN" \
  "$BASE_URL/upload/photos")
echo $PHOTOS_RESPONSE | jq '.'

# Извлекаем пути фотографий для дальнейших тестов
PHOTO1=$(echo $PHOTOS_RESPONSE | jq -r '.data.photos[0]')
PHOTO2=$(echo $PHOTOS_RESPONSE | jq -r '.data.photos[1]')
PHOTO3=$(echo $PHOTOS_RESPONSE | jq -r '.data.photos[2]')

echo ""
echo "3️⃣ Изменение порядка фотографий..."
curl -X PUT \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"photoOrder\":[\"$PHOTO3\",\"$PHOTO1\",\"$PHOTO2\"]}" \
  "$BASE_URL/upload/photos/reorder" | jq '.'

echo ""
echo "4️⃣ Удаление одной фотографии..."
curl -X DELETE \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"photoPath\":\"$PHOTO2\"}" \
  "$BASE_URL/upload/photo" | jq '.'

echo ""
echo "5️⃣ Проверка финального списка фотографий..."
curl -X GET \
  -H "Authorization: Bearer $TOKEN" \
  "$BASE_URL/upload/photos" | jq '.'

echo ""
echo "6️⃣ Получение профиля пользователя (проверяем поле photos)..."
curl -X GET \
  -H "Authorization: Bearer $TOKEN" \
  "$BASE_URL/users" | jq '.'

echo ""
echo "7️⃣ Тестирование ошибок - попытка загрузить более 5 фото..."
curl -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -F "photos[]=@test-image-1.jpg" \
  -F "photos[]=@test-image-2.jpg" \
  -F "photos[]=@test-image-3.jpg" \
  -F "photos[]=@test-image-1.jpg" \
  -F "photos[]=@test-image-2.jpg" \
  "$BASE_URL/upload/photos" | jq '.'

echo ""
echo "✅ Тестирование завершено!"
echo ""
echo "📝 Не забудьте:"
echo "   1. Заменить TOKEN на актуальный JWT токен"
echo "   2. Убедиться, что сервер запущен"
echo "   3. Установить jq для красивого вывода JSON (brew install jq)"
echo "   4. Установить ImageMagick для создания тестовых изображений (brew install imagemagick)"
echo ""
echo "🌐 Доступ к фотографиям:"
echo "   http://localhost:8000/uploads/photos/filename.jpg"