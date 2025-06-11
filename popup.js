document.addEventListener('DOMContentLoaded', function() {
  const dropZone = document.getElementById('dropZone');
  const fileInput = document.getElementById('fileInput');
  const errorDiv = document.getElementById('error');
  const loadingDiv = document.getElementById('loading');
  const matchSection = document.getElementById('matchSection');
  const analyzeButton = document.getElementById('analyzeButton');
  const resumeStatus = document.getElementById('resumeStatus');
  const historyTableBody = document.getElementById('historyTableBody');

  // Set up PDF.js worker
  pdfjsLib.GlobalWorkerOptions.workerSrc = chrome.runtime.getURL('lib/pdf.worker.js');

  // Load and display history
  loadHistory();

  // Check if resume is already uploaded
  chrome.storage.local.get(['resumeText'], function(result) {
    if (result.resumeText) {
      updateResumeStatus(true);
      matchSection.style.display = 'block';
    }
  });

  // Handle file selection
  fileInput.addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (file) {
      handleFile(file);
    }
  });

  // Handle drag and drop
  dropZone.addEventListener('dragover', function(e) {
    e.preventDefault();
    dropZone.classList.add('dragover');
  });

  dropZone.addEventListener('dragleave', function(e) {
    e.preventDefault();
    dropZone.classList.remove('dragover');
  });

  dropZone.addEventListener('drop', function(e) {
    e.preventDefault();
    dropZone.classList.remove('dragover');
    const file = e.dataTransfer.files[0];
    if (file) {
      handleFile(file);
    }
  });

  // Handle click to select file
  dropZone.addEventListener('click', function() {
    fileInput.click();
  });

  // Handle file processing
  async function handleFile(file) {
    if (file.type !== 'application/pdf') {
      showError('Please upload a PDF file');
      return;
    }

    try {
      showLoading();
      const arrayBuffer = await readFileAsArrayBuffer(file);
      const text = await processPDF(arrayBuffer);
      
      // Store the resume text
      chrome.storage.local.set({ resumeText: text }, function() {
        hideLoading();
        updateResumeStatus(true);
        matchSection.style.display = 'block';
        showError('');
      });
    } catch (error) {
      hideLoading();
      showError('Failed to process PDF: ' + error.message);
    }
  }

  // Update resume status display
  function updateResumeStatus(isUploaded) {
    resumeStatus.className = 'resume-status ' + (isUploaded ? 'uploaded' : 'not-uploaded');
    if (isUploaded) {
      resumeStatus.innerHTML = '<span>Resume uploaded</span><button id="replaceButton" style="margin-left: auto; padding: 4px 8px; font-size: 12px;">Replace</button>';
      // Add click handler to the replace button
      document.getElementById('replaceButton').addEventListener('click', function() {
        fileInput.click();
      });
    } else {
      resumeStatus.innerHTML = '<span>No resume uploaded</span>';
    }
  }

  // Read file as ArrayBuffer
  function readFileAsArrayBuffer(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsArrayBuffer(file);
    });
  }

  // Process PDF and extract text
  async function processPDF(arrayBuffer) {
    try {
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      let fullText = '';
      
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items.map(item => item.str).join(' ');
        fullText += pageText + '\n';
      }
      
      return fullText;
    } catch (error) {
      throw new Error('Failed to process PDF: ' + error.message);
    }
  }

  // Show error message
  function showError(message) {
    errorDiv.textContent = message;
    errorDiv.style.display = message ? 'block' : 'none';
  }

  // Show loading indicator
  function showLoading() {
    loadingDiv.style.display = 'block';
    analyzeButton.disabled = true;
  }

  // Hide loading indicator
  function hideLoading() {
    loadingDiv.style.display = 'none';
    analyzeButton.disabled = false;
  }

  // Load and display history
  function loadHistory() {
    chrome.storage.local.get(['analysisHistory'], function(result) {
      const history = result.analysisHistory || [];
      historyTableBody.innerHTML = '';
      
      history.forEach((item, index) => {
        // Parse the verdict and explanation
        const verdictMatch = item.analysis.match(/Verdict:\s*([^.]+)\.\s*(.+)/i);
        const verdict = verdictMatch ? verdictMatch[1].trim() : 'Unknown';
        const explanation = verdictMatch ? verdictMatch[2].trim() : item.analysis;
        const isApply = verdict.toLowerCase().includes('apply');
        
        const row = document.createElement('tr');
        row.innerHTML = `
          <td><a href="${item.url}" class="job-link" target="_blank">${item.title || 'Job Listing'}</a></td>
          <td>${new Date(item.date).toLocaleDateString()}</td>
          <td><span class="verdict ${isApply ? 'apply' : 'dont-apply'}" data-index="${index}">${verdict}</span></td>
        `;
        
        const analysisDiv = document.createElement('tr');
        analysisDiv.innerHTML = `
          <td colspan="3">
            <div class="full-analysis" id="analysis-${index}">
              <div class="analysis-content">
                <div class="explanation">${explanation}</div>
              </div>
            </div>
          </td>
        `;
        
        historyTableBody.appendChild(row);
        historyTableBody.appendChild(analysisDiv);

        // Add click handler to the verdict span
        const verdictSpan = row.querySelector('.verdict');
        verdictSpan.addEventListener('click', function() {
          const analysisDiv = document.getElementById(`analysis-${this.dataset.index}`);
          analysisDiv.classList.toggle('visible');
        });
      });
    });
  }

  // Format analysis text for better display
  function formatAnalysis(analysis) {
    // Split the analysis into sections
    const sections = analysis.split('\n\n');
    return sections.map(section => {
      // If the section starts with a number or bullet point, format it as a list
      if (section.match(/^\d+\.|^•/)) {
        const items = section.split('\n').map(item => item.trim());
        return `<div class="analysis-section">${items.join('<br>')}</div>`;
      }
      // Otherwise, return as a paragraph
      return `<div class="analysis-section">${section}</div>`;
    }).join('');
  }

  // Add to history
  function addToHistory(url, title, analysis) {
    chrome.storage.local.get(['analysisHistory'], function(result) {
      const history = result.analysisHistory || [];
      history.unshift({
        url,
        title,
        date: new Date().toISOString(),
        analysis
      });
      
      // Keep only last 10 entries
      if (history.length > 10) {
        history.pop();
      }
      
      chrome.storage.local.set({ analysisHistory: history }, function() {
        loadHistory();
      });
    });
  }

  // Handle analyze button click
  analyzeButton.addEventListener('click', async function() {
    try {
      console.log('Starting analysis process...');
      showLoading();
      showError('');

      // Get the current tab
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      console.log('Current tab:', tab.url);
      
      // First, try to inject the content script if it's not already there
      try {
        console.log('Attempting to inject content script...');
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['content.js']
        });
        console.log('Content script injection successful');
      } catch (error) {
        console.log('Content script injection result:', error.message);
      }

      // Send message to content script to get job text
      console.log('Sending message to content script...');
      const response = await new Promise((resolve, reject) => {
        chrome.tabs.sendMessage(tab.id, { action: 'getJobText' }, function(response) {
          console.log('Content script response:', response);
          if (chrome.runtime.lastError) {
            console.error('Content script error:', chrome.runtime.lastError);
            reject(new Error('Please refresh the page and try again. If the problem persists, try closing and reopening the extension.'));
          } else {
            resolve(response);
          }
        });
      });

      if (!response.jobText) {
        console.error('No text extracted from page');
        throw new Error('Failed to extract page content');
      }

      console.log('Text extracted, length:', response.jobText.length);

      // Send text to background script for analysis
      console.log('Sending text to background script for analysis...');
      const analysisResponse = await new Promise((resolve, reject) => {
        chrome.runtime.sendMessage(
          { action: 'analyzeMatch', jobText: response.jobText },
          function(response) {
            console.log('Background script response:', response);
            if (chrome.runtime.lastError) {
              console.error('Background script error:', chrome.runtime.lastError);
              reject(new Error(chrome.runtime.lastError.message));
            } else {
              resolve(response);
            }
          }
        );
      });

      console.log('Analysis complete, updating UI...');
      hideLoading();
      if (analysisResponse.error) {
        console.error('Analysis error:', analysisResponse.error);
        showError(analysisResponse.error);
      } else {
        console.log('Adding to history...');
        // Add to history
        addToHistory(tab.url, tab.title, analysisResponse.analysis);
        // Show success message
        showError('Analysis complete! Check the history table below.');
      }
    } catch (error) {
      console.error('Error in analysis process:', error);
      hideLoading();
      showError(error.message);
    }
  });
}); 