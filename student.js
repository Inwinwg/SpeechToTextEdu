let currentMode = 'student';
let originalText = '';
let isRecording = false;
let hasFinalResult = false;
let recognition = null;
let recordTimeout = null;
let studentName = '';
let connectionCheckInterval = null;
let nameConfirmed = false;
let lastLoadedText = ''; // Track the last loaded text to detect changes

// Logging function
function log(message, data = null) {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] ${message}`;
    console.log(logMessage);
    if (data) {
        console.log('Data:', data);
    }
}

// Check browser compatibility
function checkBrowserCompatibility() {
    log('Checking browser compatibility...');
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
        log('Browser compatibility issues found:', issues);
        showRecordingStatus('error', message);
        return false;
    }
    
    log('Browser compatibility check passed');
    return true;
}

// Request microphone permission on page load
function requestMicrophonePermission() {
    log('Requesting microphone permission...');
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
        log('Microphone permission granted');
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
        
        log('Microphone permission error:', err);
        showRecordingStatus('error', errorMessage);
    });
}

// Initialize speech recognition
function initSpeechRecognition() {
    log('Initializing speech recognition...');
    // Try multiple ways to access speech recognition API
    let SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition || 
                           window.mozSpeechRecognition || window.msSpeechRecognition;
    
    if (!SpeechRecognition) {
        showRecordingStatus('error', 'Speech recognition not supported in this browser. Please use Chrome, Edge, or Safari.');
        return false;
    }

    try {
        recognition = new SpeechRecognition();
        log('SpeechRecognition instance created successfully');
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
        log('Speech recognition started');
        showRecordingStatus('info', '🎙️ Listening... Speak clearly.');
    };

    recognition.onresult = function (event) {
        log('Speech recognition result received:', event);
        let finalTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
            if (event.results[i].isFinal) {
                finalTranscript += event.results[i][0].transcript;
            }
        }
        if (finalTranscript.trim()) {
            log('Processing final transcript:', finalTranscript.trim());
            processRecognitionResult(finalTranscript.trim());
        }
    };

    recognition.onerror = function (event) {
        console.error('Speech recognition error:', event.error);
        log('Speech recognition error:', event.error);
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
        log('Speech recognition ended');
        if (isRecording && !hasFinalResult) {
            // Do not auto-restart, just stop
            stopRecording();
        }
    };

    return true;
}

function updateStudentName() {
    studentName = document.getElementById('student-name').value.trim();
    localStorage.setItem('studentName', studentName);
    log('Student name updated:', studentName);
}

function confirmStudentName() {
    const name = document.getElementById('student-name').value.trim();
    if (!name) {
        showRecordingStatus('error', 'Please enter your name first.');
        return;
    }
    
    studentName = name;
    nameConfirmed = true;
    localStorage.setItem('studentName', name);
    localStorage.setItem('nameConfirmed', 'true');
    
    document.getElementById('name-input-section').classList.add('hidden');
    document.getElementById('name-confirmed-section').classList.remove('hidden');
    document.getElementById('confirmed-name').textContent = name;
    
    log('Student name confirmed:', name);
    showRecordingStatus('success', 'Name confirmed! You can now practice.');
}

function changeStudentName() {
    nameConfirmed = false;
    localStorage.removeItem('nameConfirmed');
    
    document.getElementById('name-input-section').classList.remove('hidden');
    document.getElementById('name-confirmed-section').classList.add('hidden');
    document.getElementById('student-name').value = '';
    
    log('Student name change requested');
}

function loadStudentName() {
    const savedName = localStorage.getItem('studentName');
    const savedConfirmation = localStorage.getItem('nameConfirmed');
    
    if (savedName && savedConfirmation === 'true') {
        studentName = savedName;
        nameConfirmed = true;
        document.getElementById('student-name').value = savedName;
        document.getElementById('name-input-section').classList.add('hidden');
        document.getElementById('name-confirmed-section').classList.remove('hidden');
        document.getElementById('confirmed-name').textContent = savedName;
        log('Loaded confirmed student name:', savedName);
    } else {
        log('No confirmed student name found, showing input section');
    }
}

function checkForPracticeText() {
    const savedText = localStorage.getItem('practiceText');
    
    // Only update if the text has actually changed
    if (savedText !== lastLoadedText) {
        log('Practice text changed from:', lastLoadedText, 'to:', savedText);
        
        if (savedText) {
            originalText = savedText;
            lastLoadedText = savedText;
            document.getElementById('display-text').textContent = savedText;
            document.getElementById('no-text-message').classList.add('hidden');
            document.getElementById('practice-area').classList.remove('hidden');
            // Only clear results when text actually changes
            clearResults();
            log('Practice text loaded and results cleared due to text change');
        } else {
            lastLoadedText = '';
            document.getElementById('no-text-message').classList.remove('hidden');
            document.getElementById('practice-area').classList.add('hidden');
            log('Practice text removed');
        }
    } else {
        log('Practice text check - no changes detected');
    }
}

function startConnectionCheck() {
    // Check for practice text every 3 seconds
    connectionCheckInterval = setInterval(() => {
        checkForPracticeText();
    }, 3000);
}

function toggleRecording() {
    log('Toggle recording called, isRecording:', isRecording);
    if (!nameConfirmed) {
        showRecordingStatus('error', 'Please confirm your name first.');
        return;
    }
    
    if (isRecording) {
        log('Stopping recording...');
        stopRecording();
    } else {
        log('Starting recording...');
        startRecognition();
    }
}

function startRecognition() {
    log('startRecognition called');
    if (!recognition && !initSpeechRecognition()) {
        log('Failed to initialize speech recognition');
        return;
    }
    if (isRecording) {
        log('Already recording, ignoring start request');
        return;
    }
    
    // Check if we're in a secure context (required for speech recognition)
    if (!window.isSecureContext) {
        showRecordingStatus('error', 'Speech recognition requires a secure connection (HTTPS). Please use HTTPS or localhost.');
        return;
    }
    
    log('Clearing results before starting new recording');
    clearResults();
    isRecording = true;
    hasFinalResult = false;
    updateRecordingButton();
    
    try {
        log('Starting speech recognition...');
        recognition.start();
        // Fallback stop in 10 seconds
        recordTimeout = setTimeout(() => {
            if (isRecording) {
                log('Recording timeout reached, stopping automatically');
                stopRecording();
                showRecordingStatus('info', 'Recording stopped automatically after 10 seconds.');
            }
        }, 10000);
    } catch (e) {
        console.error('Start recognition error:', e);
        log('Error starting recognition:', e);
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
    log('stopRecording called, isRecording:', isRecording, 'hasFinalResult:', hasFinalResult);
    if (recognition && isRecording) {
        log('Stopping speech recognition...');
        recognition.stop();
    }
    isRecording = false;
    hasFinalResult = false;
    updateRecordingButton();
    document.getElementById('recording-status').classList.add('hidden');
    if (recordTimeout) {
        clearTimeout(recordTimeout);
        recordTimeout = null;
        log('Cleared recording timeout');
    }
    // Don't clear results here - let students see their results
    log('Recording stopped, results should remain visible');
}

function updateRecordingButton() {
    const btn = document.getElementById('record-btn');
    if (isRecording) {
        btn.textContent = '⏹️ Stop Recording';
        btn.classList.add('recording');
        log('Recording button updated to stop state');
    } else {
        btn.textContent = '🎤 Start Recording';
        btn.classList.remove('recording');
        log('Recording button updated to start state');
    }
}

function processRecognitionResult(spokenText) {
    log('processRecognitionResult called with:', spokenText);
    hasFinalResult = true;
    document.getElementById('spoken-display').textContent = spokenText;
    compareTexts(originalText, spokenText);
    document.getElementById('results-area').classList.remove('hidden');
    
    log('Results displayed, sending to teacher...');
    // Send results to teacher
    sendResultsToTeacher(spokenText);
    
    if (isRecording) {
        log('Still recording, stopping...');
        stopRecording();
    }
    // Don't clear results here - let students review their performance
    log('Results should remain visible for student review');
}

function normalizeText(text) {
    return text.toLowerCase()
        .replace(/[^\w\s]/g, '') // Remove all punctuation
        .replace(/\s+/g, ' ')    // Replace multiple spaces with single space
        .trim();
}

function compareTexts(original, spoken) {
    log('compareTexts called with original:', original, 'spoken:', spoken);
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
    
    // Store results for teacher
    window.lastResults = {
        accuracy: accuracy,
        correctWords: correctCount,
        totalWords: totalWords,
        score: score,
        spokenText: spoken
    };
    
    log('Comparison completed - accuracy:', accuracy, 'correct:', correctCount, 'total:', totalWords, 'score:', score);
}

function sendResultsToTeacher(spokenText) {
    log('sendResultsToTeacher called with:', spokenText);
    const results = {
        studentName: studentName || 'Anonymous',
        timestamp: Date.now(),
        accuracy: window.lastResults.accuracy,
        correctWords: window.lastResults.correctWords,
        totalWords: window.lastResults.totalWords,
        score: window.lastResults.score,
        spokenText: spokenText,
        originalText: originalText // Include the original text for teacher display
    };
    
    // Get existing results
    let existingResults = [];
    const savedResults = localStorage.getItem('studentResults');
    if (savedResults) {
        existingResults = JSON.parse(savedResults);
    }
    
    // Add new result
    existingResults.unshift(results);
    
    // Keep only last 50 results
    if (existingResults.length > 50) {
        existingResults = existingResults.slice(0, 50);
    }
    
    // Save to localStorage
    localStorage.setItem('studentResults', JSON.stringify(existingResults));
    
    log('Results sent to teacher successfully');
    showRecordingStatus('success', 'Results sent to teacher!');
}

function clearResults() {
    log('clearResults called');
    document.getElementById('results-area').classList.add('hidden');
    document.getElementById('spoken-display').textContent = '';
    document.getElementById('comparison-display').innerHTML = '';
    log('Results cleared');
}

function showRecordingStatus(type, message) {
    log('showRecordingStatus called:', type, message);
    const statusDiv = document.getElementById('recording-status');
    statusDiv.className = `status ${type}`;
    statusDiv.textContent = message;
    statusDiv.classList.remove('hidden');
}

function updateConnectionStatus() {
    const statusElement = document.getElementById('connection-status');
    const savedText = localStorage.getItem('practiceText');
    
    if (savedText) {
        statusElement.textContent = 'Connected';
        statusElement.className = 'connection-status connected';
    } else {
        statusElement.textContent = 'Disconnected';
        statusElement.className = 'connection-status disconnected';
    }
}

// Initialize the app
document.addEventListener('DOMContentLoaded', function() {
    log('DOM loaded, initializing app...');
    // Check browser compatibility first
    if (checkBrowserCompatibility()) {
        loadStudentName();
        requestMicrophonePermission();
        initSpeechRecognition();
        checkForPracticeText();
        startConnectionCheck();
        
        // Update connection status every 2 seconds
        setInterval(updateConnectionStatus, 2000);
        log('App initialization completed');
    }
});

// Clean up intervals when page is unloaded
window.addEventListener('beforeunload', function() {
    log('Page unloading, cleaning up...');
    if (connectionCheckInterval) {
        clearInterval(connectionCheckInterval);
    }
}); 