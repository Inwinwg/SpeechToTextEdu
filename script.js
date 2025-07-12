let currentMode = 'teacher';
let originalText = '';
let isRecording = false;
let hasFinalResult = false;
let recognition = null;
let recordTimeout = null;

// Check browser compatibility
function checkBrowserCompatibility() {
    const isSecure = window.isSecureContext;
    const hasSpeechRecognition = !!(window.SpeechRecognition || window.webkitSpeechRecognition || 
                                   window.mozSpeechRecognition || window.msSpeechRecognition);
    const hasGetUserMedia = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
    
    let issues = [];
    
    if (!isSecure) {
        issues.push('Secure connection (HTTPS) required');
    }
    if (!hasSpeechRecognition) {
        issues.push('Speech recognition not supported');
    }
    if (!hasGetUserMedia) {
        issues.push('Microphone access not supported');
    }
    
    if (issues.length > 0) {
        const message = 'Browser compatibility issues: ' + issues.join(', ') + 
                       '. Please use Chrome, Edge, or Safari with HTTPS.';
        showRecordingStatus('error', message);
        return false;
    }
    
    return true;
}

// Request microphone permission on page load
function requestMicrophonePermission() {
    // Check if getUserMedia is supported
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        showRecordingStatus('error', 'Microphone access not supported in this browser. Please use a modern browser like Chrome, Edge, or Firefox.');
        return;
    }

    // Create a dummy audio stream to trigger permission prompt
    navigator.mediaDevices.getUserMedia({ 
        audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
        } 
    })
    .then(stream => {
        // Immediately stop the tracks, we just wanted the permission
        stream.getTracks().forEach(track => track.stop());
        console.log('Microphone permission granted.');
        showRecordingStatus('success', 'Microphone access granted! You can now use speech recognition.');
    })
    .catch(err => {
        console.error('Microphone permission error:', err);
        let errorMessage = 'Microphone access denied. ';
        
        if (err.name === 'NotAllowedError') {
            errorMessage += 'Please allow microphone access in your browser settings and refresh the page.';
        } else if (err.name === 'NotFoundError') {
            errorMessage += 'No microphone found. Please connect a microphone and try again.';
        } else if (err.name === 'NotReadableError') {
            errorMessage += 'Microphone is already in use by another application.';
        } else if (err.name === 'OverconstrainedError') {
            errorMessage += 'Microphone does not meet the required constraints.';
        } else {
            errorMessage += 'Please check your microphone settings and try again.';
        }
        
        showRecordingStatus('error', errorMessage);
    });
}

// Initialize speech recognition
function initSpeechRecognition() {
    // Try multiple ways to access speech recognition API
    let SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition || 
                           window.mozSpeechRecognition || window.msSpeechRecognition;
    
    if (!SpeechRecognition) {
        showRecordingStatus('error', 'Speech recognition not supported in this browser. Please use Chrome, Edge, or Safari.');
        return false;
    }

    try {
        recognition = new SpeechRecognition();
    } catch (e) {
        console.error('Failed to create SpeechRecognition instance:', e);
        showRecordingStatus('error', 'Failed to initialize speech recognition. Please check browser permissions.');
        return false;
    }

    // Configure recognition settings
    recognition.continuous = false; // one shot per start
    recognition.interimResults = false;
    recognition.lang = 'en-US';
    recognition.maxAlternatives = 1;

    recognition.onstart = function () {
        showRecordingStatus('info', '🎙️ Listening... Speak clearly.');
        console.log('Recognition started');
    };

    recognition.onresult = function (event) {
        let finalTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
            if (event.results[i].isFinal) {
                finalTranscript += event.results[i][0].transcript;
            }
        }
        if (finalTranscript.trim()) {
            processRecognitionResult(finalTranscript.trim());
        }
    };

    recognition.onerror = function (event) {
        console.error('Speech recognition error:', event.error);
        let msg = '';
        switch (event.error) {
            case 'not-allowed':
                msg = 'Microphone access denied. Please allow microphone access in your browser settings.';
                break;
            case 'no-speech':
                msg = 'No speech detected. Please try speaking more clearly.';
                break;
            case 'audio-capture':
                msg = 'Microphone not found. Please check your microphone connection.';
                break;
            case 'network':
                msg = 'Network error. Please check your internet connection.';
                break;
            case 'service-not-allowed':
                msg = 'Speech recognition service not allowed. Please check browser settings.';
                break;
            case 'bad-grammar':
                msg = 'Grammar error in speech recognition.';
                break;
            case 'language-not-supported':
                msg = 'Language not supported.';
                break;
            default:
                msg = 'Speech recognition error: ' + event.error;
        }
        showRecordingStatus('error', msg);
        stopRecording();
    };

    recognition.onend = function () {
        console.log('Recognition ended');
        if (isRecording && !hasFinalResult) {
            // Do not auto-restart, just stop
            stopRecording();
        }
    };

    return true;
}

