let currentMode = 'teacher';
let originalText = '';
let isRecording = false;
let hasFinalResult = false;
let recognition = null;
let recordTimeout = null;

// Request microphone permission on page load
function requestMicrophonePermission() {
    // Create a dummy audio stream to trigger permission prompt
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        navigator.mediaDevices.getUserMedia({ audio: true })
            .then(stream => {
                // Immediately stop the tracks, we just wanted the permission
                stream.getTracks().forEach(track => track.stop());
                console.log('Microphone permission granted.');
            })
            .catch(err => {
                showRecordingStatus('error', 'Microphone permission denied. Please allow access to use speech recognition.');
                console.error('Microphone permission denied:', err);
            });
    } else {
        showRecordingStatus('error', 'getUserMedia is not supported in this browser.');
    }
}

// Initialize speech recognition
function initSpeechRecognition() {
    if ('webkitSpeechRecognition' in window) {
        recognition = new webkitSpeechRecognition();
    } else if ('SpeechRecognition' in window) {
        recognition = new SpeechRecognition();
    } else {
        showRecordingStatus('error', 'Speech recognition not supported in this browser.');
        return false;
    }

    recognition.continuous = false; // one shot per start
    recognition.interimResults = false;
    recognition.lang = 'en-US';

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
        let msg = '';
        switch (event.error) {
            case 'not-allowed':
                msg = 'Microphone access denied.';
                break;
            case 'no-speech':
                msg = 'No speech detected.';
                break;
            case 'audio-capture':
                msg = 'Microphone not found.';
                break;
            default:
                msg = 'Error: ' + event.error;
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
            }
        }, 10000);
    } catch (e) {
        console.log('Start error:', e);
        showRecordingStatus('error', 'Could not start recognition.');
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
    requestMicrophonePermission();
    initSpeechRecognition();
}); 