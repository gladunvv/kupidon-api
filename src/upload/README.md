# 📸 API для загрузки и управления фотографиями

## 🎯 Endpoints

### Загрузка фотографий (множественная)
```
POST /upload/photos
Content-Type: multipart/form-data
Authorization: Bearer <token>

Form data:
- photos[]: file[] (до 5 изображений за раз)
```

**Пример ответа:**
```json
{
  "success": true,
  "message": "3 photo(s) uploaded successfully",
  "data": {
    "photos": [
      "uploads/photos/photo-1642334567890-123456789.jpg",
      "uploads/photos/photo-1642334567891-123456790.jpg",
      "uploads/photos/photo-1642334567892-123456791.jpg"
    ]
  },
  "meta": {
    "timestamp": "2024-01-15T10:30:00Z",
    "requestId": "uuid-123"
  }
}
```

### Удаление фотографии
```
DELETE /upload/photo
Authorization: Bearer <token>
Content-Type: application/json

{
  "photoPath": "uploads/photos/photo-1642334567890-123456789.jpg"
}
```

**Пример ответа:**
```json
{
  "success": true,
  "message": "Photo deleted successfully",
  "meta": {
    "timestamp": "2024-01-15T10:30:00Z",
    "requestId": "uuid-123"
  }
}
```

### Изменение порядка фотографий
```
PUT /upload/photos/reorder
Authorization: Bearer <token>
Content-Type: application/json

{
  "photoOrder": [
    "uploads/photos/photo-1642334567892-123456791.jpg",
    "uploads/photos/photo-1642334567890-123456789.jpg",
    "uploads/photos/photo-1642334567891-123456790.jpg"
  ]
}
```

**Пример ответа:**
```json
{
  "success": true,
  "message": "Photos reordered successfully",
  "data": {
    "photos": [
      "uploads/photos/photo-1642334567892-123456791.jpg",
      "uploads/photos/photo-1642334567890-123456789.jpg",
      "uploads/photos/photo-1642334567891-123456790.jpg"
    ]
  },
  "meta": {
    "timestamp": "2024-01-15T10:30:00Z",
    "requestId": "uuid-123"
  }
}
```

### Получение фотографий пользователя
```
GET /upload/photos
Authorization: Bearer <token>
```

**Пример ответа:**
```json
{
  "success": true,
  "message": "Photos retrieved successfully",
  "data": {
    "photos": [
      "uploads/photos/photo-1642334567892-123456791.jpg",
      "uploads/photos/photo-1642334567890-123456789.jpg",
      "uploads/photos/photo-1642334567891-123456790.jpg"
    ]
  },
  "meta": {
    "timestamp": "2024-01-15T10:30:00Z",
    "requestId": "uuid-123"
  }
}
```

## 📋 Ограничения

- **Максимальный размер файла**: 5 МБ
- **Поддерживаемые форматы**: JPG, JPEG, PNG, GIF, WebP
- **Максимальное количество фотографий**: 5 штук на пользователя
- **Загрузка за раз**: до 5 файлов одновременно

## 🔧 Использование на клиенте

### JavaScript/TypeScript

```javascript
// Загрузка нескольких фотографий
const uploadPhotos = async (files) => {
  const formData = new FormData();
  
  // Добавляем все файлы в FormData
  Array.from(files).forEach(file => {
    formData.append('photos[]', file);
  });
  
  const response = await fetch('/upload/photos', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${localStorage.getItem('token')}`
    },
    body: formData
  });
  
  const result = await response.json();
  
  if (result.success) {
    console.log('Фото загружены:', result.data.photos);
    // Обновляем UI с новыми фотографиями
    updatePhotosUI(result.data.photos);
  } else {
    console.error('Ошибка:', result.message);
  }
};

// Удаление фотографии
const deletePhoto = async (photoPath) => {
  const response = await fetch('/upload/photo', {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${localStorage.getItem('token')}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ photoPath })
  });
  
  const result = await response.json();
  
  if (result.success) {
    console.log('Фото удалено');
    // Удаляем фото из UI
    removePhotoFromUI(photoPath);
  } else {
    console.error('Ошибка:', result.message);
  }
};

// Изменение порядка фотографий
const reorderPhotos = async (newOrder) => {
  const response = await fetch('/upload/photos/reorder', {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${localStorage.getItem('token')}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ photoOrder: newOrder })
  });
  
  const result = await response.json();
  
  if (result.success) {
    console.log('Порядок фото изменен');
    // Обновляем UI с новым порядком
    updatePhotosOrder(result.data.photos);
  } else {
    console.error('Ошибка:', result.message);
  }
};

// Получение фотографий пользователя
const getUserPhotos = async () => {
  const response = await fetch('/upload/photos', {
    headers: {
      'Authorization': `Bearer ${localStorage.getItem('token')}`
    }
  });
  
  const result = await response.json();
  
  if (result.success) {
    return result.data.photos;
  } else {
    console.error('Ошибка:', result.message);
    return [];
  }
};
```

### React компонент с drag-and-drop

```jsx
import React, { useState, useEffect } from 'react';
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd';

