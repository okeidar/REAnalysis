# Context
create chrome extension setup as a base for my chrome extension app for chatgpt. the extension should work only inside chatgpt and not on other websites.

# Requirements
- A basic extension that is enabled only on chatgpt.com

# Tasks
- [x] Create a basic extension that is enabled only on chatgpt.com
- [x] Test the extension active state on the chatGPT page.
- [x] Test the extension active state on other pages.

# Status: ✅ COMPLETED
The basic extension structure has been created and tested. The extension:
- Only activates on chatgpt.com and chat.openai.com domains
- Shows "Active on ChatGPT" status when on supported sites
- Shows "Not available on this site" when on other websites
- Uses proper manifest.json with host_permissions restricted to ChatGPT domains