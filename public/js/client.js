// 連接 Socket.io
const socket = io();

// DOM 元素
const loginScreen = document.getElementById('loginScreen');
const buzzerScreen = document.getElementById('buzzerScreen');
const kickedScreen = document.getElementById('kickedScreen');
const nicknameInput = document.getElementById('nicknameInput');
const btnJoin = document.getElementById('btnJoin');
const userAvatar = document.getElementById('userAvatar');
const userName = document.getElementById('userName');
const statusText = document.getElementById('statusText');
const buzzerBtn = document.getElementById('buzzerBtn');
const resultOverlay = document.getElementById('resultOverlay');
const resultIcon = document.getElementById('resultIcon');
const resultTitle = document.getElementById('resultTitle');
const resultDetail = document.getElementById('resultDetail');
const resultTime = document.getElementById('resultTime');
const penaltyWarning = document.getElementById('penaltyWarning');

// 狀態
let myNickname = '';
let canBuzz = false;
let penaltyUntil = 0;
let hasJoined = false;

// ============ 連線事件 ============
socket.on('connect', () => {
    console.log('已連接到伺服器');
});

socket.on('disconnect', () => {
    console.log('與伺服器斷線');
});

// 加入成功
socket.on('join-success', (data) => {
    myNickname = data.nickname;
    hasJoined = true;
    showBuzzerScreen();

    // 如果搶答已進行中
    if (data.isBuzzerActive && !data.winner) {
        enableBuzzer();
    } else if (data.winner) {
        showResult(data.winner);
    }
});

// 加入被拒絕
socket.on('join-rejected', (message) => {
    alert(message);
});

// 搶答開始
socket.on('buzzer-started', () => {
    hideResult();
    enableBuzzer();
    vibrate();
});

// 搶答結果
socket.on('buzzer-result', (winner) => {
    disableBuzzer();
    showResult(winner);
});

// 搶答重置
socket.on('buzzer-reset', () => {
    hideResult();
    resetBuzzer();
});

// 被踢出
socket.on('kicked', (message) => {
    showKickedScreen();
});

// ============ UI 事件 ============
btnJoin.addEventListener('click', joinGame);
nicknameInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') joinGame();
});

buzzerBtn.addEventListener('click', handleBuzz);

// 防止雙擊縮放
buzzerBtn.addEventListener('touchend', (e) => {
    e.preventDefault();
    handleBuzz();
});

// ============ 函數 ============
function joinGame() {
    const nickname = nicknameInput.value.trim();
    if (!nickname) {
        nicknameInput.classList.add('shake');
        setTimeout(() => nicknameInput.classList.remove('shake'), 500);
        return;
    }

    btnJoin.disabled = true;
    btnJoin.textContent = '加入中...';
    socket.emit('join', nickname);
}

function showBuzzerScreen() {
    loginScreen.style.display = 'none';
    buzzerScreen.style.display = 'flex';
    userAvatar.textContent = myNickname.charAt(0).toUpperCase();
    userName.textContent = myNickname;
}

function showKickedScreen() {
    loginScreen.style.display = 'none';
    buzzerScreen.style.display = 'none';
    kickedScreen.style.display = 'flex';
}

function handleBuzz() {
    const now = Date.now();

    // 防偷跑機制
    if (!canBuzz) {
        if (now < penaltyUntil) {
            return; // 還在懲罰期間
        }
        // 偷跑懲罰
        penaltyUntil = now + 3000;
        showPenaltyWarning();
        return;
    }

    // 發送搶答訊號
    socket.emit('buzz');
    canBuzz = false;
    buzzerBtn.disabled = true;
}

function enableBuzzer() {
    canBuzz = true;
    buzzerBtn.disabled = false;
    buzzerBtn.className = 'buzzer-btn active';
    statusText.textContent = '快按下按鈕！';
    statusText.className = 'status-text active';
}

function disableBuzzer() {
    canBuzz = false;
    buzzerBtn.disabled = true;
    buzzerBtn.className = 'buzzer-btn disabled';
}

function resetBuzzer() {
    canBuzz = false;
    buzzerBtn.disabled = true;
    buzzerBtn.className = 'buzzer-btn locked';
    statusText.textContent = '等待主持人開始...';
    statusText.className = 'status-text waiting';
}

function showResult(winner) {
    const isWinner = winner.nickname === myNickname;

    if (isWinner) {
        resultIcon.textContent = '🏆';
        resultTitle.textContent = '恭喜你搶答成功！';
        resultTitle.className = 'result-title win';
        resultDetail.textContent = '';
        resultTime.textContent = `反應時間：${winner.reactionTime} ms`;
    } else {
        resultIcon.textContent = '😔';
        resultTitle.textContent = '慢了一步';
        resultTitle.className = 'result-title lose';
        resultDetail.textContent = `由 ${winner.nickname} 搶答成功`;
        resultTime.textContent = `對方反應時間：${winner.reactionTime} ms`;
    }

    statusText.textContent = isWinner ? '你贏了！🎉' : '下次加油！';
    statusText.className = 'status-text disabled';

    resultOverlay.classList.add('show');
}

function hideResult() {
    resultOverlay.classList.remove('show');
}

function showPenaltyWarning() {
    penaltyWarning.classList.add('show');
    vibrate([100, 50, 100]);

    setTimeout(() => {
        penaltyWarning.classList.remove('show');
    }, 2000);
}

function vibrate(pattern = [200]) {
    if ('vibrate' in navigator) {
        navigator.vibrate(pattern);
    }
}