const PhotoManager = () => {
  const [photos, setPhotos] = useState([]);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    loadPhotos();
  }, []);

  const loadPhotos = async () => {
    const userPhotos = await getUserPhotos();
    setPhotos(userPhotos);
  };

  const handleFileUpload = async (event) => {
    const files = Array.from(event.target.files);
    
    // Проверяем лимит
    if (photos.length + files.length > 5) {
      alert(`Можно загрузить максимум 5 фото. У вас уже ${photos.length} фото.`);
      return;
    }

    setUploading(true);
    
    try {
      await uploadPhotos(files);
      await loadPhotos(); // Перезагружаем список фото
    } catch (error) {
      console.error('Ошибка загрузки:', error);
      alert('Ошибка загрузки фотографий');
    } finally {
      setUploading(false);
    }
  };

  const handleDeletePhoto = async (photoPath) => {
    if (confirm('Удалить эту фотографию?')) {
      await deletePhoto(photoPath);
      await loadPhotos();
    }
  };

  const handleDragEnd = async (result) => {
    if (!result.destination) return;

    const items = Array.from(photos);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);

    setPhotos(items);
    await reorderPhotos(items);
  };

  return (
    <div className="photo-manager">
      <div className="upload-section">
        <input
          type="file"
          multiple
          accept="image/*"
          onChange={handleFileUpload}
          disabled={uploading || photos.length >= 5}
        />
        {uploading && <div>Загрузка...</div>}
        <div>Фото: {photos.length}/5</div>
      </div>

      <DragDropContext onDragEnd={handleDragEnd}>
        <Droppable droppableId="photos">
          {(provided) => (
            <div
              {...provided.droppableProps}
              ref={provided.innerRef}
              className="photos-grid"
            >
              {photos.map((photo, index) => (
                <Draggable key={photo} draggableId={photo} index={index}>
                  {(provided) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.draggableProps}
                      {...provided.dragHandleProps}
                      className="photo-item"
                    >
                      <img 
                        src={`http://localhost:8000/${photo}`} 
                        alt={`Photo ${index + 1}`}
                        className="photo-image"
                      />
                      <button
                        className="delete-button"
                        onClick={() => handleDeletePhoto(photo)}
                      >
                        ✕
                      </button>
                      <div className="photo-order">{index + 1}</div>
                    </div>
                  )}
                </Draggable>
              ))}
              {provided.placeholder}
            </div>
          )}
        </Droppable>
      </DragDropContext>
    </div>
  );
};

export default PhotoManager;
```

### CSS для стилизации
```css
.photo-manager {
  max-width: 800px;
  margin: 0 auto;
}

.upload-section {
  margin-bottom: 20px;
  padding: 20px;
  border: 2px dashed #ccc;
  border-radius: 8px;
  text-align: center;
}

.photos-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 16px;
  padding: 20px 0;
}

.photo-item {
  position: relative;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
  cursor: grab;
}

.photo-item:active {
  cursor: grabbing;
}

.photo-image {
  width: 100%;
  height: 200px;
  object-fit: cover;
}

.delete-button {
  position: absolute;
  top: 8px;
  right: 8px;
  background: rgba(255, 0, 0, 0.8);
  color: white;
  border: none;
  border-radius: 50%;
  width: 24px;
  height: 24px;
  cursor: pointer;
  font-size: 12px;
}

.delete-button:hover {
  background: rgba(255, 0, 0, 1);
}

.photo-order {
  position: absolute;
  top: 8px;
  left: 8px;
  background: rgba(0, 0, 0, 0.7);
  color: white;
  border-radius: 50%;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: bold;
}
```

## 🔗 Доступ к файлам

Загруженные файлы доступны по URL:
```
http://localhost:8000/uploads/photos/photo-1642334567890-123456789.jpg
```

## ⚠️ Обработка ошибок

### Возможные ошибки:
- `BAD_REQUEST` - Файлы не предоставлены
- `USER_NOT_FOUND` - Пользователь не найден
- `MAX_PHOTOS_EXCEEDED` - Превышено максимальное количество фотографий (5)
- `NOT_FOUND` - Фотография не найдена
- `INVALID_PHOTOS` - Некоторые фото не принадлежат пользователю
- `PHOTO_COUNT_MISMATCH` - Несоответствие количества фото при изменении порядка
- `FILE_TOO_LARGE` - Файл слишком большой
- `TOO_MANY_FILES` - Слишком много файлов

### Пример обработки:
```javascript
const handleUploadError = (result) => {
  switch (result.error?.code) {
    case 'MAX_PHOTOS_EXCEEDED':
      alert('Можно загрузить максимум 5 фотографий. Удалите старые фото.');
      break;
    case 'FILE_TOO_LARGE':
      alert('Один из файлов слишком большой. Максимальный размер: 5 МБ');
      break;
    case 'TOO_MANY_FILES':
      alert('Слишком много файлов за раз. Максимум 5 файлов.');
      break;
    case 'INVALID_PHOTOS':
      alert('Ошибка при изменении порядка фотографий');
      break;
    default:
      alert(`Ошибка: ${result.message}`);
  }
};
```

## 🎯 Особенности

- **Множественная загрузка**: до 5 файлов за раз
- **Drag & Drop**: изменение порядка фотографий перетаскиванием
- **Крестики**: удаление отдельных фото
- **Порядок**: первая фотография - главная (отображается первой)
- **Валидация**: проверка лимитов и форматов файлов