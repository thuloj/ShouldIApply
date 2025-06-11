// Initialize PDF.js worker
self.pdfjsLib = self.pdfjsLib || {};
self.pdfjsLib.GlobalWorkerOptions = self.pdfjsLib.GlobalWorkerOptions || {};
self.pdfjsLib.GlobalWorkerOptions.workerSrc = chrome.runtime.getURL('lib/pdf.worker.js');

// Listen for messages from popup
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  console.log('Background script received message:', request.action);
  
  if (request.action === 'analyzeMatch') {
    console.log('Starting job match analysis...');
    analyzeMatch(request.jobText)
      .then(analysis => {
        console.log('Analysis complete, sending response');
        sendResponse({ analysis: analysis });
      })
      .catch(error => {
        console.error('Analysis error:', error);
        sendResponse({ error: error.message });
      });
    return true; // Keep the message channel open for async response
  }
});

async function analyzeMatch(jobText) {
  try {
    console.log('Starting analysis with job text length:', jobText.length);
    
    // Get API key from storage
    const { openaiApiKey } = await chrome.storage.local.get(['openaiApiKey']);
    if (!openaiApiKey) {
      throw new Error('Please set your OpenAI API key in the extension options first.');
    }
    
    const resumeText = await new Promise((resolve, reject) => {
      chrome.storage.local.get(['resumeText'], function(result) {
        console.log('Retrieved resume from storage:', result.resumeText ? 'Found' : 'Not found');
        if (result.resumeText) {
          resolve(result.resumeText);
        } else {
          reject(new Error('No resume found. Please upload your resume first.'));
        }
      });
    });

    console.log('Making first API call to extract job info...');
    // First, extract just the job-related information
    const jobExtractionResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openaiApiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4.1-nano',
        messages: [
          {
            role: 'system',
            content: 'You are a job posting analyzer. Extract only the relevant job information from the provided text. Include job title, requirements, responsibilities, and qualifications. Exclude navigation elements, ads, and other unrelated content. Format the output as a clean, structured job posting.'
          },
          {
            role: 'user',
            content: `First, check to make sure that the text I provide is a job posting. If it is not a job posting, just return exactly this: "ERROR: This is not a job posting."  Else, extract and provide the job posting information. Text:\n\n${jobText}`
          }
        ],
        temperature: 0.3,
        max_tokens: 1000
      })
    });

    console.log('First API call response status:', jobExtractionResponse.status);
    const extractedJobData = await jobExtractionResponse.json();
    console.log('First API call response:', extractedJobData);

    if (!jobExtractionResponse.ok) {
      console.error('First API call failed:', extractedJobData);
      throw new Error('Failed to extract job information: ' + (extractedJobData.error?.message || 'Unknown error'));
    }

    const cleanJobText = extractedJobData.choices[0].message.content;
    console.log('Extracted job text:', cleanJobText);

    // Check for specific error message
    if (cleanJobText.trim() === "ERROR: This is not a job posting.") {
      console.log('Not a job posting detected, aborting analysis');
      throw new Error('This page does not appear to be a job posting. Please navigate to a job listing page.');
    }

    console.log('Extracted job text length:', cleanJobText.length);

    // Now analyze the match with the cleaned job text
    console.log('Making second API call to analyze match...');
    const prompt = `You are an expert technical recruiter.

Given a resume and a job description, decide whether the candidate should apply to the role.

**Primary filters** (in order of importance):
1. Years of experience – does the candidate meet or exceed the required experience?
2. Core skill match – do they have direct experience with most or all required languages, tools, and frameworks?

Only consider applying if both are reasonably satisfied.

Output format should be exactly in a string format as follows, without any other text or formatting: 
---
"Verdict: [Apply or Not Apply]. [One sentence summary that mentions experience and key skills match/mismatch]"
---

Resume:
${resumeText}

Job Posting:
${cleanJobText}`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openaiApiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4.1-mini',
        messages: [
          {
            role: 'system',
            content: 'You are a professional resume and job matching expert. Provide clear, concise analysis focusing on the most important matches and gaps. Format your response with clear sections and bullet points.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: 2000
      })
    });

    console.log('Second API call response status:', response.status);
    const data = await response.json();
    console.log('Second API call response:', data);

    if (!response.ok) {
      console.error('Second API call failed:', data);
      throw new Error('Failed to analyze match: ' + (data.error?.message || 'Unknown error'));
    }

    return data.choices[0].message.content;
  } catch (error) {
    console.error('Full error details:', error);
    throw new Error('Analysis failed: ' + error.message);
  }
} 