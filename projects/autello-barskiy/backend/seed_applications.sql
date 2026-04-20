-- 10 тестовых заявок для проверки алгоритма ранжирования «температуры» лида.
--
-- Состав:
--   * 4 «горячих» — большой бюджет, короткий срок, руководитель крупной компании,
--     либо коллекционер с дорогим авто. Критерии НЕ одинаковые между ними —
--     чтобы было видно, что алгоритм ловит разные сигналы.
--   * 3 «средних»  — нормальный бюджет, средний срок.
--   * 3 «холодных» — минимальный бюджет, размытые сроки, частное лицо.
--
-- Запуск:
--   docker exec -i autello-db psql -U autello -d autello_db < backend/seed_applications.sql

BEGIN;

-- ===== 4 ГОРЯЧИХ =====

-- 1. Руководитель крупного автосалона — парк машин, срочно, большой бюджет.
INSERT INTO applications
  (last_name, first_name, middle_name, business_niche, company_size, task_scope, role,
   budget, service, deadline, preferred_contact, contact_time, comment)
VALUES
  ('Волков', 'Артур', 'Михайлович', 'Автосалон премиум-класса', '150 сотрудников',
   'Парк из 12 машин для выставки', 'Руководитель',
   '1.5m-3m', 'Детейлинг-пакет VIP (подготовка к выставке)',
   'Срочно, 1 неделя', 'Телефон', 'Будни с 10:00',
   'Готовим весь салон к международному автосалону. Бюджет согласован.');

-- 2. Частный коллекционер — один автомобиль, но очень дорогой.
INSERT INTO applications
  (last_name, first_name, middle_name, business_niche, company_size, task_scope, role,
   budget, service, deadline, preferred_contact, contact_time, comment)
VALUES
  ('Белозёрский', 'Игорь', 'Константинович', 'Частный коллекционер', 'VIP',
   'Реставрация Rolls-Royce 1965 г.', 'Частное лицо',
   '2m+', 'Реставрация антикварного деревянного салона',
   '2 недели', 'WhatsApp', 'Любое',
   'Автомобиль в коллекции 40 лет. Деревянный салон полностью убит.');

-- 3. Владелец сети автопарков — оптовый заказ, срочно.
INSERT INTO applications
  (last_name, first_name, middle_name, business_niche, company_size, task_scope, role,
   budget, service, deadline, preferred_contact, contact_time, comment)
VALUES
  ('Громов', 'Денис', 'Петрович', 'Автопарк корпоративный', '500+ сотрудников',
   'Флот 25 машин, бронирование', 'Руководитель',
   '600k-1m', 'Бронирование кузова плёнкой PPF (полный оклей)',
   'Срочно, ASAP', 'Email', 'Будни после 18:00',
   'Корпоративный парк. Бронировать все машины гендиректоров.');

-- 4. Топ-менеджер, средний бюджет, но горящий срок и премиум-ниша.
INSERT INTO applications
  (last_name, first_name, middle_name, business_niche, company_size, task_scope, role,
   budget, service, deadline, preferred_contact, contact_time, comment)
VALUES
  ('Королёва', 'Анастасия', 'Витальевна', 'Luxury-brand маркетинг', '80 сотрудников',
   'Съёмки Bentley для рекламы', 'Руководитель',
   '400k-800k', 'Покраска по итальянской технологии (3 слоя + лак)',
   '3 дня', 'Telegram', 'Круглосуточно',
   'Горящие съёмки, нужен идеальный вид ЛКП. Заплатим за срочность.');

-- ===== 3 СРЕДНИХ =====

-- 5. Средняя компания, нормальный бюджет, месячный срок.
INSERT INTO applications
  (last_name, first_name, middle_name, business_niche, company_size, task_scope, role,
   budget, service, deadline, preferred_contact, contact_time, comment)
VALUES
  ('Смирнов', 'Павел', 'Андреевич', 'Ресторан', '40 сотрудников',
   '1 авто руководителя', 'Сотрудник',
   '150k-200k', 'Керамическое покрытие Premium 9H (5 лет гарантии)',
   '1 месяц', 'Телефон', 'Будни после 18:00',
   'Обновить покрытие авто генерального.');

-- 6. Частник, но нормальная сумма.
INSERT INTO applications
  (last_name, first_name, middle_name, business_niche, company_size, task_scope, role,
   budget, service, deadline, preferred_contact, contact_time, comment)
VALUES
  ('Иванова', 'Мария', 'Сергеевна', NULL, NULL,
   '1 авто', 'Частное лицо',
   '100k-150k', 'Детейлинг-пакет VIP (подготовка к выставке)',
   '3 недели', 'WhatsApp', 'Выходные',
   'Готовлю машину к продаже.');

-- 7. Небольшой бизнес, адекватные сроки.
INSERT INTO applications
  (last_name, first_name, middle_name, business_niche, company_size, task_scope, role,
   budget, service, deadline, preferred_contact, contact_time, comment)
VALUES
  ('Орлов', 'Никита', 'Дмитриевич', 'Таксопарк премиум', '15 сотрудников',
   '3 авто', 'Руководитель',
   '90k-130k', 'Полировка кузова Зеркало (3 стадии реставрации ЛКП)',
   '1 месяц', 'Email', 'Будни с 10:00',
   'Обновляем парк, интересна полировка и керамика.');

-- ===== 3 ХОЛОДНЫХ =====

-- 8. Частное лицо, минимальный бюджет, размытый срок.
INSERT INTO applications
  (last_name, first_name, middle_name, business_niche, company_size, task_scope, role,
   budget, service, deadline, preferred_contact, contact_time, comment)
VALUES
  ('Кузнецов', 'Олег', 'Владимирович', NULL, NULL,
   '1 авто', 'Частное лицо',
   '30k-50k', 'Химчистка кожи Nappa с восстановлением',
   'Не срочно', 'Телефон', 'Любое',
   'Посмотреть сначала цены, может в другое место поеду.');

-- 9. Частник, без компании, без конкретики.
INSERT INTO applications
  (last_name, first_name, middle_name, business_niche, company_size, task_scope, role,
   budget, service, deadline, preferred_contact, contact_time, comment)
VALUES
  ('Петрова', 'Елена', NULL, NULL, NULL,
   NULL, 'Частное лицо',
   '40k-60k', 'Тонирование плёнкой 3M/LLumar',
   'Когда-нибудь', NULL, NULL,
   'Думаю тонироваться. Пока просто интересуюсь.');

-- 10. Самозанятый, минимальный бюджет, без срочности.
INSERT INTO applications
  (last_name, first_name, middle_name, business_niche, company_size, task_scope, role,
   budget, service, deadline, preferred_contact, contact_time, comment)
VALUES
  ('Сидоров', 'Михаил', 'Иванович', 'Самозанятый', '1',
   '1 авто', 'Частное лицо',
   '20k-40k', 'Химчистка кожи Nappa с восстановлением',
   'В течение пары месяцев', 'WhatsApp', 'Выходные',
   'Посмотрим по деньгам.');

COMMIT;
