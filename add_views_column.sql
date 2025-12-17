-- Добавить поле просмотров к существующей таблице, если оно не существует
ALTER TABLE db.data 
ADD COLUMN IF NOT EXISTS views INT DEFAULT 0 NOT NULL;