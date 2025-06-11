// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Content script received message:', request);
  
  if (request.action === 'getJobText') {
    console.log('Extracting job posting...');
    const jobInfo = extractJobPosting();
    console.log('Job info extracted:', jobInfo);
    
    if (jobInfo.isJobPage) {
      console.log('Sending job text back to popup');
      sendResponse({ 
        jobText: jobInfo.text,
        isJobPage: true
      });
    } else {
      console.log('Not a job page, sending reason:', jobInfo.reason);
      sendResponse({ 
        isJobPage: false,
        reason: jobInfo.reason
      });
    }
  }
  return true; // Keep the message channel open for async response
});

function extractJobPosting() {
  console.log('Starting job posting extraction...');
  
  // Get all text content from the page
  const allText = document.body.innerText;
  console.log('Raw text length:', allText.length);
  
  // Clean up the text
  const cleanedText = allText
    .replace(/\s+/g, ' ')  // Replace multiple spaces with single space
    .replace(/\n+/g, ' ')  // Replace newlines with space
    .trim();
  
  console.log('Cleaned text length:', cleanedText.length);
  
  // If text is too short, it's probably not a job posting
  if (cleanedText.length < 100) {
    console.log('Text too short, not a job posting');
    return {
      isJobPage: false,
      reason: 'Page content is too short to be a job posting'
    };
  }
  
  // Check if we're on a known job site
  const url = window.location.href.toLowerCase();
  console.log('Current URL:', url);
  
  const knownJobSites = [
    { pattern: 'linkedin.com/jobs', name: 'LinkedIn' },
    { pattern: 'indeed.com/job', name: 'Indeed' },
    { pattern: 'glassdoor.com/Job', name: 'Glassdoor' },
    { pattern: 'monster.com/job', name: 'Monster' },
    { pattern: 'careerbuilder.com/job', name: 'CareerBuilder' },
    { pattern: 'ziprecruiter.com/job', name: 'ZipRecruiter' },
    { pattern: 'dice.com/job', name: 'Dice' },
    { pattern: 'simplyhired.com/job', name: 'SimplyHired' }
  ];
  
  const isKnownJobSite = knownJobSites.some(site => url.includes(site.pattern));
  console.log('Is known job site:', isKnownJobSite);
  
  // If we're on a known job site, return the text
  if (isKnownJobSite) {
    console.log('Known job site detected, returning text');
    return {
      isJobPage: true,
      text: cleanedText
    };
  }
  
  // For other sites, try to find job-related content
  const jobKeywords = [
    'job description',
    'requirements',
    'qualifications',
    'responsibilities',
    'apply now',
    'job type',
    'experience required',
    'skills required',
    'job title',
    'position overview',
    'about the role',
    'about this job',
    'job details',
    'job summary',
    'job requirements',
    'job responsibilities',
    'job duties',
    'job location',
    'job type',
    'employment type',
    'work type',
    'job category',
    'job function',
    'job level',
    'job industry'
  ];
  
  const foundKeywords = jobKeywords.filter(keyword => 
    cleanedText.toLowerCase().includes(keyword)
  );
  
  console.log('Found job keywords:', foundKeywords);
  console.log('Number of keywords found:', foundKeywords.length);
  
  // If we found enough job-related keywords, it's probably a job posting
  if (foundKeywords.length >= 3) {
    console.log('Enough job keywords found, returning text');
    return {
      isJobPage: true,
      text: cleanedText
    };
  }
  
  console.log('Not enough job keywords found, not a job posting');
  return {
    isJobPage: false,
    reason: 'This page does not appear to be a job posting. Please navigate to a job listing page.'
  };
} 