let originalText = '';
let studentResults = [];
let refreshInterval = null;

// Initialize teacher dashboard
document.addEventListener('DOMContentLoaded', function() {
    loadSavedText();
    loadStudentResults();
    startRealTimeUpdates();
    updateStudentLink();
});

function saveText() {
    const textInput = document.getElementById('original-text');
    const text = textInput.value.trim();
    if (!text) {
        showSavedStatus('error', 'Please enter some text first.');
        return;
    }
    originalText = text;
    localStorage.setItem('practiceText', text);
    showSavedStatus('success', 'Text saved successfully! Students can now practice.');
}

function clearText() {
    document.getElementById('original-text').value = '';
    originalText = '';
    localStorage.removeItem('practiceText');
    showSavedStatus('info', 'Text cleared.');
}

function loadSavedText() {
    const savedText = localStorage.getItem('practiceText');
    if (savedText) {
        originalText = savedText;
        document.getElementById('original-text').value = savedText;
    }
}

function loadStudentResults() {
    const savedResults = localStorage.getItem('studentResults');
    if (savedResults) {
        studentResults = JSON.parse(savedResults);
        displayStudentResults();
    }
}

function startRealTimeUpdates() {
    // Check for new student results every 2 seconds
    refreshInterval = setInterval(() => {
        const savedResults = localStorage.getItem('studentResults');
        if (savedResults) {
            const newResults = JSON.parse(savedResults);
            if (JSON.stringify(newResults) !== JSON.stringify(studentResults)) {
                studentResults = newResults;
                displayStudentResults();
            }
        }
    }, 2000);
}

function refreshResults() {
    loadStudentResults();
    showSavedStatus('info', 'Results refreshed.');
}

function clearAllResults() {
    studentResults = [];
    localStorage.removeItem('studentResults');
    displayStudentResults();
    showSavedStatus('info', 'All student results cleared.');
}

