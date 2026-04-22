import requests
from bs4 import BeautifulSoup
import re
import time
import random
from datetime import datetime, timezone, timedelta

def get_proxies_from_channel(channel_name, limit=30):
    """Парсит прокси-ссылки tg://proxy из публичного Telegram-канала"""
    try:
        url = f"https://t.me/s/{channel_name}?r={random.randint(1, 1000000)}&before={int(time.time())}"
        print(f"Парсинг {url}...")
        
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7',
            'Cache-Control': 'no-cache'
        }
        
        response = requests.get(url, headers=headers, timeout=15)
        response.encoding = 'utf-8'
        
        if response.status_code != 200:
            print(f"Ошибка HTTP: {response.status_code}")
            return []
        
        soup = BeautifulSoup(response.text, 'html.parser')
        
        proxy_links = set()
        
        # Способ 1: прямые ссылки tg://proxy
        for link in soup.find_all('a', href=True):
            href = link['href']
            if href.startswith('tg://proxy'):
                proxy_links.add(href)
                if len(proxy_links) >= limit:
                    break
        
        # Способ 2: если прямых ссылок мало, собираем из текста
        if len(proxy_links) < 5:
            messages = soup.find_all('div', class_='tgme_widget_message_text')
            for msg in messages:
                text = msg.get_text()
                server_match = re.search(r'Server:\s*(\S+)', text)
                port_match = re.search(r'Port:\s*(\d+)', text)
                secret_match = re.search(r'Secret:\s*(\S+)', text)
                if server_match and port_match and secret_match:
                    server = server_match.group(1)
                    port = port_match.group(1)
                    secret = secret_match.group(1)
                    proxy_link = f"tg://proxy?server={server}&port={port}&secret={secret}"
                    proxy_links.add(proxy_link)
                    if len(proxy_links) >= limit:
                        break
        
        print(f"Найдено {len(proxy_links)} прокси в канале @{channel_name}")
        return list(proxy_links)
        
    except Exception as e:
        print(f"Ошибка при парсинге @{channel_name}: {e}")
        return []

def get_moscow_time():
    """Возвращает текущее время по Москве"""
    utc_now = datetime.now(timezone.utc)
    moscow_tz = timezone(timedelta(hours=3))
    moscow_time = utc_now.astimezone(moscow_tz)
    return moscow_time

def main():
    channels = [
        'ProxyMTProto',
        'TProxyRU'
    ]
    
    all_proxies = []
    
    for channel in channels:
        print(f"\n🚀 Парсинг канала @{channel}...")
        proxies = get_proxies_from_channel(channel, limit=40)
        all_proxies.extend(proxies)
        time.sleep(3)
    
    # Убираем дубликаты
    unique_proxies = list(set(all_proxies))
    
    if unique_proxies:
        # Получаем текущее московское время
        moscow_time = get_moscow_time()
        time_str = moscow_time.strftime('%Y-%m-%d %H:%M:%S')
        
        # Формируем содержимое файла
        content = f"# Updated: {time_str} (MSK)\n"
        content += f"# Total proxies: {len(unique_proxies)}\n"
        content += f"# Sources: {', '.join(channels)}\n"
        content += "\n"  # пустая строка для разделения
        content += "\n".join(unique_proxies)
        
        # Сохраняем в файл proxies.txt
        with open('proxies.txt', 'w', encoding='utf-8') as f:
            f.write(content)
        
        print(f"\n✅ Сохранено {len(unique_proxies)} уникальных прокси в файл proxies.txt")
        print(f"   Время обновления: {time_str} (MSK)")
        print(f"   Источники: {', '.join(channels)}")
        
        # Выводим первые 5 для проверки
        print("\n📋 Примеры (первые 5):")
        for i, p in enumerate(unique_proxies[:5]):
            display = p[:80] + "..." if len(p) > 80 else p
            print(f"   {i+1}. {display}")
    else:
        print("\n❌ Прокси не найдены, файл не обновлён")

if __name__ == "__main__":
    main()
