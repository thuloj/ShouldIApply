// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Content script received message:', request);
  
  if (request.action === 'getJobText') {
    console.log('Extracting text...');
    const text = extractJobPosting();
    console.log('Text extracted, length:', text.length);
    
    sendResponse({ jobText: text });
  }
  return true; // Keep the message channel open for async response
});

function extractJobPosting() {
  console.log('Starting text extraction...');
  
  // Get all text content from the page
  const allText = document.body.innerText;
  console.log('Raw text length:', allText.length);
  
  // Clean up the text
  const cleanedText = allText
    .replace(/\s+/g, ' ')  // Replace multiple spaces with single space
    .replace(/\n+/g, ' ')  // Replace newlines with space
    .trim();
  
  console.log('Cleaned text length:', cleanedText.length);
  return cleanedText;
} 