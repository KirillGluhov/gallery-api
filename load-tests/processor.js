// Файл: processor.js

// Экспортируем функцию, чтобы она была доступна в YAML-сценарии
module.exports = {
  pickRandomImage: pickRandomImage,
};

// Функция для выбора случайного изображения из списка
function pickRandomImage(requestParams, context, ee, next) {
  // `context.vars` хранит переменные виртуального пользователя.
  // Мы ожидаем, что переменная `images` была сохранена на предыдущем шаге
  // с помощью опции `capture`.
  const images = context.vars.images;

  if (images && images.length > 0) {
    // Выбираем случайный элемент из массива
    const randomImage = images[Math.floor(Math.random() * images.length)];
    // Сохраняем `id` этого элемента в переменные,
    // чтобы использовать в следующих запросах (`/image/{{ imageId }}/view`)
    context.vars.imageId = randomImage.id;
  }

  // `next()` передает управление следующему действию в сценарии
  return next();
}