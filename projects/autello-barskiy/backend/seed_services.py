"""Одноразовый скрипт: залить 10 услуг в admin_settings.

Запуск: docker exec autello-backend python seed_services.py
"""
from core.database import SessionLocal
from models.admin_setting import AdminSetting, AdminSettingCreate, create_admin_setting

SERVICES = [
    ("Полировка кузова Зеркало (3 стадии реставрации ЛКП)", "60k-150k"),
    ("Керамическое покрытие Premium 9H (5 лет гарантии)", "80k-200k"),
    ("Бронирование кузова плёнкой PPF (полный оклей)", "250k-600k"),
    ("Химчистка кожи Nappa с восстановлением", "30k-70k"),
    ("Реставрация антикварного деревянного салона", "500k-2m"),
    ("Покраска по итальянской технологии (3 слоя + лак)", "400k-1.5m"),
    ("Установка премиум-аудиосистемы Burmester/Bose", "300k-1.5m"),
    ("Тонирование плёнкой 3M/LLumar", "40k-90k"),
    ("Шумоизоляция Standartplast Premium (4 уровня)", "70k-180k"),
    ("Детейлинг-пакет VIP (подготовка к выставке)", "100k-300k"),
]


def main() -> None:
    db = SessionLocal()
    try:
        existing = db.query(AdminSetting).count()
        if existing:
            print(f"Already {existing} rows in admin_settings. Skipping.")
            return
        for services, budget_range in SERVICES:
            create_admin_setting(db, AdminSettingCreate(services=services, budget_range=budget_range))
            print(f"+ {services}  [{budget_range}]")
        print(f"Done. Inserted {len(SERVICES)} rows.")
    finally:
        db.close()


if __name__ == "__main__":
    main()