function displayStudentResults() {
    const container = document.getElementById('student-results-container');
    
    if (studentResults.length === 0) {
        container.innerHTML = '<div class="no-students">No student results yet. Students will appear here when they practice.</div>';
        return;
    }
    
    // Group results by student name
    const studentGroups = {};
    studentResults.forEach((result, index) => {
        const studentName = result.studentName || 'Anonymous';
        if (!studentGroups[studentName]) {
            studentGroups[studentName] = [];
        }
        studentGroups[studentName].push({...result, originalIndex: index});
    });
    
    let html = '';
    Object.keys(studentGroups).forEach((studentName, studentIndex) => {
        const studentResults = studentGroups[studentName];
        const latestResult = studentResults[0]; // Most recent result
        const totalAttempts = studentResults.length;
        
        // Calculate average accuracy for this student
        const avgAccuracy = Math.round(
            studentResults.reduce((sum, result) => sum + result.accuracy, 0) / totalAttempts
        );
        
        html += `
            <div class="student-dropdown" data-student="${studentName}">
                <div class="student-header" onclick="toggleStudentResults('${studentName}')">
                    <div>
                        <div class="student-name-display">${studentName}</div>
                        <div class="student-summary">
                            ${totalAttempts} attempt${totalAttempts > 1 ? 's' : ''} • 
                            Latest: ${latestResult.accuracy}% accuracy • 
                            Average: ${avgAccuracy}% accuracy
                        </div>
                    </div>
                    <div class="dropdown-arrow" id="arrow-${studentName}">▼</div>
                </div>
                <div class="student-content" id="content-${studentName}">
                    <div class="student-content-inner">
        `;
        
        // Add all results for this student
        studentResults.forEach((result, resultIndex) => {
            // Create word-by-word comparison display
            const originalWords = result.originalText ? result.originalText.toLowerCase().replace(/[^\w\s]/g, '').replace(/\s+/g, ' ').trim().split(/\s+/) : [];
            const spokenWords = result.spokenText ? result.spokenText.toLowerCase().replace(/[^\w\s]/g, '').replace(/\s+/g, ' ').trim().split(/\s+/) : [];
            
            let comparisonHTML = '';
            for (let i = 0; i < originalWords.length; i++) {
                const originalWord = originalWords[i];
                const spokenWord = spokenWords[i];
                if (spokenWord && originalWord === spokenWord) {
                    comparisonHTML += `<span class="word correct">${originalWord}</span>`;
                } else if (spokenWord) {
                    comparisonHTML += `<span class="word incorrect">${originalWord}</span>`;
                } else {
                    comparisonHTML += `<span class="word missing">${originalWord}</span>`;
                }
            }
            // Add extra words spoken
            for (let i = originalWords.length; i < spokenWords.length; i++) {
                comparisonHTML += `<span class="word exceeded">${spokenWords[i]}</span>`;
            }
            
            html += `
                <div class="student-results" style="margin-bottom: 20px; padding-bottom: 20px; border-bottom: ${resultIndex < studentResults.length - 1 ? '1px solid #eee' : 'none'};">
                    <div class="student-info">
                        <span class="timestamp">Attempt ${resultIndex + 1} - ${new Date(result.timestamp).toLocaleString()}</span>
                    </div>
                    <div class="result-stats">
                        <div class="result-stat">
                            <div class="number">${result.accuracy}%</div>
                            <div class="label">Accuracy</div>
                        </div>
                        <div class="result-stat">
                            <div class="number">${result.correctWords}</div>
                            <div class="label">Correct Words</div>
                        </div>
                        <div class="result-stat">
                            <div class="number">${result.totalWords}</div>
                            <div class="label">Total Words</div>
                        </div>
                        <div class="result-stat">
                            <div class="number">${result.score}</div>
                            <div class="label">Score</div>
                        </div>
                    </div>
                    <div style="margin-top: 15px;">
                        <strong>🗣️ What student said:</strong>
                        <div style="margin: 8px 0; font-style: italic; color: #666;">"${result.spokenText}"</div>
                    </div>
                    <div style="margin-top: 15px;">
                        <strong>📝 Word-by-word comparison:</strong>
                        <div class="comparison-display" style="margin: 8px 0; line-height: 1.6; word-wrap: break-word;">
                            ${comparisonHTML}
                        </div>
                    </div>
                </div>
            `;
        });
        
        html += `
                    </div>
                </div>
            </div>
        `;
    });
    
    container.innerHTML = html;
}

function toggleStudentResults(studentName) {
    const header = document.querySelector(`[data-student="${studentName}"] .student-header`);
    const content = document.getElementById(`content-${studentName}`);
    const arrow = document.getElementById(`arrow-${studentName}`);
    
    const isExpanded = content.classList.contains('expanded');
    
    // Close all other dropdowns
    document.querySelectorAll('.student-content').forEach(content => {
        content.classList.remove('expanded');
    });
    document.querySelectorAll('.student-header').forEach(header => {
        header.classList.remove('active');
    });
    document.querySelectorAll('.dropdown-arrow').forEach(arrow => {
        arrow.classList.remove('expanded');
    });
    
    // Toggle current dropdown
    if (!isExpanded) {
        content.classList.add('expanded');
        header.classList.add('active');
        arrow.classList.add('expanded');
    }
}

function updateStudentLink() {
    const currentUrl = window.location.origin + window.location.pathname;
    const studentUrl = currentUrl.replace('teacher.html', 'student.html');
    document.getElementById('student-link').textContent = studentUrl;
}

function copyStudentLink() {
    const studentUrl = document.getElementById('student-link').textContent;
    navigator.clipboard.writeText(studentUrl).then(() => {
        showSavedStatus('success', 'Student link copied to clipboard!');
    }).catch(() => {
        showSavedStatus('error', 'Failed to copy link. Please copy manually.');
    });
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

// Clean up interval when page is unloaded
window.addEventListener('beforeunload', function() {
    if (refreshInterval) {
        clearInterval(refreshInterval);
    }
}); 