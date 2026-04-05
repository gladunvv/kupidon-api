# 📋 Единый формат ответов API

## 🎯 Структура ответа

```typescript
interface ApiResponse<T = any> {
  success: boolean;           // Статус операции
  message: string;           // Человекочитаемое сообщение
  data?: T;                  // Данные ответа (опционально)
  error?: {                  // Информация об ошибке (опционально)
    code: string;            // Код ошибки для программной обработки
    details?: any;           // Дополнительные детали ошибки
  };
  meta?: {                   // Метаинформация (опционально)
    timestamp: string;       // Время ответа
    requestId?: string;      // ID запроса для трейсинга
    pagination?: {           // Пагинация для списков
      page: number;
      limit: number;
      total: number;
      hasNext: boolean;
    };
  };
}
```

## ✅ Примеры успешных ответов

### Простой успешный ответ
```json
{
  "success": true,
  "message": "Operation completed successfully",
  "data": {
    "id": "123",
    "name": "John Doe"
  },
  "meta": {
    "timestamp": "2024-01-15T10:30:00Z",
    "requestId": "uuid-123"
  }
}
```

### Ответ с пагинацией
```json
{
  "success": true,
  "message": "Users retrieved successfully",
  "data": [
    {"id": "1", "name": "User 1"},
    {"id": "2", "name": "User 2"}
  ],
  "meta": {
    "timestamp": "2024-01-15T10:30:00Z",
    "requestId": "uuid-123",
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 25,
      "hasNext": true
    }
  }
}
```

### Ответ только с сообщением
```json
{
  "success": true,
  "message": "OTP sent successfully",
  "meta": {
    "timestamp": "2024-01-15T10:30:00Z",
    "requestId": "uuid-123"
  }
}
```

## ❌ Примеры ответов с ошибками

### Ошибка валидации
```json
{
  "success": false,
  "message": "Validation failed",
  "error": {
    "code": "VALIDATION_ERROR",
    "details": [
      "Phone number is required",
      "Invalid email format"
    ]
  },
  "meta": {
    "timestamp": "2024-01-15T10:30:00Z",
    "requestId": "uuid-123"
  }
}
```

### Ошибка авторизации
```json
{
  "success": false,
  "message": "Invalid OTP code",
  "error": {
    "code": "INVALID_OTP"
  },
  "meta": {
    "timestamp": "2024-01-15T10:30:00Z",
    "requestId": "uuid-123"
  }
}
```

## 🛠 Использование в контроллерах

### Импорт
```typescript
import { ResponseHelper, ERROR_CODES } from '../core/utils/response.helper';
import { ApiResponse } from '../core/types/api-response.interface';
```

### Успешные ответы
```typescript
// Простой успешный ответ
return ResponseHelper.success(userData, 'User created successfully');

// Ответ с пагинацией
return ResponseHelper.successWithPagination(
  users,
  { page: 1, limit: 10, total: 100, hasNext: true },
  'Users retrieved successfully'
);

// Только сообщение
return ResponseHelper.message('Operation completed');
```

### Ошибки
```typescript
// Ручное создание ошибки
return ResponseHelper.error(
  'User not found',
  ERROR_CODES.USER_NOT_FOUND
);

// Выброс исключения (автоматически обрабатывается фильтром)
throw new UnauthorizedException('Invalid credentials');
```

## 🔧 Коды ошибок

### Авторизация
- `INVALID_CREDENTIALS` - Неверные учетные данные
- `UNAUTHORIZED` - Не авторизован
- `FORBIDDEN` - Доступ запрещен
- `TOKEN_EXPIRED` - Токен истек
- `INVALID_TOKEN` - Неверный токен

### OTP
- `INVALID_OTP` - Неверный OTP код
- `OTP_EXPIRED` - OTP код истек
- `OTP_ALREADY_USED` - OTP код уже использован
- `TOO_MANY_OTP_REQUESTS` - Слишком много запросов OTP

### Пользователи
- `USER_NOT_FOUND` - Пользователь не найден
- `USER_ALREADY_EXISTS` - Пользователь уже существует

### Валидация
- `VALIDATION_ERROR` - Ошибка валидации
- `INVALID_PHONE_FORMAT` - Неверный формат телефона

### Общие
- `INTERNAL_SERVER_ERROR` - Внутренняя ошибка сервера
- `BAD_REQUEST` - Неверный запрос
- `NOT_FOUND` - Не найдено

## 🚀 Автоматическая обработка

Система автоматически:
- ✅ Добавляет `timestamp` и `requestId` ко всем ответам
- ✅ Оборачивает обычные данные в формат `ApiResponse`
- ✅ Обрабатывает исключения и форматирует их в единый вид
- ✅ Логирует серверные ошибки для отладки

## 📱 Обработка на клиенте

```typescript
// TypeScript клиент
interface ApiResponse<T = any> {
  success: boolean;
  message: string;
  data?: T;
  error?: {
    code: string;
    details?: any;
  };
  meta?: {
    timestamp: string;
    requestId?: string;
  };
}

// Обработка ответа
const handleResponse = async (response: Response) => {
  const result: ApiResponse = await response.json();
  
  if (result.success) {
    console.log('Success:', result.message);
    return result.data;
  } else {
    console.error('Error:', result.error?.code, result.message);
    throw new Error(result.message);
  }
};
```