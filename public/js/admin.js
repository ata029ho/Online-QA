// 連接 Socket.io
const socket = io();

// DOM 元素
const btnStart = document.getElementById('btnStart');
const btnReset = document.getElementById('btnReset');
const btnLock = document.getElementById('btnLock');
const lockStatus = document.getElementById('lockStatus');
const participantCount = document.getElementById('participantCount');
const onlineCount = document.getElementById('onlineCount');
const participantList = document.getElementById('participantList');
const winnerDisplay = document.getElementById('winnerDisplay');

// 狀態
let isLocked = false;
let isBuzzerActive = false;

// 連接成功
socket.on('connect', () => {
    console.log('已連接到伺服器');
    socket.emit('admin-join');
});

// 接收初始狀態
socket.on('state-update', (state) => {
    isLocked = state.isLocked;
    isBuzzerActive = state.isBuzzerActive;
    updateLockUI();
    updateBuzzerUI();
    participantCount.textContent = state.participantCount;
    onlineCount.textContent = `${state.participantCount} 人在線`;

    if (state.winner) {
        showWinner(state.winner);
    }

    if (state.participants) {
        renderParticipants(state.participants);
    }
});

// 參賽者更新
socket.on('participants-update', (participants) => {
    participantCount.textContent = participants.length;
    onlineCount.textContent = `${participants.length} 人在線`;
    renderParticipants(participants);
});

// 房間鎖定狀態變更
socket.on('lock-changed', (locked) => {
    isLocked = locked;
    updateLockUI();
});

// 搶答開始
socket.on('buzzer-started', () => {
    isBuzzerActive = true;
    updateBuzzerUI();
    winnerDisplay.innerHTML = '<div class="no-winner">搶答進行中...</div>';
});

// 搶答結果
socket.on('buzzer-result', (winner) => {
    isBuzzerActive = false;
    updateBuzzerUI();
    showWinner(winner);
});

// 搶答重置
socket.on('buzzer-reset', () => {
    isBuzzerActive = false;
    updateBuzzerUI();
    winnerDisplay.innerHTML = '<div class="no-winner">尚無搶答結果</div>';
});

// 事件處理
btnStart.addEventListener('click', () => {
    if (!isBuzzerActive) {
        socket.emit('start-buzzer');
    }
});

btnReset.addEventListener('click', () => {
    socket.emit('reset-buzzer');
});

btnLock.addEventListener('click', () => {
    socket.emit('toggle-lock');
});

// UI 更新函數
function updateLockUI() {
    if (isLocked) {
        lockStatus.className = 'lock-status locked';
        lockStatus.textContent = '🔒 已鎖定';
        btnLock.textContent = '🔓 解鎖房間';
        btnLock.classList.remove('btn-primary');
        btnLock.classList.add('btn-danger');
    } else {
        lockStatus.className = 'lock-status unlocked';
        lockStatus.textContent = '🔓 開放加入';
        btnLock.textContent = '🔒 鎖定房間';
        btnLock.classList.remove('btn-danger');
        btnLock.classList.add('btn-primary');
    }
}

function updateBuzzerUI() {
    if (isBuzzerActive) {
        btnStart.disabled = true;
        btnStart.textContent = '⏳ 搶答中...';
    } else {
        btnStart.disabled = false;
        btnStart.textContent = '▶️ 開始搶答';
    }
}

function showWinner(winner) {
    winnerDisplay.innerHTML = `
    <div class="current-winner">
      <div class="winner-info">🏆 ${winner.nickname}</div>
      <div class="winner-reaction">反應時間：${winner.reactionTime} ms</div>
    </div>
  `;
}

function renderParticipants(participants) {
    if (participants.length === 0) {
        participantList.innerHTML = '<div class="no-winner text-center">尚無參賽者加入</div>';
        return;
    }

    participantList.innerHTML = participants.map(p => `
    <div class="participant-item fade-in">
      <div class="participant-name">
        <span class="status-dot online"></span>
        ${escapeHtml(p.nickname)}
      </div>
      <button class="btn btn-danger btn-sm" onclick="kickUser('${p.id}')">
        踢出
      </button>
    </div>
  `).join('');
}

function kickUser(socketId) {
    if (confirm('確定要踢出此參賽者？')) {
        socket.emit('kick-user', socketId);
    }
}

// 防止 XSS
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
