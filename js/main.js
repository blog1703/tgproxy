(function() {
    const PROXY_LIST_URL = 'https://blog1703.github.io/tgonline/proxies.txt';
    const FETCH_TIMEOUT = 10000;
    const STORAGE_KEY = 'lastProxyIndex';
    const HISTORY_KEY = 'proxyHistory';
    const HISTORY_MAX_SIZE = 10;
    
    let state = {
        cachedProxies: [],
        currentIndex: -1,
        currentProxyUrl: '',
        isLoading: false,
        lastContentHash: '',
        debounceTimer: null,
        history: [],
        historyPosition: -1
    };
    
    const elements = {
        getProxyBtn: document.getElementById('getProxyBtn'),
        resultArea: document.getElementById('resultArea'),
        proxyLink: document.getElementById('proxyLink'),
        connectBtn: document.getElementById('connectBtn'),
        updateTime: document.getElementById('updateTime'),
        totalCount: document.getElementById('totalCount'),
        totalNum: document.getElementById('totalNum'),
        attemptNum: document.getElementById('attemptNum'),
        prevProxyBtn: document.getElementById('prevProxyBtn'),
        nextProxyBtn: document.getElementById('nextProxyBtn'),
        statusText: document.getElementById('statusText')
    };
    
    function simpleHash(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash |= 0;
        }
        return hash.toString();
    }
    
    function sanitizeText(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    async function fetchWithTimeout(url, timeout = FETCH_TIMEOUT) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);
        try {
            const response = await fetch(url, { signal: controller.signal });
            clearTimeout(timeoutId);
            return response;
        } catch (err) {
            clearTimeout(timeoutId);
            throw err;
        }
    }
    
    function formatTimeAgo(date) {
        const seconds = Math.floor((new Date() - date) / 1000);
        
        if (seconds < 60) return 'только что';
        const minutes = Math.floor(seconds / 60);
        if (minutes < 60) return `${minutes} ${getMinuteWord(minutes)} назад`;
        const hours = Math.floor(minutes / 60);
        if (hours < 24) return `${hours} ${getHourWord(hours)} назад`;
        const days = Math.floor(hours / 24);
        return `${days} ${getDayWord(days)} назад`;
    }
    
    function getMinuteWord(n) {
        if (n % 10 === 1 && n % 100 !== 11) return 'минуту';
        if ([2,3,4].includes(n % 10) && ![12,13,14].includes(n % 100)) return 'минуты';
        return 'минут';
    }
    
    function getHourWord(n) {
        if (n % 10 === 1 && n % 100 !== 11) return 'час';
        if ([2,3,4].includes(n % 10) && ![12,13,14].includes(n % 100)) return 'часа';
        return 'часов';
    }
    
    function getDayWord(n) {
        if (n % 10 === 1 && n % 100 !== 11) return 'день';
        if ([2,3,4].includes(n % 10) && ![12,13,14].includes(n % 100)) return 'дня';
        return 'дней';
    }
    
    function parseDateFromString(dateStr) {
        try {
            let cleaned = dateStr.split('(')[0].trim();
            let [datePart, timePart] = cleaned.split(' ');
            let [year, month, day] = datePart.split('-');
            let [hour, minute, second] = timePart.split(':');
            return new Date(year, month-1, day, hour, minute, second);
        } catch(e) {
            return null;
        }
    }
    
    function updateStatusIndicator() {
        if (elements.updateTime && elements.updateTime.textContent) {
            let updateText = elements.updateTime.textContent;
            let match = updateText.match(/Обновлено:\s*(.+)/);
            if (match && match[1]) {
                let date = parseDateFromString(match[1]);
                if (date && !isNaN(date.getTime())) {
                    let timeAgo = formatTimeAgo(date);
                    elements.statusText.textContent = `Список обновлён ${timeAgo}`;
                    return;
                }
            }
        }
        elements.statusText.textContent = 'Список обновлён';
    }
    
    function addToHistory(url) {
        if (!url) return;
        if (state.history.length > 0 && state.history[state.history.length - 1].url === url) return;
        
        state.history.push({ url: url, timestamp: new Date().toISOString() });
        if (state.history.length > HISTORY_MAX_SIZE) state.history.shift();
        
        try { localStorage.setItem(HISTORY_KEY, JSON.stringify(state.history)); } catch(e) {}
        state.historyPosition = state.history.length - 1;
    }
    
    function loadHistory() {
        try {
            const saved = localStorage.getItem(HISTORY_KEY);
            if (saved) {
                state.history = JSON.parse(saved);
                if (state.history.length > HISTORY_MAX_SIZE) state.history = state.history.slice(-HISTORY_MAX_SIZE);
                if (state.history.length > 0) state.historyPosition = state.history.length - 1;
            }
        } catch(e) {}
    }
    
    function goBackInHistory() {
        if (state.historyPosition > 0) {
            state.historyPosition--;
            const historyItem = state.history[state.historyPosition];
            if (historyItem) {
                state.currentProxyUrl = historyItem.url;
                updateProxyDisplay();
                updateNavigationButtons();
                return true;
            }
        }
        return false;
    }
    
    // Новая логика для стрелки вправо
    function goForwardInHistory() {
        // Если есть следующий в истории - переключаем
        if (state.historyPosition < state.history.length - 1) {
            state.historyPosition++;
            const historyItem = state.history[state.historyPosition];
            if (historyItem) {
                state.currentProxyUrl = historyItem.url;
                updateProxyDisplay();
                updateNavigationButtons();
                return true;
            }
        }
        
        // Если нет следующего в истории - получаем новый прокси из списка
        if (state.cachedProxies.length > 0) {
            getNewProxyFromList();
            return true;
        }
        
        return false;
    }
    
    // Новая функция для получения нового прокси (как кнопка)
    function getNewProxyFromList() {
        if (!state.cachedProxies.length) return false;
        
        state.currentIndex = (state.currentIndex + 1) % state.cachedProxies.length;
        state.currentProxyUrl = state.cachedProxies[state.currentIndex];
        
        addToHistory(state.currentProxyUrl);
        updateProxyDisplay();
        updateNavigationButtons();
        
        if (elements.totalNum && state.currentIndex >= 0) {
            if (elements.attemptNum) elements.attemptNum.textContent = `${state.currentIndex + 1}`;
        }
        
        localStorage.setItem(STORAGE_KEY, state.currentIndex.toString());
        
        if (elements.resultArea) elements.resultArea.style.display = 'block';
        
        return true;
    }
    
    function updateNavigationButtons() {
        if (elements.prevProxyBtn) elements.prevProxyBtn.disabled = state.historyPosition <= 0;
        // Стрелка вправо отключается только если нет истории и нет списка прокси
        if (elements.nextProxyBtn) {
            const hasHistoryForward = state.historyPosition < state.history.length - 1;
            const hasProxies = state.cachedProxies.length > 0;
            elements.nextProxyBtn.disabled = !hasHistoryForward && !hasProxies;
        }
    }
    
    function updateProxyDisplay() {
        if (elements.proxyLink) elements.proxyLink.textContent = state.currentProxyUrl;
        if (state.historyPosition >= 0 && state.history.length > 0) {
            if (elements.attemptNum) elements.attemptNum.textContent = `${state.historyPosition + 1} (из истории)`;
        } else if (state.currentIndex >= 0) {
            if (elements.attemptNum) elements.attemptNum.textContent = `${state.currentIndex + 1}`;
        }
    }
    
    async function loadProxies() {
        if (state.isLoading) return false;
        
        state.isLoading = true;
        elements.statusText.innerHTML = '<span class="loader"></span> Загрузка...';
        elements.getProxyBtn.disabled = true;
        
        try {
            const response = await fetchWithTimeout(PROXY_LIST_URL);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            
            const text = await response.text();
            const newHash = simpleHash(text);
            
            if (newHash === state.lastContentHash && state.cachedProxies.length > 0) {
                updateStatusIndicator();
                elements.getProxyBtn.disabled = false;
                state.isLoading = false;
                return true;
            }
            
            state.lastContentHash = newHash;
            
            const updateMatch = text.match(/# Updated: (.*?)(?:\n|$)/);
            if (updateMatch && elements.updateTime) {
                elements.updateTime.textContent = 'Обновлено: ' + sanitizeText(updateMatch[1]);
            }
            
            const proxies = text.split('\n')
                .map(line => line.trim())
                .filter(line => line.startsWith('tg://') && line.length > 10);
            
            if (!proxies.length) throw new Error('Список прокси пуст');
            
            state.cachedProxies = proxies;
            
            const savedIndex = localStorage.getItem(STORAGE_KEY);
            if (savedIndex && parseInt(savedIndex) < proxies.length) {
                state.currentIndex = parseInt(savedIndex);
            } else {
                state.currentIndex = -1;
            }
            
            if (elements.totalCount) elements.totalCount.textContent = proxies.length;
            if (elements.totalNum) elements.totalNum.textContent = proxies.length;
            
            updateStatusIndicator();
            elements.getProxyBtn.disabled = false;
            state.isLoading = false;
            return true;
            
        } catch (err) {
            console.error('Load error:', err);
            const errorMsg = err.name === 'AbortError' ? 'Ошибка: таймаут загрузки' : 'Ошибка загрузки списка';
            elements.statusText.textContent = errorMsg;
            elements.getProxyBtn.disabled = false;
            state.isLoading = false;
            return false;
        }
    }
    
    function showNextProxy() {
        if (!state.cachedProxies.length) return false;
        
        state.currentIndex = (state.currentIndex + 1) % state.cachedProxies.length;
        state.currentProxyUrl = state.cachedProxies[state.currentIndex];
        
        addToHistory(state.currentProxyUrl);
        updateProxyDisplay();
        updateNavigationButtons();
        
        if (elements.totalNum && state.currentIndex >= 0) {
            if (elements.attemptNum) elements.attemptNum.textContent = `${state.currentIndex + 1}`;
        }
        
        localStorage.setItem(STORAGE_KEY, state.currentIndex.toString());
        return true;
    }
    
    async function handleGetProxy() {
        if (state.debounceTimer) return;
        state.debounceTimer = setTimeout(() => { state.debounceTimer = null; }, 500);
        
        if (state.isLoading) {
            elements.statusText.textContent = 'Загрузка, подождите...';
            return;
        }
        
        if (!state.cachedProxies.length) {
            const loaded = await loadProxies();
            if (!loaded) return;
        }
        
        elements.getProxyBtn.disabled = true;
        const originalText = elements.getProxyBtn.innerHTML;
        elements.getProxyBtn.innerHTML = '<span class="loader"></span> Поиск...';
        
        const success = showNextProxy();
        
        if (success && state.currentProxyUrl) {
            if (elements.resultArea) elements.resultArea.style.display = 'block';
            updateStatusIndicator();
        } else {
            elements.statusText.textContent = 'Нет доступных прокси';
        }
        
        elements.getProxyBtn.disabled = false;
        elements.getProxyBtn.innerHTML = originalText;
    }
    
    async function copyToClipboard(text) {
        if (!text) return false;
        try {
            await navigator.clipboard.writeText(text);
            return true;
        } catch (err) {
            const textarea = document.createElement('textarea');
            textarea.value = text;
            textarea.style.position = 'fixed';
            textarea.style.opacity = '0';
            document.body.appendChild(textarea);
            textarea.select();
            const success = document.execCommand('copy');
            document.body.removeChild(textarea);
            return success;
        }
    }
    
    async function handleProxyLinkClick() {
        if (!state.currentProxyUrl) return;
        const success = await copyToClipboard(state.currentProxyUrl);
        if (success) {
            const originalText = elements.statusText.textContent;
            elements.statusText.textContent = 'Ссылка скопирована';
            setTimeout(() => {
                if (elements.statusText.textContent === 'Ссылка скопирована') {
                    updateStatusIndicator();
                }
            }, 2000);
        } else {
            elements.statusText.textContent = 'Ошибка копирования';
            setTimeout(() => updateStatusIndicator(), 2000);
        }
    }
    
    function handleConnect() {
        if (state.currentProxyUrl && state.currentProxyUrl.startsWith('tg://')) {
            window.open(state.currentProxyUrl, '_blank');
        }
    }
    
    function initFaq() {
        const faqItems = document.querySelectorAll('.faq-item');
        faqItems.forEach(item => {
            const question = item.querySelector('.faq-question');
            if (question) {
                question.addEventListener('click', () => {
                    item.classList.toggle('active');
                    const expanded = item.classList.contains('active');
                    question.setAttribute('aria-expanded', expanded);
                });
                question.setAttribute('aria-expanded', 'false');
            }
        });
    }
    
    function initMobileMenu() {
        const burgerIcon = document.getElementById('burgerIcon');
        const mobileMenu = document.getElementById('mobileMenu');
        const closeMenu = document.getElementById('closeMenu');
        
        if (!burgerIcon || !mobileMenu) return;
        
        const toggleMenu = () => {
            const isOpen = mobileMenu.classList.toggle('show');
            burgerIcon.setAttribute('aria-expanded', isOpen);
            document.body.style.overflow = isOpen ? 'hidden' : '';
        };
        
        burgerIcon.addEventListener('click', toggleMenu);
        if (closeMenu) closeMenu.addEventListener('click', toggleMenu);
        mobileMenu.addEventListener('click', (e) => {
            if (e.target === mobileMenu) toggleMenu();
        });
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && mobileMenu.classList.contains('show')) toggleMenu();
        });
    }
    
    function init() {
        loadHistory();
        
        if (elements.getProxyBtn) elements.getProxyBtn.addEventListener('click', handleGetProxy);
        if (elements.proxyLink) {
            elements.proxyLink.addEventListener('click', handleProxyLinkClick);
            elements.proxyLink.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleProxyLinkClick();
                }
            });
        }
        if (elements.connectBtn) elements.connectBtn.addEventListener('click', handleConnect);
        if (elements.prevProxyBtn) elements.prevProxyBtn.addEventListener('click', () => goBackInHistory());
        if (elements.nextProxyBtn) elements.nextProxyBtn.addEventListener('click', () => goForwardInHistory());
        
        initFaq();
        initMobileMenu();
        loadProxies();
        
        setInterval(() => updateStatusIndicator(), 10000);
    }
    
    init();
})();