function switchMode(mode) {
    currentMode = mode;
    // Update button states
    document.querySelectorAll('.mode-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    event.target.classList.add('active');
    // Show/hide panels
    if (mode === 'teacher') {
        document.getElementById('teacher-panel').classList.remove('hidden');
        document.getElementById('student-panel').classList.add('hidden');
    } else {
        document.getElementById('teacher-panel').classList.add('hidden');
        document.getElementById('student-panel').classList.remove('hidden');
        updateStudentPanel();
    }
}

function saveText() {
    const textInput = document.getElementById('original-text');
    const text = textInput.value.trim();
    if (!text) {
        showSavedStatus('error', 'Please enter some text first.');
        return;
    }
    originalText = text;
    showSavedStatus('success', 'Text saved successfully! Students can now practice.');
}

function clearText() {
    document.getElementById('original-text').value = '';
    originalText = '';
    showSavedStatus('info', 'Text cleared.');
}

function updateStudentPanel() {
    const noTextMsg = document.getElementById('no-text-message');
    const practiceArea = document.getElementById('practice-area');
    if (originalText) {
        noTextMsg.classList.add('hidden');
        practiceArea.classList.remove('hidden');
        document.getElementById('display-text').textContent = originalText;
        clearResults();
    } else {
        noTextMsg.classList.remove('hidden');
        practiceArea.classList.add('hidden');
    }
}

function toggleRecording() {
    if (isRecording) {
        stopRecording();
    } else {
        startRecognition();
    }
}

function startRecognition() {
    if (!recognition && !initSpeechRecognition()) return;
    if (isRecording) return;
    
    // Check if we're in a secure context (required for speech recognition)
    if (!window.isSecureContext) {
        showRecordingStatus('error', 'Speech recognition requires a secure connection (HTTPS). Please use HTTPS or localhost.');
        return;
    }
    
    clearResults();
    isRecording = true;
    hasFinalResult = false;
    updateRecordingButton();
    
    try {
        recognition.start();
        // Fallback stop in 10 seconds
        recordTimeout = setTimeout(() => {
            if (isRecording) {
                stopRecording();
                showRecordingStatus('info', 'Recording stopped automatically after 10 seconds.');
            }
        }, 10000);
    } catch (e) {
        console.error('Start recognition error:', e);
        let errorMsg = 'Could not start recognition. ';
        
        if (e.name === 'InvalidStateError') {
            errorMsg += 'Recognition is already active. Please wait a moment and try again.';
        } else if (e.name === 'NotAllowedError') {
            errorMsg += 'Microphone access denied. Please allow microphone access and refresh the page.';
        } else {
            errorMsg += 'Please check your browser settings and try again.';
        }
        
        showRecordingStatus('error', errorMsg);
        stopRecording();
    }
}

function stopRecording() {
    if (recognition && isRecording) {
        recognition.stop();
    }
    isRecording = false;
    hasFinalResult = false;
    updateRecordingButton();
    document.getElementById('recording-status').classList.add('hidden');
    if (recordTimeout) {
        clearTimeout(recordTimeout);
        recordTimeout = null;
    }
}

function updateRecordingButton() {
    const btn = document.getElementById('record-btn');
    if (isRecording) {
        btn.textContent = '⏹️ Stop Recording';
        btn.classList.add('recording');
    } else {
        btn.textContent = '🎤 Start Recording';
        btn.classList.remove('recording');
    }
}

function processRecognitionResult(spokenText) {
    console.log('Final result:', spokenText);
    hasFinalResult = true;
    document.getElementById('spoken-display').textContent = spokenText;
    compareTexts(originalText, spokenText);
    document.getElementById('results-area').classList.remove('hidden');
    if (isRecording) {
        stopRecording();
    }
}

function normalizeText(text) {
    return text.toLowerCase()
        .replace(/[^\w\s]/g, '') // Remove all punctuation
        .replace(/\s+/g, ' ')    // Replace multiple spaces with single space
        .trim();
}

function compareTexts(original, spoken) {
    // Normalize both texts to remove punctuation and standardize spacing
    const originalNormalized = normalizeText(original);
    const spokenNormalized = normalizeText(spoken);
    const originalWords = originalNormalized.split(/\s+/);
    const spokenWords = spokenNormalized.split(/\s+/);
    let comparisonHTML = '';
    let correctCount = 0;
    let totalWords = originalWords.length;
    for (let i = 0; i < originalWords.length; i++) {
        const originalWord = originalWords[i];
        const spokenWord = spokenWords[i];
        if (spokenWord && originalWord === spokenWord) {
            comparisonHTML += `<span class="word correct">${originalWord}</span>`;
            correctCount++;
        } else if (spokenWord) {
            comparisonHTML += `<span class="word incorrect">${originalWord}</span>`;
        } else {
            comparisonHTML += `<span class="word missing">${originalWord}</span>`;
        }
    }
    // Add extra words spoken
    for (let i = originalWords.length; i < spokenWords.length; i++) {
        comparisonHTML += `<span class="word incorrect">${spokenWords[i]}</span>`;
    }
    document.getElementById('comparison-display').innerHTML = comparisonHTML;
    // Update statistics
    const accuracy = Math.round((correctCount / totalWords) * 100);
    const score = Math.max(0, Math.round(accuracy - (spokenWords.length - originalWords.length) * 2));
    document.getElementById('accuracy-stat').textContent = accuracy + '%';
    document.getElementById('correct-stat').textContent = correctCount;
    document.getElementById('total-stat').textContent = totalWords;
    document.getElementById('score-stat').textContent = score;
}

function clearResults() {
    document.getElementById('results-area').classList.add('hidden');
    document.getElementById('spoken-display').textContent = '';
    document.getElementById('comparison-display').innerHTML = '';
}

function showSavedStatus(type, message) {
    const statusDiv = document.getElementById('saved-status');
    statusDiv.className = `status ${type}`;
    statusDiv.textContent = message;
    statusDiv.classList.remove('hidden');
    setTimeout(() => {
        statusDiv.classList.add('hidden');
    }, 3000);
}

function showRecordingStatus(type, message) {
    const statusDiv = document.getElementById('recording-status');
    statusDiv.className = `status ${type}`;
    statusDiv.textContent = message;
    statusDiv.classList.remove('hidden');
}

// Initialize the app
document.addEventListener('DOMContentLoaded', function() {
    // Check browser compatibility first
    if (checkBrowserCompatibility()) {
        requestMicrophonePermission();
        initSpeechRecognition();
    }
}); 