// Main application object
const app = {
    // Data structures
    settings: {
        priorityMode: false,
        defaultTime: 30,
        allowPause: true,
        allowReset: true,
        showProgress: true,
        showPercent: true,
        countDown: true,
        warningTime: 2,
        theme: 'light'
    },

    children: [],
    devices: [],
    queue: [],
    currentIndex: 0,
    timerInterval: null,
    currentSeconds: 0,
    totalSeconds: 0,
    isPaused: false,
    rules: [],
    currentDeviceId: localStorage.getItem('deviceId') || this.generateDeviceId(),
    warningShown: false,
    alertPlayed: false,

    // Rule templates
    ruleTemplates: [
        {
            name: 'עונש על איחור',
            description: 'אם נשאר פחות מדקה, הורד דקה + 5 דקות מהתור הבא',
            condition: 'overtime < 60',
            action: 'nextTurn - overtime - 300',
            enabled: true
        },
        {
            name: 'בונוס ליציאה מהירה',
            description: 'אם יצא לפני הזמן, הוסף את הזמן שנותר לתור הבא',
            condition: 'overtime < 0',
            action: 'nextTurn + Math.abs(overtime)',
            enabled: false
        },
        {
            name: 'עונש קשה על איחור',
            description: 'אם נשאר יותר מ-5 דקות, הורד 10 דקות מהתור הבא',
            condition: 'overtime > 300',
            action: 'nextTurn - 600',
            enabled: false
        },
        {
            name: 'חלוקת עונש לכולם',
            description: 'אם נשאר יותר מדקה, כל השאר מקבלים בונוס של דקה',
            condition: 'overtime > 60',
            action: 'allOthers + 60',
            enabled: false
        },
        {
            name: 'עונש יחסי',
            description: 'הורד מהתור הבא פי 2 מהזמן שנשאר',
            condition: 'overtime > 0',
            action: 'nextTurn - (overtime * 2)',
            enabled: false
        },
        {
            name: 'בונוס להתנהגות טובה',
            description: 'אם יצא בדיוק בזמן (טווח של 30 שניות), קבל 5 דקות בונוס בתור הבא',
            condition: 'Math.abs(overtime) <= 30',
            action: 'nextTurn + 300',
            enabled: false
        }
    ],

    // Initialize application
    init() {
        this.loadFromStorage();
        this.setupEventListeners();
        this.loadSettings();
        this.renderChildren();
        this.renderDevices();
        this.renderRules();
        this.loadTimerState();
        
        // Auto-refresh active devices every 3 seconds
        setInterval(() => {
            const timerTab = document.getElementById('timer');
            if (timerTab && timerTab.classList.contains('active')) {
                this.updateActiveDevicesDisplay();
            }
        }, 3000);

        // Auto-resume timer if it was running
        if (this.queue.length > 0 && this.currentIndex < this.queue.length && !this.isPaused) {
            this.resumeTimer();
        }
    },

    // Generate unique device ID
    generateDeviceId() {
        const id = 'device_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        localStorage.setItem('deviceId', id);
        return id;
    },

    // Setup event listeners
    setupEventListeners() {
        // Tab switching
        document.querySelectorAll('.tab').forEach(tab => {
            tab.addEventListener('click', () => {
                document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
                document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
                
                tab.classList.add('active');
                document.getElementById(tab.dataset.tab).classList.add('active');
                
                if (tab.dataset.tab === 'timer') {
                    this.updateActiveDevicesDisplay();
                }
            });
        });

        // Auto-save settings
        const autoSaveInputs = ['priorityMode', 'defaultTime', 'allowPause', 'allowReset', 
                                'showProgress', 'showPercent', 'countDown', 'warningTime', 'themeSelect'];
        autoSaveInputs.forEach(id => {
            const element = document.getElementById(id);
            if (element) {
                element.addEventListener('change', () => {
                    this.saveSettings(true);
                });
            }
        });
    },

    // Settings functions
    saveSettings(silent = false) {
        this.settings.priorityMode = document.getElementById('priorityMode').checked;
        this.settings.defaultTime = parseInt(document.getElementById('defaultTime').value);
        this.settings.allowPause = document.getElementById('allowPause').checked;
        this.settings.allowReset = document.getElementById('allowReset').checked;
        this.settings.showProgress = document.getElementById('showProgress').checked;
        this.settings.showPercent = document.getElementById('showPercent').checked;
        this.settings.countDown = document.getElementById('countDown').checked;
        this.settings.warningTime = parseInt(document.getElementById('warningTime').value) || 2;
        this.settings.theme = document.getElementById('themeSelect').value;
        
        this.applyTheme(this.settings.theme);
        this.saveToStorage();
        
        if (!silent) {
            alert('ההגדרות נשמרו בהצלחה! ✅');
        }
        
        this.updateTimerControls();
    },

    loadSettings() {
        document.getElementById('priorityMode').checked = this.settings.priorityMode;
        document.getElementById('defaultTime').value = this.settings.defaultTime;
        document.getElementById('allowPause').checked = this.settings.allowPause;
        document.getElementById('allowReset').checked = this.settings.allowReset;
        document.getElementById('showProgress').checked = this.settings.showProgress;
        document.getElementById('showPercent').checked = this.settings.showPercent;
        document.getElementById('countDown').checked = this.settings.countDown;
        document.getElementById('warningTime').value = this.settings.warningTime || 2;
        document.getElementById('themeSelect').value = this.settings.theme || 'light';
        
        this.applyTheme(this.settings.theme || 'light');
    },

    applyTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
    },

    // Children functions
    addChild() {
        const name = document.getElementById('childName').value.trim();
        if (!name) {
            alert('אנא הכנס שם ילד');
            return;
        }

        const time = parseInt(document.getElementById('childTime').value) || this.settings.defaultTime;
        const hasHomework = document.getElementById('childHomework').checked;
        
        this.children.push({
            id: Date.now(),
            name: name,
            defaultTime: time,
            hasHomework: hasHomework,
            totalUsage: 0
        });

        document.getElementById('childName').value = '';
        document.getElementById('childTime').value = '';
        document.getElementById('childHomework').checked = false;
        
        this.renderChildren();
        this.saveToStorage();
    },

    deleteChild(id) {
        if (confirm('האם למחוק את הילד?')) {
            this.children = this.children.filter(c => c.id !== id);
            this.renderChildren();
            this.saveToStorage();
        }
    },

    editChild(id) {
        const child = this.children.find(c => c.id === id);
        if (!child) return;

        document.getElementById('editChildId').value = child.id;
        document.getElementById('editChildName').value = child.name;
        document.getElementById('editChildTime').value = child.defaultTime;
        document.getElementById('editChildHomework').checked = child.hasHomework || false;
        
        document.getElementById('editChildModal').classList.add('active');
    },

    saveEditChild() {
        const id = parseInt(document.getElementById('editChildId').value);
        const child = this.children.find(c => c.id === id);
        if (!child) return;

        child.name = document.getElementById('editChildName').value.trim();
        child.defaultTime = parseInt(document.getElementById('editChildTime').value) || this.settings.defaultTime;
        child.hasHomework = document.getElementById('editChildHomework').checked;

        this.renderChildren();
        this.saveToStorage();
        this.closeEditChildModal();
        alert('הילד עודכן בהצלחה! ✅');
    },

    closeEditChildModal() {
        document.getElementById('editChildModal').classList.remove('active');
    },

    renderChildren() {
        const list = document.getElementById('childrenList');
        if (this.children.length === 0) {
            list.innerHTML = '<p style="text-align: center; color: var(--text-secondary);">טרם נוספו ילדים</p>';
            return;
        }

        list.innerHTML = this.children.map(child => `
            <div class="list-item">
                <div>
                    <strong>${child.name}</strong>
                    ${child.hasHomework ? '<span class="homework-badge">📚 שיעורי בית</span>' : ''}
                    <span style="color: var(--text-secondary); margin-right: 10px;">
                        ${child.defaultTime} דקות
                        | שימוש כולל: ${this.formatTime(child.totalUsage)}
                    </span>
                </div>
                <div style="display: flex; gap: 10px;">
                    <button class="btn-warning" onclick="app.editChild(${child.id})" style="padding: 8px 15px; font-size: 0.9rem;">✏️ ערוך</button>
                    <button class="btn-danger" onclick="app.deleteChild(${child.id})">🗑️ מחק</button>
                </div>
            </div>
        `).join('');
    },

    // Device functions
    addDevice() {
        const name = document.getElementById('deviceName').value.trim();
        if (!name) {
            alert('אנא הכנס שם מכשיר');
            return;
        }

        this.devices.push({
            id: Date.now(),
            name: name
        });

        document.getElementById('deviceName').value = '';
        this.renderDevices();
        this.saveToStorage();
    },

    removeDevice(id) {
        if (confirm('האם למחוק את המכשיר?')) {
            this.devices = this.devices.filter(d => d.id !== id);
            this.renderDevices();
            this.saveToStorage();
        }
    },

    renderDevices() {
        const list = document.getElementById('devicesList');
        if (this.devices.length === 0) {
            list.innerHTML = '<p style="text-align: center; color: var(--text-secondary);">טרם נוספו מכשירים</p>';
            return;
        }

        list.innerHTML = this.devices.map(device => `
            <div class="list-item">
                <span>${device.name}</span>
                <button class="btn-danger" onclick="app.removeDevice(${device.id})">🗑️ מחק</button>
            </div>
        `).join('');
    },

    // Queue functions
    startQueue() {
        if (this.children.length === 0) {
            alert('אנא הוסף ילדים לפני התחלת התור');
            return;
        }

        // Create queue from children
        this.queue = this.children.map(child => ({
            ...child,
            timeAllotted: child.defaultTime
        }));

        // Priority mode: homework children get continuous turns
        if (this.settings.priorityMode) {
            // Separate homework and non-homework children
            const homeworkKids = this.queue.filter(c => c.hasHomework);
            const otherKids = this.queue.filter(c => !c.hasHomework);
            
            // Put all homework kids first
            this.queue = [...homeworkKids, ...otherKids];
        } else {
            // Random shuffle
            this.shuffleArray(this.queue);
        }

        this.currentIndex = 0;
        document.getElementById('timerDisplay').style.display = 'block';
        this.renderQueue();
        this.loadCurrentChild();
        this.saveTimerState();
    },

    shuffleQueue() {
        if (this.queue.length === 0) {
            alert('אין תור פעיל לערבב');
            return;
        }

        this.shuffleArray(this.queue);
        this.currentIndex = 0;
        this.renderQueue();
        this.loadCurrentChild();
    },

    shuffleArray(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
    },

    renderQueue() {
        const list = document.getElementById('queueList');
        list.innerHTML = this.queue.map((child, i) => `
            <div class="queue-item ${i === this.currentIndex ? 'active' : ''}">
                <div style="display: flex; align-items: center; gap: 15px;">
                    <div class="number">${i + 1}</div>
                    <div>
                        <strong>${child.name}</strong>
                        ${child.hasHomework ? '<span class="homework-badge">📚 שיעורי בית</span>' : ''}
                    </div>
                </div>
                <div style="text-align: left;">
                    ${child.timeAllotted} דקות
                </div>
            </div>
        `).join('');
    },

    // Timer functions
    loadCurrentChild() {
        if (this.queue.length === 0 || this.currentIndex >= this.queue.length) return;

        const child = this.queue[this.currentIndex];
        this.totalSeconds = child.timeAllotted * 60;
        this.currentSeconds = this.settings.countDown ? this.totalSeconds : 0;
        this.warningShown = false;
        this.alertPlayed = false;

        document.getElementById('currentChildName').textContent = child.name;
        
        this.updateTimerDisplay();
        this.renderQueue();
        this.saveTimerState();
    },

    startTimer() {
        if (this.timerInterval) return;

        this.isPaused = false;
        document.getElementById('startBtn').style.display = 'none';
        document.getElementById('pauseBtn').style.display = this.settings.allowPause ? 'inline-block' : 'none';

        this.timerInterval = setInterval(() => {
            if (this.settings.countDown) {
                this.currentSeconds--;
                // Don't auto-finish, keep counting into negative
            } else {
                this.currentSeconds++;
                // Don't auto-finish, keep counting beyond total
            }
            this.updateTimerDisplay();
            this.saveActiveSession();
            this.saveTimerState();
        }, 1000);
        
        this.saveActiveSession();
        this.saveTimerState();
    },

    resumeTimer() {
        // Resume timer without user interaction (for page refresh)
        if (this.timerInterval) return;
        if (this.isPaused) return;

        this.timerInterval = setInterval(() => {
            if (this.settings.countDown) {
                this.currentSeconds--;
                // Don't auto-finish, keep counting into negative
            } else {
                this.currentSeconds++;
                // Don't auto-finish, keep counting beyond total
            }
            this.updateTimerDisplay();
            this.saveActiveSession();
            this.saveTimerState();
        }, 1000);
        
        document.getElementById('startBtn').style.display = 'none';
        document.getElementById('pauseBtn').style.display = this.settings.allowPause ? 'inline-block' : 'none';
    },

    pauseTimer() {
        if (!this.settings.allowPause) return;

        clearInterval(this.timerInterval);
        this.timerInterval = null;
        this.isPaused = true;

        document.getElementById('startBtn').style.display = 'inline-block';
        document.getElementById('pauseBtn').style.display = 'none';
        
        this.saveTimerState();
    },

    resetTimer() {
        if (!this.settings.allowReset) return;

        if (!confirm('האם לאפס את הטיימר?')) return;

        clearInterval(this.timerInterval);
        this.timerInterval = null;
        this.currentSeconds = this.settings.countDown ? this.totalSeconds : 0;
        this.isPaused = false;

        document.getElementById('startBtn').style.display = 'inline-block';
        document.getElementById('pauseBtn').style.display = 'none';

        this.updateTimerDisplay();
        this.saveTimerState();
    },

    nextChild() {
        if (!confirm('האם לעבור לילד הבא?')) return;

        this.finishCurrentTurn();
    },

    finishCurrentTurn() {
        clearInterval(this.timerInterval);
        this.timerInterval = null;

        // Calculate overtime
        const overtime = this.settings.countDown ? -this.currentSeconds : this.currentSeconds - this.totalSeconds;
        
        // Apply rules
        this.applyRules(this.queue[this.currentIndex].id, overtime);

        // Update total usage
        const child = this.children.find(c => c.id === this.queue[this.currentIndex].id);
        if (child) {
            const actualTime = this.settings.countDown ? this.totalSeconds - this.currentSeconds : this.currentSeconds;
            child.totalUsage += Math.floor(actualTime / 60);
        }

        // Show overtime notification
        if (Math.abs(overtime) > 30) {
            const message = overtime > 0 
                ? `⏱️ ${this.queue[this.currentIndex].name} נשאר ${Math.floor(overtime / 60)} דקות ו-${overtime % 60} שניות מעבר לזמן!`
                : `✅ ${this.queue[this.currentIndex].name} יצא ${Math.floor(Math.abs(overtime) / 60)} דקות ו-${Math.abs(overtime) % 60} שניות לפני הזמן!`;
            
            this.showNotification(message, overtime > 0 ? 'danger' : 'success');
        }

        this.currentIndex++;
        
        if (this.currentIndex >= this.queue.length) {
            const sessions = JSON.parse(localStorage.getItem('activeSessions') || '{}');
            delete sessions[this.currentDeviceId];
            localStorage.setItem('activeSessions', JSON.stringify(sessions));
            
            this.showCompletionDialog();
            return;
        }

        this.loadCurrentChild();
        document.getElementById('startBtn').style.display = 'inline-block';
        document.getElementById('pauseBtn').style.display = 'none';
        this.saveActiveSession();
    },

    playCompletionAlert() {
        // Play a strong, long beep sequence
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const beepDuration = 0.3;
        const pauseDuration = 0.2;
        const beepCount = 5;
        
        for (let i = 0; i < beepCount; i++) {
            const startTime = audioContext.currentTime + i * (beepDuration + pauseDuration);
            
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);
            
            oscillator.frequency.value = 880; // High pitch
            oscillator.type = 'square';
            
            gainNode.gain.setValueAtTime(0.5, startTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, startTime + beepDuration);
            
            oscillator.start(startTime);
            oscillator.stop(startTime + beepDuration);
        }

        // Flash screen
        this.flashScreen(5);
    },

    flashScreen(times = 3) {
        const overlay = document.createElement('div');
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: var(--warning);
            opacity: 0.5;
            z-index: 9999;
            pointer-events: none;
            animation: flash 0.5s ease-in-out ${times};
        `;
        document.body.appendChild(overlay);
        
        setTimeout(() => overlay.remove(), times * 500);
    },

    showNotification(message, type = 'success') {
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: var(--${type});
            color: white;
            padding: 15px 30px;
            border-radius: 10px;
            font-weight: bold;
            z-index: 10000;
            box-shadow: 0 4px 20px rgba(0,0,0,0.3);
            animation: slideDown 0.5s ease-out;
        `;
        notification.textContent = message;
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.style.animation = 'fadeOut 0.5s ease-out';
            setTimeout(() => notification.remove(), 500);
        }, 3000);
    },

    showCompletionDialog() {
        const sessions = this.loadActiveSessions();
        const otherActiveSessions = Object.keys(sessions).filter(id => id !== this.currentDeviceId).length;
        
        let message = 'כל הילדים סיימו! 🎉\n\n';
        
        if (otherActiveSessions > 0) {
            message += `יש עדיין ${otherActiveSessions} מכשיר${otherActiveSessions > 1 ? 'ים' : ''} פעיל${otherActiveSessions > 1 ? 'ים' : ''}.\n\n`;
        }
        
        message += 'האם להתחיל תור חדש?';
        
        if (confirm(message)) {
            this.clearTimerState();
            this.startQueue();
        } else {
            document.getElementById('timerDisplay').style.display = 'none';
            this.queue = [];
            this.clearTimerState();
            this.saveToStorage();
            this.renderChildren();
        }
    },

    updateTimerDisplay() {
        const minutes = Math.floor(Math.abs(this.currentSeconds) / 60);
        const seconds = Math.abs(this.currentSeconds) % 60;
        
        // Check if we're in overtime
        const isOvertime = this.settings.countDown ? this.currentSeconds < 0 : this.currentSeconds > this.totalSeconds;
        const prefix = isOvertime ? '-' : '';
        
        document.getElementById('timeDisplay').textContent = 
            `${prefix}${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
        
        // Change color to red if overtime
        const timerDisplay = document.getElementById('timerDisplay');
        if (isOvertime) {
            timerDisplay.style.background = 'linear-gradient(135deg, #FF6B6B, #FF0000)';
        } else {
            timerDisplay.style.background = 'linear-gradient(135deg, var(--primary), var(--secondary))';
        }

        // Check for warning time
        const timeRemaining = this.settings.countDown ? this.currentSeconds : this.totalSeconds - this.currentSeconds;
        const warningSeconds = (this.settings.warningTime || 2) * 60;
        
        if (timeRemaining <= warningSeconds && timeRemaining > 0 && timeRemaining > warningSeconds - 5 && !this.warningShown) {
            this.warningShown = true;
            this.showNotification(`⏰ נותרו ${this.settings.warningTime} דקות!`, 'warning');
            this.playBeep();
        }
        
        // Play strong alert when time reaches 0
        if (timeRemaining <= 0 && timeRemaining > -5 && !this.alertPlayed) {
            this.alertPlayed = true;
            this.playCompletionAlert();
        }
        
        // Reset alert flag when back to positive
        if (timeRemaining > 0) {
            this.warningShown = false;
            this.alertPlayed = false;
        }

        // Progress bar
        let progress = (this.currentSeconds / this.totalSeconds) * 100;
        if (isOvertime) {
            progress = 100; // Keep at 100% when overtime
        }
        const displayProgress = this.settings.countDown ? 100 - progress : progress;
        
        if (this.settings.showProgress) {
            document.getElementById('progressContainer').style.display = 'block';
            const progressBar = document.getElementById('progressBar');
            progressBar.style.width = displayProgress + '%';
            
            // Change progress bar to red in overtime
            if (isOvertime) {
                progressBar.style.background = 'linear-gradient(90deg, #FF6B6B, #FF0000)';
            } else {
                progressBar.style.background = 'linear-gradient(90deg, var(--success), var(--warning))';
            }
            
            if (this.settings.showPercent) {
                document.getElementById('percentDisplay').textContent = 
                    Math.round(displayProgress) + '%';
            } else {
                document.getElementById('percentDisplay').textContent = '';
            }
        } else {
            document.getElementById('progressContainer').style.display = 'none';
        }

        // Stats
        let elapsed, remaining;
        
        if (isOvertime) {
            // In overtime
            elapsed = this.totalSeconds + Math.abs(timeRemaining);
            remaining = timeRemaining; // Negative value
        } else {
            elapsed = this.settings.countDown ? this.totalSeconds - this.currentSeconds : this.currentSeconds;
            remaining = this.settings.countDown ? this.currentSeconds : this.totalSeconds - this.currentSeconds;
        }

        document.getElementById('elapsedTime').textContent = this.formatTime(elapsed);
        
        // Format remaining time with minus if negative
        if (remaining < 0) {
            document.getElementById('remainingTime').textContent = '-' + this.formatTime(Math.abs(remaining));
            document.getElementById('remainingTime').style.color = '#FF6B6B';
        } else {
            document.getElementById('remainingTime').textContent = this.formatTime(remaining);
            document.getElementById('remainingTime').style.color = 'var(--primary)';
        }
    },

    playBeep() {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.frequency.value = 800;
        oscillator.type = 'sine';
        
        gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
        
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.5);
    },

    updateTimerControls() {
        const pauseBtn = document.getElementById('pauseBtn');
        const resetBtn = document.getElementById('resetBtn');
        
        if (!this.settings.allowPause && pauseBtn) {
            pauseBtn.style.display = 'none';
        }
        
        if (!this.settings.allowReset && resetBtn) {
            resetBtn.disabled = true;
            resetBtn.style.opacity = '0.5';
        } else if (resetBtn) {
            resetBtn.disabled = false;
            resetBtn.style.opacity = '1';
        }
    },

    formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${String(secs).padStart(2, '0')}`;
    },

    // Rules functions
    renderRules() {
        const list = document.getElementById('rulesList');
        if (!list) return;

        list.innerHTML = this.rules.map((rule, index) => `
            <div class="rule-item ${!rule.enabled ? 'disabled' : ''}">
                <div class="rule-header">
                    <div class="rule-name">${rule.name}</div>
                    <div class="rule-controls">
                        <label class="toggle-switch">
                            <input type="checkbox" ${rule.enabled ? 'checked' : ''} 
                                   onchange="app.toggleRule(${index})">
                            <span class="toggle-slider"></span>
                        </label>
                        ${index >= this.ruleTemplates.length ? 
                            `<button class="btn-danger" onclick="app.deleteRule(${index})" style="padding: 5px 10px; font-size: 0.8rem;">🗑️</button>` 
                            : ''}
                    </div>
                </div>
                <div class="rule-description">${rule.description}</div>
                <div class="rule-formula">
                    <div><strong>תנאי:</strong> ${rule.condition}</div>
                    <div><strong>פעולה:</strong> ${rule.action}</div>
                </div>
            </div>
        `).join('');
    },

    toggleRule(index) {
        this.rules[index].enabled = !this.rules[index].enabled;
        this.renderRules();
        this.saveToStorage();
    },

    deleteRule(index) {
        if (confirm('האם למחוק את החוק?')) {
            this.rules.splice(index, 1);
            this.renderRules();
            this.saveToStorage();
        }
    },

    openCustomRuleModal() {
        document.getElementById('customRuleModal').classList.add('active');
        document.getElementById('ruleName').value = '';
        document.getElementById('ruleDescription').value = '';
        document.getElementById('ruleCondition').value = '';
        document.getElementById('ruleAction').value = '';
    },

    closeCustomRuleModal() {
        document.getElementById('customRuleModal').classList.remove('active');
    },

    insertVariable(fieldId, value) {
        const field = document.getElementById(fieldId);
        const cursorPos = field.selectionStart;
        const textBefore = field.value.substring(0, cursorPos);
        const textAfter = field.value.substring(cursorPos);
        field.value = textBefore + value + textAfter;
        field.focus();
        field.setSelectionRange(cursorPos + value.length, cursorPos + value.length);
    },

    saveCustomRule() {
        const name = document.getElementById('ruleName').value.trim();
        const description = document.getElementById('ruleDescription').value.trim();
        const condition = document.getElementById('ruleCondition').value.trim();
        const action = document.getElementById('ruleAction').value.trim();

        if (!name || !description || !condition || !action) {
            alert('אנא מלא את כל השדות');
            return;
        }

        this.rules.push({
            name,
            description,
            condition,
            action,
            enabled: true
        });

        this.renderRules();
        this.saveToStorage();
        this.closeCustomRuleModal();
        alert('החוק נוסף בהצלחה! ✅');
    },

    applyRules(childId, overtime) {
        const child = this.children.find(c => c.id === childId);
        if (!child) return;

        const defaultTurn = this.settings.defaultTime * 60;
        let nextTurn = child.defaultTime * 60;
        const activeRules = this.rules.filter(r => r.enabled);

        for (const rule of activeRules) {
            try {
                const conditionMet = eval(rule.condition);
                
                if (conditionMet) {
                    if (rule.action.includes('allOthers')) {
                        const bonus = eval(rule.action.replace('allOthers', '0'));
                        this.queue.forEach((qChild, idx) => {
                            if (idx > this.currentIndex && qChild.id !== childId) {
                                qChild.timeAllotted += Math.floor(bonus / 60);
                            }
                        });
                    } else {
                        nextTurn = Math.max(60, eval(rule.action));
                    }

                    console.log(`Rule applied: ${rule.name}`);
                }
            } catch (e) {
                console.error(`Error applying rule "${rule.name}":`, e);
            }
        }

        child.defaultTime = Math.floor(nextTurn / 60);
        this.saveToStorage();
        this.renderChildren();
    },

    // Multi-device session management
    saveActiveSession() {
        if (this.queue.length === 0 || this.currentIndex >= this.queue.length) return;
        
        const sessions = JSON.parse(localStorage.getItem('activeSessions') || '{}');
        sessions[this.currentDeviceId] = {
            currentIndex: this.currentIndex,
            currentSeconds: this.currentSeconds,
            totalSeconds: this.totalSeconds,
            isPaused: this.isPaused,
            queue: this.queue,
            deviceName: this.getDeviceName(),
            lastUpdate: Date.now()
        };
        localStorage.setItem('activeSessions', JSON.stringify(sessions));
    },

    loadActiveSessions() {
        try {
            const sessions = JSON.parse(localStorage.getItem('activeSessions') || '{}');
            const now = Date.now();
            Object.keys(sessions).forEach(deviceId => {
                if (now - sessions[deviceId].lastUpdate > 3600000) {
                    delete sessions[deviceId];
                }
            });
            localStorage.setItem('activeSessions', JSON.stringify(sessions));
            return sessions;
        } catch (e) {
            return {};
        }
    },

    getDeviceName() {
        const device = this.devices.find(d => d.id === parseInt(localStorage.getItem('selectedDeviceId')));
        return device ? device.name : 'מכשיר ' + this.currentDeviceId.substr(-4);
    },

    updateActiveDevicesDisplay() {
        const sessions = this.loadActiveSessions();
        const activeDevicesInfo = document.getElementById('activeDevicesInfo');
        const activeDevicesList = document.getElementById('activeDevicesList');
        
        const otherSessions = Object.entries(sessions).filter(([id]) => id !== this.currentDeviceId);
        
        if (otherSessions.length > 0) {
            activeDevicesInfo.style.display = 'block';
            activeDevicesList.innerHTML = otherSessions.map(([id, session]) => {
                const child = session.queue[session.currentIndex] || {};
                const progress = session.totalSeconds > 0 
                    ? Math.round((session.currentSeconds / session.totalSeconds) * 100) 
                    : 0;
                
                return `
                    <div class="list-item" style="margin-bottom: 5px;">
                        <div>
                            <strong>${session.deviceName}</strong>
                            <span style="color: var(--text-secondary); margin-right: 10px;">
                                ${child.name || 'לא ידוע'} - ${this.formatTime(session.currentSeconds)}/${this.formatTime(session.totalSeconds)}
                                ${session.isPaused ? '⏸️ מושהה' : '▶️ פעיל'}
                            </span>
                        </div>
                        <div style="width: 100px; background: var(--bg-main); height: 8px; border-radius: 4px; overflow: hidden;">
                            <div style="width: ${progress}%; height: 100%; background: var(--primary);"></div>
                        </div>
                    </div>
                `;
            }).join('');
        } else {
            activeDevicesInfo.style.display = 'none';
        }
    },

    // Statistics functions
    showStatistics() {
        let stats = '<div style="max-height: 500px; overflow-y: auto;">';
        stats += '<h3 style="color: var(--primary);">📊 סטטיסטיקות שימוש</h3>';
        
        if (this.children.length === 0) {
            alert('אין נתונים להצגה');
            return;
        }
        
        const totalUsage = this.children.reduce((sum, child) => sum + child.totalUsage, 0);
        
        stats += `<p><strong>סך הכל שעות שימוש:</strong> ${this.formatTime(totalUsage * 60)}</p>`;
        stats += '<hr style="border-color: var(--border); margin: 15px 0;">';
        
        this.children.forEach(child => {
            const percentage = totalUsage > 0 ? ((child.totalUsage / totalUsage) * 100).toFixed(1) : 0;
            stats += `
                <div style="margin-bottom: 15px; padding: 10px; background: var(--bg-main); border-radius: 8px;">
                    <strong>${child.name}</strong><br>
                    <span style="color: var(--text-secondary);">
                        שימוש: ${this.formatTime(child.totalUsage * 60)} (${percentage}%)<br>
                        ${child.hasHomework ? '📚 עם שיעורי בית' : ''}
                    </span>
                    <div style="width: 100%; background: var(--border); height: 8px; border-radius: 4px; margin-top: 5px; overflow: hidden;">
                        <div style="width: ${percentage}%; height: 100%; background: var(--primary);"></div>
                    </div>
                </div>
            `;
        });
        
        stats += '</div>';
        
        const modal = document.createElement('div');
        modal.className = 'modal active';
        modal.innerHTML = `
            <div class="modal-content">
                <span class="close-modal" onclick="this.parentElement.parentElement.remove()">×</span>
                ${stats}
                <button onclick="this.parentElement.parentElement.remove()" class="btn-secondary" style="margin-top: 15px;">סגור</button>
            </div>
        `;
        document.body.appendChild(modal);
    },

    resetStatistics() {
        if (!confirm('האם לאפס את כל הסטטיסטיקות? פעולה זו אינה הפיכה!')) return;
        
        this.children.forEach(child => child.totalUsage = 0);
        this.saveToStorage();
        this.renderChildren();
        alert('הסטטיסטיקות אופסו! ✅');
    },

    exportData() {
        const exportData = {
            settings: this.settings,
            children: this.children,
            devices: this.devices,
            rules: this.rules,
            exportDate: new Date().toISOString()
        };
        
        const dataStr = JSON.stringify(exportData, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(dataBlob);
        
        const link = document.createElement('a');
        link.href = url;
        link.download = `turn-system-backup-${new Date().toISOString().split('T')[0]}.json`;
        link.click();
        
        URL.revokeObjectURL(url);
        alert('הנתונים יוצאו בהצלחה! 💾');
    },

    // Storage functions
    saveToStorage() {
        const data = {
            settings: this.settings,
            children: this.children,
            devices: this.devices,
            rules: this.rules
        };
        
        localStorage.setItem('turnSystem', JSON.stringify(data));
        console.log('💾 נשמר אוטומטית ל-localStorage');
    },

    saveTimerState() {
        const timerState = {
            queue: this.queue,
            currentIndex: this.currentIndex,
            currentSeconds: this.currentSeconds,
            totalSeconds: this.totalSeconds,
            isPaused: this.isPaused
        };
        localStorage.setItem('timerState_' + this.currentDeviceId, JSON.stringify(timerState));
        console.log('⏱️ מצב הטיימר נשמר');
    },

    loadTimerState() {
        try {
            const stateData = localStorage.getItem('timerState_' + this.currentDeviceId);
            if (stateData) {
                const state = JSON.parse(stateData);
                this.queue = state.queue || [];
                this.currentIndex = state.currentIndex || 0;
                this.currentSeconds = state.currentSeconds || 0;
                this.totalSeconds = state.totalSeconds || 0;
                this.isPaused = state.isPaused || false;
                
                if (this.queue.length > 0 && this.currentIndex < this.queue.length) {
                    document.getElementById('timerDisplay').style.display = 'block';
                    this.renderQueue();
                    this.updateTimerDisplay();
                    
                    if (!this.isPaused) {
                        document.getElementById('startBtn').style.display = 'none';
                        document.getElementById('pauseBtn').style.display = 'inline-block';
                    }
                }
            }
        } catch (e) {
            console.error('Error loading timer state:', e);
        }
    },

    clearTimerState() {
        localStorage.removeItem('timerState_' + this.currentDeviceId);
    },

    loadFromStorage() {
        try {
            const data = localStorage.getItem('turnSystem');
            if (data && data.trim()) {
                const parsed = JSON.parse(data);
                this.settings = parsed.settings || this.settings;
                this.children = parsed.children || [];
                this.devices = parsed.devices || [];
                this.rules = parsed.rules || JSON.parse(JSON.stringify(this.ruleTemplates));
            }
        } catch (e) {
            console.error('Error loading from localStorage:', e);
            localStorage.removeItem('turnSystem');
        }
        
        if (this.rules.length === 0) {
            this.rules = JSON.parse(JSON.stringify(this.ruleTemplates));
        }
    }
};

// Initialize app when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => app.init());
} else {
    app.init();
}
