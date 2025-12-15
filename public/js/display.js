// 連接 Socket.io
const socket = io();

// DOM 元素
const screenWaiting = document.getElementById('screenWaiting');
const screenActive = document.getElementById('screenActive');
const screenResult = document.getElementById('screenResult');
const qrcodeImage = document.getElementById('qrcodeImage');
const urlDisplay = document.getElementById('urlDisplay');
const participantStat = document.getElementById('participantStat');
const winnerName = document.getElementById('winnerName');
const reactionTime = document.getElementById('reactionTime');
const lockIndicator = document.getElementById('lockIndicator');

// 螢幕切換函數
function showScreen(screenName) {
    screenWaiting.classList.remove('active');
    screenActive.classList.remove('active');
    screenResult.classList.remove('active');

    switch (screenName) {
        case 'waiting':
            screenWaiting.classList.add('active');
            break;
        case 'active':
            screenActive.classList.add('active');
            break;
        case 'result':
            screenResult.classList.add('active');
            break;
    }
}

// 載入 QR Code
async function loadQRCode() {
    try {
        const response = await fetch('/api/qrcode');
        const data = await response.json();
        qrcodeImage.src = data.qrcode;
        urlDisplay.textContent = data.url;
    } catch (error) {
        console.error('無法載入 QR Code:', error);
        urlDisplay.textContent = window.location.origin + '/client.html';
    }
}

// 連接成功
socket.on('connect', () => {
    console.log('已連接到伺服器');
    socket.emit('display-join');
    loadQRCode();
});

// 接收初始狀態
socket.on('state-update', (state) => {
    participantStat.textContent = state.participantCount;
    updateLockIndicator(state.isLocked);

    if (state.winner) {
        showWinner(state.winner);
    } else if (state.isBuzzerActive) {
        showScreen('active');
    } else {
        showScreen('waiting');
    }
});

// 參賽者更新
socket.on('participants-update', (participants) => {
    participantStat.textContent = participants.length;
});

// 房間鎖定狀態變更
socket.on('lock-changed', (isLocked) => {
    updateLockIndicator(isLocked);
});

// 搶答開始
socket.on('buzzer-started', () => {
    showScreen('active');
});

// 搶答結果
socket.on('buzzer-result', (winner) => {
    showWinner(winner);
});

// 搶答重置
socket.on('buzzer-reset', () => {
    showScreen('waiting');
});

// 顯示獲勝者
function showWinner(winner) {
    winnerName.textContent = winner.nickname;
    reactionTime.textContent = `${winner.reactionTime} ms`;
    showScreen('result');
}

// 更新鎖定指示器
function updateLockIndicator(isLocked) {
    if (isLocked) {
        lockIndicator.className = 'lock-indicator locked';
        lockIndicator.textContent = '🔒 已鎖定';
    } else {
        lockIndicator.className = 'lock-indicator unlocked';
        lockIndicator.textContent = '🔓 開放加入中';
    }
}
