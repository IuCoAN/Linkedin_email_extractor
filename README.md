# LinkedIn Email Extractor

A powerful Chrome extension that automatically extracts email addresses from LinkedIn profiles, connection lists, and messages.

![LinkedIn Email Extractor](https://example.com/screenshot.png)

## Features

- **Extract emails** from LinkedIn profiles, connections, and messages
- **Auto-scanning mode** that continuously scans as you browse LinkedIn
- **Customizable extraction options** to target specific areas
- **Advanced email detection** that finds emails even when they're obfuscated
- **Email validation** to ensure high-quality results
- **Export functionality** to save emails as CSV
- **Privacy-focused** - all processing happens in your browser
- **Easy-to-use interface** with status indicators and statistics

## Installation

### Chrome Web Store (Recommended)
1. Visit the [Chrome Web Store](https://chrome.google.com/webstore/detail/linkedin-email-extractor/extension-id)
2. Click "Add to Chrome"
3. Confirm the installation

### Manual Installation
1. Download or clone this repository
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" (toggle in the top-right corner)
4. Click "Load unpacked" and select the downloaded folder
5. The extension should now be installed and visible in your toolbar

## How to Use

1. **Navigate to LinkedIn**: Go to profiles, connections, or messages pages
2. **Click the extension icon**: Open the popup interface
3. **Configure extraction options**:
   - Choose what to scan (profiles, connections, messages)
   - Set scan depth and other options in Settings
4. **Extract emails**:
   - Click "Extract Once" for a single scan
   - Click "Start Auto-Scan" for continuous scanning
5. **Export results**:
   - Copy individual emails or all emails at once
   - Download as CSV file

## Features Explained

### Extraction Modes

- **Single Extraction**: Scans the current page once
- **Auto-Scan**: Continuously scans as you browse LinkedIn
  - Automatically detects new content as you scroll
  - Respects rate limits to avoid detection

### Scan Options

- **Scan Profile**: Extract email from the current profile page
  - Automatically clicks "Contact Info" sections when available
- **Scan Connections**: Extract emails from your connections list
  - Configurable depth to control how many connections to scan
- **Scan Messages**: Extract emails from message conversations
  - Detects emails in message threads and conversation snippets

### Advanced Settings

- **Scan Depth**: Choose how thorough the extraction should be
  - Level 1: Quick scan of immediate elements
  - Level 2: More thorough scan with expanded sections
  - Level 3: Deep scan that follows links and expands all content
- **Email Validation**: Filter out invalid or malformed emails
- **Disposable Email Filter**: Option to exclude temporary/disposable email services
- **Rate Limiting**: Adjust delay between operations to avoid detection

## Privacy & Ethics

This extension:
- **Does not store your data** on any server
- **Does not transmit data** outside your browser
- **Does not require an account** or authentication
- **Stores extracted emails** only in your local browser storage

### Ethical Usage Guidelines

This tool is designed for:
- **Networking professionals** looking to connect with prospects
- **Recruiters** trying to reach potential candidates
- **Researchers** collecting data with proper consent

Please use this tool responsibly:
- Always respect LinkedIn's Terms of Service
- Obtain proper consent before contacting people
- Follow applicable laws including GDPR, CAN-SPAM, etc.
- Do not use for spamming or mass unsolicited emails

## Technical Details

The extension consists of:
- **Manifest.json**: Configuration file for Chrome extension
- **Background.js**: Background script managing extension state
- **Content.js**: Content script that interacts with LinkedIn pages
- **Popup.html/js**: User interface for controlling the extension

The email extraction process:
1. Analyzes the DOM for visible email addresses
2. Automatically accesses hidden information like contact info sections
3. Uses multiple regex patterns to detect emails even when obfuscated
4. Validates and filters results based on user settings
5. Stores unique emails in the browser's local storage

## Troubleshooting

- **No emails found**: Try different scan options or increase scan depth
- **Extension not responding**: Refresh the LinkedIn page and try again
- **Auto-scan not working**: Make sure you're on a LinkedIn page and check your scan delay setting
- **Missing "Contact Info" emails**: Some profiles have privacy settings that hide emails

## License

This extension is released under the MIT License. See the [LICENSE](LICENSE) file for details.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## Disclaimer

This extension is not affiliated with, endorsed by, or in any way officially connected with LinkedIn Corporation or any of its subsidiaries or affiliates.

---

Created with ❤️ for networking professionals and recruiters
