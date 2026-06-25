# Деплой ZCodeProject на Yandex Cloud

Полная инструкция: от создания виртуалки до рабочего приложения на домене.
Рассчитана на человека без опыта деплоя — каждый шаг расписан подробно.

---

## Что понадобится

- Аккаунт на [Yandex Cloud](https://console.cloud.yandex.ru/)
- (~15 минут времени)
- (Опционально) доменное имя, если хочешь красивый адрес вместо IP

---

## Шаг 1. Создать виртуальную машину (Compute Cloud)

1. Зайди в [консоль Yandex Cloud](https://console.cloud.yandex.ru/)
2.左侧 меню → **Compute Cloud** → кнопка **Создать ВМ**
3. Настрой:
   - **Имя:** `zcode` (любое)
   - **Операционная система:** Ubuntu 22.04 LTS
   - **Диск:** 10 ГБ SSD (хватит с запасом)
   - **Вычислительные ресурсы:** 2 vCPU, 2 ГБ RAM (конфигурация `standard-v2` / `2 vCPU, 2 RAM`) — ~800 ₽/мес
   - **Зона доступности:** любая (`ru-central1-a`)
4. В блоке **Доступ**:
   - **Логин:** `ubuntu` (стандартный)
   - **SSH-ключ:** вставь свой публичный ключ (см. ниже, как создать)
5. Нажми **Создать ВМ**. Дождись статуса `RUNNING`.

### Как создать SSH-ключ (если нет)

На **своём** компьютере в терминале:
```bash
ssh-keygen -t ed25519 -C "poker"
# Нажимай Enter на все вопросы
```
Затем выведи публичный ключ и скопируй его:
```bash
cat ~/.ssh/id_ed25519.pub
```
Именно это содержимое вставляешь в поле SSH-ключа при создании ВМ.

---

## Шаг 2. Открыть порт 80 (HTTP)

По умолчанию ВМ закрыта фаерволом. Нужно разрешить входящий HTTP-трафик.

1. В консоли Yandex → **Virtual Private Cloud (VPC)** → **Группы безопасности**
2. Найди группу безопасности, привязанную к твоей ВМ (обычно `default-sg` или созданная автоматически)
3. **Добавить правило**:
   - **Направление:** Входящее
   - **Порт:** 80 (или диапазон `80`)
   - **Протокол:** TCP
   - **Источник:** `0.0.0.0/0` (любой)
4. Повтори для порта **443** (понадобится для HTTPS позже)
5. Повтори для порта **22** (SSH) — он обычно уже открыт, но проверь

---

## Шаг 3. Зайти на виртуалку по SSH

В консоли Yandex найди **публичный IP** твоей ВМ (вкладка «Виртуальные машины» → колонка «Публичный IP-address»). Будет что-то вроде `158.160.x.x`.

На **своём** компьютере:
```bash
ssh ubuntu@158.160.x.x
```
(замени на свой IP). Ответь `yes` на вопрос о fingerprint.

---

## Шаг 4. Установить Docker на ВМ

В SSH-сессии на ВМ, по очереди:

```bash
# Обновить пакеты
sudo apt update && sudo apt upgrade -y

# Установить Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Добавить своего пользователя в группу docker (чтобы без sudo)
sudo usermod -aG docker $USER

# Применить изменение группы (без перелогина)
newgrp docker

# Проверить, что Docker работает
docker --version
```
Должен вывести `Docker version 2x.x.x`.

---

## Шаг 5. Скачать код проекта на ВМ

Вариант A — если код в Git (GitHub / GitLab):
```bash
git clone https://github.com/твой-пользователь/ZCodeProject.git
cd ZCodeProject
```

Вариант B — если пока не в Git, скопировать с компьютера:
**На своём компьютере** (не на ВМ!), из папки проекта:
```bash
# Упаковать проект (без node_modules)
tar --exclude='node_modules' --exclude='dist' --exclude='*.db' -czf zcode.tar.gz -C C:\Users\ostro\ZCodeProject .

# Передать на ВМ (замени IP)
scp zcode.tar.gz ubuntu@158.160.x.x:~/
```
**На ВМ:**
```bash
mkdir ~/ZCodeProject && cd ~/ZCodeProject
tar -xzf ~/zcode.tar.gz
rm ~/zcode.tar.gz
cd ~/ZCodeProject
```

---

## Шаг 6. Настроить пароль и запустить

В папке проекта на ВМ (`~/ZCodeProject`):

```bash
# Задать пароль админки (ВАЖНО — сменить!)
# Создать файл .env с одной строкой:
echo "ADMIN_PASSWORD=твой-секретный-пароль" > .env

# Запустить! Сборка + старт займут ~3-5 минут.
docker compose up -d --build
```

Команда соберёт Docker-образ (клиент + сервер + БД с тестовым турниром) и запустит контейнер в фоне.

Проверить, что работает:
```bash
docker compose logs -f
```
Должно появиться `♠ Poker Club server listening on http://localhost:4000`. Нажми `Ctrl+C` чтобы выйти из логов (сервер продолжит работать).

---

## Шаг 7. Открыть в браузере 🎉

В браузере открой:
```
http://158.160.x.x
```
(замени на публичный IP своей ВМ)

- **Экран зала:** `http://158.160.x.x/display`
- **Админка:** `http://158.160.x.x/admin` (пароль — тот, что задал в `.env`)

Всё! Приложение работает.

---

## (Опционально) Шаг 8. Привязать домен + HTTPS

Если хочешь красивый адрес `poker.myclub.ru` вместо IP:

1. У регистратора домена добавь **A-запись**:
   - `poker` → `158.160.x.x` (IP твоей ВМ)
   - Подожди 5-30 минут, пока DNS обновится

2. На ВМ установи Caddy (автоматический HTTPS):
```bash
# Установить Caddy
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update && sudo apt install caddy -y

# Настроить reverse proxy на порт 4000
echo 'poker.myclub.ru {
    reverse_proxy localhost:4000
}' | sudo tee /etc/caddy/Caddyfile

sudo systemctl restart caddy
```

Caddy автоматически получит бесплатный SSL-сертификат Let's Encrypt. Через минуту сайт откроется по `https://poker.myclub.ru`.

---

## Управление сервером

Полезные команды (выполнять в папке `~/ZCodeProject` на ВМ):

```bash
# Посмотреть логи
docker compose logs -f

# Перезапустить
docker compose restart

# Остановить
docker compose down

# Обновить код (после git pull) и пересобрать
git pull && docker compose up -d --build

# Изменить пароль админки
nano .env            # поменять ADMIN_PASSWORD
docker compose up -d # перезапустится с новым паролем
```

---

## Резервное копирование БД

База данных — это файл `dev.db` внутри Docker volume. Для бэкапа:

```bash
# Скопировать БД из контейнера на ВМ
docker cp poker-club:/app/server/prisma/dev.db ~/backup-$(date +%Y%m%d).db

# Скачать на свой компьютер (выполнять на СВОЁМ компьютере)
scp ubuntu@158.160.x.x:~/backup-*.db ./
```

---

## Сколько стоит

- **VM 2 vCPU / 2 ГБ RAM:** ~800 ₽/мес
- **Диск 10 ГБ:** ~20 ₽/мес
- **Публичный IP:** ~150 ₽/мес
- **Итого:** ~970 ₽/мес

Можно дешевле: VM 2 vCPU / 1 ГБ RAM (`~500 ₽/мес`), если 1 ГБ хватит (для одного клуба — да).

---

## Если что-то не работает

| Симптом | Решение |
|---------|---------|
| Не открывается по IP | Проверь группу безопасности (порт 80 открыт?), `docker compose logs` |
| `connection refused` | Контейнер не запустился — смотри `docker compose logs` |
| 502 Bad Gateway | Сервер внутри контейнера упал — `docker compose logs` |
| Не заходит в админку | Проверь `.env` — `ADMIN_PASSWORD` задан верно |
| `docker: command not found` | Не вышло из SSH после установки Docker — перезайди или `newgrp docker` |
